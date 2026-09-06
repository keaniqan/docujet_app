/**
 * Site-wide configuration a superadmin can edit from `/superadmin/settings`.
 *
 * Split three ways, matching the three pages that edit it: `business` is
 * contact content, `chat` is assistant behaviour, and `system` holds deployment
 * credentials. The first two are safe to thread into Client Component props;
 * `system` holds live secrets and must only ever cross into a client render
 * through `toSafeSettingsView()` in `mask.ts`.
 */

import { MANAGED_ENV_KEYS, type ManagedEnvKey } from "./env";

export type BusinessInfo = {
  companyName: string;
  phone: string;
  email: string;
  address: string;
  hours: string;
};

export type ChatConfig = {
  greeting: string;
  /**
   * The assistant's instructions — who it is, what it may say, what it must
   * refuse to invent. Was a constant in `src/lib/chat/prompt.ts`; editable here
   * so changing the assistant's behaviour is not a deploy.
   *
   * Never empty: `store.ts` substitutes `DEFAULT_SYSTEM_PROMPT` for a blank
   * stored value, which is how clearing the field in the settings form means
   * "put the shipped brief back" rather than "give the model no instructions".
   */
  systemPrompt: string;
  /** Add/remove list, not a fixed count. */
  suggestions: string[];
  maxMessageChars: number;
  maxHistoryTurns: number;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  /** Passages retrieved per question. Was `DEFAULT_LIMIT` in `chat/knowledge.ts`. */
  retrievalLimit: number;
  /**
   * Cosine floor, 0..1, below which a passage counts as "not covered" rather
   * than "the closest thing we have". Was `DEFAULT_MIN_SIMILARITY`.
   *
   * Measured against this corpus and this embedding model, not chosen from a
   * textbook — see the note at the old constant in `chat/knowledge.ts`. It
   * means nothing if either changes, which is why the form says so.
   */
  minSimilarity: number;
};

/**
 * Deployment credentials, stored as `system.<ENV_VAR_NAME>` rows so the key in
 * the database is the same string as the key in `.env` and there is nothing to
 * translate between them.
 *
 * An empty value means "not overridden" — `resolveEnv()` in `env.ts` falls
 * through to `process.env`, so a deployment that never opens the settings page
 * behaves exactly as it did before this existed.
 *
 * The Supabase connection is deliberately absent, and is not editable at all:
 * `SiteSettings` is persisted *through* it (see `store.ts`), so a value telling
 * the app where settings live would itself live inside settings.
 * `SUPABASE_URL` / `SUPABASE_SECRET_KEY` / `SUPABASE_PUBLISHABLE_KEY` are
 * environment variables and nothing else, and the System Config page shows them
 * read-only for that reason.
 */
export type SystemConfig = Record<ManagedEnvKey, string>;

export type SiteSettings = {
  business: BusinessInfo;
  chat: ChatConfig;
  system: SystemConfig;
};

export { MANAGED_ENV_KEYS };
export type { ManagedEnvKey };
