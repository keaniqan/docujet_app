import { supabase } from "./supabase/service";

export type SuperadminUser = {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "superadmin" | "unassigned";
  isActive: boolean;
  lastSignInAt: string | null;
  createdAt: string;
};

export type AuditLog = {
  id: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
};

export async function getSuperadminUsers() {
  const client = supabase();
  const [{ data: authData, error: authError }, { data: profiles, error: profilesError }] =
    await Promise.all([
      client.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      client.from("user_profiles").select("id, full_name, role, is_active"),
    ]);

  if (authError) throw authError;
  if (profilesError) throw profilesError;

  const profileMap = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );

  return (authData.users ?? []).map((user): SuperadminUser => {
    const profile = profileMap.get(user.id);
    return {
      id: user.id,
      email: user.email ?? "No email",
      fullName: profile?.full_name || user.user_metadata?.full_name || "Unnamed staff",
      role: profile?.role ?? "unassigned",
      isActive: profile?.is_active ?? !user.banned_until,
      lastSignInAt: user.last_sign_in_at ?? null,
      createdAt: user.created_at,
    };
  });
}

export async function getAuditLogs() {
  const client = supabase();
  const { data, error } = await client
    .from("audit_logs")
    .select("id, actor_id, action, target_type, target_id, details, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  return (data ?? []).map(
    (log): AuditLog => ({
      id: log.id,
      actorId: log.actor_id,
      action: log.action,
      targetType: log.target_type,
      targetId: log.target_id,
      details: (log.details ?? {}) as Record<string, unknown>,
      createdAt: log.created_at,
    }),
  );
}

/**
 * Writes one row to `audit_logs`.
 *
 * Lifted out of `src/app/superadmin/actions.ts`, where it was local to staff
 * management, because settings and content edits are exactly the kind of change
 * that needs a name against it — the values a superadmin can now reach from
 * /superadmin/settings decide what the assistant says and where the site sends
 * its mail.
 *
 * Best-effort by design: a failed audit write must not undo the change it was
 * describing, and every caller has already succeeded by the time it runs. The
 * failure is logged so a silently unwritten log is still visible somewhere.
 *
 * `details` must never carry a secret's value. Log the key name.
 */
export async function recordAudit(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  details: Record<string, unknown> = {},
) {
  const { error } = await supabase().from("audit_logs").insert({
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    details,
  });

  if (error) {
    console.warn(`[audit] could not record ${action}:`, error.message);
  }
}
