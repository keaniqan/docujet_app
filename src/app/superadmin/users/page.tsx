import type { Metadata } from "next";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminShell from "@/components/admin/AdminShell";
import DemoNotice from "@/components/admin/DemoNotice";
import { superadminNavItems } from "@/lib/admin-mock-data";
import { getSuperadminUsers, type SuperadminUser } from "@/lib/superadmin";
import { isSupabaseConfigured } from "@/lib/supabase/service";
import UserManager from "./UserManager";
import { requireSuperadmin } from "@/lib/supabase/authorization";

export const metadata: Metadata = { title: "Staff Accounts" };
export const dynamic = "force-dynamic";

export default async function SuperadminUsersPage() {
  const actor = await requireSuperadmin();
  let users: SuperadminUser[] = [];
  let error: string | null = null;
  if (isSupabaseConfigured()) {
    try { users = await getSuperadminUsers(); } catch (cause) { error = cause instanceof Error ? cause.message : "Could not load staff accounts."; }
  } else {
    error = "SUPABASE_SECRET_KEY is not configured on the server.";
  }

  return <AdminShell navItems={superadminNavItems} brand="DocuJet Staff workspace" brandHref="/superadmin" tagline="System administration">
    <AdminHeader title="Staff accounts" description="Create, activate, deactivate, and delete staff accounts." eyebrow="DocuJet Superadmin" />
    <div className="space-y-6 p-5 md:p-8">
      {error ? <DemoNotice title="Staff management needs database setup." reason={error}>Apply <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">0002_staff_roles_and_audit.sql</code> and configure the server secret.</DemoNotice> : null}
      <UserManager users={users} currentUserId={actor.id} />
    </div>
  </AdminShell>;
}
