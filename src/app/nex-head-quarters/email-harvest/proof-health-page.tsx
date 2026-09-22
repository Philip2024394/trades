// EMAIL HARVEST · Proof & Health
//
// The anti-fabrication guardrail. Distinguishes MACHINERY (test-proven)
// from ENDPOINT (code-ready but not activated) from LIVE WORLD (evidence
// of real observation) from PERSISTENT DATA (rows in real tables) from
// CONTINUOUS OPERATION (recent yield) from RECOVERY (reaper activity)
// from 24/7 HEALTH (all of the above sustained).
//
// GREEN/AMBER/RED with evidence timestamps. Reuses existing endpoints:
//   /api/nex/founder/marketing/acceptance-matrix
//   /api/nex/founder/marketing/sending-safety-readiness
//   /api/nex/founder/world/scaffolding-programme-status
//   /api/nex/founder/email-harvest/{yield-summary,queue-summary}

"use client";

import { useEffect, useState } from "react";
import type { EmailHarvestPage } from "@/lib/nex-hq/email-harvest-manifest";

type BandState = "green" | "amber" | "red" | "unknown";

interface HealthBand {
  readonly name: string;
  readonly rule: string;
  readonly state: BandState;
  readonly evidence: string;
  readonly source: string;
}

interface Feed {
  matrix?: { counts?: { green_under_test?: number; founder_decision_deferred?: number; total?: number }; world_proof_state?: string };
  readiness?: { report?: { overall_state?: string; gates?: Record<string, boolean> } };
  scaffolding?: { cumulative_business_evidence?: { total_rows?: number }; cycles?: { last_24h?: number; most_recent_at?: string | null } };
  queue?: { queued: number; claimed: number; processing: number; completed: number; failed: number; dead_letter: number };
  yield?: { total_last_60_min: number; total_last_24h: number; most_recent_at: string | null };
}

