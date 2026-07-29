// src/lib/nex/brains/_runtime.ts
//
// BRAIN RUNTIME · ADR-0037 · Philip 2026-07-28
//
// The tier between API routes and the Supabase loader. API routes are
// thin orchestration — they parse input, call runtime methods, return
// the envelope. Business logic lives here.
//
// The Runtime is responsible for:
//   · Dependency resolution (walk the DAG · resolve transitive deps)
//   · Package validation (compatibility matrix · checksum · signature)
//   · Capability negotiation (does this brain support the requested feature?)
//   · Language + country selection (pick the right localised brain)
//   · Runtime compatibility (brain_api_version · minimum_runtime_version)
//   · Fallback logic (Supabase → filesystem → error)
//   · Memory injection (Phase 2+ · slot for scoped context)
//
// Without this layer, those concerns leak into every API route. With
// it, we centralise them once and the API surface stays clean.
//
// Feature-flagged via NEX_BRAIN_RUNTIME_ENABLED so it can be switched
// off in emergencies without touching code.

import {
  brainSupabaseAvailable,
  getBrainBySlug,
  getCurrentBrainVersion,
  listBrainDependencies,
} from "./_supabase";
import { loadBrainWithFallback, type BrainLoadResult } from "./_supabase_loader";
import {
  buildBrainAnswerEnvelope,
  buildUnknownAnswer,
  logBrainAnswer,
  type BrainEvidence,
} from "./_explainability";
import { brainCache } from "./_runtime_cache";
import type { BrainAnswerEnvelope, BrainAnswerKind } from "./_living_types";
import type { BrainPack } from "./_types";

// ---------- Runtime versioning ----------

/**
 * The Nex Runtime version currently running. Compared against every
 * brain version's `minimum_runtime_version` at load time.
 * Bump this string whenever runtime behaviour changes in a way that
 * older brains would break on.
 */
export const NEX_RUNTIME_VERSION = "1.0";

/**
 * Brain API versions this runtime knows how to serve. When you bump
 * the runtime to support a v2 brain contract, ADD to this list rather
 * than replacing — old brains stay live.
 */
export const SUPPORTED_BRAIN_API_VERSIONS = new Set<string>(["1.0"]);

// ---------- Types ----------

export type BrainAskContext = {
  query:              string;
  brain_slug:         string;
  country?:           string;
  language?:          string;
  channel?:           "api" | "chat" | "web" | "mobile" | "admin_preview";
  user_id?:           string | null;
  session_id?:        string | null;
  actor_role?:        "runtime" | "author" | "reviewer" | "admin";
  fallback_pack?:     BrainPack | null;  // filesystem pack for dev
  required_capabilities?: Array<keyof {
    supports_chat: boolean; supports_vision: boolean; supports_voice: boolean;
    supports_estimates: boolean; supports_projects: boolean;
    supports_marketplace: boolean; supports_memory: boolean; supports_simulation: boolean;
  }>;
};

export type BrainAskResult = {
  envelope:     BrainAnswerEnvelope;
  answer_id:    string | null;
  brain_load:   BrainLoadResult;
  runtime_used: string;
  compatibility_result: "compatible" | "needs_upgrade" | "unsupported";
};

export type CompatibilityCheck = {
  ok:            boolean;
  status:        "compatible" | "needs_upgrade" | "unsupported";
  reason?:       string;
  brain_api?:    string;
  min_runtime?:  string;
  runtime?:      string;
};

// ---------- Feature flag ----------

export function runtimeEnabled(): boolean {
  return process.env.NEX_BRAIN_RUNTIME_ENABLED === "true"
      || process.env.NEX_BRAIN_RUNTIME_ENABLED === "1"
      || !process.env.NEX_BRAIN_RUNTIME_ENABLED; // default ON when unset
}

// ---------- Compatibility ----------

