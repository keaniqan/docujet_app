"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    try {
      createClient().auth.getSession().then(({ data, error: sessionError }) => {
        if (!active) return;
        if (sessionError || !data.session) setError("This reset link is invalid or has expired. Request a new one.");
        setReady(Boolean(data.session) && !sessionError);
      }).catch(() => { if (active) setError("This reset link is invalid or has expired. Request a new one."); });
    } catch {
      setError("Supabase is not configured for password recovery.");
    }
    return () => { active = false; };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Your password must be at least 8 characters."); return; }
    if (password !== confirmation) { setError("The passwords do not match."); return; }
    setIsSaving(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) { setError(updateError.message); setIsSaving(false); return; }
      await supabase.auth.signOut();
      router.replace("/login?reset=success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update your password.");
      setIsSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-16">
      <section className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.35)] md:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-800">DocuJet</p>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">Choose a new password</h1>
        {ready ? <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-800" htmlFor="new-password">New password<input id="new-password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputClassName} /></label>
          <label className="block text-sm font-medium text-slate-800" htmlFor="confirm-password">Confirm password<input id="confirm-password" type="password" required minLength={8} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={inputClassName} /></label>
          {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900" role="alert">{error}</div>}
          <button type="submit" disabled={isSaving} className="inline-flex w-full items-center justify-center rounded-full bg-sky-800 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-900 disabled:opacity-60">{isSaving ? "Saving..." : "Update password"}</button>
        </form> : error ? <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900" role="alert">{error}</div> : <p className="mt-6 text-slate-600">Checking your reset link...</p>}
        {error && !ready && <Link href="/forgot-password" className="mt-6 inline-block text-sm font-medium text-sky-800 underline-offset-2 hover:underline">Request a new reset link</Link>}
      </section>
    </main>
  );
}

const inputClassName = "mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-700 focus:ring-4 focus:ring-sky-100";
