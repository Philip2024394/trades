// EMAIL HARVEST · Overview
//
// Answers: "Is email harvesting actually working right now?"
// Reads ONLY real persisted state. Never a fake counter.
//
// State model:
//   ACTIVE   · harvest_yield row within last 5 minutes AND a worker heartbeat
//              within lease window AND at least one job in claimed/processing
//   IDLE     · queue exists · zero yields in last 60 min · no active workers ·
//              nothing broken · nothing running · truthful
//   DORMANT  · zero workers registered · zero jobs enqueued · substrate exists
//              but nothing configured to run
//   STALLED  · workers registered · lease expiries visible · no yield in SLA

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmailHarvestStub } from "@/components/nex-head-quarters/EmailHarvestStub";
import type { EmailHarvestPage } from "@/lib/nex-hq/email-harvest-manifest";

interface OverviewFeed {
  queue?: {
    queued: number; claimed: number; processing: number;
    completed: number; failed: number; dead_letter: number;
  };
  workers?: readonly { worker_id: string; status: string; last_heartbeat_at: string; expected_expiry_at: string; jobs_claimed: number; jobs_completed: number; jobs_failed: number }[];
  yield_summary?: {
    total_last_5_min: number; total_last_60_min: number; total_last_24h: number;
    by_kind_last_60_min: Record<string, number>; most_recent_at: string | null;
  };
  scaffolding?: {
    programme: { display_name: string; asia_last_policy_active: boolean } | null;
    queue: { total_in_scope: number; completed: number; in_progress: number };
    cumulative_business_evidence: { total_rows: number; rows_with_email: number };
    cumulative_emails: { total_captured: number };
    cycles: { total: number; last_24h: number; most_recent_at: string | null };
  };
  warning?: string;
}

type HeadlineState = "active" | "idle" | "dormant" | "stalled" | "unavailable";

function computeHeadline(feed: OverviewFeed): { state: HeadlineState; note: string } {
  if (!feed.queue && !feed.workers && !feed.yield_summary) {
    return { state: "unavailable", note: "Founder-only endpoints unavailable or harvest schema not yet applied." };
  }
  const workers = feed.workers ?? [];
  const q = feed.queue ?? { queued: 0, claimed: 0, processing: 0, completed: 0, failed: 0, dead_letter: 0 };
  const y = feed.yield_summary ?? { total_last_5_min: 0, total_last_60_min: 0, total_last_24h: 0, by_kind_last_60_min: {}, most_recent_at: null };
  const alive_workers = workers.filter(w => w.status === "alive").length;
  const nothing_configured = workers.length === 0 && q.queued === 0 && q.claimed === 0 && q.processing === 0 && q.completed === 0;
  if (nothing_configured) {
    return { state: "dormant", note: "Zero workers registered · zero jobs enqueued. H1 substrate exists · H3 bridge required to enqueue anything." };
  }
  if (alive_workers === 0 && (q.claimed + q.processing) > 0) {
    return { state: "stalled", note: `No alive workers but ${q.claimed + q.processing} job(s) held in lease. Reaper should recover on next tick.` };
  }
  if (y.total_last_5_min > 0 && alive_workers > 0) {
    return { state: "active", note: `${y.total_last_5_min} yield event(s) in last 5 min · ${alive_workers} live worker(s).` };
  }
  if (y.total_last_60_min > 0) {
    return { state: "idle", note: `No yield in last 5 min · last 60 min produced ${y.total_last_60_min} · quiet but not broken.` };
  }
  return { state: "idle", note: "No recent yield · queue and workers present · quiet." };
}