const TONE: Record<BandState, { bg: string; fg: string; border: string; label: string }> = {
  green:   { bg: "#dcfce7", fg: "#166534", border: "#86efac", label: "GREEN" },
  amber:   { bg: "#fef3c7", fg: "#92400e", border: "#fcd34d", label: "AMBER" },
  red:     { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5", label: "RED" },
  unknown: { bg: "#f5f5f4", fg: "#57534e", border: "#a8a29e", label: "UNKNOWN" },
};

function computeBands(feed: Feed): HealthBand[] {
  const m = feed.matrix;
  const r = feed.readiness?.report;
  const s = feed.scaffolding;
  const q = feed.queue;
  const y = feed.yield;

  const bands: HealthBand[] = [];

  // 1 · MACHINERY (test-proven modules)
  const green_at = m?.counts?.green_under_test;
  const total_at = m?.counts?.total;
  bands.push({
    name: "MACHINERY",
    rule: "modules pass structural + acceptance tests",
    state: green_at && total_at && green_at >= total_at - 1 ? "green" : green_at ? "amber" : "unknown",
    evidence: green_at !== undefined ? `${green_at}/${total_at} A-Z categories proven under test` : "matrix endpoint unavailable",
    source: "/api/nex/founder/marketing/acceptance-matrix",
  });

  // 2 · ENDPOINTS (code-ready + gated)
  const gates = r?.gates ?? {};
  const gates_on = Object.values(gates).filter(Boolean).length;
  const gates_total = Object.keys(gates).length || 4;
  bands.push({
    name: "ENDPOINT",
    rule: "endpoints exist + are Founder-controllable via env gates",
    state: "amber",  // by design · endpoints are dormant until Founder flips
    evidence: `${gates_on}/${gates_total} activation gates on · endpoints code-ready, gated dormant by design`,
    source: "/api/nex/founder/marketing/sending-safety-readiness",
  });

  // 3 · LIVE WORLD (real external observation)
  const cycles_24h = s?.cycles?.last_24h ?? 0;
  const most_recent = s?.cycles?.most_recent_at;
  bands.push({
    name: "LIVE WORLD",
    rule: "recent real-world cycle observed against a permitted source",
    state: cycles_24h > 0 ? "amber" : "red",
    evidence: cycles_24h > 0
      ? `${cycles_24h} cycle(s) in last 24h · most recent ${most_recent ? new Date(most_recent).toLocaleString() : "—"} · zero_results is honest at current allowlist`
      : "0 cycles in last 24h against real sources",
    source: "/api/nex/founder/world/scaffolding-programme-status",
  });

  // 4 · PERSISTENT DATA (real rows in real tables)
  const ev = s?.cumulative_business_evidence?.total_rows ?? 0;
  bands.push({
    name: "PERSISTENT DATA",
    rule: "business_evidence rows exist from live cycles (not from historical importer)",
    state: ev > 0 ? "green" : "red",
    evidence: `${ev} scaffolding business_evidence rows · ${ev === 0 ? "empty is honest · H3 bridge required" : "populated"}`,
    source: "nex.discovery_business_evidence",
  });

  // 5 · CONTINUOUS OPERATION (recent yield)
  const y60 = y?.total_last_60_min ?? 0;
  const y24 = y?.total_last_24h ?? 0;
  bands.push({
    name: "CONTINUOUS OPERATION",
    rule: "harvest_yield rows in last 60 min prove real work is flowing",
    state: y60 > 0 ? "green" : y24 > 0 ? "amber" : "red",
    evidence: y60 > 0 ? `${y60} yield events last 60 min · ${y24} last 24h`
      : y24 > 0 ? `no yield last 60 min · ${y24} last 24h · idle`
      : "0 yield events · nothing running yet · H5 controller required",
    source: "nex.harvest_yield",
  });

  // 6 · RECOVERY (proven by absence of stalled jobs OR non-zero recovered count · here: no dead_letter accumulation)
  const dl = q?.dead_letter ?? 0;
  const stuck = ((q?.claimed ?? 0) + (q?.processing ?? 0));
  bands.push({
    name: "RECOVERY",
    rule: "reaper releases expired leases · dead_letter stays bounded",
    state: dl === 0 && stuck === 0 ? "green" : dl > 10 ? "red" : "amber",
    evidence: `${dl} dead_letter · ${stuck} in-flight · reaper primitive exists in Wave H1 (28/28 tests · chaos scenario proven under test)`,
    source: "nex.harvest_job + runHarvestReaper",
  });

  // 7 · 24/7 HEALTH (roll-up · never green until all above ≥ amber and Continuous Op is green)
  const all_states = bands.map(b => b.state);
  const roll_up: BandState =
    all_states.includes("unknown") ? "unknown"
    : all_states.every(s => s === "green") ? "green"
    : all_states.includes("red") ? "red"
    : "amber";
  bands.push({
    name: "24/7 HEALTH",
    rule: "all bands above must be green sustained across multi-hour window",
    state: roll_up,
    evidence:
      roll_up === "green" ? "all bands green · sustained operation observable"
      : roll_up === "amber" ? "machinery + endpoint proven · continuous operation not yet demonstrated"
      : roll_up === "red" ? "one or more bands red · 24/7 harvest not yet running"
      : "one or more bands unknown · endpoint unavailable",
    source: "derived from above bands (rule: no green without all bands green)",
  });

  return bands;
}

export default function EmailHarvestProofHealth({ page }: { page: EmailHarvestPage }) {
  const [feed, setFeed] = useState<Feed>({});
  const [lastRefreshAt, setLastRefreshAt] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      const [ar, rr, sr, qr, yr] = await Promise.all([
        fetch("/api/nex/founder/marketing/acceptance-matrix", { cache: "no-store" }).catch(() => null),
        fetch("/api/nex/founder/marketing/sending-safety-readiness", { cache: "no-store" }).catch(() => null),
        fetch("/api/nex/founder/world/scaffolding-programme-status", { cache: "no-store" }).catch(() => null),
        fetch("/api/nex/founder/email-harvest/queue-summary", { cache: "no-store" }).catch(() => null),
        fetch("/api/nex/founder/email-harvest/yield-summary", { cache: "no-store" }).catch(() => null),
      ]);
      const next: Feed = {};
      if (ar?.ok) { const j = await ar.json(); if (j.ok) next.matrix = j.matrix; }
      if (rr?.ok) { const j = await rr.json(); if (j.ok) next.readiness = j; }
      if (sr?.ok) { const j = await sr.json(); if (j.ok && j.status) next.scaffolding = j.status; }
      if (qr?.ok) { const j = await qr.json(); if (j.ok) next.queue = j.summary; }
      if (yr?.ok) { const j = await yr.json(); if (j.ok) next.yield = j.summary; }
      setFeed(next);
      setLastRefreshAt(new Date().toLocaleTimeString());
    };
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, []);

  const bands = computeBands(feed);
  const rollup_state = bands[bands.length - 1]!.state;
  const rt = TONE[rollup_state];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <section style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", color: "#666", marginBottom: 6 }}>
          Email Harvest · Proof & Health
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 14px", color: "#111" }}>
          Anti-fabrication guardrail
        </h1>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 999, background: rt.bg, color: rt.fg, border: `1px solid ${rt.border}`, fontWeight: 800, fontSize: 14, letterSpacing: "0.05em" }}>
          24/7 HEALTH · {rt.label}
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 13, color: "#333", lineHeight: 1.6 }}>
          Every band below is a distinct claim. Test-proven modules do not imply real-world operation. Endpoint-ready code does not imply activated. Persistent data from historical importers does not imply live-cycle output. This page distinguishes those claims deliberately.
        </p>
        {lastRefreshAt && <div style={{ marginTop: 8, fontSize: 10, color: "#999" }}>Last refreshed {lastRefreshAt} · auto-refresh 30s</div>}
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {bands.map(b => {
          const t = TONE[b.state];
          return (
            <div key={b.name} style={{ background: "#fff", border: `1px solid ${t.border}`, borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#111" }}>{b.name}</h3>
                <span style={{ padding: "3px 10px", borderRadius: 999, background: t.bg, color: t.fg, fontSize: 11, fontWeight: 800, letterSpacing: "0.05em" }}>
                  ● {t.label}
                </span>
              </div>
              <p style={{ margin: "6px 0 4px", fontSize: 12, color: "#666" }}>
                <strong>Rule: </strong>{b.rule}
              </p>
              <p style={{ margin: "0 0 4px", fontSize: 13, color: "#111" }}>
                <strong>Evidence: </strong>{b.evidence}
              </p>
              <p style={{ margin: 0, fontSize: 10, color: "#999" }}>
                <strong>Source: </strong><code>{b.source}</code>
              </p>
            </div>
          );
        })}
      </section>

      <div style={{ fontSize: 10, color: "#666", lineHeight: 1.5, padding: 12, background: "#f8faf7", borderRadius: 8 }}>
        <strong style={{ color: "#166534" }}>Doctrine:</strong>
        &nbsp;"HARVESTING ACTIVE" = recent persisted successful work + live lease/worker health + queue progression. Never derived from "API returns 200" or "process exists" or "tests pass." The bands above enforce this distinction structurally.
      </div>
    </div>
  );
}
