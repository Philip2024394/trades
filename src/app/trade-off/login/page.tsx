// Public login page for tradespeople. WhatsApp number + password.
//
// On success we hard-navigate (window.location) to the edit dashboard so
// the freshly-set session cookie is included in the next request (the
// router.push path was occasionally racing the cookie on dev). On
// requires_first_login we route to /trade-off/set-password with the
// number pre-filled — that flow asks the tradesperson to paste their
// existing edit_token to prove ownership.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { TradeLoginForm } from "./TradeLoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Log in — Thenetworkers",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Safe next-param whitelist — only redirect to internal trade surfaces.
// Blocks open-redirect vectors while letting the sign-in nudge on the
// Sell hub / Yard manager bounce the merchant back to the page they
// intended to land on.
function sanitizeNext(v: string | string[] | undefined): string | null {
  const raw = Array.isArray(v) ? v[0] : v;
  if (!raw || typeof raw !== "string") return null;
  if (!raw.startsWith("/trade-off/")) return null;
  return raw;
}

export default async function TradeOffLoginPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const next = sanitizeNext(sp.next);
  return (
    <main className="min-h-screen text-neutral-900" style={{ backgroundColor: "#FBF6EC" }}>
      <XratedHeader />
      <section className="mx-auto max-w-md px-4 pb-16 pt-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-neutral-900/10 bg-white px-3 py-1 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#166534" }}/>
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-700">Trade Login</span>
        </div>
        <h1 className="mt-3 text-[32px] font-black leading-tight text-neutral-900 sm:text-[40px]">
          Log in to your app.
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-600 sm:text-[14px]">
          Sign in with the WhatsApp number you signed up with and your password.
        </p>
        <div className="mt-8">
          <TradeLoginForm next={next} />
        </div>
      </section>
      <XratedFooter />
    </main>
  );
}
