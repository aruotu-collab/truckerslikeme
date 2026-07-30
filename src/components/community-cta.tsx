"use client";

import { useAuthGate } from "@/lib/auth-gate";

export function CommunityCta() {
  const { openGate } = useAuthGate();

  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      <div className="absolute inset-0 bg-[linear-gradient(120deg,#dfe3e8_0%,#edf1f4_45%,#c5d4e0_100%)]" />
      <div className="absolute inset-x-0 top-1/2 h-1 highway-lines opacity-50" />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <h2 className="font-display text-4xl tracking-wide text-asphalt uppercase sm:text-5xl">
            Built for drivers who trust drivers
          </h2>
          <p className="mt-4 text-lg text-muted">
            Join the corridor network when you&apos;re ready — post alerts,
            follow truck stops, and unlock Pro for unlimited AI planning.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => openGate("join-community")}
              className="rounded-sm bg-asphalt px-6 py-3 text-sm font-semibold tracking-wide text-white uppercase transition hover:bg-road"
            >
              Join the community
            </button>
            <a
              href="/plan"
              className="rounded-sm border border-asphalt/20 px-6 py-3 text-sm font-medium text-asphalt transition hover:bg-white/50"
            >
              Keep exploring
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
