// src/lib/nex-agent/code-engine/capability-evidence-status.ts
//
// NEX1 · Stage 5+10 · Evidence-Status classifier · deterministic · zero LLM.
// Founder-authored principle 2026-09-20: "NEX never converts retrieved
// information into certainty merely because she found it."
//
// This module derives an evidence-status envelope from a completed chat-turn
// result (trace + state). It is called at the API-route boundary so no
// existing chat-turn return site needs modification.
//
// Three levels · high bar for FACT ✓:
//   · confirmed  (🟢 FACT ✓)      · retrieval hit an authoritative source
//   · unconfirmed (🟠 FACT 0)     · retrieval attempted but source is
//                                    unknown-reliability, failed, or
//                                    returned zero / disagreement
//   · own_record (🔵 NEX KNOWS)   · answer derived entirely from NEX's own
//                                    memory / head state / conclusion store
//   · null (no badge)             · pure conversational states with no
//                                    factual claim (clarification, refusal,
//                                    understood, thread_switched)
//
// This is Stage 5 (Evaluate) + Stage 10 (Source & Evidence Presentation).
// Source-reliability registry is deterministic and allowlist-shaped, matching
// the discipline of src/lib/nex/lab/internet-gate.ts.

export type EvidenceLevel = "confirmed" | "unconfirmed" | "own_record";

export interface EvidenceStatus {
  readonly level: EvidenceLevel;
  readonly label: string;
  readonly basis: readonly string[];
  readonly sources: readonly EvidenceSource[];
  readonly disagreements: readonly string[];
}

export interface EvidenceSource {
  readonly kind: "internet" | "postgres" | "internal_file" | "head_state";
  readonly identifier: string;
  readonly reliability: "authoritative" | "established" | "unknown";
  readonly retrieved_at_iso?: string;
  readonly duration_ms?: number;
}

const LABELS: Record<EvidenceLevel, string> = {
  confirmed: "FACT ✓",
  unconfirmed: "FACT 0",
  own_record: "NEX KNOWS",
};

// Deterministic source-reliability registry. Extending this is a GOVERNANCE
// action — never inferred at runtime. Reliability tiers:
//   authoritative — first-party government/OSM/primary-source data on the
//                   internet allowlist, OR NEX-owned Postgres tables
//   established   — internet allowlist sources that are widely used but not
//                   first-party for the claim (e.g. Wikidata for names)
//   unknown       — retrievable but reliability not established
//
// See src/lib/nex/lab/internet-gate.ts for the retrieval allowlist itself.
const SOURCE_RELIABILITY: ReadonlyMap<string, EvidenceSource["reliability"]> = new Map<string, EvidenceSource["reliability"]>([
  ["nominatim.openstreetmap.org", "authoritative"], // OSM primary geodata
  ["overpass-api.de", "authoritative"],             // OSM query interface
  ["query.wikidata.org", "established"],            // Wikidata (community-maintained)
  ["bmkg.go.id", "authoritative"],                  // Indonesian gov meteorology
  ["kemenparekraf.go.id", "authoritative"],         // Indonesian gov tourism
  ["nex.accommodation_business", "authoritative"],  // NEX Postgres table
  ["nex-lab.hq-heartbeat", "authoritative"],        // NEX HQ heartbeat file
  ["nex-lab.hq-alerts", "authoritative"],           // NEX HQ alerts file
  ["nex-lab.harvest-continuous", "authoritative"],  // NEX harvester heartbeat
  ["nex-lab.walker-health", "authoritative"],       // NEX walker health files
]);

/** Compute an evidence-status envelope from a completed chat-turn result.
 *  Deterministic · reads trace lines to detect which retrieval / recall
 *  handlers fired. Never mutates the input. */
