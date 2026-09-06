"use client";

/**
 * One content block, one card, one save button.
 *
 * Every editor on the Content page is the same shape — a panel, some fields,
 * and a Server Action that returns `{ ok, message }` — so the pending state and
 * the result line are written once here rather than eight times.
 *
 * Each block saves on its own. That is deliberate: the page is long, the blocks
 * are unrelated, and a single Save at the bottom would mean an admin fixing a
 * phone number also rewrites the FAQ with whatever the form happened to hold.
 */

import { useState, useTransition } from "react";
import { Panel, SaveRow } from "../Fields";
import { pillButtonClassName } from "../field-styles";

export type ActionResult = { ok: boolean; message: string };

export default function ActionForm({
  title,
  description,
  action,
  saveLabel = "Save",
  onReset,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  action: (formData: FormData) => Promise<ActionResult>;
  saveLabel?: string;
  /** Drops this block's overrides and puts the shipped copy back. */
  onReset?: () => Promise<ActionResult>;
  children: React.ReactNode;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <form
      action={(formData) =>
        startTransition(async () => setResult(await action(formData)))
      }
    >
      <Panel title={title} description={description}>
        {children}
        <SaveRow isPending={isPending} result={result} label={saveLabel}>
          {onReset ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const outcome = await onReset();
                  setResult(outcome);
                  // The inputs are uncontrolled, so re-rendering the server
                  // component does not put the restored text back into them —
                  // only a reload does. On failure it stays put, because
                  // reloading would take the error message away with it.
                  if (outcome.ok) window.location.reload();
                })
              }
              className={pillButtonClassName}
            >
              Restore shipped copy
            </button>
          ) : null}
        </SaveRow>
      </Panel>
    </form>
  );
}
