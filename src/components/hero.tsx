export function Hero() {
  return (
    <section className="relative isolate overflow-x-clip bg-asphalt py-10 sm:py-14">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "linear-gradient(160deg, rgba(26,29,35,0.72) 0%, rgba(26,29,35,0.55) 45%, rgba(26,29,35,0.85) 100%), url('https://images.unsplash.com/photo-1601584115197-04ecc1da5d9a?auto=format&fit=crop&w=2400&q=80')",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background to-transparent" />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <h1 className="max-w-2xl text-3xl font-medium leading-tight text-white sm:text-4xl md:text-5xl">
          Live road intel for the corridor you&apos;re hauling.
        </h1>
        <p className="mt-4 max-w-lg text-lg leading-relaxed text-chrome sm:text-xl">
          Parking, fuel, delays — big and clear. Built to check at a stop, not
          while the wheels are turning.
        </p>
      </div>
    </section>
  );
}
