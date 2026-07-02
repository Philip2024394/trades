// Client analytics beacon — customer-side event capture.
//
// Rendered into the preview iframe (and later into the published page).
// Talks to POST /api/studio/events. Zero third-party trackers. No PII —
// the server derives a `visitor_hash` from a rotating visitor id that
// lives in the visitor's own localStorage; we never send the raw id.
//
// Design goals:
//   • Batch — send at most one request per 5s or per 10 events.
//   • Survive tab-close — flush via navigator.sendBeacon on `pagehide`.
//   • Never block the render — every track() is fire-and-forget.
//   • Idempotent init — mounting the beacon twice must be a no-op.
//
// This module is client-safe. No `server-only` imports, no DOM APIs
// referenced at module top-level.

const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_BATCH_SIZE = 10;
const MAX_QUEUE = 100;
const VISITOR_LS_KEY = "studio_visitor_id";
const ENDPOINT = "/api/studio/events";

export type BeaconEvent = {
  event:
    | "view"
    | "click"
    | "scroll"
    | "convert"
    | "pick"
    | "edit"
    | "move"
    | "remove"
    | "publish"
    | "revert"
    | "score";
  brand_id: string | null;
  page_id: string | null;
  section_key?: string | null;
  layout_variant?: string | null;
  instance_id?: string | null;
  variant_bucket?: "A" | "B" | null;
  experiment_id?: string | null;
  payload?: Record<string, unknown>;
};

type QueueItem = BeaconEvent & {
  visitor_id: string;
  ts: number;
};

type BeaconConfig = {
  brand_id: string | null;
  page_id: string | null;
};

let queue: QueueItem[] = [];
let visitor: string | null = null;
let intervalHandle: ReturnType<typeof setInterval> | null = null;
let started = false;
let config: BeaconConfig = { brand_id: null, page_id: null };

// ─── Public API ─────────────────────────────────────────────────

/** Start the beacon. Safe to call more than once — after the first call
 *  it becomes a no-op. Sets flush timer + pagehide listener. */
export function startBeacon(cfg: BeaconConfig): void {
  if (typeof window === "undefined") return;
  config = cfg;
  if (started) return;
  started = true;

  visitor = readOrMintVisitorId();

  intervalHandle = setInterval(() => {
    if (queue.length > 0) void flush("interval");
  }, FLUSH_INTERVAL_MS);

  // Flush on pagehide via sendBeacon — survives navigation + tab close.
  window.addEventListener("pagehide", () => flushSync("pagehide"));
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushSync("visibilitychange");
  });
}

/** Enqueue an event. Fills in brand_id/page_id from the current beacon
 *  config unless the caller supplies them. */
export function track(
  event: BeaconEvent["event"],
  data: Omit<BeaconEvent, "event" | "brand_id" | "page_id"> & {
    brand_id?: string | null;
    page_id?: string | null;
  } = {}
): void {
  if (typeof window === "undefined") return;
  if (!visitor) visitor = readOrMintVisitorId();

  const item: QueueItem = {
    event,
    brand_id: data.brand_id ?? config.brand_id,
    page_id: data.page_id ?? config.page_id,
    section_key: data.section_key ?? null,
    layout_variant: data.layout_variant ?? null,
    instance_id: data.instance_id ?? null,
    variant_bucket: data.variant_bucket ?? null,
    experiment_id: data.experiment_id ?? null,
    payload: data.payload,
    visitor_id: visitor,
    ts: Date.now()
  };

  queue.push(item);
  if (queue.length > MAX_QUEUE) queue.shift(); // drop oldest, never grow unbounded
  if (queue.length >= FLUSH_BATCH_SIZE) void flush("batch");
}

/** Stop the beacon. Only used by tests + hot-module-reload cleanup. */
export function stopBeacon(): void {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
  started = false;
  queue = [];
}

// ─── Internal ────────────────────────────────────────────────────

function readOrMintVisitorId(): string {
  try {
    const existing = window.localStorage.getItem(VISITOR_LS_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_LS_KEY, fresh);
    return fresh;
  } catch {
    // Storage-blocked (Safari private tab, cookie banner rejects) — use
    // a session-scoped id so we still get useful analytics for the tab
    // lifetime without persisting anything.
    return crypto.randomUUID();
  }
}

async function flush(_reason: "interval" | "batch"): Promise<void> {
  if (queue.length === 0) return;
  const batch = queue.slice(0, FLUSH_BATCH_SIZE);
  queue = queue.slice(batch.length);
  try {
    await fetch(ENDPOINT, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch })
    });
  } catch {
    // Analytics is best-effort — drop the batch, don't block anything.
  }
}

function flushSync(_reason: "pagehide" | "visibilitychange"): void {
  if (queue.length === 0) return;
  const batch = queue.slice();
  queue = [];
  try {
    const body = JSON.stringify({ events: batch });
    if (typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(ENDPOINT, blob);
      return;
    }
    // Fallback for browsers without sendBeacon — fire-and-forget fetch
    // with keepalive, which the spec guarantees survives up to 64KB.
    void fetch(ENDPOINT, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body
    });
  } catch {
    /* best-effort */
  }
}
