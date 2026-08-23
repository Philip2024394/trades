// NEX Data Platform Centre · a Headquarters room
//
// Shows the storage substrate every service now depends on. Honest about
// what's measured (backend name · collections · records · bytes · largest ·
// parity) and what isn't yet (throughput · query latency · replication).
// Every "not instrumented" panel is marked · never fabricated.

"use client";

import { useCallback, useEffect, useState } from "react";

type Backend = {
  primary: string;
  secondary: string | null;
  mode: "single-backend" | "dual-write";
  secondary_healthy: boolean | null;
  secondary_detail: string | null;
};
type Totals = {
  collections_declared: number;
  collections_with_data: number;
  total_records: number;
  storage_used_bytes: number;
  storage_used_mb: number;
};
type PerCollection = {
  collection: string;
  total_records: number;
  latest_write_at: string | null;
  size_bytes: number;
  error: string | null;
};
type NotInstrumented = {
  writes_per_second: boolean;
  reads_per_second: boolean;
  average_query_ms: boolean;
  replication_lag_ms: boolean;
  last_backup_at: boolean;
};
type Centre = {
  backend: Backend;
  totals: Totals;
  largest_collection: { collection: string; records: number } | null;
  per_collection: PerCollection[];
  not_instrumented: NotInstrumented;
  generated_at: string;
};

type ParityRow = {
  collection: string;
  primary_count: number;
  secondary_count: number | null;
  counts_match: boolean | null;
  latest_matches: boolean | null;
  oldest_matches: boolean | null;
  overall_green: boolean;
};

const T = {
  bg:      "#0b0d10", panel: "#12161c", panelHi: "#1a2028", border: "#232b36",
  text:    "#e5e9ef", textDim: "#8892a0", textFade: "#5c6572",
  accent:  "#4dd0a0", warning: "#f0b45a", danger: "#f0665a", info: "#5aa6f0",
};

function Metric({ label, value, hint, tone = "neutral" }: { label: string; value: string | number; hint?: string; tone?: "neutral" | "good" | "warn" | "bad" | "unset" }) {
  const color = tone === "good" ? T.accent : tone === "warn" ? T.warning : tone === "bad" ? T.danger : tone === "unset" ? T.textFade : T.text;
  return (
    <div className="rounded-lg border p-3" style={{ background: T.panel, borderColor: T.border }}>
      <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
      <div className="mt-1 font-mono text-[20px] font-black leading-none" style={{ color }}>{value}</div>
      {hint ? <div className="mt-1 text-[9px]" style={{ color: T.textFade }}>{hint}</div> : null}
    </div>
  );
}

