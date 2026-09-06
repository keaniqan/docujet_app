"use client";

import { usePlasmicCanvasContext } from "@plasmicapp/loader-nextjs";
import { useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import type { OutreachTemplates } from "@/lib/content/types";
import type { StageActionResult } from "@/lib/crm/actions";
import {
  buildContactLog,
  filterLeads,
  findLead,
  paginate,
  sortLeads,
  sourceStats,
  summarise,
  type Page,
  type SourceStat,
  type Summary,
} from "@/lib/crm/analytics";
import {
  buildInsights,
  chartInsight,
  type ChartKey,
  type Insight,
} from "@/lib/crm/insights";
import { DEFAULT_OUTREACH_TEMPLATES } from "@/lib/crm/outreach-templates";
import { buildHref, isFiltered, parseQuery, type TrackerQuery } from "@/lib/crm/query";
import {
  buildQueue,
  groupQueue,
  actionSummary,
  type PlayGroup,
  type QueueItem,
} from "@/lib/crm/queue";
import {
  buildBoard,
  firstPopulatedStage,
  type BoardSection,
} from "@/lib/crm/playbook";
import { SAMPLE_APPOINTMENTS, SAMPLE_LEADS, SAMPLE_TODAY } from "@/lib/crm/sample-leads";
import { scoreLead, sourceQualityIndex, type LeadScore } from "@/lib/crm/scoring";
import type {
  ContactLogEntry,
  Lead,
  LeadAppointment,
  LeadEvent,
  StageKey,
  ViewKey,
} from "@/lib/crm/types";

/**
 * The tracker's shared state.
 *
 * Every CRM piece — a KPI tile, the filter bar, a chart — reads this instead of
 * being handed props by a parent component. That is what lets Plasmic treat
 * each piece as a free-standing element a designer can move, delete or drop
 * anywhere: nothing needs a specific parent to pass it data.
 *
 * Reads and writes are separated. Anything that changes the view goes through
 * `apply`, which owns the one decision the URL used to make implicitly: inside
 * the Plasmic canvas there is no route to navigate, so state stays local and
 * the controls still work; in the real app it is mirrored into the query
 * string exactly as before, so a filtered screen is still a shareable link.
 */
export type TrackerValue = {
  /** Every lead the tracker was given, before filtering. */
  allLeads: Lead[];
  /** The filtered, sorted list every view renders. */
  visible: Lead[];
  /**
   * One page of `visible`, for the table.
   *
   * Deliberately separate rather than replacing `visible`: the charts, the
   * queue and the KPI tiles all aggregate over the whole filtered set, and a
   * dashboard whose numbers changed when somebody turned a page would be
   * lying. Only the table reads this.
   */
  paged: Page<Lead>;
  /** The lead the detail panel is open on, if any. */
  selected: Lead | null;
  /** Every appointment the tracker was given, across all leads. */
  appointments: LeadAppointment[];
  /** One lead's appointments, newest first. Never null — an empty list is the answer. */
  appointmentsFor: (leadId: string) => LeadAppointment[];
  /** One lead's history, newest first. Empty when 0006 has not been applied. */
  eventsFor: (leadId: string) => LeadEvent[];
  /**
   * Every recorded interaction with a lead the current filters let through,
   * newest first. Derived from the same events the timeline uses.
   */
  contactLog: ContactLogEntry[];
  stats: Summary;
  sources: SourceStat[];

  // -------------------------------------------------------------------------
  // The decision layer. Everything above says what the book contains; these
  // say what to do about it.
  // -------------------------------------------------------------------------

  /** Every visible open lead, classified into a play and ranked by money. */
  queue: QueueItem[];
  /** The same, grouped for rendering and narrowed by the `play` filter. */
  queueGroups: PlayGroup[];
  /**
   * The action board: every visible lead in exactly one stage section.
   *
   * All six sections are always present, empty ones included, because the tab
   * strip has to be able to say "MQL 0" — a tab that vanished when its pile
   * cleared would make the board's shape change under the reader.
   */
  board: BoardSection[];
  /** The section actually on screen, after resolving an unset or empty `at`. */
  boardStage: StageKey;
  /** How much work is outstanding, and how much of it is qualified. */
  outstanding: { count: number; qualified: number };
  /** Ranked findings about the book, most severe first. */
  insights: Insight[];
  /** The one-line verdict for a chart, over the same filtered set it renders. */
  insightFor: (chart: ChartKey) => string | null;
  /** One lead's score, with the factors behind it. Null for a lead not shown. */
  scoreFor: (leadId: string) => LeadScore | null;
  /** Who is looking, for signing outreach off. Falls back to the business name. */
  viewer: { name: string | null; companyName: string };
  /** The follow-up drafts, as the Content Management page has them. */
  outreachTemplates: OutreachTemplates;

  query: TrackerQuery;
  view: ViewKey;
  today: string;
  /** Stage and source render as badges rather than controls. */
  readOnly: boolean;
  /** These rows are the bundled samples, so writes have nowhere real to go. */
  isSample: boolean;
  params: URLSearchParams;
  filtered: boolean;
  flash: StageActionResult | null;
  setFlash: (result: StageActionResult | null) => void;
  /** The search box's uncommitted text, so Apply can live in a separate element. */
  searchDraft: string;
  setSearchDraft: (value: string) => void;
  applySearch: () => void;
  hrefFor: (overrides: Record<string, string | null>) => string;
  apply: (overrides: Record<string, string | null>) => void;
  toggle: (key: string, value: string, extra?: Record<string, string | null>) => void;
  toggleHrefFor: (
    key: string,
    value: string,
    extra?: Record<string, string | null>,
  ) => string;
};

const TrackerContext = createContext<TrackerValue | null>(null);

export type TrackerOptions = {
  leads?: Lead[];
  /**
   * The bookings behind those leads.
   *
   * Handed over with the book rather than fetched when a card opens: the
   * tracker already does every filter and aggregate in the browser, so one
   * more small array costs a great deal less than a round-trip per click.
   */
  appointments?: LeadAppointment[];
  today?: string;
  defaultView?: ViewKey;
  readOnly?: boolean;
  /** The lead histories behind the timeline. Optional — the card degrades to none. */
  events?: LeadEvent[];
  /**
   * Unanswered chat questions, for the knowledge-gap finding.
   *
   * Passed in rather than read here because `chat_questions` is a server-side
   * table and this is a client component. Absent means the finding is simply
   * not produced — which is right, since "we did not look" and "there are none"
   * must not render as the same conclusion.
   */
  kbGaps?: { total: number; topTheme: string | null };
  /**
   * Who is looking at this, and what the business is called.
   *
   * Only the outreach drafts use these, to sign a follow-up off with a real
   * name rather than with the company alone. Both are read on the server and
   * passed down; the company name is admin-editable, so hardcoding it would put
   * a stale name in a message going out to a customer.
   */
  viewer?: { name: string | null; companyName: string };
  /**
   * The editable follow-up drafts.
   *
   * Read on the server and passed down, like `viewer`. Absent on a
   * Plasmic-authored tracker, which has no server component above it — the
   * shipped drafts are the right fallback there.
   */
  outreachTemplates?: OutreachTemplates;
  /**
   * With no `leads` prop, read the book from `/api/crm/leads` in the browser.
   *
   * This is what a Plasmic-authored page needs: the tracker is assembled in
   * Studio with no server component above it to do the reading, so without
   * this it would show the seed rows. Never runs in the Studio canvas, where
   * there is no session and the samples are the point.
   */
  autoLoad?: boolean;
};

/** Nothing to compute for a dormant instance; every aggregate handles it. */
const NO_LEADS: Lead[] = [];

/** Shared so "this lead has no appointments" is one stable reference, not a new []. */
const NO_APPOINTMENTS: LeadAppointment[] = [];

/** Used when no page supplied a viewer — the Studio canvas, a bare render. */
const ANONYMOUS_VIEWER = { name: null, companyName: "DocuJet" };

/** Query keys that change which leads the list holds, and so reset the page. */
const FILTER_KEYS = ["q", "stage", "source", "group", "sort", "dir"];

/** Same, for a lead with no recorded history. */
const NO_EVENTS: LeadEvent[] = [];

function useTrackerState(options: TrackerOptions, dormant = false): TrackerValue {
  const {
    leads,
    appointments,
    defaultView = "table",
    readOnly = false,
    autoLoad = false,
  } = options;

  const searchParams = useSearchParams();
  const inCanvas = Boolean(usePlasmicCanvasContext());

  const [localQuery, setLocalQuery] = useState(() => searchParams?.toString() ?? "");
  const [flash, setFlash] = useState<StageActionResult | null>(null);
  const [searchDraft, setSearchDraft] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{
    leads: Lead[];
    appointments: LeadAppointment[];
    events: LeadEvent[];
    today: string;
  } | null>(null);

  const shouldLoad = autoLoad && leads === undefined && !inCanvas && !dormant;
  useEffect(() => {
    if (!shouldLoad) return;
    let cancelled = false;

    fetch("/api/crm/leads")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data || !Array.isArray(data.leads)) return;
        setLoaded({
          leads: data.leads as Lead[],
          // Absent or failed reads both arrive as null; either way the cards
          // show no bookings rather than the samples, which would be a lie
          // sitting next to real leads.
          appointments: Array.isArray(data.appointments)
            ? (data.appointments as LeadAppointment[])
            : [],
          events: Array.isArray(data.events) ? (data.events as LeadEvent[]) : [],
          today: data.today ?? SAMPLE_TODAY,
        });
      })
      // A failed read leaves the seed rows in place, which is what the page
      // already shows when the database is not connected.
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [shouldLoad]);

  const book = leads ?? loaded?.leads;
  const today = options.today ?? loaded?.today ?? SAMPLE_TODAY;

  // No rows from anywhere means nobody read the database — the Plasmic canvas,
  // or a bare render — so these are the bundled samples. It gates the *write*,
  // not the look: `readOnly` still decides badge-or-control, while `isSample`
  // stops a control calling a Server Action against rows no database holds.
  const isSample = book === undefined;
  const allLeads = dormant ? NO_LEADS : book ?? SAMPLE_LEADS;

  // The samples only stand in when the *book* is sampled too. A real lead with
  // a fabricated appointment against it would be worse than showing none.
  const booked = dormant
    ? NO_APPOINTMENTS
    : appointments ?? loaded?.appointments ?? (isSample ? SAMPLE_APPOINTMENTS : NO_APPOINTMENTS);

  // No sample fallback: the seed book carries no invented history, so a lead
  // card in the canvas shows an empty timeline rather than a fictional one.
  const history = dormant ? NO_EVENTS : options.events ?? loaded?.events ?? NO_EVENTS;

  // In the canvas there is no route to own the state, so the component owns it.
  // Everywhere else the URL stays the single source of truth.
  const search = inCanvas ? localQuery : searchParams?.toString() ?? "";
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const query = useMemo(() => parseQuery(params), [params]);
  const view = params.get("view") ? query.view : defaultView;

  // Grouped once rather than filtered per card: the detail panel re-renders on
  // every keystroke in an editable cell, and this keeps that free.
  const appointmentsByLead = useMemo(() => {
    const map = new Map<string, LeadAppointment[]>();
    for (const appointment of booked) {
      const list = map.get(appointment.leadId);
      if (list) list.push(appointment);
      else map.set(appointment.leadId, [appointment]);
    }
    return map;
  }, [booked]);

  const appointmentsFor = useCallback(
    (leadId: string) => appointmentsByLead.get(leadId) ?? NO_APPOINTMENTS,
    [appointmentsByLead],
  );

  const eventsByLead = useMemo(() => {
    const map = new Map<string, LeadEvent[]>();
    for (const event of history) {
      const list = map.get(event.leadId);
      if (list) list.push(event);
      else map.set(event.leadId, [event]);
    }
    return map;
  }, [history]);

  const eventsFor = useCallback(
    (leadId: string) => eventsByLead.get(leadId) ?? NO_EVENTS,
    [eventsByLead],
  );

  // -------------------------------------------------------------------------
  // The derivation chain, in the one order that works
  //
  // Scores depend on how each source has historically performed, which depends
  // on the filtered set, which is why filtering is separated from sorting here:
  // the score column cannot be sorted on until the scores exist, and they
  // cannot exist until the set they are measured against is known.
  // -------------------------------------------------------------------------

  const matching = useMemo(
    () => filterLeads(allLeads, query.filters),
    [allLeads, query.filters],
  );

  const stats = useMemo(() => summarise(matching, today), [matching, today]);
  const sources = useMemo(() => sourceStats(matching), [matching]);

  const scoreContext = useMemo(
    () => ({
      today,
      appointmentsFor,
      sourceQuality: sourceQualityIndex(sources, stats.qualifiedRate),
    }),
    [today, appointmentsFor, sources, stats.qualifiedRate],
  );

  const scores = useMemo(() => {
    const map = new Map<string, LeadScore>();
    for (const lead of matching) map.set(lead.id, scoreLead(lead, scoreContext));
    return map;
  }, [matching, scoreContext]);

  const scoreFor = useCallback((leadId: string) => scores.get(leadId) ?? null, [scores]);

  const visible = useMemo(() => {
    const totals = new Map<string, number>();
    for (const [id, score] of scores) totals.set(id, score.total);
    return sortLeads(matching, query.sort, query.dir, { scores: totals });
  }, [matching, query.sort, query.dir, scores]);

  const paged = useMemo(
    () => paginate(visible, query.page, query.perPage),
    [visible, query.page, query.perPage],
  );

  const queue = useMemo(
    () => buildQueue(visible, scoreContext),
    [visible, scoreContext],
  );

  const queueGroups = useMemo(() => {
    const groups = groupQueue(queue);
    return query.play === "" ? groups : groups.filter((group) => group.key === query.play);
  }, [queue, query.play]);

  const outstanding = useMemo(() => actionSummary(queue), [queue]);

  // Built from `visible`, so the board obeys the filter bar exactly as the
  // table does — narrowing to a source narrows every section at once.
  const board = useMemo(
    () => buildBoard(visible, scoreContext, query.order, query.play),
    [visible, scoreContext, query.order, query.play],
  );

  // An `at` naming a section that is currently empty is honoured rather than
  // corrected: the reader asked for that pile, and silently redirecting them to
  // a different stage would be a worse answer than an empty one that says so.
  const boardStage = query.at === "" ? firstPopulatedStage(board) : query.at;

  const kbGaps = options.kbGaps;
  const insights = useMemo(
    () => buildInsights(matching, { today, stats, kbGaps }),
    [matching, today, stats, kbGaps],
  );

  // Over `matching` rather than `visible`: the log has its own newest-first
  // order, and inheriting the table's sort would scramble a chronology.
  const contactLog = useMemo(
    () => buildContactLog(matching, history),
    [matching, history],
  );

  // Computed per call rather than for all thirteen charts up front: only the
  // charts view mounts them, and a filter change would otherwise recompute
  // twelve verdicts nobody is looking at.
  const insightFor = useCallback(
    (chart: ChartKey) =>
      chartInsight(chart, { leads: matching, stats, sources, today }),
    [matching, stats, sources, today],
  );

  const selected = findLead(allLeads, query.leadId);

  const hrefFor = useCallback(
    (overrides: Record<string, string | null>) => buildHref(params, overrides),
    [params],
  );

  const apply = useCallback(
    (overrides: Record<string, string | null>) => {
      // Any change to what the list contains sends the table back to page one.
      // Page 3 of one filtered set is a different ten leads from page 3 of
      // another, so keeping the number would land the reader somewhere they did
      // not ask to be — and `paginate` only rescues the case where the page no
      // longer exists at all, not this one.
      const narrows = FILTER_KEYS.some((key) => key in overrides);
      const next = narrows ? { ...overrides, page: null } : overrides;

      const href = buildHref(params, next);
      setLocalQuery(href === "?" ? "" : href.slice(1));

      // ---------------------------------------------------------------------
      // The native History API, not `router.replace`.
      //
      // Every control on this page — the view toggle, the six stage tabs, the
      // filters, the sort, opening a lead card — goes through here. Routing
      // each one meant a server round-trip per click, and on /admin/leads that
      // round-trip re-ran four Supabase reads to hand back a byte-identical
      // book: the tracker already holds every lead and does all its filtering,
      // sorting and grouping in the browser. The request could not change what
      // was rendered. It could only delay it.
      //
      // `pushState`/`replaceState` are integrated with the App Router, so
      // `useSearchParams` still updates and the back button still behaves —
      // the URL stays the single source of truth, it just stops being a
      // question we ask the server. `replaceState` rather than `pushState`
      // preserves the old behaviour exactly: these controls never stacked
      // history entries, so Back has always left the page rather than walking
      // back through filter changes.
      // ---------------------------------------------------------------------
      if (!inCanvas && typeof window !== "undefined") {
        window.history.replaceState(null, "", href);
      }
    },
    [params, inCanvas],
  );

  const toggleHrefFor = useCallback(
    (key: string, value: string, extra: Record<string, string | null> = {}) =>
      hrefFor({ [key]: params.get(key) === value ? null : value, ...extra }),
    [hrefFor, params],
  );

  const toggle = useCallback(
    (key: string, value: string, extra: Record<string, string | null> = {}) =>
      apply({ [key]: params.get(key) === value ? null : value, ...extra }),
    [apply, params],
  );

  const draft = searchDraft ?? query.filters.q;
  const applySearch = useCallback(() => {
    apply({ q: (searchDraft ?? "").trim(), lead: null });
    setSearchDraft(null);
  }, [apply, searchDraft]);

  return {
    allLeads,
    visible,
    paged,
    selected,
    appointments: booked,
    appointmentsFor,
    eventsFor,
    contactLog,
    stats,
    sources,
    queue,
    queueGroups,
    board,
    boardStage,
    outstanding,
    insights,
    insightFor,
    scoreFor,
    viewer: options.viewer ?? ANONYMOUS_VIEWER,
    outreachTemplates: options.outreachTemplates ?? DEFAULT_OUTREACH_TEMPLATES,
    query,
    view,
    today,
    readOnly,
    isSample,
    params,
    filtered: isFiltered(query.filters),
    flash,
    setFlash,
    searchDraft: draft,
    setSearchDraft,
    applySearch,
    hrefFor,
    apply,
    toggle,
    toggleHrefFor,
  };
}

