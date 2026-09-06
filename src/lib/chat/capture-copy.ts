/**
 * What the chat handover card says, as it ships.
 *
 * Its own module, rather than a constant inside `ChatCapture.tsx` or inside
 * `content/defaults.ts`, because both need it and neither can import the other:
 * the card is a Client Component and `content/defaults.ts` pulls in the whole
 * site catalogue and every CRM follow-up draft. Three small strings in a file
 * of their own keep the browser bundle small and the copy singular.
 *
 * ---------------------------------------------------------------------------
 * Why the copy changes with the trigger
 *
 * A card that says the same thing in every situation reads as an interruption.
 * These three moments are genuinely different conversations:
 *
 *   `intent`      They asked about price, leasing or a demo — things the
 *                 assistant is instructed never to answer, because a person
 *                 quotes them.
 *   `unanswered`  The corpus had nothing, and this is the recovery.
 *   `depth`       Several questions in. Easy to ignore, offered once a session.
 * ---------------------------------------------------------------------------
 */

import type { ChatCaptureTemplates } from "@/lib/content/types";

export const DEFAULT_CAPTURE_COPY: ChatCaptureTemplates = {
  intent: {
    title: "Want a figure on that?",
    body: "Pricing is quoted by a person once we know your volumes — leave your details and someone will come back with real numbers, usually the same working day.",
    cta: "Get a quote",
  },
  unanswered: {
    title: "Let me get you a proper answer",
    body: "That one is outside what I have on file. Leave your details and someone who knows will reply — and your question goes to the team either way.",
    cta: "Ask a human",
  },
  depth: {
    title: "Would it help to talk to someone?",
    body: "You have asked some specific questions. If it is useful, someone can go through your setup properly rather than leaving you to piece it together here.",
    cta: "Have someone call",
  },
};
