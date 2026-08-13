// NEX Event Tracking · high-volume interaction store
//
// DOCTRINE
// Every Trade Centre / Yard / Notebook interaction becomes a first-class
// tracking event with session + contact + campaign context. This feeds
// Marketing Attribution + Analytics Pipeline downstream. Kept separate
// from the Intelligence Event Bus because interactions are 100-1000x
// higher volume than intelligence events — mixing would drown the bus.
//
// STORAGE
// Append-only JSONL at `data/nex-tracking/events.jsonl`. High-value
// interactions (form_submit · conversion · signup) ALSO emit a mirror
// event to the Intelligence Bus so the Living Timeline sees them.
//
// GDPR
// IP addresses are truncated to /24 (v4) or /48 (v6) prefix at capture
// time · never stored raw. Fingerprint is sha256(ua|ip-prefix) — one-way,
// no reversal to the original visitor.

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { emitEventSafe } from "../events/fs-store";

// ── Paths ──────────────────────────────────────────────────────────

const ROOT = path.join(process.cwd(), "data", "nex-tracking");
const EVENTS_FILE = path.join(ROOT, "events.jsonl");

async function ensureDir(): Promise<void> {
  await fs.mkdir(ROOT, { recursive: true });
}

// ── Types ─────────────────────────────────────────────────────────

export type TrackingEventName =
  | "page_view"
  | "click"
  | "scroll_depth"
  | "form_view"
  | "form_submit"
  | "search"
  | "signup"
  | "signin"
  | "conversion"
  | "outbound"
  | "custom";

export type TrackingEvent = {
  event_id: string;
  session_id: string;
  contact_id: string | null;
  fingerprint: string;
  event_name: TrackingEventName;
  path: string | null;
  referrer: string | null;
  user_agent: string | null;
  ip_prefix: string | null;              // truncated · GDPR-safe
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  properties: Record<string, unknown>;
  occurred_at: string;                   // client-reported (may be same as server)
  server_received_at: string;
};

export type CaptureEventInput = {
  session_id?: string | null;
  contact_id?: string | null;
  event_name: TrackingEventName;
  path?: string | null;
  referrer?: string | null;
  user_agent?: string | null;
  ip?: string | null;                    // raw · will be truncated
  utm?: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    content?: string | null;
    term?: string | null;
  };
  properties?: Record<string, unknown>;
  occurred_at?: string | null;
};

// ── Privacy helpers ───────────────────────────────────────────────

/** IPv4 → /24 · IPv6 → /48 · anything else → null. */
export function truncateIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const clean = ip.trim().replace(/^::ffff:/, "");
  if (clean.includes(".")) {
    const parts = clean.split(".");
    if (parts.length !== 4 || parts.some((p) => !/^\d+$/.test(p))) return null;
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  if (clean.includes(":")) {
    const parts = clean.split(":");
    return `${parts.slice(0, 3).join(":")}::/48`;
  }
  return null;
}

/** One-way fingerprint · sha256(ua|ip_prefix|salt). Salt = deploy time. */
const FP_SALT = process.env.NEX_TRACKING_FP_SALT ?? "nex-default-salt-please-set-env";
export function fingerprintOf(userAgent: string | null | undefined, ip: string | null | undefined): string {
  const uaPart = (userAgent ?? "unknown").slice(0, 200);
  const ipPart = truncateIp(ip) ?? "no-ip";
  return createHash("sha256").update(`${uaPart}|${ipPart}|${FP_SALT}`).digest("hex").slice(0, 32);
}

/** Derive a session_id if the caller didn't provide one · rotates per hour per fingerprint. */
function deriveSession(fingerprint: string, occurredAt: Date): string {
  const hourBucket = Math.floor(occurredAt.getTime() / (60 * 60 * 1000));
  return createHash("sha256").update(`${fingerprint}|${hourBucket}`).digest("hex").slice(0, 24);
}

// ── Capture · append one event · optionally mirror to bus ─────────