/** Sample-backed state for a piece dropped on its own, with no tracker above it. */
const STANDALONE: TrackerOptions = {};

/**
 * Read the tracker.
 *
 * A piece with no tracker above it still gets a working one over the seed
 * rows, so a designer can drag a single chart or the filter bar onto a blank
 * artboard and have it render and respond. Both hooks always run — the unused
 * one is dormant and computes over no leads.
 */
export function useLeadTracker(): TrackerValue {
  const provided = useContext(TrackerContext);
  const standalone = useTrackerState(STANDALONE, provided !== null);
  return provided ?? standalone;
}

export function LeadTrackerProvider({
  children,
  ...options
}: TrackerOptions & { children: ReactNode }) {
  const value = useTrackerState(options);
  return <TrackerContext.Provider value={value}>{children}</TrackerContext.Provider>;
}

/**
 * A link that changes the tracker.
 *
 * A real anchor, so the destination is copyable and a modified click still
 * opens a new tab, but a plain click is handled in place — which is what makes
 * these controls live inside the Plasmic canvas, where a navigation would
 * either go nowhere or take the whole editor with it.
 */
export function TrackerLink({
  overrides,
  scrollTo,
  className,
  style,
  title,
  current,
  children,
}: {
  overrides: Record<string, string | null>;
  /** Element id to bring into view after the click. */
  scrollTo?: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
  current?: "page" | "true";
  children: ReactNode;
}) {
  const { hrefFor, apply } = useLeadTracker();
  const href = `${hrefFor(overrides)}${scrollTo ? `#${scrollTo}` : ""}`;

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    apply(overrides);
    if (scrollTo) {
      requestAnimationFrame(() => {
        document
          .getElementById(scrollTo)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  return (
    <a
      href={href}
      onClick={onClick}
      title={title}
      aria-current={current}
      className={className}
      style={style}
    >
      {children}
    </a>
  );
}
