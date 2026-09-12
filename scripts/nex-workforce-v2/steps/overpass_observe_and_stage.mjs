// NEX Workforce v2 · Slice 1g · overpass_observe_and_stage capability
// ─────────────────────────────────────────────────────────────────────────────
// The Slice 1g production-shaped capability. Wraps Slice 1f's fetch pattern
// with:
//   1. atomic fetch + parse + evidence_record + candidate_staging (one TX
//      via nex_workforce.stage_candidates helper) · no intermediate 'fetched'
//      checkpoint that could lose payload on crash
//   2. persist step that drives nex_workforce.persist_batch calls until all
//      staging rows are processed
//   3. finalize step that advances cursor to 'persisted'
//
// Slice 1f's overpass_observe capability is UNMODIFIED. This is a NEW
// capability alongside it. Slice 1f's 27 tests remain untouched.
//
// The persister function is configurable via env NEX_PERSISTER_FN (defaults
// to 'nex_workforce.mock_persist_target' for Slice 1g tests). Slice 1h will
// introduce real per-target persister functions.
//
// Contract properties preserved from Slice 1f:
//   - deterministic REQUEST (query_hash from query string)
//   - retry policy: 4 attempts, 1s → 15s, 0.5 jitter
//   - step timeout: 300000 ms (5 min) · agent enforces via AbortSignal
//   - rate policy: default overpass source policy (0.5 req/s)
//   - cursor_json size < 8 KB (payload lives in staging, evidence in ledger)
//   - never invents candidates (empty → records_new=0 · complete)
//   - never opens direct DB connections (no `import pg`)
//   - never uses console.log (uses ctx.logger)
//
// Additional Slice 1g contract properties:
//   - never re-fetches to recover payload after crash (staging is durable)
//   - persistence via SECURITY DEFINER function only (via persist_batch)
//   - four-field fence enforced server-side on every mutating helper
//   - lease-expiry is state-authoritative (no lease_deadline > now() in fence)

import { createHash } from "node:crypto";
import { FailureClass } from "../lib/classifier.mjs";
import { withWorkforceRole } from "../lib/with_workforce_role.mjs";
import { requireValidBbox, BboxInvalidError } from "../lib/bbox_validator.mjs";

const overpassUrl = () => process.env.NEX_OVERPASS_URL || "https://overpass-api.de/api/interpreter";
// Full function signature required for regprocedure cast in persist_batch.
// Env override should include the (arg_types) suffix.
const persisterFn = () => process.env.NEX_PERSISTER_FN || "nex_workforce.mock_persist_target(text,uuid,integer,text,timestamptz,text,text,jsonb)";

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

// Slice 4 fail-closed contract:
//   caller MUST have already passed bbox through requireValidBbox()
//   before invoking buildQuery. buildQuery does NOT validate + does NOT
//   substitute a default. If bbox is missing or malformed here, the JS
//   destructure throws · which the capability catches + classifies as
//   catastrophic. There is NO whole-world fallback string.
const buildQuery = (categorySlug, bbox) => {
  const tmpl = TAG_QUERIES[categorySlug] ?? TAG_QUERIES.__default__;
  const bboxStr = `${bbox.sw.lat},${bbox.sw.lon},${bbox.ne.lat},${bbox.ne.lon}`;
  return tmpl.replace("{{bbox}}", bboxStr);
};

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

const computeEvidenceId = ({ workItemId, generation, queryHash, responseSha256 }) => {
  return sha256(`${workItemId}::${generation}::${queryHash}::${responseSha256}`);
};

