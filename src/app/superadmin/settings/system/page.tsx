import type { Metadata } from "next";
import DemoNotice from "@/components/admin/DemoNotice";
import SystemConfigForm, {
  type ConnectionEnvView,
  type ManagedEnvView,
} from "@/components/admin/SystemConfigForm";
import {
  CONNECTION_ENV_KEYS,
  MANAGED_ENV_KEYS,
  isSecretEnvKey,
  type ManagedEnvKey,
} from "@/lib/settings/env";
import { maskSecret } from "@/lib/settings/mask";
import { connectionEnvReport, resolveEnvReport } from "@/lib/settings/resolve";
import { isSettingsConfigured } from "@/lib/settings/store";

export const metadata: Metadata = {
  title: "System Config",
};

// Credentials can change between requests — another superadmin session, a
// direct edit in the Supabase table editor — so this is always request-time
// fresh. Same reasoning as admin/leads/page.tsx.
export const dynamic = "force-dynamic";

/** The project URL is not a credential and is more useful shown in full. */
const SHOWN_IN_FULL = new Set<string>(["SUPABASE_URL"]);

export default async function SystemConfigPage() {
  const notice = isSettingsConfigured()
    ? null
    : "No Supabase project is configured — SUPABASE_URL and SUPABASE_SECRET_KEY are not set in .env.";

  // Neither read throws: resolveEnvReport() is backed by getSettingsSafe(), and
  // the connection report is process.env. A page about what is configured must
  // not be the one page that cannot render when nothing is.
  const report = await resolveEnvReport();
  const connectionValues = connectionEnvReport();

  // Secrets are masked here, in the server component, so the real value never
  // reaches the client bundle — the form only ever receives the last four
  // characters and whether anything is stored at all.
  const managed = Object.fromEntries(
    MANAGED_ENV_KEYS.map((key): [ManagedEnvKey, ManagedEnvView] => {
      const { value, source } = report[key];
      return [
        key,
        isSecretEnvKey(key)
          ? { key, source, masked: maskSecret(value) }
          : { key, source, value },
      ];
    }),
  ) as Record<ManagedEnvKey, ManagedEnvView>;

  const connection: ConnectionEnvView[] = CONNECTION_ENV_KEYS.map((key) => ({
    key,
    masked: maskSecret(connectionValues[key]),
    value: SHOWN_IN_FULL.has(key) ? connectionValues[key] || undefined : undefined,
  }));

  return (
    <div className="space-y-6 p-5 md:p-8">
      {notice ? (
        <DemoNotice
          title="Nothing saved here will persist — the database is not connected."
          reason={notice}
        >
          Every value below falls back to the server environment until Supabase is set up. Apply{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">
            supabase/migrations/0001_crm_leads_and_settings.sql
          </code>{" "}
          in the SQL Editor, then set{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">SUPABASE_URL</code> and{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">
            SUPABASE_SECRET_KEY
          </code>{" "}
          in <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">.env</code>.
        </DemoNotice>
      ) : null}

      <SystemConfigForm managed={managed} connection={connection} />
    </div>
  );
}
