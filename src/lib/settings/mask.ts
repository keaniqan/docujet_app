/**
 * Keeps secrets out of client-rendered HTML/JSON.
 *
 * `toSafeSettingsView()` is the only shape the settings pages' server
 * components hand to their client forms — a stored secret's real value never
 * reaches the browser after it's first saved.
 */

import { MANAGED_ENV_KEYS, isSecretEnvKey, type ManagedEnvKey } from "./env";
import type { SiteSettings } from "./types";

export type MaskedSecret = { isSet: boolean; masked: string };

/**
 * One managed credential as the browser is allowed to see it.
 *
 * A secret arrives as `MaskedSecret` and a non-secret as its plain value, so a
 * form can render the project ID it needs to show while the token beside it
 * stays a placeholder.
 */
export type SafeSystemValue =
  | { secret: true; value: MaskedSecret }
  | { secret: false; value: string };

export type SafeSystemConfig = Record<ManagedEnvKey, SafeSystemValue>;

export type SafeSiteSettings = {
  business: SiteSettings["business"];
  chat: SiteSettings["chat"];
  system: SafeSystemConfig;
};

export function maskSecret(value: string): MaskedSecret {
  if (value === "") return { isSet: false, masked: "" };
  const tail = value.slice(-4);
  return { isSet: true, masked: value.length <= 4 ? "•".repeat(value.length) : `••••••${tail}` };
}

export function toSafeSystemConfig(system: SiteSettings["system"]): SafeSystemConfig {
  return Object.fromEntries(
    MANAGED_ENV_KEYS.map((key) => [
      key,
      isSecretEnvKey(key)
        ? { secret: true, value: maskSecret(system[key] ?? "") }
        : { secret: false, value: system[key] ?? "" },
    ]),
  ) as SafeSystemConfig;
}

export function toSafeSettingsView(settings: SiteSettings): SafeSiteSettings {
  return {
    business: settings.business,
    chat: settings.chat,
    system: toSafeSystemConfig(settings.system),
  };
}
