"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGlossaryEntry } from "./GlossaryContext";
import type { GlossaryEntry } from "@/lib/crm/glossary";
import type { ReactNode } from "react";

/**
 * The explainers.
 *
 * ---------------------------------------------------------------------------
 * Two triggers, because there are two kinds of thing to explain
 *
 * `Explain` is a small dot beside a word — for the vocabulary a reader has to
 * decode before the number next to it means anything: MQL, SQL, Reached SQL+,
 * Going cold. The dot is deliberately quiet until it is hovered, because on a
 * page with thirty of them anything louder becomes the texture of the page and
 * the reader stops seeing the words underneath.
 *
 * `ExplainOn` wraps something that already exists — a button, a badge, a
 * figure — and adds no mark at all. Buttons are the case that matters: "Log
 * contact" needs several sentences to justify itself and needs none of them on
 * screen, because the button is legible without them. Hovering the control you
 * are about to press is the natural way to ask what it does, and it costs the
 * layout nothing.
 * ---------------------------------------------------------------------------
 *
 * ---------------------------------------------------------------------------
 * Staying out of the way
 *
 * The whole feature is worthless if it interferes, so:
 *
 *   - The popover is portalled to `document.body`. Tooltips rendered in place
 *     get clipped by the table's horizontal scroller and buried under the lead
 *     card's backdrop; neither is recoverable with z-index alone.
 *   - The trigger is a `<span role="button">` rather than a `<button>`, because
 *     several of the things worth explaining — the KPI tiles, the pipeline
 *     tiles, the attention rows — are themselves links, and a button inside an
 *     anchor is invalid. Clicks are stopped and defaulted so pressing the dot
 *     never navigates, and never opens the lead card behind a table row.
 *   - Wrapped controls take a much longer hover delay than dots. A dot is only
 *     ever hovered on purpose; a button is hovered on the way to clicking it,
 *     and a tooltip that appears in that quarter-second is an obstacle.
 *   - Nothing here traps focus, blocks a click, or moves anything on the page.
 *     The popover takes the pointer only so that a reader can move onto a long
 *     explanation and finish it; it contains nothing to click.
 * ---------------------------------------------------------------------------
 */

/** How long the pointer must rest before the popover appears, by trigger kind. */
const OPEN_DELAY = { dot: 90, wrap: 450 } as const;

/**
 * How long it stays after the pointer leaves.
 *
 * Long enough to cross the gap between the trigger and the popover, so a reader
 * can move onto a three-sentence explanation and finish it.
 */
const CLOSE_DELAY = 160;

/** Distance between trigger and popover, and the margin kept from the viewport. */
const GAP = 8;
const EDGE = 12;
const WIDTH = 320;

type Placement = { top: number; left: number; side: "top" | "bottom" };

type PopoverProps = {
  id: string;
  entry: GlossaryEntry;
  /** This instance's own numbers, where the caller has any. See `detail` below. */
  detail?: string;
  anchor: DOMRect;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
};

/**
 * The panel itself.
 *
 * Positioned after it has been measured rather than guessed at: the height
 * depends on how much prose the entry carries, and flipping above the trigger
 * is only correct when we know how tall the thing being flipped is. It renders
 * hidden for one frame to do that, which is imperceptible and cheaper than
 * every alternative that avoids it.
 */
