// NEX Analytics Pipeline · multi-provider ingest + local aggregation
//
// PURPOSE
// Ingests external analytics (Plausible · Umami · GA4 · generic webhook)
// into a normalised local store so HQ dashboards can query without going
// out to any third-party provider. Same store also powers offline
// analysis for months when the provider bills or when a provider is swapped.
//
// STORAGE
// Append-only JSONL at `data/nex-analytics/records.jsonl`. One record per
// pageview or custom event. Aggregations computed on demand from the file.
//
// GDPR
// Visitor IDs are already hashed by upstream providers. We store what they
// give us. Country + device + browser only — no IPs.

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { emitEventSafe } from "../events/fs-store";

// ── Paths ──────────────────────────────────────────────────────────

const ROOT = path.join(process.cwd(), "data", "nex-analytics");
const RECORDS_FILE = path.join(ROOT, "records.jsonl");

async function ensureDir(): Promise<void> {
  await fs.mkdir(ROOT, { recursive: true });
}

// ── Types ─────────────────────────────────────────────────────────

export type AnalyticsProvider = "plausible" | "umami" | "ga4" | "custom";

export type AnalyticsRecord = {
  record_id: string;
  provider: AnalyticsProvider;
  event_name: string;                    // "pageview" | "custom_event" | provider-specific
  path: string | null;
  hostname: string | null;
  referrer: string | null;
  country: string | null;
  device: string | null;                 // "desktop" | "mobile" | "tablet" | ...
  browser: string | null;
  os: string | null;
  session_id: string | null;
  visitor_id: string | null;
  duration_sec: number | null;
  bounced: boolean | null;
  properties: Record<string, unknown>;
  occurred_at: string;
  ingested_at: string;
};

// ── Adapters · raw payload → normalised record ────────────────────

type UnknownRecord = Record<string, unknown>;

/** Plausible: https://plausible.io/docs/events-api  */
function fromPlausible(raw: UnknownRecord): Omit<AnalyticsRecord, "record_id" | "provider" | "ingested_at"> {
  const url = typeof raw.url === "string" ? raw.url : null;
  let pathOut: string | null = null;
  let host: string | null = typeof raw.domain === "string" ? raw.domain : null;
  if (url) {
    try {
      const u = new URL(url);
      pathOut = u.pathname;
      host = host ?? u.host;
    } catch { /* leave nulls */ }
  }
  return {
    event_name: typeof raw.name === "string" ? raw.name : "pageview",
    path: pathOut,
    hostname: host,
    referrer: typeof raw.referrer === "string" ? raw.referrer : null,
    country: typeof raw.country === "string" ? raw.country : null,
    device: typeof raw.screen_size === "string" ? raw.screen_size.toLowerCase() : null,
    browser: typeof raw.browser === "string" ? raw.browser : null,
    os: typeof raw.os === "string" ? raw.os : null,
    session_id: null,
    visitor_id: typeof raw.hashed_ip === "string" ? raw.hashed_ip : null,
    duration_sec: typeof raw.duration === "number" ? raw.duration : null,
    bounced: typeof raw.bounced === "boolean" ? raw.bounced : null,
    properties: (raw.props && typeof raw.props === "object" && !Array.isArray(raw.props))
      ? (raw.props as UnknownRecord)
      : {},
    occurred_at: typeof raw.timestamp === "string" ? raw.timestamp : new Date().toISOString(),
  };
}

/** Umami: payload shape https://umami.is/docs/api  */
function fromUmami(raw: UnknownRecord): Omit<AnalyticsRecord, "record_id" | "provider" | "ingested_at"> {
  const payload = (raw.payload && typeof raw.payload === "object" ? raw.payload : raw) as UnknownRecord;
  const url = typeof payload.url === "string" ? payload.url : null;
  let pathOut: string | null = null;
  if (url) {
    try { pathOut = new URL(url, "http://placeholder").pathname; } catch { pathOut = url; }
  }
  return {
    event_name: typeof payload.event === "string" ? payload.event : "pageview",
    path: pathOut,
    hostname: typeof payload.hostname === "string" ? payload.hostname : null,
    referrer: typeof payload.referrer === "string" ? payload.referrer : null,
    country: typeof payload.country === "string" ? payload.country : null,
    device: typeof payload.device === "string" ? payload.device : null,
    browser: typeof payload.browser === "string" ? payload.browser : null,
    os: typeof payload.os === "string" ? payload.os : null,
    session_id: typeof payload.session_id === "string" ? payload.session_id : null,
    visitor_id: typeof payload.website === "string" ? payload.website : null,
    duration_sec: null,
    bounced: null,
    properties: {},
    occurred_at: typeof payload.timestamp === "string" ? payload.timestamp : new Date().toISOString(),
  };
}

