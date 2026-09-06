/**
 * The follow-up a rep is about to send.
 *
 * ---------------------------------------------------------------------------
 * Why the app drafts this at all
 *
 * The queue can rank leads perfectly and still be ignored, because the gap
 * between "call this one" and actually doing it is a blank message box at nine
 * in the morning. That blank box is where a work queue quietly dies: the rep
 * knows who to contact, cannot immediately think what to say, and moves on to
 * something with less friction in it.
 *
 * So this writes the first draft. Not to automate the conversation — a rep
 * edits every one of these before sending, and should — but to make starting
 * cost nothing. The draft is deliberately short, specific to what this lead
 * actually did, and free of anything that would embarrass the sender if it went
 * out unedited.
 * ---------------------------------------------------------------------------
 *
 * ---------------------------------------------------------------------------
 * What it will not say
 *
 * No prices, no lead times, no availability, no promises about what a
 * technician will do. Those are the same limits the chat assistant works under
 * (`src/lib/chat/prompt.ts`), and for the same reason: this business quotes
 * after a consultation, and a draft that guessed a number would put it in a
 * rep's outbox under their own name.
 *
 * It also never claims something happened that the record does not support —
 * "following up on our call" is only written when there is a logged contact to
 * follow up on.
 * ---------------------------------------------------------------------------
 *
 * ---------------------------------------------------------------------------
 * Stage decides the goal; the record decides the opener
 *
 * These drafts used to branch on the record alone — a booked meeting, a
 * cancellation, a chat question, a silence. That produced messages that were
 * always true and often aimless: the same "checking in, where do things stand"
 * went to a lead who had never seen the product and to one sitting on a
 * proposal, because both were equally quiet.
 *
 * Stage is now the primary axis, because it is what decides what the message is
 * *for*. MQL is asking for attention, SQL is asking for a decision to be made
 * easy, Opportunity is asking for the decision itself, and Customer is not
 * selling at all. Underneath that, the record still chooses the opener wherever
 * it has something stronger to open with — a meeting in the diary outranks any
 * stage template, because confirming it is the only message that makes sense.
 *
 * The no-prices rule above survives this intact, and it bites hardest at SQL,
 * where the instruction is to be competitive. The draft offers to *build* a
 * quote against real volumes; it never names a figure. That is the honest
 * version of competitive here — this business quotes after a consultation, and
 * a number invented by a template would go out under a rep's own name.
 * ---------------------------------------------------------------------------
 *
 * Pure functions over plain data, like the rest of `src/lib/crm/`.
 */

import { daysBetween, prettyDate } from "./analytics";
import { DEFAULT_OUTREACH_TEMPLATES } from "./outreach-templates";
import { LOST_REASONS } from "./taxonomy";
import type { Lead, LeadAppointment, LostReason } from "./types";
import type {
  OutreachTemplate,
  OutreachTemplateId,
  OutreachTemplates,
} from "@/lib/content/types";

export type Draft = {
  /** Email subject. Ignored when the rep is sending this by phone or chat. */
  subject: string;
  /** The message. Plain text with blank lines between paragraphs. */
  body: string;
  /** Why this draft rather than another, for the line above the textarea. */
  basis: string;
};

export type DraftContext = {
  /** Y-m-d. */
  today: string;
  appointments: LeadAppointment[];
  /** Who is writing. Signs the message off; omitted when unknown. */
  senderName?: string | null;
  /** The business, for the sign-off. */
  companyName?: string;
  /**
   * The words, as the Content Management page has them.
   *
   * Optional, and falling back to what ships in `outreach-templates.ts`: a
   * Plasmic-authored tracker has no server component above it to read the
   * store, and the shipped drafts are the right thing to write in that case.
   */
  templates?: OutreachTemplates;
};

