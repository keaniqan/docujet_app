/**
 * Website copy a superadmin can edit from `/superadmin/settings/cms`.
 *
 * ---------------------------------------------------------------------------
 * Why this is a second store and not more `app_settings` rows
 *
 * `app_settings` holds one text value per key, with lists newline-joined. That
 * is the right shape for `business.phone` and the wrong shape for the FAQ:
 * seven question/answer pairs are not a string with newlines in it, and the
 * first answer containing a newline makes the encoding stop being reversible.
 *
 * So the split is by shape, not by subject. Scalars stay in `app_settings`;
 * anything with structure gets a jsonb document in `site_content`, one row per
 * block. Both are read the same way — merged over the defaults that ship in
 * `src/`, unknown keys ignored — so nothing here is load-bearing for the site
 * to render.
 * ---------------------------------------------------------------------------
 *
 * Every block is safe to hand to a Client Component. Nothing here is secret.
 */

import type { FaqItem, ServiceItem } from "@/lib/site-data";

export type SocialLink = {
  label: string;
  url: string;
};

/** Contact channels beyond the four scalars in `business.*`. */
export type SocialContent = {
  links: SocialLink[];
};

/** The marketing pages' headings and body copy. */
export type LandingContent = {
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
  primaryButtonText: string;
  primaryButtonUrl: string;
  secondaryButtonText: string;
  secondaryButtonUrl: string;

  benefitsEyebrow: string;
  benefitsHeading: string;

  servicesHeading: string;
  servicesDescription: string;

  whyChooseEyebrow: string;
  whyChooseHeading: string;
  whyChooseBody: string;
  whyChooseItems: string[];

  ctaTitle: string;
  ctaDescription: string;
  ctaButtonText: string;
  ctaButtonUrl: string;

  faqEyebrow: string;
  faqHeading: string;
};

export type BenefitItem = {
  title: string;
  description: string;
};

/** The lists the public pages iterate: what we sell and what people ask about it. */
export type CatalogContent = {
  benefits: BenefitItem[];
  services: ServiceItem[];
  faq: FaqItem[];
  bookingProducts: string[];
  bookingTypes: string[];
};

/**
 * The booking confirmation email.
 *
 * `html` is interpolated with `{name}`, `{type}`, `{date}`, `{time}`,
 * `{bookingId}` and `{sender}`. Every substituted value is HTML-escaped first;
 * the surrounding markup is trusted, because only a superadmin can write it.
 */
export type BookingEmailTemplate = {
  subject: string;
  html: string;
};

export type ChatCaptureCard = {
  title: string;
  body: string;
  cta: string;
};

/** The three prompts the chat panel uses to ask for a visitor's details. */
export type ChatCaptureTemplates = {
  intent: ChatCaptureCard;
  unanswered: ChatCaptureCard;
  depth: ChatCaptureCard;
};

/**
 * One CRM follow-up draft.
 *
 * `subject` and `body` carry `{placeholder}` tokens filled by
 * `src/lib/crm/outreach.ts`. Which draft is chosen — from the lead's stage,
 * appointment history and loss reason — stays in code; only the words are here.
 *
 * `subjectGeneric` is used where the subject reads badly without a named
 * product ("Your enquiry" rather than "Your enquiry about the WF-C21000").
 * Blank means "there is no generic form; use `subject`".
 */
export type OutreachTemplate = {
  subject: string;
  subjectGeneric?: string;
  body: string;
};

export type OutreachTemplateId =
  | "upcomingMeeting"
  | "cancelledMeeting"
  | "qualifyingChatUnanswered"
  | "qualifyingChatAnswered"
  | "qualifyingIntro"
  | "promotionAfterMeeting"
  | "promotionIntro"
  | "negotiationAfterMeeting"
  | "negotiationCold"
  | "closing"
  | "checkIn"
  | "reopeningPrice"
  | "reopeningCompetitor"
  | "reopeningTiming"
  | "reopeningBudgetCut"
  | "reopeningNoResponse"
  | "reopeningNeutral";

export type OutreachTemplates = Record<OutreachTemplateId, OutreachTemplate>;

/**
 * Overrides for the CRM tooltip glossary.
 *
 * Sparse on purpose: an entry here replaces the matching one in
 * `src/lib/crm/glossary.ts`, and anything not overridden keeps the shipped
 * text. Storing all sixty would mean a glossary improvement in the repository
 * never reaching a deployment that had once opened this page.
 */
export type TooltipOverride = {
  what: string;
  why?: string;
  how?: string;
};

export type TooltipOverrides = Record<string, TooltipOverride>;

export type SiteContent = {
  social: SocialContent;
  landing: LandingContent;
  catalog: CatalogContent;
  bookingEmail: BookingEmailTemplate;
  chatCapture: ChatCaptureTemplates;
  outreach: OutreachTemplates;
  tooltips: TooltipOverrides;
};

/** `SiteContent` keys are the `site_content.key` values, one row each. */
export type ContentBlockKey = keyof SiteContent;

export const CONTENT_BLOCK_KEYS = [
  "social",
  "landing",
  "catalog",
  "bookingEmail",
  "chatCapture",
  "outreach",
  "tooltips",
] as const satisfies readonly ContentBlockKey[];
