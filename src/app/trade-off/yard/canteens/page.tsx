// /trade-off/yard/canteens — Canteens index. Inline with the Yard.
// Public list of canteens, grouped by trade, with a "Start a canteen"
// CTA for hosts. First-100 badges attach here.

import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cookies } from "next/headers";
import { MOCK_CANTEENS } from "@/lib/canteens";
import { canteensAllFromDb } from "@/lib/canteens.server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { TRADE_SESSION_COOKIE_NAME, verifyTradeSession } from "@/lib/tradeSession";
import { CanteensIndexShell }        from "./CanteensIndexShell";
import { InviteProviderClient }      from "@/components/homeowners/InviteProviderClient";
import { TradeCircleHeader }         from "@/components/homeowners/TradeCircleHeader";
import { HomeBackPill }              from "@/components/HomeBackPill";
import { getHomeownerFromCookie }    from "@/lib/homeowners/auth";
import { resolveHomeBackContext }    from "@/lib/homeBackContext";
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
  searchParams: Promise<{ previewInvite?: string; tiles?: string }>;
}) {
  const sp = await searchParams;
  // ?previewInvite=1 forces the Trade Circle chrome without a real
  // homeowner session. Used by the /sitebook-showcase mock and other
  // preview surfaces so designers can see the invite-mode view.
  const previewInvite = sp.previewInvite === "1";
  // ?tiles=1 forces TradeCategoryTiles to render even when we're
  // below AUTO_TILES_THRESHOLD. Useful for validating the design.
  const previewTiles  = sp.tiles === "1";
  // Directory-first flow (Philip 2026-07-16): every visitor — signed-in
  // merchant, DIY homeowner, anonymous — lands on the discovery listing.
  // Signed-in merchants get an "Enter my canteen" pill in the shell so
  // getting home is still 1 tap, but the DEFAULT is browse. Old
  // fast-path redirect (with ?browse=1 escape) removed — Networkers
  // brand is about seeing each other's work, not tunnelling straight to
  // your own room.
  const jar = await cookies();
  const sessionRaw = jar.get(TRADE_SESSION_COOKIE_NAME)?.value;
  const merchantSession = verifyTradeSession(sessionRaw);

  // Homeowner-invite mode: if the visitor has a live tn_homeowner_sid
  // cookie, they arrived to invite a trade. We render the directory
  // with homeowner-friendly copy (Trade Circle header, plain-English
  // sub-copy, no trade-facing chrome). Merchants + anonymous browsers
  // see the original page unchanged.
  const homeowner = await getHomeownerFromCookie();
  const inviteMode = !!homeowner || previewInvite;
  let homeownerProjects: Array<{ id: string; title: string; city: string | null; budgetMin: number | null; budgetMax: number | null }> = [];
  // Preview-invite fixture — matches the /sitebook-showcase mock owner
  // so the modal shows realistic projects to invite trades into.
  const previewOwner = previewInvite && !homeowner ? {
    first_name:     "Sarah",
    house_nickname: "The Old Rectory"
  } : null;
  if (previewInvite && !homeowner) {
    homeownerProjects = [
      { id: "prev-ensuite",  title: "En-suite plumbing",  city: "Manchester", budgetMin: 3500,  budgetMax: 5500 },
      { id: "prev-kitchen",  title: "Kitchen refit",      city: "Manchester", budgetMin: 25000, budgetMax: 45000 },
      { id: "prev-boiler",   title: "Boiler service",     city: "Manchester", budgetMin: 120,   budgetMax: 180 },
      { id: "prev-lock",     title: "Front door lock",    city: "Manchester", budgetMin: 60,    budgetMax: 120 }
    ];
  }
  if (homeowner) {
    const pr = await supabaseAdmin
      .from("hammerex_sitebook_projects")
      .select("id, title, address_city, budget_min_gbp, budget_max_gbp, status")
      .eq("homeowner_id", homeowner.id)
      .in("status", ["active", "in-progress"])
      .order("created_at", { ascending: false });
    type Row = { id: string; title: string; address_city: string | null; budget_min_gbp: number | null; budget_max_gbp: number | null };
    homeownerProjects = ((pr.data as Row[]) ?? []).map((r) => ({
      id: r.id, title: r.title, city: r.address_city,
      budgetMin: r.budget_min_gbp, budgetMax: r.budget_max_gbp
    }));
  }

  let ownCanteenSlug: string | null = null;
  if (merchantSession?.slug) {
    // Fixture shortcut first — bypasses the DB lookup so demo/fixture
    // hosts always resolve to the fixture canteen even if the DB has
    // an auto-seed drift.
    const fixtureCanteen = MOCK_CANTEENS.find((c) => c.hostSlug === merchantSession.slug);
    if (fixtureCanteen) {
      ownCanteenSlug = fixtureCanteen.slug;
    } else {
      const { data: dbCanteens } = await supabaseAdmin
        .from("hammerex_canteens")
        .select("slug, created_at")
        .eq("host_slug", merchantSession.slug)
        .order("created_at", { ascending: false })
        .limit(1);
      if (dbCanteens?.[0]?.slug) {
        ownCanteenSlug = dbCanteens[0].slug;
      }
    }
  }

  // Merge real DB canteens with the demo showcase list per
  // project_xratedtrade_demos_as_showcase.md — demos stay visible
  // even after real canteens land, so the directory always reads as
  // populated. DB canteens win when a slug collision exists (real
  // wins over demo with the same slug).
  const dbCanteens = await canteensAllFromDb();
  const dbSlugs = new Set(dbCanteens.map((c) => c.slug));
  const demosNotInDb = MOCK_CANTEENS.filter((c) => !dbSlugs.has(c.slug));
  const canteens = [...dbCanteens, ...demosNotInDb];
  const viewerIsSignedInMerchant = Boolean(merchantSession?.slug);

  const shell = (
    <CanteensIndexShell
      canteens={canteens}
      ownCanteenSlug={ownCanteenSlug}
      viewerIsSignedInMerchant={viewerIsSignedInMerchant}
      inviteMode={inviteMode}
      previewTiles={previewTiles}
    />
  );

  // Home-back pill — homeowner returns to /sitebook, merchant returns
  // to their canteen. Hidden when the viewer has no identity cookie.
  // In preview-invite mode routes back to the /sitebook-showcase mock.
  let backCtx = await resolveHomeBackContext("/trade-off/yard/canteens");
  if (!backCtx && previewInvite) {
    backCtx = {
      label: "Back to my SiteBook",
      href:  "/sitebook-showcase/the-old-rectory",
      kind:  "homeowner"
    };
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: CREAM }}>
      <HomeBackPill ctx={backCtx}/>
      {inviteMode ? (
        // ─── Homeowner-invite view — plain-English chrome ─────────
        <>
          <TradeCircleHeader/>
          <InviteProviderClient
            firstName={homeowner?.first_name    ?? previewOwner?.first_name     ?? null}
            nickname={homeowner?.house_nickname ?? previewOwner?.house_nickname ?? null}
            projects={homeownerProjects}
          >
            {shell}
          </InviteProviderClient>
        </>
      ) : (
        // ─── Trade / anonymous view — original chrome, unchanged ──
        <>
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

          {/* Founding-100 offer removed per Philip 2026-07-18. */}

          {shell}
        </>
      )}
    </main>
  );
}
