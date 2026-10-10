// src/app/nex-native/directory/page.tsx
//
// NEX Directory · Phase A · The /nex-native/directory surface.
//
// What this page is
//   · The world-class Directory discovery route.
//   · Mobile-first · NEX dark-navy palette · orange brand accent.
//   · Consumes the Phase B view-model + Phase C destination contract
//     ONLY via the sealed `directory-service`. No raw canonical
//     table access from the UI layer.
//   · Server component · renders the shell (header, hero, search,
//     tabs, SSR'd result list) · delegates geolocation / distance
//     to the client component DirectoryResults.
//   · Renders real listings when they exist; renders an honest empty
//     state when they do not. No fabrication of any kind.
//
// Architectural locks
//   · The canonical row IS the Directory listing (Phase B).
//   · The destination is Phase C's discriminated union, never a
//     fabricated URL (Phase C guarantees this).
//   · Images are the real primary image when present, elegant
//     non-fabricated no-image treatment otherwise (via _no-image).
//   · Distance only appears when the viewer grants location AND the
//     canonical row has coordinates — otherwise it is absent (honest).
//   · Empty state is deliberately polished but makes no promises
//     the data cannot keep.
//
// Current reality (Phase A ship)
//   · `nex.business_canonical` has 0 rows; the sealed migrations
//     may not be exposed to live Supabase yet. Either way, the
//     service returns an empty/not-ready outcome and this page
//     renders the honest state. When Track 1 (ingestion → approval
//     → canonical writes) runs, the same code lights up with
//     real listings.

import type * as React from "react";
import Link from "next/link";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { listDirectory } from "@/lib/nex-native/directory/directory-service";
import type {
  DirectoryClassification,
  DirectoryDestination,
  DirectoryListingVM,
} from "@/lib/nex-native/directory";
import { getCategoryImageLibrary } from "@/lib/nex-native/directory/category-image-library-reader";
import type { CategoryImageLibraryRow } from "@/lib/nex-native/directory/category-image-resolver";
import { NexPageHeader } from "../_page-header";
import { DirectoryResults } from "./_directory-results";
import { listCountryCounts, joinWithIso } from "@/lib/nex-native/directory/country-counts";
import { ISO_COUNTRIES, parseIsoAlpha2 } from "@/lib/nex-native/geo/iso-countries";
import { CountryPicker } from "@/components/nex-native/directory/CountryPicker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ═════════════════════════════════════════════════════════════════════
// §1 · NEX palette · aligned with /nex-native/search + /_page-header
// ═════════════════════════════════════════════════════════════════════

const NEX = {
  bg: "#020914",
  surface: "#0E1526",
  surfaceHi: "#182540",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  textSoft: "#4B6683",
  orange: "#FF7200",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0,175,255,0.06)",
  divider: "rgba(255,255,255,0.08)",
  borderSoft: "rgba(255,255,255,0.06)",
} as const;

// ═════════════════════════════════════════════════════════════════════
// §2 · Classification tabs
// ═════════════════════════════════════════════════════════════════════

type TabValue = "all" | DirectoryClassification;
interface TabDescriptor {
  readonly value: TabValue;
  readonly label: string;
}
const TABS: readonly TabDescriptor[] = [
  { value: "all", label: "All" },
  { value: "business", label: "Businesses" },
  { value: "person", label: "People" },
  { value: "place", label: "Places" },
];

function parseTab(raw: string | undefined): TabValue {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "business" || v === "person" || v === "place" || v === "all") return v;
  return "all";
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Page
// ═════════════════════════════════════════════════════════════════════

interface PageProps {
  readonly searchParams: Promise<{
    readonly q?: string;
    readonly tab?: string;
    readonly country?: string;
    readonly page?: string;
  }>;
}

const DEFAULT_COUNTRY = "ID";
const MAX_Q_LENGTH = 100;
const PAGE_SIZE = 24;
const MAX_PAGE = 10_000; // defensive cap · offset = (page-1) * 24 ≤ 239,976

