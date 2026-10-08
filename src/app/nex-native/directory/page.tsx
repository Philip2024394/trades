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
import { NexPageHeader } from "../_page-header";
import { DirectoryResults } from "./_directory-results";

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
  }>;
}

const DEFAULT_COUNTRY = "ID";
const MAX_Q_LENGTH = 100;

export default async function DirectoryPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const rawQ = (sp.q ?? "").trim();
  const q = rawQ.length > MAX_Q_LENGTH ? rawQ.slice(0, MAX_Q_LENGTH) : rawQ;
  const tab: TabValue = parseTab(sp.tab);

  await resolveNexAppSessionFromContext();

  const classification: DirectoryClassification | "all" =
    tab === "all" ? "all" : tab;

  const outcome = await listDirectory({
    country: DEFAULT_COUNTRY,
    q: q.length > 0 ? q : undefined,
    classification,
  });

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

        <SearchForm q={q} tab={tab} />

        <ClassificationTabs active={tab} q={q} />

        <ResultsSection
          outcome={outcome}
          renderable={renderable}
          anyListingHasCoords={anyListingHasCoords}
          q={q}
          tab={tab}
        />
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
      }}
    >
      {props.tab !== "all" ? (
        <input type="hidden" name="tab" value={props.tab} />
      ) : null}
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
          background: NEX.surface,
          border: `1px solid ${NEX.borderSoft}`,
          color: NEX.text,
          padding: "12px 14px",
          borderRadius: 999,
          fontSize: 15,
          outline: "none",
          minWidth: 0,
        }}
      />
      <button
        type="submit"
        data-nex-directory-search-submit
        style={{
          background: NEX.orange,
          color: "#1A1300",
          border: "none",
          padding: "0 18px",
          borderRadius: 999,
          fontWeight: 600,
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        Search
      </button>
    </form>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §6 · Classification tabs
// ═════════════════════════════════════════════════════════════════════

function ClassificationTabs(props: {
  readonly active: TabValue;
  readonly q: string;
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
