"use client";

import { FormEvent, useState } from "react";
import { getAuthGateCopy, useAuthGate } from "@/lib/auth-gate";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export function AuthGateModal() {
  const { pendingAction, closeGate, configured } = useAuthGate();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!pendingAction) return null;

  const copy = getAuthGateCopy(pendingAction);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!configured) {
      setError("Supabase keys are missing. Add them in .env.local and Vercel.");
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError("Could not connect to Supabase.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          closeGate();
          return;
        }
        setInfo("Check your email to confirm your account, then sign in.");
        setMode("signin");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        closeGate();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-asphalt/70 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-gate-title"
      onClick={closeGate}
    >
      <div
        className="animate-slide-up w-full max-w-md border border-asphalt/10 bg-background p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-display text-xs tracking-[0.2em] text-amber uppercase">
          {mode === "signup" ? "Create a free account" : "Welcome back"}
        </p>
        <h2
          id="auth-gate-title"
          className="mt-2 font-display text-3xl tracking-wide text-asphalt uppercase"
        >
          {copy.title}
        </h2>
        <p className="mt-3 text-muted">{copy.body}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs tracking-wide text-muted uppercase">
              Email
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-sm border border-asphalt/15 bg-white px-4 py-3 text-asphalt outline-none transition focus:border-amber"
              placeholder="you@email.com"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs tracking-wide text-muted uppercase">
              Password
            </span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-sm border border-asphalt/15 bg-white px-4 py-3 text-asphalt outline-none transition focus:border-amber"
              placeholder="At least 6 characters"
            />
          </label>

          {error && <p className="text-sm text-alert">{error}</p>}
          {info && <p className="text-sm text-diesel">{info}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-sm bg-amber px-4 py-3 text-sm font-semibold tracking-wide text-asphalt uppercase transition hover:bg-amber-hot disabled:opacity-60"
          >
            {busy
              ? "Please wait…"
              : mode === "signup"
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signup" ? "signin" : "signup");
              setError(null);
              setInfo(null);
            }}
            className="text-sm text-muted transition hover:text-asphalt"
          >
            {mode === "signup"
              ? "Already have an account? Sign in"
              : "Need an account? Sign up"}
          </button>
          <button
            type="button"
            onClick={closeGate}
            className="w-full rounded-sm border border-asphalt/15 px-4 py-3 text-sm text-muted transition hover:bg-concrete/60"
          >
            Keep browsing
          </button>
        </div>
      </div>
    </div>
  );
}
