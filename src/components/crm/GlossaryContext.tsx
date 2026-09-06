"use client";

/**
 * Editable tooltip copy, without threading it through thirty components.
 *
 * `Explain` and `ExplainOn` appear on KPI tiles, queue rows, chart cards, score
 * breakdowns and stage badges — around twenty call sites, each naming a term by
 * key. Passing overrides down as props would mean touching every one of them
 * and every component in between, to deliver a value none of the intermediates
 * care about. A context is what that shape is for.
 *
 * The default is the shipped glossary, so a tooltip rendered outside any
 * provider — the Plasmic canvas, a bare render — still explains itself. An
 * override is merged field by field over the shipped entry rather than
 * replacing it: an admin who rewrites `what` and leaves `why` alone should keep
 * the `why` that ships, including the ones that interpolate `STALL_DAYS`.
 */

import { createContext, useContext, useMemo } from "react";
import { explain, type GlossaryEntry } from "@/lib/crm/glossary";
import type { TooltipOverrides } from "@/lib/content/types";

const GlossaryContext = createContext<TooltipOverrides>({});

export function GlossaryProvider({
  overrides,
  children,
}: {
  overrides: TooltipOverrides;
  children: React.ReactNode;
}) {
  // Stable identity across renders of the layout above it, so every Explain
  // below does not re-run its lookup on an unrelated navigation.
  const value = useMemo(() => overrides, [overrides]);
  return <GlossaryContext.Provider value={value}>{children}</GlossaryContext.Provider>;
}

/** One term's explanation, with any stored override applied. Null when unknown. */
export function useGlossaryEntry(term: string): GlossaryEntry | null {
  const overrides = useContext(GlossaryContext);
  const shipped = explain(term);
  const override = overrides[term];

  if (!override) return shipped;

  return {
    term: shipped?.term ?? term,
    what: override.what,
    why: override.why ?? shipped?.why,
    how: override.how ?? shipped?.how,
  };
}
