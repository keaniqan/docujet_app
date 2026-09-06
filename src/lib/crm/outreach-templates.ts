/**
 * The words in the CRM follow-up drafts.
 *
 * ---------------------------------------------------------------------------
 * Why the words moved and the logic did not
 *
 * `outreach.ts` decides *which* draft to write — from the lead's stage, the
 * appointments against it, and how it was lost — and that reasoning is the
 * valuable half. It is also the half nobody wants to edit: the person who wants
 * to change "Best," to "Kind regards," or to soften the referral ask is not
 * proposing a change to how a queue is prioritised.
 *
 * So the selection stays in code and only the text lives here, where the
 * Content Management page can reach it. Each entry is a whole message rather
 * than a fragment — the near-identical pairs below (met / not met, chat
 * answered / unanswered) are written out twice on purpose, because an admin
 * editing a follow-up should see the message they are sending, not a paragraph
 * that will be assembled into one of two things.
 * ---------------------------------------------------------------------------
 *
 * The rules the original module set still apply and are not enforceable here:
 * no prices, no lead times, no availability, no promise about what a technician
 * will do, and never claim something happened that the record does not support.
 * The editor repeats them; a superadmin can now break them.
 *
 * Placeholders are `{name}` tokens, filled by `fillTemplate()` in `outreach.ts`.
 * `{greeting}` `{matter}` `{sign}` are available everywhere; the rest are noted
 * per entry.
 */

import type { OutreachTemplates } from "@/lib/content/types";