export default function DataPlatformCentre() {
  const [centre, setCentre] = useState<Centre | null>(null);
  const [parity, setParity] = useState<{ mode: string; all_green: boolean; rows: ParityRow[]; note: string; secondary_reachable: boolean | null } | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([
        fetch("/api/nex/storage/centre", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/nex/storage/parity", { cache: "no-store" }).then((r) => r.json()),
      ]);
      if (c.ok) setCentre(c);
      if (p.ok !== undefined) setParity(p);
      setLastUpdate(new Date().toLocaleTimeString());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "fetch_failed");
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  const backendTone = centre?.backend.mode === "dual-write"
    ? (centre.backend.secondary_healthy ? "good" : "bad")
    : "neutral";

  return (
    <div className="min-h-screen p-4" style={{ background: T.bg, color: T.text, fontFamily: "system-ui,-apple-system,Segoe UI,sans-serif" }}>
      {/* HEADER */}
      <div className="mb-4 flex items-baseline gap-3">
        <div>
          <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.accent }}>NEX Headquarters</div>
          <h1 className="mt-0.5 text-[22px] font-black leading-none">Data Platform Centre</h1>
          <div className="mt-1 text-[10.5px]" style={{ color: T.textDim }}>
            The storage substrate every NEX service depends on
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>Last update</div>
          <div className="font-mono text-[11px]" style={{ color: T.text }}>{lastUpdate || "—"}</div>
          {error ? <div className="mt-0.5 text-[10px]" style={{ color: T.danger }}>Error: {error}</div> : null}
        </div>
      </div>

      {/* BACKEND STATUS */}
      {centre ? (
        <div className="mb-4 rounded-lg border p-3" style={{ background: T.panel, borderColor: T.border }}>
          <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Storage Backend</div>
          <div className="mt-1 flex items-baseline gap-3">
            <div className="font-mono text-[18px] font-black" style={{ color: backendTone === "good" ? T.accent : backendTone === "bad" ? T.danger : T.text }}>
              {centre.backend.mode === "dual-write"
                ? `${centre.backend.primary} → ${centre.backend.secondary}`
                : centre.backend.primary}
            </div>
            <div className="text-[10px]" style={{ color: T.textDim }}>mode: {centre.backend.mode}</div>
            {centre.backend.mode === "dual-write" ? (
              <div className="text-[10px]" style={{ color: centre.backend.secondary_healthy ? T.accent : T.danger }}>
                secondary: {centre.backend.secondary_healthy ? "healthy" : "unreachable"}
              </div>
            ) : null}
          </div>
          {centre.backend.secondary_detail ? (
            <div className="mt-1 text-[10px] font-mono" style={{ color: T.danger }}>Detail: {centre.backend.secondary_detail}</div>
          ) : null}
        </div>
      ) : null}

      {/* TOP METRICS */}
      <div className="mb-4 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        {centre ? (
          <>
            <Metric label="Collections declared" value={centre.totals.collections_declared} hint="from Storage Contract" />
            <Metric label="Collections with data" value={centre.totals.collections_with_data} tone="neutral" />
            <Metric label="Records total" value={centre.totals.total_records.toLocaleString()} />
            <Metric label="Storage used" value={`${centre.totals.storage_used_mb} MB`} hint={`${centre.totals.storage_used_bytes.toLocaleString()} bytes`} />
            <Metric label="Largest collection" value={centre.largest_collection?.collection ?? "—"} hint={centre.largest_collection ? `${centre.largest_collection.records.toLocaleString()} records` : ""} />
            <Metric label="Parity" value={parity ? (parity.mode === "single-backend" ? "n/a" : parity.all_green ? "✓ green" : "✗ diverged") : "—"}
              tone={!parity ? "neutral" : parity.mode === "single-backend" ? "unset" : parity.all_green ? "good" : "bad"}
              hint={parity?.mode === "single-backend" ? "single backend · no comparison" : parity?.all_green ? "safe to promote after 5-7 days" : "do not promote"} />
          </>
        ) : <div className="col-span-full text-[11px]" style={{ color: T.textFade }}>Loading platform state…</div>}
      </div>

      {/* NOT-INSTRUMENTED (HONEST) */}
      {centre ? (
        <div className="mb-4 rounded-lg border p-3" style={{ background: T.panel, borderColor: T.warning }}>
          <div className="flex items-baseline gap-2">
            <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.warning }}>Not instrumented yet</div>
            <div className="ml-auto text-[9px] italic" style={{ color: T.textFade }}>Displayed honestly · never fabricated</div>
          </div>
          <div className="mt-2 grid gap-2 text-[10px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <div style={{ color: T.textDim }}>Writes/sec: <span style={{ color: T.textFade }}>—</span></div>
            <div style={{ color: T.textDim }}>Reads/sec: <span style={{ color: T.textFade }}>—</span></div>
            <div style={{ color: T.textDim }}>Avg query ms: <span style={{ color: T.textFade }}>—</span></div>
            <div style={{ color: T.textDim }}>Replication lag: <span style={{ color: T.textFade }}>—</span></div>
            <div style={{ color: T.textDim }}>Last backup: <span style={{ color: T.textFade }}>—</span></div>
          </div>
          <div className="mt-2 text-[9.5px] italic" style={{ color: T.textFade }}>
            These metrics require a ring-buffer + backup cron that ship after the pilot migration proves stable. See docs/NEX_STORAGE_CONTRACT.md §7 for the phase plan.
          </div>
        </div>
      ) : null}

      {/* PARITY DETAIL */}
      {parity ? (
        <div className="mb-4 rounded-lg border p-3" style={{ background: T.panel, borderColor: parity.all_green ? T.border : T.danger }}>
          <div className="flex items-baseline gap-2">
            <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Migration Verification</div>
            <div className="ml-auto text-[9px] italic" style={{ color: parity.all_green ? T.accent : T.danger }}>
              {parity.mode === "single-backend" ? "no comparison possible in single-backend mode" : parity.all_green ? "all green" : "divergence detected"}
            </div>
          </div>
          <div className="mt-2 text-[10px]" style={{ color: T.textDim }}>{parity.note}</div>
          {parity.rows.length > 0 ? (
            <div className="mt-2 space-y-1">
              {parity.rows.map((r) => (
                <div key={r.collection} className="grid items-center gap-2 rounded border p-2 text-[10.5px]" style={{ background: T.panelHi, borderColor: T.border, gridTemplateColumns: "180px 100px 100px 60px 60px 60px" }}>
                  <div className="font-semibold" style={{ color: T.text }}>{r.collection}</div>
                  <div className="font-mono" style={{ color: T.textDim }}>primary: {r.primary_count}</div>
                  <div className="font-mono" style={{ color: r.secondary_count === null ? T.textFade : T.textDim }}>
                    secondary: {r.secondary_count === null ? "—" : r.secondary_count}
                  </div>
                  <div style={{ color: r.counts_match === null ? T.textFade : r.counts_match ? T.accent : T.danger }}>
                    counts {r.counts_match === null ? "n/a" : r.counts_match ? "✓" : "✗"}
                  </div>
                  <div style={{ color: r.latest_matches === null ? T.textFade : r.latest_matches ? T.accent : T.danger }}>
                    latest {r.latest_matches === null ? "n/a" : r.latest_matches ? "✓" : "✗"}
                  </div>
                  <div style={{ color: r.oldest_matches === null ? T.textFade : r.oldest_matches ? T.accent : T.danger }}>
                    oldest {r.oldest_matches === null ? "n/a" : r.oldest_matches ? "✓" : "✗"}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* PER-COLLECTION INVENTORY */}
      {centre ? (
        <div className="rounded-lg border p-3" style={{ background: T.panel, borderColor: T.border }}>
          <div className="flex items-baseline gap-2">
            <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Collections Inventory</div>
            <div className="ml-auto text-[9px]" style={{ color: T.textFade }}>{centre.per_collection.length} declared</div>
          </div>
          <div className="mt-2 grid gap-1 text-[10px]" style={{ gridTemplateColumns: "200px 100px 90px 200px" }}>
            <div className="font-semibold" style={{ color: T.textDim }}>Collection</div>
            <div className="font-semibold text-right" style={{ color: T.textDim }}>Records</div>
            <div className="font-semibold text-right" style={{ color: T.textDim }}>Size</div>
            <div className="font-semibold" style={{ color: T.textDim }}>Latest write</div>
            {centre.per_collection.map((c) => (
              <div key={c.collection} className="contents">
                <div className="font-mono" style={{ color: c.total_records > 0 ? T.text : T.textFade }}>{c.collection}</div>
                <div className="text-right font-mono" style={{ color: c.total_records > 0 ? T.text : T.textFade }}>{c.total_records.toLocaleString()}</div>
                <div className="text-right font-mono" style={{ color: c.size_bytes > 0 ? T.textDim : T.textFade }}>
                  {c.size_bytes > 0 ? `${Math.round(c.size_bytes / 1024)} KB` : "—"}
                </div>
                <div className="font-mono text-[9.5px]" style={{ color: c.latest_write_at ? T.textDim : T.textFade }}>
                  {c.latest_write_at ? new Date(c.latest_write_at).toLocaleString() : "—"}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[9px] italic" style={{ color: T.textFade }}>
            Only collections migrated through the storage abstraction show live counts here.
            Un-migrated collections (marked 0 records) still write to their legacy per-service paths · see NEX_STORAGE_CONTRACT.md §7 for the migration order.
          </div>
        </div>
      ) : null}

      <div className="mt-3 text-[9px] italic" style={{ color: T.textFade }}>
        Auto-refreshes every 15 seconds · backed by /api/nex/storage/centre + /api/nex/storage/parity
      </div>
    </div>
  );
}
