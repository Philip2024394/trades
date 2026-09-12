// src/lib/nex/intelligence-storage-grid/accommodation/shadow-mode.ts
//
// Founder BEGIN 2026-09-09 · SHADOW-MODE WIRING (production)
//
// Runs the P1-P5 deterministic pipeline (parser + fact-computer + hot-tier +
// composer) alongside the real chat brain WITHOUT changing what the customer
// sees. Emits a paired {chat, deterministic} record for offline agreement
// analysis.
//
// Discipline:
//   1. Never mutates the customer-visible reply.
//   2. Hard timeout budget (default 60ms · env NEX_DETERMINISTIC_SHADOW_BUDGET_MS).
//      If the shadow exceeds budget → return a honest {skipped: "over_budget"}.
//   3. Any thrown error → captured, logged in _debug_timings, never re-thrown.
//   4. Lazy Postgres fetch when hot-tier is cold for the listing(s) in focus.
//      One-time per process cold-start cost of ~2s to warm the top-877 subset
//      is deferred to a background bootstrap on first invocation.
//   5. Env flag NEX_DETERMINISTIC_SHADOW must be truthy for anything to run.
//   6. Every paired record is appended to a rolling JSONL sink for the
//      Founder to inspect via /api/nex/deterministic-shadow/state.

import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import type { Pool } from "pg";

import { parseIntent, type ParsedIntent } from "./intent-parser";
import { computeFactBundle, type FactBundle } from "./fact-computer";
import { composeReply, type ComposedReply } from "./deterministic-composer";
import { factHotGet, factHotSet, factHotSetBulk, factHotStats } from "./hot-tier-facts";
import type { AccommodationRow, FieldProvenanceRow } from "./adapter-postgres";
import type { EnrichmentEvidenceRow } from "./fact-computer";

// ═══════════════════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════════════════

export const SHADOW_MODE_ENABLED = (() => {
  const raw = process.env.NEX_DETERMINISTIC_SHADOW;
  return raw === "1" || raw === "true" || raw === "on";
})();

// Founder BEGIN B 2026-09-09 · NEX_DETERMINISTIC_REPLY promotes qualifying
// deterministic composer output to the customer-visible reply. Reply mode
// implies shadow (the pipeline is the same), so runShadowMode fires when
// EITHER flag is on. Promotion itself lives in the chat route, gated by
// REPLY_MODE_ENABLED + trust threshold + composition_meta.accepted guard.
export const REPLY_MODE_ENABLED = (() => {
  const raw = process.env.NEX_DETERMINISTIC_REPLY;
  return raw === "1" || raw === "true" || raw === "on";
})();

export const SHADOW_BUDGET_MS = (() => {
  const raw = process.env.NEX_DETERMINISTIC_SHADOW_BUDGET_MS;
  // Founder BEGIN B 2026-09-09 · raised cap 500 → 10000 because reply-mode
  // needs enough headroom for the cold-boot hot-tier bootstrap (~2-6s per
  // memory) + lazy per-ref Postgres fetch (~200-500ms) on top of compose
  // (<1ms warm). Observation-only default (60ms) unchanged when unset.
  const n = raw ? Number(raw) : 60;
  return Number.isFinite(n) && n >= 1 && n <= 10000 ? n : 60;
})();

const JSONL_DIR = path.join(process.cwd(), "data", "deterministic-shadow");
const JSONL_PATH = (() => {
  const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(JSONL_DIR, `shadow_${stamp}.jsonl`);
})();

// ═══════════════════════════════════════════════════════════════════
// Bootstrap · warm the hot-tier once per process (async · non-blocking)
// ═══════════════════════════════════════════════════════════════════

let _bootstrapPromise: Promise<{ ok: boolean; loaded: number; ms: number; note?: string }> | null = null;

