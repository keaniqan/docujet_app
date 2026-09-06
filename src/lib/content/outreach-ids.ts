/**
 * The follow-up draft ids, as a runtime list.
 *
 * `OutreachTemplateId` in `types.ts` is a union, which erases at build time —
 * the CMS form has to iterate the ids to render a card each, and the action has
 * to iterate them to read the form back. Kept beside the type rather than in it
 * so `types.ts` stays free of runtime values.
 */

import type { OutreachTemplateId } from "./types";

export const OUTREACH_TEMPLATE_IDS = [
  "upcomingMeeting",
  "cancelledMeeting",
  "qualifyingChatUnanswered",
  "qualifyingChatAnswered",
  "qualifyingIntro",
  "promotionAfterMeeting",
  "promotionIntro",
  "negotiationAfterMeeting",
  "negotiationCold",
  "closing",
  "checkIn",
  "reopeningPrice",
  "reopeningCompetitor",
  "reopeningTiming",
  "reopeningBudgetCut",
  "reopeningNoResponse",
  "reopeningNeutral",
] as const satisfies readonly OutreachTemplateId[];

/** What each draft is for, shown above its editor. */
export const OUTREACH_TEMPLATE_LABELS: Record<OutreachTemplateId, string> = {
  upcomingMeeting: "A meeting is already in the diary",
  cancelledMeeting: "They cancelled and nothing replaced it",
  qualifyingChatUnanswered: "New lead — the assistant could not answer them",
  qualifyingChatAnswered: "New lead — they asked the assistant something specific",
  qualifyingIntro: "New lead — first contact",
  promotionAfterMeeting: "MQL — a meeting happened and the stage did not move",
  promotionIntro: "MQL — they have not been shown the product yet",
  negotiationAfterMeeting: "SQL — qualified, and we have met them",
  negotiationCold: "SQL — qualified with no meeting booked",
  closing: "Opportunity — a proposal is with them",
  checkIn: "Customer — a check-in, not a pitch",
  reopeningPrice: "Lost on price",
  reopeningCompetitor: "Lost to a competitor",
  reopeningTiming: "Lost on timing",
  reopeningBudgetCut: "Lost to a budget cut",
  reopeningNoResponse: "Lost to silence",
  reopeningNeutral: "Lost with no re-approachable cause",
};