function parsePage(raw: string | undefined): number {
  const n = Number.parseInt((raw ?? "").trim(), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  if (n > MAX_PAGE) return MAX_PAGE;
  return n;
}

export default async function DirectoryPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const rawQ = (sp.q ?? "").trim();
  const q = rawQ.length > MAX_Q_LENGTH ? rawQ.slice(0, MAX_Q_LENGTH) : rawQ;
  const tab: TabValue = parseTab(sp.tab);
  const requestedCountry = parseIsoAlpha2(sp.country);
  const country = requestedCountry ?? DEFAULT_COUNTRY;
  const page = parsePage(sp.page);

  await resolveNexAppSessionFromContext();

  // Country-counts for the picker · derived from business_directory_v so
  // we never offer a country with zero listings. Falls back to a single
  // entry for the default country if the DB query fails or the view is
  // not yet populated · the picker still renders.
  let countryEntries = [{ isoAlpha2: country, name: null as string | null, count: 0 }];
  try {
    const conn = process.env.NEX_POSTGRES_URL;
    if (conn) {
      const raw = await listCountryCounts({ connectionString: conn });
      countryEntries = joinWithIso(raw, ISO_COUNTRIES).map((e) => ({
        isoAlpha2: e.isoAlpha2,
        name: e.name,
        count: e.count,
      }));
    }
  } catch {
    // best-effort · picker still renders with the default-country stub
  }

  const classification: DirectoryClassification | "all" =
    tab === "all" ? "all" : tab;

  const outcome = await listDirectory({
    country,
    q: q.length > 0 ? q : undefined,
    classification,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  // P0 · fetch the curated category-image library once per request and
  // thread it into the card tree. Pure resolver runs client-side with
  // this snapshot · empty array when the DB is unreachable or the
  // library hasn't been seeded (cards then render the honest no-image
  // fallback · no fabrication).
  let categoryImageLibrary: readonly CategoryImageLibraryRow[] = [];
  try {
    categoryImageLibrary = await getCategoryImageLibrary();
  } catch {
    // best-effort · cards still render without hero
  }
  const total = outcome.total;
  const totalPages = total > 0 ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 0;
  // If the requested page is past the end, we honour it and render
  // "no results on this page" rather than silently redirecting · the
  // UI shows a Prev link so the user can walk back.

  // Pre-filter the renderable results. `redirect_to_canonical` would
  // require the service layer to chase the chain; today the service
  // returns the raw destination and we drop it defensively (the
  // service's zero-row state means we never see one in practice).
  // `unresolved` is honest but non-renderable.
  const renderable = outcome.results.filter((r) => {
    const k = r.destination.kind;
    return k !== "redirect_to_canonical" && k !== "unresolved";
  });

  const anyListingHasCoords = renderable.some(
    (r) => r.listing.coordinates !== null,
  );

  return (
    <main
      data-nex-directory-page
      data-nex-directory-system-ready={outcome.systemReady ? "true" : "false"}
      data-nex-directory-result-count={renderable.length}
      data-nex-directory-active-tab={tab}
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "0 20px 48px 20px",
          width: "100%",
        }}
      >
        <NexPageHeader dataScope="directory" />

        <HeroSection
          activeTab={tab}
          systemReady={outcome.systemReady}
          resultCount={renderable.length}
        />

        <SearchForm q={q} tab={tab} country={country} countryEntries={countryEntries} />

        <ClassificationTabs active={tab} q={q} country={country} />

        <ResultsSection
          outcome={outcome}
          renderable={renderable}
          anyListingHasCoords={anyListingHasCoords}
          q={q}
          tab={tab}
          categoryImageLibrary={categoryImageLibrary}
        />

        {outcome.systemReady && total > 0 ? (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={PAGE_SIZE}
            currentPageSize={renderable.length}
            country={country}
            q={q}
            tab={tab}
          />
        ) : null}
      </div>
    </main>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Hero
// ═════════════════════════════════════════════════════════════════════

function HeroSection(props: {
  readonly activeTab: TabValue;
  readonly systemReady: boolean;
  readonly resultCount: number;
}): React.ReactElement {
  const subtitle = (() => {
    if (!props.systemReady) {
      return "The NEX Directory is being prepared.";
    }
    if (props.resultCount > 0) {
      return "Verified canonical listings across Indonesia.";
    }
    return "Discover verified businesses and people across Indonesia.";
  })();

  return (
    <section
      data-nex-directory-hero
      style={{
        marginTop: 28,
        marginBottom: 20,
      }}
    >
      <h1
        style={{
          fontSize: 32,
          lineHeight: 1.1,
          fontWeight: 700,
          margin: 0,
          letterSpacing: "-0.01em",
        }}
      >
        <span style={{ color: NEX.orange }}>NEX</span>
        <span style={{ color: NEX.text }}> Directory</span>
      </h1>
      <p
        style={{
          marginTop: 10,
          marginBottom: 0,
          color: NEX.textDim,
          fontSize: 15,
          lineHeight: 1.45,
        }}
      >
        {subtitle}
      </p>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §5 · Search form (vanilla <form> · no client JS required)
// ═════════════════════════════════════════════════════════════════════

function SearchForm(props: {
  readonly q: string;
  readonly tab: TabValue;
  readonly country: string;
  readonly countryEntries: readonly { readonly isoAlpha2: string; readonly name: string | null; readonly count: number }[];
}): React.ReactElement {
  return (
    <form
      method="get"
      action="/nex-native/directory"
      data-nex-directory-search-form
      style={{
        display: "flex",
        gap: 8,
        marginBottom: 16,
        alignItems: "center",
      }}
    >
      {props.tab !== "all" ? (
        <input type="hidden" name="tab" value={props.tab} />
      ) : null}
      {/* Preserve country selection across plain-form (Enter-key) submits. */}
      <input type="hidden" name="country" value={props.country} />
      {/* Input + globe picker share one rounded surface — picker sits
          inside the right edge of the input. */}
      <div
        style={{
          flex: 1,
          position: "relative",
          display: "flex",
          alignItems: "center",
          background: NEX.surface,
          border: `1px solid ${NEX.borderSoft}`,
          borderRadius: 999,
          minWidth: 0,
        }}
      >
        <input
          type="search"
          name="q"
          defaultValue={props.q}
          placeholder="Search Directory"
          aria-label="Search Directory"
          maxLength={MAX_Q_LENGTH}
          data-nex-directory-search-input
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            color: NEX.text,
            padding: "12px 14px",
            paddingRight: 50,
            borderRadius: 999,
            fontSize: 15,
            outline: "none",
            minWidth: 0,
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 4,
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <CountryPicker
            entries={props.countryEntries}
            initialSelected={props.country}
            triggerIcon="globe"
            ariaLabel={`Change country — currently ${props.country}`}
          />
        </div>
      </div>
      <button
        type="submit"
        data-nex-directory-search-submit
        style={{
          background: NEX.orange,
          color: "#1A1300",
          border: "none",
          padding: "0 18px",
          height: 44,
          borderRadius: 999,
          fontWeight: 600,
          fontSize: 14,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Search
      </button>
    </form>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §5b · Pagination · pure URL-param navigation · preserves country/q/tab
// ═════════════════════════════════════════════════════════════════════

/** Build a /nex-native/directory URL preserving the active filters and
 *  substituting the target page. Omits `page=1` so the canonical URL
 *  for the first page is clean. Omits default-country so the URL is
 *  shortest in the common case. */
function buildDirectoryHref(args: {
  readonly country: string;
  readonly q: string;
  readonly tab: TabValue;
  readonly page: number;
}): string {
  const params = new URLSearchParams();
  if (args.q.length > 0) params.set("q", args.q);
  if (args.tab !== "all") params.set("tab", args.tab);
  if (args.country && args.country !== DEFAULT_COUNTRY) {
    params.set("country", args.country);
  }
  if (args.page > 1) params.set("page", String(args.page));
  const qs = params.toString();
  return qs.length > 0 ? `/nex-native/directory?${qs}` : "/nex-native/directory";
}

/** Compact page-number set with first / neighbours / last and sentinel
 *  `null` entries for ellipses. Pure · deterministic. */
export function computePageWindow(current: number, total: number): readonly (number | null)[] {
  if (total <= 1) return [1];
  const set = new Set<number>();
  set.add(1);
  set.add(total);
  for (let d = -1; d <= 1; d++) {
    const n = current + d;
    if (n >= 1 && n <= total) set.add(n);
  }
  const sorted = Array.from(set).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push(null);
    out.push(sorted[i]);
  }
  return out;
}

function Pagination(props: {
  readonly page: number;
  readonly totalPages: number;
  readonly total: number;
  readonly pageSize: number;
  readonly currentPageSize: number;
  readonly country: string;
  readonly q: string;
  readonly tab: TabValue;
}): React.ReactElement {
  const first = (props.page - 1) * props.pageSize + 1;
  const lastOnPage = first + Math.max(0, props.currentPageSize - 1);
  const canPrev = props.page > 1;
  const canNext = props.page < props.totalPages;
  const window = computePageWindow(props.page, props.totalPages);

  const btnStyle = (active: boolean, disabled: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 36,
    height: 36,
    padding: "0 10px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    textDecoration: "none",
    background: active ? NEX.orange : NEX.surface,
    color: active ? "#1A1300" : disabled ? NEX.textSoft : NEX.textDim,
    border: active ? "none" : `1px solid ${NEX.borderSoft}`,
    pointerEvents: disabled ? "none" : "auto",
    opacity: disabled ? 0.5 : 1,
    userSelect: "none",
  });

  return (
    <nav
      aria-label="Directory pagination"
      data-nex-directory-pagination
      data-nex-directory-pagination-page={props.page}
      data-nex-directory-pagination-total-pages={props.totalPages}
      data-nex-directory-pagination-total={props.total}
      style={{
        marginTop: 20,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        alignItems: "center",
      }}
    >
      <div
        role="status"
        aria-live="polite"
        data-nex-directory-pagination-summary
        style={{ fontSize: 13, color: NEX.textMuted }}
      >
        Showing <span style={{ color: NEX.text, fontWeight: 600 }}>{first.toLocaleString()}</span>
        {lastOnPage > first ? (
          <> – <span style={{ color: NEX.text, fontWeight: 600 }}>{lastOnPage.toLocaleString()}</span></>
        ) : null}
        {" "}of{" "}
        <span style={{ color: NEX.text, fontWeight: 600 }}>{props.total.toLocaleString()}</span>
        {" "}listings
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Link
          href={buildDirectoryHref({
            country: props.country,
            q: props.q,
            tab: props.tab,
            page: Math.max(1, props.page - 1),
          })}
          aria-label="Previous page"
          aria-disabled={!canPrev}
          data-nex-directory-pagination-prev
          data-nex-directory-pagination-disabled={!canPrev ? "true" : "false"}
          style={btnStyle(false, !canPrev)}
        >
          ← Prev
        </Link>
        {window.map((n, idx) => {
          if (n === null) {
            return (
              <span
                key={`gap-${idx}`}
                aria-hidden="true"
                style={{ color: NEX.textSoft, padding: "0 4px" }}
              >
                …
              </span>
            );
          }
          const isCurrent = n === props.page;
          return (
            <Link
              key={n}
              href={buildDirectoryHref({
                country: props.country,
                q: props.q,
                tab: props.tab,
                page: n,
              })}
              aria-label={`Page ${n}`}
              aria-current={isCurrent ? "page" : undefined}
              data-nex-directory-pagination-page-number={n}
              data-nex-directory-pagination-page-current={isCurrent ? "true" : "false"}
              style={btnStyle(isCurrent, false)}
            >
              {n}
            </Link>
          );
        })}
        <Link
          href={buildDirectoryHref({
            country: props.country,
            q: props.q,
            tab: props.tab,
            page: Math.min(props.totalPages, props.page + 1),
          })}
          aria-label="Next page"
          aria-disabled={!canNext}
          data-nex-directory-pagination-next
          data-nex-directory-pagination-disabled={!canNext ? "true" : "false"}
          style={btnStyle(false, !canNext)}
        >
          Next →
        </Link>
      </div>
    </nav>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §6 · Classification tabs
// ═════════════════════════════════════════════════════════════════════

function ClassificationTabs(props: {
  readonly active: TabValue;
  readonly q: string;
  readonly country: string;
}): React.ReactElement {
  return (
    <nav
      aria-label="Filter by classification"
      data-nex-directory-tabs
      style={{
        display: "flex",
        gap: 8,
        marginBottom: 20,
        flexWrap: "wrap",
      }}
    >
      {TABS.map((t) => {
        const isActive = t.value === props.active;
        const params = new URLSearchParams();
        if (props.q.length > 0) params.set("q", props.q);
        if (t.value !== "all") params.set("tab", t.value);
        if (props.country && props.country !== DEFAULT_COUNTRY) params.set("country", props.country);
        const href =
          params.toString().length > 0
            ? `/nex-native/directory?${params.toString()}`
            : "/nex-native/directory";
        return (
          <Link
            key={t.value}
            href={href}
            data-nex-directory-tab={t.value}
            data-nex-directory-tab-active={isActive ? "true" : "false"}
            aria-current={isActive ? "page" : undefined}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              background: isActive ? NEX.orange : NEX.surface,
              color: isActive ? "#1A1300" : NEX.textDim,
              border: isActive ? "none" : `1px solid ${NEX.borderSoft}`,
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §7 · Results section + states
// ═════════════════════════════════════════════════════════════════════

function ResultsSection(props: {
  readonly outcome: Awaited<ReturnType<typeof listDirectory>>;
  readonly renderable: ReadonlyArray<{
    readonly listing: DirectoryListingVM;
    readonly destination: DirectoryDestination;
  }>;
  readonly anyListingHasCoords: boolean;
  readonly q: string;
  readonly tab: TabValue;
  readonly categoryImageLibrary: readonly CategoryImageLibraryRow[];
}): React.ReactElement {
  if (!props.outcome.systemReady) {
    return <SystemPreparingState />;
  }
  if (props.renderable.length === 0) {
    return <EmptyState q={props.q} tab={props.tab} />;
  }
  return (
    <DirectoryResults
      results={props.renderable}
      anyListingHasCoords={props.anyListingHasCoords}
      categoryImageLibrary={props.categoryImageLibrary}
    />
  );
}

function SystemPreparingState(): React.ReactElement {
  return (
    <div
      data-nex-directory-state="preparing"
      style={{
        background: NEX.surface,
        border: `1px solid ${NEX.borderSoft}`,
        borderRadius: 16,
        padding: "28px 20px",
        textAlign: "center",
        marginTop: 8,
      }}
    >
      <h2
        style={{
          margin: 0,
          color: NEX.text,
          fontSize: 18,
          fontWeight: 600,
        }}
      >
        The NEX Directory is being prepared.
      </h2>
      <p
        style={{
          margin: "10px 0 0 0",
          color: NEX.textMuted,
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        Verified business and people data is being carefully assembled
        and reviewed. The first canonical listings are being verified
        now. Come back soon.
      </p>
    </div>
  );
}

function EmptyState(props: {
  readonly q: string;
  readonly tab: TabValue;
}): React.ReactElement {
  const message =
    props.q.length > 0
      ? `No listings match your search for "${props.q}" yet.`
      : props.tab !== "all"
        ? `No ${TAB_LABEL_FOR_EMPTY[props.tab]} listings yet.`
        : "No listings yet.";

  return (
    <div
      data-nex-directory-state="empty"
      style={{
        background: NEX.surface,
        border: `1px solid ${NEX.borderSoft}`,
        borderRadius: 16,
        padding: "28px 20px",
        textAlign: "center",
        marginTop: 8,
      }}
    >
      <h2
        style={{
          margin: 0,
          color: NEX.text,
          fontSize: 18,
          fontWeight: 600,
        }}
      >
        {message}
      </h2>
      <p
        style={{
          margin: "10px 0 0 0",
          color: NEX.textMuted,
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        Verified canonical listings will appear here as they are
        approved. Nothing on this page is fabricated.
      </p>
    </div>
  );
}

const TAB_LABEL_FOR_EMPTY: Record<Exclude<TabValue, "all">, string> = {
  business: "business",
  person: "people",
  place: "place",
};
