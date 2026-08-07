// NEX Analytics · Executive Dashboard + Campaign Analytics + Segment Intelligence
//
// One panel inside the Communications Centre. Composes:
//   · /api/nex/analytics/dashboard        · KPIs · trends
//   · /api/nex/analytics/campaigns/{id}   · funnel · splits · timeline (per campaign)
//   · /api/nex/analytics/segments/{id}    · engagement + best send time (per segment)
//   · /api/nex/analytics/rollups          · top rollup tables (country · provider)
//   · /api/nex/analytics/export           · CSV/JSON download

"use client";

import { useCallback, useEffect, useState } from "react";

// ── Response shapes ────────────────────────────────────────────────
type DashboardResponse = {
  ok: boolean;
  today: { campaigns: number; sent: number; delivery_rate: number | null; open_rate: number | null; click_rate: number | null; bounce_rate: number | null; unsubscribe_rate: number | null };
  live:  { active_workers: number; queue_depth: number; dead_letter: number; next_scheduled_at: string | null };
  latency: { avg_send_ms: number | null; avg_queue_wait_ms: number | null };
  trends: {
    emails_per_hour: Array<{ hour: string; sent: number; opens: number; clicks: number }>;
    daily: Array<{ day: string; sent: number; delivered: number; opens: number; clicks: number; bounces: number; unsubscribes: number }>;
    queue_depth: Array<{ minute: string; depth: number }>;
    delivery_latency: Array<{ hour: string; avg_ms: number }>;
  };
};
type CampaignRow = { campaign_id: string; name: string };
type CampaignAnalyticsResponse = {
  ok: boolean;
  campaign_id: string;
  totals: Record<string, number | string | null>;
  funnel: { queued: number; delivered: number; opened: number; clicked: number };
  country_split: Array<{ country: string | null; sent: number; delivered: number; opens: number; clicks: number }>;
  domain_split:  Array<{ domain:  string | null; sent: number; delivered: number; opens: number; clicks: number }>;
  device_split:  Array<{ device: string; count: number }>;
  timeline: Array<{ hour: string; delivered: number; opens: number; clicks: number; bounces: number; unsubscribes: number }>;
};
type SegmentRow = { segment_id: string; name: string };
type SegmentIntelligenceResponse = {
  ok: boolean;
  segment_id: string;
  totals: Record<string, number | string | null>;
  best_hour_utc: number | null;
  best_weekday: number | null;
  growth_last_30d: number;
  unsub_trend_last_30d: Array<{ day: string; count: number }>;
};

const T = {
  panel: "#12161c", panelHi: "#1a2028", border: "#232b36",
  text: "#e5e9ef", textDim: "#8892a0", textFade: "#5c6572",
  accent: "#4dd0a0", warning: "#f0b45a", danger: "#f0665a",
  info: "#5aa6f0", purple: "#b48cf0",
};