/** Semantic-version comparison. Returns -1/0/+1 for a<b / a==b / a>b. */
export function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number(n) || 0);
  const pb = b.split(".").map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const av = pa[i] ?? 0;
    const bv = pb[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

/**
 * Check whether a brain version can be served by this runtime. Uses
 * the compatibility matrix Philip added (brain_api_version +
 * minimum_runtime_version) to produce a deterministic result:
 * compatible · needs_upgrade · unsupported.
 */
export function checkVersionCompatibility(v: {
  brain_api_version: string;
  minimum_runtime_version: string;
}): CompatibilityCheck {
  if (!SUPPORTED_BRAIN_API_VERSIONS.has(v.brain_api_version)) {
    return {
      ok: false,
      status: "unsupported",
      reason: `Brain declares brain_api_version=${v.brain_api_version} but this runtime supports ${[...SUPPORTED_BRAIN_API_VERSIONS].join(", ")}.`,
      brain_api: v.brain_api_version,
      runtime: NEX_RUNTIME_VERSION,
    };
  }
  if (compareSemver(NEX_RUNTIME_VERSION, v.minimum_runtime_version) < 0) {
    return {
      ok: false,
      status: "needs_upgrade",
      reason: `Brain requires runtime ≥ ${v.minimum_runtime_version} · this runtime is ${NEX_RUNTIME_VERSION}.`,
      min_runtime: v.minimum_runtime_version,
      runtime: NEX_RUNTIME_VERSION,
    };
  }
  return {
    ok: true,
    status: "compatible",
    brain_api: v.brain_api_version,
    min_runtime: v.minimum_runtime_version,
    runtime: NEX_RUNTIME_VERSION,
  };
}

// ---------- Capability negotiation ----------

/**
 * Does the brain support every capability the caller requires?
 * Returns { ok, missing[] } so callers can render an informative
 * fallback rather than a silent failure.
 */
export function negotiateCapabilities(
  brainCapabilities: Record<string, boolean>,
  required: string[]
): { ok: boolean; missing: string[] } {
  const missing = required.filter((cap) => !brainCapabilities[cap]);
  return { ok: missing.length === 0, missing };
}

// ---------- Localisation ----------

/**
 * Pick the right brain variant for a country + language pair. Phase 1
 * is single-brain-per-slug — this returns the brain as-is once the
 * incoming country / language are within the brain's declared support.
 * Multi-variant routing (e.g. staircase-au vs staircase-uk) comes in
 * Phase 2 when the Brain Marketplace ships.
 */
export function checkLocalisation(
  brain: { supported_countries: string[]; languages: string[]; primary_country: string | null; primary_language: string },
  ctx: { country?: string; language?: string }
): { ok: boolean; reason?: string; using_country: string | null; using_language: string } {
  const using_language = ctx.language ?? brain.primary_language;
  const using_country = ctx.country ?? brain.primary_country;
  if (ctx.country && brain.supported_countries.length > 0 && !brain.supported_countries.includes(ctx.country)) {
    return {
      ok: false,
      reason: `Brain does not support country '${ctx.country}'. Supported: ${brain.supported_countries.join(", ")}.`,
      using_country,
      using_language,
    };
  }
  if (ctx.language && brain.languages.length > 0 && !brain.languages.includes(ctx.language)) {
    return {
      ok: false,
      reason: `Brain does not support language '${ctx.language}'. Supported: ${brain.languages.join(", ")}.`,
      using_country,
      using_language,
    };
  }
  return { ok: true, using_country, using_language };
}

// ---------- Dependency resolution ----------

/**
 * Walk the dependency DAG for a brain. Returns the transitive set of
 * child brain slugs. Detects cycles + returns them so a mis-authored
 * dep set can't hang the runtime.
 */
export async function resolveDependencies(
  parent_slug: string,
  maxDepth = 5
): Promise<{ resolved: string[]; cycles: string[][] }> {
  const resolved: string[] = [];
  const cycles: string[][] = [];
  const seen = new Set<string>();
  const stack: Array<{ slug: string; path: string[] }> = [{ slug: parent_slug, path: [parent_slug] }];
  while (stack.length > 0) {
    const { slug, path } = stack.pop()!;
    if (path.length > maxDepth) continue;
    const deps = await listBrainDependencies(slug);
    for (const dep of deps) {
      const child = dep.child_brain_slug;
      if (path.includes(child)) {
        cycles.push([...path, child]);
        continue;
      }
      if (seen.has(child)) continue;
      seen.add(child);
      resolved.push(child);
      stack.push({ slug: child, path: [...path, child] });
    }
  }
  return { resolved, cycles };
}

// ---------- Package validation stub ----------

/**
 * Package validation is fully specified in ADR-0037 but the signing
 * infrastructure ships in a later phase. For Phase 1 this returns
 * "no package" cleanly when no package_manifest_json is present.
 */
export function validatePackage(v: {
  package_checksum: string | null;
  package_signature: string | null;
  package_manifest_json: unknown;
}): { ok: boolean; verified: boolean; reason?: string } {
  if (!v.package_manifest_json) return { ok: true, verified: false };
  // Phase 2+: verify signature against public key, checksum content, etc.
  return { ok: true, verified: false, reason: "Package validation deferred to Phase 2." };
}

// ---------- Ask (the composed orchestrator) ----------

/**
 * The single entry point every API route calls. Handles the full
 * runtime stack: cache → Supabase load → fallback → compatibility →
 * localisation → capability negotiation → answer synthesis → logging.
 *
 * Phase 1 answer synthesis is a scaffold — it returns an "unknown"
 * envelope pointing at the brain modules the query MIGHT relate to.
 * Phase 2 wires the RAG/LLM answer generation. The envelope contract
 * is complete now so the API surface never has to change.
 */
export async function askBrain(ctx: BrainAskContext): Promise<BrainAskResult> {
  const query = ctx.query.trim();

  // 1. Load the brain (cache → Supabase → filesystem fallback)
  const brain_load = await loadBrainViaCache(ctx.brain_slug, ctx.fallback_pack ?? null);
  const versionSemver = brain_load.version_semver ?? "0.0.0";
  const versionId = brain_load.version_id ?? "unknown";

  // 2. Compatibility (only when we have Supabase metadata)
  let compatibility_result: "compatible" | "needs_upgrade" | "unsupported" = "compatible";
  if (brain_load.brain_row?.current_version_id) {
    const versionRow = await getCurrentBrainVersion(ctx.brain_slug);
    if (versionRow) {
      const check = checkVersionCompatibility({
        brain_api_version: versionRow.brain_api_version,
        minimum_runtime_version: versionRow.minimum_runtime_version,
      });
      compatibility_result = check.status;
      if (!check.ok) {
        const envelope = buildUnknownAnswer({
          reason: check.reason ?? "Runtime incompatible.",
          brain_slug: ctx.brain_slug,
          brain_version: versionSemver,
          brain_version_id: versionId,
          suggested_next: `This brain is currently ${check.status.replace("_", " ")}. Please upgrade the runtime or install a compatible brain version.`,
        });
        const answer_id = await logBrainAnswer({
          envelope, query_text: query, answered_by_channel: ctx.channel ?? "api",
          user_id: ctx.user_id, session_id: ctx.session_id,
          metadata: { compatibility_check: check },
        });
        return { envelope, answer_id, brain_load, runtime_used: NEX_RUNTIME_VERSION, compatibility_result };
      }
    }
  }

  // 3. Localisation
  if (brain_load.brain_row) {
    const loc = checkLocalisation(
      {
        supported_countries: brain_load.brain_row.supported_countries,
        languages: brain_load.brain_row.languages,
        primary_country: brain_load.brain_row.primary_country,
        primary_language: brain_load.brain_row.primary_language,
      },
      { country: ctx.country, language: ctx.language }
    );
    if (!loc.ok) {
      const envelope = buildUnknownAnswer({
        reason: loc.reason ?? "Locale unsupported.",
        brain_slug: ctx.brain_slug,
        brain_version: versionSemver,
        brain_version_id: versionId,
        suggested_next: "Ask NEX in a supported locale or install a locale-specific brain.",
      });
      const answer_id = await logBrainAnswer({
        envelope, query_text: query, answered_by_channel: ctx.channel ?? "api",
        user_id: ctx.user_id, session_id: ctx.session_id,
        metadata: { localisation: loc },
      });
      return { envelope, answer_id, brain_load, runtime_used: NEX_RUNTIME_VERSION, compatibility_result };
    }
  }

  // 4. Capability negotiation
  if (ctx.required_capabilities && ctx.required_capabilities.length > 0 && brain_load.brain_row) {
    const cap = negotiateCapabilities(
      brain_load.brain_row.capabilities as Record<string, boolean>,
      ctx.required_capabilities as string[]
    );
    if (!cap.ok) {
      const envelope = buildUnknownAnswer({
        reason: `Brain missing required capabilities: ${cap.missing.join(", ")}.`,
        brain_slug: ctx.brain_slug,
        brain_version: versionSemver,
        brain_version_id: versionId,
      });
      const answer_id = await logBrainAnswer({
        envelope, query_text: query, answered_by_channel: ctx.channel ?? "api",
        user_id: ctx.user_id, session_id: ctx.session_id,
        metadata: { capabilities_missing: cap.missing },
      });
      return { envelope, answer_id, brain_load, runtime_used: NEX_RUNTIME_VERSION, compatibility_result };
    }
  }

  // 5. Answer synthesis (Reference Brain Runtime · Philip 2026-07-28)
  //    Intent → Retrieval → Synthesis → Envelope
  //    Retrieval-only synthesizer by default (zero invention risk).
  //    LLM-augmented when NEX_LLM_ENABLED=1 and adapter wired.
  const { detectIntent } = await import("./_intent");
  const { retrieveContent } = await import("./_retrieval");
  const { getSynthesizer } = await import("./_synthesis");

  const intent = detectIntent(query, brain_load.brain);
  const retrieval = retrieveContent(brain_load.brain, intent);
  const synthesizer = getSynthesizer();
  const envelope = await synthesizer.synthesize({
    brain: brain_load.brain,
    brain_slug: brain.manifest.slug,
    brain_version: versionSemver,
    brain_version_id: versionId,
    query,
    intent,
    retrieval,
  });

  const answer_id = await logBrainAnswer({
    envelope, query_text: query, answered_by_channel: ctx.channel ?? "api",
    user_id: ctx.user_id, session_id: ctx.session_id,
    metadata: {
      intent_kind: intent.kind,
      matched_topics: intent.candidate_topics,
      matched_modules: retrieval.matched_modules,
      synthesizer: synthesizer.constructor.name,
    },
  });
  return { envelope, answer_id, brain_load, runtime_used: NEX_RUNTIME_VERSION, compatibility_result };
}

// ---------- Cache-first load ----------

async function loadBrainViaCache(
  slug: string,
  fallback: BrainPack | null
): Promise<BrainLoadResult> {
  const cached = brainCache.get(slug);
  if (cached) return cached;
  const result = await loadBrainWithFallback(slug, fallback);
  brainCache.set(slug, result);
  return result;
}

// ---------- Phase 1 scaffold ----------

/**
 * Phase 1 scaffold answer. Returns "no verified knowledge yet" with
 * evidence pointing at every available brain module — so authors can
 * see immediately what the brain currently knows about. Phase 2
 * replaces this body with the RAG/LLM path but keeps the envelope
 * contract identical.
 */
function phase1Scaffold(
  brain_load: BrainLoadResult,
  query: string,
  versionSemver: string,
  versionId: string
): BrainAnswerEnvelope {
  const brain = brain_load.brain;
  const evidence: BrainEvidence[] = [];
  for (const mod of ["craft", "regulations", "materials", "workflow", "defects", "pricing_model"] as const) {
    if (brain[mod]) {
      evidence.push({
        kind: "brain_module",
        ref: `${brain.manifest.slug}#${mod}`,
        excerpt: `Available in brain version ${versionSemver}`,
      });
    }
  }
  const _ = query; // reserved for Phase 2 RAG
  return buildBrainAnswerEnvelope({
    answer:
      "This runtime is Phase 1 · answer synthesis is scaffolded. The brain is loaded correctly and the explainability envelope + logging + compatibility layer are all working. Phase 2 wires the RAG/LLM answer generation against the modules listed in evidence.",
    reason: "Phase 1 scaffold response · demonstrates that the Brain Runtime layer is functioning end-to-end.",
    brain_slug: brain.manifest.slug,
    brain_version: versionSemver,
    brain_version_id: versionId,
    confidence: 0,
    evidence,
    trade_rule: null,
    answer_kind: "unknown" as BrainAnswerKind,
  });
}
