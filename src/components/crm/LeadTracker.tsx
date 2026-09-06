"use client";

import { DataProvider } from "@plasmicapp/loader-nextjs";
import type { ReactNode } from "react";
import ActionBoard from "./ActionBoard";
import ContactLog from "./ContactLog";
import FilterBar from "./FilterBar";
import FlashMessage from "./FlashMessage";
import InsightPanel from "./InsightPanel";
import KpiCard from "./KpiCard";
import KpiRow from "./KpiRow";
import LeadBoard from "./LeadBoard";
import LeadCharts from "./LeadCharts";
import LeadCountLabel from "./LeadCountLabel";
import LeadDetail from "./LeadDetail";
import LeadEmptyState from "./LeadEmptyState";
import LeadTable from "./LeadTable";
import PipelineBar from "./PipelineBar";
import StageTile from "./StageTile";
import ViewSwitch from "./ViewSwitch";
import ViewToggle from "./ViewToggle";
import ActiveLostDonut from "./charts/ActiveLostDonut";
import FunnelChart from "./charts/FunnelChart";
import LossReasonChart from "./charts/LossReasonChart";
import MonthlyChart from "./charts/MonthlyChart";
import SocialSplitMeter from "./charts/SocialSplitMeter";
import SourceQualityChart from "./charts/SourceQualityChart";
import SourceShareDonut from "./charts/SourceShareDonut";
import SourceStageMatrix from "./charts/SourceStageMatrix";
import SourceVolumeChart from "./charts/SourceVolumeChart";
import StageShareDonut from "./charts/StageShareDonut";
import StageVelocityChart from "./charts/StageVelocityChart";
import ApplyButton from "./filters/ApplyButton";
import ClearFilters from "./filters/ClearFilters";
import FilterSelect from "./filters/FilterSelect";
import SearchInput from "./filters/SearchInput";
import { LeadTrackerProvider, useLeadTracker } from "./TrackerContext";
import type { OutreachTemplates } from "@/lib/content/types";
import { STAGE_KEYS } from "@/lib/crm/taxonomy";
import type { Lead, LeadAppointment, LeadEvent, ViewKey } from "@/lib/crm/types";

export type LeadTrackerProps = {
  className?: string;
  /** The lead book. Falls back to the seed rows when absent — the Studio canvas. */
  leads?: Lead[];
  /**
   * The bookings behind those leads, shown on the lead card. Falls back to the
   * seed appointments only when the book itself is sampled.
   */
  appointments?: LeadAppointment[];
  /** The lead histories behind the timeline. No sample fallback — see the provider. */
  events?: LeadEvent[];
  /** Who is looking, and what the business is called. Signs outreach drafts off. */
  viewer?: { name: string | null; companyName: string };
  /** The editable follow-up drafts. Falls back to the shipped ones — see the provider. */
  outreachTemplates?: OutreachTemplates;
  /** Unanswered chat questions, for the knowledge-gap finding. */
  kbGaps?: { total: number; topTheme: string | null };
  /**
   * Y-m-d, resolved on the server so client and server agree on "this week".
   * Empty means whatever the loaded book came with.
   */
  today?: string;
  /**
   * With no `leads` prop, read the book from `/api/crm/leads` in the browser —
   * how a Plasmic-authored page gets real rows instead of the seed ones.
   */
  autoLoad?: boolean;
  /** Used when the URL carries no `view`. The work queue, unless overridden. */
  defaultView?: ViewKey;
  /** Renders stage and source as badges instead of editors. Presentational only. */
  readOnly?: boolean;
  showKpis?: boolean;
  showPipeline?: boolean;
  showFilters?: boolean;
  /** The contact log beneath the views. */
  showContactLog?: boolean;
  /**
   * The tracker's contents.
   *
   * Empty means the standard dashboard below. In Plasmic this slot is filled
   * with that same tree as real, editable elements, so a designer rearranges
   * or deletes the parts instead of toggling props.
   */
  children?: ReactNode;
};

/**
 * The KPI row, chosen to match the view.
 *
 * A rep on the queue needs to know what is outstanding; someone reading the
 * charts needs to know the shape of the book. The same six tiles cannot serve
 * both, and showing all twelve would serve neither — so the row follows the
 * view, which is the only signal available about why the page is open.
 */
function KpiRowForView() {
  const { view } = useLeadTracker();

  if (view === "action") {
    return (
      <KpiRow>
        <KpiCard metric="needsAction" />
        <KpiCard metric="overdue" />
        <KpiCard metric="hot" />
        <KpiCard metric="stalled" />
        <KpiCard metric="untouched" />
        <KpiCard metric="unowned" />
      </KpiRow>
    );
  }

  return (
    <KpiRow>
      <KpiCard metric="total" />
      <KpiCard metric="open" />
      <KpiCard metric="qualified" />
      <KpiCard metric="customers" />
      <KpiCard metric="lost" />
      <KpiCard metric="topSource" />
    </KpiRow>
  );
}

