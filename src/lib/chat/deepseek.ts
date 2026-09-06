/**
 * The assistant's only link to the outside world.
 *
 * The answer used to be produced by an n8n workflow — the browser talked to
 * /api/chat, that route POSTed to a webhook, and everything interesting
 * (retrieval, prompt, model) happened in a canvas somewhere else. It all lives
 * in this app now: `src/lib/chat/knowledge.ts` retrieves, `src/lib/chat/prompt.ts`
 * writes the brief, and this module makes the one remaining network call.
 *
 * DeepSeek's API is OpenAI-shaped, so this is a fetch and not an SDK. One
 * endpoint, one request shape, no streaming, no tools: a dependency would carry
 * far more surface than the forty lines it would save.
 *
 * Server-side only. `DEEPSEEK_API_KEY` must never reach a "use client" module,
 * and the route that calls this is the only caller.
 */

import { resolveManagedEnv } from "../settings/resolve";
import { getSettingsSafe } from "../settings/store";
import { retrieveContext } from "./knowledge";
import { buildMessages, type ChatTurn } from "./prompt";

const API_URL = "https://api.deepseek.com/chat/completions";

/**
 * `deepseek-v4-flash` unless told otherwise: the small, fast model in the
 * current line. The assistant reads six short passages and writes three
 * sentences, which is not work that needs the larger model — but the swap is an
 * env var, so trying `deepseek-v4-pro` costs a restart and no code change.
 */
const DEFAULT_MODEL = "deepseek-v4-flash";

/**
 * A visitor waits with a typing indicator in front of them, so this is far
 * shorter than the 45s the n8n hop needed. A grounded answer that has not
 * started arriving in half a minute is not coming.
 */
const REQUEST_TIMEOUT_MS = 30_000;

/** Longest question accepted. Ultimate fallback for the admin-configurable `chat.maxMessageChars`. */
export const MAX_MESSAGE_CHARS = 1000;

/**
 * Ceiling on the reply, in tokens.
 *
 * The brief asks for two or three sentences; this is the backstop for when it
 * is ignored, sized to a long-but-plausible answer with a small spec table in
 * it rather than to the model's real limit. A runaway answer would overflow the
 * panel and cost real money.
 */
const MAX_OUTPUT_TOKENS = 700;

export type AskOptions = {
  message: string;
  /** Stable per-visitor id. Threaded to DeepSeek as `user_id` so its own abuse controls can see one visitor. */
  sessionId: string;
  /** Path the visitor asked from. Lets the assistant answer "this page" questions. */
  page?: string;
  /** Recent turns, oldest first, already trimmed and capped by the route. */
  history?: ChatTurn[];
};

export type { ChatTurn };

/**
 * A failure the visitor is allowed to read.
 *
 * Anything thrown from here reaches the chat panel verbatim, so the messages are
 * written for a customer, not for a log file. Everything a developer needs —
 * status codes, response bodies, which key is missing — is logged separately and
 * never returned; a visitor should not learn from a chat bubble that the account
 * is out of credit.
 */
export class ChatError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "ChatError";
    this.status = status;
  }
}

const UNAVAILABLE =
  "The assistant is unavailable right now. Please try again in a moment, or " +
  "book an appointment and we will follow up directly.";

/**
 * The assistant's credential.
 *
 * Takes the already-resolved value rather than reading it: `askAssistant` needs
 * settings anyway for the business block and the brief, and a second read here
 * would be a second query for a row it is already holding.
 */
function requireApiKey(key: string): string {
  if (!key) {
    // Deployment mistake, not an outage. It is the one failure here that never
    // fixes itself, so it is logged as an error rather than a warning.
    console.error(
      "[chat] DEEPSEEK_API_KEY is not set. The assistant cannot answer anything until it is. " +
        "Set it in /superadmin/settings/system, or in the server environment.",
    );
    throw new ChatError(UNAVAILABLE, 503);
  }

  return key;
}

/** DeepSeek's response, as much of it as this app reads. */
type CompletionResponse = {
  choices?: {
    message?: { content?: string | null };
    finish_reason?: string;
  }[];
};

/**
 * What answering a question produced, beyond the answer.
 *
 * The retrieval result used to be discarded the moment the reply came back,
 * which threw away the two facts that make the assistant a sales channel rather
 * than a cost centre: which knowledge-base entries served the visitor (so a
 * captured lead can carry them, in the `cited` column that has existed since
 * 0001 and been written by nothing), and whether anything cleared the
 * similarity floor at all — because a question the corpus could not answer is a
 * buyer who left unserved, and a theme of them is a content gap that is costing
 * sales.
 */
export type AssistantAnswer = {
  reply: string;
  /** Knowledge-base document ids that fed the answer. Empty means none did. */
  cited: string[];
  /** The best match found, or null when retrieval returned nothing. */
  topSimilarity: number | null;
};