/**
 * Honorifics, which are never the name to greet somebody by.
 *
 * "Tan" is deliberately absent even though "Tan Sri" is a title: it is also one
 * of the commonest Chinese-Malaysian surnames, and dropping it would greet Tan
 * Boon Keat as "Boon". Discarding a real name is the worse error, so the
 * ambiguous case keeps the name.
 */
const HONORIFIC = /^(mr|mrs|ms|miss|dr|prof|ir|encik|puan|cik|tuan|datuk|dato|datin|haji|hajah|seri|sri)[.]?$/i;

/**
 * The name to open with.
 *
 * The first token that is not a title. Malaysian names carry patronymics —
 * "bin", "binti", "a/l" — and honorifics, and "Hi Ahmad" is right where "Hi
 * Ahmad Zulkifli bin Hassan" is a mail merge announcing itself.
 *
 * Falls back to a greeting with no name rather than to a placeholder: "Hello,"
 * is warm and "Hi {name}" is a bug somebody sent to a customer.
 */
export function firstName(fullName: string): string | null {
  for (const token of fullName.trim().split(/\s+/)) {
    if (token.length < 2) continue;
    if (HONORIFIC.test(token)) continue;
    return token;
  }
  return null;
}

/**
 * A date as it should appear in a message to a customer.
 *
 * `prettyDate` gives "19 Jun 2026". The ISO form these are stored in is correct
 * everywhere else in the app and wrong here: nobody writes "our demonstration
 * on 2026-06-19" to a person.
 */
function niceDate(date: string): string {
  return prettyDate(date);
}

/**
 * What to say they asked about, when the record does not name a product.
 *
 * Named rather than repeated, because `draftFollowUp` compares against it to
 * decide whether a subject line can carry the product — "Your enquiry about
 * your printing requirements" is a sentence only a mail merge writes.
 */
const GENERIC_MATTER = "your printing requirements";

/** "the WF-C21000" / "your printing requirements" — what to say they asked about. */
function subjectMatter(lead: Lead): string {
  const interest = lead.interest.trim();
  if (interest === "") return GENERIC_MATTER;

  // The interest is free text a rep may have typed. A model number is the one
  // part of it worth quoting back verbatim; anything else is summarised, since
  // repeating a whole line like "WF-C21000 fleet for 4 branch offices" reads as
  // a database field pasted into a sentence.
  const model = interest.match(/WF-C2\d{4}/i);
  return model ? `the ${model[0].toUpperCase()}` : GENERIC_MATTER;
}

/** The most recent appointment of a given status, or null. */
function latest(appointments: LeadAppointment[], status: string): LeadAppointment | null {
  const matching = appointments.filter((a) => a.status === status);
  if (matching.length === 0) return null;
  return matching.reduce((a, b) => (a.date > b.date ? a : b));
}

function signOff(ctx: DraftContext): string {
  const company = ctx.companyName?.trim() || "DocuJet";
  return ctx.senderName?.trim() ? `${ctx.senderName.trim()}\n${company}` : company;
}

/**
 * Fills a template's `{name}` tokens.
 *
 * Unknown tokens become empty rather than staying visible: a stray `{volume}`
 * left in an edited template is a mistake, and a blank is a smaller one than
 * "we can discuss {volume} next week" arriving in somebody's inbox.
 */
function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_match, key: string) => vars[key] ?? "");
}

/**
 * One template, rendered.
 *
 * `subjectGeneric` is used when there is no product to name — "Your enquiry"
 * rather than "Your enquiry about your printing requirements", which is the
 * sentence a mail merge writes and a person does not.
 */
function render(
  template: OutreachTemplate,
  vars: Record<string, string>,
  generic: boolean,
): { subject: string; body: string } {
  const subject =
    generic && template.subjectGeneric?.trim()
      ? template.subjectGeneric
      : template.subject;

  return { subject: fill(subject, vars), body: fill(template.body, vars) };
}

