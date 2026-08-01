// Runtime Core v1 → Pipeline C bridge
//
// Intercepts staircase-chat requests BEFORE composeStaircaseAnswer runs.
// If Runtime Core v1 produces a high-confidence customer-facing answer,
// returns a Pipeline-C-shaped response derived from Philip-authored
// evidence. Otherwise returns null, and the caller falls through to
// composeStaircaseAnswer (existing production path).
//
// Design:
//   - Sentinel return (null = fallback, object = bridge handled it)
//   - Reads full article body from Runtime Core's citation path
//   - Preserves Pipeline C response shape so the UI needs no changes
//   - No LLM calls · deterministic composition · no invention
//
// Runtime Core v1 lives in scripts/ as .mjs · loaded via dynamic import
// so path resolution works in both Next.js server context and Node scripts.

import "server-only";
import path from "node:path";
import { readFileSync } from "node:fs";

// ─── Pipeline C response shape (subset that the UI needs) ───

export type BridgeCitation = {
  module:  string;
  ref_id:  string;
  snippet: string;
  source:  string;
};

export type BridgeResponse = {
  ok:              true;
  answer:          string;
  citations:       BridgeCitation[];
  wood_cards:      [];
  visual_intent:   "neutral";
  comparison:      false;
  expertise:       { level: "unknown"; confidence: 0.3; signals: []; score: 0 };
  status:          "answered_by_runtime_core";
  brain_versions:  Record<string, string>;
  presentation:    undefined;
  conversation_id: string;
  stage:           string;
  retrieved_ids:   string[];
  runtime_core: {
    strategy:      string;
    plan_status:   string;
    plan_answer_type: string;
    plan_confidence: string;
    router_version:  string;
    plan_provenance: unknown;
  };
};

export type TryBridgeInput = {
  message:        string;
  conversationId: string;
  stage:          string;
};

// ─── Dynamic import of Runtime Core (literal path so Turbopack can trace it) ───
// Uses a literal relative-path string · Turbopack refuses runtime-computed
// dynamic imports ("Cannot find module as expression is too dynamic").
// Path: src/lib/nex/staircase-bridge.ts → ../../../scripts/nex-runtime-v1.mjs
// (bridge is 3 levels below repo root · scripts is a sibling of src)

let cachedRuntime: { createRuntime: (opts?: unknown) => { handleMessage: (msg: string) => unknown } } | null = null;

async function loadRuntimeCore() {
  if (cachedRuntime) return cachedRuntime;
  // @ts-expect-error -- .mjs has no .d.ts · dynamic import returns any
  cachedRuntime = await import("../../../scripts/nex-runtime-v1.mjs");
  return cachedRuntime;
}

// ─── Article file read + frontmatter stripping ───

function articleAbsolutePath(citationPathOrId: string): string {
  return path.resolve(process.cwd(), "data", "nex-reference-brains", citationPathOrId);
}

function readArticleBody(citationPathOrId: string): string | null {
  try {
    const absPath = articleAbsolutePath(citationPathOrId);
    const raw = readFileSync(absPath, "utf8");
    // Strip frontmatter between --- markers
    if (raw.startsWith("---")) {
      const closeIdx = raw.indexOf("\n---", 3);
      if (closeIdx > 0) {
        return raw.slice(closeIdx + 4).replace(/^\r?\n/, "").trim();
      }
    }
    return raw.trim();
  } catch {
    return null;
  }
}

function firstNChars(str: string, n: number): string {
  const clean = str.replace(/\s+/g, " ").trim();
  return clean.length <= n ? clean : clean.slice(0, n).trimEnd() + "…";
}

// ─── Cycle 2 · staircase-specific design-intent vocabulary aliases ───
// When Runtime Core cannot route a clear staircase-design query (Router
// emits Learn/Definition/Components at confidence 0.66 < 0.70 · strategy
// returns status=clarify), the bridge detects the design-intent pattern
// in the raw customer message and retries Runtime Core with a known-good
// probe query that DOES route to Customer FAQ. The retry reuses existing
// routing / retrieval / ranking · zero changes to Router / Composer /
// Strategy / Vocabulary Adapter. Scope: staircase brain only.
// Design-intent phrases · route to Design Ideas article via probe.
// Cycle 3A adds "show me [staircase ideas/designs/examples/inspiration]".
const DESIGN_INTENT_PATTERNS: RegExp[] = [
  /\bstaircase\s+(design|designs|style|styles|idea|ideas)\b/i,
  /\b(design|designs|style|styles|idea|ideas)\s+(?:for|of)\s+staircase\b/i,
  /\b(modern|traditional|contemporary|classic|victorian|rustic|scandinavian|farmhouse|shaker|cottage)\s+staircase\b/i,
  /\bstaircase\s+(inspiration|inspir)/i,
  /\bpopular\s+staircase\b/i,
  /\bwhat\s+staircase\s+(design|designs|style|styles)/i,
  /\bshow\s+(?:me\s+)?(?:some\s+)?staircase\s+(idea|ideas|design|designs|example|examples|style|styles|inspiration)\b/i,
  /\bshow\s+(?:me\s+)?(?:some\s+)?(?:staircase\s+)?(inspiration|examples?)\b/i,
];

