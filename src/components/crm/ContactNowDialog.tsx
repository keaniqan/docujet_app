"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLeadTracker } from "./TrackerContext";
import { logContactAction } from "@/lib/crm/actions";
import { draftFollowUp } from "@/lib/crm/outreach";
import type { Lead } from "@/lib/crm/types";

export type ContactNowDialogProps = {
  lead: Lead;
  onClose: () => void;
};

/**
 * What a copy button says, and for how long.
 *
 * The confirmation has to outlast the glance that follows the click, or the
 * reader is left unsure whether anything happened and presses it again.
 */
const COPIED_FOR = 1800;

/**
 * Everything needed to contact one lead, in one place.
 *
 * ---------------------------------------------------------------------------
 * Why this sits between the queue and the log
 *
 * "Log contact" used to be a single button, and it recorded a conversation the
 * app had done nothing to help with. That put the work in the wrong order: the
 * rep had to leave the tracker, find the lead's number somewhere else, think of
 * an opening line, have the conversation, and then remember to come back and
 * press a button whose only reward was a timestamp. The step most likely to be
 * skipped was the last one, which is exactly the step every stall figure in
 * this app depends on.
 *
 * This makes the button do the work first. It hands over the phone number, the
 * email address and a draft written for this particular lead, and only then
 * offers to log it — so pressing Log contact is the natural end of a task
 * rather than an errand of its own.
 * ---------------------------------------------------------------------------
 *
 * Cancel closes without recording anything. That is deliberate and worth
 * keeping: a rep who opens this to check a phone number and then gets no answer
 * has not contacted anybody, and a dialog that logged on open would fill the
 * contact log with conversations that never happened — which is worse than an
 * empty log, because it looks like evidence.
 *
 * The draft is editable in place. It is a starting point, not a template to be
 * sent verbatim, and a textarea says that in a way a read-only block would not.
 */
export default function ContactNowDialog({ lead, onClose }: ContactNowDialogProps) {
  const { today, appointmentsFor, isSample, setFlash, viewer, outreachTemplates } =
    useLeadTracker();
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);

  const draft = draftFollowUp(lead, {
    today,
    appointments: appointmentsFor(lead.id),
    senderName: viewer.name,
    companyName: viewer.companyName,
    templates: outreachTemplates,
  });

  // Null means untouched, so the draft follows the lead if this is reopened on
  // a different one — the same nullable-draft rule the editable cells use.
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const body = message ?? draft.body;

  // Escape closes, and the page behind stops scrolling — matching LeadDetail,
  // which is the other thing on this page that floats over everything.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  async function copy(what: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(null), COPIED_FOR);
    } catch {
      // Clipboard access can be refused outright — an insecure origin, a
      // hardened browser. Saying so beats a button that silently does nothing;
      // the value is on screen and selectable either way.
      setCopied(`${what}-failed`);
      window.setTimeout(() => setCopied(null), COPIED_FOR);
    }
  }

  function label(key: string, idle: string) {
    if (copied === key) return "Copied";
    if (copied === `${key}-failed`) return "Press Ctrl+C";
    return idle;
  }

  function logIt() {
    if (isSample) {
      setFlash({ ok: false, message: "Preview data — connect the database to edit leads." });
      onClose();
      return;
    }
    startTransition(async () => {
      const result = await logContactAction(lead.id, note.trim() || "Contacted from the tracker.");
      setFlash(result);
      if (result.ok) onClose();
    });
  }

  const mailto =
    lead.email.trim() === ""
      ? null
      : `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(
          draft.subject,
        )}&body=${encodeURIComponent(body)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:p-8"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Contact ${lead.name || lead.id}`}
        tabIndex={-1}
        className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl outline-none"
      >
        <header>
          <h3 className="text-lg font-semibold text-slate-950">
            Contact {lead.name || lead.id}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {lead.company || "No company recorded"}
            {lead.title ? ` · ${lead.title}` : ""}
          </p>
        </header>

        {/* Details first: this dialog exists because the number was somewhere
            else, so the number is the first thing in it. */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Detail
            label="Phone"
            value={lead.phone}
            empty="No phone recorded"
            href={lead.phone ? `tel:${lead.phone.replace(/\s/g, "")}` : null}
            actionLabel={label("phone", "Copy")}
            onCopy={() => copy("phone", lead.phone)}
          />
          <Detail
            label="Email"
            value={lead.email}
            empty="No email recorded"
            href={lead.email ? `mailto:${lead.email}` : null}
            actionLabel={label("email", "Copy")}
            onCopy={() => copy("email", lead.email)}
          />
        </div>

        <section className="mt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Suggested follow-up
            </h4>
            <p className="text-xs text-slate-500">{draft.basis}</p>
          </div>

          <label className="mt-2 block">
            <span className="sr-only">Subject</span>
            <input
              readOnly
              value={draft.subject}
              className="w-full rounded-t-lg border border-b-0 border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600"
            />
          </label>
          <textarea
            value={body}
            rows={11}
            aria-label={`Follow-up message for ${lead.name}`}
            onChange={(event) => setMessage(event.target.value)}
            className="w-full rounded-b-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-900 outline-none transition focus:border-sky-800 focus:ring-4 focus:ring-sky-100"
          />

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => copy("message", body)}
              className="rounded-full border border-sky-800 bg-sky-800 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-900"
            >
              {label("message", "Copy message")}
            </button>
            {mailto ? (
              <a
                href={mailto}
                className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
              >
                Open in email
              </a>
            ) : null}
            {message !== null ? (
              <button
                type="button"
                onClick={() => setMessage(null)}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100"
              >
                Reset to the draft
              </button>
            ) : null}
            <p className="text-xs text-slate-400">Edit it before you send — it is a starting point.</p>
          </div>
        </section>

        <div className="mt-6 border-t border-slate-200 pt-5">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              What happened? (optional)
            </span>
            <input
              value={note}
              placeholder="Left a voicemail · Sent the follow-up · Spoke to their PA"
              onChange={(event) => setNote(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-800 focus:ring-4 focus:ring-sky-100"
            />
          </label>
          <p className="mt-1.5 text-xs leading-5 text-slate-500">
            This is what a colleague sees in the contact log. Logging stamps the lead with your
            name and the time — press it only once you have actually made contact.
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={logIt}
              disabled={isPending}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40"
            >
              {isPending ? "Logging…" : "Log contact"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One contact detail: the value, a way to use it, and a way to copy it. */
function Detail({
  label,
  value,
  empty,
  href,
  actionLabel,
  onCopy,
}: {
  label: string;
  value: string;
  empty: string;
  href: string | null;
  actionLabel: string;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </span>
      {value.trim() === "" ? (
        <p className="mt-1 text-sm text-slate-400">{empty}</p>
      ) : (
        <div className="mt-1 flex items-center justify-between gap-2">
          <a
            href={href ?? undefined}
            className="min-w-0 break-all text-sm font-medium text-slate-900 underline-offset-4 hover:text-sky-800 hover:underline"
          >
            {value}
          </a>
          <button
            type="button"
            onClick={onCopy}
            className="shrink-0 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}