const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export function AnalyticsPanel() {
  const [dash, setDash] = useState<DashboardResponse | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [segments,  setSegments]  = useState<SegmentRow[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedSegmentId,  setSelectedSegmentId]  = useState<string | null>(null);
  const [campAnalytics, setCampAnalytics] = useState<CampaignAnalyticsResponse | null>(null);
  const [segAnalytics,  setSegAnalytics]  = useState<SegmentIntelligenceResponse | null>(null);

  const loadDash = useCallback(async () => {
    const r = await fetch("/api/nex/analytics/dashboard", { cache: "no-store" });
    const d = await r.json() as DashboardResponse;
    if (d.ok) setDash(d);
  }, []);

  const loadPickers = useCallback(async () => {
    const [c, s] = await Promise.all([
      fetch("/api/nex/campaigns").then((r) => r.json()) as Promise<{ ok: boolean; campaigns: CampaignRow[] }>,
      fetch("/api/nex/segments").then((r) => r.json())  as Promise<{ ok: boolean; segments: SegmentRow[] }>,
    ]);
    if (c.ok) setCampaigns(c.campaigns);
    if (s.ok) setSegments(s.segments);
  }, []);

  useEffect(() => { void loadDash(); void loadPickers(); const t = setInterval(loadDash, 15_000); return () => clearInterval(t); }, [loadDash, loadPickers]);

  useEffect(() => {
    if (!selectedCampaignId) { setCampAnalytics(null); return; }
    void fetch(`/api/nex/analytics/campaigns/${selectedCampaignId}`).then((r) => r.json()).then((d: CampaignAnalyticsResponse) => { if (d.ok) setCampAnalytics(d); else setCampAnalytics(null); });
  }, [selectedCampaignId]);

  useEffect(() => {
    if (!selectedSegmentId) { setSegAnalytics(null); return; }
    void fetch(`/api/nex/analytics/segments/${selectedSegmentId}`).then((r) => r.json()).then((d: SegmentIntelligenceResponse) => { if (d.ok) setSegAnalytics(d); else setSegAnalytics(null); });
  }, [selectedSegmentId]);

  return (
    <div className="space-y-4">
      {/* ═════ 1 · Executive KPIs ═════ */}
      <ExecutiveKpis dash={dash} />

      {/* ═════ 2 · Trends ═════ */}
      <TrendsRow dash={dash} />

      {/* ═════ 3 · Campaign analytics ═════ */}
      <div className="rounded-md border" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="flex items-center gap-2 border-b p-2" style={{ borderColor: T.border }}>
          <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Campaign analytics</div>
          <select className="rounded-md border px-2 py-1 text-[11px]" style={{ background: T.panel, borderColor: T.border, color: T.text }}
            value={selectedCampaignId ?? ""} onChange={(e) => setSelectedCampaignId(e.target.value || null)}>
            <option value="">— select a campaign —</option>
            {campaigns.map((c) => <option key={c.campaign_id} value={c.campaign_id}>{c.name}</option>)}
          </select>
          <div className="ml-auto flex gap-1">
            <a href="/api/nex/analytics/export?scope=campaigns&format=csv" className="rounded-md border px-2 py-1 text-[10px]" style={{ background: T.panel, borderColor: T.border, color: T.info }}>Export CSV</a>
            <a href="/api/nex/analytics/export?scope=events&format=csv&limit=5000" className="rounded-md border px-2 py-1 text-[10px]" style={{ background: T.panel, borderColor: T.border, color: T.info }}>Export events</a>
          </div>
        </div>
        {campAnalytics ? <CampaignAnalyticsBody a={campAnalytics} /> : (
          <div className="p-3 text-[11px]" style={{ color: T.textFade }}>Pick a campaign above to see the funnel, splits, and timeline.</div>
        )}
      </div>

      {/* ═════ 4 · Segment intelligence ═════ */}
      <div className="rounded-md border" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="flex items-center gap-2 border-b p-2" style={{ borderColor: T.border }}>
          <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Segment intelligence</div>
          <select className="rounded-md border px-2 py-1 text-[11px]" style={{ background: T.panel, borderColor: T.border, color: T.text }}
            value={selectedSegmentId ?? ""} onChange={(e) => setSelectedSegmentId(e.target.value || null)}>
            <option value="">— select a segment —</option>
            {segments.map((s) => <option key={s.segment_id} value={s.segment_id}>{s.name}</option>)}
          </select>
        </div>
        {segAnalytics ? <SegmentIntelligenceBody a={segAnalytics} /> : (
          <div className="p-3 text-[11px]" style={{ color: T.textFade }}>Pick a segment to see engagement, growth, and best send time.</div>
        )}
      </div>

      <div className="text-[9.5px] italic" style={{ color: T.textFade }}>
        Analytics reads from an incremental rollup layer over the canonical event stream · today the simulator generates realistic events (98% delivered · 45% opened · 9% clicked · 1.5% bounced · 0.2% unsubscribed) so dashboards behave the same when real provider webhooks arrive.
      </div>
    </div>
  );
}

// ── Executive KPIs ────────────────────────────────────────────────
function ExecutiveKpis({ dash }: { dash: DashboardResponse | null }) {
  const d = dash;
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
      <Kpi label="Campaigns today"  value={d?.today.campaigns ?? "—"} tone={d?.today.campaigns ? "good" : "unset"} />
      <Kpi label="Emails sent today" value={d?.today.sent?.toLocaleString() ?? "—"} tone={d?.today.sent ? "neutral" : "unset"} />
      <Kpi label="Delivery rate"    value={fmtPct(d?.today.delivery_rate)}    tone={rateTone(d?.today.delivery_rate, 95)} />
      <Kpi label="Open rate"        value={fmtPct(d?.today.open_rate)}        tone={rateTone(d?.today.open_rate, 20)} />
      <Kpi label="Click rate"       value={fmtPct(d?.today.click_rate)}       tone={rateTone(d?.today.click_rate, 3)} />
      <Kpi label="Bounce rate"      value={fmtPct(d?.today.bounce_rate)}      tone={rateTone(d?.today.bounce_rate, 3, true)} />
      <Kpi label="Unsub rate"       value={fmtPct(d?.today.unsubscribe_rate)} tone={rateTone(d?.today.unsubscribe_rate, 0.5, true)} />
      <Kpi label="Active workers"   value={d?.live.active_workers ?? 0} tone={d?.live.active_workers ? "good" : "unset"} />
      <Kpi label="Queue depth"      value={d?.live.queue_depth ?? 0}    tone={(d?.live.queue_depth ?? 0) > 0 ? "warn" : "neutral"} />
      <Kpi label="Dead letter"      value={d?.live.dead_letter ?? 0}    tone={(d?.live.dead_letter ?? 0) > 0 ? "bad"  : "neutral"} />
      <Kpi label="Avg send"         value={d?.latency.avg_send_ms ? `${d.latency.avg_send_ms}ms` : "—"}         tone="neutral" />
      <Kpi label="Avg queue wait"   value={d?.latency.avg_queue_wait_ms ? `${d.latency.avg_queue_wait_ms}ms` : "—"} tone="neutral" />
    </div>
  );
}

