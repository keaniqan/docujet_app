import type { Metadata } from "next";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminShell from "@/components/admin/AdminShell";
import SettingsTabs from "@/components/admin/SettingsTabs";
import { superadminNavItems } from "@/lib/admin-mock-data";

export const metadata: Metadata = {
  title: {
    default: "Settings",
    template: "%s | DocuJet Superadmin",
  },
};

/**
 * The frame the three settings sections share.
 *
 * No guard of its own: `src/app/superadmin/layout.tsx` above this already
 * awaits `requireSuperadmin()`, and `src/proxy.ts` turns a non-superadmin away
 * from `/superadmin/*` before a page renders at all. The writes are guarded
 * separately inside the actions, which is the boundary that actually matters —
 * a Server Action is reachable by action id whatever the route matcher says.
 */
export default function SuperadminSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminShell
      navItems={superadminNavItems}
      brand="DocuJet Staff workspace"
      brandHref="/superadmin"
      tagline="System administration"
    >
      <AdminHeader
        title="Settings"
        description="Deployment configuration, the chat assistant, and the website's editable content."
        eyebrow="DocuJet Superadmin"
      />
      <SettingsTabs />
      {children}
    </AdminShell>
  );
}
