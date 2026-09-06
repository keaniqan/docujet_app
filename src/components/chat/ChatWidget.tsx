"use client";

/**
 * The floating assistant on the public site.
 *
 * Mounted once by `SiteChrome`, so it rides along on every visitor-facing page
 * — including the ones Plasmic renders — and never appears on /admin, /login,
 * or the Plasmic host. Because the root layout persists across client
 * navigations, an open conversation survives moving between pages; the copy in
 * `sessionStorage` is what carries it across a hard reload.
 *
 * It knows nothing about how an answer is produced. It posts to `/api/chat` and
 * renders whatever comes back — which is why moving the assistant out of an n8n
 * workflow and into this app (src/lib/chat/) did not touch this file.
 */

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import ChatCapture from "./ChatCapture";
import type { ChatCaptureTemplates } from "@/lib/content/types";

/**
 * The markdown parser is a good deal larger than the panel it serves, and most
 * visitors never open the panel — so it is fetched on open rather than on page
 * load. Until the chunk lands, the fallback shows the same text unparsed, which
 * means a slow network costs the reply's formatting for a moment and never the
 * reply itself.
 */
const MessageText = lazy(() => import("./MessageText"));

function AssistantText({ text }: { text: string }) {
  return (
    <Suspense fallback={<PlainText text={text} />}>
      <MessageText text={text} />
    </Suspense>
  );
}

/** Verbatim text: the greeting, and anything the visitor typed themselves. */
function PlainText({ text }: { text: string }) {
  return <span className="whitespace-pre-wrap">{text}</span>;
}

type Message = {
  id: string;
  /** `error` is rendered as a notice rather than a bubble, and never sent back as history. */
  role: "user" | "assistant" | "error";
  content: string;
};

/** Fallback copy, used when no parent thread supplies props (Plasmic canvas, etc.). Matches `DEFAULT_SETTINGS.chat` in `src/lib/settings/defaults.ts`. */
const DEFAULT_GREETING =
  "Hi! I'm the DocuJet assistant. Ask me about the WorkForce Enterprise range, pricing direction, or booking a consultation.";

const DEFAULT_SUGGESTIONS = [
  "What resolution and geometry do the Epson MicroTFP print chips have?",
  "What is Heat-Free Technology?",
  "How fast do the Epson WorkForce Enterprise printers print on A4?",
];

const DEFAULT_MAX_MESSAGE_CHARS = 1000;

/** Turns kept in the panel and forwarded as context. Matches the API's own cap. */
const DEFAULT_MAX_HISTORY_TURNS = 8;

const STORAGE_KEY = "docujet.chat.transcript";
const SESSION_KEY = "docujet.chat.session";
/** Set once the visitor has captured or declined, so the card is offered once. */
const CAPTURE_KEY = "docujet.chat.captured";

/**
 * Questions only a person can answer.
 *
 * The system prompt already refuses to quote prices, lead times or stock —
 * pricing is quoted by a human after a consultation. That was a correct policy
 * with a dead end at the end of it: the most valuable question a visitor can
 * ask got the least useful reply and no route onward. This pattern is what
 * turns the refusal into a handover.
 *
 * Deliberately narrow. Matching loosely would put a contact form in front of
 * someone asking about paper trays, which trains visitors to dismiss it before
 * reading it, and the one time it matters they will not see it.
 */
const BUYING_INTENT =
  /\b(price|pricing|cost|costs|quote|quotation|how much|discount|lease|leasing|rent|rental|financ|instal(?:ment|ments)|payment plan|budget|buy|purchase|order|trade[- ]?in|demo|demonstration|trial|site visit|consultation)\b/i;

/** Assistant replies before the card is offered on depth alone. */
const DEPTH_TURNS = 4;

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type ChatWidgetProps = {
  /** The handover cards, as the Content Management page has them. */
  captureCopy?: ChatCaptureTemplates;
  greeting?: string;
  suggestions?: string[];
  maxMessageChars?: number;
  maxHistoryTurns?: number;
};

