"use server";

import { revalidatePath } from "next/cache";
import { assertSuperadmin } from "@/lib/supabase/authorization";
import { recordAudit } from "@/lib/superadmin";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/service";

export type SuperadminActionState = {
  error: string | null;
  success: string | null;
};

const initialState: SuperadminActionState = { error: null, success: null };

async function requireActionSuperadmin() {
  return assertSuperadmin("You are not authorized to manage staff accounts.");
}

export async function toggleStaffUserFromForm(formData: FormData): Promise<void> {
  await toggleStaffUser(undefined, formData);
}

export async function deleteStaffUser(
  _previousState: SuperadminActionState = initialState,
  formData: FormData,
): Promise<SuperadminActionState> {
  void _previousState;
  try {
    const actor = await requireActionSuperadmin();
    const userId = String(formData.get("user_id") ?? "").trim().toLowerCase();
    if (!userId) return { error: "Choose a staff account to delete.", success: null };
    if (userId === actor.id.toLowerCase()) return { error: "You cannot delete your own account.", success: null };
    if (formData.get("confirm_delete") !== "yes") {
      return { error: "Confirm that you want to permanently delete this staff account.", success: null };
    }
    if (!isSupabaseConfigured()) {
      return { error: "Staff management is not configured on the server.", success: null };
    }

    const client = supabase();
    const { data: profile, error: profileError } = await client
      .from("user_profiles").select("id, role").eq("id", userId).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || (profile.role !== "admin" && profile.role !== "superadmin")) {
      return { error: "This staff account no longer exists or has no staff role.", success: null };
    }

    // Delete Auth first: the profile cascades, while business records retain
    // their history through the existing ON DELETE SET NULL foreign keys.
    const { error } = await client.auth.admin.deleteUser(userId);
    if (error) throw error;
    await recordAudit(actor.id, "staff.deleted", "user", userId, { role: profile.role });
    revalidatePath("/superadmin/users");
    return { error: null, success: "Staff account permanently deleted." };
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : "Could not delete the staff account.", success: null };
  }
}

export async function createStaffUser(
  _previousState: SuperadminActionState = initialState,
  formData: FormData,
): Promise<SuperadminActionState> {
  void _previousState;
  try {
    if (!isSupabaseConfigured()) {
      return { error: "Add SUPABASE_SECRET_KEY to the server environment first.", success: null };
    }

    const actor = await requireActionSuperadmin();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const fullName = String(formData.get("full_name") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const role = String(formData.get("role") ?? "admin");

    if (!email || !email.includes("@")) return { error: "Enter a valid email address.", success: null };
    if (fullName.length < 2) return { error: "Enter the staff member's name.", success: null };
    if (password.length < 8) return { error: "The temporary password must be at least 8 characters.", success: null };
    if (role !== "admin" && role !== "superadmin") return { error: "Choose a valid role.", success: null };

    const client = supabase();
    const { data, error } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (error || !data.user) throw error ?? new Error("Could not create the staff account.");

    const { error: profileError } = await client.from("user_profiles").insert({
      id: data.user.id,
      full_name: fullName,
      role,
      is_active: true,
    });

    if (profileError) {
      await client.auth.admin.deleteUser(data.user.id);
      throw profileError;
    }

    await recordAudit(actor.id, "staff.created", "user", data.user.id, { email, role });
    revalidatePath("/superadmin/users");
    return { error: null, success: `Staff account created for ${email}.` };
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : "Could not create the staff account.", success: null };
  }
}

export async function toggleStaffUser(
  _previousState: SuperadminActionState = initialState,
  formData: FormData,
): Promise<SuperadminActionState> {
  void _previousState;
  try {
    if (!isSupabaseConfigured()) {
      return { error: "Add SUPABASE_SECRET_KEY to the server environment first.", success: null };
    }

    const actor = await requireActionSuperadmin();
    const userId = String(formData.get("user_id") ?? "");
    const nextActive = String(formData.get("next_active") ?? "") === "true";

    if (!userId || userId === actor.id) {
      return { error: "You cannot change your own account status here.", success: null };
    }

    const client = supabase();
    const { error: profileError } = await client
      .from("user_profiles")
      .update({ is_active: nextActive })
      .eq("id", userId);
    if (profileError) throw profileError;

    const { error: authError } = await client.auth.admin.updateUserById(userId, {
      ban_duration: nextActive ? "none" : "876000h",
    });
    if (authError) throw authError;

    await recordAudit(actor.id, nextActive ? "staff.activated" : "staff.deactivated", "user", userId);
    revalidatePath("/superadmin/users");
    return { error: null, success: nextActive ? "Staff account activated." : "Staff account deactivated." };
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : "Could not update the staff account.", success: null };
  }
}
