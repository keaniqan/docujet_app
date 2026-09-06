"use server";

/**
 * Website content edits, from `/superadmin/settings/cms`.
 *
 * One action per block rather than one for the whole store, for the same reason
 * `src/lib/settings/actions.ts` is split three ways: a form that submits only
 * the FAQ must not read the landing page's absent fields as empty and store
 * them. Each action writes exactly the block it names.
 *
 * Every one refuses a caller who is not an active superadmin. Server Actions
 * are POST endpoints addressable by action id, so `src/proxy.ts` does not cover
 * them and this is the only guard there is.
 *
 * Shape follows the rest of the app: report `{ ok, message }`, never throw.
 */

import { refresh, revalidatePath } from "next/cache";
import { assertSuperadmin } from "@/lib/supabase/authorization";
import { recordAudit } from "@/lib/superadmin";
import { OUTREACH_TEMPLATE_IDS } from "./outreach-ids";
import { resetContentBlock, updateContentBlock } from "./store";
import type {
  ContentBlockKey,
  OutreachTemplates,
  SiteContent,
  TooltipOverrides,
} from "./types";

export type ContentActionResult = {
  ok: boolean;
  message: string;
};

const DENIED = "Only a superadmin can edit website content.";

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Every value submitted under one repeated field name, trimmed. */
function list(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim());
}

/**
 * Parallel repeated fields read back as rows.
 *
 * The CMS editors render a variable number of rows, each with the same field
 * names, so `formData.getAll("faq.question")[2]` and
 * `getAll("faq.answer")[2]` are the same row. A row whose first column is blank
 * is dropped — that is how removing an entry works without a delete endpoint.
 */
function rows<F extends string>(
  formData: FormData,
  prefix: string,
  fields: readonly F[],
): Record<F, string>[] {
  const columns = fields.map((field) => list(formData, `${prefix}.${field}`));
  const height = Math.max(0, ...columns.map((column) => column.length));
  const out: Record<F, string>[] = [];

  for (let index = 0; index < height; index += 1) {
    const row = {} as Record<F, string>;
    fields.forEach((field, column) => {
      row[field] = columns[column][index] ?? "";
    });
    if (row[fields[0]] === "") continue;
    out.push(row);
  }

  return out;
}

async function save<K extends ContentBlockKey>(
  key: K,
  value: SiteContent[K],
  details: Record<string, unknown> = {},
): Promise<ContentActionResult> {
  let actorId: string;
  try {
    actorId = (await assertSuperadmin(DENIED)).id;
  } catch (cause) {
    return { ok: false, message: cause instanceof Error ? cause.message : DENIED };
  }

  try {
    await updateContentBlock(key, value);
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Could not save the content.",
    };
  }

  await recordAudit(actorId, "content.updated", "site_content", key, details);

  refresh();
  // Content feeds the public pages, so every visitor-facing route has to pick
  // the change up, not just this admin session.
  revalidatePath("/", "layout");

  return { ok: true, message: "Content saved." };
}

/** Drops a block's overrides so the copy that ships in `src/` applies again. */
export async function resetContentBlockAction(
  key: ContentBlockKey,
): Promise<ContentActionResult> {
  let actorId: string;
  try {
    actorId = (await assertSuperadmin(DENIED)).id;
  } catch (cause) {
    return { ok: false, message: cause instanceof Error ? cause.message : DENIED };
  }

  try {
    await resetContentBlock(key);
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Could not restore the shipped content.",
    };
  }

  await recordAudit(actorId, "content.reset", "site_content", key);
  refresh();
  revalidatePath("/", "layout");

  return { ok: true, message: "Shipped content restored." };
}

export async function updateSocialAction(formData: FormData): Promise<ContentActionResult> {
  const links = rows(formData, "social", ["label", "url"] as const)
    .filter((row) => row.url !== "")
    .map((row) => ({ label: row.label, url: row.url }));

  return save("social", { links }, { count: links.length });
}