// ── Trends row ────────────────────────────────────────────────────
function TrendsRow({ dash }: { dash: DashboardResponse | null }) {
  const emailsPerHour = dash?.trends.emails_per_hour ?? [];
  const daily         = dash?.trends.daily ?? [];
  const queueDepth    = dash?.trends.queue_depth ?? [];
  const latency       = dash?.trends.delivery_latency ?? [];
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
      <TrendCard title="Emails/hour (24h)">
        {emailsPerHour.length === 0 ? <EmptyTrend /> : <SparkStack rows={emailsPerHour.map((r) => ({ label: r.hour.slice(11, 16), a: r.sent, b: r.opens, c: r.clicks }))} legend={["sent","opens","clicks"]} />}
      </TrendCard>
      <TrendCard title="Delivery latency/hour">
        {latency.length === 0 ? <EmptyTrend /> : <SparkLine rows={latency.map((r) => ({ label: r.hour.slice(11, 16), v: r.avg_ms }))} unit="ms" />}
      </TrendCard>
      <TrendCard title="Queue depth (60m)">
        {queueDepth.length === 0 ? <EmptyTrend /> : <SparkLine rows={queueDepth.map((r) => ({ label: r.minute.slice(11, 16), v: r.depth }))} unit="" />}
      </TrendCard>
      <TrendCard title="Daily (30d) · opens · clicks">
        {daily.length === 0 ? <EmptyTrend /> : <SparkStack rows={daily.slice(-14).map((r) => ({ label: r.day.slice(5), a: r.sent, b: r.opens, c: r.clicks }))} legend={["sent","opens","clicks"]} />}
      </TrendCard>
    </div>
  );
}

function TrendCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border p-2" style={{ background: T.panelHi, borderColor: T.border }}>
      <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>{title}</div>
      {children}
    </div>
  );
}
function EmptyTrend() { return <div className="p-3 text-[10.5px]" style={{ color: T.textFade }}>No data yet · run a campaign in simulation mode to populate.</div>; }

