// src/lib/nex/discovery/discovery-orchestrator.ts
//
// UWI · Wave 3.3 · Discovery orchestrator · chains the 10-stage acceptance path
// Founder-authorised programme.
//
// **Founder-locked acceptance chain** (must be provable end-to-end):
//   1. discover
//   2. obey robots (HARD GATE)
//   3. schedule politely
//   4. fetch
//   5. detect unchanged content
//   6. extract
//   7. normalise
//   8. preserve provenance
//   9. produce evidence
//  10. handle failures first-class (10 classes)
//
// This orchestrator is the ONLY sanctioned entry point for a full-chain
// discovery+fetch cycle. Any caller that skips a step is a governance
// violation. There is intentionally no "fast path" that bypasses robots
// or politeness — those are hard gates.

import {
  type CanonicalUrl,
  type DiscoveryFailure,
  type DiscoveryRequest,
  type EvidenceRecord,
  type Jurisdiction,
} from "./types";
import { canonicalise } from "./url-canonicalisation";
import { evaluate as evaluateRobots, NEX_USER_AGENT } from "./robots-gate";
import { PolitenessScheduler, DEFAULT_POLITENESS, PolitenessDeadlineExceededError } from "./politeness-scheduler";
import {
  conditionalFetch,
  FreshnessIndex,
  DEFAULT_CONDITIONAL_FETCH,
  RedirectChainExceededError,
  ConditionalFetchTimeoutError,
} from "./conditional-fetch";
import { extractContent, DEFAULT_EXTRACTOR } from "./content-extractor";
import { buildEvidenceRecord, withProvenanceStage, withExtraction, withFailure } from "./evidence-record";
import { UrlDedupLedger } from "./url-canonicalisation";

export interface OrchestratorDeps {
  freshness: FreshnessIndex;
  politeness: PolitenessScheduler;
  dedup: UrlDedupLedger;
  raw_fetcher?: (url: string, init: RequestInit) => Promise<Response>;
  robots_fetcher?: (url: string) => Promise<{ status: number; text: string } | null>;
  user_agent?: string;
  now?: () => number;
}

export interface DiscoveryResult {
  ok: boolean;
  evidence: EvidenceRecord;
  body_text: string | null;
}

/** Global default jurisdiction (GLOBAL · RFC 9309 · robots hard gate on). */
export const GLOBAL_JURISDICTION: Jurisdiction = {
  code: "GLOBAL",
  robots_hard_gate: true,
  tdm_opt_out_respected: true,
  gdpr_scope: false,
  ccpa_scope: false,
  copyright_regime: "berne",
};

