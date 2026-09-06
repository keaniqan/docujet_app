/**
 * Reads a managed credential's effective value.
 *
 * Separate from `env.ts` — which holds only the key lists — because this half
 * needs the settings store, and the store's defaults need the key lists. One
 * module for both would be an import cycle.
 *
 * Server-side only. Every function here can return a live secret.
 */

import {
  CONNECTION_ENV_KEYS,
  MANAGED_ENV_KEYS,
  type ConnectionEnvKey,
  type EnvSource,
  type ManagedEnvKey,
} from "./env";
import { getSettingsSafe } from "./store";

function fromEnv(key: string): string {
  return process.env[key]?.trim() ?? "";
}

function pick(stored: string | undefined, key: ManagedEnvKey): string {
  const override = stored?.trim() ?? "";
  return override !== "" ? override : fromEnv(key);
}

/**
 * One key's effective value, from settings already in hand.
 *
 * For callers that read `SiteSettings` for other reasons anyway — `askAssistant`
 * needs the business block and the brief — so that resolving a credential does
 * not become a second query for a row they are already holding.
 */
export function resolveManagedEnv(
  settings: { system: Partial<Record<ManagedEnvKey, string>> },
  key: ManagedEnvKey,
): string {
  return pick(settings.system[key], key);
}

/**
 * One key's effective value: the stored override if there is one, else the
 * environment, else `""`.
 *
 * Backed by `getSettingsSafe()`, so an unreachable or unconfigured database
 * degrades to exactly the pre-existing `process.env` behaviour rather than
 * taking the integration down with it.
 */
export async function resolveEnv(key: ManagedEnvKey): Promise<string> {
  const settings = await getSettingsSafe();
  return pick(settings.system[key], key);
}

/**
 * Several keys at once, from a single settings read.
 *
 * Every caller that needs more than one credential should use this —
 * `sendBookingWhatsApp` wants four, and four `resolveEnv` calls would be four
 * reads of the same table.
 */
export async function resolveEnvMany<K extends ManagedEnvKey>(
  keys: readonly K[],
): Promise<Record<K, string>> {
  const settings = await getSettingsSafe();
  const out = {} as Record<K, string>;
  for (const key of keys) out[key] = pick(settings.system[key], key);
  return out;
}

/**
 * Refuses when a resolved credential is blank.
 *
 * Replaces the `requiredEnv()` helper that `email.ts` and `whatsapp.ts` each
 * carried a copy of, and keeps its failure shape: one Error naming the missing
 * variable, thrown before any network call. Takes an already-resolved record
 * rather than doing its own read, so a caller that also wants an optional key
 * (`BREVO_SENDER_NAME`) still reads settings exactly once.
 */
export function demandEnv<K extends ManagedEnvKey>(
  resolved: Record<K, string>,
  required: readonly K[],
): void {
  for (const key of required) {
    if (resolved[key] === "") {
      throw new Error(
        `Missing ${key}. Set it in /superadmin/settings/system or in the server environment.`,
      );
    }
  }
}

/** Every managed key's value and provenance, for the System Config page. */
export async function resolveEnvReport(): Promise<
  Record<ManagedEnvKey, { value: string; source: EnvSource }>
> {
  const settings = await getSettingsSafe();
  const out = {} as Record<ManagedEnvKey, { value: string; source: EnvSource }>;

  for (const key of MANAGED_ENV_KEYS) {
    const stored = settings.system[key]?.trim() ?? "";
    if (stored !== "") {
      out[key] = { value: stored, source: "database" };
      continue;
    }
    const env = fromEnv(key);
    out[key] = { value: env, source: env === "" ? "unset" : "environment" };
  }

  return out;
}

/** The connection variables, read straight from the environment. */
export function connectionEnvReport(): Record<ConnectionEnvKey, string> {
  const out = {} as Record<ConnectionEnvKey, string>;
  for (const key of CONNECTION_ENV_KEYS) out[key] = fromEnv(key);
  return out;
}
