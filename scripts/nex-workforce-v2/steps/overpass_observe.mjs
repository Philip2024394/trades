// NEX Workforce v2 · Slice 1f · overpass_observe capability
// ─────────────────────────────────────────────────────────────────────────────
// The first real production-shaped domain capability. Fetches an Overpass
// query for a work_item's (city, category) and records the response summary +
// evidence in cursor_json. Does NOT persist to nex.* (that's Slice 1g).
//
// Contract properties (Slice 1f locked):
//   - deterministic REQUEST (query composed from work_item · same tuple →
//     same query hash); RESPONSE is not guaranteed identical (OSM data drifts)
//   - retry policy: 4 attempts, 1s → 15s exponential, 0.5 jitter
//   - step timeout: 300000 ms (5 min) · enforced by agent via AbortSignal
//   - rate policy: uses default overpass source policy (0.5 req/s, burst 2)
//   - cursor_json size < 8 KB · never stores raw response body
//   - evidence: source, retrieval_at, request_id, response_sha256, byte_length,
//     candidate_count, http_status, generator_note
//   - never invents candidates (empty elements → records_new=0, complete)
//   - never opens direct DB connections (no `import pg`)
//   - never uses console.log (uses ctx.logger)

import { createHash } from "node:crypto";
import { FailureClass } from "../lib/classifier.mjs";
import { requireValidBbox, BboxInvalidError } from "../lib/bbox_validator.mjs";

// Overrideable via env for tests · read dynamically so tests can override
// AFTER the module is imported.
const overpassUrl = () => process.env.NEX_OVERPASS_URL || "https://overpass-api.de/api/interpreter";

// Exported for test-only verification of category coverage.
// Runtime code inside this module continues to reference the local
// binding · no production behavior change from exposing this constant.
export const TAG_QUERIES = {
  restaurants:      '[out:json][timeout:60];node["amenity"="restaurant"]({{bbox}});out center;',
  cafes:            '[out:json][timeout:60];node["amenity"="cafe"]({{bbox}});out center;',
  "retail-fashion": '[out:json][timeout:60];node["shop"~"clothes|fashion"]({{bbox}});out center;',
  "retail-books":   '[out:json][timeout:60];node["shop"="books"]({{bbox}});out center;',
  // Slice A1 (2026-09-07 · Philip) · accommodation capability registration.
  // 6 primary tourism subtypes matching P1's proven Yogyakarta classifier at
  // scripts/nex-acquisition/configs/accommodation-yogyakarta.mjs::classifyAccommodationBusiness().
  // Follows the existing node-only pattern used by restaurants/cafes/retail.
  // Widening to nwr + building=hotel + name-based kos detection is a
  // separate authorized slice · out of A1 scope.
  accommodation:    '[out:json][timeout:60];node["tourism"~"^(hotel|guest_house|hostel|apartment|motel|chalet)$"]({{bbox}});out center;',
  __default__:      '[out:json][timeout:60];node["amenity"]({{bbox}});out center;',
};

// Slice 4 fail-closed contract: caller MUST have already passed bbox
// through requireValidBbox() before invoking buildQuery. NO whole-world
// fallback · NO silent widening.
const buildQuery = (categorySlug, bbox) => {
  const tmpl = TAG_QUERIES[categorySlug] ?? TAG_QUERIES.__default__;
  const bboxStr = `${bbox.sw.lat},${bbox.sw.lon},${bbox.ne.lat},${bbox.ne.lon}`;
  return tmpl.replace("{{bbox}}", bboxStr);
};

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

// Domain-specific classifier rules (per Slice 1f design §5)
const overpassClassifier = [
  {
    match: (e) => e?.status === 429,
    class: FailureClass.RATE_LIMIT,
    reason: "HTTP 429 rate-limited by Overpass",
  },
  {
    match: (e) => e?.status === 504 || e?.code === "OVERPASS_GATEWAY_TIMEOUT",
    class: FailureClass.TRANSIENT,
    reason: "Overpass 504 gateway timeout",
  },
  {
    match: (e) => e?.status === 400 && /timed out/i.test(e?.bodyPreview || ""),
    class: FailureClass.TRANSIENT,
    reason: "Overpass server-side query timeout",
  },
  {
    match: (e) => e?.status === 400,
    class: FailureClass.CATASTROPHIC,
    reason: "Overpass HTTP 400 (bad query) · investigate our query, do not retry",
  },
  {
    match: (e) => e?.code === "OVERPASS_MALFORMED_JSON",
    class: FailureClass.TRANSIENT,
    reason: "Overpass returned invalid JSON",
  },
];

class OverpassError extends Error {
  constructor(msg, { status, bodyPreview, code } = {}) {
    super(msg);
    this.name = "OverpassError";
    this.status = status;
    this.bodyPreview = bodyPreview;
    this.code = code;
  }
}

// ─── Capability contract exports ─────────────────────────────────────────────

export const seedCursor = () => ({
  capability: "overpass_observe@1",
  phase:      "started",
});