async function bootstrapHotTier(pool: Pool, city = "Yogyakarta"): Promise<{ ok: boolean; loaded: number; ms: number; note?: string }> {
  if (_bootstrapPromise) return _bootstrapPromise;
  _bootstrapPromise = (async () => {
    const t0 = performance.now();
    try {
      const rowsRes = await pool.query(
        `SELECT * FROM nex.accommodation_business
          WHERE city = $1 AND claim_status IN ('listed', 'claimed', 'paying')
          ORDER BY updated_at DESC NULLS LAST
          LIMIT 1000`,
        [city],
      );
      const rows = rowsRes.rows as AccommodationRow[];
      if (rows.length === 0) return { ok: true, loaded: 0, ms: Math.round(performance.now() - t0), note: "no rows in Postgres for city" };
      const refs = rows.map((r) => r.public_listing_ref);
      const provRes = await pool.query(
        `SELECT * FROM nex.accommodation_business_field_provenance WHERE business_ref = ANY($1::text[])`,
        [refs],
      );
      const evRes = await pool.query(
        `SELECT business_ref, field_name, value, raw_payload, confidence, source, source_type, discovered_at
           FROM nex.accommodation_enrichment_evidence WHERE business_ref = ANY($1::text[])`,
        [refs],
      );
      const provByRef = new Map<string, FieldProvenanceRow[]>();
      for (const p of provRes.rows as FieldProvenanceRow[]) {
        if (!provByRef.has(p.business_ref)) provByRef.set(p.business_ref, []);
        provByRef.get(p.business_ref)!.push(p);
      }
      const evByRef = new Map<string, EnrichmentEvidenceRow[]>();
      for (const e of evRes.rows as EnrichmentEvidenceRow[]) {
        if (!evByRef.has(e.business_ref)) evByRef.set(e.business_ref, []);
        evByRef.get(e.business_ref)!.push(e);
      }
      const bundles: FactBundle[] = rows.map((row) =>
        computeFactBundle({
          row,
          provenance: provByRef.get(row.public_listing_ref) ?? [],
          evidence: evByRef.get(row.public_listing_ref) ?? [],
        }),
      );
      factHotSetBulk(bundles);
      return { ok: true, loaded: bundles.length, ms: Math.round(performance.now() - t0) };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, loaded: 0, ms: Math.round(performance.now() - t0), note: `bootstrap_failed: ${msg}` };
    }
  })();
  return _bootstrapPromise;
}

// ═══════════════════════════════════════════════════════════════════
// Extract "prior list" from the real chat brain response
// ═══════════════════════════════════════════════════════════════════

export interface ExtractedListItem {
  listing_ref: string;
  business_name: string;
}

/**
 * Pull a prior_list-shaped set from whatever the chat brain surfaced.
 * We look at composed.card.payload.hits and composed.world_cards.cards.
 * Returns [] if none — the composer will honestly clarify.
 */
export function extractPriorListFromChatBrainReply(brainReply: unknown): ExtractedListItem[] {
  const out: ExtractedListItem[] = [];
  const r = brainReply as Record<string, unknown> | null;
  if (!r || typeof r !== "object") return out;

  const cardPayload = (r.card as { payload?: { hits?: unknown[] } } | null)?.payload;
  const hits = Array.isArray(cardPayload?.hits) ? cardPayload!.hits! : [];
  for (const h of hits) {
    const hObj = h as { listing_ref?: string; public_listing_ref?: string; business_name?: string; name?: string };
    const ref = hObj?.listing_ref ?? hObj?.public_listing_ref ?? null;
    const name = hObj?.business_name ?? hObj?.name ?? null;
    if (ref && name) out.push({ listing_ref: ref, business_name: name });
  }

  const wc = r.world_cards as { cards?: unknown[] } | null;
  if (out.length === 0 && Array.isArray(wc?.cards)) {
    for (const c of wc!.cards!) {
      const cObj = c as { listing_ref?: string; public_listing_ref?: string; business_name?: string; name?: string };
      const ref = cObj?.listing_ref ?? cObj?.public_listing_ref ?? null;
      const name = cObj?.business_name ?? cObj?.name ?? null;
      if (ref && name) out.push({ listing_ref: ref, business_name: name });
    }
  }
  return out.slice(0, 5); // cap so we don't compose a wall of text
}

// ═══════════════════════════════════════════════════════════════════
// Main entry · non-blocking · budgeted
// ═══════════════════════════════════════════════════════════════════

