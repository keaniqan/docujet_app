import type { Metadata } from "next";
import DemoNotice from "@/components/admin/DemoNotice";
import {
  BookingEmailEditor,
  CatalogEditor,
  ChatCaptureEditor,
  ContactEditor,
  LandingEditor,
  OutreachEditor,
  SocialEditor,
  TooltipsEditor,
} from "@/components/admin/cms/ContentEditors";
import { GLOSSARY, type GlossaryEntry } from "@/lib/crm/glossary";
import { DEFAULT_CONTENT } from "@/lib/content/defaults";
import { getContent, isContentConfigured } from "@/lib/content/store";
import type { SiteContent } from "@/lib/content/types";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import { resolveEnv } from "@/lib/settings/resolve";
import { getSettings } from "@/lib/settings/store";

export const metadata: Metadata = {
  title: "Content",
};

// Content can change between requests — another superadmin session, a direct
// edit in the Supabase table editor — so this is always request-time fresh.
export const dynamic = "force-dynamic";

/**
 * Every term the shipped glossary defines.
 *
 * Read on the server and passed down as three fields per entry rather than the
 * whole `GLOSSARY` module: the browser needs the key, the display name and a
 * one-line preview of what ships, and it does not need eight hundred lines of
 * prose to render a form that overrides some of it.
 */
const GLOSSARY_TERMS = Object.entries(GLOSSARY as Record<string, GlossaryEntry>)
  .map(([key, entry]) => ({ key, term: entry.term, what: entry.what }))
  .sort((a, b) => a.key.localeCompare(b.key));

export default async function ContentManagementPage() {
  let notice: string | null = null;

  if (!isContentConfigured()) {
    notice =
      "No Supabase project is configured — SUPABASE_URL and SUPABASE_SECRET_KEY are not set " +
      "in .env.";
  }

  // Both stores are read here, and both fall back rather than fail: this page
  // is where somebody goes to fix a wrong phone number, and it has to render
  // even when the thing it edits is unreachable.
  let content: SiteContent = DEFAULT_CONTENT;
  try {
    content = await getContent();
  } catch (cause) {
    notice = cause instanceof Error ? cause.message : "Could not read website content.";
  }

  let business = DEFAULT_SETTINGS.business;
  try {
    business = (await getSettings()).business;
  } catch (cause) {
    notice = cause instanceof Error ? cause.message : "Could not read contact details.";
  }

  // Shown read-only beside the booking email, so the WhatsApp side of the same
  // confirmation is not simply missing from a page about lead contact.
  const twilioContentSid = await resolveEnv("TWILIO_CONTENT_SID");

  return (
    <div className="space-y-6 p-5 md:p-8">
      {notice ? (
        <DemoNotice
          title="Showing the copy that ships — the database is not connected."
          reason={notice}
        >
          Nothing you edit here will be saved until Supabase is set up and{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">
            supabase/migrations/0010_site_content_and_system_config.sql
          </code>{" "}
          has been applied in the SQL Editor. Until then every public page renders the values in{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">src/</code>, which is
          exactly what visitors see today.
        </DemoNotice>
      ) : null}

      <ContactEditor business={business} />
      <SocialEditor social={content.social} />
      <LandingEditor landing={content.landing} />
      <CatalogEditor catalog={content.catalog} />
      <BookingEmailEditor
        bookingEmail={content.bookingEmail}
        twilioContentSid={twilioContentSid}
      />
      <ChatCaptureEditor chatCapture={content.chatCapture} />
      <OutreachEditor outreach={content.outreach} />
      <TooltipsEditor tooltips={content.tooltips} terms={GLOSSARY_TERMS} />
    </div>
  );
}
