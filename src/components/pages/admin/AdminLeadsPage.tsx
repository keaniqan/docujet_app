import { Suspense } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import { SkeletonBody } from "@/components/admin/AdminSkeleton";
import DemoNotice from "@/components/admin/DemoNotice";
import LeadTracker from "@/components/crm/LeadTracker";
import { resolveToday } from "@/lib/crm/analytics";
import { getKnowledgeGaps } from "@/lib/chat/capture";
import { getCurrentStaffProfile } from "@/lib/supabase/authorization";
import { getContentSafe } from "@/lib/content/store";
import { getSettingsSafe } from "@/lib/settings/store";
import { fetchLeadEvents, fetchLeads, isSupabaseConfigured } from "@/lib/crm/leads";
import type { Lead, LeadAppointment, LeadEvent } from "@/lib/crm/types";
import { getLeadAppointments } from "@/lib/supabase/admin";

type AdminLeadsPageProps = {
  className?: string;
};

/**
 * The lead tracker page as coded.
 *
 * This is the fallback the app renders until someone builds `/admin/leads` in
 * Plasmic; after that, Studio's version takes over and this stops being used.
 * The two are not the same page: here the rows are read on the server and
 * handed down, whereas a Studio-built page renders the tracker on the client
 * and it reads them itself through `/api/crm/leads`.
 */
export default async function AdminLeadsPage({ className }: AdminLeadsPageProps) {
  const today = resolveToday(process.env.CRM_TODAY);

  // Who is reading, and what the business calls itself. Only the outreach
  // drafts use these — a follow-up signed off with the company alone reads as
  // a mailshot, and the company name is admin-editable so it cannot be a
  // literal in the drafter. Both degrade to a sensible default.
  const [profile, settings, content] = await Promise.all([
    getCurrentStaffProfile().catch(() => null),
    getSettingsSafe(),
    getContentSafe(),
  ]);
  const viewer = {
    name: profile?.full_name ?? null,
    companyName: settings.business.companyName,
  };

  let leads: Lead[] | null = null;
  let appointments: LeadAppointment[] = [];
  let events: LeadEvent[] = [];
  let kbGaps: { total: number; topTheme: string | null } | undefined;
  let notice: string | null = null;

  if (!isSupabaseConfigured()) {
    notice =
      "No Supabase project is configured — SUPABASE_URL and SUPABASE_SECRET_KEY are not set " +
      "in .env.";
  } else {
    try {
      const [book, booked, history] = await Promise.all([
        fetchLeads(),
        getLeadAppointments(),
        // Same posture as the appointments read: `fetchLeadEvents` reports its
        // own failure and returns []. A project without 0006 applied still gets
        // the whole tracker, minus the timeline.
        fetchLeadEvents(),
      ]);
      leads = book;
      // `getLeadAppointments` reports its failure in the result rather than
      // throwing, and it is not worth losing the book over: the card says "No
      // appointments booked" and every other view is untouched.
      appointments = booked.data;
      events = history;

      // Only the headline, not the list: the finding says how many questions
      // went unanswered and what the commonest was, and the list itself lives
      // on /superadmin/settings/chatbot next to the editor that fixes it.
      const report = await getKnowledgeGaps(1);
      if (report.error === null && report.total > 0) {
        kbGaps = { total: report.total, topTheme: report.gaps[0]?.question ?? null };
      }
    } catch (cause) {
      notice = cause instanceof Error ? cause.message : "Could not read the leads table.";
    }
  }

  return (
    <div className={className ?? ""}>
      <AdminHeader
        title="Lead Tracker"
        description="Who to call today, what it is worth, and why the rest can wait."
      />

      <div className="space-y-6 p-5 md:p-8">
        {notice ? (
          <DemoNotice
            title="Showing sample data — the database is not connected."
            reason={notice}
          >
            Every view below works on the seed leads. The controls still respond, but nothing is
            saved — these rows exist in no database. Apply the migrations in{" "}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">
              supabase/migrations/
            </code>{" "}
            in the Supabase SQL Editor, set{" "}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">SUPABASE_URL</code>{" "}
            and{" "}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">
              SUPABASE_SECRET_KEY
            </code>{" "}
            in{" "}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">.env</code>, then
            run{" "}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">
              npm run db:seed
            </code>
            .
          </DemoNotice>
        ) : null}

        {/* The tracker reads the query string with useSearchParams, which needs
            a Suspense boundary above it. Omitting `leads` puts it in sample
            mode, which is exactly what the notice above describes — and
            `autoLoad` is off because this page has already done the reading. */}
        <Suspense fallback={<SkeletonBody title="Lead Tracker" tiles={6} rows={6} />}>
          {leads ? (
            <LeadTracker
              leads={leads}
              appointments={appointments}
              events={events}
              kbGaps={kbGaps}
              viewer={viewer}
              outreachTemplates={content.outreach}
              today={today}
              autoLoad={false}
            />
          ) : (
            <LeadTracker
              viewer={viewer}
              outreachTemplates={content.outreach}
              today={today}
              autoLoad={false}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}
