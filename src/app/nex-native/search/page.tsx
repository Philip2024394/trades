// src/app/nex-native/search/page.tsx
//
// NEX Search · Phase 1 universal-discovery surface · sealed 2026-10-04.
// ---------------------------------------------------------------------
// Doctrine (see rule_nex_search_phase1_2026_10_04 + master build prompt):
//   · Narrow launch gate NEX_SEARCH_ENABLED (DOES NOT un-gate commerce).
//   · One search surface. Five tabs: All · Shops · Companies · Services
//     · Places. Companies / Services / Places are honestly DORMANT in
//     Phase 1 — their classification data isn't reliable yet (only
//     3.6% of businesses have `business_category` set; `nex_service`
//     is empty).
//   · Shops tab = businesses that have ≥1 live product · uses
//     `businessIdsWithLiveProducts()` so the join respects the same
//     visibility rule as the existing product search.
//   · Query, pagination and category filter are preserved across tab
//     switches via URL params.
//   · Theme scope boundary doctrine 2026-10-04 · search is a NEX
//     SYSTEM surface · it always renders NEX regardless of the
//     viewer's chat_theme.
//   · No fake results · no clickable controls that lead nowhere · no
//     recent-searches UI until a real persistence story lands.
//
// Query params:
//   ?q=<text>              — free text query (max 100 chars)
//   ?tab=all|shops|companies|services|places  (default "all")
//   ?category=<slug>       — business_category filter (All + Shops only)
//   ?page=<n>              — pagination, 1-indexed
//   ?search=1              — dev bypass when the launch flag is off

import type * as React from "react";
import Link from "next/link";
import {
  resolveNexAppSessionFromContext,
} from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as discoveryService from "@/lib/nex-native/discovery-service";
import { NEX_BUSINESS_CATEGORIES } from "@/lib/nex-native/site-templates";
import type { NexBusinessRow, NexProductRow } from "@/lib/nex-native/types";
import { NexPageHeader } from "../_page-header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ─── Palette · NEX brand only (matches Create Account + Call Center) ─ */
const NEX = {
  bg: "#020914",
  text: "#F2F5F8",
  textDim: "#7D9BC0",
  textMuted: "#4B6683",
  orange: "#FF7200",
  orangeSoft: "rgba(255,114,0,0.14)",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.14)",
  cyanFaint: "rgba(0,175,255,0.06)",
  darkRed: "#991B1B",
};
const RIM_GRADIENT = `linear-gradient(135deg, ${NEX.orange} 0%, ${NEX.cyan} 100%)`;
const RIM_CYAN_ONLY = `linear-gradient(135deg, ${NEX.cyan} 0%, ${NEX.cyan}66 100%)`;

/* ─── Tabs ───────────────────────────────────────────────────────── */
type SearchTab = "all" | "shops" | "companies" | "services" | "places";
const SEARCH_TABS: readonly SearchTab[] = ["all", "shops", "companies", "services", "places"];
const TAB_LABEL: Record<SearchTab, string> = {
  all: "All",
  shops: "Shops",
  companies: "Companies",
  services: "Services",
  places: "Places",
};
const TAB_ACTIVE: Record<SearchTab, boolean> = {
  all: true,
  shops: true,
  companies: false,
  services: false,
  places: false,
};
/** Honest "why this tab is dormant" copy · sealed with the founder
 *  2026-10-04. No fabricated delivery dates. No "soon." */
const TAB_DORMANT_COPY: Record<SearchTab, { title: string; body: string } | null> = {
  all: null,
  shops: null,
  companies: {
    title: "Company discovery coming later",
    body:
      "Business categories are still being added. Company discovery will be available as more businesses complete their profiles.",
  },
  services: {
    title: "Service discovery coming later",
    body:
      "Independent professionals and service providers will be discoverable once services are added to NEX.",
  },
  places: {
    title: "Place discovery coming later",
    body:
      "Restaurants, hotels, tourist destinations and other places will be discoverable in a future update.",
  },
};

const PAGE_SIZE = 20;
const SAFE_CATEGORIES: readonly string[] = NEX_BUSINESS_CATEGORIES;

interface PageProps {
  searchParams: Promise<{
    q?: string;
    tab?: string;
    category?: string;
    page?: string;
    search?: string;
  }>;
}