/** GA4 export shape · one row per event_name in event_params. */
function fromGA4(raw: UnknownRecord): Omit<AnalyticsRecord, "record_id" | "provider" | "ingested_at"> {
  const params = (raw.event_params && typeof raw.event_params === "object" ? raw.event_params : {}) as UnknownRecord;
  const device = (raw.device && typeof raw.device === "object" ? raw.device : {}) as UnknownRecord;
  const geo = (raw.geo && typeof raw.geo === "object" ? raw.geo : {}) as UnknownRecord;
  // Normalise GA4's "page_view" to our canonical "pageview" · custom events kept as-is.
  const rawName = typeof raw.event_name === "string" ? raw.event_name : "pageview";
  const event_name = rawName === "page_view" ? "pageview" : rawName;
  return {
    event_name,
    path: typeof params.page_location === "string"
      ? (new URL(params.page_location as string, "http://placeholder").pathname)
      : (typeof params.page_path === "string" ? params.page_path as string : null),
    hostname: typeof params.page_location === "string"
      ? (() => { try { return new URL(params.page_location as string).hostname; } catch { return null; } })()
      : null,
    referrer: typeof params.page_referrer === "string" ? params.page_referrer as string : null,
    country: typeof geo.country === "string" ? geo.country : null,
    device: typeof device.category === "string" ? device.category : null,
    browser: typeof device.web_info === "object" && device.web_info && typeof (device.web_info as UnknownRecord).browser === "string"
      ? (device.web_info as UnknownRecord).browser as string
      : null,
    os: typeof device.operating_system === "string" ? device.operating_system : null,
    session_id: typeof params.ga_session_id === "string" || typeof params.ga_session_id === "number"
      ? String(params.ga_session_id)
      : null,
    visitor_id: typeof raw.user_pseudo_id === "string" ? raw.user_pseudo_id : null,
    duration_sec: typeof params.engagement_time_msec === "number"
      ? Math.round((params.engagement_time_msec as number) / 1000)
      : null,
    bounced: null,
    properties: params,
    occurred_at: typeof raw.event_timestamp === "string" || typeof raw.event_timestamp === "number"
      ? new Date(Number(raw.event_timestamp)).toISOString()
      : new Date().toISOString(),
  };
}

/** Custom: expects the caller has already normalised. Fill nulls for missing fields. */
function fromCustom(raw: UnknownRecord): Omit<AnalyticsRecord, "record_id" | "provider" | "ingested_at"> {
  const g = (k: string) => raw[k];
  const asStr = (v: unknown): string | null => (typeof v === "string" ? v : null);
  const asBool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
  const asNum = (v: unknown): number | null => (typeof v === "number" ? v : null);
  return {
    event_name: asStr(g("event_name")) ?? "pageview",
    path: asStr(g("path")),
    hostname: asStr(g("hostname")),
    referrer: asStr(g("referrer")),
    country: asStr(g("country")),
    device: asStr(g("device")),
    browser: asStr(g("browser")),
    os: asStr(g("os")),
    session_id: asStr(g("session_id")),
    visitor_id: asStr(g("visitor_id")),
    duration_sec: asNum(g("duration_sec")),
    bounced: asBool(g("bounced")),
    properties: (g("properties") && typeof g("properties") === "object" && !Array.isArray(g("properties")))
      ? (g("properties") as UnknownRecord)
      : {},
    occurred_at: asStr(g("occurred_at")) ?? new Date().toISOString(),
  };
}

const ADAPTERS: Record<AnalyticsProvider, (raw: UnknownRecord) => Omit<AnalyticsRecord, "record_id" | "provider" | "ingested_at">> = {
  plausible: fromPlausible,
  umami: fromUmami,
  ga4: fromGA4,
  custom: fromCustom,
};

// ── Ingest ────────────────────────────────────────────────────────

export async function ingestRecord(provider: AnalyticsProvider, raw: UnknownRecord): Promise<AnalyticsRecord> {
  const adapter = ADAPTERS[provider];
  const base = adapter(raw);
  const record: AnalyticsRecord = {
    record_id: randomUUID(),
    provider,
    ingested_at: new Date().toISOString(),
    ...base,
  };
  await ensureDir();
  await fs.appendFile(RECORDS_FILE, JSON.stringify(record) + "\n", "utf8");
  return record;
}