export function computeEvidenceStatus(args: {
  readonly state: string;
  readonly trace: readonly string[];
  readonly response_text: string;
}): EvidenceStatus | null {
  const { state, trace, response_text } = args;

  // Pure-conversational states never carry a fact badge — no claim is being
  // made. This includes clarification_required (asking for detail), refused
  // (declining), thread_switched, bind_acknowledged, understood (planning
  // an action but not yet reporting a fact).
  const NON_FACTUAL_STATES = new Set([
    "clarification_required",
    "refused",
    "thread_switched",
    "thread_returned",
    "bind_acknowledged",
    "understood",
  ]);
  if (NON_FACTUAL_STATES.has(state)) return null;

  const sources: EvidenceSource[] = [];
  const basis: string[] = [];
  const disagreements: string[] = [];

  // ── Internet retrieval detection (Stage 4 → Stage 5 hookup) ─────────
  const nominatimTrace = trace.find((l) => /place_lookup · nominatim · results=(\d+)/i.test(l));
  if (nominatimTrace) {
    const results = Number((nominatimTrace.match(/results=(\d+)/) ?? [])[1] ?? 0);
    const duration = Number((nominatimTrace.match(/duration_ms=(\d+)/) ?? [])[1] ?? 0);
    sources.push({
      kind: "internet",
      identifier: "nominatim.openstreetmap.org",
      reliability: SOURCE_RELIABILITY.get("nominatim.openstreetmap.org") ?? "unknown",
      retrieved_at_iso: new Date().toISOString(),
      duration_ms: duration,
    });
    basis.push(`Nominatim OSM returned ${results} result(s) in ${duration}ms`);
    if (results > 1) {
      disagreements.push(`Nominatim returned ${results} candidate matches — top match used, alternatives available`);
    }
  }
  const nominatimZero = trace.some((l) => /place_lookup · nominatim · zero results/i.test(l));
  if (nominatimZero) {
    sources.push({
      kind: "internet",
      identifier: "nominatim.openstreetmap.org",
      reliability: "authoritative",
      retrieved_at_iso: new Date().toISOString(),
    });
    basis.push("Nominatim query succeeded but returned zero results");
  }
  const nominatimError = trace.some((l) => /place_lookup · nominatim · status=\d+/i.test(l) && !nominatimTrace);
  if (nominatimError) {
    sources.push({
      kind: "internet",
      identifier: "nominatim.openstreetmap.org",
      reliability: "authoritative",
    });
    basis.push("Nominatim query returned an HTTP error");
  }

  // ── Wave B · Multi-source lookup (Stage 4 → 5 · Retrieval → Evidence
  // → Evaluation chain). Detects parallel Nominatim + Wikidata queries
  // and threads their agreement/disagreement into the evidence envelope.
  // Verdict AGREE + both authoritative → confirmed. PARTIAL/CONFLICT →
  // unconfirmed with disagreement enumeration. INSUFFICIENT → unconfirmed.
  const multiNomTrace = trace.find((l) => /multi_source_lookup · nominatim · lat=/i.test(l));
  const multiWdTrace = trace.find((l) => /multi_source_lookup · wikidata · lat=/i.test(l));
  const multiOvTrace = trace.find((l) => /multi_source_lookup · overpass · lat=/i.test(l));
  const multiEvalTrace = trace.find((l) => /multi_source_lookup · evaluation · .*verdict=/i.test(l));
  if (multiNomTrace) {
    const dur = Number((multiNomTrace.match(/duration_ms=(\d+)/) ?? [])[1] ?? 0);
    sources.push({ kind: "internet", identifier: "nominatim.openstreetmap.org", reliability: "authoritative", retrieved_at_iso: new Date().toISOString(), duration_ms: dur });
    basis.push(`Nominatim (OSM) returned coordinates`);
  }
  if (multiWdTrace) {
    const dur = Number((multiWdTrace.match(/duration_ms=(\d+)/) ?? [])[1] ?? 0);
    sources.push({ kind: "internet", identifier: "query.wikidata.org", reliability: SOURCE_RELIABILITY.get("query.wikidata.org") ?? "unknown", retrieved_at_iso: new Date().toISOString(), duration_ms: dur });
    basis.push(`Wikidata returned coordinate claim`);
  }
  if (multiOvTrace) {
    const dur = Number((multiOvTrace.match(/duration_ms=(\d+)/) ?? [])[1] ?? 0);
    sources.push({ kind: "internet", identifier: "overpass-api.de", reliability: SOURCE_RELIABILITY.get("overpass-api.de") ?? "authoritative", retrieved_at_iso: new Date().toISOString(), duration_ms: dur });
    basis.push(`Overpass (OSM node) returned coordinates`);
  }
  if (multiEvalTrace) {
    const verdict = (multiEvalTrace.match(/verdict=(AGREE|PARTIAL|CONFLICT|INSUFFICIENT)/) ?? [])[1] ?? "INSUFFICIENT";
    const distKm = (multiEvalTrace.match(/distance_km=([\d.]+)/) ?? [])[1] ?? null;
    basis.push(`Multi-source verdict: ${verdict}${distKm ? ` · ${distKm}km between sources` : ""}`);
    if (verdict === "PARTIAL" || verdict === "CONFLICT") {
      disagreements.push(`Nominatim and Wikidata coordinate claims differ${distKm ? ` by ~${distKm}km` : ""} — ${verdict === "CONFLICT" ? "conflict" : "partial disagreement"} exposed, no silent selection`);
    } else if (verdict === "INSUFFICIENT") {
      disagreements.push("Multi-source verdict INSUFFICIENT — at least one source did not return a coordinate");
    }
  }

  // ── K15 · BMKG weather retrieval (Stage 4 · external allowlisted source).
  // Detects handler in capability-chat-turn.ts weather_lookup RecallKind
  // (see 2026-09-21). "ok" = successful forecast · "http_" / "threw" /
  // "empty_forecast" = failure · "place_not_in_map" = honest degradation.
  const weatherOk = trace.find((l) => /weather_lookup · bmkg · ok · /i.test(l));
  const weatherHttpErr = trace.find((l) => /weather_lookup · bmkg · http_\d+ · /i.test(l));
  const weatherThrew = trace.find((l) => /weather_lookup · bmkg · threw · /i.test(l));
  const weatherEmpty = trace.find((l) => /weather_lookup · bmkg · empty_forecast · /i.test(l));
  const weatherNotMapped = trace.find((l) => /weather_lookup · place_not_in_map · /i.test(l));
  if (weatherOk) {
    const dur = Number((weatherOk.match(/duration_ms=(\d+)/) ?? [])[1] ?? 0);
    sources.push({
      kind: "internet",
      identifier: "bmkg.go.id",
      reliability: SOURCE_RELIABILITY.get("bmkg.go.id") ?? "authoritative",
      retrieved_at_iso: new Date().toISOString(),
      duration_ms: dur,
    });
    basis.push(`BMKG (Indonesian gov meteorology) returned a forecast in ${dur}ms`);
  } else if (weatherHttpErr || weatherThrew || weatherEmpty) {
    sources.push({
      kind: "internet",
      identifier: "bmkg.go.id",
      reliability: SOURCE_RELIABILITY.get("bmkg.go.id") ?? "authoritative",
    });
    if (weatherHttpErr) {
      const status = (weatherHttpErr.match(/http_(\d+)/) ?? [])[1] ?? "??";
      basis.push(`BMKG query returned HTTP ${status}`);
      disagreements.push(`BMKG weather forecast unavailable (HTTP ${status}) — no forecast can be reported`);
    } else if (weatherThrew) {
      basis.push("BMKG query threw a network error");
      disagreements.push("BMKG weather forecast unavailable (network error) — no forecast can be reported");
    } else {
      basis.push("BMKG returned data but forecast timeslot could not be parsed");
      disagreements.push("BMKG response shape may have changed — no immediate forecast could be extracted");
    }
  }
  if (weatherNotMapped) {
    // Honest degradation, not a source; noted in basis to make the
    // reasoning visible in the envelope for auditability.
    basis.push("weather_lookup requested place is not in curated adm4 map — declined without fabrication");
  }

  // ── Postgres accommodation lookup (Stage 4 · internal DB) ────────────
  const accommodationTrace = trace.find((l) => /accommodation.*(?:count|rows)|nex\.accommodation_business/i.test(l));
  if (accommodationTrace) {
    sources.push({
      kind: "postgres",
      identifier: "nex.accommodation_business",
      reliability: SOURCE_RELIABILITY.get("nex.accommodation_business") ?? "unknown",
      retrieved_at_iso: new Date().toISOString(),
    });
    basis.push("nex.accommodation_business Postgres table queried directly");
  }

  // ── Internal NEX state files (HQ / walker / master) ─────────────────
  const hqTrace = trace.some((l) => /hq status · latestHb=true/i.test(l));
  const masterTrace = trace.some((l) => /master_status · aggregated_parts=/i.test(l));
  const walkerTrace = trace.some((l) => /worker_health · endpoints=/i.test(l));
  if (hqTrace) {
    sources.push({ kind: "internal_file", identifier: "nex-lab.hq-heartbeat", reliability: "authoritative" });
    basis.push("HQ heartbeat file read");
  }
  if (walkerTrace) {
    sources.push({ kind: "internal_file", identifier: "nex-lab.walker-health", reliability: "authoritative" });
    basis.push("walker health files read");
  }
  if (masterTrace) {
    sources.push({ kind: "internal_file", identifier: "nex-lab.hq-heartbeat", reliability: "authoritative" });
    sources.push({ kind: "internal_file", identifier: "nex-lab.walker-health", reliability: "authoritative" });
    basis.push("master aggregation across HQ + walker + harvester + Postgres");
  }

  // ── Recall / head-state derivation (Stage 2 memory) ──────────────────
  // Phase 6 · F10 fix · 2026-09-21.
  //
  // Prior behaviour: any recall_* state with zero external sources was
  // stamped as head_state · authoritative · own_record ("NEX KNOWS").
  // The Phase-6 audit caught this producing a FALSE-AUTHORITATIVE badge
  // on empty state — e.g. a domain-router legal-refusal for "How hot
  // will it be" was labelled NEX KNOWS despite the head having zero
  // supporting record.
  //
  // Corrected doctrine: only stamp `head_state · authoritative` when
  // the recall kind is one that legitimately queries internal state
  // (findings, decisions, mutations, verifications, prior investigation
  // outcomes, capability registry, chat history search, HQ/worker
  // status reads). Domain-routed responses, weather/coord retrievals
  // that failed, and specialist boundary refusals must NOT synthesise
  // a head_state source · they degrade honestly to null-badge or
  // unconfirmed.
  const recallKind = trace.find((l) => /^recall intent · kind=/.test(l));
  const kindMatch = recallKind?.match(/kind=([a-z_]+)/i);
  const kind = kindMatch?.[1] ?? "";
  const isRecallState = state.startsWith("recall_");
  // Bounded allowlist of recall kinds that legitimately derive their
  // answer from internal NEX state. Adding a kind here is a governance
  // action (deliberately conservative).
  const HEAD_STATE_LEGITIMATE_KINDS: ReadonlySet<string> = new Set([
    "what_did_you_find",
    "what_changed",
    "which_file",
    "which_function",
    "what_was_the_first",
    "what_was_the_original",
    "what_did_i_call",
    "what_did_we_decide",
    "did_it_work",
    "reasoning_explanation",
    "reasoning_compare",
    "reasoning_hypothesise",
    "reasoning_counter",
    "chat_history_search",
    "capability_availability",
    "hq_status",
    "worker_health",
    "master_status",
    "opinion_request",
    "epistemic_challenge",
    "plan_request",
  ]);
  const isMemoryDerivation =
    isRecallState && sources.length === 0 && HEAD_STATE_LEGITIMATE_KINDS.has(kind);
  if (isMemoryDerivation) {
    sources.push({ kind: "head_state", identifier: "conversation_head", reliability: "authoritative" });
    basis.push(`answer derived from head state · recall kind=${kind}`);
  }

  // ── Level classification ─────────────────────────────────────────────
  // FACT ✓ requires at least one authoritative source AND no unresolved
  // disagreement AND at least one basis line. Bar is intentionally high.
  const hasAuthoritative = sources.some((s) => s.reliability === "authoritative");
  const hasOnlyHeadState = sources.length > 0 && sources.every((s) => s.kind === "head_state");
  const hasDisagreement = disagreements.length > 0;
  const hasUnknownReliability = sources.some((s) => s.reliability === "unknown");
  const retrievalFailed = basis.some((b) => /zero results|HTTP error/i.test(b));

  let level: EvidenceLevel;
  if (hasOnlyHeadState) {
    level = "own_record";
  } else if (hasAuthoritative && !hasDisagreement && !hasUnknownReliability && !retrievalFailed) {
    level = "confirmed";
  } else {
    level = "unconfirmed";
  }

  if (sources.length === 0) return null; // no factual basis to badge

  return {
    level,
    label: LABELS[level],
    basis,
    sources,
    disagreements,
  };
}
