// Studio entry / sign-in screen.
//
// Handles three cases:
//   • ?enter=<token>            → 303 to /api/studio/enter?token=<token>
//                                 (cookie-set must happen in a Route
//                                 Handler per Next.js 15+ rules)
//   • Session already valid     → 303 to /studio/home
//   • Neither                   → render the "sign in via magic link"
//                                 screen (with ?failed=1 error hint)

import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { loadStudioSession } from "@/lib/studio/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Studio",
  robots: { index: false, follow: false }
};

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";

export default async function StudioEntryPage({
  searchParams
}: {
  searchParams: Promise<{ enter?: string; failed?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const entryToken = typeof sp.enter === "string" ? sp.enter.trim() : "";
  // Deep-link target. Forwarded to the Route Handler so magic links
  // like /studio?enter=X&next=/studio/apps land where they should.
  // The API route re-validates the path (whitelist starts-with /studio/).
  const rawNext = typeof sp.next === "string" ? sp.next.trim() : "";
  const safeNext = rawNext && rawNext.startsWith("/studio/") ? rawNext : "";

  // Legacy magic-link format — bounce to the Route Handler that can
  // actually set the cookie.
  if (entryToken) {
    const params = new URLSearchParams({ token: entryToken });
    if (safeNext) params.set("next", safeNext);
    redirect(`/api/studio/enter?${params.toString()}`);
  }

  // Already signed in — jump to the requested deep-link or home.
  const session = await loadStudioSession();
  if (session) redirect(safeNext || "/studio/home");

  const badLink = sp.failed === "1";

  return (
    <main
      className="grid min-h-screen place-items-center px-4"
      style={{ background: BLACK, color: "#FFFFFF" }}
    >
      <div className="w-full max-w-md text-center">
        <span
          className="mx-auto grid h-14 w-14 place-items-center rounded-2xl text-[18px] font-extrabold"
          style={{ background: YELLOW, color: BLACK }}
        >
          X
        </span>
        <h1 className="mt-6 text-3xl font-extrabold leading-tight">Studio</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-white/70">
          Your merchant workspace. Sign in with the magic link we sent to your
          email — the same one that opens your dashboard.
        </p>
        {badLink && (
          <p
            className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-[12px] font-bold text-red-200"
            role="alert"
          >
            That link isn&rsquo;t valid or has expired. Request a fresh one from
            your email.
          </p>
        )}

        {/* Dev-only bypass. Rendered only when NODE_ENV !== "production".
            The API route enforces the same guard on the server so a
            stray link on a prod deployment does nothing. */}
        {process.env.NODE_ENV !== "production" && <DevBypassCard />}

        <p className="mt-8 text-[11px] font-bold uppercase tracking-widest text-white/40">
          Xrated Trades
        </p>
      </div>
    </main>
  );
}

function DevBypassCard() {
  return (
    <div
      className="mt-8 rounded-2xl border p-4 text-left"
      style={{
        borderColor: "rgba(255, 179, 0, 0.35)",
        background: "rgba(255, 179, 0, 0.08)"
      }}
    >
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: YELLOW }}
      >
        Development mode
      </p>
      <p className="mt-1 text-[12px] text-white/80">
        Skip the magic-link and sign in as the first available demo merchant.
        Disabled in production.
      </p>
      <a
        href="/api/studio/dev-bypass"
        className="mt-3 inline-flex h-10 items-center justify-center rounded-lg px-4 text-[11px] font-extrabold uppercase tracking-widest transition"
        style={{ background: YELLOW, color: BLACK }}
      >
        Sign in as demo merchant →
      </a>
      <p className="mt-2 text-[10px] text-white/50">
        Or pass{" "}
        <code
          className="rounded px-1 py-0.5 font-mono text-[10px]"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          ?slug=your-merchant-slug
        </code>{" "}
        to sign in as a specific merchant.
      </p>
    </div>
  );
}
