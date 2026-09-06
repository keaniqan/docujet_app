import type { Metadata } from "next";
import ChatConfigForm from "@/components/admin/ChatConfigForm";
import DemoNotice from "@/components/admin/DemoNotice";
import KnowledgeGaps from "@/components/admin/KnowledgeGaps";
import KnowledgeManager from "@/components/admin/KnowledgeManager";
import { getKnowledgeGaps, type KnowledgeGap } from "@/lib/chat/capture";
import { fetchKnowledgeEntries, type KnowledgeEntry } from "@/lib/chat/knowledge";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import { toSafeSettingsView } from "@/lib/settings/mask";
import { resolveEnvReport } from "@/lib/settings/resolve";
import { getSettings, isSettingsConfigured } from "@/lib/settings/store";

export const metadata: Metadata = {
  title: "Chatbot Config",
};

// Settings can change between requests (another superadmin session, a direct
// edit in the Supabase table editor), so this page is always request-time
// fresh — same reasoning as admin/leads/page.tsx.
export const dynamic = "force-dynamic";

export default async function ChatbotConfigPage() {
  let notice: string | null = null;

  if (!isSettingsConfigured()) {
    notice =
      "No Supabase project is configured — SUPABASE_URL and SUPABASE_SECRET_KEY are not set " +
      "in .env.";
  }

  // getSettings() already falls back to DEFAULT_SETTINGS with no network call
  // when unconfigured, so a throw here only happens when Supabase IS configured
  // but unreachable — fall back to defaults so the form still renders rather
  // than the whole page failing.
  let settings = DEFAULT_SETTINGS;
  try {
    settings = await getSettings();
  } catch (cause) {
    notice = cause instanceof Error ? cause.message : "Could not read settings.";
  }

  const safeSettings = toSafeSettingsView(settings);
  const model = (await resolveEnvReport()).DEEPSEEK_MODEL;

  // The knowledge base is read separately and allowed to fail on its own. It
  // shares a database with settings but not a fate: an unapplied migration or a
  // dropped connection should cost this one table, not the page.
  let knowledgeEntries: KnowledgeEntry[] = [];
  let knowledgeNotice: string | null = null;

  try {
    knowledgeEntries = await fetchKnowledgeEntries();
  } catch (cause) {
    knowledgeNotice =
      cause instanceof Error ? cause.message : "Could not read the knowledge base.";
  }

  // Same posture again: the gap report is worth having and not worth the page
  // for. `getKnowledgeGaps` returns its own error rather than throwing, so an
  // unapplied 0006 costs this one panel.
  let gaps: KnowledgeGap[] = [];
  let gapTotal = 0;
  let gapNotice: string | null = null;

  try {
    const report = await getKnowledgeGaps();
    gaps = report.gaps;
    gapTotal = report.total;
    gapNotice = report.error;
  } catch (cause) {
    gapNotice =
      cause instanceof Error ? cause.message : "Could not read the unanswered questions.";
  }

  return (
    <div className="space-y-6 p-5 md:p-8">
      {notice ? (
        <DemoNotice
          title="Showing default values — the database is not connected."
          reason={notice}
        >
          Nothing you edit here will be saved until Supabase is set up. Apply{" "}
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

      <ChatConfigForm
        chat={safeSettings.chat}
        model={model}
        defaultSystemPrompt={DEFAULT_SETTINGS.chat.systemPrompt}
      />

      <KnowledgeManager entries={knowledgeEntries} notice={knowledgeNotice} />

      {/* Directly under the editor, because reading this list and acting on it
          are the same task: every row here is an entry somebody should add
          above. */}
      <KnowledgeGaps gaps={gaps} total={gapTotal} notice={gapNotice} />
    </div>
  );
}