export async function updateLandingAction(formData: FormData): Promise<ContentActionResult> {
  return save("landing", {
    heroEyebrow: str(formData, "heroEyebrow"),
    heroTitle: str(formData, "heroTitle"),
    heroDescription: str(formData, "heroDescription"),
    primaryButtonText: str(formData, "primaryButtonText"),
    primaryButtonUrl: str(formData, "primaryButtonUrl"),
    secondaryButtonText: str(formData, "secondaryButtonText"),
    secondaryButtonUrl: str(formData, "secondaryButtonUrl"),

    benefitsEyebrow: str(formData, "benefitsEyebrow"),
    benefitsHeading: str(formData, "benefitsHeading"),

    servicesHeading: str(formData, "servicesHeading"),
    servicesDescription: str(formData, "servicesDescription"),

    whyChooseEyebrow: str(formData, "whyChooseEyebrow"),
    whyChooseHeading: str(formData, "whyChooseHeading"),
    whyChooseBody: str(formData, "whyChooseBody"),
    whyChooseItems: list(formData, "whyChooseItems").filter((item) => item !== ""),

    ctaTitle: str(formData, "ctaTitle"),
    ctaDescription: str(formData, "ctaDescription"),
    ctaButtonText: str(formData, "ctaButtonText"),
    ctaButtonUrl: str(formData, "ctaButtonUrl"),

    faqEyebrow: str(formData, "faqEyebrow"),
    faqHeading: str(formData, "faqHeading"),
  });
}

export async function updateCatalogAction(formData: FormData): Promise<ContentActionResult> {
  const benefits = rows(formData, "benefit", ["title", "description"] as const);
  const services = rows(formData, "service", [
    "title",
    "description",
    "buttonText",
    "buttonUrl",
  ] as const);
  const faq = rows(formData, "faq", ["question", "answer"] as const);

  return save(
    "catalog",
    {
      benefits: benefits.map((row) => ({ title: row.title, description: row.description })),
      services: services.map((row) => ({
        title: row.title,
        description: row.description,
        buttonText: row.buttonText,
        buttonUrl: row.buttonUrl,
      })),
      faq: faq.map((row) => ({ question: row.question, answer: row.answer })),
      bookingProducts: list(formData, "bookingProducts").filter((item) => item !== ""),
      bookingTypes: list(formData, "bookingTypes").filter((item) => item !== ""),
    },
    { benefits: benefits.length, services: services.length, faq: faq.length },
  );
}

export async function updateBookingEmailAction(
  formData: FormData,
): Promise<ContentActionResult> {
  const subject = str(formData, "subject");
  const html = str(formData, "html");

  if (subject === "") return { ok: false, message: "The email needs a subject." };
  if (html === "") return { ok: false, message: "The email needs a body." };

  return save("bookingEmail", { subject, html });
}

export async function updateChatCaptureAction(
  formData: FormData,
): Promise<ContentActionResult> {
  const card = (trigger: string) => ({
    title: str(formData, `${trigger}.title`),
    body: str(formData, `${trigger}.body`),
    cta: str(formData, `${trigger}.cta`),
  });

  return save("chatCapture", {
    intent: card("intent"),
    unanswered: card("unanswered"),
    depth: card("depth"),
  });
}

export async function updateOutreachAction(formData: FormData): Promise<ContentActionResult> {
  const templates = {} as OutreachTemplates;

  for (const id of OUTREACH_TEMPLATE_IDS) {
    templates[id] = {
      subject: str(formData, `${id}.subject`),
      subjectGeneric: str(formData, `${id}.subjectGeneric`),
      body: str(formData, `${id}.body`),
    };
  }

  return save("outreach", templates, { count: OUTREACH_TEMPLATE_IDS.length });
}

export async function updateTooltipsAction(formData: FormData): Promise<ContentActionResult> {
  const overrides: TooltipOverrides = {};

  for (const row of rows(formData, "tooltip", ["term", "what", "why", "how"] as const)) {
    if (row.what === "") continue;
    overrides[row.term] = {
      what: row.what,
      ...(row.why === "" ? {} : { why: row.why }),
      ...(row.how === "" ? {} : { how: row.how }),
    };
  }

  return save("tooltips", overrides, { count: Object.keys(overrides).length });
}
