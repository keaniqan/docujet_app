"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSending(true);
    setMessage(null);
    setError(null);

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      if (resetError) throw resetError;
      setMessage("If an account exists for that email, we sent a password reset link.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send the reset email.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-16">
      <section className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.35)] md:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-800">DocuJet</p>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">Reset your password</h1>
        <p className="mt-3 leading-7 text-slate-600">Enter your staff email and we’ll send you a secure link to choose a new password.</p>
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-800" htmlFor="reset-email">
            Email address
            <input id="reset-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClassName} placeholder="name@company.com" />
          </label>
          {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900" role="alert">{error}</div>}
          {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">{message}</div>}
          <button type="submit" disabled={isSending} className="inline-flex w-full items-center justify-center rounded-full bg-sky-800 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-900 disabled:opacity-60">{isSending ? "Sending..." : "Send reset link"}</button>
        </form>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-sky-800 underline-offset-2 hover:underline">Back to sign in</Link>
      </section>
    </main>
  );
}

const inputClassName = "mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-700 focus:ring-4 focus:ring-sky-100";
