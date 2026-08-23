// NEX HQ · Food Ops · Yogyakarta
//
// /nex-head-quarters/food-ops · Push · Pull · Meet-in-the-middle tiles +
// Walker Findings (discovered records awaiting admin promotion) + freshness
// summary. Consolidated from legacy /admin/(authed)/nex/food-hq · cream theme.
//
// Doctrine anchors:
//   · project_nex_food_flywheel_over_scraping (Discovery ≠ Commercial)
//   · project_nex_walker_freshness_doctrine (freshness bands · not age cutoff)
//   · project_nex_product_architecture (NEX HQ = single admin surface)

import { getFoodDbPool } from "@/lib/nex-food/db";
import { FoodOpsWalkerFindings } from "./FoodOpsWalkerFindings";
import "../../nex-app/nex-app.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadOverview() {
  const pool = getFoodDbPool();
  const [universe, pending, verified24h, verified7d, freshness] = await Promise.all([
    pool.query(`SELECT * FROM nex.food_universe_ratio`),
    pool.query(`SELECT count(*)::int AS n FROM nex.food_pending_self_service_claims`),
    pool.query(`SELECT count(*)::int AS n FROM nex.food_claim_code WHERE consumed_at IS NOT NULL AND consumed_at > now() - interval '24 hours' AND entry_path IN ('self_service_claim','self_service_register')`),
    pool.query(`SELECT count(*)::int AS n FROM nex.food_claim_code WHERE consumed_at IS NOT NULL AND consumed_at > now() - interval '7 days' AND entry_path IN ('self_service_claim','self_service_register')`),
    pool.query(`SELECT * FROM nex.food_business_freshness_summary WHERE city='Yogyakarta'`),
  ]);
  const u = universe.rows[0] ?? {};
  const f = freshness.rows[0] ?? {};
  return {
    discovery: Number(u.discovery_universe ?? 0),
    commercial: Number(u.commercial_universe ?? 0),
    ratio: Number(u.commercial_ratio ?? 0),
    pending: Number(pending.rows[0]?.n ?? 0),
    verified24h: Number(verified24h.rows[0]?.n ?? 0),
    verified7d: Number(verified7d.rows[0]?.n ?? 0),
    freshness: { fresh: Number(f.fresh ?? 0), aging: Number(f.aging ?? 0), stale: Number(f.stale ?? 0), expired: Number(f.expired ?? 0), unverified: Number(f.unverified ?? 0), total: Number(f.total ?? 0) },
  };
}

export default async function FoodOpsPage() {
  const d = await loadOverview();
  return (
    <div style={pageStyle}>
      <div style={titleBlockStyle}>
        <div style={eyebrowStyle}>NEX HQ · YOGYAKARTA · FOOD OPS</div>
        <h1 style={h1Style}>Food Ops</h1>
        <div style={subtitleStyle}>
          Discovery ≠ Commercial · Walker findings · owner claims · freshness ·
          all governed by pinned doctrine. NEX HQ = the single admin surface for
          this vertical.
        </div>
      </div>

      {/* Push · Meet · Pull tiles */}
      <div style={sectionLabelStyle}>Dorong · Bertemu · Tarik · Push · Meet · Pull</div>
      <div style={pushPullRowStyle}>
        <div style={pushPullCardStyle("push")}>
          <div style={pushPullEyebrowStyle}>PUSH · DISCOVERY</div>
          <div style={pushPullCountStyle}>{d.discovery}</div>
          <div style={pushPullLabelStyle}>Businesses discovered</div>
          <div style={pushPullHintStyle}>Walker + import-osm</div>
        </div>
        <div style={pushPullCardStyle("meet")}>
          <div style={pushPullEyebrowStyle}>MEET · COMMERCIAL</div>
          <div style={pushPullCountStyle}>{d.commercial}</div>
          <div style={pushPullLabelStyle}>Contactable + eligible</div>
          <div style={pushPullHintStyle}>{(d.ratio * 100).toFixed(1)}% ratio · listed/invited/claimed/paying + contact</div>
        </div>
        <div style={pushPullCardStyle("pull")}>
          <div style={pushPullEyebrowStyle}>PULL · CLAIMS PENDING</div>
          <div style={pushPullCountStyle}>{d.pending}</div>
          <div style={pushPullLabelStyle}>Owner started · OTP not verified</div>
          <div style={pushPullHintStyle}>Layer 3 · /food/register</div>
        </div>
        <div style={pushPullCardStyle("verified-24h")}>
          <div style={pushPullEyebrowStyle}>VERIFIED · 24H</div>
          <div style={pushPullCountStyle}>{d.verified24h}</div>
          <div style={pushPullLabelStyle}>Self-service OTP verified</div>
        </div>
        <div style={pushPullCardStyle("verified-7d")}>
          <div style={pushPullEyebrowStyle}>VERIFIED · 7D</div>
          <div style={pushPullCountStyle}>{d.verified7d}</div>
          <div style={pushPullLabelStyle}>Flywheel signal</div>
        </div>
      </div>

      {/* Freshness summary */}
      <div style={sectionLabelStyle}>Freshness · Yogyakarta</div>
      <div style={freshRowStyle}>
        {(["fresh","aging","stale","expired","unverified"] as const).map((band) => (
          <div key={band} style={freshTileStyle(band)}>
            <div style={pushPullCountStyle}>{d.freshness[band]}</div>
            <div style={pushPullLabelStyle}>{band}</div>
            <div style={pushPullHintStyle}>{d.freshness.total > 0 ? ((d.freshness[band] / d.freshness.total) * 100).toFixed(1) + "%" : "0%"}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "var(--nex-neutral-500)", marginTop: 6 }}>
        Bands from `nex.food_business_freshness_summary` · derived from `last_verified_at`
        (evidence) · NEVER from `source_ingested_at` (discovery date). Old ≠ dead.
        Activity Confidence Score (Task #66) replaces age-only interpretation when built.
      </div>

      {/* Walker Findings · admin promotion */}
      <div style={sectionLabelStyle}>Temuan Walker · Promosi ke Direktori</div>
      <FoodOpsWalkerFindings />
    </div>
  );
}

// ── Styles · cream theme · NEX HQ tokens ──────────────────────────────────

const pageStyle: React.CSSProperties = { padding: "24px 32px 60px" };
const titleBlockStyle: React.CSSProperties = { marginBottom: 24 };
const eyebrowStyle: React.CSSProperties = { fontSize: 10, letterSpacing: 3, color: "var(--nex-accent-600)", fontWeight: 700, marginBottom: 8 };
const h1Style: React.CSSProperties = { fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: -0.4, color: "var(--nex-neutral-900)" };
const subtitleStyle: React.CSSProperties = { fontSize: 13, color: "var(--nex-neutral-700)", marginTop: 6, maxWidth: 720 };
const sectionLabelStyle: React.CSSProperties = { fontSize: 11, letterSpacing: 2, color: "var(--nex-accent-600)", fontWeight: 700, textTransform: "uppercase", marginTop: 24, marginBottom: 12 };

const pushPullRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 };
const freshRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 };