function Popover({ id, entry, detail, anchor, onPointerEnter, onPointerLeave }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const { width, height } = node.getBoundingClientRect();
    const fits = height + GAP + EDGE;
    const side = window.innerHeight - anchor.bottom < fits && anchor.top > fits ? "top" : "bottom";

    // Clamped, not just placed. The longest entries run to four hundred pixels,
    // which on a short window fits neither above the trigger nor below it — and
    // the unclamped answer is a panel whose last paragraph is off the bottom of
    // the screen. Sliding it back into view detaches it from its trigger by a
    // few pixels, which is the cheaper of the two problems by a wide margin.
    const preferred = side === "top" ? anchor.top - height - GAP : anchor.bottom + GAP;
    const top = Math.min(Math.max(preferred, EDGE), Math.max(EDGE, window.innerHeight - height - EDGE));

    const centred = anchor.left + anchor.width / 2 - width / 2;
    const left = Math.min(Math.max(centred, EDGE), Math.max(EDGE, window.innerWidth - width - EDGE));

    setPlacement({ top, left, side });
  }, [anchor]);

  return (
    <div
      ref={ref}
      id={id}
      role="tooltip"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      style={{
        position: "fixed",
        top: placement?.top ?? anchor.bottom + GAP,
        left: placement?.left ?? anchor.left,
        width: `min(${WIDTH}px, calc(100vw - ${EDGE * 2}px))`,
        // The backstop for a window too short to hold the entry at all, where
        // clamping alone still leaves prose past the bottom edge.
        maxHeight: `calc(100vh - ${EDGE * 2}px)`,
        // Hidden rather than unmounted for the measuring frame, so the text is
        // laid out at its real width and the height we measure is the truth.
        visibility: placement ? "visible" : "hidden",
      }}
      className="pointer-events-auto z-[100] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-3.5 text-left shadow-xl shadow-slate-900/20"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-300">{entry.term}</p>
      <p className="mt-1.5 text-[13px] leading-5 text-slate-100">{entry.what}</p>

      {detail ? (
        // The general explanation says what a score is; this says what *this*
        // score is made of. Set apart because it is the only line in the
        // popover that changes from one row to the next.
        <p className="mt-2 rounded-lg bg-slate-800 px-2.5 py-2 text-[13px] leading-5 text-sky-100">
          {detail}
        </p>
      ) : null}

      {entry.why ? (
        <p className="mt-2 text-[13px] leading-5 text-slate-300">
          <span className="font-semibold text-slate-200">Why it matters. </span>
          {entry.why}
        </p>
      ) : null}

      {entry.how ? (
        <p className="mt-2 border-t border-slate-700 pt-2 text-[13px] leading-5 text-slate-300">
          <span className="font-semibold text-slate-200">What to do. </span>
          {entry.how}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The open/close machinery, shared by both triggers.
 *
 * Returns the props a trigger spreads onto itself plus whatever portal needs
 * rendering, so `Explain` and `ExplainOn` differ only in what they look like.
 */
function useExplainer(entry: GlossaryEntry | null, delay: number, detail?: string) {
  const id = useId();
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A pending open must not fire after the trigger has gone — a table that
  // repages under a resting cursor would otherwise measure a detached node.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const open = useCallback(
    (after: number) => {
      cancel();
      timer.current = setTimeout(() => {
        const node = triggerRef.current;
        if (node) setAnchor(node.getBoundingClientRect());
      }, after);
    },
    [cancel],
  );

  const close = useCallback(
    (after: number) => {
      cancel();
      timer.current = setTimeout(() => setAnchor(null), after);
    },
    [cancel],
  );

  const isOpen = anchor !== null;

  // Escape dismisses, and any scroll or resize does too. Following the anchor
  // instead would be smoother in theory and jitter in practice — the popover is
  // transient, and a reader who scrolls has finished with it.
  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        cancel();
        setAnchor(null);
      }
    }
    function dismiss() {
      cancel();
      setAnchor(null);
    }

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [isOpen, cancel]);

  const triggerProps = {
    ref: triggerRef,
    "aria-describedby": isOpen ? id : undefined,
    onPointerEnter: (event: React.PointerEvent) => {
      // Touch reaches here as a pointerenter immediately followed by a click.
      // Letting the hover path run would open and then instantly toggle shut.
      if (event.pointerType === "touch") return;
      open(delay);
    },
    onPointerLeave: (event: React.PointerEvent) => {
      if (event.pointerType === "touch") return;
      close(CLOSE_DELAY);
    },
    // Focus and blur carry the keyboard, and capture is what makes `ExplainOn`
    // work: the focus lands on the button *inside* the wrapper, not on it.
    onFocusCapture: () => open(0),
    onBlurCapture: () => close(0),
  };

  // No `mounted` guard: `anchor` is only ever set from a pointer or focus
  // handler, so it is null through the server render and the first paint, and
  // `document` is certain to exist by the time this branch is taken.
  const portal =
    entry && anchor
      ? createPortal(
          <Popover
            id={id}
            entry={entry}
            detail={detail}
            anchor={anchor}
            onPointerEnter={cancel}
            onPointerLeave={() => close(CLOSE_DELAY)}
          />,
          document.body,
        )
      : null;

  return { isOpen, triggerProps, portal, toggle: () => (isOpen ? close(0) : open(0)) };
}

