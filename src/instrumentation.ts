// src/instrumentation.ts
//
// Next.js built-in boot hook · called ONCE per server process (Node runtime)
// before any request is served. Docs:
// https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
//
// Sole responsibility · fail closed at boot when NEX_POSTGRES_URL is missing,
// malformed, or points at the local dev DB in production. Downstream code
// (`src/lib/nex/db.ts`, adapter constructors, API routes) inherits the same
// tightening for free via `getPostgresUrl` / `getPostgresUrlOrNull`.
//
// Development is deliberately unaffected · dev processes may boot with
// NEX_POSTGRES_URL pointing at localhost:5433/nex_dev exactly as before.

export async function register(): Promise<void> {
  // Edge runtime has no filesystem or process.env in the same shape ·
  // the guard is only meaningful in the Node runtime, so skip elsewhere.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Import lazily so a broken pg config never blocks the edge bundle.
  const { assertProductionPostgresUrl } = await import("./lib/nex/config/pg");
  try {
    assertProductionPostgresUrl();
  } catch (err) {
    const e = err as Error & { code?: string };
    // Print the code + message but NEVER the raw URL (assertProductionPostgresUrl
    // already redacts the password inside the message). Then rethrow so
    // Next.js fails the boot loudly rather than serving requests against a
    // misconfigured or wrong-target database.
    // eslint-disable-next-line no-console
    console.error(`[nex-boot-guard] FAIL-CLOSED · code=${e.code ?? "unknown"} · ${e.message}`);
    throw err;
  }
}