export interface ShadowRunResult {
  enabled: boolean;
  skipped_reason?: string;
  ms: number;
  parsed?: {
    intent_slug: string | null;
    confidence: number;
    slots: ParsedIntent["slots"];
  };
  composed?: {
    reply_text: string;
    reply_kind: ComposedReply["reply_kind"];
    trust: ComposedReply["trust"];
    answered: boolean;
    intent_slug: string | null;
  };
  hot_tier: { size: number; hit_ratio: number; lookup_p50_ms: number };
  bootstrap?: { ok: boolean; loaded: number; ms: number; note?: string };
  prior_list_size: number;
}

export async function runShadowMode(input: {
  message: string;
  conversation_id: string | null;
  language: "en" | "id";
  pool: Pool;
  chatBrainReply: unknown; // the composed reply from orchestrateChatTurnLive
  chatBrainVisibleText: string;
  chatBrainIntent: string | null;
}): Promise<ShadowRunResult> {
  const t0 = performance.now();
  if (!SHADOW_MODE_ENABLED && !REPLY_MODE_ENABLED) {
    return {
      enabled: false,
      skipped_reason: "flag_off",
      ms: 0,
      hot_tier: { size: 0, hit_ratio: 0, lookup_p50_ms: 0 },
      prior_list_size: 0,
    };
  }

  // Race against the budget
  const budgetTimeout = new Promise<ShadowRunResult>((resolve) => {
    setTimeout(() => resolve({
      enabled: true,
      skipped_reason: "over_budget",
      ms: SHADOW_BUDGET_MS,
      hot_tier: hotStatsSnapshot(),
      prior_list_size: 0,
    }), SHADOW_BUDGET_MS);
  });

  const shadow = (async (): Promise<ShadowRunResult> => {
    // Fire-and-await bootstrap · first call kicks it off, subsequent calls hit the memoized promise
    const bootstrap = await bootstrapHotTier(input.pool);

    // Parse
    const parsed = parseIntent(input.message);

    // Prior list from the chat brain's own reply
    const priorList = extractPriorListFromChatBrainReply(input.chatBrainReply);

    // Gather bundles for the prior_list (lazy Postgres fetch if any missing)
    const bundles: FactBundle[] = [];
    const missingRefs: string[] = [];
    for (const item of priorList) {
      const hit = factHotGet(item.listing_ref);
      if (hit) bundles.push(hit.bundle);
      else missingRefs.push(item.listing_ref);
    }
    if (missingRefs.length > 0) {
      try {
        const rowsRes = await input.pool.query(
          `SELECT * FROM nex.accommodation_business WHERE public_listing_ref = ANY($1::text[])`,
          [missingRefs],
        );
        const rows = rowsRes.rows as AccommodationRow[];
        if (rows.length > 0) {
          const refs = rows.map((r) => r.public_listing_ref);
          const provRes = await input.pool.query(
            `SELECT * FROM nex.accommodation_business_field_provenance WHERE business_ref = ANY($1::text[])`,
            [refs],
          );
          const evRes = await input.pool.query(
            `SELECT business_ref, field_name, value, raw_payload, confidence, source, source_type, discovered_at
               FROM nex.accommodation_enrichment_evidence WHERE business_ref = ANY($1::text[])`,
            [refs],
          );
          const provByRef = new Map<string, FieldProvenanceRow[]>();
          for (const p of provRes.rows as FieldProvenanceRow[]) {
            if (!provByRef.has(p.business_ref)) provByRef.set(p.business_ref, []);
            provByRef.get(p.business_ref)!.push(p);
          }
          const evByRef = new Map<string, EnrichmentEvidenceRow[]>();
          for (const e of evRes.rows as EnrichmentEvidenceRow[]) {
            if (!evByRef.has(e.business_ref)) evByRef.set(e.business_ref, []);
            evByRef.get(e.business_ref)!.push(e);
          }
          for (const row of rows) {
            const b = computeFactBundle({
              row,
              provenance: provByRef.get(row.public_listing_ref) ?? [],
              evidence: evByRef.get(row.public_listing_ref) ?? [],
            });
            factHotSet(row.public_listing_ref, b);
            bundles.push(b);
          }
        }
      } catch { /* lazy fetch failure is honestly reported as "no bundle" */ }
    }

    // Compose
    const composed = composeReply({
      parsed,
      bundles,
      context: {
        language: input.language,
        prior_list: priorList.length > 0 ? priorList : undefined,
        focus_listing_ref: priorList.length === 1 ? priorList[0].listing_ref : undefined,
      },
    });

    const ms = Math.round(performance.now() - t0);
    const result: ShadowRunResult = {
      enabled: true,
      ms,
      parsed: { intent_slug: parsed.intent_slug, confidence: parsed.confidence, slots: parsed.slots },
      composed: {
        reply_text: composed.reply_text,
        reply_kind: composed.reply_kind,
        trust: composed.trust,
        answered: composed.answered,
        intent_slug: composed.intent_slug,
      },
      hot_tier: hotStatsSnapshot(),
      bootstrap,
      prior_list_size: priorList.length,
    };

    // Sink · non-blocking best-effort append
    void appendJsonl({
      ts: new Date().toISOString(),
      conversation_id: input.conversation_id,
      message: input.message,
      language: input.language,
      chat_brain: {
        reply_text: input.chatBrainVisibleText,
        intent: input.chatBrainIntent,
      },
      shadow: result,
    });

    return result;
  })();

  return Promise.race([budgetTimeout, shadow]);
}

