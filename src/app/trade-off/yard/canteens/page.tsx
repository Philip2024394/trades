// /trade-off/yard/canteens — Canteens index. Inline with the Yard.
// Public list of canteens, grouped by trade, with a "Start a canteen"
// CTA for hosts. First-100 badges attach here.

import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, Plus } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MOCK_CANTEENS } from "@/lib/canteens";
import { canteensAllFromDb } from "@/lib/canteens.server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { TRADE_SESSION_COOKIE_NAME, verifyTradeSession } from "@/lib/tradeSession";
import { CanteensIndexShell } from "./CanteensIndexShell";
import { BRAND, absolute } from "@/lib/seo";

export const dynamic = "force-dynamic";

const CREAM = "#FBF6EC";

export const metadata: Metadata = {
  title: "Canteens — The Yard | Thenetworkers",
  description:
    "Canteens are trade-specific corners of The Yard. Kitchen fitters, sparks, scaffolders — talk shop, sell tools, share leads.",
  alternates: { canonical: "/trade-off/yard/canteens" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Canteens — The Yard | Thenetworkers",
    description:
      "Trade-specific corners of The Yard. Open groups with a marketing The Counter and a private-view listing pattern.",
    url: absolute("/trade-off/yard/canteens")
  }
};

export default async function CanteensIndexPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Signed-in-merchant fast path: if the viewer is a signed-in merchant,
  // route them straight to their own canteen instead of the discovery
  // listing — no hunt for their own card among hundreds. Opt-out with
  // ?browse=1 for merchants who explicitly want the listing (e.g.
  // discovery browsing to join another trade's canteen).
  const sp = (await searchParams) ?? {};
  const wantsBrowse = sp.browse === "1" || sp.browse === "true";
  if (!wantsBrowse) {
    const jar = await cookies();
    const sessionRaw = jar.get(TRADE_SESSION_COOKIE_NAME)?.value;
    const merchantSession = verifyTradeSession(sessionRaw);
    if (merchantSession?.slug) {
      // Canonical fixture shortcut. If this merchant is a known host
      // in MOCK_CANTEENS (e.g. Mike Watson → uk-kitchen-fitters,
      // Craig McDermott → north-uk-sparks, Jason Hardy → uk-scaffolders),
      // route straight to the fixture-defined canteen. Bypasses the DB
      // lookup entirely so drift can't send us to a wrongly-named
      // auto-seed. Applies to demos + any real merchant later added
      // to the fixture roster.
      const fixtureCanteen = MOCK_CANTEENS.find((c) => c.hostSlug === merchantSession.slug);
      if (fixtureCanteen) {
        redirect(`/trade-off/yard/canteens/${fixtureCanteen.slug}`);
      }

      // Otherwise ask the DB. `.limit(1)` + `.order` beats `.maybeSingle()`
      // which errors when 2+ rows exist for this host (which shouldn't
      // happen, but did during the demo-canteen naming drift). Newest
      // canteen wins on a tie so a merchant who spun up a fresh one
      // lands on the fresh one.
      const { data: dbCanteens } = await supabaseAdmin
        .from("hammerex_canteens")
        .select("slug, created_at")
        .eq("host_slug", merchantSession.slug)
        .order("created_at", { ascending: false })
        .limit(1);
      const ownCanteen = dbCanteens?.[0];
      if (ownCanteen?.slug) {
        redirect(`/trade-off/yard/canteens/${ownCanteen.slug}`);
      }
      // Signed-in merchant without a canteen yet → the create flow is
      // the correct destination (no reason to browse a listing to
      // realise they don't have one). They can still hit ?browse=1 to
      // see the discovery listing.
      redirect(`/trade-off/yard/canteens/new`);
    }
  }

  // Real DB with mock fallback. If DB returns nothing (fresh env) we
  // fall back to mocks so the page still ships a discoverable list.
  const dbCanteens = await canteensAllFromDb();
  const canteens = dbCanteens.length > 0 ? dbCanteens : MOCK_CANTEENS;
  const founding100 = canteens.filter((c) => c.isFounding100);

  return (
    <main className="min-h-screen" style={{ backgroundColor: CREAM }}>
      {/* Page title strip — Yard-style */}
      <section style={{ borderBottom: "1px solid rgba(139,69,19,0.15)" }}>
        <div className="mx-auto flex w-full max-w-6xl items-start gap-3 px-3 py-6 md:px-6 md:py-8">
          <div className="min-w-0 flex-1">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-700 shadow-sm">
              <span
                className="block h-2 w-2 rounded-full"
                style={{ backgroundColor: "#FFB300" }}
                aria-hidden="true"
              />
              Canteens · new
            </div>
            <h1 className="text-[24px] font-black leading-tight text-neutral-900 md:text-[32px]">
              Trade corners of The Yard.
            </h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-snug text-neutral-600 md:text-[14px]">
              Open groups scoped to one trade. Talk shop, sell tools, share leads. Marketing runs in a The Counter so the feed stays clean.
            </p>
          </div>
          <Link
            href="/trade-off/yard/canteens/new"
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[12px] font-black uppercase tracking-wider text-neutral-900 shadow-md transition active:scale-[0.97] md:h-12 md:px-5"
            style={{ background: "#FFB300" }}
          >
            <Plus size={14} strokeWidth={2.5}/>
            <span className="hidden sm:inline">Start a Canteen</span>
            <span className="sm:hidden">New</span>
          </Link>
        </div>
      </section>

      {/* Founding-100 strip */}
      <section
        className="border-b"
        style={{
          borderColor: "rgba(139,69,19,0.15)",
          background: "linear-gradient(90deg, #FFB30015 0%, #FBF6EC 60%)"
        }}
      >
        <div className="mx-auto max-w-6xl px-3 py-4 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: "#8B4513" }}
              >
                <Sparkles size={13} color="#FFFFFF" strokeWidth={2.5}/>
              </span>
              <div>
                <div className="text-[13px] font-black text-neutral-900">
                  First 100 Canteens — unlock the topic app free for 12 months
                </div>
                <div className="text-[11px] text-neutral-600">
                  Hit 50 posts/mo for 3 months in a row and your canteen gets the app that matches your trade — on us.
                </div>
              </div>
            </div>
            <div className="text-[11px] font-black uppercase tracking-wider text-neutral-700">
              {founding100.length} / 100 claimed
            </div>
          </div>
        </div>
      </section>

      {/* Canteens grid — search + trade filter live in the client
          shell so the server component stays cacheable. */}
      <CanteensIndexShell canteens={canteens}/>
    </main>
  );
}