export async function ingestBatch(provider: AnalyticsProvider, rawRecords: UnknownRecord[]): Promise<{ ingested: number; records: AnalyticsRecord[] }> {
  const records: AnalyticsRecord[] = [];
  for (const raw of rawRecords) {
    try { records.push(await ingestRecord(provider, raw)); } catch { /* per-record failure isolated */ }
  }
  // Batch acceptance also emits ONE Intelligence Event so ops can see
  // "analytics feed alive" without one event per pageview (volume control).
  if (records.length > 0) {
    emitEventSafe({
      event_type: "analytics_ingested",
      source: "webhook",
      actor_id: provider,
      related_department: "marketing",
      outcome: "informational",
      payload: {
        provider,
        count: records.length,
        first_occurred: records[0].occurred_at,
        last_occurred: records[records.length - 1].occurred_at,
      },
    });
  }
  return { ingested: records.length, records };
}

// ── Read + aggregate ─────────────────────────────────────────────

async function readAll(): Promise<AnalyticsRecord[]> {
  let raw: string;
  try {
    raw = await fs.readFile(RECORDS_FILE, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const records: AnalyticsRecord[] = [];
  for (const line of raw.split("\n")) {
    if (!line) continue;
    try { records.push(JSON.parse(line) as AnalyticsRecord); } catch { /* skip */ }
  }
  return records;
}

function inWindow(records: AnalyticsRecord[], sinceMs: number): AnalyticsRecord[] {
  const cutoff = new Date(Date.now() - sinceMs).toISOString();
  return records.filter((r) => r.occurred_at >= cutoff);
}

export type OverviewReport = {
  window_hours: number;
  pageviews: number;
  unique_visitors: number;
  sessions: number;
  avg_duration_sec: number | null;
  bounce_rate_pct: number | null;
  providers: string[];
};

export async function overview(sinceMs: number = 30 * 24 * 60 * 60 * 1000): Promise<OverviewReport> {
  const all = await readAll();
  const scoped = inWindow(all, sinceMs);
  const pageviews = scoped.filter((r) => r.event_name === "pageview").length;
  const visitors = new Set<string>();
  const sessions = new Set<string>();
  const durations: number[] = [];
  let bounces = 0;
  let bounceScored = 0;
  const providers = new Set<string>();
  for (const r of scoped) {
    if (r.visitor_id) visitors.add(r.visitor_id);
    if (r.session_id) sessions.add(r.session_id);
    if (typeof r.duration_sec === "number") durations.push(r.duration_sec);
    if (typeof r.bounced === "boolean") { bounceScored += 1; if (r.bounced) bounces += 1; }
    providers.add(r.provider);
  }
  return {
    window_hours: Math.round(sinceMs / (60 * 60 * 1000)),
    pageviews,
    unique_visitors: visitors.size,
    sessions: sessions.size,
    avg_duration_sec: durations.length
      ? Math.round(durations.reduce((n, d) => n + d, 0) / durations.length)
      : null,
    bounce_rate_pct: bounceScored > 0
      ? Math.round((bounces / bounceScored) * 1000) / 10
      : null,
    providers: [...providers].sort(),
  };
}

export type TopReport = { key: string; count: number };

export async function topPages(sinceMs: number = 30 * 24 * 60 * 60 * 1000, limit = 20): Promise<TopReport[]> {
  const scoped = inWindow(await readAll(), sinceMs).filter((r) => r.event_name === "pageview" && r.path);
  const counts = new Map<string, number>();
  for (const r of scoped) counts.set(r.path as string, (counts.get(r.path as string) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function topReferrers(sinceMs: number = 30 * 24 * 60 * 60 * 1000, limit = 20): Promise<TopReport[]> {
  const scoped = inWindow(await readAll(), sinceMs).filter((r) => r.referrer);
  const counts = new Map<string, number>();
  for (const r of scoped) counts.set(r.referrer as string, (counts.get(r.referrer as string) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function topCountries(sinceMs: number = 30 * 24 * 60 * 60 * 1000, limit = 20): Promise<TopReport[]> {
  const scoped = inWindow(await readAll(), sinceMs).filter((r) => r.country);
  const counts = new Map<string, number>();
  for (const r of scoped) counts.set(r.country as string, (counts.get(r.country as string) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export type TimeseriesPoint = { day: string; pageviews: number; visitors: number };

export async function timeseries(days = 30): Promise<TimeseriesPoint[]> {
  const sinceMs = days * 24 * 60 * 60 * 1000;
  const scoped = inWindow(await readAll(), sinceMs);
  const byDay = new Map<string, { pageviews: number; visitors: Set<string> }>();
  for (const r of scoped) {
    const day = r.occurred_at.slice(0, 10);   // YYYY-MM-DD
    let bucket = byDay.get(day);
    if (!bucket) { bucket = { pageviews: 0, visitors: new Set() }; byDay.set(day, bucket); }
    if (r.event_name === "pageview") bucket.pageviews += 1;
    if (r.visitor_id) bucket.visitors.add(r.visitor_id);
  }
  return [...byDay.entries()]
    .map(([day, b]) => ({ day, pageviews: b.pageviews, visitors: b.visitors.size }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));
}