// ── Campaign analytics body ───────────────────────────────────────
function CampaignAnalyticsBody({ a }: { a: CampaignAnalyticsResponse }) {
  const t = a.totals;
  const num = (k: string) => Number((t as Record<string, unknown>)[k] ?? 0);
  const funnelMax = Math.max(a.funnel.queued, 1);
  return (
    <div className="space-y-3 p-3">
      {/* Totals row */}
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
        <Kpi label="Sent"        value={num("sent").toLocaleString()}       tone="neutral" />
        <Kpi label="Delivered"   value={num("delivered").toLocaleString()}  tone="good"    hint={fmtPct(t.delivery_rate)} />
        <Kpi label="Opens"       value={num("opens").toLocaleString()}      tone="good"    hint={`${num("unique_opens")} unique · ${fmtPct(t.open_rate)}`} />
        <Kpi label="Clicks"      value={num("clicks").toLocaleString()}     tone="good"    hint={`${num("unique_clicks")} unique · ${fmtPct(t.click_rate)}`} />
        <Kpi label="Bounces"     value={num("bounces").toLocaleString()}    tone={num("bounces") > 0 ? "warn" : "neutral"} />
        <Kpi label="Unsubs"      value={num("unsubscribes").toLocaleString()} tone={num("unsubscribes") > 0 ? "warn" : "neutral"} />
        <Kpi label="Complaints"  value={num("complaints").toLocaleString()} tone={num("complaints") > 0 ? "bad" : "neutral"} />
        <Kpi label="CTOR"        value={fmtPct(t.ctor)}                     tone="neutral" hint="click-to-open" />
      </div>

      {/* Funnel */}
      <div className="rounded-md border p-2" style={{ background: T.panel, borderColor: T.border }}>
        <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Funnel</div>
        {(["queued","delivered","opened","clicked"] as const).map((step, i) => {
          const val = a.funnel[step];
          const width = Math.max(2, Math.round((val / funnelMax) * 100));
          const colors = [T.info, T.accent, T.purple, T.warning];
          return (
            <div key={step} className="my-1 flex items-center gap-2 text-[11px]">
              <span className="w-[80px] uppercase tracking-widest text-[9.5px]" style={{ color: T.textFade }}>{step}</span>
              <div className="flex-1 rounded" style={{ background: T.panelHi, height: 16 }}>
                <div className="rounded" style={{ background: colors[i], width: `${width}%`, height: 16 }} />
              </div>
              <span className="w-[80px] text-right font-mono" style={{ color: T.text }}>{val.toLocaleString()}</span>
              {i > 0 ? <span className="w-[70px] text-right font-mono text-[10px]" style={{ color: T.textFade }}>
                {fmtPct((val / Math.max(a.funnel.queued, 1)) * 100)}
              </span> : <span className="w-[70px]" />}
            </div>
          );
        })}
      </div>

      {/* Country + Domain + Device */}
      <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <SplitCard title="Country" rows={a.country_split.map((r) => ({ label: r.country ?? "—", value: r.delivered, hint: `opens ${r.opens} · clicks ${r.clicks}` }))} />
        <SplitCard title="Domain"  rows={a.domain_split.map((r)  => ({ label: r.domain  ?? "—", value: r.delivered, hint: `opens ${r.opens} · clicks ${r.clicks}` }))} />
        <SplitCard title="Device"  rows={a.device_split.map((r)  => ({ label: r.device, value: r.count }))} />
      </div>

      {/* Timeline */}
      {a.timeline.length > 0 ? (
        <div className="rounded-md border p-2" style={{ background: T.panel, borderColor: T.border }}>
          <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Timeline · engagement over time</div>
          <SparkStack rows={a.timeline.map((r) => ({ label: r.hour.slice(11, 16), a: r.delivered, b: r.opens, c: r.clicks }))} legend={["delivered","opens","clicks"]} />
        </div>
      ) : null}
    </div>
  );
}

