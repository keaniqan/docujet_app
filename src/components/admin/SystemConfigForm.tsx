"use client";

/**
 * Deployment credentials.
 *
 * One form posting to `updateSystemConfigAction`, imported directly rather than
 * threaded down as a prop — the same direct-import Server Action pattern the
 * rest of the admin uses.
 *
 * Two rules the UI has to keep visible, because getting either wrong is
 * expensive:
 *
 *   1. A secret input is always empty. Its placeholder is the last four
 *      characters of what is stored. Leaving it blank keeps the stored value;
 *      the server enforces the same thing, so this is a courtesy rather than
 *      the guarantee.
 *   2. The badge says where the live value comes from. "Database" means this
 *      form is winning; "Environment" means `.env` is, and clearing the field
 *      here hands control back to it. That distinction is the whole feature,
 *      and without the badge it is invisible.
 */

import { useState, useTransition } from "react";
import { Field, Panel, SaveRow, SecretField } from "./Fields";
import StatusBadge from "./StatusBadge";
import { inputClassName } from "./field-styles";
import {
  updateSystemConfigAction,
  type SettingsActionResult,
} from "@/lib/settings/actions";
import type { EnvSource, ManagedEnvKey } from "@/lib/settings/env";
import type { MaskedSecret } from "@/lib/settings/mask";

export type ManagedEnvView = {
  key: ManagedEnvKey;
  source: EnvSource;
  /** Present for a secret; the plain value is never sent for one. */
  masked?: MaskedSecret;
  /** Present for a non-secret. */
  value?: string;
};

export type ConnectionEnvView = {
  key: string;
  masked: MaskedSecret;
  /** Shown in full where it is not a credential — the project URL. */
  value?: string;
};

type SystemConfigFormProps = {
  managed: Record<ManagedEnvKey, ManagedEnvView>;
  connection: ConnectionEnvView[];
};

function SourceBadge({ source }: { source: EnvSource }) {
  if (source === "database") return <StatusBadge status="Database" />;
  if (source === "environment") return <StatusBadge status="Environment" />;
  return <StatusBadge status="Not configured" />;
}

const SOURCE_CAPTION: Record<EnvSource, string> = {
  database: "Saved here. Clear the field to fall back to the environment variable.",
  environment: "Coming from the server environment. Type a value here to override it.",
  unset: "Not set anywhere. This integration will refuse to run until it is.",
};

export default function SystemConfigForm({ managed, connection }: SystemConfigFormProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SettingsActionResult | null>(null);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      setResult(await updateSystemConfigAction(formData));
    });
  }

  function entry(key: ManagedEnvKey, label: string, caption?: string) {
    const view = managed[key];
    const help = (
      <>
        <code className="font-mono">{key}</code> — {caption ? `${caption} ` : ""}
        {SOURCE_CAPTION[view.source]}
      </>
    );

    if (view.masked) {
      return (
        <SecretField
          key={key}
          label={label}
          name={key}
          masked={view.masked}
          badge={<SourceBadge source={view.source} />}
          caption={help}
        />
      );
    }

    return (
      <Field
        key={key}
        label={
          <span className="flex flex-wrap items-center gap-2">
            {label}
            <SourceBadge source={view.source} />
          </span>
        }
        caption={help}
      >
        <input name={key} defaultValue={view.value ?? ""} className={inputClassName} />
      </Field>
    );
  }

  return (
    <form action={onSubmit} className="space-y-6">
      <Panel
        title="Database"
        description={
          <>
            Read-only, and deliberately so. Everything else on this page is stored{" "}
            <em>in</em> the database, so a value telling the app where the database is could only
            be found once it had already been found. Change these in the server environment and
            restart.
          </>
        }
      >
        <div className="space-y-3">
          {connection.map((item) => (
            <div
              key={item.key}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-mono text-xs font-semibold text-slate-900">{item.key}</p>
                <p className="mt-1 truncate font-mono text-xs text-slate-500">
                  {item.value ?? (item.masked.isSet ? item.masked.masked : "Not set")}
                </p>
              </div>
              <StatusBadge status={item.masked.isSet ? "Environment" : "Not configured"} />
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Chat assistant"
        description="The assistant's API credential. Which model it calls is a chatbot setting, and lives on the Chatbot Config tab."
      >
        <div className="space-y-4">{entry("DEEPSEEK_API_KEY", "DeepSeek API key")}</div>
      </Panel>

      <Panel
        title="Email (Brevo)"
        description="Sends the booking confirmation. The message itself is editable on the Content tab."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {entry("BREVO_API_KEY", "Brevo API key")}
          {entry("BREVO_SENDER_EMAIL", "Sender email")}
          {entry("BREVO_SENDER_NAME", "Sender name", "Falls back to DocuJet when blank.")}
        </div>
      </Panel>

      <Panel
        title="WhatsApp (Twilio)"
        description={
          <>
            Sends the booking confirmation over WhatsApp. The message text is a Twilio Content
            Template and lives in the Twilio console, not here — this is the SID that points at
            it.
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          {entry("WHATSAPP_ACCESS_TOKEN", "Meta access token")}
          {entry("WHATSAPP_PHONE_NUMBER_ID", "Phone number ID")}
          {entry("WHATSAPP_TEMPLATE_NAME", "Template name")}
          {entry("WHATSAPP_TEMPLATE_LANGUAGE", "Template language", "For example, en_US.")}
        </div>
      </Panel>

      <Panel
        title="Plasmic"
        description="Which Studio project the public pages are fetched from. A page Studio has nothing published for falls back to the version in this repository."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {entry("PLASMIC_PROJECT_ID", "Project ID")}
          {entry("PLASMIC_API_TOKEN", "API token")}
        </div>
      </Panel>

      <SaveRow isPending={isPending} result={result} label="Save system config" />
    </form>
  );
}
