// src/app/nex-head-quarters/directory/page.tsx
//
// Phase 3 · 2026-08-24 · Admin directory visibility.
//
// Server component · reads REAL PERSISTED DIRECTORY ROWS from
// nex.food_business · nex.accommodation_business · nex.mp_seller ·
// nex.transport_acquisition_record via the loadDirectoryRows /
// loadCategoryTotals helpers.
//
// Never uses cycle counts, matched_exact, records_new, or worker activity.
// A count here increases only when a walker's insertNewRecord() actually
// returned rowCount>0 after ON CONFLICT DO NOTHING.
//
// URL query params:
//   ?cat=food|accommodation|market|transport   (default: food)
//   ?city=<canonical>                          (default: All)
//   ?page=<1-indexed page number>              (default: 1)

import Link from "next/link";
import { getFoodDbPool } from "@/lib/nex-food/db";
import {
  loadAllCategoryTotals,
  loadDirectoryRows,
  DIRECTORY_CATEGORIES,
  type DirectoryCategory,
} from "@/lib/nex-hq/directory-counts";
import { loadCityCategoryObservability, type CityCategoryCard, type CardDiagnosis } from "@/lib/nex-hq/city-category-observability";

export const dynamic = "force-dynamic";
export const metadata = { title: "NEX HQ · Directory", robots: { index: false } };

const PAGE_SIZE = 50;
const fmtInt = (n: number) => n.toLocaleString("en-GB");

function isCategory(x: string | undefined): x is DirectoryCategory {
  return !!x && (DIRECTORY_CATEGORIES as readonly string[]).includes(x);
}