const HIGH_VALUE_EVENTS: Set<TrackingEventName> = new Set(["form_submit", "signup", "signin", "conversion"]);

export async function captureEvent(input: CaptureEventInput): Promise<TrackingEvent> {
  const server_received_at = new Date().toISOString();
  const occurred_at = input.occurred_at ?? server_received_at;
  const occurredDate = new Date(occurred_at);
  const validOccurred = Number.isFinite(occurredDate.getTime()) ? occurredDate.toISOString() : server_received_at;

  const ip_prefix = truncateIp(input.ip);
  const fingerprint = fingerprintOf(input.user_agent, input.ip);
  const session_id = (input.session_id?.trim()) || deriveSession(fingerprint, new Date(validOccurred));

  const event: TrackingEvent = {
    event_id: randomUUID(),
    session_id,
    contact_id: input.contact_id ?? null,
    fingerprint,
    event_name: input.event_name,
    path: input.path ?? null,
    referrer: input.referrer ?? null,
    user_agent: input.user_agent?.slice(0, 500) ?? null,
    ip_prefix,
    utm_source: input.utm?.source ?? null,
    utm_medium: input.utm?.medium ?? null,
    utm_campaign: input.utm?.campaign ?? null,
    utm_content: input.utm?.content ?? null,
    utm_term: input.utm?.term ?? null,
    properties: input.properties ?? {},
    occurred_at: validOccurred,
    server_received_at,
  };

  await ensureDir();
  await fs.appendFile(EVENTS_FILE, JSON.stringify(event) + "\n", "utf8");

  if (HIGH_VALUE_EVENTS.has(event.event_name)) {
    emitEventSafe({
      event_type: "interaction_captured",
      source: "human",
      actor_id: event.contact_id ?? event.fingerprint,
      related_department: "marketing",
      outcome: "success",
      payload: {
        event_name: event.event_name,
        path: event.path,
        session_id: event.session_id,
        contact_id: event.contact_id,
        utm_source: event.utm_source,
        utm_campaign: event.utm_campaign,
        property_keys: Object.keys(event.properties),
      },
    });
  }
  return event;
}

