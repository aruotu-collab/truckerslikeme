"use client";

import { getAuthGateCopy, useAuthGate } from "@/lib/auth-gate";

export function AuthGateModal() {
  const { pendingAction, closeGate, signInDemo } = useAuthGate();

  if (!pendingAction) return null;

  const copy = getAuthGateCopy(pendingAction);

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
          Create a free account
        </p>
        <h2
          id="auth-gate-title"
          className="mt-2 font-display text-3xl tracking-wide text-asphalt uppercase"
        >
          {copy.title}
        </h2>
        <p className="mt-3 text-muted">{copy.body}</p>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={signInDemo}
            className="w-full rounded-sm bg-amber px-4 py-3 text-sm font-semibold tracking-wide text-asphalt uppercase transition hover:bg-amber-hot"
          >
            Continue with demo account
          </button>
          <button
            type="button"
            onClick={closeGate}
            className="w-full rounded-sm border border-asphalt/15 px-4 py-3 text-sm text-muted transition hover:bg-concrete/60"
          >
            Keep browsing
          </button>
        </div>

        <p className="mt-5 text-xs leading-relaxed text-muted">
          Supabase auth is wired for production. Add your project keys in{" "}
          <code className="text-asphalt">.env.local</code> to replace this demo
          gate.
        </p>
      </div>
    </div>
  );
}