/**
 * Writes the draft.
 *
 * Two cross-stage openers are checked first, because the record has something
 * to say that outranks any template: a meeting already in the diary, and a
 * meeting that was cancelled and never replaced. After that the lead's stage
 * decides what the message is for.
 *
 * A lost lead is answered by `reopeningDraft`, which is keyed on the cause of
 * death rather than the stage it died at — "we have changed how we quote" is
 * the right letter to a price loss whether it died at SQL or at Opportunity.
 *
 * The words come from `ctx.templates`, which the Content Management page can
 * edit; everything below decides *which* of them to use, and that stays here.
 * `basis` is not editable and is not customer-facing — it is this module
 * explaining itself to the rep, and it has to describe the record rather than
 * repeat a stored sentence.
 */
export function draftFollowUp(lead: Lead, ctx: DraftContext): Draft {
  const templates = ctx.templates ?? DEFAULT_OUTREACH_TEMPLATES;
  const name = firstName(lead.name);
  const greeting = name ? `Hi ${name},` : "Hello,";
  const matter = subjectMatter(lead);
  const sign = signOff(ctx);
  const generic = matter === GENERIC_MATTER;
  const base = { greeting, matter, sign };

  const upcoming = ctx.appointments.find(
    (a) => a.status !== "Cancelled" && daysBetween(ctx.today, a.date) >= 0,
  );
  const cancelled = latest(ctx.appointments, "Cancelled");
  const live = ctx.appointments.filter(
    (a) => a.status === "Confirmed" || a.status === "Pending",
  );

  // 1. A meeting is in the diary. Confirming it is the only message that makes
  //    sense at any stage, and it is the one most likely to stop a no-show.
  if (upcoming) {
    return {
      ...render(
        templates.upcomingMeeting,
        {
          ...base,
          type: upcoming.type,
          typeLower: upcoming.type.toLowerCase(),
          date: niceDate(upcoming.date),
          time: upcoming.time,
        },
        generic,
      ),
      basis: `They have a ${upcoming.type.toLowerCase()} booked for ${niceDate(upcoming.date)}.`,
    };
  }

  // 2. They booked, cancelled, and nothing replaced it. They wanted the meeting
  //    once, so the message is about making it easy to have it — again, true at
  //    whatever stage they are sitting at.
  if (cancelled && live.length === 0) {
    return {
      ...render(
        templates.cancelledMeeting,
        { ...base, typeLower: cancelled.type.toLowerCase(), date: niceDate(cancelled.date) },
        generic,
      ),
      basis: `Their ${cancelled.type.toLowerCase()} on ${niceDate(cancelled.date)} was cancelled and nothing was booked in its place.`,
    };
  }

  if (lead.lost) return reopeningDraft(lead, ctx, base, generic);

  switch (lead.stage) {
    case "mql":
      return promotionDraft(lead, ctx, base, generic);
    case "sql":
      return negotiationDraft(lead, ctx, base, generic);
    case "opportunity":
      return closingDraft(lead, ctx, base, generic);
    case "customer":
      return checkInDraft(lead, ctx, base, generic);
    default:
      return qualifyingDraft(lead, ctx, base, generic);
  }
}

/** The three tokens every template gets. */
type BaseVars = { greeting: string; matter: string; sign: string };

/**
 * Lead — a first reply that asks rather than pitches.
 *
 * The board does not offer a Contact button at this stage, so this is written
 * for the rep who opened one specific raw lead and decided it was worth a
 * message anyway. It asks the two questions that decide whether they are a
 * buyer, because that is the only thing an unqualified lead is for.
 *
 * The chat opener is used here and only here: a visitor who typed a question
 * into the site and left their details has told us what they want, and quoting
 * it back is the strongest opener available at the one stage where nobody has
 * spoken to them yet.
 */
