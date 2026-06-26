"use client";

import { useEffect } from "react";

// Route-level error boundary. Catches errors thrown inside the page tree
// (server components + client components) for any route under /(*).
// Logs to the console so Vercel runtime logs capture it; swap in Sentry
// here when the DSN lands.
export default function RouteError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route-error]", error);
  }, [error]);

  return (
    <main className="grid min-h-[60vh] place-items-center bg-brand-bg px-4">
      <div className="w-full max-w-md rounded-2xl border border-brand-line bg-brand-surface p-6 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">Something went wrong</p>
        <h1 className="mt-3 text-xl font-bold text-brand-text">We hit a problem loading this page</h1>
        <p className="mt-2 text-sm text-brand-muted">
          The error has been logged. Try again, head back to the homepage, or email us
          if it persists.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-[11px] text-brand-muted">Ref: {error.digest}</p>
        )}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="grid h-12 place-items-center rounded-full bg-brand-accent px-5 text-xs font-bold uppercase tracking-widest text-black hover:opacity-90"
          >
            Try again
          </button>
          <a
            href="/"
            className="grid h-12 place-items-center rounded-full border border-brand-line bg-brand-bg px-5 text-xs font-semibold text-brand-text hover:border-brand-accent"
          >
            Back to home
          </a>
        </div>
      </div>
    </main>
  );
}