export default async function SearchPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  // NEX Search Phase 1 launch gate · sealed 2026-10-04.
  // Narrow gate · un-gates ONLY /nex-native/search · never the
  // broader commerce surfaces. See launch-flags.ts.
  const { searchEnabledForRequest } = await import(
    "@/lib/nex-native/launch-flags"
  );
  if (!searchEnabledForRequest(sp)) {
    const { redirect } = await import("next/navigation");
    redirect("/nex-native/home");
  }

  // Parse + normalise params.
  const rawQuery = (sp.q ?? "").trim();
  const query = rawQuery.length > 100 ? rawQuery.slice(0, 100) : rawQuery;
  const rawTab = (sp.tab ?? "all").trim().toLowerCase();
  const tab: SearchTab = (SEARCH_TABS as readonly string[]).includes(rawTab)
    ? (rawTab as SearchTab)
    : "all";
  const rawCategory = (sp.category ?? "").trim().toLowerCase();
  const category =
    rawCategory && SAFE_CATEGORIES.includes(rawCategory) ? rawCategory : "";
  const pageRaw = Number(sp.page ?? "1");
  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const offset = (page - 1) * PAGE_SIZE;

  // Session is only used so we can note "signed in" state later; the
  // search surface itself renders in NEX regardless of chat_theme per
  // the sealed theme-boundary doctrine (2026-10-04).
  await resolveNexAppSessionFromContext();

  const hasSearch = query.length > 0 || category.length > 0;
  const isDormantTab = !TAB_ACTIVE[tab];

  // ── Data fetch · tab-aware · dormant tabs skip the data layer ────
  //
  // The All tab preserves the ORIGINAL discovery behaviour · product
  // search + business search in parallel · no change to semantics or
  // pagination.
  //
  // The Shops tab routes through `searchShops()` + `countShops()`
  // which apply the "has ≥1 live product" relationship SERVER-SIDE
  // BEFORE pagination. A matching shop can never be hidden from
  // page 1 just because its row fell on a per-page slice where
  // sibling businesses lacked live products.
  let errorMsg: string | null = null;
  let products: NexProductRow[] = [];
  let businesses: NexBusinessRow[] = [];
  let productCount = 0;
  let businessCount = 0;

  if (hasSearch && !isDormantTab) {
    try {
      const businessFilter = category ? { category } : {};
      if (tab === "shops") {
        // Shops · the live-product filter is pre-pagination.
        [businesses, businessCount] = await Promise.all([
          discoveryService.searchShops(
            query,
            { limit: PAGE_SIZE, offset },
            businessFilter,
          ),
          discoveryService.countShops(query, businessFilter),
        ]);
        // Products deliberately not rendered on the Shops tab · the
        // Shops surface is a shop directory, not a product grid.
      } else {
        // All tab · unchanged · product + business search in parallel.
        [products, businesses, productCount, businessCount] = await Promise.all([
          // Product search stays query-driven · category doesn't apply
          // at the product level (a shop's category doesn't tag its
          // products individually).
          query.length > 0
            ? discoveryService.searchProducts(query, { limit: PAGE_SIZE, offset })
            : Promise.resolve([]),
          discoveryService.searchBusinesses(
            query,
            { limit: PAGE_SIZE, offset },
            businessFilter,
          ),
          query.length > 0
            ? discoveryService.countProducts(query)
            : Promise.resolve(0),
          discoveryService.countBusinesses(query, businessFilter),
        ]);
      }
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
    }
  }

  // Shops branch already returns the correctly filtered page · no
  // post-filter required. shopIds is only kept so downstream callers
  // (card components) retain a consistent prop signature.
  const shopIds: Set<string> = new Set(
    tab === "shops" ? businesses.map((b) => b.id) : [],
  );

  // Pagination logic.
  //   · All   · paginates on the OR of product + biz against their
  //             native counts (unchanged from pre-Phase 1).
  //   · Shops · paginates against `countShops()` · pre-filtered.
  //   · Companies / Services / Places · dormant · no pagination.
  const productsPaged = tab === "all" ? products : [];
  const businessesPaged =
    tab === "all" || tab === "shops" ? businesses : [];
  const hasNextProducts =
    tab === "all" && offset + products.length < productCount;
  const hasNextBusinesses =
    (tab === "all" || tab === "shops") &&
    offset + businessesPaged.length < businessCount;
  const hasPrev = page > 1 && !isDormantTab;
  const hasNext = (hasNextProducts || hasNextBusinesses) && !isDormantTab;

  // Enrich product cards with their business slug + name so each
  // card can link back to the shop it belongs to. Done once per
  // page render.
  const productBizIds = Array.from(new Set(productsPaged.map((p) => p.business_id)));
  const productBizRows = await Promise.all(
    productBizIds.map((id) => businessService.getBusinessById(id)),
  );
  const productBizById = new Map(
    productBizRows.filter(Boolean).map((b) => [b!.id, b!]),
  );

  // Popular tags · only on the landing (no query), only on the All
  // tab. Server-side computation already exists.
  let popularTags: Array<{ tag: string; count: number }> = [];
  if (!hasSearch && tab === "all") {
    popularTags = await discoveryService.getPopularTags(12).catch(() => []);
  }

  function hrefFor(opts: {
    q?: string;
    tab?: SearchTab;
    category?: string;
    page?: number;
    preserveSearchBypass?: boolean;
  }): string {
    const p = new URLSearchParams();
    const nextQ = opts.q ?? query;
    const nextTab = opts.tab ?? tab;
    const nextCategory = opts.category ?? category;
    const nextPage = opts.page ?? 1;
    if (nextQ) p.set("q", nextQ);
    if (nextTab && nextTab !== "all") p.set("tab", nextTab);
    if (nextCategory) p.set("category", nextCategory);
    if (nextPage > 1) p.set("page", String(nextPage));
    // Preserve the ?search=1 dev bypass so navigating between tabs
    // doesn't lose it while the launch flag is off.
    if (opts.preserveSearchBypass !== false) {
      const bypass = sp.search === "1" || sp.search === "true";
      if (bypass) p.set("search", "1");
    }
    const qs = p.toString();
    return qs ? `/nex-native/search?${qs}` : "/nex-native/search";
  }

  return (
    <>
      <style>{`html, body { background: ${NEX.bg} !important; }`}</style>
      <main
        data-nex-search-root
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.text,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "calc(env(safe-area-inset-top, 0) + 16px) 20px 48px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Create Account canvas · single faint cyan radial glow */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(60% 40% at 50% 0%, rgba(0,175,255,0.09), transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{ position: "relative", zIndex: 1, maxWidth: 820, margin: "0 auto" }}
        >
          <NexPageHeader dataScope="search" />

          <Hero hasSearch={hasSearch} query={query} tab={tab} isDormantTab={isDormantTab} />

          <SearchForm query={query} tab={tab} category={category} hrefFor={hrefFor} />

          <TabBar tab={tab} query={query} category={category} hrefFor={hrefFor} />

          {errorMsg && (
            <div
              role="status"
              style={{
                marginTop: 18,
                padding: "12px 14px",
                borderRadius: 12,
                border: `1px solid ${NEX.darkRed}99`,
                background: "rgba(153,27,27,0.14)",
                color: "#FFB4C0",
                fontSize: 13,
              }}
            >
              {errorMsg}
            </div>
          )}

          {isDormantTab ? (
            <DormantPanel tab={tab} />
          ) : hasSearch ? (
            <ResultsBody
              tab={tab}
              query={query}
              category={category}
              productsPaged={productsPaged}
              businessesPaged={businessesPaged}
              shopIds={shopIds}
              productBizById={productBizById}
              productCount={productCount}
              businessCount={businessCount}
              page={page}
              hasPrev={hasPrev}
              hasNext={hasNext}
              hrefFor={hrefFor}
            />
          ) : (
            <LandingBody
              popularTags={popularTags}
              hrefFor={hrefFor}
            />
          )}
        </div>
      </main>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════ *
 * Hero                                                                *
 * ═══════════════════════════════════════════════════════════════════ */

function Hero({
  hasSearch,
  query,
  tab,
  isDormantTab,
}: {
  hasSearch: boolean;
  query: string;
  tab: SearchTab;
  isDormantTab: boolean;
}): React.JSX.Element {
  // Compact "results header" when a search is active · full hero
  // only on the landing. Keeps the results page information-dense.
  if (hasSearch) {
    return (
      <header style={{ margin: "18px 0 10px", textAlign: "center" }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.28em",
            color: NEX.cyan,
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          NEX Search
        </div>
        {query && (
          <h1
            style={{
              margin: "8px 0 0",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            Showing results for{" "}
            <span style={{ color: NEX.orange }}>&ldquo;{query}&rdquo;</span>
            {tab !== "all" && (
              <>
                {" "}·{" "}
                <span style={{ color: NEX.cyan }}>{TAB_LABEL[tab]}</span>
              </>
            )}
          </h1>
        )}
      </header>
    );
  }
  // Dormant tab (no query) · the dormant panel below IS the primary
  // message · keep the chrome minimal so the "coming later" copy
  // reads as the hero rather than a side-note under a competing
  // "Discover more" headline.
  if (isDormantTab) {
    return (
      <header style={{ margin: "18px 0 10px", textAlign: "center" }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.28em",
            color: NEX.cyan,
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          NEX Search · {TAB_LABEL[tab]}
        </div>
      </header>
    );
  }
  return (
    <header style={{ margin: "32px 0 20px", textAlign: "center" }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.3em",
          color: NEX.cyan,
          fontWeight: 700,
          textTransform: "uppercase",
        }}
      >
        NEX Search
      </div>
      <h1
        style={{
          margin: "10px 0 6px",
          fontSize: 32,
          lineHeight: 1.1,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          background: `linear-gradient(180deg, ${NEX.text} 0%, ${NEX.cyan} 100%)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        Discover more with NEX
      </h1>
      <p
        style={{
          margin: "0 auto",
          maxWidth: 480,
          fontSize: 14,
          color: NEX.textDim,
          lineHeight: 1.5,
        }}
      >
        Find places, people, products, services and experiences.
      </p>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════════ *
 * Search form · GET-based so bookmarks + history work                 *
 * ═══════════════════════════════════════════════════════════════════ */

function SearchForm({
  query,
  tab,
  category,
  hrefFor,
}: {
  query: string;
  tab: SearchTab;
  category: string;
  hrefFor: (opts: { q?: string; tab?: SearchTab; category?: string; page?: number }) => string;
}): React.JSX.Element {
  return (
    <form
      action="/nex-native/search"
      method="get"
      style={{
        display: "flex",
        gap: 10,
        marginBottom: 14,
        maxWidth: 640,
        marginLeft: "auto",
        marginRight: "auto",
      }}
    >
      {/* Keep tab + category when the form submits · don't silently
       *  change the meaning of the search when the user re-queries. */}
      {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
      {category && <input type="hidden" name="category" value={category} />}
      <label
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          borderRadius: 14,
          border: "1.5px solid transparent",
          background: `rgba(255,255,255,0.05) padding-box, ${RIM_GRADIENT} border-box`,
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 20px rgba(0,0,0,0.35), 0 0 18px rgba(255,114,0,0.08), 0 0 22px rgba(0,175,255,0.08)",
        }}
      >
        <SearchGlyph tint={NEX.cyan} />
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="What are you looking for?"
          maxLength={100}
          autoComplete="off"
          style={{
            flex: 1,
            minWidth: 0,
            background: "transparent",
            border: "none",
            outline: "none",
            color: NEX.text,
            fontSize: 15,
            fontFamily: "inherit",
          }}
        />
      </label>
      <button
        type="submit"
        aria-label="Search"
        style={{
          padding: "0 18px",
          minWidth: 56,
          borderRadius: 14,
          border: "2px solid transparent",
          background: `rgba(255,114,0,0.22) padding-box, ${RIM_GRADIENT} border-box`,
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          color: NEX.text,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.02em",
          cursor: "pointer",
          fontFamily: "inherit",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.16), 0 10px 24px rgba(0,0,0,0.4), 0 0 22px rgba(255,114,0,0.28), 0 0 22px rgba(0,175,255,0.2)",
        }}
      >
        Search
      </button>
      {query && (
        <Link
          href={hrefFor({ q: "", tab, category, page: 1 })}
          aria-label="Clear search"
          style={{
            display: "grid",
            placeItems: "center",
            padding: "0 14px",
            borderRadius: 14,
            border: `1.5px solid ${NEX.cyan}44`,
            background: "rgba(255,255,255,0.03)",
            color: NEX.textDim,
            fontSize: 13,
            textDecoration: "none",
            fontFamily: "inherit",
          }}
        >
          Clear
        </Link>
      )}
    </form>
  );
}

/* ═══════════════════════════════════════════════════════════════════ *
 * Tab bar                                                             *
 * ═══════════════════════════════════════════════════════════════════ */

function TabBar({
  tab,
  query,
  category,
  hrefFor,
}: {
  tab: SearchTab;
  query: string;
  category: string;
  hrefFor: (opts: { q?: string; tab?: SearchTab; category?: string; page?: number }) => string;
}): React.JSX.Element {
  return (
    <nav
      aria-label="Search categories"
      style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        padding: "4px 2px 10px",
        marginBottom: 10,
      }}
    >
      {SEARCH_TABS.map((t) => {
        const active = t === tab;
        const dormant = !TAB_ACTIVE[t];
        return (
          <Link
            key={t}
            href={hrefFor({ q: query, tab: t, category, page: 1 })}
            aria-current={active ? "page" : undefined}
            style={{
              flex: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "8px 11px",
              borderRadius: 999,
              border: "1.5px solid transparent",
              background: active
                ? `${NEX.orange}1F padding-box, ${RIM_GRADIENT} border-box`
                : `rgba(255,255,255,0.03) padding-box, ${RIM_CYAN_ONLY} border-box`,
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              color: active ? NEX.text : dormant ? NEX.textMuted : NEX.textDim,
              fontSize: 12.5,
              fontWeight: active ? 700 : 600,
              textDecoration: "none",
              letterSpacing: "0.01em",
              boxShadow: active
                ? `inset 0 1px 0 rgba(255,255,255,0.12), 0 0 14px ${NEX.orange}33, 0 0 16px ${NEX.cyan}22`
                : "inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            {TAB_LABEL[t]}
            {dormant && (
              <span
                aria-hidden
                aria-label="coming later"
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 999,
                  background: NEX.cyan,
                  opacity: 0.55,
                  display: "inline-block",
                }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════════════════ *
 * Dormant panel · honest "coming" state                               *
 * ═══════════════════════════════════════════════════════════════════ */

function DormantPanel({ tab }: { tab: SearchTab }): React.JSX.Element {
  const copy = TAB_DORMANT_COPY[tab];
  if (!copy) return <></>;
  return (
    <section
      aria-live="polite"
      style={{
        marginTop: 24,
        padding: "40px 24px",
        borderRadius: 20,
        border: "1.5px solid transparent",
        background: `rgba(255,255,255,0.04) padding-box, ${RIM_CYAN_ONLY} border-box`,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        textAlign: "center",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 24px rgba(0,0,0,0.3)",
      }}
    >
      <div
        aria-hidden
        style={{
          margin: "0 auto 14px",
          width: 60,
          height: 60,
          borderRadius: 20,
          border: "1.5px solid transparent",
          background: `${NEX.cyan}1A padding-box, ${RIM_CYAN_ONLY} border-box`,
          color: NEX.cyan,
          display: "grid",
          placeItems: "center",
        }}
      >
        {tab === "companies" && <CompaniesGlyph />}
        {tab === "services" && <ServicesGlyph />}
        {tab === "places" && <PlacesGlyph />}
      </div>
      <h2
        style={{
          margin: 0,
          fontSize: 17,
          fontWeight: 700,
          color: NEX.text,
          letterSpacing: "-0.005em",
        }}
      >
        {copy.title}
      </h2>
      <p
        style={{
          margin: "8px auto 0",
          maxWidth: 420,
          fontSize: 13,
          color: NEX.textDim,
          lineHeight: 1.55,
        }}
      >
        {copy.body}
      </p>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════ *
 * Landing body · discovery shortcuts + popular tags                   *
 * ═══════════════════════════════════════════════════════════════════ */

function LandingBody({
  popularTags,
  hrefFor,
}: {
  popularTags: Array<{ tag: string; count: number }>;
  hrefFor: (opts: { q?: string; tab?: SearchTab; category?: string; page?: number }) => string;
}): React.JSX.Element {
  // Discovery shortcuts · only categories backed by actual data today.
  // Shops + Products are the only verticals with real content. The
  // other visions (Hotels, Things to do, Companies, Services) stay
  // represented in the dormant tabs above but we do NOT render shortcut
  // tiles that lead to empty searches.
  const shortcuts = [
    {
      icon: <ShopsGlyph />,
      title: "Shops & products",
      body: "Browse live shops and the products on them.",
      href: hrefFor({ q: "", tab: "shops", category: "", page: 1 }),
    },
  ];
  return (
    <div style={{ marginTop: 10 }}>
      <section
        aria-label="Discovery shortcuts"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {shortcuts.map((s) => (
          <Link
            key={s.title}
            href={s.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "16px 16px",
              borderRadius: 18,
              border: "1.5px solid transparent",
              background: `rgba(255,255,255,0.05) padding-box, ${RIM_GRADIENT} border-box`,
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              color: NEX.text,
              textDecoration: "none",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 20px rgba(0,0,0,0.3), 0 0 16px rgba(255,114,0,0.08), 0 0 18px rgba(0,175,255,0.08)",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                border: "1.5px solid transparent",
                background: `${NEX.orange}1F padding-box, ${RIM_GRADIENT} border-box`,
                color: NEX.orange,
                display: "grid",
                placeItems: "center",
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.14), 0 0 14px ${NEX.orange}33`,
              }}
            >
              {s.icon}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{s.title}</div>
              <div style={{ fontSize: 12.5, color: NEX.textDim, marginTop: 2 }}>
                {s.body}
              </div>
            </div>
            <span aria-hidden style={{ color: NEX.cyan, fontSize: 18 }}>→</span>
          </Link>
        ))}
      </section>

      {popularTags.length > 0 && (
        <section aria-label="Popular tags" style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 10.5,
              color: NEX.textDim,
              letterSpacing: "0.2em",
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            POPULAR TAGS
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {popularTags.map(({ tag, count }) => (
              <Link
                key={tag}
                href={hrefFor({ q: tag, tab: "all", category: "", page: 1 })}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1.5px solid transparent",
                  background: `rgba(255,255,255,0.03) padding-box, ${RIM_CYAN_ONLY} border-box`,
                  color: NEX.cyan,
                  fontSize: 12.5,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                {tag}
                <span style={{ color: NEX.textMuted, fontSize: 10.5 }}>
                  {count}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Honest footer · tells the user what the surface will become
       *  without implying any dates. Matches the dormant tabs' tone. */}
      <section
        aria-label="About NEX Search"
        style={{
          padding: "16px 18px",
          borderRadius: 16,
          border: `1px solid ${NEX.cyanFaint}`,
          background: "rgba(0,175,255,0.03)",
          color: NEX.textDim,
          fontSize: 12.5,
          lineHeight: 1.6,
        }}
      >
        NEX Search will grow into a universal discovery experience
        covering places, people, products, services and experiences.
        Right now it surfaces live NEX shops and products. Other
        verticals arrive as the data and infrastructure land.
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ *
 * Results body · landscape glass cards                                *
 * ═══════════════════════════════════════════════════════════════════ */

function ResultsBody({
  tab,
  query,
  productsPaged,
  businessesPaged,
  productCount,
  businessCount,
  page,
  hasPrev,
  hasNext,
  productBizById,
  hrefFor,
}: {
  tab: SearchTab;
  query: string;
  category: string;
  productsPaged: NexProductRow[];
  businessesPaged: NexBusinessRow[];
  shopIds: Set<string>;
  productBizById: Map<string, NexBusinessRow>;
  productCount: number;
  businessCount: number;
  page: number;
  hasPrev: boolean;
  hasNext: boolean;
  hrefFor: (opts: { q?: string; tab?: SearchTab; category?: string; page?: number }) => string;
}): React.JSX.Element {
  const combinedEmpty =
    productsPaged.length === 0 && businessesPaged.length === 0;

  return (
    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 20 }}>
      <ResultsSummary
        tab={tab}
        productCount={productCount}
        businessCount={businessCount}
        productsOnThisPage={productsPaged.length}
        businessesOnThisPage={businessesPaged.length}
      />

      {combinedEmpty ? (
        <EmptyState query={query} tab={tab} />
      ) : (
        <>
          {businessesPaged.length > 0 && (
            <section aria-label="Businesses">
              <SectionHeader label={tab === "shops" ? "Shops" : "Businesses"} count={businessesPaged.length} />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {businessesPaged.map((b) => (
                  <GlassBusinessCard key={b.id} business={b} />
                ))}
              </div>
            </section>
          )}

          {productsPaged.length > 0 && (
            <section aria-label="Products">
              <SectionHeader label="Products" count={productsPaged.length} />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {productsPaged.map((p) => {
                  const biz = productBizById.get(p.business_id);
                  return (
                    <GlassProductCard key={p.id} product={p} business={biz ?? null} />
                  );
                })}
              </div>
            </section>
          )}

          <Pagination
            page={page}
            hasPrev={hasPrev}
            hasNext={hasNext}
            prevHref={hrefFor({ page: page - 1 })}
            nextHref={hrefFor({ page: page + 1 })}
          />
        </>
      )}
    </div>
  );
}

function ResultsSummary({
  tab,
  productCount,
  businessCount,
  productsOnThisPage,
  businessesOnThisPage,
}: {
  tab: SearchTab;
  productCount: number;
  businessCount: number;
  productsOnThisPage: number;
  businessesOnThisPage: number;
}): React.JSX.Element {
  const parts: string[] = [];
  if (tab === "all") {
    if (businessCount > 0) {
      parts.push(`${businessCount} ${businessCount === 1 ? "business" : "businesses"}`);
    }
    if (productCount > 0) {
      parts.push(`${productCount} ${productCount === 1 ? "product" : "products"}`);
    }
  } else if (tab === "shops") {
    // Count comes from countShops() · reflects the pre-filtered
    // universe of businesses-with-live-products that match the query.
    if (businessCount > 0) {
      parts.push(
        `${businessCount} ${businessCount === 1 ? "shop" : "shops"} with live products`,
      );
    }
  }
  if (parts.length === 0) {
    void productsOnThisPage;
    void businessesOnThisPage;
    return (
      <div style={{ fontSize: 12, color: NEX.textDim }}>
        {tab === "shops"
          ? "Shops are businesses with at least one live product on NEX."
          : "No results."}
      </div>
    );
  }
  return (
    <div
      style={{
        fontSize: 12,
        color: NEX.textDim,
        letterSpacing: "0.02em",
      }}
    >
      {parts.join(" · ")}
    </div>
  );
}

function SectionHeader({
  label,
  count,
}: {
  label: string;
  count: number;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: 10,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.2em",
          color: NEX.textDim,
          textTransform: "uppercase",
        }}
      >
        {label}
      </h2>
      <span style={{ fontSize: 11, color: NEX.textMuted }}>{count}</span>
    </div>
  );
}

function EmptyState({ query, tab }: { query: string; tab: SearchTab }): React.JSX.Element {
  return (
    <section
      style={{
        marginTop: 10,
        padding: "32px 20px",
        borderRadius: 18,
        border: "1.5px solid transparent",
        background: `rgba(255,255,255,0.04) padding-box, ${RIM_CYAN_ONLY} border-box`,
        textAlign: "center",
      }}
    >
      <div
        style={{
          margin: "0 auto 10px",
          width: 48,
          height: 48,
          borderRadius: 14,
          border: `1.5px solid ${NEX.cyan}44`,
          background: `${NEX.cyan}1A`,
          color: NEX.cyan,
          display: "grid",
          placeItems: "center",
        }}
      >
        <SearchGlyph tint={NEX.cyan} />
      </div>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
        No results{query ? ` for “${query}”` : ""}
      </h3>
      <p
        style={{
          margin: "6px auto 0",
          maxWidth: 360,
          fontSize: 12.5,
          color: NEX.textDim,
          lineHeight: 1.5,
        }}
      >
        {tab === "shops"
          ? "Try removing a filter, broadening the query, or switching to All."
          : "Try a different query or check the spelling."}
      </p>
    </section>
  );
}

function Pagination({
  page,
  hasPrev,
  hasNext,
  prevHref,
  nextHref,
}: {
  page: number;
  hasPrev: boolean;
  hasNext: boolean;
  prevHref: string;
  nextHref: string;
}): React.JSX.Element {
  if (!hasPrev && !hasNext) return <></>;
  return (
    <nav
      aria-label="Pagination"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginTop: 8,
      }}
    >
      {hasPrev ? (
        <Link href={prevHref} style={pagerLinkStyle(true)}>
          ← Prev
        </Link>
      ) : (
        <span style={pagerLinkStyle(false)}>← Prev</span>
      )}
      <span style={{ fontSize: 12, color: NEX.textDim, letterSpacing: "0.02em" }}>
        Page {page}
      </span>
      {hasNext ? (
        <Link href={nextHref} style={pagerLinkStyle(true)}>
          Next →
        </Link>
      ) : (
        <span style={pagerLinkStyle(false)}>Next →</span>
      )}
    </nav>
  );
}

function pagerLinkStyle(enabled: boolean): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "9px 16px",
    borderRadius: 999,
    border: "1.5px solid transparent",
    background: enabled
      ? `rgba(255,255,255,0.04) padding-box, ${RIM_GRADIENT} border-box`
      : "transparent",
    color: enabled ? NEX.text : NEX.textMuted,
    fontSize: 12.5,
    fontWeight: 600,
    textDecoration: "none",
    cursor: enabled ? "pointer" : "not-allowed",
    pointerEvents: enabled ? "auto" : "none",
    opacity: enabled ? 1 : 0.4,
    fontFamily: "inherit",
  };
}