const overpassClassifier = [
  { match: (e) => e?.status === 429, class: FailureClass.RATE_LIMIT, reason: "HTTP 429" },
  { match: (e) => e?.status === 504, class: FailureClass.TRANSIENT, reason: "Overpass 504" },
  { match: (e) => e?.status === 400 && /timed out/i.test(e?.bodyPreview || ""), class: FailureClass.TRANSIENT, reason: "Overpass query timeout" },
  { match: (e) => e?.status === 400, class: FailureClass.CATASTROPHIC, reason: "Overpass 400 bad query" },
  { match: (e) => e?.code === "OVERPASS_MALFORMED_JSON", class: FailureClass.TRANSIENT, reason: "Overpass malformed JSON" },
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

// Normalize a raw OSM element into a compact candidate payload.
// Drop unused OSM tags to stay well under the 32 KB per-candidate cap.
//
// Slice A2 (2026-09-07 · Philip) · widened keepList to include the tourism-
// family + hotel-classification tags that persist_to_accommodation_business
// needs to route candidates into the 7-value accommodation taxonomy. These
// additions are additive · categories that don't emit these tags (restaurants,
// cafes, retail) see no change in their staged payloads.
function normalizeCandidate(element) {
  const tags = element?.tags ?? {};
  const keepTags = {};
  const keepList = [
    // Restaurant / cafe / retail (unchanged since Slice 1g)
    "amenity", "shop", "name", "name:en", "name:id", "cuisine",
    "opening_hours", "phone", "website", "brand", "operator",
    "addr:street", "addr:city", "addr:postcode",
    // Accommodation family (Slice A2 addition)
    "tourism", "hotel", "guest_house",
    "stars", "rooms",
    "internet_access", "air_conditioning", "breakfast", "swimming_pool", "parking",
  ];
  for (const k of keepList) if (tags[k] != null) keepTags[k] = String(tags[k]).slice(0, 500);
  return {
    osm_type: element.type,
    osm_id:   element.id,
    lat:      element.lat ?? element.center?.lat,
    lon:      element.lon ?? element.center?.lon,
    tags:     keepTags,
  };
}

// Slice 1h R2 (Philip 2026-09-04) · canonical natural_key format matches
// Project B production nex.food_business.source_reference · `<type>/<id>`.
// NEVER `osm:<type>:<id>` (that would create duplicate rows against 21,954
// existing production osm_overpass records that use the plain slash format).
function naturalKey(element) {
  return `${element.type}/${element.id}`;
}

// ─── Capability contract ────────────────────────────────────────────────────

export const seedCursor = () => ({
  capability: "overpass_observe_and_stage@1",
  phase:      "started",
});

export function plan({ cursor, workItem }) {
  const phase = cursor?.phase ?? "started";
  if (phase === "completed") return [];
  // Slice 4 (2026-09-04) · fail-closed bbox resolution.
  // Source priority: (1) work_item.bbox_json (populated at enqueue time from
  // city_catalogue.bbox_json by enqueue_from_view). (2) workItem._test_bbox
  // (test-fixture-only override, never populated in production paths).
  // If neither is present OR either is invalid, requireValidBbox throws
  // BboxInvalidError. plan() lets it propagate · the agent's outer catch
  // classifies the uncaught throw as catastrophic → fail_soft. There is NO
  // whole-world fallback. There is NO silent widening. There is NO Overpass
  // HTTP request without a validated, bounded bbox.
  const rawBbox = workItem.bbox_json ?? workItem._test_bbox;
  const bbox = requireValidBbox(rawBbox);  // throws on ANY invalid input
  const query = buildQuery(workItem.category_slug, bbox);
  const queryHash = sha256(query);

  const steps = [];

  if (phase === "started") {
    // Step: fetch + parse + stage · ATOMIC (no intermediate 'fetched' checkpoint)
    steps.push({
      id: "fetch_and_stage",
      timeoutMs: 300_000,
      classifier: overpassClassifier,
      retryPolicy: { maxAttempts: 4, initialMs: 1000, maxMs: 15_000, factor: 2, jitter: 0.5 },
      async execute({ ctx }) {
        const startedAt = new Date().toISOString();
        const res = await fetchOverpass({ query, signal: ctx.abortSignal, logger: ctx.logger });
        const bodyText = res.body;
        const bodyBytes = Buffer.byteLength(bodyText, "utf8");
        const responseSha256 = sha256(bodyText);

        let parsed;
        try { parsed = JSON.parse(bodyText); }
        catch (e) {
          throw new OverpassError(`invalid JSON: ${e.message}`, { status: res.status, bodyPreview: bodyText.slice(0, 200), code: "OVERPASS_MALFORMED_JSON" });
        }

        const elements = Array.isArray(parsed?.elements) ? parsed.elements : [];
        const evidenceId = computeEvidenceId({
          workItemId:     workItem.id,
          generation:     workItem.generation,
          queryHash,
          responseSha256,
        });

        const receivedAt = new Date().toISOString();

        // Stage: server-side atomic INSERT of evidence_record + candidate_staging.
        // ctx.pool is provided by agent for capabilities that need helper calls
        // (as of Slice 1g addition · see agent.mjs · falls back to
        // agent.pool if ctx.pool absent).
        const pool = ctx.pool ?? ctx.agent?.pool;
        if (!pool) throw new OverpassError("no pool available in ctx", { code: "AGENT_MISSING_POOL" });

        const evidenceMeta = {
          source_slug:      workItem.source_slug,
          city_slug:        workItem.city_slug,
          category_slug:    workItem.category_slug,
          query_hash:       queryHash,
          response_sha256:  responseSha256,
          retrieved_at:     receivedAt,
          request_id:       res.headers?.["x-request-id"] ?? null,
          http_status:      res.status,
          byte_length:      bodyBytes,
          candidate_count:  elements.length,
          generator_note:   parsed?.generator ?? null,
          osm_base:         parsed?.osm3s?.timestamp_osm_base ?? null,
          http_headers_json: pickAllowedHeaders(res.headers),
        };

        // Build staging rows (normalized · not raw)
        const candidates = elements.map((el, idx) => {
          const payload = normalizeCandidate(el);
          const payloadJson = JSON.stringify(payload);
          return {
            candidate_index: idx,
            natural_key:     naturalKey(el),
            payload_json:    payload,
            payload_bytes:   Buffer.byteLength(payloadJson, "utf8"),
          };
        });

        // Enforce per-candidate size cap client-side (fast fail) — server also enforces
        for (const c of candidates) {
          if (c.payload_bytes > 32768) {
            ctx.logger?.({ msg: "overpass.candidate.oversize", natural_key: c.natural_key, bytes: c.payload_bytes });
            throw new OverpassError(`candidate payload exceeds 32 KB: ${c.natural_key}`, { code: "PAYLOAD_TOO_LARGE" });
          }
        }

        const stageOk = (await withWorkforceRole(pool, (c) =>
          c.query(
            "SELECT nex_workforce.stage_candidates($1, $2, $3, $4, $5::jsonb, $6::jsonb) AS ok",
            [ctx.agent.config.agentId, workItem.id, workItem.generation, evidenceId,
             JSON.stringify(evidenceMeta), JSON.stringify(candidates)]
          ))).rows[0].ok;

        if (stageOk !== true) {
          // Fence failed · treat as lease_lost via a throw that our classifier maps
          const e = new Error("stage_candidates fence rejected");
          e.__leaseLost = true;
          throw e;
        }

        return {
          evidenceId,
          candidateCount: elements.length,
          responseSha256,
          bytes: bodyBytes,
        };
      },
      async newCursor({ cursor, result }) {
        if (!result) return cursor;
        return {
          capability:      "overpass_observe_and_stage@1",
          phase:           "staged",
          evidence_id:     result.evidenceId,
          candidate_count: result.candidateCount,
        };
      },
    });
  }

  if (phase === "staged") {
    // Step: persist_batch until no remaining unpersisted rows
    steps.push({
      id: "persist_all",
      timeoutMs: 300_000,
      retryPolicy: { maxAttempts: 3, initialMs: 500, maxMs: 5000, factor: 2, jitter: 0.25 },
      async execute({ ctx }) {
        const pool = ctx.pool ?? ctx.agent?.pool;
        if (!pool) throw new Error("no pool in ctx");
        const fn = persisterFn();
        let persistedTotal = 0, rejectedTotal = 0, iterations = 0;
        // Loop until remaining=0 or fence fails or too many iterations
        while (iterations < 100) {
          iterations++;
          const r = (await withWorkforceRole(pool, (c) =>
            c.query(
              "SELECT persisted_count, rejected_count, remaining_count, fence_ok FROM nex_workforce.persist_batch($1, $2, $3, $4::regprocedure, $5)",
              [ctx.agent.config.agentId, workItem.id, workItem.generation, fn, 100]
            ))).rows[0];
          if (r.fence_ok === false) {
            const e = new Error("persist_batch fence rejected");
            e.__leaseLost = true;
            throw e;
          }
          persistedTotal += r.persisted_count;
          rejectedTotal  += r.rejected_count;
          ctx.logger?.({ msg: "persist.batch.result", persisted: r.persisted_count, rejected: r.rejected_count, remaining: r.remaining_count });
          if (r.remaining_count === 0) break;
          if (r.persisted_count === 0 && r.rejected_count === 0) {
            // No progress · avoid infinite loop
            const e = new Error("persist_batch made no progress with rows remaining");
            e.name = "PersistStall";
            throw e;
          }
        }
        return { persistedTotal, rejectedTotal };
      },
      async newCursor({ cursor, result }) {
        return {
          ...cursor,
          phase: "persisted",
          persisted_total: result.persistedTotal,
          rejected_total:  result.rejectedTotal,
        };
      },
    });
  }

  if (phase === "persisted") {
    steps.push({
      id: "finalize",
      timeoutMs: 5000,
      async execute() { return { ok: true }; },
      async newCursor({ cursor }) { return { ...cursor, phase: "completed" }; },
    });
  }

  return steps;
}

export function totals({ cursor }) {
  return {
    records_new:      cursor?.persisted_total ?? cursor?.candidate_count ?? 0,
    records_rejected: cursor?.rejected_total ?? 0,
  };
}

// ─── Fetch (identical to Slice 1f) ──────────────────────────────────────────

// Slice 5 (2026-09-04 · Gate 5A HTTP-layer fix): Overpass rejected the
// previous request with HTTP 406 because we sent raw Overpass QL as the body
// while declaring `content-type: application/x-www-form-urlencoded`. The
// standards-correct request under that content-type is a form body with the
// query as the value of the `data` field. Also add an explicit User-Agent
// (Overpass server policy asks callers to identify themselves so their ops
// team can reach out if a workload misbehaves).
const USER_AGENT = "nex-workforce/1.0 (+thenetworkers.app · Indonesia OSM acquisition)";

async function fetchOverpass({ query, signal, logger }) {
  const url = overpassUrl();
  const t0 = Date.now();
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      // Standards-correct form encoding matching the declared content-type.
      body:   "data=" + encodeURIComponent(query),
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent":   USER_AGENT,
      },
      signal,
    });
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    const wrapped = new OverpassError(`fetch failed: ${e.message}`, { code: e.code ?? "ECONNRESET" });
    throw wrapped;
  }
  const bodyText = await res.text();
  const durationMs = Date.now() - t0;
  logger?.({ msg: "overpass.fetch", status: res.status, byte_length: bodyText.length, duration_ms: durationMs });
  if (res.status !== 200) {
    const err = new OverpassError(`overpass HTTP ${res.status}`, {
      status: res.status,
      bodyPreview: bodyText.slice(0, 200),
    });
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
  for (const k of ALLOWED_HEADERS) if (headersObj?.[k]) out[k] = String(headersObj[k]).slice(0, 200);
  return out;
}
