import type { Metadata } from "next";
import { GlossaryProvider } from "@/components/crm/GlossaryContext";
import { getContentSafe } from "@/lib/content/store";

export const metadata: Metadata = {
  title: {
    default: "Admin",
    template: "%s | DocuJet Admin",
  },
  description: "Frontend admin interface for DocuJet staff and client administrators.",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Route protection happens in src/proxy.ts so protected pages never render
  // without a valid Supabase session.
  //
  // The glossary overrides are read here rather than per page because the CRM
  // tooltips appear on every one of them, and this is the one place above all
  // of them that can do a server read. `getContentSafe()` never throws, so an
  // unreachable content table costs the edits and not the workspace.
  const { tooltips } = await getContentSafe();

  return <GlossaryProvider overrides={tooltips}>{children}</GlossaryProvider>;
}