function pushPullCardStyle(kind: string): React.CSSProperties {
  const map: Record<string, { border: string; bg: string; eyebrow: string }> = {
    push:            { border: "var(--nex-neutral-300, var(--nex-neutral-200))", bg: "var(--nex-neutral-0)", eyebrow: "var(--nex-neutral-700)" },
    meet:            { border: "rgba(249, 115, 22, 0.45)",   bg: "rgba(249, 115, 22, 0.06)",   eyebrow: "#c2410c" },
    pull:            { border: "rgba(168, 85, 247, 0.40)",   bg: "rgba(168, 85, 247, 0.06)",   eyebrow: "#7e22ce" },
    "verified-24h":  { border: "rgba(16, 185, 129, 0.55)",   bg: "rgba(16, 185, 129, 0.06)",   eyebrow: "#047857" },
    "verified-7d":   { border: "rgba(16, 185, 129, 0.30)",   bg: "rgba(16, 185, 129, 0.03)",   eyebrow: "#059669" },
  };
  const a = map[kind] ?? map.push;
  return { background: a.bg, border: `1px solid ${a.border}`, borderRadius: 12, padding: "16px 14px", display: "flex", flexDirection: "column", gap: 4, color: "var(--nex-neutral-900)" };
}
function freshTileStyle(band: string): React.CSSProperties {
  const map: Record<string, string> = {
    fresh: "rgba(16, 185, 129, 0.45)",
    aging: "rgba(250, 204, 21, 0.45)",
    stale: "rgba(249, 115, 22, 0.45)",
    expired: "rgba(239, 68, 68, 0.55)",
    unverified: "var(--nex-neutral-300, var(--nex-neutral-200))",
  };
  return { background: "var(--nex-neutral-0)", border: `1px solid ${map[band]}`, borderRadius: 12, padding: "14px 12px", display: "flex", flexDirection: "column", gap: 4, color: "var(--nex-neutral-900)" };
}

const pushPullEyebrowStyle: React.CSSProperties = { fontSize: 9.5, letterSpacing: 1.5, fontWeight: 700, color: "var(--nex-neutral-500)" };
const pushPullCountStyle: React.CSSProperties = { fontSize: 30, fontWeight: 800, lineHeight: 1, color: "var(--nex-neutral-900)" };
const pushPullLabelStyle: React.CSSProperties = { fontSize: 12, color: "var(--nex-neutral-800)", fontWeight: 600 };
const pushPullHintStyle: React.CSSProperties = { fontSize: 10.5, color: "var(--nex-neutral-500)", lineHeight: 1.4 };