const TONE: Record<HeadlineState, { bg: string; fg: string; border: string; dot: string; label: string }> = {
  active:      { bg: "#dcfce7", fg: "#166534", border: "#86efac", dot: "#16a34a", label: "ACTIVE" },
  idle:        { bg: "#eff6ff", fg: "#1e40af", border: "#93c5fd", dot: "#3b82f6", label: "IDLE" },
  dormant:     { bg: "#f5f5f4", fg: "#57534e", border: "#a8a29e", dot: "#78716c", label: "DORMANT" },
  stalled:     { bg: "#fef3c7", fg: "#92400e", border: "#fcd34d", dot: "#eab308", label: "STALLED" },
  unavailable: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5", dot: "#dc2626", label: "UNAVAILABLE" },
};

export default function EmailHarvestOverview({ page }: { page: EmailHarvestPage }) {
  const [feed, setFeed] = useState<OverviewFeed>({});
  const [lastRefreshAt, setLastRefreshAt] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      const [qr, wr, yr, sr] = await Promise.all([
        fetch("/api/nex/founder/email-harvest/queue-summary", { cache: "no-store" }).catch(() => null),
        fetch("/api/nex/founder/email-harvest/workers", { cache: "no-store" }).catch(() => null),
        fetch("/api/nex/founder/email-harvest/yield-summary", { cache: "no-store" }).catch(() => null),
        fetch("/api/nex/founder/world/scaffolding-programme-status", { cache: "no-store" }).catch(() => null),
      ]);
      const next: OverviewFeed = {};
      if (qr?.ok) { const j = await qr.json(); if (j.ok) next.queue = j.summary; }
      if (wr?.ok) { const j = await wr.json(); if (j.ok) next.workers = j.workers; }
      if (yr?.ok) { const j = await yr.json(); if (j.ok) next.yield_summary = j.summary; }
      if (sr?.ok) { const j = await sr.json(); if (j.ok && j.status) next.scaffolding = j.status; }
      setFeed(next);
      setLastRefreshAt(new Date().toLocaleTimeString());
    };
    void load();
    const id = setInterval(() => void load(), 20_000);
    return () => clearInterval(id);
  }, []);

  const head = computeHeadline(feed);
  const t = TONE[head.state];

  if (head.state === "unavailable") {
    return <EmailHarvestStub page={{ ...page, status: "stub", blocker: "Email-harvest read-only endpoints not yet deployed in this environment. Overview will populate as soon as the harvest schema is applied and Founder-only endpoints are reachable." }} />;
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Headline · state pill + summary */}
      <section style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", color: "#666", marginBottom: 6 }}>
          Email Harvest · Overview
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 14px", color: "#111" }}>
          Is email harvesting actually working right now?
        </h1>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 999, background: t.bg, color: t.fg, border: `1px solid ${t.border}`, fontWeight: 800, fontSize: 14, letterSpacing: "0.05em" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: t.dot }} />
          {t.label}
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 14, color: "#333", lineHeight: 1.5 }}>{head.note}</p>
        {lastRefreshAt && <div style={{ marginTop: 8, fontSize: 10, color: "#999" }}>Last refreshed {lastRefreshAt} · auto-refresh 20s</div>}
      </section>

      {/* Queue tiles */}
      {feed.queue && (
        <section style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", color: "#666", marginBottom: 10 }}>
            Harvest queue · <code>nex.harvest_job</code>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
            {[
              ["queued", feed.queue.queued, "#166534"],
              ["claimed", feed.queue.claimed, "#eab308"],
              ["processing", feed.queue.processing, "#f97316"],
              ["completed", feed.queue.completed, "#166534"],
              ["failed", feed.queue.failed, "#991b1b"],
              ["dead_letter", feed.queue.dead_letter, "#111"],
            ].map(([label, value, color]) => (
              <div key={String(label)} style={{ padding: 12, background: "#f8faf7", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 8 }}>
                <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: color as string }}>{String(value)}</div>
                <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>{String(label).replace(/_/g, " ")}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Workers */}
      {feed.workers !== undefined && (
        <section style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", color: "#666", marginBottom: 10 }}>
            Workers · <code>nex.harvest_worker</code>
          </div>
          {feed.workers.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "#666" }}>
              Zero workers registered. This is honest state: the H1 substrate exists but nothing is registered to run against it yet.
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f5f5f4" }}>
                  <th style={{ padding: 8, textAlign: "left" }}>worker_id</th>
                  <th style={{ padding: 8, textAlign: "left" }}>status</th>
                  <th style={{ padding: 8, textAlign: "left" }}>last_heartbeat_at</th>
                  <th style={{ padding: 8, textAlign: "right" }}>claimed</th>
                  <th style={{ padding: 8, textAlign: "right" }}>completed</th>
                  <th style={{ padding: 8, textAlign: "right" }}>failed</th>
                </tr>
              </thead>
              <tbody>
                {feed.workers.map(w => (
                  <tr key={w.worker_id} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                    <td style={{ padding: 8 }}><code>{w.worker_id}</code></td>
                    <td style={{ padding: 8 }}>{w.status}</td>
                    <td style={{ padding: 8 }}>{new Date(w.last_heartbeat_at).toLocaleString()}</td>
                    <td style={{ padding: 8, textAlign: "right" }}>{w.jobs_claimed}</td>
                    <td style={{ padding: 8, textAlign: "right" }}>{w.jobs_completed}</td>
                    <td style={{ padding: 8, textAlign: "right" }}>{w.jobs_failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* Yield summary */}
      {feed.yield_summary && (
        <section style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", color: "#666", marginBottom: 10 }}>
            Real-work evidence · <code>nex.harvest_yield</code>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
            <Tile v={feed.yield_summary.total_last_5_min} l="yield · last 5 min" />
            <Tile v={feed.yield_summary.total_last_60_min} l="yield · last 60 min" />
            <Tile v={feed.yield_summary.total_last_24h} l="yield · last 24h" />
            <Tile v={feed.yield_summary.most_recent_at ? new Date(feed.yield_summary.most_recent_at).toLocaleTimeString() : "—"} l="most recent yield" />
          </div>
        </section>
      )}

      {/* Scaffolding programme cross-link (real persisted data · reused endpoint) */}
      {feed.scaffolding?.programme && (
        <section style={{ background: "#f0fdf4", border: "1px solid rgba(22,163,74,0.30)", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", color: "#166534", marginBottom: 10 }}>
            Scaffolding programme · live persisted state
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 12 }}>
            <Tile v={String(feed.scaffolding.queue.total_in_scope)} l="countries in scope" />
            <Tile v={String(feed.scaffolding.queue.completed)} l="completed" />
            <Tile v={String(feed.scaffolding.queue.in_progress)} l="in progress" />
            <Tile v={String(feed.scaffolding.cumulative_business_evidence.total_rows)} l="business evidence rows" />
            <Tile v={String(feed.scaffolding.cumulative_business_evidence.rows_with_email)} l="rows with email" />
            <Tile v={String(feed.scaffolding.cumulative_emails.total_captured)} l="emails captured" />
          </div>
          <div style={{ fontSize: 11, color: "#166534" }}>
            Full country/category matrix in <Link href="/nex-head-quarters/world-discovery" style={{ color: "#166534", fontWeight: 600 }}>Countries →</Link>
          </div>
        </section>
      )}

      <div style={{ fontSize: 10, color: "#666", lineHeight: 1.5, padding: 12, background: "#f8faf7", borderRadius: 8 }}>
        <strong style={{ color: "#166534" }}>Anti-fabrication rule:</strong>
        &nbsp;This page never shows a green "RUNNING" badge without a fresh <code>harvest_yield</code> row. When the state is DORMANT or STALLED, that is the truth · no fake counters.
      </div>
    </div>
  );
}

function Tile({ v, l }: { v: string | number; l: string }) {
  return (
    <div style={{ padding: 12, background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 8 }}>
      <div style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{String(v)}</div>
      <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>{l}</div>
    </div>
  );
}