export const DEFAULT_OUTREACH_TEMPLATES: OutreachTemplates = {
  /** Also {type} {typeLower} {date} {time}. */
  upcomingMeeting: {
    subject: "Confirming {date} — {type}",
    body:
      "{greeting}\n\n" +
      "Just confirming our {typeLower} on {date} at {time}. I will walk you through {matter} and " +
      "answer anything you want to dig into.\n\n" +
      "If the time no longer suits, tell me what does and I will move it.\n\n" +
      "Thanks,\n{sign}",
  },

  /** Also {typeLower} {date}. */
  cancelledMeeting: {
    subject: "Finding another time",
    body:
      "{greeting}\n\n" +
      "We had a {typeLower} booked that did not go ahead — no problem at all. If you are still " +
      "looking at {matter}, I am happy to find a time that works better, or to send something " +
      "over you can read at your own pace instead.\n\n" +
      "Which would you prefer?\n\n" +
      "Best,\n{sign}",
  },

  /** They asked the site assistant something it could not answer. Also {question}. */
  qualifyingChatUnanswered: {
    subject: "Your question about our printers",
    body:
      "{greeting}\n\n" +
      'You asked us: "{question}"\n\n' +
      "That one is outside what our site assistant could answer, so it came to me directly. I " +
      "can give you a proper answer — and if it is easier, we can go through it on a quick " +
      "call.\n\n" +
      "Best,\n{sign}",
  },

  /** The assistant answered, and it is still worth following up. Also {question}. */
  qualifyingChatAnswered: {
    subject: "Your question about our printers",
    body:
      "{greeting}\n\n" +
      'You asked us: "{question}"\n\n' +
      "I wanted to follow that up properly rather than leave you with the short version. Happy " +
      "to go through it on a quick call, or to answer here if that is easier.\n\n" +
      "Best,\n{sign}",
  },

  qualifyingIntro: {
    subject: "Your enquiry about {matter}",
    subjectGeneric: "Your enquiry",
    body:
      "{greeting}\n\n" +
      "Thanks for getting in touch about {matter}. I look after enquiries like yours, and I " +
      "wanted to introduce myself rather than send you a brochure.\n\n" +
      "Could you tell me roughly what your current print volumes look like, and how many people " +
      "would be using the machine? That is usually enough for me to point you at the right " +
      "model.\n\n" +
      "Best,\n{sign}",
  },

  /** A meeting happened and the stage never moved past MQL. Also {typeLower} {when}. */
  promotionAfterMeeting: {
    subject: "Following up on our {typeLower}",
    body:
      "{greeting}\n\n" +
      "Thanks again for your time {when}. I wanted to check what you made of {matter}, and " +
      "whether anything came up afterwards that I can help with.\n\n" +
      "If it would be useful, I can put together the next step for your team to review.\n\n" +
      "Best,\n{sign}",
  },

  promotionIntro: {
    subject: "A closer look at {matter}",
    subjectGeneric: "What we could do for you",
    body:
      "{greeting}\n\n" +
      "We have not spoken properly yet, so rather than chase you I thought I would just show " +
      "you what we do.\n\n" +
      "We fit and maintain office print systems — the machines, the servicing and the " +
      "consumables — so there is one number to ring when something stops working. Most of our " +
      "customers came to us because they were managing three suppliers for that.\n\n" +
      "I can send over a short overview of the models that suit {matter}, with what each one " +
      "is actually good at. Nothing to fill in and no commitment — have a read, and tell me if " +
      "any of it is relevant to you.\n\n" +
      "Best,\n{sign}",
  },

  /**
   * SQL, having met them. Also {date}.
   *
   * Offers to *build* a quote and never quotes one: this business prices after
   * a consultation, and a figure invented by a template goes out under a rep's
   * own name.
   */
  negotiationAfterMeeting: {
    subject: "Next steps on {matter}",
    subjectGeneric: "Putting some numbers together",
    body:
      "{greeting}\n\n" +
      "Thanks again for your time on {date}. Now I have a picture of what you are running, I " +
      "can put some real numbers against it.\n\n" +
      "I would rather quote against your actual volumes than hand you a list price — that is " +
      "usually the difference between a figure that looks fine now and one that still looks " +
      "fine in a year. Tell me roughly what you print in a month and how many people are on " +
      "it, and I will put a proper costing together with servicing and consumables included, " +
      "so there is nothing hiding underneath it.\n\n" +
      "It is also worth seeing one run before you decide. I could do Tuesday or Thursday " +
      "afternoon — say which is easier and I will arrange it. If neither works, name a day and " +
      "I will fit around you.\n\n" +
      "Best,\n{sign}",
  },

  /** SQL with no meeting on record. */
  negotiationCold: {
    subject: "Next steps on {matter}",
    subjectGeneric: "Putting some numbers together",
    body:
      "{greeting}\n\n" +
      "Now I understand what you are running, the useful next step is numbers rather than " +
      "another conversation about features.\n\n" +
      "I would rather quote against your actual volumes than hand you a list price — that is " +
      "usually the difference between a figure that looks fine now and one that still looks " +
      "fine in a year. Tell me roughly what you print in a month and how many people are on " +
      "it, and I will put a proper costing together with servicing and consumables included, " +
      "so there is nothing hiding underneath it.\n\n" +
      "It is also worth seeing one run before you decide. I could do Tuesday or Thursday " +
      "afternoon — say which is easier and I will arrange it. If neither works, name a day and " +
      "I will fit around you.\n\n" +
      "Best,\n{sign}",
  },

  closing: {
    subject: "Where we stand on {matter}",
    subjectGeneric: "Where we stand",
    body:
      "{greeting}\n\n" +
      "I wanted to check you have everything you need from us on {matter} — and that what we " +
      "sent answers the question your side is actually asking, rather than the one I " +
      "assumed.\n\n" +
      "If something is still in the way, it is usually easier to tell me than to work around " +
      "it. Whether that is the figure, the timing, or somebody internally who has not seen it " +
      "yet, I have some room to move on all three.\n\n" +
      "What would need to happen for you to be comfortable going ahead?\n\n" +
      "Best,\n{sign}",
  },

  /**
   * A customer, and not a sales message.
   *
   * The order is the whole point: the machine first, their opinion second,
   * what is new third, and the referral last and lightly. Reversed, it is a
   * pitch wearing a check-in as a disguise.
   */
  checkIn: {
    subject: "How is everything running?",
    body:
      "{greeting}\n\n" +
      "No agenda with this one — I wanted to check the machine is doing what you bought it " +
      "for. Any jams, any drop in quality, anything the team keeps grumbling about?\n\n" +
      "If there is something you would change about how we have handled it, I would genuinely " +
      "rather hear it than not. That includes the boring parts: response times, how the " +
      "consumables turn up, whoever you end up speaking to when you ring.\n\n" +
      "We have also added a few models since you bought. If your volumes have moved or you are " +
      "opening somewhere new, it is worth five minutes before you commit to anything.\n\n" +
      "And if anyone you know is putting up with a printer they hate, send them my way — it is " +
      "how most of our good customers found us.\n\n" +
      "Best,\n{sign}",
  },

  /** Lost on price. Only send if how we quote has actually changed since. */
  reopeningPrice: {
    subject: "Worth another look?",
    body:
      "{greeting}\n\n" +
      "When we last spoke about {matter}, the figure was the sticking point — and that was a " +
      "fair objection rather than a brush-off.\n\n" +
      "We have changed how we put deals like yours together since then. I would rather show " +
      "you what that looks like against your own volumes than simply tell you it is better, " +
      "so if you are open to it, send me a rough monthly figure and I will work it out.\n\n" +
      "Best,\n{sign}",
  },

  /** Lost to a competitor. The useful moment is after the honeymoon, not during it. */
  reopeningCompetitor: {
    subject: "How has it worked out?",
    body:
      "{greeting}\n\n" +
      "You went a different way on {matter} when we last spoke, which was entirely reasonable " +
      "— I wanted to see how it has held up.\n\n" +
      "If it is doing the job, genuinely good. If the servicing has turned out to be the weak " +
      "part, that is usually where we get called back in, and I am happy to look at it with " +
      "no obligation either way.\n\n" +
      "Best,\n{sign}",
  },

  /** Lost on timing — the most reopenable cause there is. Also {gap}. */
  reopeningTiming: {
    subject: "Is the timing better now?",
    body:
      "{greeting}\n\n" +
      "We talked about {matter} a while back and the timing was wrong — nothing to do with " +
      "the fit.\n\n" +
      "It has been {gap}, so I wanted to check whether the picture has changed at your end. " +
      "If it has not, tell me when to come back and I will leave you alone until then.\n\n" +
      "Best,\n{sign}",
  },

  /** Lost to a budget cut. Send at the start of their fiscal year, not before it. */
  reopeningBudgetCut: {
    subject: "Checking in on the budget",
    body:
      "{greeting}\n\n" +
      "Last time we spoke about {matter} the budget had gone, which happens and was nobody's " +
      "fault.\n\n" +
      "New year, new numbers — I wanted to ask whether it is back on the list. If it is, I can " +
      "put something together that fits whatever the figure actually is, rather than what we " +
      "discussed before.\n\n" +
      "Best,\n{sign}",
  },

  /** They went silent. Keep it short, and make saying no as easy as saying yes. */
  reopeningNoResponse: {
    subject: "One last try",
    body:
      "{greeting}\n\n" +
      "I never heard back about {matter}, which usually means the moment passed or it landed " +
      "at a busy time.\n\n" +
      "No hard feelings either way — but if it is still something you are thinking about, a " +
      "one-line reply is enough and I will pick it up from there. If not, say so and I will " +
      "stop cluttering your inbox.\n\n" +
      "Best,\n{sign}",
  },

  /**
   * Lost with no cause worth re-approaching on.
   *
   * "Not a fit" and "Wrong contact" land here deliberately: those were
   * targeting failures on our side, and the person on the other end is not the
   * one who can fix them.
   */
  reopeningNeutral: {
    subject: "Checking back in",
    body:
      "{greeting}\n\n" +
      "We spoke about {matter} a while ago and it did not go ahead at the time.\n\n" +
      "I wanted to check whether anything has changed at your end — and if it has not, that " +
      "is a perfectly good answer.\n\n" +
      "Best,\n{sign}",
  },
};
