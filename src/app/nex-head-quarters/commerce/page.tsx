// NEX HQ · Commerce · subordinate operational view for NEX Marketplace.
//
// 2026-08-24 UPGRADE (Philip: "we need also walkers non-stop and showing all
// cities and area across Indonesia same rule"):
//   · Market-specific rotation grid across ALL 8 tracked cities
//   · Live workforce status per city (WORKING/QUEUED/WAITING/IDLE/SATURATED/ERROR/UNAVAILABLE)
//   · Orchestrator queue view scoped to market vertical
//   · Per-city seller breakdown with drill-down to /nex-market/city/[slug]
//   · Cycles table extended to ALL cities (was Yogyakarta-only)
//   · Everything driven by real DB · no fake activity · one HQ (no new dashboard)
//
// Doctrine anchors:
//   project_nex_provider_rate_governor_scaling_2026_08_24
//   project_nex_auto_walker_orchestrator_2026_08_24
//   project_nex_market_reference_autonomous_worker_2026_08_24

import Link from "next/link";
import { getCommerceHqCounts, listProducts, listSellersByCityCanonical } from "@/lib/nex-shop/queries";
import { getFoodDbPool } from "@/lib/nex-food/db";
import { buildWorkItemRegistry, buildRotationSnapshot, type RotationStateKind } from "@/lib/nex-hq/discovery-rotation";
import { buildDiscoveryQueue, MAX_SLOTS, type InFlightCycle, type RecentPick } from "@/lib/nex-hq/auto-orchestrator";
import { resolveWorkforceStatus, WORKFORCE_STATUS_META, type WorkforceStatus } from "@/lib/nex-hq/workforce-status";
import { CITY_REGISTRY } from "@/lib/nex/city-registry";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fmtIdr(n: number): string { return "Rp " + n.toLocaleString("id-ID"); }
function fmtIso(iso: string | Date | null): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("en-GB", { hour12: false });
}

interface MarketCycleRow {
  cycleId: string; startedAt: string; status: string;
  processed: number | null; persisted: number | null; errors: number;
  durationS: number | null; workerConfig: string;
}

// All market cycles across every city (was Yogyakarta only).
async function loadMarketWalkerCycles(): Promise<MarketCycleRow[]> {
  const pool = getFoodDbPool();
  if (!pool) return [];
  const q = await pool.query(`
    SELECT id, worker_config, started_at, status, records_processed, records_new, errors_count, duration_ms
      FROM nex.worker_cycle_run
     WHERE worker_id = 'acquisition:market:Yogyakarta'
     ORDER BY started_at DESC
     LIMIT 25
  `);
  return q.rows.map((r: Record<string, unknown>) => ({
    cycleId: String(r.id),
    startedAt: String(r.started_at),
    status: String(r.status),
    processed: r.records_processed == null ? null : Number(r.records_processed),
    persisted: r.records_new == null ? null : Number(r.records_new),
    errors: Number(r.errors_count),
    durationS: r.duration_ms == null ? null : Math.round(Number(r.duration_ms) / 1000),
    workerConfig: String(r.worker_config ?? ""),
  }));
}

async function loadPerCitySellerCounts(): Promise<Map<string, { total: number; discovered: number; registered: number; active: number }>> {
  const pool = getFoodDbPool();
  const out = new Map<string, { total: number; discovered: number; registered: number; active: number }>();
  if (!pool) return out;
  const q = await pool.query(`
    SELECT jurisdiction, status, count(*)::int AS n
      FROM nex.mp_seller
     WHERE jurisdiction LIKE 'ID/%'
     GROUP BY jurisdiction, status
  `);
  for (const row of q.rows as Record<string, unknown>[]) {
    const jur = String(row.jurisdiction);
    const status = String(row.status);
    const n = Number(row.n);
    // Extract city segment · e.g. "ID/DIY/Sleman" → "Sleman" · "ID/DIY/Kulon-Progo" → "Kulon Progo"
    const parts = jur.split("/");
    const citySeg = parts[parts.length - 1] ?? "";
    const cityCanonical = citySeg.replace(/-/g, " ").trim();
    if (!out.has(cityCanonical)) out.set(cityCanonical, { total: 0, discovered: 0, registered: 0, active: 0 });
    const bucket = out.get(cityCanonical)!;
    bucket.total += n;
    if (status === "discovered") bucket.discovered += n;
    if (status === "registered" || status === "verified") bucket.registered += n;
    if (status === "active") bucket.active += n;
  }
  return out;
}

