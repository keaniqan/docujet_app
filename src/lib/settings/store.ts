/**
 * Persistence for site settings.
 *
 * One table, `app_settings`, holding dot-path key/value rows — the same shape
 * the Google Sheet's Settings tab used, so `mergeEntries` below is unchanged
 * from the sheet era. See
 * `supabase/migrations/0001_crm_leads_and_settings.sql`.
 *
 * Modeled on `src/lib/crm/leads.ts` and sharing its client, its
 * configured-or-degrade rule, and its reasoning about the `server-only` marker.
 */

import { isSupabaseConfigured, supabase } from "../supabase/service";
import { DEFAULT_SETTINGS } from "./defaults";
import { MANAGED_ENV_KEYS } from "./env";
import type { SiteSettings, SystemConfig } from "./types";

const TABLE = "app_settings";

/**
 * True when a Supabase project is configured.
 *
 * Kept as a named re-export rather than having callers import the Supabase
 * module directly: the settings page asks "can settings be saved?", and that
 * question should keep its own name if the answer ever stops being "is the
 * database configured?".
 */
export { isSupabaseConfigured as isSettingsConfigured };

// ---------------------------------------------------------------------------
// Merging — the stored key/value rows onto SiteSettings
//
// Suggestions are a list, but a stored value is one string, so they are joined
// with newlines (not commas — a suggestion's own text may contain one). The
// server action (`actions.ts`) writes rows in this same shape directly from its
// FormData, so there is no reverse (SiteSettings -> entries) direction to
// maintain here.
// ---------------------------------------------------------------------------

function numberOr(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Merges stored rows onto `DEFAULT_SETTINGS`. Unknown or missing keys silently keep the default. */
function mergeEntries(rows: [string, string][]): SiteSettings {
  const found = new Map(rows);
  const get = (key: string): string | undefined => found.get(key);
  const base = DEFAULT_SETTINGS;

  return {
    business: {
      companyName: get("business.companyName") ?? base.business.companyName,
      phone: get("business.phone") ?? base.business.phone,
      email: get("business.email") ?? base.business.email,
      address: get("business.address") ?? base.business.address,
      hours: get("business.hours") ?? base.business.hours,
    },
    chat: {
      greeting: get("chat.greeting") ?? base.chat.greeting,
      // `||` on the trimmed value, not `??` like its neighbours: for every
      // other field an empty string is a legitimate saved value, but an empty
      // system prompt would hand the model no instructions at all — no
      // grounding rule, no refusal to invent prices. Clearing the field in the
      // settings form therefore means "restore the shipped brief".
      systemPrompt: get("chat.systemPrompt")?.trim() || base.chat.systemPrompt,
      suggestions: get("chat.suggestions")?.split("\n").filter((line) => line.trim() !== "") ??
        base.chat.suggestions,
      maxMessageChars: numberOr(get("chat.maxMessageChars"), base.chat.maxMessageChars),
      maxHistoryTurns: numberOr(get("chat.maxHistoryTurns"), base.chat.maxHistoryTurns),
      rateLimitWindowMs: numberOr(get("chat.rateLimitWindowMs"), base.chat.rateLimitWindowMs),
      rateLimitMaxRequests: numberOr(get("chat.rateLimitMaxRequests"), base.chat.rateLimitMaxRequests),
      retrievalLimit: numberOr(get("chat.retrievalLimit"), base.chat.retrievalLimit),
      minSimilarity: numberOr(get("chat.minSimilarity"), base.chat.minSimilarity),
    },
    // Iterated rather than listed: the stored key is `system.` + the
    // environment variable's own name, so there is nothing per-key to write
    // down and adding a credential is a one-line change to MANAGED_ENV_KEYS.
    system: Object.fromEntries(
      MANAGED_ENV_KEYS.map((key) => [key, get(`system.${key}`) ?? base.system[key]]),
    ) as SystemConfig,
  };
}

// ---------------------------------------------------------------------------
// Reading & writing
// ---------------------------------------------------------------------------

/**
 * Reads site settings.
 *
 * Returns `DEFAULT_SETTINGS` directly, with no network call, when Supabase is
 * not configured — this is what makes the settings page (and everything
 * reading it) fully testable with zero backend setup. Configured-but-
 * unreachable (wrong key, migration not applied, network failure, ...) still
 * throws — `getSettingsSafe()` below is for callers that must not.
 */
export async function getSettings(): Promise<SiteSettings> {
  if (!isSupabaseConfigured()) {
    return DEFAULT_SETTINGS;
  }

  const { data, error } = await supabase().from(TABLE).select("key,value");
  if (error) {
    throw new Error(`Could not read settings: ${error.message}`);
  }

  const rows = (data as { key: string; value: string }[]).map(
    (row) => [row.key, row.value] as [string, string],
  );
  return mergeEntries(rows);
}

/**
 * `getSettings()`, but falls back to `DEFAULT_SETTINGS` on any failure instead
 * of throwing.
 *
 * For every caller where site-wide availability must never depend on the
 * settings table being reachable — the root layout, the public-page composition
 * root, the chat API route. A real problem still needs to be visible somewhere,
 * so it's logged rather than swallowed silently; the admin Settings page uses
 * `getSettings()` directly instead of this, so an admin sees the actual error
 * rather than a quiet fallback.
 */
export async function getSettingsSafe(): Promise<SiteSettings> {
  try {
    return await getSettings();
  } catch (cause) {
    console.warn(
      "[settings] could not read settings, using defaults:",
      cause instanceof Error ? cause.message : cause,
    );
    return DEFAULT_SETTINGS;
  }
}

/**
 * Writes a sparse set of changed settings.
 *
 * Takes dot-path keys (e.g. `"business.phone"`), not a full `SiteSettings` —
 * this is what lets the server action omit a secret field the admin left blank
 * rather than overwriting it with an empty string. Values are always strings;
 * array/number fields are pre-serialized by the caller (newline-joined lists,
 * numbers as decimal text — the same conventions `mergeEntries` reads back).
 */
export async function updateSettings(patch: Record<string, string>): Promise<void> {
  const rows = Object.entries(patch).map(([key, value]) => ({ key, value }));
  if (rows.length === 0) return;

  const { error } = await supabase().from(TABLE).upsert(rows, { onConflict: "key" });
  if (error) {
    throw new Error(`Could not save settings: ${error.message}`);
  }
}