/** Fire-and-forget wrapper · never throws · returns null on failure. */
export async function captureEventSafe(input: CaptureEventInput): Promise<TrackingEvent | null> {
  try {
    return await captureEvent(input);
  } catch (err) {
    console.warn("[tracking] capture failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Batch capture · array of events at once ───────────────────────

export async function captureBatch(events: CaptureEventInput[]): Promise<{ captured: number; events: TrackingEvent[] }> {
  const captured: TrackingEvent[] = [];
  for (const e of events) {
    try {
      captured.push(await captureEvent(e));
    } catch { /* skip individual failures · batch remains partial-safe */ }
  }
  return { captured: captured.length, events: captured };
}

// ── Read · list + session summary + stats ─────────────────────────

export type ListEventsOptions = {
  limit?: number;
  event_name?: TrackingEventName;
  session_id?: string;
  contact_id?: string;
  path?: string;
  utm_campaign?: string;
  since_ms?: number;
};

async function readAll(): Promise<TrackingEvent[]> {
  let raw: string;
  try {
    raw = await fs.readFile(EVENTS_FILE, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const events: TrackingEvent[] = [];
  for (const line of raw.split("\n")) {
    if (!line) continue;
    try { events.push(JSON.parse(line) as TrackingEvent); } catch { /* skip */ }
  }
  return events;
}

export async function listEvents(options: ListEventsOptions = {}): Promise<TrackingEvent[]> {
  const limit = Math.min(Math.max(1, options.limit ?? 100), 1000);
  const sinceIso = new Date(Date.now() - (options.since_ms ?? 24 * 60 * 60 * 1000)).toISOString();
  const all = await readAll();
  return all
    .filter((e) => e.occurred_at >= sinceIso)
    .filter((e) => (options.event_name ? e.event_name === options.event_name : true))
    .filter((e) => (options.session_id ? e.session_id === options.session_id : true))
    .filter((e) => (options.contact_id ? e.contact_id === options.contact_id : true))
    .filter((e) => (options.path ? e.path === options.path : true))
    .filter((e) => (options.utm_campaign ? e.utm_campaign === options.utm_campaign : true))
    .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1))
    .slice(0, limit);
}

export type SessionSummary = {
  session_id: string;
  fingerprint: string;
  contact_id: string | null;
  event_count: number;
  first_occurred: string;
  last_occurred: string;
  paths: string[];
  utm_campaign: string | null;
  utm_source: string | null;
  had_conversion: boolean;
};

export async function sessionSummaries(sinceMs = 24 * 60 * 60 * 1000, limit = 50): Promise<SessionSummary[]> {
  const events = await listEvents({ limit: 10000, since_ms: sinceMs });
  const sessions = new Map<string, SessionSummary>();
  for (const e of events) {
    const s = sessions.get(e.session_id);
    if (!s) {
      sessions.set(e.session_id, {
        session_id: e.session_id,
        fingerprint: e.fingerprint,
        contact_id: e.contact_id,
        event_count: 1,
        first_occurred: e.occurred_at,
        last_occurred: e.occurred_at,
        paths: e.path ? [e.path] : [],
        utm_campaign: e.utm_campaign,
        utm_source: e.utm_source,
        had_conversion: e.event_name === "conversion",
      });
    } else {
      s.event_count += 1;
      if (e.occurred_at < s.first_occurred) s.first_occurred = e.occurred_at;
      if (e.occurred_at > s.last_occurred) s.last_occurred = e.occurred_at;
      if (e.path && !s.paths.includes(e.path)) s.paths.push(e.path);
      if (e.contact_id && !s.contact_id) s.contact_id = e.contact_id;
      if (e.utm_campaign && !s.utm_campaign) s.utm_campaign = e.utm_campaign;
      if (e.utm_source && !s.utm_source) s.utm_source = e.utm_source;
      if (e.event_name === "conversion") s.had_conversion = true;
    }
  }
  return [...sessions.values()]
    .sort((a, b) => (a.last_occurred < b.last_occurred ? 1 : -1))
    .slice(0, limit);
}

export type TrackingStats = {
  total_events: number;
  by_name: Record<string, number>;
  unique_sessions: number;
  unique_fingerprints: number;
  unique_contacts: number;
  campaigns_seen: number;
  events_last_1h: number;
  events_last_24h: number;
};

export async function trackingStats(): Promise<TrackingStats> {
  const all = await readAll();
  const stats: TrackingStats = {
    total_events: all.length,
    by_name: {},
    unique_sessions: 0,
    unique_fingerprints: 0,
    unique_contacts: 0,
    campaigns_seen: 0,
    events_last_1h: 0,
    events_last_24h: 0,
  };
  const sessions = new Set<string>();
  const fingerprints = new Set<string>();
  const contacts = new Set<string>();
  const campaigns = new Set<string>();
  const now = Date.now();
  for (const e of all) {
    stats.by_name[e.event_name] = (stats.by_name[e.event_name] ?? 0) + 1;
    sessions.add(e.session_id);
    fingerprints.add(e.fingerprint);
    if (e.contact_id) contacts.add(e.contact_id);
    if (e.utm_campaign) campaigns.add(e.utm_campaign);
    const occurredMs = new Date(e.occurred_at).getTime();
    if (now - occurredMs <= 60 * 60 * 1000) stats.events_last_1h += 1;
    if (now - occurredMs <= 24 * 60 * 60 * 1000) stats.events_last_24h += 1;
  }
  stats.unique_sessions = sessions.size;
  stats.unique_fingerprints = fingerprints.size;
  stats.unique_contacts = contacts.size;
  stats.campaigns_seen = campaigns.size;
  return stats;
}
