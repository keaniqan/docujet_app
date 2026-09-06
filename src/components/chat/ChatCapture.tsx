"use client";

import { useState } from "react";
import { DEFAULT_CAPTURE_COPY } from "@/lib/chat/capture-copy";
import type { ChatCaptureTemplates } from "@/lib/content/types";

export type ChatCaptureProps = {
  /** The question that triggered the offer. Becomes the lead's interest. */
  topic: string;
  /** Knowledge-base ids accumulated across the conversation. */
  cited: string[];
  sessionId: string;
  /** Why the card appeared, which decides what it says. */
  trigger: "intent" | "unanswered" | "depth";
  /**
   * The three cards, as the Content Management page has them.
   *
   * Optional so a bare render still says something sensible; supplied from the
   * server through ChatWidget on every real page.
   */
  copy?: ChatCaptureTemplates;
  onDone: (reference: string) => void;
  onDismiss: () => void;
};

/**
 * The handover.
 *
 * ---------------------------------------------------------------------------
 * Why the copy changes with the trigger
 *
 * A card that says the same thing in every situation reads as an interruption.
 * These three moments are genuinely different conversations:
 *
 *   `intent`      They asked about price, leasing or a demo — things the
 *                 assistant is instructed never to answer, because a person
 *                 quotes them. Offering the person is not an interception, it
 *                 is the only route to what they just asked for.
 *   `unanswered`  The corpus had nothing. Without this the visitor gets a
 *                 polite "I do not know" and leaves; this is the recovery, and
 *                 the resulting lead carries an empty `cited` list, which marks
 *                 it in the CRM as both high-intent and a content gap.
 *   `depth`       Several questions in. Not urgent, easy to ignore, and offered
 *                 once per session.
 * ---------------------------------------------------------------------------
 *
 * Name and email only. Every additional field costs completions, and the two
 * required are the two `capture_chat_lead` needs to identify a person and a rep
 * needs to reach them. Phone and company are offered and optional.
 */
export default function ChatCapture({
  topic,
  cited,
  sessionId,
  trigger,
  copy = DEFAULT_CAPTURE_COPY,
  onDone,
  onDismiss,
}: ChatCaptureProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const card = copy[trigger];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (isSending) return;

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch("/api/chat/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, company, topic, cited, sessionId }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        reference?: string;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        setError(data.error ?? "We could not save that. Please try the booking form instead.");
        return;
      }

      onDone(data.reference ?? "");
    } catch {
      setError("We could not reach us just then. Check your connection and try again.");
    } finally {
      setIsSending(false);
    }
  }

  const field =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-800 focus:ring-4 focus:ring-sky-100 disabled:opacity-50";

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-sky-200 bg-sky-50 p-4"
      aria-label="Leave your contact details"
    >
      <p className="text-sm font-semibold text-slate-950">{card.title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{card.body}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input
          className={field}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          aria-label="Your name"
          autoComplete="name"
          required
          disabled={isSending}
        />
        <input
          className={field}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Work email"
          aria-label="Work email"
          autoComplete="email"
          required
          disabled={isSending}
        />
        <input
          className={field}
          value={company}
          onChange={(event) => setCompany(event.target.value)}
          placeholder="Company (optional)"
          aria-label="Company"
          autoComplete="organization"
          disabled={isSending}
        />
        <input
          className={field}
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="Phone (optional)"
          aria-label="Phone"
          autoComplete="tel"
          disabled={isSending}
        />
      </div>

      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={isSending}
          className="rounded-full bg-sky-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-900 disabled:opacity-40"
        >
          {isSending ? "Sending…" : card.cta}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={isSending}
          className="rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white disabled:opacity-40"
        >
          No thanks, keep chatting
        </button>
      </div>
    </form>
  );
}
