export function Hero() {
  return (
    <section className="relative isolate w-full max-w-full overflow-x-clip bg-asphalt py-8 sm:py-14">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "linear-gradient(160deg, rgba(26,29,35,0.72) 0%, rgba(26,29,35,0.55) 45%, rgba(26,29,35,0.85) 100%), url('https://images.unsplash.com/photo-1601584115197-04ecc1da5d9a?auto=format&fit=crop&w=2400&q=80')",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background to-transparent" />

      <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-8">
        <h1 className="max-w-2xl text-2xl font-medium leading-snug break-words text-white sm:text-4xl md:text-5xl">
          Live road intel for the corridor you&apos;re hauling.
        </h1>
        <p className="mt-3 max-w-lg text-base leading-relaxed text-chrome sm:mt-4 sm:text-xl">
          Parking, fuel, delays — big and clear. Built to check at a stop, not
          while the wheels are turning.
        </p>
      </div>
    </section>
  );
}
