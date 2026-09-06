"use server";

/**
 * Settings edits.
 *
 * ---------------------------------------------------------------------------
 * Why three actions and not one
 *
 * There used to be a single `updateSettingsAction` writing every key in
 * `SiteSettings` from one form, which was correct while there was one form. The
 * settings page is now three pages, and a single action would read the fields
 * its caller never submitted as empty strings and store them — saving the chat
 * greeting would blank the company address. Each action writes only its own
 * section.
 * ---------------------------------------------------------------------------
 *
 * Every one of these refuses a caller who is not an active superadmin. Server
 * Actions are POST endpoints addressable by action id, so `src/proxy.ts`'s
 * route matcher does not cover them and this is the only guard there is.
 *
 * Shape follows `src/lib/crm/actions.ts`: read the form, write through the
 * store, refresh, report ok/message rather than throwing.
 */

import { refresh, revalidatePath } from "next/cache";
import { assertSuperadmin } from "@/lib/supabase/authorization";
import { recordAudit } from "@/lib/superadmin";
import { MANAGED_ENV_KEYS, isSecretEnvKey } from "./env";
import { updateSettings } from "./store";

export type SettingsActionResult = {
  ok: boolean;
  message: string;
};

const DENIED = "Only a superadmin can change settings.";

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function num(formData: FormData, key: string, fallback: number): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") return String(fallback);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : String(fallback);
}

/**
 * Runs a write behind the superadmin guard and turns anything that goes wrong
 * into a message the form can render, rather than a 500 that loses the page.
 */
async function save(
  action: string,
  patch: Record<string, string>,
  details: Record<string, unknown> = {},
): Promise<SettingsActionResult> {
  let actorId: string;
  try {
    const actor = await assertSuperadmin(DENIED);
    actorId = actor.id;
  } catch (cause) {
    return { ok: false, message: cause instanceof Error ? cause.message : DENIED };
  }

  try {
    await updateSettings(patch);
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Could not save settings.",
    };
  }

  await recordAudit(actorId, action, "settings", null, details);

  refresh();
  // Business info and chat config feed the public root layout, so every
  // visitor-facing page must pick up the change, not just this admin session.
  revalidatePath("/", "layout");

  return { ok: true, message: "Settings saved." };
}

/** Contact details. Edited from the Content Management page; read by the footer and the assistant's brief. */
export async function updateBusinessAction(
  formData: FormData,
): Promise<SettingsActionResult> {
  return save("settings.business.updated", {
    "business.companyName": str(formData, "companyName"),
    "business.phone": str(formData, "phone"),
    "business.email": str(formData, "email"),
    "business.address": str(formData, "address"),
    "business.hours": str(formData, "hours"),
  });
}

/** Everything the assistant behaves by, short of the knowledge base. */
export async function updateChatConfigAction(
  formData: FormData,
): Promise<SettingsActionResult> {
  const suggestions = formData
    .getAll("suggestions")
    .filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "");

  return save("settings.chat.updated", {
    "chat.greeting": str(formData, "greeting"),
    // Stored empty when the admin clears it, which the store reads back as the
    // default brief — see mergeEntries() in store.ts.
    "chat.systemPrompt": str(formData, "systemPrompt"),
    "chat.suggestions": suggestions.join("\n"),
    "chat.maxMessageChars": num(formData, "maxMessageChars", 1000),
    "chat.maxHistoryTurns": num(formData, "maxHistoryTurns", 8),
    "chat.rateLimitWindowMs": num(formData, "rateLimitWindowMs", 60_000),
    "chat.rateLimitMaxRequests": num(formData, "rateLimitMaxRequests", 15),
    "chat.retrievalLimit": num(formData, "retrievalLimit", 6),
    "chat.minSimilarity": num(formData, "minSimilarity", 0.8),
    // The model is chatbot behaviour even though its key is a credential, so it
    // is edited here and stored in the system namespace with the rest.
    "system.DEEPSEEK_MODEL": str(formData, "DEEPSEEK_MODEL"),
  });
}

/**
 * Deployment credentials.
 *
 * Secret fields are only included in the patch when the submitted value is
 * non-empty. The form always renders them empty — never pre-filled with the
 * real secret — so a non-empty submission means the superadmin deliberately
 * retyped it. Enforced here, not just by the UI, so a stale or replayed form
 * can't accidentally blank out a live credential.
 *
 * `DEEPSEEK_MODEL` is deliberately not written here; the Chatbot Config form
 * owns it, and writing it from both would make whichever page was saved last
 * the winner.
 */
export async function updateSystemConfigAction(
  formData: FormData,
): Promise<SettingsActionResult> {
  const patch: Record<string, string> = {};
  const changed: string[] = [];

  for (const key of MANAGED_ENV_KEYS) {
    if (key === "DEEPSEEK_MODEL") continue;

    const submitted = str(formData, key);
    if (isSecretEnvKey(key)) {
      if (submitted === "") continue;
    }
    patch[`system.${key}`] = submitted;
    changed.push(key);
  }

  // Key names only. A value here would put a live credential in a table the
  // whole superadmin group can read.
  return save("settings.system.updated", patch, { keys: changed });
}