/* ═══════════════════════════════════════════════════════════════════ *
 * Glass cards · landscape, image + content block + CTA                *
 * ═══════════════════════════════════════════════════════════════════ */

function GlassBusinessCard({ business }: { business: NexBusinessRow }): React.JSX.Element {
  const b = business as NexBusinessRow & {
    city?: string | null;
    business_category?: string | null;
    verified_at?: string | null;
  };
  return (
    <Link
      href={`/nex-native/${business.slug}`}
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: 14,
        padding: "14px 14px",
        borderRadius: 18,
        border: "1.5px solid transparent",
        background: `rgba(255,255,255,0.05) padding-box, ${RIM_GRADIENT} border-box`,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        color: NEX.text,
        textDecoration: "none",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 20px rgba(0,0,0,0.35), 0 0 16px rgba(255,114,0,0.07), 0 0 20px rgba(0,175,255,0.07)",
      }}
    >
      <CardImage src={business.logo_url ?? null} alt={business.display_name} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span
            style={{
              fontSize: 15.5,
              fontWeight: 700,
              letterSpacing: "-0.005em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {business.display_name}
          </span>
          {b.verified_at && (
            <span
              aria-label="Verified"
              title="Verified business"
              style={{
                flex: "none",
                fontSize: 10,
                color: NEX.cyan,
                padding: "2px 7px",
                borderRadius: 999,
                border: `1px solid ${NEX.cyan}66`,
                background: NEX.cyanSoft,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              ✓
            </span>
          )}
        </div>
        {b.business_category && (
          <div
            style={{
              fontSize: 12,
              color: NEX.cyan,
              fontWeight: 600,
              letterSpacing: "0.02em",
              textTransform: "capitalize",
            }}
          >
            {b.business_category.replace(/-/g, " ")}
          </div>
        )}
        {business.description && (
          <div
            style={{
              fontSize: 12.5,
              color: NEX.textDim,
              lineHeight: 1.45,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {business.description}
          </div>
        )}
        {b.city && (
          <div style={{ fontSize: 11.5, color: NEX.textMuted, marginTop: 2 }}>
            {b.city}
          </div>
        )}
      </div>
      <span
        aria-hidden
        style={{
          alignSelf: "center",
          color: NEX.orange,
          fontSize: 18,
          flex: "none",
        }}
      >
        →
      </span>
    </Link>
  );
}

function GlassProductCard({
  product,
  business,
}: {
  product: NexProductRow;
  business: NexBusinessRow | null;
}): React.JSX.Element {
  const price =
    typeof product.price_pence === "number" && product.price_pence > 0
      ? formatPrice(product.price_pence, product.currency)
      : null;
  return (
    <Link
      href={business ? `/nex-native/${business.slug}` : `/nex-native/search`}
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: 14,
        padding: "14px 14px",
        borderRadius: 18,
        border: "1.5px solid transparent",
        background: `rgba(255,255,255,0.04) padding-box, ${RIM_CYAN_ONLY} border-box`,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        color: NEX.text,
        textDecoration: "none",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.06), 0 6px 16px rgba(0,0,0,0.3)",
      }}
    >
      <CardImage src={product.image_url ?? null} alt={product.name} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ fontSize: 10.5, color: NEX.textDim, letterSpacing: "0.12em", fontWeight: 700 }}>
          PRODUCT
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "-0.005em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {product.name}
        </div>
        {business && (
          <div style={{ fontSize: 12, color: NEX.cyan, fontWeight: 600 }}>
            at {business.display_name}
          </div>
        )}
        {product.description && (
          <div
            style={{
              fontSize: 12.5,
              color: NEX.textDim,
              lineHeight: 1.45,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {product.description}
          </div>
        )}
      </div>
      <div
        style={{
          alignSelf: "center",
          color: NEX.orange,
          fontSize: 14,
          fontWeight: 700,
          flex: "none",
          textAlign: "right",
          minWidth: 60,
        }}
      >
        {price ?? "→"}
      </div>
    </Link>
  );
}

function CardImage({
  src,
  alt,
}: {
  src: string | null;
  alt: string;
}): React.JSX.Element {
  return (
    <span
      aria-hidden={!src}
      style={{
        width: 72,
        height: 72,
        borderRadius: 14,
        flex: "none",
        overflow: "hidden",
        background: src
          ? `url(${src}) center/cover`
          : `linear-gradient(135deg, ${NEX.orange}22, ${NEX.cyan}22)`,
        border: `1.5px solid ${NEX.cyan}22`,
        display: "grid",
        placeItems: "center",
        color: NEX.textDim,
        fontSize: 20,
      }}
    >
      {!src && <ShopsGlyph />}
      {src && <span style={{ display: "none" }}>{alt}</span>}
    </span>
  );
}

function formatPrice(pence: number, currency: string | null | undefined): string {
  // Lightweight · lean on the currency string. Never fabricate.
  const amount = pence / 100;
  const c = (currency ?? "").toUpperCase();
  if (c === "IDR") return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
  if (c === "GBP") return `£${amount.toFixed(2)}`;
  if (c === "USD") return `$${amount.toFixed(2)}`;
  if (c === "EUR") return `€${amount.toFixed(2)}`;
  if (!c) return `${amount.toFixed(2)}`;
  return `${c} ${amount.toFixed(2)}`;
}

/* ═══════════════════════════════════════════════════════════════════ *
 * Inline glyphs · no external SVG dependency                          *
 * ═══════════════════════════════════════════════════════════════════ */

function SearchGlyph({ tint }: { tint: string }): React.JSX.Element {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none"
         stroke={tint} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx={11} cy={11} r={7} />
      <line x1={21} y1={21} x2={16.65} y2={16.65} />
    </svg>
  );
}
function ShopsGlyph(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7h18l-1.5 11a2 2 0 0 1-2 1.75H6.5A2 2 0 0 1 4.5 18L3 7z" />
      <path d="M8 7V5a4 4 0 0 1 8 0v2" />
    </svg>
  );
}
function CompaniesGlyph(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x={3} y={6} width={18} height={14} rx={2} />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1={3} y1={11} x2={21} y2={11} />
    </svg>
  );
}
function ServicesGlyph(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14.7 6.3a4 4 0 0 1 5.3 5.3L10.5 21.1 3 22l.9-7.5L14.7 6.3z" />
    </svg>
  );
}
function PlacesGlyph(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" />
      <circle cx={12} cy={10} r={2.4} />
    </svg>
  );
}
