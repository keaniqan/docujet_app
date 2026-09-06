type StatusBadgeProps = {
  status: string;
};

const statusStyles: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-800",
  Confirmed: "bg-sky-100 text-sky-800",
  Completed: "bg-emerald-100 text-emerald-800",
  Cancelled: "bg-rose-100 text-rose-800",
  New: "bg-violet-100 text-violet-800",
  Contacted: "bg-slate-200 text-slate-700",
  Qualified: "bg-cyan-100 text-cyan-800",
  Proposal: "bg-orange-100 text-orange-800",
  Won: "bg-emerald-100 text-emerald-800",
  // The lead lifecycle from src/lib/crm/taxonomy.ts. It is an ordered scale,
  // not a set of categories, so it wears a single-hue ordinal ramp: further
  // along reads as darker, exactly as STAGES encodes it.
  //
  // Lost deliberately leaves that ramp for grey. A lost lead has not
  // progressed past Customer, so the next darker blue would encode it as the
  // end of the progression — the one thing it is not — and losing leads is
  // normal, so it should recede rather than alarm.
  //
  // These replaced Active / Prospect / Needs Follow-up, the parallel
  // vocabulary that went away with the `customers` table.
  Lead: "bg-blue-50 text-blue-700",
  MQL: "bg-blue-100 text-blue-800",
  SQL: "bg-blue-200 text-blue-900",
  Opportunity: "bg-blue-300 text-blue-950",
  Customer: "bg-blue-800 text-blue-50",
  Lost: "bg-slate-200 text-slate-600",
  Draft: "bg-slate-200 text-slate-700",
  Disabled: "bg-rose-100 text-rose-800",
  "Not configured": "bg-slate-200 text-slate-700",
  // Where a System Config value's live copy actually came from. These replaced
  // "Saved on server" / "Saved in browser" / "From .env", which were left over
  // from an earlier settings implementation that kept local overrides in the
  // browser and had gone unused everywhere.
  Database: "bg-emerald-100 text-emerald-800",
  Environment: "bg-sky-100 text-sky-800",
  Planned: "bg-amber-100 text-amber-800",
  Connected: "bg-emerald-100 text-emerald-800",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[status] ?? "bg-slate-200 text-slate-700"}`}
    >
      {status}
    </span>
  );
}