// Timber / materials-intent phrases · route to Materials Overview via probe.
// Cycle 3A adds material-topic customer language.
const TIMBER_INTENT_PATTERNS: RegExp[] = [
  /\bwhat\s+(wood|woods|timber|timbers|material|materials)\b/i,
  /\b(wood|timber)\s+(options?|choices?|available)\b/i,
  /\b(what|which)\s+(wood|timber|material)\s+(?:is\s+)?(available|used|best|good)\b/i,
  /\boak\s+(?:vs|or|versus)\s+(walnut|pine|ash)\b/i,
  /\b(what|which)\s+staircase\s+(materials?|timbers?|woods?)\b/i,
  /\bstaircase\s+(materials?|timbers?)\b/i,
];

// Single probe · Runtime Core routes it to Customer FAQ · retrieval returns
// gateway + design-ideas + materials articles · Cycle 1 ranker picks the
// article whose subject best matches the ORIGINAL customer message tokens.
const CUSTOMER_FAQ_PROBE = "I want inspiration for stairs";

function looksLikeStaircaseCustomerFaq(message: string): boolean {
  return DESIGN_INTENT_PATTERNS.some((p) => p.test(message))
      || TIMBER_INTENT_PATTERNS.some((p) => p.test(message));
}

// Explicit image-request phrases · when present, do NOT retry to a text article.
// Customer explicitly asked for images · let Pipeline C honestly refuse until
// the Verified Visual Library exists (Philip's rule 2026-08-01).
const EXPLICIT_IMAGE_PATTERNS: RegExp[] = [
  /\b(image|images|picture|pictures|photo|photos|photograph|photographs)\b/i,
  /\b(see|show)\s+(?:me\s+)?(?:an?\s+)?(image|picture|photo|photograph)\b/i,
];
function isExplicitImageRequest(message: string): boolean {
  return EXPLICIT_IMAGE_PATTERNS.some((p) => p.test(message));
}

// ─── Citation ranking · Cycle 1 fix for gateway-vs-design tie-break ───
// When multiple citations share a tied match_score, plain-alphabetical
// order sends "gateway-*" ahead of more topically-specific articles.
// This ranker adds a distinctive-token bonus so the article that
// matches the query's specific vocabulary wins.

const COMMON_STEMS = new Set([
  "staircase", "staircases", "stairs", "stair",
  "the", "a", "an", "for", "of", "to", "in", "on", "and", "or",
  "i", "me", "my", "you", "your", "we", "us", "our",
  "is", "are", "am", "be", "was", "were",
  "with", "about", "at", "by",
]);

function tokenise(str: string): string[] {
  return String(str ?? "")
    .toLowerCase()
    .split(/[\s\-_/,.\?!()]+/)
    .filter((t) => t.length > 1)
    // crude plural-stripping so "designs" matches "design" and "styles" matches "style"
    .map((t) => (t.length > 4 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t));
}

/**
 * Rank the plan's citations using (match_score + distinctive-token bonus).
 * Returns the highest-scoring citation, or null if none can be selected.
 * Preserves alphabetical tie-break within same total-score band.
 */
function selectBestCitation(
  plan: any,
  evidencePackage: any,
  userMessage: string
): { evidenceType: string; path_or_id: string } | null {
  const citations = Array.isArray(plan?.citations) ? plan.citations : [];
  if (citations.length === 0) return null;
  if (citations.length === 1) return citations[0];

  // Distinctive query tokens · remove common staircase / grammar stems
  const distinctiveQueryTokens = new Set(
    tokenise(userMessage).filter((t) => !COMMON_STEMS.has(t))
  );

  // If nothing distinctive to differentiate on, keep original order
  if (distinctiveQueryTokens.size === 0) return citations[0];

  const buckets: Record<string, any[]> =
    evidencePackage?.evidence && typeof evidencePackage.evidence === "object"
      ? evidencePackage.evidence
      : {};

  let best = citations[0];
  let bestScore = -Infinity;

  for (const cit of citations) {
    if (!cit || typeof cit.path_or_id !== "string") continue;
    const bucket = Array.isArray(buckets[cit.evidenceType]) ? buckets[cit.evidenceType] : [];
    const record = bucket.find(
      (r: any) => (r?.path === cit.path_or_id) || (r?.id === cit.path_or_id)
    );
    const baseScore = Number(record?.match_score) || 0;

    // Distinctive-token intersection with article subject + title
    const articleSubject = tokenise(record?.router_metadata?.subject || "");
    const articleTitle = tokenise(record?.title || "");
    const articleTokens = new Set([...articleSubject, ...articleTitle]);
    let distinctiveHits = 0;
    for (const qt of distinctiveQueryTokens) if (articleTokens.has(qt)) distinctiveHits += 1;

    const totalScore = baseScore + distinctiveHits;
    if (totalScore > bestScore) {
      bestScore = totalScore;
      best = cit;
    }
  }
  return best;
}

