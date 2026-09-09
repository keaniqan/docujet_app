/**
 * Deployment credentials that the database is allowed to override.
 *
 * ---------------------------------------------------------------------------
 * Why a database value can beat an environment variable
 *
 * Every one of these used to be readable only from `process.env`, which made
 * "the WhatsApp template changed" or "rotate the mail key" a redeploy performed
 * by whoever holds the hosting account — not by the person who noticed. The
 * keys below are all *outbound* credentials: the worst a wrong one does is stop
 * that one integration, visibly, on the next attempt.
 *
 * The Supabase connection is not on this list and cannot be, for the reason
 * documented on `SystemConfig` in `types.ts`: these values are read *through*
 * the database, so a database URL stored in the database is a value that can
 * only be found once it has already been found.
 * ---------------------------------------------------------------------------
 *
 * The stored key is `system.` + the environment variable's own name, so there
 * is no mapping table to keep honest and a row is readable by anyone who knows
 * the `.env`.
 */

export const MANAGED_ENV_KEYS = [
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_MODEL",
  "BREVO_API_KEY",
  "BREVO_SENDER_EMAIL",
  "BREVO_SENDER_NAME",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_TEMPLATE_NAME",
  "WHATSAPP_TEMPLATE_LANGUAGE",
  "PLASMIC_PROJECT_ID",
  "PLASMIC_API_TOKEN",
] as const;

export type ManagedEnvKey = (typeof MANAGED_ENV_KEYS)[number];

/** Values that must never round-trip to a client render in plaintext. */
export const SECRET_ENV_KEYS = [
  "DEEPSEEK_API_KEY",
  "BREVO_API_KEY",
  "WHATSAPP_ACCESS_TOKEN",
  "PLASMIC_API_TOKEN",
] as const satisfies readonly ManagedEnvKey[];

export type SecretEnvKey = (typeof SECRET_ENV_KEYS)[number];

export function isSecretEnvKey(key: string): key is SecretEnvKey {
  return (SECRET_ENV_KEYS as readonly string[]).includes(key);
}

export function isManagedEnvKey(key: string): key is ManagedEnvKey {
  return (MANAGED_ENV_KEYS as readonly string[]).includes(key);
}

/** Where a resolved value came from. Drives the badge on the System Config page. */
export type EnvSource = "database" | "environment" | "unset";

/**
 * The Supabase connection, which is environment-only and shown read-only.
 *
 * Listed here rather than in `MANAGED_ENV_KEYS` precisely because it is not
 * manageable — the System Config page still has to render it, and the honest
 * way to do that is from one list rather than three literals in a component.
 */
export const CONNECTION_ENV_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
] as const;

export type ConnectionEnvKey = (typeof CONNECTION_ENV_KEYS)[number];
