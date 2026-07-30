"use client";

import { useAuthGate } from "@/lib/auth-gate";

export function CommunityCta() {
  const { openGate } = useAuthGate();

  return (
    <section className="relative w-full max-w-full overflow-x-clip py-12 pb-24 sm:py-28">
      <div className="absolute inset-0 bg-[linear-gradient(120deg,#dfe3e8_0%,#edf1f4_45%,#c5d4e0_100%)]" />
      <div className="absolute inset-x-0 top-1/2 h-1 highway-lines opacity-50" />

      <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-8">
        <div className="max-w-2xl min-w-0">
          <h2 className="font-display text-2xl leading-snug tracking-wide break-words text-asphalt uppercase sm:text-5xl">
            Built for drivers who trust drivers
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
            Join the corridor network when you&apos;re ready — post alerts,
            follow truck stops, and unlock Pro for unlimited AI planning.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row">
            <button
              type="button"
              onClick={() => openGate("join-community")}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-asphalt px-6 py-3.5 text-sm font-semibold tracking-wide text-white uppercase transition hover:bg-road sm:w-auto"
            >
              Join the community
            </button>
            <a
              href="/plan"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-sm border border-asphalt/20 px-6 py-3.5 text-sm font-medium text-asphalt transition hover:bg-white/50 sm:w-auto"
            >
              Keep exploring
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
