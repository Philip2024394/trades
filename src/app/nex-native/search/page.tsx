// src/app/nex-native/search/page.tsx
//
// NEX Search · Phase 1.5 visual refresh · 2026-10-04.
// --------------------------------------------------
// Landing + results surface built to the sealed design pair:
//   · c:\Users\Victus\Pictures\pagesearch.png         (landing)
//   · c:\Users\Victus\Pictures\search page results.png (results)
//
// What this refresh changes from Phase 1 (shipped 7297d2e6):
//   · Hero title simplified to "NEX Search" (orange NEX + white Search)
//   · Search field flattened · dark pill · no gradient rim
//   · Tab set DIFFERS between landing and results per the design:
//       Landing · All | Companies | Services | Places
//       Results · All results | Shops | Companies | Wholesale
//   · Shops demoted from a landing tab to an Explore tile
//     (still searchable on results via the Shops sub-tab)
//   · 2×2 "Explore NEX" grid replaces the single shortcut card
//   · Example queries row shown on landing only (static illustrative
//     copy, not clickable prefill)
//   · Landscape result cards redesigned · thumbnail + name + meta
//     line (type · city) + description + chip rows + "View shop →" /
//     "View company →" CTA
//
// What stays sealed from Phase 1:
//   · NEX_SEARCH_ENABLED narrow launch gate · commerce flag untouched
//   · Companies / Services / Places / Wholesale tabs honestly dormant
//     where backing data is empty · tapping lands on a "coming later"
//     panel · no fabricated results, no misleading classifications
//   · Theme scope boundary · search renders NEX only, never a theme
//   · Discovery-service calls unchanged · no new DB queries required
//   · Preserved ?q=, ?tab=, ?category=, ?page=, ?search= semantics

import type * as React from "react";
import Link from "next/link";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as discoveryService from "@/lib/nex-native/discovery-service";
import { NEX_BUSINESS_CATEGORIES } from "@/lib/nex-native/site-templates";
import type { NexBusinessRow, NexProductRow } from "@/lib/nex-native/types";
import { NexPageHeader } from "../_page-header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ─── Palette · aligned to NEX brand + mock design ───────────────── */
const NEX = {
  bg: "#020914",
  surface: "#0E1526",      // dark pills + card backgrounds
  surfaceHi: "#182540",     // chip row background
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  textSoft: "#4B6683",
  orange: "#FF7200",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0,175,255,0.06)",
  darkRed: "#991B1B",
  divider: "rgba(255,255,255,0.08)",
  borderSoft: "rgba(255,255,255,0.06)",
};

/* ─── Tabs ───────────────────────────────────────────────────────── */
// Landing (no query) tab set · 4 entry-point categories.
type LandingTab = "all" | "companies" | "services" | "places";
const LANDING_TABS: readonly LandingTab[] = ["all", "companies", "services", "places"];
const LANDING_TAB_LABEL: Record<LandingTab, string> = {
  all: "All",
  companies: "Companies",
  services: "Services",
  places: "Places",
};
// Only "all" is active today. Companies / Services / Places are dormant
// (0 companies classified · 0 services · no place provider).
const LANDING_TAB_ACTIVE: Record<LandingTab, boolean> = {
  all: true,
  companies: false,
  services: false,
  places: false,
};

// Results (query present) tab set · 4 result-filtering chips.
type ResultTab = "all" | "shops" | "companies" | "wholesale";
const RESULT_TABS: readonly ResultTab[] = ["all", "shops", "companies", "wholesale"];
const RESULT_TAB_LABEL: Record<ResultTab, string> = {
  all: "All results",
  shops: "Shops",
  companies: "Companies",
  wholesale: "Wholesale",
};
// All + Shops operate on real data today. Companies + Wholesale are
// dormant (no classification coverage · no reliable wholesale signal).
const RESULT_TAB_ACTIVE: Record<ResultTab, boolean> = {
  all: true,
  shops: true,
  companies: false,
  wholesale: false,
};

