"use client";

import { FormEvent, useEffect, useState } from "react";
import { getAuthGateCopy, useAuthGate } from "@/lib/auth-gate";
import { createClient } from "@/lib/supabase/client";
import { outlineBtnClass } from "@/lib/ui-buttons";

type Step = "email" | "sent";

export function AuthGateModal() {
  const { pendingAction, closeGate, configured } = useAuthGate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingAction) return;
    setStep("email");
    setEmail("");
    setError(null);
    setBusy(false);
  }, [pendingAction]);

  if (!pendingAction) return null;

  const copy = getAuthGateCopy(pendingAction);

  async function sendLink() {
    setError(null);

    if (!configured) {
      setError("Supabase keys are missing. Add them in .env.local and Vercel.");
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError("Could not connect to Supabase.");
      return;
    }

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email address.");
      return;
    }

    setBusy(true);
    try {
      const next = `${window.location.pathname}${window.location.search}`;
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          shouldCreateUser: true,
        },
      });
      if (otpError) throw otpError;
      setStep("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send sign-in link.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await sendLink();
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
        {step === "email" ? (
          <>
            <p className="font-display text-xs tracking-[0.2em] text-amber uppercase">
              Free account
            </p>
            <h2
              id="auth-gate-title"
              className="mt-2 font-display text-3xl tracking-wide text-asphalt uppercase"
            >
              {copy.title}
            </h2>
            <p className="mt-3 text-muted">{copy.body}</p>
            <p className="mt-2 text-sm text-muted">
              No password — we&apos;ll email you a one-time sign-in link.
            </p>

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

              {error && <p className="text-sm text-alert">{error}</p>}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-sm bg-amber px-4 py-3 text-sm font-semibold tracking-wide text-asphalt uppercase transition hover:bg-amber-hot disabled:opacity-60"
              >
                {busy ? "Sending link…" : "Email me a sign-in link →"}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="font-display text-xs tracking-[0.2em] text-amber uppercase">
              Check your email
            </p>
            <h2
              id="auth-gate-title"
              className="mt-2 font-display text-3xl tracking-wide text-asphalt uppercase"
            >
              Sign-in link sent
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              We sent a link to{" "}
              <span className="font-semibold text-asphalt">{email.trim()}</span>.
              Open it on this device to finish signing in — then you can scan
              Shiply and save jobs.
            </p>
            <p className="mt-2 text-xs text-muted">
              New here? The same link creates your free account. No password
              needed.
            </p>
            {error ? <p className="mt-3 text-sm text-alert">{error}</p> : null}
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setError(null);
                }}
                className={outlineBtnClass("muted")}
              >
                Use a different email
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void sendLink()}
                className={outlineBtnClass("amber")}
              >
                {busy ? "Sending…" : "Resend link"}
              </button>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={closeGate}
          className="mt-4 w-full rounded-sm border border-asphalt/15 px-4 py-3 text-sm text-muted transition hover:bg-concrete/60"
        >
          Keep browsing
        </button>
      </div>
    </div>
  );
}
