export function SiteFooter() {
  return (
    <footer className="border-t border-asphalt/10 bg-background py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="font-display text-lg tracking-[0.08em] text-asphalt uppercase">
          Truckers<span className="text-amber">Like</span>Me
        </p>
        <p className="text-sm text-muted">
          Live truck intel · Progressive signup · Pro when it pays for itself
        </p>
      </div>
    </footer>
  );
}