const DORMANT_COPY: Record<string, { title: string; body: string }> = {
  companies: {
    title: "Company discovery coming later",
    body: "Business categories are still being added. Company discovery will be available as more businesses complete their profiles.",
  },
  services: {
    title: "Service discovery coming later",
    body: "Independent professionals and service providers will be discoverable once services are added to NEX.",
  },
  places: {
    title: "Place discovery coming later",
    body: "Restaurants, hotels, tourist destinations and other places will be discoverable in a future update.",
  },
  wholesale: {
    title: "Wholesale filter coming later",
    body: "The wholesale filter will activate once businesses declare their wholesale offering reliably across the directory.",
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

  // NEX Search Phase 1 launch gate (sealed 2026-10-04 · unchanged).
  const { searchEnabledForRequest } = await import(
    "@/lib/nex-native/launch-flags"
  );
  if (!searchEnabledForRequest(sp)) {
    const { redirect } = await import("next/navigation");
    redirect("/nex-native/home");
  }

  const rawQuery = (sp.q ?? "").trim();
  const query = rawQuery.length > 100 ? rawQuery.slice(0, 100) : rawQuery;
  const rawTab = (sp.tab ?? "all").trim().toLowerCase();
  const rawCategory = (sp.category ?? "").trim().toLowerCase();
  const category =
    rawCategory && SAFE_CATEGORIES.includes(rawCategory) ? rawCategory : "";
  const pageRaw = Number(sp.page ?? "1");
  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const offset = (page - 1) * PAGE_SIZE;

  await resolveNexAppSessionFromContext();

  const hasSearch = query.length > 0 || category.length > 0;

  // Validate the tab against the right set for the current mode.
  // Switching from landing → results reinterprets `?tab=` so an
  // explicit landing tab still works on the way in.
  let tab: LandingTab | ResultTab = "all";
  if (hasSearch) {
    tab = (RESULT_TABS as readonly string[]).includes(rawTab)
      ? (rawTab as ResultTab)
      : "all";
  } else {
    tab = (LANDING_TABS as readonly string[]).includes(rawTab)
      ? (rawTab as LandingTab)
      : "all";
  }
  const activeMap = hasSearch ? RESULT_TAB_ACTIVE : LANDING_TAB_ACTIVE;
  const isDormantTab = !activeMap[tab as keyof typeof activeMap];

  // ── Data fetch ────────────────────────────────────────────────────
  let errorMsg: string | null = null;
  let products: NexProductRow[] = [];
  let businesses: NexBusinessRow[] = [];
  let productCount = 0;
  let businessCount = 0;

  if (hasSearch && !isDormantTab) {
    try {
      const businessFilter = category ? { category } : {};
      if (tab === "shops") {
        [businesses, businessCount] = await Promise.all([
          discoveryService.searchShops(
            query,
            { limit: PAGE_SIZE, offset },
            businessFilter,
          ),
          discoveryService.countShops(query, businessFilter),
        ]);
      } else {
        [products, businesses, productCount, businessCount] = await Promise.all([
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

  const productsPaged = tab === "all" ? products : [];
  const businessesPaged = (tab === "all" || tab === "shops") ? businesses : [];
  const hasNextProducts =
    tab === "all" && offset + products.length < productCount;
  const hasNextBusinesses =
    (tab === "all" || tab === "shops") &&
    offset + businessesPaged.length < businessCount;
  const hasPrev = page > 1 && !isDormantTab;
  const hasNext = (hasNextProducts || hasNextBusinesses) && !isDormantTab;

  // Enrich product rows with their parent business for the "View shop" link.
  const productBizIds = Array.from(new Set(productsPaged.map((p) => p.business_id)));
  const productBizRows = await Promise.all(
    productBizIds.map((id) => businessService.getBusinessById(id)),
  );
  const productBizById = new Map(
    productBizRows.filter(Boolean).map((b) => [b!.id, b!]),
  );

  // Popular tags only on the landing · All tab (unchanged behaviour).
  let popularTags: Array<{ tag: string; count: number }> = [];
  if (!hasSearch && tab === "all") {
    popularTags = await discoveryService.getPopularTags(12).catch(() => []);
  }

  function hrefFor(opts: {
    q?: string;
    tab?: string;
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
          style={{ position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto" }}
        >
          <NexPageHeader dataScope="search" />

          {hasSearch ? (
            <ResultsHeading query={query} />
          ) : (
            <LandingHero />
          )}

          <SearchForm
            query={query}
            hasSearch={hasSearch}
            tab={tab}
            category={category}
          />

          {hasSearch ? (
            <ResultsTabBar activeTab={tab as ResultTab} query={query} category={category} hrefFor={hrefFor} />
          ) : (
            <LandingTabBar activeTab={tab as LandingTab} query={query} category={category} hrefFor={hrefFor} />
          )}

          {!hasSearch && <ExampleQueriesRow />}

          {errorMsg && <ErrorBanner message={errorMsg} />}

          {isDormantTab ? (
            <DormantPanel tabKey={tab} />
          ) : hasSearch ? (
            <ResultsBody
              productsPaged={productsPaged}
              businessesPaged={businessesPaged}
              productBizById={productBizById}
              productCount={productCount}
              businessCount={businessCount}
              tab={tab as ResultTab}
              query={query}
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
 * Landing hero · "NEX Search" + tagline                               *
 * ═══════════════════════════════════════════════════════════════════ */

function LandingHero(): React.JSX.Element {
  return (
    <header
      style={{ textAlign: "center", margin: "22px 0 18px", position: "relative", zIndex: 2 }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          lineHeight: 1,
        }}
      >
        <span style={{ color: NEX.orange }}>NEX</span>{" "}
        <span style={{ color: NEX.text }}>Search</span>
      </h1>
      <p
        style={{
          margin: "12px auto 0",
          maxWidth: 460,
          fontSize: 14.5,
          color: NEX.textDim,
          lineHeight: 1.5,
        }}
      >
        Find businesses, products, services and places
      </p>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════════ *
 * Results heading · query echoed back as a title                      *
 * ═══════════════════════════════════════════════════════════════════ */

function ResultsHeading({ query }: { query: string }): React.JSX.Element {
  return (
    <header style={{ margin: "22px 0 14px", position: "relative", zIndex: 2 }}>
      <h1
        style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 700,
          color: NEX.text,
          letterSpacing: "-0.005em",
        }}
      >
        {query || "Search results"}
      </h1>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════════ *
 * Search form · flat dark pill · mic honestly muted                   *
 * ═══════════════════════════════════════════════════════════════════ */

function SearchForm({
  query,
  hasSearch,
  tab,
  category,
}: {
  query: string;
  hasSearch: boolean;
  tab: string;
  category: string;
}): React.JSX.Element {
  return (
    <form
      action="/nex-native/search"
      method="get"
      style={{
        display: "flex",
        margin: "0 0 14px",
        position: "relative",
        zIndex: 2,
      }}
    >
      {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
      {category && <input type="hidden" name="category" value={category} />}
      <label
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          borderRadius: 999,
          background: NEX.surface,
          border: `1px solid ${NEX.borderSoft}`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
        }}
      >
        <SearchGlyph tint={NEX.orange} />
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
        {hasSearch ? (
          // Results · a quiet filter affordance (visual only · the
          // sub-tab row below carries the real filter controls today).
          <span
            aria-hidden
            title="Filters"
            style={{
              display: "grid",
              placeItems: "center",
              width: 32,
              height: 32,
              borderRadius: 999,
              color: NEX.textMuted,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <FilterGlyph />
          </span>
        ) : (
          // Landing · honestly-muted mic icon. No handler. aria-label
          // tells screen readers it's not yet active. Zero fake action.
          <span
            aria-label="Voice search coming later"
            title="Voice search coming later"
            style={{
              display: "grid",
              placeItems: "center",
              width: 32,
              height: 32,
              borderRadius: 999,
              color: NEX.textSoft,
              opacity: 0.6,
            }}
          >
            <MicGlyph />
          </span>
        )}
      </label>
    </form>
  );
}

/* ═══════════════════════════════════════════════════════════════════ *
 * Tab bars · landing vs results                                       *
 * ═══════════════════════════════════════════════════════════════════ */

function LandingTabBar({
  activeTab,
  query,
  category,
  hrefFor,
}: {
  activeTab: LandingTab;
  query: string;
  category: string;
  hrefFor: (opts: { q?: string; tab?: string; category?: string; page?: number }) => string;
}): React.JSX.Element {
  return (
    <TabRow>
      {LANDING_TABS.map((t) => {
        const active = t === activeTab;
        const dormant = !LANDING_TAB_ACTIVE[t];
        return (
          <TabChip
            key={t}
            active={active}
            dormant={dormant}
            href={hrefFor({ q: query, tab: t, category, page: 1 })}
            label={LANDING_TAB_LABEL[t]}
          />
        );
      })}
    </TabRow>
  );
}

function ResultsTabBar({
  activeTab,
  query,
  category,
  hrefFor,
}: {
  activeTab: ResultTab;
  query: string;
  category: string;
  hrefFor: (opts: { q?: string; tab?: string; category?: string; page?: number }) => string;
}): React.JSX.Element {
  return (
    <TabRow>
      {RESULT_TABS.map((t) => {
        const active = t === activeTab;
        const dormant = !RESULT_TAB_ACTIVE[t];
        return (
          <TabChip
            key={t}
            active={active}
            dormant={dormant}
            href={hrefFor({ q: query, tab: t, category, page: 1 })}
            label={RESULT_TAB_LABEL[t]}
          />
        );
      })}
    </TabRow>
  );
}

function TabRow({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <nav
      aria-label="Search categories"
      style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        padding: "2px 2px 10px",
        margin: "0 0 4px",
        position: "relative",
        zIndex: 2,
      }}
    >
      {children}
    </nav>
  );
}

function TabChip({
  active,
  dormant,
  href,
  label,
}: {
  active: boolean;
  dormant: boolean;
  href: string;
  label: string;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      style={{
        flex: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "9px 16px",
        borderRadius: 999,
        background: active ? NEX.orange : NEX.surface,
        color: active ? "#0a0608" : dormant ? NEX.textSoft : NEX.textDim,
        fontSize: 13,
        fontWeight: active ? 700 : 600,
        textDecoration: "none",
        letterSpacing: "0.005em",
        border: `1px solid ${active ? NEX.orange : NEX.borderSoft}`,
      }}
    >
      {label}
      {dormant && !active && (
        <span
          aria-hidden
          style={{
            width: 4,
            height: 4,
            borderRadius: 999,
            background: NEX.cyan,
            opacity: 0.6,
          }}
        />
      )}
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════════════════ *
 * Example queries row · static illustrative copy (never prefills)     *
 * ═══════════════════════════════════════════════════════════════════ */

function ExampleQueriesRow(): React.JSX.Element {
  const examples = [
    "Restaurants near me",
    "Handbag suppliers in Jakarta",
    "Electrician in Yogyakarta",
  ];
  return (
    <p
      style={{
        margin: "4px 0 18px",
        textAlign: "center",
        fontSize: 12.5,
        color: NEX.textMuted,
        lineHeight: 1.5,
      }}
    >
      Try:{" "}
      {examples.map((e, i) => (
        <span key={e}>
          <span style={{ color: NEX.textDim }}>&ldquo;{e}&rdquo;</span>
          {i < examples.length - 1 && (
            <span style={{ color: NEX.textSoft }}> · </span>
          )}
        </span>
      ))}
    </p>
  );
}

/* ═══════════════════════════════════════════════════════════════════ *
 * Landing body · Explore NEX 2×2 grid + popular tags                  *
 * ═══════════════════════════════════════════════════════════════════ */

function LandingBody({
  popularTags,
  hrefFor,
}: {
  popularTags: Array<{ tag: string; count: number }>;
  hrefFor: (opts: { q?: string; tab?: string; category?: string; page?: number }) => string;
}): React.JSX.Element {
  // Explore grid · four tiles. Only "Shops & products" lands on real
  // data today. The other three route to their dormant tabs so the
  // honest "coming later" panel surfaces · never a fabricated result.
  const exploreTiles: Array<{
    label: string;
    glyph: React.ReactNode;
    href: string;
    dormant: boolean;
  }> = [
    {
      label: "Shops & products",
      glyph: <ShopsGlyph />,
      href: hrefFor({ q: "shops", tab: "shops", page: 1 }),
      dormant: false,
    },
    {
      label: "Skilled services",
      glyph: <ServicesGlyph />,
      href: hrefFor({ tab: "services" }),
      dormant: true,
    },
    {
      label: "Places near you",
      glyph: <PlacesGlyph />,
      href: hrefFor({ tab: "places" }),
      dormant: true,
    },
    {
      label: "Companies & suppliers",
      glyph: <CompaniesGlyph />,
      href: hrefFor({ tab: "companies" }),
      dormant: true,
    },
  ];
  return (
    <div style={{ marginTop: 8 }}>
      <HairlineDivider />
      <section aria-label="Explore NEX" style={{ margin: "22px 0 8px" }}>
        <h2
          style={{
            margin: "0 0 16px",
            fontSize: 16,
            fontWeight: 700,
            color: NEX.text,
            textAlign: "center",
            letterSpacing: "0.005em",
          }}
        >
          Explore NEX
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 12,
          }}
        >
          {exploreTiles.map((t) => (
            <ExploreTile key={t.label} {...t} />
          ))}
        </div>
      </section>

      {popularTags.length > 0 && (
        <section aria-label="Popular tags" style={{ marginTop: 28 }}>
          <div
            style={{
              fontSize: 10.5,
              color: NEX.textMuted,
              letterSpacing: "0.2em",
              fontWeight: 700,
              marginBottom: 12,
              textAlign: "center",
            }}
          >
            POPULAR TAGS
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              justifyContent: "center",
            }}
          >
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
                  background: NEX.surface,
                  border: `1px solid ${NEX.borderSoft}`,
                  color: NEX.textDim,
                  fontSize: 12.5,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                {tag}
                <span style={{ color: NEX.textSoft, fontSize: 10.5 }}>{count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section
        aria-label="About NEX Search"
        style={{
          margin: "32px 0 0",
          padding: "16px 18px",
          borderRadius: 14,
          background: NEX.cyanFaint,
          border: `1px solid ${NEX.borderSoft}`,
          color: NEX.textDim,
          fontSize: 12.5,
          lineHeight: 1.55,
          textAlign: "center",
        }}
      >
        NEX Search will grow into a universal discovery experience across
        places, people, products, services and experiences. Today it surfaces
        live NEX shops and products. Other verticals arrive as the data and
        infrastructure land.
      </section>
    </div>
  );
}

function ExploreTile({
  label,
  glyph,
  href,
  dormant,
}: {
  label: string;
  glyph: React.ReactNode;
  href: string;
  dormant: boolean;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "22px 14px",
        borderRadius: 16,
        background: NEX.surface,
        border: `1px solid ${NEX.borderSoft}`,
        color: NEX.text,
        textDecoration: "none",
        minHeight: 110,
        opacity: dormant ? 0.78 : 1,
      }}
    >
      <span aria-hidden style={{ color: NEX.orange }}>{glyph}</span>
      <span
        style={{
          fontSize: 14.5,
          fontWeight: 700,
          color: NEX.text,
          textAlign: "center",
          letterSpacing: "0.005em",
        }}
      >
        {label}
      </span>
      {dormant && (
        <span
          aria-label="coming later"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            fontSize: 9,
            letterSpacing: "0.18em",
            color: NEX.cyan,
            fontWeight: 700,
            opacity: 0.7,
          }}
        >
          SOON
        </span>
      )}
    </Link>
  );
}

function HairlineDivider(): React.JSX.Element {
  return (
    <div
      aria-hidden
      style={{
        height: 1,
        margin: "4px 0 0",
        background: NEX.divider,
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════ *
 * Dormant panel · honest "coming later" state                         *
 * ═══════════════════════════════════════════════════════════════════ */

function DormantPanel({ tabKey }: { tabKey: string }): React.JSX.Element {
  const copy = DORMANT_COPY[tabKey];
  if (!copy) return <></>;
  return (
    <section
      aria-live="polite"
      style={{
        marginTop: 18,
        padding: "32px 24px",
        borderRadius: 16,
        background: NEX.surface,
        border: `1px solid ${NEX.borderSoft}`,
        textAlign: "center",
      }}
    >
      <div
        aria-hidden
        style={{
          margin: "0 auto 14px",
          width: 54,
          height: 54,
          borderRadius: 14,
          background: NEX.surfaceHi,
          color: NEX.cyan,
          display: "grid",
          placeItems: "center",
          border: `1px solid ${NEX.cyan}22`,
        }}
      >
        <SearchGlyph tint={NEX.cyan} />
      </div>
      <h2
        style={{
          margin: 0,
          fontSize: 16,
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
 * Results body · landscape result cards + pagination                  *
 * ═══════════════════════════════════════════════════════════════════ */

function ResultsBody({
  productsPaged,
  businessesPaged,
  productBizById,
  businessCount,
  productCount,
  tab,
  query,
  page,
  hasPrev,
  hasNext,
  hrefFor,
}: {
  productsPaged: NexProductRow[];
  businessesPaged: NexBusinessRow[];
  productBizById: Map<string, NexBusinessRow>;
  businessCount: number;
  productCount: number;
  tab: ResultTab;
  query: string;
  page: number;
  hasPrev: boolean;
  hasNext: boolean;
  hrefFor: (opts: { q?: string; tab?: string; category?: string; page?: number }) => string;
}): React.JSX.Element {
  const noResults =
    productsPaged.length === 0 && businessesPaged.length === 0;
  return (
    <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 18 }}>
      <ResultsSummary
        tab={tab}
        businessCount={businessCount}
        productCount={productCount}
      />

      {noResults ? (
        <EmptyState query={query} tab={tab} />
      ) : (
        <>
          {businessesPaged.length > 0 && (
            <section
              aria-label={tab === "shops" ? "Shops" : "Businesses"}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              {businessesPaged.map((b, idx) => (
                <ResultBusinessCard
                  key={b.id}
                  business={b}
                  isLastInSection={idx === businessesPaged.length - 1}
                />
              ))}
            </section>
          )}

          {productsPaged.length > 0 && (
            <section
              aria-label="Products"
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              {productsPaged.map((p, idx) => {
                const biz = productBizById.get(p.business_id);
                return (
                  <ResultProductCard
                    key={p.id}
                    product={p}
                    business={biz ?? null}
                    isLastInSection={idx === productsPaged.length - 1}
                  />
                );
              })}
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
  businessCount,
  productCount,
}: {
  tab: ResultTab;
  businessCount: number;
  productCount: number;
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
    if (businessCount > 0) {
      parts.push(
        `${businessCount} ${businessCount === 1 ? "shop" : "shops"} with live products`,
      );
    }
  }
  if (parts.length === 0) return <></>;
  return (
    <div style={{ fontSize: 12, color: NEX.textMuted, letterSpacing: "0.02em" }}>
      {parts.join(" · ")}
    </div>
  );
}

function EmptyState({ query, tab }: { query: string; tab: ResultTab }): React.JSX.Element {
  return (
    <section
      style={{
        marginTop: 4,
        padding: "28px 20px",
        borderRadius: 16,
        background: NEX.surface,
        border: `1px solid ${NEX.borderSoft}`,
        textAlign: "center",
      }}
    >
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: NEX.text }}>
        No results{query ? ` for “${query}”` : ""}
      </h3>
      <p
        style={{
          margin: "6px auto 0",
          maxWidth: 360,
          fontSize: 12.5,
          color: NEX.textDim,
          lineHeight: 1.55,
        }}
      >
        {tab === "shops"
          ? "Try removing a filter, broadening the query, or switching to All results."
          : "Try a different query or check the spelling."}
      </p>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════ *
 * Result cards · landscape · match the mock exactly                   *
 * ═══════════════════════════════════════════════════════════════════ */

function ResultBusinessCard({
  business,
  isLastInSection,
}: {
  business: NexBusinessRow;
  isLastInSection: boolean;
}): React.JSX.Element {
  const b = business as NexBusinessRow & {
    city?: string | null;
    business_category?: string | null;
    verified_at?: string | null;
    search_keywords?: string[] | null;
  };
  const typeLabel = businessTypeLabel(b.business_category);
  const location = b.city ?? null;
  const metaParts = [typeLabel, location].filter(Boolean) as string[];
  // Visible chips: first 3 search keywords when present. No fabrication.
  const chips = (b.search_keywords ?? [])
    .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
    .slice(0, 3);
  const cta = typeLabel && typeLabel.toLowerCase().includes("company")
    ? "View company →"
    : typeLabel && typeLabel.toLowerCase().includes("manufactur")
      ? "View company →"
      : "View shop →";
  return (
    <div>
      <Link
        href={`/nex-native/${business.slug}`}
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: 16,
          padding: "4px 4px 20px",
          textDecoration: "none",
          color: NEX.text,
        }}
      >
        <ResultThumb src={business.logo_url ?? null} alt={business.display_name} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "-0.005em",
                color: NEX.text,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {business.display_name}
            </span>
            {b.verified_at && (
              <VerifiedBadge />
            )}
          </div>
          {metaParts.length > 0 && (
            <div style={{ fontSize: 12.5, color: NEX.orange, fontWeight: 600 }}>
              {metaParts.join(" · ")}
            </div>
          )}
          {business.description && (
            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                color: NEX.textDim,
                lineHeight: 1.45,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {business.description}
            </p>
          )}
          {chips.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
              {chips.map((c) => (
                <ChipPill key={c} label={c} />
              ))}
            </div>
          )}
          <span style={{ marginTop: 4, color: NEX.orange, fontSize: 13.5, fontWeight: 700 }}>
            {cta}
          </span>
        </div>
      </Link>
      {!isLastInSection && (
        <div aria-hidden style={{ height: 1, background: NEX.divider, margin: 0 }} />
      )}
    </div>
  );
}

function ResultProductCard({
  product,
  business,
  isLastInSection,
}: {
  product: NexProductRow;
  business: NexBusinessRow | null;
  isLastInSection: boolean;
}): React.JSX.Element {
  const b = business as (NexBusinessRow & { city?: string | null; business_category?: string | null }) | null;
  const location = b?.city ?? null;
  const bizTypeLabel = b ? businessTypeLabel(b.business_category) : null;
  const metaParts = ["Product", bizTypeLabel, location].filter(Boolean) as string[];
  const price =
    typeof product.price_pence === "number" && product.price_pence > 0
      ? formatPrice(product.price_pence, product.currency)
      : null;
  const chips = (product.tags ?? [])
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    .slice(0, 3);
  return (
    <div>
      <Link
        href={business ? `/nex-native/${business.slug}` : `/nex-native/search`}
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: 16,
          padding: "4px 4px 20px",
          textDecoration: "none",
          color: NEX.text,
        }}
      >
        <ResultThumb src={product.image_url ?? null} alt={product.name} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}>
            <span
              style={{
                flex: 1,
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "-0.005em",
                color: NEX.text,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {product.name}
            </span>
            {price && (
              <span style={{ color: NEX.orange, fontSize: 14, fontWeight: 700, flex: "none" }}>
                {price}
              </span>
            )}
          </div>
          {metaParts.length > 0 && (
            <div style={{ fontSize: 12.5, color: NEX.orange, fontWeight: 600 }}>
              {metaParts.join(" · ")}
            </div>
          )}
          {product.description && (
            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                color: NEX.textDim,
                lineHeight: 1.45,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {product.description}
            </p>
          )}
          {chips.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
              {chips.map((c) => (
                <ChipPill key={c} label={c} />
              ))}
            </div>
          )}
          <span style={{ marginTop: 4, color: NEX.orange, fontSize: 13.5, fontWeight: 700 }}>
            {business ? "View shop →" : "View details →"}
          </span>
        </div>
      </Link>
      {!isLastInSection && (
        <div aria-hidden style={{ height: 1, background: NEX.divider, margin: 0 }} />
      )}
    </div>
  );
}

function ResultThumb({ src, alt }: { src: string | null; alt: string }): React.JSX.Element {
  return (
    <span
      aria-hidden={!src}
      style={{
        width: 92,
        height: 92,
        flex: "none",
        borderRadius: 14,
        overflow: "hidden",
        background: src
          ? `url(${src}) center/cover`
          : `linear-gradient(135deg, ${NEX.orange}22, ${NEX.cyan}22)`,
        border: `1px solid ${NEX.borderSoft}`,
        display: "grid",
        placeItems: "center",
        color: NEX.textMuted,
      }}
    >
      {!src && <ShopsGlyph />}
      {src && <span style={{ display: "none" }}>{alt}</span>}
    </span>
  );
}

function ChipPill({ label }: { label: string }): React.JSX.Element {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 999,
        background: NEX.surfaceHi,
        border: `1px solid ${NEX.borderSoft}`,
        color: NEX.textDim,
        fontSize: 11.5,
        fontWeight: 600,
        letterSpacing: "0.01em",
      }}
    >
      {label}
    </span>
  );
}

function VerifiedBadge(): React.JSX.Element {
  return (
    <span
      aria-label="Verified"
      title="Verified business"
      style={{
        flex: "none",
        fontSize: 10,
        color: NEX.cyan,
        padding: "2px 7px",
        borderRadius: 999,
        border: `1px solid ${NEX.cyan}44`,
        background: `${NEX.cyan}14`,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      ✓
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════ *
 * Business-type label derivation · honest, data-backed only           *
 * ═══════════════════════════════════════════════════════════════════ */

/** Convert nex_business.business_category (nullable, snake-case
 *  vertical slug) into a human-readable label that fits the mock's
 *  "{Type} · {Location}" line. Returns null when the category is
 *  not populated · which is the common case (96.4% null in current
 *  data). Honest · never fabricates a type to populate the slot. */
function businessTypeLabel(cat: string | null | undefined): string | null {
  if (!cat) return null;
  const map: Record<string, string> = {
    bakery: "Bakery",
    restaurant: "Restaurant",
    cafe: "Café",
    "ice-cream": "Ice cream shop",
    "dessert-shop": "Dessert shop",
    "drinks-shop": "Drinks shop",
    "juice-bar": "Juice bar",
    tradesperson: "Tradesperson",
    construction: "Construction",
    "staircase-company": "Staircase company",
    salon: "Salon",
    beauty: "Beauty",
    fitness: "Fitness",
    consultant: "Consultant",
    agency: "Agency",
    ecommerce: "Online shop",
    "product-brand": "Brand",
    "local-service": "Local service",
    portfolio: "Portfolio",
    community: "Community",
    event: "Event",
    creator: "Creator",
    "professional-service": "Professional service",
  };
  return map[cat] ?? null;
}

/* ═══════════════════════════════════════════════════════════════════ *
 * Pagination · minimal · matches the Phase 1 behaviour                *
 * ═══════════════════════════════════════════════════════════════════ */

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
        <Link href={prevHref} style={pagerLinkStyle(true)}>← Prev</Link>
      ) : (
        <span style={pagerLinkStyle(false)}>← Prev</span>
      )}
      <span style={{ fontSize: 12, color: NEX.textMuted, letterSpacing: "0.02em" }}>
        Page {page}
      </span>
      {hasNext ? (
        <Link href={nextHref} style={pagerLinkStyle(true)}>Next →</Link>
      ) : (
        <span style={pagerLinkStyle(false)}>Next →</span>
      )}
    </nav>
  );
}

function pagerLinkStyle(enabled: boolean): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "8px 16px",
    borderRadius: 999,
    background: enabled ? NEX.surface : "transparent",
    border: `1px solid ${enabled ? NEX.borderSoft : "transparent"}`,
    color: enabled ? NEX.text : NEX.textSoft,
    fontSize: 12.5,
    fontWeight: 600,
    textDecoration: "none",
    cursor: enabled ? "pointer" : "not-allowed",
    pointerEvents: enabled ? "auto" : "none",
    opacity: enabled ? 1 : 0.45,
    fontFamily: "inherit",
  };
}

/* ═══════════════════════════════════════════════════════════════════ *
 * Error banner                                                        *
 * ═══════════════════════════════════════════════════════════════════ */

function ErrorBanner({ message }: { message: string }): React.JSX.Element {
  return (
    <div
      role="status"
      style={{
        marginTop: 10,
        padding: "12px 14px",
        borderRadius: 12,
        border: `1px solid ${NEX.darkRed}99`,
        background: "rgba(153,27,27,0.14)",
        color: "#FFB4C0",
        fontSize: 13,
      }}
    >
      {message}
    </div>
  );
}

function formatPrice(pence: number, currency: string | null | undefined): string {
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
 * Inline glyphs                                                       *
 * ═══════════════════════════════════════════════════════════════════ */

function SearchGlyph({ tint }: { tint: string }): React.JSX.Element {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none"
         stroke={tint} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx={11} cy={11} r={7} />
      <line x1={21} y1={21} x2={16.65} y2={16.65} />
    </svg>
  );
}
function MicGlyph(): React.JSX.Element {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x={9} y={2} width={6} height={12} rx={3} />
      <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
      <line x1={12} y1={19} x2={12} y2={22} />
      <line x1={8} y1={22} x2={16} y2={22} />
    </svg>
  );
}
function FilterGlyph(): React.JSX.Element {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1={4} y1={6} x2={14} y2={6} />
      <line x1={4} y1={12} x2={11} y2={12} />
      <line x1={4} y1={18} x2={8} y2={18} />
      <circle cx={17} cy={6} r={2} />
      <circle cx={14} cy={12} r={2} />
      <circle cx={11} cy={18} r={2} />
    </svg>
  );
}
function ShopsGlyph(): React.JSX.Element {
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7h18l-1.5 11a2 2 0 0 1-2 1.75H6.5A2 2 0 0 1 4.5 18L3 7z" />
      <path d="M8 7V5a4 4 0 0 1 8 0v2" />
    </svg>
  );
}
function ServicesGlyph(): React.JSX.Element {
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14.7 6.3a4 4 0 0 1 5.3 5.3L10.5 21.1 3 22l.9-7.5L14.7 6.3z" />
    </svg>
  );
}
function PlacesGlyph(): React.JSX.Element {
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" />
      <circle cx={12} cy={10} r={2.4} />
    </svg>
  );
}
function CompaniesGlyph(): React.JSX.Element {
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x={3} y={6} width={18} height={14} rx={2} />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1={3} y1={11} x2={21} y2={11} />
    </svg>
  );
}