// Load rotation + orchestrator data · same shape as /discovery page.
async function loadRotationAndOrchestrator() {
  const pool = getFoodDbPool();
  const workItems = buildWorkItemRegistry().filter((w) => w.category === "market");

  const rotationQ = pool.query<{
    city: string; category: string; round: number; state: RotationStateKind;
    last_cycle_started_at: string | Date | null; last_productive_at: string | Date | null;
    consecutive_zero_new_cycles: number; total_records_last_cycle: number | null;
    records_new_last_cycle: number | null; reactivation_reason: string | null;
    next_action_hint: string | null; state_entered_at: string | Date | null; updated_at: string | Date | null;
  }>(`
    SELECT city, category, round, state, last_cycle_started_at, last_productive_at,
           consecutive_zero_new_cycles, total_records_last_cycle, records_new_last_cycle,
           reactivation_reason, next_action_hint, state_entered_at, updated_at
      FROM nex.discovery_rotation_state
     WHERE category = 'market'
     ORDER BY city
  `);

  const inFlightQ = pool.query<{ id: string; worker_config: string | null; started_at: string | Date }>(`
    SELECT id, worker_config, started_at
      FROM nex.worker_cycle_run
     WHERE status='running' AND started_at > now() - interval '2 hours'
       AND worker_config LIKE 'market:%'
  `);

  const lastCycleQ = pool.query<{ worker_id: string; worker_config: string; status: string; started_at: string | Date }>(`
    SELECT DISTINCT ON (worker_config)
           worker_id, worker_config, status, started_at
      FROM nex.worker_cycle_run
     WHERE worker_config LIKE 'market:%' AND started_at > now() - interval '7 days'
     ORDER BY worker_config, started_at DESC
  `);

  let recentPicks: RecentPick[] = [];
  try {
    const picks = await pool.query<{ city: string; category: string; picked_at: string | Date }>(`
      SELECT city, category, picked_at FROM nex.discovery_orchestrator_pick
       WHERE category = 'market' AND picked_at > now() - interval '60 minutes'
       ORDER BY picked_at ASC LIMIT 30
    `);
    recentPicks = picks.rows.map((r) => ({ city: r.city, category: r.category, pickedAt: new Date(r.picked_at) }));
  } catch { /* pick table may not exist yet */ }

  const [rotation, inFlightRaw, lastCycles] = await Promise.all([rotationQ, inFlightQ, lastCycleQ]);

  const inFlight: InFlightCycle[] = [];
  for (const row of inFlightRaw.rows) {
    const cfg = String(row.worker_config ?? "");
    for (const wi of workItems) {
      if (!wi.workerConfigLikePrefix) continue;
      const prefix = wi.workerConfigLikePrefix.replace("%", "");
      if (cfg.startsWith(prefix)) {
        inFlight.push({ cycleId: row.id, city: wi.city, category: wi.category, startedAt: new Date(row.started_at) });
        break;
      }
    }
  }

  const stateRows = rotation.rows.map((r) => ({
    city: r.city,
    category: r.category as "market",
    round: r.round,
    state: r.state,
    lastCycleStartedAt: r.last_cycle_started_at ? new Date(r.last_cycle_started_at) : null,
    lastProductiveAt: r.last_productive_at ? new Date(r.last_productive_at) : null,
  }));
  const extras = new Map(rotation.rows.map((r) => [`${r.city}:${r.category}:${r.round}`, {
    consecutiveZero: r.consecutive_zero_new_cycles ?? 0,
    totalLast: r.total_records_last_cycle,
    newLast: r.records_new_last_cycle,
    reactivation: r.reactivation_reason,
    hint: r.next_action_hint,
    stateEnteredAt: r.state_entered_at ? new Date(r.state_entered_at) : null,
    updatedAt: r.updated_at ? new Date(r.updated_at) : null,
  }]));
  const snapshot = buildRotationSnapshot(stateRows, workItems, extras);
  const queue = buildDiscoveryQueue(snapshot, inFlight, recentPicks);
  const inFlightKeys = new Set(inFlight.map((f) => `${f.city}:${f.category}`));

  const lastStatusByKey = new Map<string, "completed" | "failed" | "running">();
  for (const row of lastCycles.rows) {
    const cfg = String(row.worker_config ?? "");
    for (const wi of workItems) {
      if (!wi.workerConfigLikePrefix) continue;
      const prefix = wi.workerConfigLikePrefix.replace("%", "");
      if (cfg.startsWith(prefix)) {
        const key = `${wi.city}:${wi.category}`;
        if (!lastStatusByKey.has(key)) {
          const s = row.status;
          if (s === "completed" || s === "failed" || s === "running") lastStatusByKey.set(key, s);
        }
        break;
      }
    }
  }

  return { snapshot, queue, inFlight, inFlightKeys, lastStatusByKey };
}

