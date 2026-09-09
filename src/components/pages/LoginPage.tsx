"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type LoginPageProps = {
  className?: string;
  shellClassName?: string;
  leftPanelClassName?: string;
  rightPanelClassName?: string;
};

export default function LoginPage({
  className,
  shellClassName,
  leftPanelClassName,
  rightPanelClassName,
}: LoginPageProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSigningIn(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const signIn = supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      const timeout = new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("Supabase sign-in timed out. Check your connection and Supabase API settings.")), 15000);
      });
      const { error } = await Promise.race([signIn, timeout]);

      if (error) {
        setErrorMessage(error.message);
        setIsSigningIn(false);
        return;
      }

      // The proxy performs the role check on the destination request. Avoid
      // querying user_profiles here as well, which adds another network round
      // trip before the workspace can render.
      router.replace("/admin");
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : "Could not sign in.");
      setIsSigningIn(false);
    }
  }

  return (
    <main
      className={`flex min-h-screen items-center justify-center bg-slate-100 px-6 py-16 ${className ?? ""}`}
    >
      <section
        className={`grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_30px_80px_-50px_rgba(15,23,42,0.35)] lg:grid-cols-[0.95fr_1.05fr] ${shellClassName ?? ""}`}
      >
        <div
          className={`bg-slate-950 px-8 py-10 text-white md:px-10 md:py-12 ${leftPanelClassName ?? ""}`}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-200">
            DocuJet
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight">
            Admin Login
          </h1>
          <p className="mt-5 max-w-md text-base leading-8 text-slate-300">
            This login screen is for DocuJet client staff and administrators.
            Public customers do not need an account to use the booking page.
          </p>
          <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm leading-7 text-slate-300">
            <p className="font-semibold text-white">Public booking stays open</p>
            <p className="mt-2">
              Customer appointments continue through{" "}
              <Link href="/booking" className="text-sky-200 underline">
                /booking
              </Link>{" "}
              with no login required.
            </p>
          </div>
        </div>

        <div className={`px-8 py-10 md:px-10 md:py-12 ${rightPanelClassName ?? ""}`}>
          <p className="text-sm font-medium text-slate-500">
            Staff sign-in
          </p>
          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <Field label="Email Address" htmlFor="login-email">
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClassName}
                placeholder="name@company.com"
              />
            </Field>

            <Field label="Password" htmlFor="login-password">
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={`${inputClassName} pr-20`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </Field>

            <div className="flex items-center justify-between gap-4">
              <label className="flex items-center gap-3 text-sm text-slate-600">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
                Remember me
              </label>
              <Link href="/forgot-password" className="text-sm text-sky-800 underline-offset-2 hover:underline">
                Forgot password?
              </Link>
            </div>

            {errorMessage ? (
              <div
                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
                role="alert"
              >
                {errorMessage}
              </div>
            ) : (
              <div
                className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"
                role="status"
                aria-live="polite"
              >
                Admin access is invite-only. Use a Supabase-issued staff
                account to continue.
              </div>
            )}

            <button
              type="submit"
              disabled={isSigningIn}
              className="inline-flex w-full items-center justify-center rounded-full bg-sky-800 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-900"
            >
              {isSigningIn ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-2 block text-sm font-medium text-slate-800"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClassName =
  "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-700 focus:ring-4 focus:ring-sky-100";
