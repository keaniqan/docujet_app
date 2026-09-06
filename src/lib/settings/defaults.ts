/**
 * The settings store's fallback — and, until the database is connected,
 * its only source of truth. Seeded from today's real hardcoded values so
 * turning this feature on changes nothing about what visitors see.
 *
 * `business` is sourced from `site-data.ts`'s `footerPlaceholders` rather than
 * re-typed here, so there is exactly one place the real Epson contact details
 * live. `chat.systemPrompt` comes from `chat/prompt.ts` for the same reason.
 */

import { DEFAULT_SYSTEM_PROMPT } from "@/lib/chat/prompt";
import { footerPlaceholders } from "@/lib/site-data";
import { MANAGED_ENV_KEYS } from "./env";
import type { SiteSettings, SystemConfig } from "./types";

/**
 * Every managed credential, unset.
 *
 * Built from the key list rather than written out, so adding a key to
 * `MANAGED_ENV_KEYS` is the whole change. Empty means "not overridden" —
 * `resolveEnv()` falls through to `process.env`, exactly as the code did before
 * any of this was editable.
 */
const NO_OVERRIDES: SystemConfig = Object.fromEntries(
  MANAGED_ENV_KEYS.map((key) => [key, ""]),
) as SystemConfig;

export const DEFAULT_SETTINGS: SiteSettings = {
  business: {
    companyName: "DocuJet",
    phone: footerPlaceholders.phone,
    email: footerPlaceholders.email,
    address: footerPlaceholders.office,
    hours: footerPlaceholders.hours,
  },
  chat: {
    greeting:
      "Hi! I'm the DocuJet assistant. Ask me about the WorkForce Enterprise range, pricing direction, or booking a consultation.",
    // Sourced from prompt.ts rather than re-typed, for the same reason
    // `business` comes from site-data.ts: the shipped brief and the text the
    // settings form restores must be the same string, or "Restore default"
    // starts quietly meaning something else.
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    suggestions: [
      "What resolution and geometry do the Epson MicroTFP print chips have?",
      "What is Heat-Free Technology?",
      "How fast do the Epson WorkForce Enterprise printers print on A4?",
    ],
    maxMessageChars: 1000,
    maxHistoryTurns: 8,
    rateLimitWindowMs: 60_000,
    rateLimitMaxRequests: 15,
    // Both were constants in chat/knowledge.ts. 0.8 is a measured floor for
    // this corpus and this embedding model, not a textbook value — see the
    // note carried into the Chatbot Config form.
    retrievalLimit: 6,
    minSimilarity: 0.8,
  },
  system: NO_OVERRIDES,
};
