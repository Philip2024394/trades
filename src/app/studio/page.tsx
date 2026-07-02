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
  searchParams: Promise<{ enter?: string; failed?: string }>;
}) {
  const sp = await searchParams;
  const entryToken = typeof sp.enter === "string" ? sp.enter.trim() : "";

  // Legacy magic-link format — bounce to the Route Handler that can
  // actually set the cookie.
  if (entryToken) {
    redirect(`/api/studio/enter?token=${encodeURIComponent(entryToken)}`);
  }

  // Already signed in — jump to home.
  const session = await loadStudioSession();
  if (session) redirect("/studio/home");

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
        <p className="mt-8 text-[11px] font-bold uppercase tracking-widest text-white/40">
          Xrated Trades
        </p>
      </div>
    </main>
  );
}
