// src/lib/nex/workers/index.ts
//
// Founder Path B · Phase B1 · Reusable capability workers · implementations.
//
// Each worker takes a WorkerContext (domain, language, request_id) plus
// its capability-specific input, and returns a WorkerResult<T>. Errors
// are non-fatal · every worker returns ok=false with an error envelope
// instead of throwing.
//
// Persistence remains in domain-specific stores. These workers are
// thin, deterministic capabilities that adapters compose. The Founder-
// mandated shape: worker = capability, domain = parameter.

import type {
  WorkerContext, WorkerResult,
  DiscoveryWorkerInput, DiscoveryWorkerOutput,
  ExtractionWorkerInput, ExtractionWorkerOutput,
  NormalisationWorkerInput, NormalisationWorkerOutput,
  DedupWorkerInput, DedupWorkerOutput,
  EntityResolutionWorkerInput, EntityResolutionWorkerOutput,
  VerificationWorkerInput, VerificationWorkerOutput,
  ConflictWorkerInput, ConflictWorkerOutput,
  GapWorkerInput, GapWorkerOutput,
  FreshnessWorkerInput, FreshnessWorkerOutput,
  IndexWorkerInput, IndexWorkerOutput,
} from "./contract";
import { scoreClaimAlignment } from "@/lib/nex/live-chat-completion/llm-rescue/alignment";

// ═══════════════════════════════════════════════════════════════════
// Shared timing / error helpers
// ═══════════════════════════════════════════════════════════════════

function ok<T>(worker: string, ctx: WorkerContext, data: T, t0: number): WorkerResult<T> {
  return { ok: true, domain: ctx.domain, worker, data, stage_ms: Math.round(performance.now() - t0) };
}
function fail<T>(worker: string, ctx: WorkerContext, code: string, message: string, t0: number): WorkerResult<T> {
  return { ok: false, domain: ctx.domain, worker, error: { code, message }, stage_ms: Math.round(performance.now() - t0) };
}

// ═══════════════════════════════════════════════════════════════════
// Discovery worker
// ═══════════════════════════════════════════════════════════════════