/** Discovery + fetch + extract pipeline · one URL · full 10-stage chain. */
export async function discoverAndFetch(
  request: DiscoveryRequest,
  deps: OrchestratorDeps,
): Promise<DiscoveryResult> {
  const user_agent = deps.user_agent ?? NEX_USER_AGENT;
  const now = deps.now ?? Date.now;
  const now_iso = () => new Date(now()).toISOString();

  // Stage 1 · discover (canonicalise the seed URL)
  let url: CanonicalUrl;
  try {
    url = canonicalise(request.seed_url);
  } catch (e: any) {
    // Malformed URL is a first-class failure
    const failure: DiscoveryFailure = {
      failure_class: "malformed_html_or_xml", // subclass — URL malformed
      url: { raw: request.seed_url, normalised: request.seed_url, host: "?", canonical_key: "?" },
      detail: `unparseable seed URL: ${e?.message ?? String(e)}`,
      ts_iso: now_iso(),
    };
    return {
      ok: false,
      evidence: withFailure(
        buildEvidenceRecord({
          workflow_id: request.workflow_id,
          activity_name: request.activity_name,
          attempt_id: request.attempt_id,
          target_url: failure.url,
          source_class: "unknown",
          robots_decision: { allow: false, reason: "url unparseable · no host to evaluate", matched_rule: null },
          politeness: { scheduled_at_ms: now(), waited_ms: 0, source: "none" },
          fetched_at_iso: now_iso(),
        }),
        failure,
      ),
      body_text: null,
    };
  }

  // Stage 1b · dedup check
  const dedup_check = deps.dedup.register(url, now_iso());
  if (dedup_check.duplicate) {
    const failure: DiscoveryFailure = {
      failure_class: "duplicate_url",
      url,
      detail: `URL already visited (first_seen=${dedup_check.first_seen_iso})`,
      ts_iso: now_iso(),
    };
    return {
      ok: false,
      evidence: withFailure(
        buildEvidenceRecord({
          workflow_id: request.workflow_id,
          activity_name: request.activity_name,
          attempt_id: request.attempt_id,
          target_url: url,
          source_class: url.host,
          robots_decision: { allow: true, crawl_delay_ms: null, matched_group: null }, // not evaluated
          politeness: { scheduled_at_ms: now(), waited_ms: 0, source: "none" },
          fetched_at_iso: now_iso(),
        }),
        failure,
      ),
      body_text: null,
    };
  }

  // Stage 2 · robots HARD GATE
  const robots_decision = await evaluateRobots(url, user_agent, deps.robots_fetcher, now());
  if (!robots_decision.allow) {
    const failure: DiscoveryFailure = {
      failure_class: "robots_denied",
      url,
      detail: robots_decision.reason,
      ts_iso: now_iso(),
    };
    return {
      ok: false,
      evidence: withFailure(
        buildEvidenceRecord({
          workflow_id: request.workflow_id,
          activity_name: request.activity_name,
          attempt_id: request.attempt_id,
          target_url: url,
          source_class: url.host,
          robots_decision,
          politeness: { scheduled_at_ms: now(), waited_ms: 0, source: "none" },
          fetched_at_iso: now_iso(),
        }),
        failure,
      ),
      body_text: null,
    };
  }

  // Stage 3 · politeness schedule (token bucket + crawl-delay)
  let politeness_outcome;
  try {
    politeness_outcome = await deps.politeness.schedule(url, robots_decision.crawl_delay_ms);
  } catch (e: any) {
    const is_pol_deadline = e instanceof PolitenessDeadlineExceededError;
    const failure: DiscoveryFailure = {
      failure_class: is_pol_deadline ? "rate_limited" : "source_unavailable",
      url,
      detail: e?.message ?? String(e),
      ts_iso: now_iso(),
    };
    return {
      ok: false,
      evidence: withFailure(
        buildEvidenceRecord({
          workflow_id: request.workflow_id,
          activity_name: request.activity_name,
          attempt_id: request.attempt_id,
          target_url: url,
          source_class: url.host,
          robots_decision,
          politeness: { scheduled_at_ms: now(), waited_ms: 0, source: "none" },
          fetched_at_iso: now_iso(),
        }),
        failure,
      ),
      body_text: null,
    };
  }

  // Stage 4-5 · conditional fetch (detect unchanged content via ETag / hash)
  let fetch_outcome;
  try {
    fetch_outcome = await conditionalFetch(
      url,
      deps.freshness,
      user_agent,
      DEFAULT_CONDITIONAL_FETCH,
      now,
      deps.raw_fetcher,
    );
  } catch (e: any) {
    let failure_class: DiscoveryFailure["failure_class"];
    if (e instanceof RedirectChainExceededError) failure_class = "redirect_chain_exceeded";
    else if (e instanceof ConditionalFetchTimeoutError) failure_class = "timeout";
    else failure_class = "source_unavailable";
    const failure: DiscoveryFailure = {
      failure_class,
      url,
      detail: e?.message ?? String(e),
      ts_iso: now_iso(),
    };
    return {
      ok: false,
      evidence: withFailure(
        buildEvidenceRecord({
          workflow_id: request.workflow_id,
          activity_name: request.activity_name,
          attempt_id: request.attempt_id,
          target_url: url,
          source_class: url.host,
          robots_decision,
          politeness: politeness_outcome,
          fetched_at_iso: now_iso(),
        }),
        failure,
      ),
      body_text: null,
    };
  }

  // Canonical-changed detection: if the final URL differs from seed after
  // redirects, surface it as a first-class signal (not a failure, but recorded).
  const canonical_changed = fetch_outcome.final_url.canonical_key !== url.canonical_key;

  // Rate-limited response
  if (fetch_outcome.status === 429) {
    const failure: DiscoveryFailure = {
      failure_class: "rate_limited",
      url: fetch_outcome.final_url,
      detail: `HTTP 429 · Retry-After: ${fetch_outcome.headers["retry-after"] ?? "unspecified"}`,
      ts_iso: now_iso(),
    };
    return {
      ok: false,
      evidence: withFailure(
        buildEvidenceRecord({
          workflow_id: request.workflow_id,
          activity_name: request.activity_name,
          attempt_id: request.attempt_id,
          target_url: fetch_outcome.final_url,
          source_class: fetch_outcome.final_url.host,
          robots_decision,
          politeness: politeness_outcome,
          fetched_at_iso: fetch_outcome.freshness_snapshot.last_fetched_iso,
          content_type: fetch_outcome.headers["content-type"] ?? null,
          content_length: fetch_outcome.headers["content-length"] ? Number.parseInt(fetch_outcome.headers["content-length"], 10) : null,
          content_hash_sha256: fetch_outcome.freshness_snapshot.content_hash,
          headers: fetch_outcome.headers,
        }),
        failure,
      ),
      body_text: null,
    };
  }

  // Non-2xx (excluding 304 which is handled below) surfaces as source_unavailable.
  // MUST be checked before !changed branch — 503 is unchanged (no body) but is a failure, not a 304 signal.
  if ((fetch_outcome.status < 200 || fetch_outcome.status >= 300) && fetch_outcome.status !== 304) {
    const failure: DiscoveryFailure = {
      failure_class: "source_unavailable",
      url: fetch_outcome.final_url,
      detail: `HTTP ${fetch_outcome.status}`,
      ts_iso: now_iso(),
    };
    return {
      ok: false,
      evidence: withFailure(
        buildEvidenceRecord({
          workflow_id: request.workflow_id,
          activity_name: request.activity_name,
          attempt_id: request.attempt_id,
          target_url: fetch_outcome.final_url,
          source_class: fetch_outcome.final_url.host,
          robots_decision,
          politeness: politeness_outcome,
          fetched_at_iso: fetch_outcome.freshness_snapshot.last_fetched_iso,
          content_type: fetch_outcome.headers["content-type"] ?? null,
          content_length: fetch_outcome.headers["content-length"] ? Number.parseInt(fetch_outcome.headers["content-length"], 10) : null,
          content_hash_sha256: fetch_outcome.freshness_snapshot.content_hash,
          headers: fetch_outcome.headers,
        }),
        failure,
      ),
      body_text: null,
    };
  }

  // 304 or content-hash-unchanged is a first-class outcome, not a failure.
  if (!fetch_outcome.changed) {
    const soft_signal: DiscoveryFailure = {
      failure_class: "not_modified_304",
      url: fetch_outcome.final_url,
      detail: fetch_outcome.status === 304
        ? "HTTP 304 Not Modified (ETag / If-Modified-Since)"
        : "content-hash unchanged since last fetch",
      ts_iso: now_iso(),
    };
    let evidence = buildEvidenceRecord({
      workflow_id: request.workflow_id,
      activity_name: request.activity_name,
      attempt_id: request.attempt_id,
      target_url: fetch_outcome.final_url,
      source_class: fetch_outcome.final_url.host,
      robots_decision,
      politeness: politeness_outcome,
      fetched_at_iso: fetch_outcome.freshness_snapshot.last_fetched_iso,
      content_type: fetch_outcome.headers["content-type"] ?? null,
      content_length: fetch_outcome.headers["content-length"] ? Number.parseInt(fetch_outcome.headers["content-length"], 10) : null,
      content_hash_sha256: fetch_outcome.freshness_snapshot.content_hash,
      headers: fetch_outcome.headers,
      record_type: "revisit",
    });
    evidence = withFailure(evidence, soft_signal);
    deps.dedup.markFetched(fetch_outcome.final_url);
    return { ok: true, evidence, body_text: null };
  }

  // Stage 6-7 · extract + normalise (only if body was fetched)
  const body_bytes = fetch_outcome.bytes!;
  const html = new TextDecoder("utf-8", { fatal: false }).decode(body_bytes);
  const extraction = await extractContent(html, fetch_outcome.final_url.normalised, DEFAULT_EXTRACTOR);

  // Stage 8-9 · assemble evidence with full provenance chain
  const provenance_chain = [
    { stage: "canonicalise", at_iso: now_iso(), detail: canonical_changed ? `canonical_changed: ${url.canonical_key} → ${fetch_outcome.final_url.canonical_key}` : "identity" },
    { stage: "robots_hard_gate", at_iso: now_iso(), detail: robots_decision.allow ? "allowed" : "denied" },
    { stage: "politeness_schedule", at_iso: now_iso(), detail: `waited=${politeness_outcome.waited_ms}ms · source=${politeness_outcome.source}` },
    { stage: "conditional_fetch", at_iso: now_iso(), detail: `status=${fetch_outcome.status} · redirects=${fetch_outcome.redirects.length}` },
    { stage: "extract_normalise", at_iso: now_iso(), detail: `quality=${extraction.extraction_quality}` },
  ];

  let evidence = buildEvidenceRecord({
    workflow_id: request.workflow_id,
    activity_name: request.activity_name,
    attempt_id: request.attempt_id,
    target_url: fetch_outcome.final_url,
    source_class: fetch_outcome.final_url.host,
    robots_decision,
    politeness: politeness_outcome,
    fetched_at_iso: fetch_outcome.freshness_snapshot.last_fetched_iso,
    content_type: fetch_outcome.headers["content-type"] ?? null,
    content_length: body_bytes.length,
    content_hash_sha256: fetch_outcome.freshness_snapshot.content_hash,
    headers: fetch_outcome.headers,
    provenance_chain,
  });
  evidence = withExtraction(evidence, extraction);

  // Partial extraction is a first-class failure signal (record but ok:true)
  if (extraction.extraction_quality === "partial" || extraction.extraction_quality === "empty") {
    evidence = withFailure(evidence, {
      failure_class: "partial_extraction",
      url: fetch_outcome.final_url,
      detail: `extraction quality: ${extraction.extraction_quality}; warnings: ${extraction.warnings.join(" | ")}`,
      ts_iso: now_iso(),
    });
  }

  deps.dedup.markFetched(fetch_outcome.final_url);

  return {
    ok: extraction.ok,
    evidence,
    body_text: extraction.main_text ?? null,
  };
}

// Re-export the primitives for callers that want direct access
export { GLOBAL_JURISDICTION as DefaultJurisdiction };