function qualifyingDraft(
  lead: Lead,
  ctx: DraftContext,
  base: BaseVars,
  generic: boolean,
): Draft {
  const templates = ctx.templates ?? DEFAULT_OUTREACH_TEMPLATES;

  if (lead.chatTopic && lead.lastContactAt === null) {
    const unanswered = lead.cited.length === 0;
    return {
      ...render(
        unanswered ? templates.qualifyingChatUnanswered : templates.qualifyingChatAnswered,
        { ...base, question: lead.chatTopic },
        generic,
      ),
      basis: unanswered
        ? "They asked the site assistant something it could not answer, and left their details anyway."
        : "They left their details in the chat panel after asking a specific question.",
    };
  }

  const age = lead.createdAt ? Math.max(0, daysBetween(lead.createdAt, ctx.today)) : 0;
  return {
    ...render(templates.qualifyingIntro, base, generic),
    basis:
      age > 0
        ? `Nobody has contacted them since they arrived ${age} days ago.`
        : "Nobody has contacted them yet.",
  };
}

/**
 * MQL — put the product in front of them.
 *
 * The job here is exposure, not agreement, so the message asks for the smallest
 * possible thing: look at this. No pricing, no meeting request, no "when can we
 * talk" — each of those asks a lead who has not yet seen the product to commit
 * before they have been given a reason to.
 */
function promotionDraft(
  lead: Lead,
  ctx: DraftContext,
  base: BaseVars,
  generic: boolean,
): Draft {
  void lead;
  const templates = ctx.templates ?? DEFAULT_OUTREACH_TEMPLATES;
  const met = latest(ctx.appointments, "Completed");

  // A meeting already happened and the stage never moved past MQL. Sending a
  // product overview over the top of that would read as though nobody listened.
  if (met) {
    const since = Math.max(0, daysBetween(met.date, ctx.today));
    return {
      ...render(
        templates.promotionAfterMeeting,
        {
          ...base,
          typeLower: met.type.toLowerCase(),
          when: since <= 2 ? "the other day" : `on ${niceDate(met.date)}`,
          date: niceDate(met.date),
        },
        generic,
      ),
      basis: `They completed a ${met.type.toLowerCase()} ${since} days ago and are still at MQL.`,
    };
  }

  return {
    ...render(templates.promotionIntro, base, generic),
    basis: "They fit who we sell to, but have not been shown the product yet.",
  };
}

/**
 * SQL — make it easy to say yes.
 *
 * The need is confirmed, so this stops describing and starts removing reasons
 * to wait: an offer to price against their real volumes, and two specific times
 * for a demonstration. Two times rather than "when suits you" on purpose — an
 * open question is work for the reader, and a choice between two is not.
 *
 * It offers to *build* a quote and never quotes one. See the module note: being
 * competitive here means pricing their actual usage rather than a list, and
 * saying so costs nothing and commits nobody to a figure.
 */
function negotiationDraft(
  lead: Lead,
  ctx: DraftContext,
  base: BaseVars,
  generic: boolean,
): Draft {
  void lead;
  const templates = ctx.templates ?? DEFAULT_OUTREACH_TEMPLATES;
  const met = latest(ctx.appointments, "Completed");

  return {
    ...render(
      met ? templates.negotiationAfterMeeting : templates.negotiationCold,
      { ...base, date: met ? niceDate(met.date) : "" },
      generic,
    ),
    basis: met
      ? `Qualified, and met with us on ${niceDate(met.date)}. The next step is a costed proposal.`
      : "Qualified with no meeting booked. The next step is a costed proposal and a date.",
  };
}

/**
 * Opportunity — confirm, then close.
 *
 * A proposal is with them, so the only two useful things a message can do are
 * check it arrived intact and surface whatever is actually blocking it. It asks
 * what would need to happen rather than for a decision, because the answer to
 * the first is something a rep can act on and the answer to the second is
 * almost always "we are still discussing it".
 */