export default async function CommerceHqPage(): Promise<React.JSX.Element> {
  const [counts, products, walkerCycles, perCitySellers, rotOrch] = await Promise.all([
    getCommerceHqCounts(),
    listProducts(),
    loadMarketWalkerCycles(),
    loadPerCitySellerCounts(),
    loadRotationAndOrchestrator(),
  ]);
  const lastCycle = walkerCycles[0] ?? null;
  const lastSuccess = walkerCycles.find((c) => c.status === "completed" && (c.persisted ?? 0) > 0);
  const activeMarketWorkers = rotOrch.inFlight.length;
  const marketWouldPick = rotOrch.queue.filter((q) => q.status === "would-pick").length;

  const snapshotByKey = new Map(rotOrch.snapshot.map((s) => [`${s.city}:${s.category}`, s]));
  const queueByKey    = new Map(rotOrch.queue.map((q) => [`${q.city}:${q.category}`, q]));

  return (
    <div className="nex-app-root" style={{ padding: 32, maxWidth: 1240, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: 1, color: "#8a8776", marginBottom: 6 }}>
            NEX HQ · Subordinate view
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>Commerce · Indonesia workforce</h1>
          <p style={{ marginTop: 8, color: "#666", fontSize: 14 }}>
            NEX Marketplace vertical.{" "}
            <strong style={{ color: "#a52020" }}>Discovered ≠ Claimed ≠ Registered ≠ Verified ≠ Active.</strong>
            {" "}Same non-stop workforce rule as accommodation · every state below is real DB.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/nex-head-quarters/discovery" style={pillLink("orange")}>
            → Discovery Matrix
          </Link>
          <Link href="/nex-market" style={pillLink("dark")}>
            → NEX Market
          </Link>
        </div>
      </div>

      {/* Global universe counts · existing */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, margin: "24px 0" }}>
        <Card label="Businesses discovered" value={String(counts.businessesDiscovered)} />
        <Card label="Registered sellers"    value={String(counts.registeredSellers)} />
        <Card label="Active sellers"        value={String(counts.activeSellers)} />
        <Card label="Products listed"       value={String(counts.productsListed)} />
        <Card label="Variants listed"       value={String(counts.variantsListed)} />
      </section>

      {/* ── Live Market Workforce (2026-08-24) ── */}
      <section style={{ marginTop: 10 }}>
        <SectionLabel>Live Market Workforce · non-stop across Indonesia</SectionLabel>
        <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
            <StatChip label="Market workers active" value={`${activeMarketWorkers} / ${MAX_SLOTS}`} tone={activeMarketWorkers > 0 ? "green" : "neutral"} />
            <StatChip label="Ready to pick" value={String(marketWouldPick)} tone={marketWouldPick > 0 ? "blue" : "neutral"} />
            <StatChip label="Cities tracked" value={String(CITY_REGISTRY.length)} tone="neutral" />
          </div>
          <div style={{ fontSize: 11, color: "#8a8776", marginBottom: 10 }}>
            Same rule as accommodation: SATURATED is temporary · Rotation Controller returns to it in a later round.
            Adding a city to <code>src/lib/nex/city-registry.ts</code> extends this matrix automatically.
          </div>
          {/* Legend */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12, fontSize: 10 }}>
            {(Object.keys(WORKFORCE_STATUS_META) as WorkforceStatus[]).map((s) => {
              const m = WORKFORCE_STATUS_META[s];
              return (
                <span key={s} style={{ padding: "3px 8px", borderRadius: 999, background: m.bg, color: m.fg, border: `1px solid ${m.border}`, fontWeight: 600 }}>
                  {m.dot} {m.label}
                </span>
              );
            })}
          </div>
          {/* City grid · one row per registered city */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {CITY_REGISTRY.map((cityEntry) => {
              const key = `${cityEntry.canonical}:market`;
              const snap = snapshotByKey.get(key);
              const q = queueByKey.get(key);
              const status = resolveWorkforceStatus({
                city: cityEntry.canonical,
                category: "market",
                walkerAvailable: snap?.walkerAvailable ?? false,
                rotationState: snap?.state ?? null,
                lastCycleStatus: rotOrch.lastStatusByKey.get(key) ?? null,
                consecutiveZeroNewCycles: snap?.consecutiveZeroNewCycles ?? 0,
                inFlight: rotOrch.inFlightKeys.has(key),
                isQueued: q?.status === "would-pick",
                isEligible: q?.status === "eligible",
                isWaitingCooldown: q?.status === "waiting-cooldown",
                isGatedProvider: q?.status === "skipped-gated-provider",
              });
              const m = WORKFORCE_STATUS_META[status];
              const sellerCounts = perCitySellers.get(cityEntry.canonical) ?? { total: 0, discovered: 0, registered: 0, active: 0 };
              return (
                <Link key={cityEntry.slug} href={`/nex-market/city/${cityEntry.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <div style={{
                    padding: "12px 14px", borderRadius: 10,
                    background: m.bg, border: `1px solid ${m.border}`,
                    display: "flex", flexDirection: "column", gap: 6,
                    cursor: "pointer",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>
                        {cityEntry.canonical}
                      </div>
                      <span style={{
                        fontSize: 9.5, letterSpacing: 0.6, textTransform: "uppercase",
                        padding: "2px 8px", borderRadius: 999, fontWeight: 800,
                        background: "rgba(255,255,255,0.6)", color: m.fg,
                      }}>{m.dot} {m.label}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: "#666" }}>{cityEntry.province}</div>
                    <div style={{ fontSize: 11.5, color: "#333", marginTop: 4 }}>
                      <strong>{sellerCounts.total}</strong> seller{sellerCounts.total === 1 ? "" : "s"} discovered
                      {sellerCounts.active > 0 && <> · <strong>{sellerCounts.active}</strong> active</>}
                    </div>
                    {snap?.recordsNewLastCycle != null && (
                      <div style={{ fontSize: 10.5, color: "#555" }}>
                        last cycle: {snap.recordsNewLastCycle} new{snap.consecutiveZeroNewCycles > 0 ? ` · ${snap.consecutiveZeroNewCycles}× zero streak` : ""}
                      </div>
                    )}
                    {snap?.lastCycleStartedAt && (
                      <div style={{ fontSize: 9.5, color: "#888", fontFamily: "monospace" }}>
                        {fmtIso(snap.lastCycleStartedAt)}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Recent listings · unchanged */}
      <section style={{ marginTop: 24 }}>
        <SectionLabel>Recent listings</SectionLabel>
        <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#fafafa", textAlign: "left", borderBottom: "1px solid #eee" }}>
                <th style={{ padding: "8px 12px" }}>Product</th>
                <th style={{ padding: "8px 12px" }}>Seller</th>
                <th style={{ padding: "8px 12px" }}>Category</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Price</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Stock</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && (
                <tr><td colSpan={5} style={{ padding: "14px 12px", color: "#8a8776" }}>No listings yet.</td></tr>
              )}
              {products.map((p) => (
                <tr key={p.productId} style={{ borderBottom: "1px solid #f4f4f4" }}>
                  <td style={{ padding: "8px 12px" }}>
                    <Link href={`/nex-shop/product/${p.slug}`} style={{ color: "#1a1a1a" }}>{p.name}</Link>
                  </td>
                  <td style={{ padding: "8px 12px" }}>{p.sellerDisplayName}</td>
                  <td style={{ padding: "8px 12px", color: "#8a8776" }}>{p.categoryLabel ?? "—"}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>
                    {p.minPriceIdr === p.maxPriceIdr ? fmtIdr(p.minPriceIdr) : `${fmtIdr(p.minPriceIdr)}–${fmtIdr(p.maxPriceIdr)}`}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: p.totalStock > 0 ? "#1f6b1f" : "#a52020" }}>{p.totalStock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cycles table · now ALL-CITIES · was Yogyakarta only */}
      <section style={{ marginTop: 24 }}>
        <SectionLabel>Market Walker · zone cycles (all Indonesia)</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
          <Card label="Last cycle" value={lastCycle ? lastCycle.status : "never run"} />
          <Card label="Last successful cycle" value={lastSuccess ? fmtIso(lastSuccess.startedAt) : "none"} />
          <Card label="Cycles recorded" value={String(walkerCycles.length)} />
        </div>
        <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #eee", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#fafafa", textAlign: "left", borderBottom: "1px solid #eee" }}>
                <th style={{ padding: "8px 12px" }}>Started</th>
                <th style={{ padding: "8px 12px" }}>Worker config</th>
                <th style={{ padding: "8px 12px" }}>Status</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Returned</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>New</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Errors</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Duration s</th>
              </tr>
            </thead>
            <tbody>
              {walkerCycles.length === 0 && (
                <tr><td colSpan={7} style={{ padding: "14px 12px", color: "#8a8776" }}>No Market Walker cycles recorded yet · start the scheduler with NEX_DEV_WORKERS=1 npm run dev:workers</td></tr>
              )}
              {walkerCycles.map((c) => (
                <tr key={c.cycleId} style={{ borderBottom: "1px solid #f4f4f4" }}>
                  <td style={{ padding: "8px 12px", fontFamily: "monospace" }}>{fmtIso(c.startedAt)}</td>
                  <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 11 }}>{c.workerConfig}</td>
                  <td style={{ padding: "8px 12px", color: c.status === "completed" ? "#1f6b1f" : c.status === "failed" ? "#a52020" : "#666" }}>{c.status}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>{c.processed ?? "—"}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: (c.persisted ?? 0) > 0 ? "#1f6b1f" : "#666" }}>{c.persisted ?? "—"}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: c.errors > 0 ? "#a52020" : "#666" }}>{c.errors}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>{c.durationS ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <SectionLabel>Doctrine boundary</SectionLabel>
        <ul style={{ fontSize: 13, lineHeight: 1.6, color: "#333", paddingLeft: 18 }}>
          <li>🟢 Real payment: OFF (buttons are demo)</li>
          <li>🟢 Real transport dispatch: OFF (Stage-B triple-gated)</li>
          <li>🟢 Automatic seller outreach: OFF (Communications Engine mock-only)</li>
          <li>🟢 Discovered businesses NEVER presented as NEX sellers</li>
          <li>🟢 Seller fee configurable via nex.mp_commerce_policy · never hard-coded</li>
          <li>🟢 Provider Rate Governor authoritative · Nominatim 1500ms · Overpass 2000ms · never bypassed</li>
        </ul>
      </section>

      <p style={{ marginTop: 24, fontSize: 12, color: "#8a8776" }}>
        <Link href="/nex-shop" style={{ color: "#8a8776", textDecoration: "underline" }}>→ open NEX Shop</Link>
        {" · "}
        <Link href="/nex-head-quarters" style={{ color: "#8a8776", textDecoration: "underline" }}>← back to NEX Reception</Link>
        {" · "}
        Adding a city = one entry in <code>src/lib/nex/city-registry.ts</code>.
      </p>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 16 }}>
      <div style={{ fontSize: 11, letterSpacing: 0.6, color: "#8a8776", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>{children}</h2>;
}

function StatChip({ label, value, tone }: { label: string; value: string; tone: "green" | "blue" | "neutral" }): React.JSX.Element {
  const m = tone === "green" ? { bg: "rgba(16,185,129,0.10)", fg: "#047857" }
          : tone === "blue"  ? { bg: "rgba(37,99,235,0.10)",  fg: "#1e40af" }
                             : { bg: "rgba(0,0,0,0.03)",       fg: "#333" };
  return (
    <span style={{ padding: "6px 12px", borderRadius: 999, background: m.bg, color: m.fg, fontSize: 12, fontWeight: 600 }}>
      {label}: <strong style={{ fontWeight: 800 }}>{value}</strong>
    </span>
  );
}

function pillLink(tone: "orange" | "dark"): React.CSSProperties {
  const m = tone === "orange"
    ? { bg: "#c2410c", fg: "#fff", border: "#9a3412" }
    : { bg: "#1a1a1a", fg: "#fff", border: "#1a1a1a" };
  return {
    padding: "10px 16px", background: m.bg, color: m.fg, borderRadius: 999,
    fontSize: 12, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap",
    border: `1px solid ${m.border}`,
  };
}

// _loadDiscoveredSellerCount removed 2026-08-24 · loadPerCitySellerCounts now covers it richer + per-city.