// Display label for the category chip. Legacy categories capitalise their
// single word · service categories translate `services-X` → `Services · X`.
// Philip 2026-08-27 (A1): HQ admin only · public /services routes come later.
function categoryLabel(cat: DirectoryCategory): string {
  if (cat.startsWith("services-")) {
    const rest = cat.slice("services-".length);
    // "car-repair" → "Car Repair"
    const pretty = rest.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    return `Services · ${pretty}`;
  }
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

function sourceTableLabel(cat: DirectoryCategory): string {
  if (cat === "food") return "nex.food_business";
  if (cat === "accommodation") return "nex.accommodation_business";
  if (cat === "market") return "nex.mp_seller";
  if (cat === "transport") return "nex.transport_acquisition_record";
  if (cat.startsWith("services-")) {
    return `nex.service_business · category_slug='${cat.slice("services-".length)}'`;
  }
  return "unknown";
}

export default async function DirectoryAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; city?: string; page?: string }>;
}) {
  const params  = await searchParams;
  const category: DirectoryCategory = isCategory(params.cat) ? params.cat : "food";
  const cityRaw = params.city && params.city !== "All" ? params.city : null;
  const page    = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const offset  = (page - 1) * PAGE_SIZE;

  const pool = getFoodDbPool();

  const [allTotals, tablePage, allObs] = await Promise.all([
    loadAllCategoryTotals(pool),
    loadDirectoryRows(pool, { category, city: cityRaw, offset, limit: PAGE_SIZE }),
    loadCityCategoryObservability(pool),
  ]);
  // Filter observability cards to the currently selected category, and optionally city.
  const observability = allObs.filter((o) =>
    o.category === category && (cityRaw ? o.city === cityRaw : true),
  );

  const currentTotals = allTotals.find((t) => t.category === category)!;
  const totalPages    = Math.max(1, Math.ceil(tablePage.total / PAGE_SIZE));

  return (
    <main style={{ padding: "24px 20px", color: "#e5e5e5", fontFamily: "Inter, system-ui, sans-serif" }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "#a3a3a3", fontWeight: 700 }}>
          NEX HQ · admin
        </div>
        <h1 style={{ margin: "8px 0 4px", fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "#fff" }}>
          Directory
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "#a3a3a3", maxWidth: 720 }}>
          Real persisted business rows from the acquisition machine. Counts come from{" "}
          <code>nex.food_business · nex.accommodation_business · nex.mp_seller ·
          nex.transport_acquisition_record</code>. Never from cycle counters or scoring metrics.
        </p>
      </header>

      {/* Category selector · shows every category with its real total. */}
      <section style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {allTotals.map((t) => {
          const active = t.category === category;
          return (
            <Link
              key={t.category}
              href={{ pathname: "/nex-head-quarters/directory", query: { cat: t.category } }}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                background: active ? "#F97316" : "#111",
                color: active ? "#0a0a0a" : "#e5e5e5",
                border: active ? "1px solid #F97316" : "1px solid #262626",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {categoryLabel(t.category)}
              <span style={{
                marginLeft: 8,
                fontSize: 11,
                fontWeight: 700,
                opacity: 0.8,
              }}>
                {fmtInt(t.total)}
              </span>
            </Link>
          );
        })}
      </section>

      {/* City selector · dynamic list drawn from the current category's real rows. */}
      <section style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: "#a3a3a3", marginBottom: 6 }}>
          City / area · counts from <code>{sourceTableLabel(category)}</code>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Link
            href={{ pathname: "/nex-head-quarters/directory", query: { cat: category } }}
            style={cityChipStyle(cityRaw === null)}
          >
            All <span style={cityCountStyle}>{fmtInt(currentTotals.total)}</span>
          </Link>
          {currentTotals.byCity.map((c) => {
            const active = c.city === cityRaw;
            return (
              <Link
                key={c.city}
                href={{ pathname: "/nex-head-quarters/directory", query: { cat: category, city: c.city } }}
                style={cityChipStyle(active)}
              >
                {c.city} <span style={cityCountStyle}>{fmtInt(c.count)}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Live acquisition observability · per-city cards for the selected category.
          Answers the ambiguous-zero problem: each card explicitly separates
          workforce activity (processed / matched / new / saved) from database
          reality (Total in directory). Diagnosis pill tells the admin WHY a
          card shows what it shows (provider error · deduped · running · etc.). */}
      <section style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: "#a3a3a3", marginBottom: 8 }}>
          Live acquisition · {category} · {observability.length} combo{observability.length === 1 ? "" : "s"} tracked
        </div>
        {observability.length === 0 ? (
          <div style={{
            padding: 14, borderRadius: 12, border: "1px solid #262626", background: "#0a0a0a",
            color: "#737373", fontSize: 13,
          }}>
            No rotation state for this filter. Waiting for the Rotation Controller to observe first cycles.
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 10,
          }}>
            {observability.map((c) => <ObservabilityCard key={`${c.city}:${c.category}`} card={c} />)}
          </div>
        )}
      </section>

      {/* Filter summary */}
      <section style={{ marginBottom: 12, fontSize: 12, color: "#a3a3a3" }}>
        Showing <strong style={{ color: "#e5e5e5" }}>{fmtInt(tablePage.rows.length)}</strong>{" "}
        of <strong style={{ color: "#e5e5e5" }}>{fmtInt(tablePage.total)}</strong> rows ·{" "}
        category = <strong style={{ color: "#e5e5e5" }}>{category}</strong> ·{" "}
        city = <strong style={{ color: "#e5e5e5" }}>{cityRaw ?? "All"}</strong> ·{" "}
        page {page} / {totalPages}
      </section>

      {/* Rows */}
      <section style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #262626" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#0a0a0a", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#111", color: "#a3a3a3", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
              <th style={cellStyle}>Business name</th>
              <th style={cellStyle}>City</th>
              <th style={cellStyle}>Area / district</th>
              <th style={cellStyle}>Created</th>
              <th style={cellStyle}>Source</th>
            </tr>
          </thead>
          <tbody>
            {tablePage.rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ ...cellStyle, textAlign: "center", padding: "40px 12px", color: "#737373" }}>
                  No rows for this filter.
                </td>
              </tr>
            ) : (
              tablePage.rows.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid #171717" }}>
                  <td style={cellStyle}>{r.name}</td>
                  <td style={cellStyle}>{r.city ?? "—"}</td>
                  <td style={cellStyle}>{r.district ?? "—"}</td>
                  <td style={{ ...cellStyle, fontVariantNumeric: "tabular-nums", color: "#a3a3a3" }}>
                    {r.createdAt ? r.createdAt.slice(0, 19).replace("T", " ") : "—"}
                  </td>
                  <td style={{ ...cellStyle, color: "#a3a3a3", fontSize: 12 }}>{r.source ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* Pagination · simple prev/next */}
      {totalPages > 1 && (
        <section style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center" }}>
          {page > 1 && (
            <Link
              href={{
                pathname: "/nex-head-quarters/directory",
                query: { cat: category, ...(cityRaw ? { city: cityRaw } : {}), page: page - 1 },
              }}
              style={pagerStyle}
            >
              ← Prev
            </Link>
          )}
          <span style={{ padding: "8px 14px", color: "#737373", fontSize: 12 }}>
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={{
                pathname: "/nex-head-quarters/directory",
                query: { cat: category, ...(cityRaw ? { city: cityRaw } : {}), page: page + 1 },
              }}
              style={pagerStyle}
            >
              Next →
            </Link>
          )}
        </section>
      )}
    </main>
  );
}

const cellStyle: React.CSSProperties = {
  padding: "12px 14px",
  textAlign: "left",
};

const cityCountStyle: React.CSSProperties = {
  marginLeft: 6,
  fontSize: 10,
  fontWeight: 700,
  opacity: 0.75,
};

function cityChipStyle(active: boolean): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    background: active ? "#F97316" : "#111",
    color: active ? "#0a0a0a" : "#e5e5e5",
    border: active ? "1px solid #F97316" : "1px solid #262626",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 600,
  };
}

const pagerStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 999,
  background: "#111",
  color: "#e5e5e5",
  border: "1px solid #262626",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 600,
};

// ── Observability card · answers Philip's ambiguous-zero problem ────────
// Distinguishes: provider-error · deduped · running · never-run · productive.
// Every number sourced from either summary.discovery_stats (walker activity)
// or the persisted business table (database reality). No cycle counter is
// used as a proxy for a persisted count.

const DIAGNOSIS_STYLE: Record<CardDiagnosis, { label: string; bg: string; fg: string }> = {
  "productive":                { label: "Productive",         bg: "rgba(74,222,128,0.14)",  fg: "#4ade80" },
  "deduped-zero-persisted":    { label: "All deduped",        bg: "rgba(251,191,36,0.15)",  fg: "#fbbf24" },
  "processed-zero-provider":   { label: "Provider empty",     bg: "rgba(148,163,184,0.14)", fg: "#94a3b8" },
  "provider-error":            { label: "Provider error",     bg: "rgba(239,68,68,0.18)",   fg: "#f87171" },
  "failed":                    { label: "Cycle failed",       bg: "rgba(239,68,68,0.18)",   fg: "#f87171" },
  "aborted":                   { label: "Zombie reconciled",  bg: "rgba(249,115,22,0.16)",  fg: "#fb923c" },
  "running":                   { label: "Running now",        bg: "rgba(96,165,250,0.16)",  fg: "#60a5fa" },
  "never-run":                 { label: "Never run",          bg: "rgba(115,115,115,0.16)", fg: "#a3a3a3" },
};

function fmtAgo(d: Date | null): string {
  if (!d) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (sec < 60)   return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function ObservabilityCard({ card }: { card: CityCategoryCard }) {
  const dstyle = DIAGNOSIS_STYLE[card.diagnosis];
  return (
    <div style={{
      background: "#0a0a0a",
      border: "1px solid #262626",
      borderRadius: 12,
      padding: 14,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      {/* Header · city + category + diagnosis pill */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#f5f5f5" }}>
            {card.city}
          </div>
          <div style={{ fontSize: 11, color: "#a3a3a3", textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>
            {card.category}
          </div>
        </div>
        <span style={{
          padding: "3px 9px",
          borderRadius: 999,
          background: dstyle.bg,
          color: dstyle.fg,
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          flexShrink: 0,
        }}>
          {dstyle.label}
        </span>
      </div>

      {/* Directory total · the big authoritative number */}
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        padding: "8px 10px", borderRadius: 8, background: "#111",
      }}>
        <div style={{ fontSize: 11, color: "#a3a3a3" }}>Directory total</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#f5f5f5", fontVariantNumeric: "tabular-nums" }}>
          {card.totalInDirectory.toLocaleString("en-GB")}
        </div>
      </div>

      {/* Last cycle breakdown · walker activity fields */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
        <MetricCell label="Processed" value={card.processed} />
        <MetricCell label="Matched"   value={card.matched} />
        <MetricCell label="New"       value={card.newCandidates} />
        <MetricCell label="Saved"     value={card.addedToNex} bold />
      </div>

      {/* Diagnosis text · human-readable explanation */}
      <div style={{ fontSize: 11, color: "#a3a3a3", lineHeight: 1.4 }}>
        {card.diagnosisText}
      </div>

      {/* Provider + timing footer */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        gap: 6, paddingTop: 8, borderTop: "1px solid #171717", fontSize: 11, color: "#737373",
      }}>
        <span>{card.provider ? `via ${card.provider}` : "—"}</span>
        <span>Last run {fmtAgo(card.lastRunStartedAt)}</span>
      </div>

      {/* Provider error detail · shown only when present */}
      {card.providerError && (
        <div style={{
          padding: "6px 8px", borderRadius: 6, background: "rgba(239,68,68,0.10)",
          color: "#f87171", fontSize: 11, fontFamily: "monospace", wordBreak: "break-word",
        }}>
          {card.providerError.slice(0, 200)}
        </div>
      )}
    </div>
  );
}

function MetricCell({ label, value, bold }: { label: string; value: number | null; bold?: boolean }) {
  const display = value == null ? "—" : value.toLocaleString("en-GB");
  return (
    <div style={{ padding: "6px 4px", textAlign: "center", background: "#0f0f0f", borderRadius: 6 }}>
      <div style={{ fontSize: 9, color: "#737373", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{
        fontSize: bold ? 15 : 13,
        fontWeight: bold ? 700 : 600,
        color: bold && value != null && value > 0 ? "#4ade80" : "#e5e5e5",
        fontVariantNumeric: "tabular-nums",
        marginTop: 2,
      }}>
        {display}
      </div>
    </div>
  );
}