/**
 * Answers one question.
 *
 * Retrieval first, then the model. Retrieval is deliberately not allowed to
 * fail the request — `retrieveContext()` returns an empty list on any problem,
 * and an empty list tells the prompt to admit it does not know rather than to
 * improvise. So a knowledge base that is down produces a useless-but-honest
 * assistant, and only DeepSeek being unreachable produces an error bubble.
 */
export async function askAssistant({
  message,
  sessionId,
  page,
  history = [],
}: AskOptions): Promise<AssistantAnswer> {
  // Read first rather than alongside the search: retrieval's reach and floor
  // are admin-editable now, so the search cannot start until settings are in.
  // This is the cheap query of the two, and the model call dwarfs both.
  const settings = await getSettingsSafe();
  const key = requireApiKey(resolveManagedEnv(settings, "DEEPSEEK_API_KEY"));

  const context = await retrieveContext(message, {
    limit: settings.chat.retrievalLimit,
    minSimilarity: settings.chat.minSimilarity,
  });

  const messages = buildMessages({
    question: message,
    history,
    context,
    business: settings.business,
    brief: settings.chat.systemPrompt,
    page,
  });

  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: resolveManagedEnv(settings, "DEEPSEEK_MODEL") || DEFAULT_MODEL,
        messages,
        // Thinking is on by default at `high` effort, which is both slower than
        // a visitor will sit through and wasted on "which model prints faster".
        // Turning it off also un-ignores `temperature`: the sampling parameters
        // have no effect while the model is thinking.
        thinking: { type: "disabled" },
        // Low, not zero. The answers are meant to track the retrieved passages
        // closely; what little freedom is left is for phrasing.
        temperature: 0.2,
        max_tokens: MAX_OUTPUT_TOKENS,
        user_id: sessionId,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    if (cause instanceof Error && cause.name === "TimeoutError") {
      throw new ChatError(
        "That took longer than expected. Please try again, or book an appointment and we will " +
          "follow up directly.",
        504,
      );
    }
    throw new ChatError("The assistant is unreachable right now. Please try again in a moment.");
  }

  if (!response.ok) {
    throw await failureFor(response);
  }

  let payload: CompletionResponse;
  try {
    payload = (await response.json()) as CompletionResponse;
  } catch {
    console.warn("[chat] DeepSeek returned a body that is not JSON");
    throw new ChatError(UNAVAILABLE);
  }

  const choice = payload.choices?.[0];
  const reply = choice?.message?.content?.trim();

  if (!reply) {
    // `length` here means the ceiling above cut the answer off before any text
    // survived — worth naming, because the fix is a bigger max_tokens rather
    // than a retry.
    console.warn(
      `[chat] DeepSeek returned no text (finish_reason: ${choice?.finish_reason ?? "unknown"})`,
    );
    throw new ChatError(
      "The assistant could not put an answer together. Please rephrase your question, or " +
        "contact us directly.",
    );
  }

  return {
    reply,
    cited: context.map((chunk) => chunk.documentId),
    topSimilarity: context.length > 0 ? Math.max(...context.map((c) => c.similarity)) : null,
  };
}

/**
 * Turns a non-2xx response into something a visitor can read.
 *
 * The distinctions that matter are the ones a developer must act on, so each
 * one is logged with its body; the visitor only ever learns whether waiting is
 * likely to help. DeepSeek's codes: 401 wrong key, 402 out of balance, 400/422
 * a malformed request (this app's bug), 429 too fast, 500/503 their side.
 */
async function failureFor(response: Response): Promise<ChatError> {
  const body = (await response.text().catch(() => "")).slice(0, 300);

  switch (response.status) {
    case 401:
      console.error(`[chat] DeepSeek rejected the API key (401): ${body}`);
      return new ChatError(UNAVAILABLE, 503);

    case 402:
      console.error(
        `[chat] the DeepSeek account is out of balance (402): ${body}. The assistant is ` +
          "down until it is topped up.",
      );
      return new ChatError(UNAVAILABLE, 503);

    case 400:
    case 422:
      // Our request, not their platform: a parameter this app sent is wrong,
      // and every visitor is hitting it.
      console.error(`[chat] DeepSeek rejected the request (${response.status}): ${body}`);
      return new ChatError(UNAVAILABLE);

    case 429:
      console.warn(`[chat] DeepSeek rate-limited this app (429): ${body}`);
      return new ChatError(
        "The assistant is busy at the moment. Please try again in a few seconds.",
        429,
      );

    default:
      console.warn(`[chat] DeepSeek responded ${response.status}: ${body}`);
      return new ChatError("The assistant could not answer that just now. Please try again shortly.");
  }
}