function SplitCard({ title, rows }: { title: string; rows: Array<{ label: string; value: number; hint?: string }> }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="rounded-md border p-2" style={{ background: T.panel, borderColor: T.border }}>
      <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>{title} · top {Math.min(10, rows.length)}</div>
      {rows.length === 0 ? <div className="text-[10.5px]" style={{ color: T.textFade }}>—</div> : (
        <div className="space-y-0.5">
          {rows.slice(0, 10).map((r, i) => (
            <div key={i} className="grid items-center gap-2 text-[10.5px]" style={{ gridTemplateColumns: "1fr 60px" }}>
              <div>
                <div className="truncate" style={{ color: T.text }} title={r.hint}>{r.label}</div>
                <div className="h-1 rounded-full" style={{ background: T.panelHi }}>
                  <div className="h-1 rounded-full" style={{ background: T.info, width: `${Math.round((r.value / max) * 100)}%` }} />
                </div>
              </div>
              <div className="text-right font-mono" style={{ color: T.text }}>{r.value.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Segment intelligence body ─────────────────────────────────────
function SegmentIntelligenceBody({ a }: { a: SegmentIntelligenceResponse }) {
  const t = a.totals;
  const num = (k: string) => Number((t as Record<string, unknown>)[k] ?? 0);
  return (
    <div className="space-y-3 p-3">
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        <Kpi label="Sent · segment"      value={num("sent").toLocaleString()}          tone="neutral" />
        <Kpi label="Delivered"           value={num("delivered").toLocaleString()}     tone="good" hint={fmtPct(t.delivery_rate)} />
        <Kpi label="Opens"               value={num("opens").toLocaleString()}         tone="good" hint={fmtPct(t.open_rate)} />
        <Kpi label="Clicks"              value={num("clicks").toLocaleString()}        tone="good" hint={fmtPct(t.click_rate)} />
        <Kpi label="Unsubs"              value={num("unsubscribes").toLocaleString()}  tone={num("unsubscribes") > 0 ? "warn" : "neutral"} />
        <Kpi label="Engagement score"    value={t.engagement_score ?? "—"}             tone="neutral" hint="opens+3×clicks / delivered" />
        <Kpi label="Growth · last 30d"   value={a.growth_last_30d.toLocaleString()}    tone={a.growth_last_30d > 0 ? "good" : "unset"} hint="recipients created" />
        <Kpi label="Best hour (UTC)"     value={a.best_hour_utc === null ? "—" : `${a.best_hour_utc}:00`} tone={a.best_hour_utc === null ? "unset" : "good"} />
        <Kpi label="Best weekday"        value={a.best_weekday === null ? "—" : WEEKDAYS[a.best_weekday]} tone={a.best_weekday === null ? "unset" : "good"} />
      </div>

      <div className="rounded-md border p-2" style={{ background: T.panel, borderColor: T.border }}>
        <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Unsubscribe trend · last 30d</div>
        {a.unsub_trend_last_30d.length === 0 ? (
          <div className="text-[10.5px]" style={{ color: T.textFade }}>No unsubscribes recorded.</div>
        ) : (
          <SparkLine rows={a.unsub_trend_last_30d.map((r) => ({ label: r.day.slice(5), v: r.count }))} unit="" />
        )}
      </div>
    </div>
  );
}

// ── Building blocks ────────────────────────────────────────────────
function Kpi({ label, value, tone = "neutral", hint }: { label: string; value: string | number | null; tone?: "neutral" | "good" | "warn" | "bad" | "unset"; hint?: string | null }) {
  const color = tone === "good" ? T.accent : tone === "warn" ? T.warning : tone === "bad" ? T.danger : tone === "unset" ? T.textFade : T.text;
  return (
    <div className="rounded-md border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
      <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
      <div className="mt-1 font-mono text-[16px] font-black leading-none" style={{ color }}>{value ?? "—"}</div>
      {hint ? <div className="mt-1 text-[9.5px] truncate" style={{ color: T.textFade }} title={hint}>{hint}</div> : null}
    </div>
  );
}

function SparkLine({ rows, unit }: { rows: Array<{ label: string; v: number }>; unit: string }) {
  const max = Math.max(...rows.map((r) => r.v), 1);
  return (
    <div className="flex h-16 items-end gap-1">
      {rows.map((r, i) => (
        <div key={i} className="flex flex-1 flex-col items-center" title={`${r.label} · ${r.v}${unit}`}>
          <div style={{ background: T.info, width: "100%", height: `${Math.max(2, Math.round((r.v / max) * 60))}px`, borderRadius: 2 }} />
          {i === 0 || i === rows.length - 1 || rows.length < 12 ? <div className="mt-0.5 text-[8px]" style={{ color: T.textFade }}>{r.label}</div> : null}
        </div>
      ))}
    </div>
  );
}

function SparkStack({ rows, legend }: { rows: Array<{ label: string; a: number; b: number; c: number }>; legend: [string, string, string] }) {
  const max = Math.max(...rows.map((r) => Math.max(r.a, r.b, r.c)), 1);
  const colors = [T.info, T.accent, T.warning];
  return (
    <div>
      <div className="flex h-16 items-end gap-1">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-1 items-end gap-[1px]" title={`${r.label} · ${legend[0]}:${r.a} ${legend[1]}:${r.b} ${legend[2]}:${r.c}`}>
            <div style={{ background: colors[0], width: "33%", height: `${Math.max(2, Math.round((r.a / max) * 60))}px`, borderRadius: 1 }} />
            <div style={{ background: colors[1], width: "33%", height: `${Math.max(2, Math.round((r.b / max) * 60))}px`, borderRadius: 1 }} />
            <div style={{ background: colors[2], width: "33%", height: `${Math.max(2, Math.round((r.c / max) * 60))}px`, borderRadius: 1 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2 text-[9px]" style={{ color: T.textFade }}>
        {legend.map((l, i) => (
          <span key={l} className="inline-flex items-center gap-1">
            <span style={{ background: colors[i], width: 8, height: 8, display: "inline-block", borderRadius: 1 }} />
            {l}
          </span>
        ))}
        <span className="ml-auto">n={rows.length}</span>
      </div>
    </div>
  );
}

function fmtPct(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}
function rateTone(v: number | string | null | undefined, threshold: number, invert = false): "good" | "warn" | "bad" | "neutral" | "unset" {
  if (v === null || v === undefined) return "unset";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!Number.isFinite(n)) return "unset";
  const good = invert ? n < threshold : n >= threshold;
  const bad  = invert ? n > threshold * 2 : n < threshold * 0.5;
  return good ? "good" : bad ? "bad" : "warn";
}
