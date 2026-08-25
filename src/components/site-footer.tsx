import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-asphalt/10 bg-background py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="font-display text-lg tracking-[0.08em] text-asphalt uppercase">
          Truckers<span className="text-amber">Like</span>Me
        </p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
          <Link href="/" className="transition hover:text-asphalt">
            Check
          </Link>
          <Link href="/find" className="transition hover:text-asphalt">
            Find
          </Link>
          <Link href="/trip" className="transition hover:text-asphalt">
            Trip
          </Link>
          <Link href="/me" className="transition hover:text-asphalt">
            Me
          </Link>
        </nav>
        <p className="text-sm text-muted">
          Load decisions · Places drivers trust · Worldwide
        </p>
      </div>
    </footer>
  );
}
