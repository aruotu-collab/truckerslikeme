export function Hero() {
  return (
    <section className="relative isolate overflow-hidden py-10 sm:pt-28 sm:pb-12 md:pt-28">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "linear-gradient(160deg, rgba(26,29,35,0.62) 0%, rgba(26,29,35,0.45) 45%, rgba(26,29,35,0.78) 100%), url('https://images.unsplash.com/photo-1601584115197-04ecc1da5d9a?auto=format&fit=crop&w=2400&q=80')",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background to-transparent" />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <h1 className="max-w-2xl text-2xl font-medium leading-snug text-white/95 sm:text-3xl md:text-4xl">
          Live road intelligence from drivers who haul the same corridors.
        </h1>
        <p className="mt-3 max-w-lg text-base leading-relaxed text-chrome sm:text-lg">
          Parking, fuel, delays, and route intel — browse freely. Sign up only
          when you want to save, post, or ask AI.
        </p>
      </div>
    </section>
  );
}
