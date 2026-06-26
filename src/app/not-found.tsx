export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-4">
      <div className="w-full rounded-2xl border border-brand-line bg-brand-surface p-6 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">404</p>
        <h1 className="mt-3 text-2xl font-bold text-brand-text">This page couldn't be found</h1>
        <p className="mt-2 text-sm text-brand-muted">
          The link may be stale or you may have typed the address by hand.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <a
            href="/"
            className="grid h-12 place-items-center rounded-full bg-brand-accent px-5 text-xs font-bold uppercase tracking-widest text-black hover:opacity-90"
          >
            Back to home
          </a>
          <a
            href="/trade-off"
            className="grid h-12 place-items-center rounded-full border border-brand-line bg-brand-bg px-5 text-xs font-semibold text-brand-text hover:border-brand-accent"
          >
            Browse Xrated
          </a>
        </div>
      </div>
    </main>
  );
}