function closingDraft(
  lead: Lead,
  ctx: DraftContext,
  base: BaseVars,
  generic: boolean,
): Draft {
  const templates = ctx.templates ?? DEFAULT_OUTREACH_TEMPLATES;
  const silent = lead.lastContactAt
    ? Math.max(0, daysBetween(lead.lastContactAt.slice(0, 10), ctx.today))
    : null;

  return {
    ...render(templates.closing, base, generic),
    basis:
      silent === null
        ? "At Opportunity with no logged contact — the proposal is out and unacknowledged."
        : `A proposal is with them and it has been ${silent} day${silent === 1 ? "" : "s"} since anyone spoke to them.`,
  };
}

/**
 * Customer — not a sales message.
 *
 * The order matters and it is the whole point: the machine first, their opinion
 * second, what is new third, and the referral last and lightly. Reversed, it is
 * a pitch wearing a check-in as a disguise, which is how an account learns to
 * stop opening your email.
 *
 * The referral ask is unconditional, because it otherwise never gets made — but
 * it is one sentence at the bottom, phrased so that ignoring it costs the
 * reader nothing.
 */
function checkInDraft(
  lead: Lead,
  ctx: DraftContext,
  base: BaseVars,
  generic: boolean,
): Draft {
  const templates = ctx.templates ?? DEFAULT_OUTREACH_TEMPLATES;
  const since = lead.lastContactAt
    ? Math.max(0, daysBetween(lead.lastContactAt.slice(0, 10), ctx.today))
    : null;

  return {
    ...render(templates.checkIn, base, generic),
    basis:
      since === null
        ? "A customer with no logged contact since the sale."
        : `They bought, and it has been ${since} day${since === 1 ? "" : "s"} since anyone checked in.`,
  };
}

/**
 * Lost — written against the cause, not the stage.
 *
 * Only worth sending when something has actually changed, and each `basis` says
 * so out loud, so a rep does not fire these off as a batch. A re-approach that
 * cannot name what is different is the same conversation that already failed
 * once, and it tells the reader we were not listening the first time.
 *
 * Two causes get no tailored re-approach at all. "Not a fit" and "Wrong
 * contact" were targeting failures, and the person on the other end is not the
 * one who can fix that — writing to them again asks a stranger to solve our
 * filing problem. They fall through to the neutral draft.
 */
function reopeningDraft(
  lead: Lead,
  ctx: DraftContext,
  base: BaseVars,
  generic: boolean,
): Draft {
  const templates = ctx.templates ?? DEFAULT_OUTREACH_TEMPLATES;
  const sinceClosed = lead.lastContactAt
    ? Math.max(0, daysBetween(lead.lastContactAt.slice(0, 10), ctx.today))
    : null;
  const gap = sinceClosed === null ? "a while" : `${sinceClosed} days`;
  const reason = lead.lostReason;

  const byCause: Partial<Record<LostReason, { id: OutreachTemplateId; basis: string }>> = {
    price: {
      id: "reopeningPrice",
      basis: "Lost on price. Only send this if how we quote has actually changed since.",
    },
    competitor: {
      id: "reopeningCompetitor",
      basis: "Lost to a competitor. The useful moment is after the honeymoon, not during it.",
    },
    timing: {
      id: "reopeningTiming",
      basis: "Lost on timing — the most reopenable cause there is. Check the date is actually right.",
    },
    budget_cut: {
      id: "reopeningBudgetCut",
      basis: "Lost to a budget cut. Send at the start of their fiscal year, not before it.",
    },
    no_response: {
      id: "reopeningNoResponse",
      basis: "They went silent. Keep it short, and make saying no as easy as saying yes.",
    },
  };

  const chosen = reason ? byCause[reason] : undefined;

  if (!chosen) {
    const cause = reason ? LOST_REASONS[reason].label.toLowerCase() : null;
    return {
      ...render(templates.reopeningNeutral, { ...base, gap }, generic),
      basis: cause
        ? `Closed as "${cause}", which was a targeting call on our side rather than theirs. Re-approach only if that has changed.`
        : "Closed with no reason recorded, so there is nothing specific to re-approach on.",
    };
  }

  return {
    ...render(templates[chosen.id], { ...base, gap }, generic),
    basis: chosen.basis,
  };
}
