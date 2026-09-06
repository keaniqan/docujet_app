import { redirect } from "next/navigation";
import { createClient } from "./server";

export type StaffRole = "admin" | "superadmin";

export type StaffProfile = {
  id: string;
  full_name: string;
  role: StaffRole;
  is_active: boolean;
};

export async function getCurrentStaffProfile(): Promise<StaffProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data || !data.is_active) return null;
  return data as StaffProfile;
}

export async function requireSuperadmin() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "superadmin") {
    redirect("/admin");
  }
  return profile;
}

export async function isCurrentUserSuperadmin() {
  const profile = await getCurrentStaffProfile();
  return Boolean(profile?.role === "superadmin");
}

/**
 * `requireSuperadmin()` for Server Actions.
 *
 * The difference is the failure mode, and it matters: `redirect()` is a control-
 * flow throw React unwinds into a navigation, which is right for a page and
 * wrong for an action whose caller is waiting on `{ ok, message }`. This throws
 * an ordinary Error the action can catch and report next to the control the
 * admin just touched.
 *
 * Every settings, chatbot and content write goes through this. Server Actions
 * are POST endpoints addressable by action id, independent of `src/proxy.ts`'s
 * matcher — the route guard does not cover them, and everything behind them
 * writes with the RLS-bypassing service client.
 */
export async function assertSuperadmin(message: string): Promise<StaffProfile> {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "superadmin") {
    throw new Error(message);
  }
  return profile;
}