export type ExplainProps = {
  /** A key into the glossary, e.g. `stage.mql`. Unknown keys render nothing. */
  term: string;
  /**
   * This instance's own figures, in one line — "84 — Appointment booked +30,
   * Pipeline progress +19". Shown between the definition and the reasoning, so
   * a reader can check the general claim against the case in front of them.
   */
  detail?: string;
  /** Reads to a screen reader as "what is X". Falls back to the entry's own name. */
  label?: string;
  className?: string;
};

/**
 * A quiet info dot, for a term that needs decoding.
 *
 * Renders nothing at all when the key is not in the glossary, so a term can be
 * marked up before its copy has been written without putting an empty tooltip
 * on the page.
 */
export default function Explain({ term, detail, label, className = "" }: ExplainProps) {
  const entry = useGlossaryEntry(term);
  const { isOpen, triggerProps, portal, toggle } = useExplainer(entry, OPEN_DELAY.dot, detail);

  if (!entry) return null;

  return (
    <>
      <span
        {...triggerProps}
        role="button"
        tabIndex={0}
        aria-label={`What is ${label ?? entry.term}?`}
        aria-expanded={isOpen}
        data-explain=""
        onClick={(event) => {
          // The dot lives inside links and inside clickable table rows. Neither
          // should fire because somebody asked what a word means.
          event.preventDefault();
          event.stopPropagation();
          toggle();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          event.stopPropagation();
          toggle();
        }}
        className={`inline-flex h-[15px] w-[15px] shrink-0 cursor-help select-none items-center justify-center rounded-full border align-middle text-[10px] font-semibold leading-none transition ${
          isOpen
            ? "border-sky-700 bg-sky-700 text-white"
            : "border-slate-300 text-slate-400 hover:border-sky-700 hover:bg-sky-700 hover:text-white"
        } ${className}`}
      >
        i
      </span>
      {portal}
    </>
  );
}

export type ExplainOnProps = {
  /** A key into the glossary. An unknown key renders the children untouched. */
  term: string;
  /** This instance's own figures. See `ExplainProps.detail`. */
  detail?: string;
  children: ReactNode;
  /** Use `block` where the wrapper sits around a block-level child. */
  display?: "inline-flex" | "block";
  className?: string;
};

/**
 * Explains whatever it wraps, adding no mark of its own.
 *
 * For controls and badges that are already legible: the reader who wants more
 * hovers the thing itself, and the reader who does not sees an unchanged page.
 * `display` exists because this wraps both a chip in a flex row and a whole
 * button group, and neither can be given the other's box.
 */
export function ExplainOn({
  term,
  detail,
  children,
  display = "inline-flex",
  className = "",
}: ExplainOnProps) {
  const entry = useGlossaryEntry(term);
  const { triggerProps, portal } = useExplainer(entry, OPEN_DELAY.wrap, detail);

  if (!entry) return <>{children}</>;

  return (
    <>
      <span
        {...triggerProps}
        data-explain=""
        className={`${display === "block" ? "block" : "inline-flex items-center"} ${className}`}
      >
        {children}
      </span>
      {portal}
    </>
  );
}