function hotStatsSnapshot(): ShadowRunResult["hot_tier"] {
  const s = factHotStats();
  return { size: s.size, hit_ratio: s.hit_ratio, lookup_p50_ms: s.lookup_ms_p50 };
}

// ═══════════════════════════════════════════════════════════════════
// JSONL sink · rolling per-day file
// ═══════════════════════════════════════════════════════════════════

async function appendJsonl(record: unknown): Promise<void> {
  try {
    await fs.promises.mkdir(JSONL_DIR, { recursive: true });
    await fs.promises.appendFile(JSONL_PATH, JSON.stringify(record) + "\n", "utf8");
  } catch { /* sink failure must never break shadow mode */ }
}

// ═══════════════════════════════════════════════════════════════════
// Observability helper · read last N pairs (used by /api/nex/deterministic-shadow/state)
// ═══════════════════════════════════════════════════════════════════

export async function readLastPairs(n = 25): Promise<{
  pairs: unknown[];
  path: string;
  agreement_notes: {
    total: number;
    both_answered: number;
    both_unknown: number;
    chat_answered_shadow_unknown: number;
    chat_unknown_shadow_answered: number;
    shadow_would_clarify: number;
    shadow_over_budget: number;
  };
}> {
  const agreement = {
    total: 0, both_answered: 0, both_unknown: 0,
    chat_answered_shadow_unknown: 0, chat_unknown_shadow_answered: 0,
    shadow_would_clarify: 0, shadow_over_budget: 0,
  };
  let pairs: unknown[] = [];
  try {
    if (!fs.existsSync(JSONL_PATH)) return { pairs, path: JSONL_PATH, agreement_notes: agreement };
    const raw = await fs.promises.readFile(JSONL_PATH, "utf8");
    const lines = raw.trim().split(/\n+/).slice(-n);
    for (const line of lines) {
      try {
        const rec = JSON.parse(line) as {
          chat_brain?: { reply_text?: string; intent?: string | null };
          shadow?: ShadowRunResult;
        };
        pairs.push(rec);
        agreement.total++;
        const s = rec.shadow;
        if (s?.skipped_reason === "over_budget") agreement.shadow_over_budget++;
        else if (s?.composed?.reply_kind === "clarify") agreement.shadow_would_clarify++;
        else if (s?.composed?.answered && rec.chat_brain?.reply_text) agreement.both_answered++;
        else if (!s?.composed?.answered && rec.chat_brain?.reply_text) agreement.chat_answered_shadow_unknown++;
        else if (s?.composed?.answered && !rec.chat_brain?.reply_text) agreement.chat_unknown_shadow_answered++;
        else agreement.both_unknown++;
      } catch { /* skip malformed line */ }
    }
  } catch { /* sink read failure */ }
  return { pairs, path: JSONL_PATH, agreement_notes: agreement };
}