// ─── The bridge ───

/**
 * Attempts to answer the query via Runtime Core v1.
 * Returns a Pipeline-C-shaped response if Runtime Core has a strong answer.
 * Returns null if the caller should fall through to composeStaircaseAnswer.
 */
export async function tryStaircaseRuntimeBridge(input: TryBridgeInput): Promise<BridgeResponse | null> {
  const { message, conversationId, stage } = input;
  if (typeof message !== "string" || message.trim().length === 0) return null;

  let runtime;
  try {
    runtime = await loadRuntimeCore();
  } catch {
    return null;
  }

  let result: any;
  const rt = runtime.createRuntime();
  try {
    result = rt.handleMessage(message);
  } catch {
    return null;
  }

  // Cycle 2 + Cycle 3A · staircase customer-FAQ retry
  // Retry when the customer intent is text-shaped (design or materials) AND:
  //   (a) Runtime Core failed to route cleanly, OR
  //   (b) Runtime Core routed to Gallery (image-only citations that the
  //       bridge cannot render as text · unless customer explicitly asked
  //       for images, in which case we honour that and let Pipeline C
  //       honestly refuse until Verified Visual Library exists).
  const runtimeCoreFailed = !result || result.mode !== "customer" || !result.plan || result.plan.status !== "ok";
  const routedToGalleryButWantsText =
    result?.plan?.provenance?.strategy === "gallery" && !isExplicitImageRequest(message);
  const shouldRetry =
    (runtimeCoreFailed || routedToGalleryButWantsText)
    && looksLikeStaircaseCustomerFaq(message)
    && !isExplicitImageRequest(message);

  if (shouldRetry) {
    try {
      const retried = rt.handleMessage(CUSTOMER_FAQ_PROBE);
      if (retried && retried.mode === "customer" && retried.plan?.status === "ok"
          && Array.isArray(retried.plan.citations) && retried.plan.citations.length > 0) {
        result = retried;
      }
    } catch {
      // retry failure is silent · falls through to null return below
    }
  }

  if (!result || result.mode !== "customer") return null;
  if (!result.plan) return null;

  const plan = result.plan;
  if (plan.status !== "ok") return null;
  if (!Array.isArray(plan.citations) || plan.citations.length === 0) return null;

  // Cycle 1 fix · rank citations by (match_score + distinctive-token bonus)
  // instead of taking plan.citations[0] unconditionally. Preserves gateway
  // routing for "I need a staircase" while letting more topically-specific
  // articles win when the query names distinctive vocabulary.
  const topCitation = selectBestCitation(result.plan, result.evidence_package, message);
  if (!topCitation || typeof topCitation.path_or_id !== "string") return null;
  const body = readArticleBody(topCitation.path_or_id);
  if (!body || body.length < 40) return null;

  // Build Pipeline-C-shaped response · put the selected citation FIRST
  // so the customer's "Verify · sources" panel matches the answer text.
  const orderedCitations = [
    topCitation,
    ...plan.citations.filter((c: any) => c && c.path_or_id !== topCitation.path_or_id),
  ];
  const bridgedCitations: BridgeCitation[] = orderedCitations.map((c: any) => ({
    module:  String(c.evidenceType ?? "runtime-core"),
    ref_id:  String(c.path_or_id ?? "unknown"),
    snippet: firstNChars(body, 200),
    source:  "runtime-core-v1"
  }));

  return {
    ok:              true,
    answer:          body,
    citations:       bridgedCitations,
    wood_cards:      [],
    visual_intent:   "neutral",
    comparison:      false,
    expertise:       { level: "unknown", confidence: 0.3, signals: [], score: 0 },
    status:          "answered_by_runtime_core",
    brain_versions:  { "staircase:runtime-core-v1": "1.0" },
    presentation:    undefined,
    conversation_id: conversationId,
    stage,
    retrieved_ids:   [],
    runtime_core: {
      strategy:         String(plan.provenance?.strategy ?? "unknown"),
      plan_status:      String(plan.status),
      plan_answer_type: String(plan.answer_type ?? "unknown"),
      plan_confidence:  String(plan.confidence ?? "unknown"),
      router_version:   String(plan.provenance?.router_version ?? "unknown"),
      plan_provenance:  plan.provenance ?? {}
    }
  };
}