export default function ChatWidget({
  captureCopy,
  greeting = DEFAULT_GREETING,
  suggestions = DEFAULT_SUGGESTIONS,
  maxMessageChars = DEFAULT_MAX_MESSAGE_CHARS,
  maxHistoryTurns = DEFAULT_MAX_HISTORY_TURNS,
}: ChatWidgetProps) {
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isPending, setIsPending] = useState(false);

  // The handover. `capture` holds why the card is showing and what it should
  // carry; `captured` records that this visitor is done being asked, either
  // because they left details or because they said no.
  // Snapshotted at the moment the offer is made, not read during render: the
  // card must carry the conversation as it stood when the visitor was asked,
  // and a ref read while rendering would neither update nor mean that.
  const [capture, setCapture] = useState<{
    trigger: "intent" | "unanswered" | "depth";
    topic: string;
    cited: string[];
    sessionId: string;
  } | null>(null);
  const [captured, setCaptured] = useState(false);

  // Every knowledge-base id the assistant has used in this conversation. A
  // captured lead carries the lot, because what a rep wants is the shape of
  // what the visitor was researching, not just the last thing they asked.
  const citedRef = useRef<string[]>([]);

  const sessionIdRef = useRef<string>("");
  const restoredRef = useRef(false);
  const refocusLauncherRef = useRef(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /**
   * A stable id for this visitor's conversation.
   *
   * The server keeps no conversation state — the transcript below is what
   * carries context, and it is sent with every question — so this is now only
   * an abuse-control handle, passed through to the model provider as `user_id`.
   *
   * Created on first use rather than on mount, because most visitors never open
   * the panel and a page load should not be writing to their storage.
   */
  function sessionId(): string {
    if (sessionIdRef.current) return sessionIdRef.current;

    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      sessionIdRef.current = stored ?? newId();
      if (!stored) sessionStorage.setItem(SESSION_KEY, sessionIdRef.current);
    } catch {
      // Private browsing, or storage disabled. The id then lasts as long as the
      // page does, which is enough for one visit's conversation.
      sessionIdRef.current = newId();
    }

    return sessionIdRef.current;
  }

  /**
   * Reads back a conversation left behind by a reload.
   *
   * Deliberately done on open rather than on mount: it keeps the restore out of
   * an effect (where it would cascade a render for every visitor) and costs
   * nothing for the ones who never open the panel.
   */
  function open() {
    // Start fetching the markdown chunk now. A reply takes seconds to arrive,
    // so by the time there is anything to format it is almost always ready.
    void import("./MessageText");

    if (!restoredRef.current) {
      restoredRef.current = true;
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        const parsed = stored ? (JSON.parse(stored) as Message[]) : null;
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
        // A visitor who already left their details, or already said no, must
        // not be asked again by a reload. The transcript survives one; without
        // this the decision would not.
        if (sessionStorage.getItem(CAPTURE_KEY)) setCaptured(true);
      } catch {
        // A corrupt or unreadable transcript is not worth a visible error.
      }
    }

    setIsOpen(true);
  }

  useEffect(() => {
    if (messages.length === 0) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // Not worth telling the visitor about — the panel still works.
    }
  }, [messages]);

  // Pin to the newest message whenever the transcript grows or the typing
  // indicator appears.
  useEffect(() => {
    if (!isOpen) return;
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, isPending, isOpen]);

  // Keyboard focus follows the panel. Closing has to hand focus back in an
  // effect rather than in the handler, because the launcher does not exist
  // again until the render that unmounts the panel has happened.
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    } else if (refocusLauncherRef.current) {
      refocusLauncherRef.current = false;
      launcherRef.current?.focus();
    }
  }, [isOpen]);

  // Grow the composer with its content, up to a few lines, then scroll.
  useEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 120)}px`;
  }, [input]);

  const close = useCallback(() => {
    refocusLauncherRef.current = true;
    setIsOpen(false);
  }, []);

  /**
   * Starts a clean conversation: an empty transcript, so no earlier turn is
   * sent as context again, and a fresh session id to match — the panel and the
   * server should agree that this is a new conversation.
   */
  const resetSession = useCallback(() => {
    sessionIdRef.current = newId();
    try {
      sessionStorage.setItem(SESSION_KEY, sessionIdRef.current);
      sessionStorage.removeItem(STORAGE_KEY);
      // A new conversation is a new chance to offer the handover. The flag is
      // about not badgering someone mid-conversation, not about remembering a
      // refusal forever.
      sessionStorage.removeItem(CAPTURE_KEY);
    } catch {
      // Private browsing, or storage disabled — the in-memory id still resets.
    }
    citedRef.current = [];
    setCapture(null);
    setCaptured(false);
    setMessages([]);
    setInput("");
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  async function send(text: string) {
    const question = text.trim();
    if (question === "" || isPending) return;

    // Snapshot before the state update so the request carries the turns the
    // visitor can actually see, minus any failure notices.
    const history = messages
      .filter((message) => message.role !== "error")
      .slice(-maxHistoryTurns)
      .map(({ role, content }) => ({ role: role as "user" | "assistant", content }));

    setMessages((current) => [
      ...current,
      { id: newId(), role: "user", content: question },
    ]);
    setInput("");
    setIsPending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          sessionId: sessionId(),
          page: pathname,
          history,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        reply?: string;
        error?: string;
        cited?: string[];
        answered?: boolean;
      };

      setMessages((current) => [
        ...current,
        response.ok && data.reply
          ? { id: newId(), role: "assistant", content: data.reply }
          : {
              id: newId(),
              role: "error",
              content:
                data.error ??
                "The assistant is unavailable right now. Please try again shortly.",
            },
      ]);

      if (response.ok && data.reply) {
        if (Array.isArray(data.cited)) {
          citedRef.current = [...new Set([...citedRef.current, ...data.cited])];
        }
        offerCapture(question, data.answered !== false);
      }
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: newId(),
          role: "error",
          content:
            "We could not reach the assistant. Check your connection and try again.",
        },
      ]);
    } finally {
      setIsPending(false);
      inputRef.current?.focus();
    }
  }

  /**
   * Decides whether to offer the handover, and why.
   *
   * Called after a successful reply, so the card lands under an answer rather
   * than in place of one — the visitor is never blocked, and the assistant
   * never withholds something it could have told them in order to extract
   * contact details. That ordering is the whole ethic of this feature: it is a
   * route onward from the end of what the corpus knows, not a toll gate in
   * front of it.
   *
   * Offered once per conversation. A card that reappears after a decline is an
   * advertisement, and visitors treat the panel accordingly.
   */
  function offerCapture(question: string, answered: boolean) {
    if (captured || capture !== null) return;

    // Counting the reply that just landed, which is not yet in `messages`.
    const replies = messages.filter((message) => message.role === "assistant").length + 1;

    const trigger = BUYING_INTENT.test(question)
      ? "intent"
      : !answered
        ? "unanswered"
        : replies >= DEPTH_TURNS
          ? "depth"
          : null;

    if (trigger === null) return;
    setCapture({
      trigger,
      topic: question,
      cited: [...citedRef.current],
      sessionId: sessionId(),
    });
  }

  /** Remembers that this visitor has been asked, however they answered. */
  function closeCapture() {
    setCapture(null);
    setCaptured(true);
    try {
      sessionStorage.setItem(CAPTURE_KEY, "1");
    } catch {
      // Storage disabled. The in-memory flag still holds for this page.
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter is a new line — the convention every messaging
    // app has trained visitors on.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(input);
    }
  }

  return (
    <>
      {!isOpen && (
        <button
          ref={launcherRef}
          type="button"
          onClick={open}
          aria-label="Open the DocuJet assistant"
          className="fixed bottom-6 right-6 z-50 inline-flex h-14 items-center gap-2.5 rounded-full bg-sky-800 px-4 text-white shadow-[0_20px_45px_-20px_rgba(3,105,161,0.9)] transition hover:bg-sky-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 sm:px-5"
        >
          <ChatIcon className="h-6 w-6" />
          <span className="hidden text-sm font-semibold sm:inline">
            Ask DocuJet
          </span>
        </button>
      )}

      {isOpen && (
        <div
          role="dialog"
          aria-label="DocuJet assistant"
          className="docujet-chat-panel fixed bottom-4 left-4 right-4 z-50 flex h-[min(34rem,calc(100dvh-2rem))] flex-col overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_30px_80px_-30px_rgba(15,23,42,0.55)] sm:bottom-6 sm:left-auto sm:right-6 sm:w-[24rem]"
        >
          <header className="flex items-start justify-between gap-3 bg-slate-950 px-5 py-4 text-white">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-sky-200">
                DocuJet Assistant
              </p>
              <p className="mt-1 text-sm text-slate-300">
                Products, pricing direction, and bookings
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close the assistant"
              className="-mr-1 -mt-1 rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </header>

          <div
            ref={scrollRef}
            role="log"
            aria-live="polite"
            aria-label="Conversation"
            className="flex flex-1 flex-col gap-3 overflow-y-auto bg-stone-50 px-4 py-4"
          >
            <Bubble role="assistant">
              <PlainText text={greeting} />
            </Bubble>

            {messages.map((message) =>
              message.role === "error" ? (
                <p
                  key={message.id}
                  role="alert"
                  className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
                >
                  {message.content}
                </p>
              ) : (
                <Bubble key={message.id} role={message.role}>
                  {message.role === "assistant" ? (
                    <AssistantText text={message.content} />
                  ) : (
                    <PlainText text={message.content} />
                  )}
                </Bubble>
              ),
            )}

            {capture ? (
              <ChatCapture
                topic={capture.topic}
                cited={capture.cited}
                sessionId={capture.sessionId}
                trigger={capture.trigger}
                copy={captureCopy}
                onDone={(reference) => {
                  closeCapture();
                  setMessages((current) => [
                    ...current,
                    {
                      id: newId(),
                      role: "assistant",
                      content:
                        "Thank you — that is with the team" +
                        (reference ? ` under reference **${reference}**` : "") +
                        ". Someone will be in touch. Carry on asking in the meantime.",
                    },
                  ]);
                }}
                onDismiss={closeCapture}
              />
            ) : null}

            {isPending && <TypingIndicator />}

            {messages.length === 0 && (
              <div className="mt-1 flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void send(suggestion)}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-sky-700 hover:text-sky-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
            className="border-t border-slate-200 bg-white p-3"
          >
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={resetSession}
                disabled={messages.length === 0 || isPending}
                aria-label="Start a new conversation"
                title="Start a new conversation"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-500 transition hover:border-sky-700 hover:text-sky-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
              >
                <PlusIcon className="h-5 w-5" />
              </button>
              <label htmlFor="docujet-chat-input" className="sr-only">
                Your question
              </label>
              <textarea
                id="docujet-chat-input"
                ref={inputRef}
                rows={1}
                value={input}
                maxLength={maxMessageChars}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask a question..."
                className="max-h-[120px] w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-700 focus:ring-4 focus:ring-sky-100"
              />
              <button
                type="submit"
                disabled={isPending || input.trim() === ""}
                aria-label="Send message"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-800 text-white transition hover:bg-sky-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <SendIcon className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 px-1 text-[0.7rem] leading-5 text-slate-500">
              Answers are AI-generated. Confirm details before purchase.
            </p>
          </form>
        </div>
      )}
    </>
  );
}

function Bubble({
  role,
  children,
}: {
  role: "user" | "assistant";
  children: React.ReactNode;
}) {
  const isUser = role === "user";

  return (
    <div
      className={
        isUser
          ? "max-w-[85%] self-end rounded-2xl rounded-br-md bg-sky-800 px-4 py-3 text-sm leading-6 text-white"
          // Slightly wider than the visitor's side: this is where the tables and
          // spec lists land, and every millimetre helps them stay readable.
          : "max-w-[92%] self-start rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.6)]"
      }
    >
      {children}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="max-w-[85%] self-start rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3.5 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.6)]">
      <span className="sr-only">The assistant is typing</span>
      <span aria-hidden className="flex gap-1.5">
        <Dot delay="-0.32s" />
        <Dot delay="-0.16s" />
        <Dot delay="0s" />
      </span>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
      style={{ animationDelay: delay }}
    />
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4.5 12h15M13 5.5l6.5 6.5L13 18.5" />
    </svg>
  );
}
