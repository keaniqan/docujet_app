import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

// Execute the real Server Action with isolated service mocks. No live users
// are created or deleted, and authorization is exercised before service access.
const source = readFileSync(new URL("../app/superadmin/actions.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function harness(options: { unauthorized?: boolean; missingProfile?: boolean; deleteFails?: boolean } = {}) {
  const events: string[] = [];
  const exports: Record<string, (state: undefined, data: FormData) => Promise<{ error: string | null; success: string | null }>> = {};
  const client = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({
      data: options.missingProfile ? null : { id: "staff-id", role: "admin" }, error: null,
    }) }) }) }),
    auth: { admin: { deleteUser: async (id: string) => {
      events.push(`delete:${id}`);
      return { error: options.deleteFails ? new Error("Deletion failed") : null };
    } } },
  };
  const dependencies: Record<string, unknown> = {
    "next/cache": { revalidatePath: (path: string) => events.push(`refresh:${path}`) },
    "@/lib/supabase/authorization": { assertSuperadmin: async () => {
      events.push("authorize");
      if (options.unauthorized) throw new Error("Not authorized");
      return { id: "actor-id", role: "superadmin", is_active: true };
    } },
    "@/lib/superadmin": { recordAudit: async (actor: string, action: string, type: string, id: string) => events.push(`audit:${actor}:${action}:${type}:${id}`) },
    "@/lib/supabase/service": { isSupabaseConfigured: () => true, supabase: () => {
      events.push("service");
      return client;
    } },
  };
  runInNewContext(compiled, { exports, Error, require: (name: string) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  const submit = (id = "staff-id", confirmed = true) => {
    const form = new FormData();
    form.set("user_id", id);
    if (confirmed) form.set("confirm_delete", "yes");
    return exports.deleteStaffUser(undefined, form);
  };
  return { events, submit };
}

test("unauthorized callers cannot reach the privileged service", async () => {
  const h = harness({ unauthorized: true });
  assert.ok((await h.submit()).error);
  assert.deepEqual(h.events, ["authorize"]);
});

test("self-deletion and unconfirmed requests are blocked on the server", async () => {
  for (const [id, confirmed] of [["actor-id", true], ["ACTOR-ID", true], ["staff-id", false], ["", true]] as const) {
    const h = harness();
    assert.ok((await h.submit(id, confirmed)).error);
    assert.deepEqual(h.events, ["authorize"]);
  }
});

test("accounts without a staff profile cannot be deleted", async () => {
  const h = harness({ missingProfile: true });
  assert.ok((await h.submit()).error);
  assert.deepEqual(h.events, ["authorize", "service"]);
});

test("failed deletion returns an error without a success audit", async () => {
  const h = harness({ deleteFails: true });
  assert.ok((await h.submit()).error);
  assert.deepEqual(h.events, ["authorize", "service", "delete:staff-id"]);
});

test("confirmed deletion removes the chosen account, audits, and refreshes the list", async () => {
  const h = harness();
  const result = await h.submit();
  assert.equal(result.error, null);
  assert.ok(result.success);
  assert.deepEqual(h.events, ["authorize", "service", "delete:staff-id", "audit:actor-id:staff.deleted:user:staff-id", "refresh:/superadmin/users"]);
});