export function plan({ cursor, workItem }) {
  const phase = cursor?.phase ?? "started";
  if (phase === "completed") return [];

  // Slice 4 · fail-closed bbox resolution · matches overpass_observe_and_stage.mjs.
  const rawBbox = workItem.bbox_json ?? workItem._test_bbox;
  const bbox = requireValidBbox(rawBbox);  // throws BboxInvalidError · no fallback
  const query = buildQuery(workItem.category_slug, bbox);
  const queryHash = sha256(query);

  // Two logical steps we can checkpoint between. In practice we execute
  // one fetch, then a small "finalize" step that just advances the cursor.
  const steps = [];

  if (phase === "started") {
    steps.push({
      id: "overpass_fetch",
      timeoutMs: 300_000, // 5 minutes · agent enforces
      classifier: overpassClassifier,
      retryPolicy: { maxAttempts: 4, initialMs: 1000, maxMs: 15_000, factor: 2, jitter: 0.5 },
      async execute({ ctx }) {
        const startedAt = new Date().toISOString();
        const res = await fetchOverpass({ query, signal: ctx.abortSignal, logger: ctx.logger });
        const receivedAt = new Date().toISOString();
        const bodyText = res.body;
        const bodyBytes = Buffer.byteLength(bodyText, "utf8");
        let parsed;
        try {
          parsed = JSON.parse(bodyText);
        } catch (e) {
          throw new OverpassError(`invalid JSON from Overpass: ${e.message}`, {
            status: res.status,
            bodyPreview: bodyText.slice(0, 200),
            code: "OVERPASS_MALFORMED_JSON",
          });
        }
        const elements = Array.isArray(parsed?.elements) ? parsed.elements : [];
        return {
          request: {
            url: overpassUrl(),
            query_hash: queryHash,
            attempt: (ctx.attempt ?? 0) + 1,
            started_at: startedAt,
          },
          response: {
            http_status:      res.status,
            byte_length:      bodyBytes,
            candidate_count:  elements.length,
            response_sha256:  sha256(bodyText),
            received_at:      receivedAt,
          },
          evidence: {
            provenance:    `overpass · ${new URL(overpassUrl()).host}`,
            http_headers:  pickAllowedHeaders(res.headers),
            generator_note: parsed?.generator ?? null,
            osm_base:       parsed?.osm3s?.timestamp_osm_base ?? null,
          },
        };
      },
      async newCursor({ cursor, result }) {
        // If retry-exhausted or partial, result may be null — leave cursor
        // in 'started' so a future re-lease can retry fresh.
        if (!result) return cursor;
        return {
          capability: "overpass_observe@1",
          phase:      "fetched",
          request:    result.request,
          response:   result.response,
          evidence:   result.evidence,
        };
      },
    });
  }

  if (phase === "fetched") {
    steps.push({
      id: "overpass_finalize",
      timeoutMs: 5000,
      async execute({ ctx }) {
        // No external I/O · just marks the cycle as completed.
        return { ok: true };
      },
      async newCursor({ cursor }) {
        return { ...cursor, phase: "completed" };
      },
    });
  }

  return steps;
}

export function totals({ cursor }) {
  const c = cursor?.response?.candidate_count ?? 0;
  return { records_new: c, records_rejected: 0 };
}

// ─── Internals · fetch with AbortSignal + honest classification ─────────────

async function fetchOverpass({ query, signal, logger }) {
  const url = overpassUrl();
  const t0 = Date.now();
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      body:   query,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      signal,
    });
  } catch (e) {
    // Network-layer error · re-throw with class hint
    if (e?.name === "AbortError") throw e;
    const wrapped = new OverpassError(`fetch failed: ${e.message}`, { code: e.code ?? "ECONNRESET" });
    throw wrapped;
  }
  const bodyText = await res.text();
  const durationMs = Date.now() - t0;
  logger?.({ msg: "overpass.fetch", status: res.status, byte_length: bodyText.length, duration_ms: durationMs });

  if (res.status !== 200) {
    // Non-200 · pass classification hint via headers
    const err = new OverpassError(`overpass HTTP ${res.status}`, {
      status: res.status,
      bodyPreview: bodyText.slice(0, 200),
    });
    // Attach retry-after so the outer rate-limit classifier can pick it up
    err.headers = { "retry-after": res.headers.get("retry-after") };
    throw err;
  }

  return { status: res.status, body: bodyText, headers: extractHeaders(res.headers) };
}

const ALLOWED_HEADERS = ["server", "x-request-id", "date", "content-type", "content-length"];
function extractHeaders(h) {
  const out = {};
  for (const k of ALLOWED_HEADERS) {
    const v = h.get(k);
    if (v != null) out[k] = String(v).slice(0, 200);
  }
  return out;
}
function pickAllowedHeaders(headersObj) {
  const out = {};
  for (const k of ALLOWED_HEADERS) {
    if (headersObj?.[k]) out[k] = String(headersObj[k]).slice(0, 200);
  }
  return out;
}