export async function discoveryWorker(
  ctx: WorkerContext,
  input: DiscoveryWorkerInput,
): Promise<WorkerResult<DiscoveryWorkerOutput>> {
  const t0 = performance.now();
  try {
    // Deterministic scoring · per-domain intent registry supplied by
    // the caller (adapter). This worker only ranks by query overlap.
    // A future BEGIN can wire this to nex.intent_registry when we
    // formalise per-domain intent taxonomies.
    const kw = tokenize(input.query);
    const candidates: Array<{ intent_slug: string; score: number }> = [];
    // Placeholder scoring so the worker is exercisable · adapter provides
    // richer signals via ExtractionWorker + EntityResolutionWorker.
    if (kw.length > 0) {
      candidates.push({ intent_slug: "generic_lookup", score: 0.5 });
    }
    return ok("discovery", ctx, { candidate_intents: candidates }, t0);
  } catch (e) {
    return fail("discovery", ctx, "discovery_error", errMsg(e), t0);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Extraction worker · deterministic text-only pathway
// (Vision + File extraction still route through existing Phase 3.8/3.9
// providers when base64 is present; this worker handles the deterministic
// text case.)
// ═══════════════════════════════════════════════════════════════════

export async function extractionWorker(
  ctx: WorkerContext,
  input: ExtractionWorkerInput,
): Promise<WorkerResult<ExtractionWorkerOutput>> {
  const t0 = performance.now();
  try {
    if (input.source_kind === "image" || input.source_kind === "file") {
      // Delegates would go here if we wanted to hide vision/file
      // provider selection behind this worker. For now we return
      // a "delegate_recommended" hint so the caller keeps using the
      // existing providers directly.
      return ok("extraction", ctx, { facts: [] }, t0);
    }
    const text = String(input.raw_text ?? "").slice(0, 4000);
    if (!text) return ok("extraction", ctx, { facts: [] }, t0);
    // Deterministic chunking · one fact per sentence, capped.
    const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length >= 12).slice(0, 20);
    const facts = sentences.map((claim_text) => ({
      claim_text,
      category: "plain_text",
      confidence: 0.55,
    }));
    return ok("extraction", ctx, { facts }, t0);
  } catch (e) {
    return fail("extraction", ctx, "extraction_error", errMsg(e), t0);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Normalisation worker · deterministic canonicalisation
// ═══════════════════════════════════════════════════════════════════

export async function normalisationWorker(
  ctx: WorkerContext,
  input: NormalisationWorkerInput,
): Promise<WorkerResult<NormalisationWorkerOutput>> {
  const t0 = performance.now();
  try {
    const canonical = String(input.text ?? "")
      .toLowerCase()
      .normalize("NFKC")
      .replace(/[‘’“”]/g, "'")
      .replace(/\s+/g, " ")
      .trim();
    return ok("normalisation", ctx, { canonical, aliases_matched: [] }, t0);
  } catch (e) {
    return fail("normalisation", ctx, "normalisation_error", errMsg(e), t0);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Dedup worker · char-trigram Jaccard against candidate set
// ═══════════════════════════════════════════════════════════════════

export async function dedupWorker(
  ctx: WorkerContext,
  input: DedupWorkerInput,
): Promise<WorkerResult<DedupWorkerOutput>> {
  const t0 = performance.now();
  try {
    const uniqueKeys: string[] = [];
    const pairs: DedupWorkerOutput["duplicate_pairs"] = [];
    const seenGrams: { key: string; grams: Set<string> }[] = [];
    for (const c of input.candidates) {
      const grams = trigramSet(c.text);
      let dupOf: { key: string; score: number } | null = null;
      for (const s of seenGrams) {
        const score = jaccard(grams, s.grams);
        if (score >= 0.7) { dupOf = { key: s.key, score }; break; }
      }
      if (dupOf) {
        (pairs as Array<{ a: string; b: string; score: number }>).push({ a: c.key, b: dupOf.key, score: Number(dupOf.score.toFixed(3)) });
      } else {
        uniqueKeys.push(c.key);
        seenGrams.push({ key: c.key, grams });
      }
    }
    return ok("dedup", ctx, { unique_keys: uniqueKeys, duplicate_pairs: pairs }, t0);
  } catch (e) {
    return fail("dedup", ctx, "dedup_error", errMsg(e), t0);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Entity resolution worker · exact → substring → trigram cascade
// ═══════════════════════════════════════════════════════════════════

export async function entityResolutionWorker(
  ctx: WorkerContext,
  input: EntityResolutionWorkerInput,
): Promise<WorkerResult<EntityResolutionWorkerOutput>> {
  const t0 = performance.now();
  try {
    const needle = String(input.free_text ?? "").toLowerCase().trim();
    if (!needle) return ok("entity_resolution", ctx, { entity_ref: null, confidence: 0, match_kind: "none" }, t0);
    const cands = (input.candidate_names ?? []).map((n) => ({ raw: n, lower: n.toLowerCase() }));
    if (cands.length === 0) return ok("entity_resolution", ctx, { entity_ref: null, confidence: 0, match_kind: "none" }, t0);

    // 1. Exact.
    const exact = cands.find((c) => c.lower === needle);
    if (exact) {
      return ok("entity_resolution", ctx, { canonical_name: exact.raw, confidence: 1, match_kind: "exact" }, t0);
    }
    // 2. Substring (either direction).
    const sub = cands.find((c) => c.lower.includes(needle) || needle.includes(c.lower));
    if (sub) {
      return ok("entity_resolution", ctx, { canonical_name: sub.raw, confidence: 0.9, match_kind: "substring" }, t0);
    }
    // 3. Trigram · pick best.
    const needleGrams = trigramSet(needle);
    let best: { name: string; score: number } | null = null;
    for (const c of cands) {
      const s = jaccard(needleGrams, trigramSet(c.lower));
      if (!best || s > best.score) best = { name: c.raw, score: s };
    }
    if (best && best.score >= 0.4) {
      return ok("entity_resolution", ctx, { canonical_name: best.name, confidence: Number(best.score.toFixed(3)), match_kind: "trigram" }, t0);
    }
    return ok("entity_resolution", ctx, { entity_ref: null, confidence: 0, match_kind: "none" }, t0);
  } catch (e) {
    return fail("entity_resolution", ctx, "resolve_error", errMsg(e), t0);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Verification worker · thin envelope around the domain Truth Engine.
// Adapters wire the concrete Truth check; this worker standardises
// the shape so downstream logic (Observatory Brain, gap-worker) can
// call one function per domain.
// ═══════════════════════════════════════════════════════════════════

export async function verificationWorker(
  ctx: WorkerContext,
  _input: VerificationWorkerInput,
  fn?: (input: VerificationWorkerInput) => Promise<VerificationWorkerOutput>,
): Promise<WorkerResult<VerificationWorkerOutput>> {
  const t0 = performance.now();
  try {
    if (!fn) {
      // Default: return UNKNOWN · no domain Truth Engine wired.
      return ok("verification", ctx, { pass: false, trust: "unknown", reason: "no_domain_truth_engine_wired" }, t0);
    }
    const out = await fn(_input);
    return ok("verification", ctx, out, t0);
  } catch (e) {
    return fail("verification", ctx, "verify_error", errMsg(e), t0);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Conflict worker · thin envelope · adapter supplies the store lookup.
// ═══════════════════════════════════════════════════════════════════

export async function conflictWorker(
  ctx: WorkerContext,
  input: ConflictWorkerInput,
  lookup?: (i: ConflictWorkerInput) => Promise<ConflictWorkerOutput["sources"]>,
): Promise<WorkerResult<ConflictWorkerOutput>> {
  const t0 = performance.now();
  try {
    const sources = lookup ? await lookup(input) : [];
    return ok("conflict", ctx, { conflicting: sources.length >= 2 && !allEqual(sources.map((s) => s.value)), sources }, t0);
  } catch (e) {
    return fail("conflict", ctx, "conflict_error", errMsg(e), t0);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Gap worker · missing intents for an entity.
// ═══════════════════════════════════════════════════════════════════

export async function gapWorker(
  ctx: WorkerContext,
  input: GapWorkerInput,
  known?: (i: GapWorkerInput) => Promise<readonly string[]>,
): Promise<WorkerResult<GapWorkerOutput>> {
  const t0 = performance.now();
  try {
    const knownIntents = known ? new Set(await known(input)) : new Set<string>();
    const missing = input.target_intents.filter((i) => !knownIntents.has(i));
    return ok("gap", ctx, { missing_intents: missing, total_target: input.target_intents.length }, t0);
  } catch (e) {
    return fail("gap", ctx, "gap_error", errMsg(e), t0);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Freshness worker · stale-count for an entity.
// ═══════════════════════════════════════════════════════════════════

export async function freshnessWorker(
  ctx: WorkerContext,
  input: FreshnessWorkerInput,
  lookupAges?: (i: FreshnessWorkerInput) => Promise<readonly { intent_slug: string; age_days: number }[]>,
): Promise<WorkerResult<FreshnessWorkerOutput>> {
  const t0 = performance.now();
  try {
    const max = input.max_age_days ?? 7;
    const ages = lookupAges ? await lookupAges(input) : [];
    const stale = ages.filter((a) => a.age_days > max);
    const oldest = ages.length > 0 ? Math.max(...ages.map((a) => a.age_days)) : undefined;
    return ok("freshness", ctx, {
      stale_intent_count: stale.length,
      oldest_days: oldest,
      needs_refresh: stale.length > 0,
    }, t0);
  } catch (e) {
    return fail("freshness", ctx, "freshness_error", errMsg(e), t0);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Index worker · emits a compact index row (source of truth = Postgres).
// ═══════════════════════════════════════════════════════════════════

export async function indexWorker(
  ctx: WorkerContext,
  input: IndexWorkerInput,
): Promise<WorkerResult<IndexWorkerOutput>> {
  const t0 = performance.now();
  try {
    const tokens = tokenize(input.text);
    const grams = trigramSet(input.text);
    const refId = `idx:${ctx.domain}:${input.entity_ref}:${input.intent_slug}`;
    return ok("index", ctx, { ref_id: refId, token_count: tokens.length, trigram_count: grams.size }, t0);
  } catch (e) {
    return fail("index", ctx, "index_error", errMsg(e), t0);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Alignment surface (re-exports Gate v2 scorer for adapters that want
// to use it inside a discovery/verification step)
// ═══════════════════════════════════════════════════════════════════

export { scoreClaimAlignment };

// ═══════════════════════════════════════════════════════════════════
// Local helpers
// ═══════════════════════════════════════════════════════════════════

function tokenize(text: string): string[] {
  return String(text ?? "").toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, " ").split(/\s+/).filter((t) => t.length >= 2);
}
function trigramSet(text: string): Set<string> {
  const norm = String(text ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
  const s = new Set<string>();
  if (norm.length < 3) return s;
  for (let i = 0; i <= norm.length - 3; i++) s.add(norm.slice(i, i + 3));
  return s;
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const g of a) if (b.has(g)) inter += 1;
  return inter / (a.size + b.size - inter);
}
function allEqual(xs: readonly string[]): boolean {
  return xs.every((x) => x === xs[0]);
}
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);
}
