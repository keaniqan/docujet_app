"use client";

/**
 * The form primitives the three settings pages share.
 *
 * Lifted out of the bottom of the old `SettingsForm.tsx` when that one form
 * became three. Copying them into each would have been the shorter change and
 * the wrong one: a secret input that stops rendering its "leave blank to keep"
 * placeholder on one page only is a bug nobody notices until a live credential
 * is blanked.
 */

import { useState } from "react";
import StatusBadge from "./StatusBadge";
import { compactInputClassName, inputClassName, pillButtonClassName } from "./field-styles";

export function Field({
  label,
  caption,
  children,
}: {
  label: React.ReactNode;
  caption?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {caption ? <span className="mt-1 block text-xs text-slate-400">{caption}</span> : null}
    </label>
  );
}

/**
 * A credential input that never shows the credential.
 *
 * Renders empty with the masked tail as a placeholder, so submitting the form
 * untouched leaves the stored value alone — the server enforces the same rule
 * in `updateSystemConfigAction`, because a stale or replayed form must not be
 * able to blank a live key either.
 */
export function SecretField({
  label,
  name,
  masked,
  caption,
  badge,
}: {
  label: string;
  name: string;
  masked: { isSet: boolean; masked: string };
  caption?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <Field
      label={
        <span className="flex flex-wrap items-center gap-2">
          {label}
          {badge ?? <StatusBadge status={masked.isSet ? "Connected" : "Not configured"} />}
        </span>
      }
      caption={caption}
    >
      <input
        name={name}
        type="password"
        autoComplete="off"
        placeholder={masked.isSet ? masked.masked : "Not set"}
        className={inputClassName}
      />
    </Field>
  );
}

/** The card every settings and content section sits in. */
export function Panel({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Submit button plus the ok/error line beside it, in the shape every form here wants. */
export function SaveRow({
  isPending,
  result,
  label = "Save",
  children,
}: {
  isPending: boolean;
  result: { ok: boolean; message: string } | null;
  label?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-4">
      <button type="submit" disabled={isPending} className={pillButtonClassName}>
        {isPending ? "Saving…" : label}
      </button>
      {children}
      {result ? (
        <p className={`text-sm ${result.ok ? "text-emerald-700" : "text-rose-700"}`}>
          {result.message}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A variable-length list of single-line values.
 *
 * The add/remove pattern the chat suggestions list already used, generalised —
 * the CMS needs the same control for why-choose bullets and booking dropdown
 * options, and three copies of it would drift.
 */
export function RepeatableList({
  name,
  values,
  onChange,
  addLabel,
  placeholder,
}: {
  name: string;
  values: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="space-y-2">
        {values.map((value, index) => (
          <div key={index} className="flex gap-2">
            <input
              name={name}
              value={value}
              placeholder={placeholder}
              onChange={(event) =>
                onChange(values.map((item, i) => (i === index ? event.target.value : item)))
              }
              className={compactInputClassName}
            />
            <button
              type="button"
              onClick={() => onChange(values.filter((_, i) => i !== index))}
              disabled={values.length <= 1}
              className={pillButtonClassName}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...values, ""])}
        className={`${pillButtonClassName} mt-2`}
      >
        {addLabel}
      </button>
    </div>
  );
}

/**
 * A variable-length list of multi-field rows.
 *
 * The FAQ, the product cards, the benefit tiles, the social links and the
 * tooltip overrides are all the same control with different columns, so it is
 * written once. Rows render real named inputs — `faq.question`, `faq.answer` —
 * which is what lets the server action read them back as parallel arrays
 * without any client-side assembly, and what makes the form work at all if
 * JavaScript has not loaded yet.
 *
 * Removing a row is removing it from this state; there is no delete endpoint,
 * because the action replaces the whole block on save.
 */
export function RowRepeater<F extends string>({
  prefix,
  fields,
  initial,
  addLabel,
  rowLabel,
}: {
  prefix: string;
  fields: readonly {
    name: F;
    label: string;
    textarea?: boolean;
    rows?: number;
    placeholder?: string;
  }[];
  initial: Record<F, string>[];
  addLabel: string;
  /** Heads each row, e.g. "Question 2". Index is 1-based. */
  rowLabel?: (index: number) => string;
}) {
  const blank = Object.fromEntries(fields.map((field) => [field.name, ""])) as Record<F, string>;
  const [rows, setRows] = useState<Record<F, string>[]>(
    initial.length > 0 ? initial : [blank],
  );

  function update(index: number, name: F, value: string) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, [name]: value } : row)),
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((row, index) => (
        <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {rowLabel ? rowLabel(index + 1) : `Item ${index + 1}`}
            </span>
            <button
              type="button"
              onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
              disabled={rows.length <= 1}
              className={pillButtonClassName}
            >
              Remove
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {fields.map((field) => (
              <div
                key={field.name}
                className={field.textarea ? "md:col-span-2" : undefined}
              >
                <Field label={field.label}>
                  {field.textarea ? (
                    <textarea
                      name={`${prefix}.${field.name}`}
                      rows={field.rows ?? 3}
                      placeholder={field.placeholder}
                      value={row[field.name]}
                      onChange={(event) => update(index, field.name, event.target.value)}
                      className={inputClassName}
                    />
                  ) : (
                    <input
                      name={`${prefix}.${field.name}`}
                      placeholder={field.placeholder}
                      value={row[field.name]}
                      onChange={(event) => update(index, field.name, event.target.value)}
                      className={inputClassName}
                    />
                  )}
                </Field>
              </div>
            ))}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setRows((current) => [...current, blank])}
        className={pillButtonClassName}
      >
        {addLabel}
      </button>
    </div>
  );
}