/** The dashboard as shipped — the layout the app renders when nothing overrides it. */
function StandardLayout({
  showKpis,
  showPipeline,
  showFilters,
  showContactLog,
}: {
  showKpis: boolean;
  showPipeline: boolean;
  showFilters: boolean;
  showContactLog: boolean;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ViewToggle />
        <LeadCountLabel />
      </div>

      <FlashMessage />

      {showKpis ? <KpiRowForView /> : null}

      {showPipeline ? (
        <PipelineBar>
          {STAGE_KEYS.map((key) => (
            <StageTile key={key} stage={key} />
          ))}
        </PipelineBar>
      ) : null}

      {showFilters ? (
        <FilterBar>
          <SearchInput />
          <FilterSelect filter="source" />
          <FilterSelect filter="stage" />
          <FilterSelect filter="group" />
          <ApplyButton />
          <ClearFilters />
        </FilterBar>
      ) : null}

      <ViewSwitch
        emptyView={<LeadEmptyState />}
        actionView={<ActionBoard />}
        tableView={<LeadTable />}
        boardView={<LeadBoard />}
        chartsView={
          <>
            {/* The verdict first. Thirteen charts with nobody to read them is
                how the old dashboard came to be ignored; this says what they
                add up to before asking anyone to look at them. */}
            <InsightPanel limit={6} className="mb-5" />
            <LeadCharts>
              <LossReasonChart />
              <StageVelocityChart />
              <SourceVolumeChart />
              <SourceQualityChart />
              <FunnelChart />
              <MonthlyChart />
              <SourceStageMatrix />
              <SocialSplitMeter />
              <SourceShareDonut />
              <ActiveLostDonut />
              <StageShareDonut />
            </LeadCharts>
          </>
        }
      />

      {/* Below the views rather than inside one, because it answers a question
          about the team rather than about a lead — "who has been talking to
          whom" is the same question whichever view is open above it. It reads
          the same filters, so narrowing to a source narrows the log with it. */}
      {showContactLog ? (
        <ContactLog className="border-t border-slate-200 pt-8" />
      ) : null}

      <LeadDetail />
    </>
  );
}

/**
 * Publishes the tracker's numbers to Plasmic's data picker, so a designer can
 * bind any text on the page to `$ctx.leadTracker.…` without writing code.
 */
function PublishTrackerData({ children }: { children: ReactNode }) {
  const {
    visible,
    allLeads,
    stats,
    sources,
    query,
    view,
    today,
    selected,
    filtered,
    appointments,
    appointmentsFor,
    eventsFor,
    contactLog,
    queue,
    queueGroups,
    outstanding,
    insights,
    scoreFor,
  } = useLeadTracker();

  return (
    <DataProvider
      name="leadTracker"
      data={{
        leads: visible,
        allLeads,
        count: visible.length,
        total: allLeads.length,
        stats,
        sources,
        filters: query.filters,
        filtered,
        sort: query.sort,
        dir: query.dir,
        view,
        today,
        selected,
        appointments,
        selectedAppointments: selected ? appointmentsFor(selected.id) : [],
        // The decision layer, bindable in Studio like everything else — so a
        // designer can put "12 leads need action, 4 of them qualified" in a
        // hero band without writing any code.
        queue,
        queueGroups,
        outstanding,
        insights,
        contactLog,
        play: query.play,
        selectedScore: selected ? scoreFor(selected.id) : null,
        selectedEvents: selected ? eventsFor(selected.id) : [],
      }}
    >
      {children}
    </DataProvider>
  );
}

/**
 * The lead tracker.
 *
 * A port of `crm/index.php` — three views over one filtered list. Every filter,
 * the sort, the active view and the selected lead are carried in the query
 * string, so any screen is a shareable URL and the back button behaves; inside
 * the Plasmic canvas, where there is no route to carry them, the same state
 * lives in the component so every control still responds.
 *
 * This component is now only the state and the frame. Each visible part — a KPI
 * tile, a filter, a chart, the table — is a free-standing element that reads
 * the tracker itself, which is what lets Plasmic move, restyle or delete any of
 * them independently.
 *
 * Filtering and aggregation run here in the browser over the whole book. At
 * this size that is instant and lets a filter change land without a server
 * round-trip; the server's only job is to hand over the rows.
 */
export default function LeadTracker({
  className = "",
  leads,
  appointments,
  events,
  kbGaps,
  viewer,
  outreachTemplates,
  today,
  autoLoad = true,
  defaultView = "action",
  readOnly = false,
  showKpis = true,
  showPipeline = true,
  showFilters = true,
  showContactLog = true,
  children,
}: LeadTrackerProps) {
  return (
    <LeadTrackerProvider
      leads={leads}
      appointments={appointments}
      events={events}
      kbGaps={kbGaps}
      viewer={viewer}
      outreachTemplates={outreachTemplates}
      // An empty string is Studio's "not set", not a date.
      today={today || undefined}
      autoLoad={autoLoad}
      defaultView={defaultView}
      readOnly={readOnly}
    >
      <PublishTrackerData>
        <div className={`space-y-6 ${className}`}>
          {children ?? (
            <StandardLayout
              showKpis={showKpis}
              showPipeline={showPipeline}
              showFilters={showFilters}
              showContactLog={showContactLog}
            />
          )}
        </div>
      </PublishTrackerData>
    </LeadTrackerProvider>
  );
}
