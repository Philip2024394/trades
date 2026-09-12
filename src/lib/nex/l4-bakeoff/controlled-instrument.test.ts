// src/lib/nex/l4-bakeoff/controlled-instrument.test.ts
//
// V.5.4.2 · CONTROLLED INSTRUMENT RUNNER · contract tests
// Founder BEGIN V.5.4 · 2026-09-08
//
// Every one of the 12 §11 non-negotiable requirements has its own
// refusal-path test. Plus a positive path using the SyntheticAdapter
// which runs entirely in-process (NEVER contacts Ollama · never
// contacts any external service).
//
// Requirement matrix:
//   R0  · founder_authorization_id
//   R1  · pinned_model_tag
//   R2  · sampling pinned (temperature/top_p/top_k/max_tokens)
//   R3  · system_prompt_slot + hash (+ hash-vs-text cross-check)
//   R4  · corpus_version (+ mismatch cross-check)
//   R5  · seed captured + deterministic present
//   R6  · hardware_identifier (not auto-detected)
//   R7  · runtime_identifier (not auto-detected)
//   R8  · reproducibility attestation (already_verified OR first_run)
//   R9  · require_sentinel_pre_post literal true
//   R10 · transcript_sink present with sink_id/write/pointer
//   R11 · paid_provider_used explicit (+ identity cross-check)
//   R12 · mode literal "controlled_instrument"
//
// Positive path proves: full pipeline runs · sentinels present ·
// transcripts written to sink · provenance captured.

import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  runControlledInstrument,
  validateControlledInstrumentAuthorization,
  validateRoundInvariance,
  InMemoryTranscriptSink,
  detectForbiddenV54Vocabulary,
  type ControlledInstrumentAuthorization,
  type ControlledSampling,
  type ReproducibilityAttestation,
} from "./controlled-instrument";
import { freezeBenchmark } from "./benchmark-schema";
import { makeSyntheticAdapter } from "./synthetic-adapter";
import type { BenchmarkCase } from "./types";

// ─── test corpus (2 cases · tiny · in-process) ──────────────────────

const TEST_CORPUS_VERSION = "test-controlled-instrument-corpus-v1";
const TEST_CASES: BenchmarkCase[] = [
  {
    case_id: "ci_test_1",
    corpus_version: TEST_CORPUS_VERSION,
    dimension: "natural_conversation",
    category: "positive",
    language: "en",
    difficulty: "easy",
    prompt: "Say hello briefly.",
    scoring_rubric: { must_contain: ["hello"] },
    authored_by: "test",
    authored_at_iso: "2026-09-08T00:00:00Z",
  },
  {
    case_id: "ci_test_2",
    corpus_version: TEST_CORPUS_VERSION,
    dimension: "instruction_following",
    category: "positive",
    language: "en",
    difficulty: "easy",
    prompt: "Respond with exactly one word.",
    scoring_rubric: { max_response_chars: 500 },
    authored_by: "test",
    authored_at_iso: "2026-09-08T00:00:00Z",
  },
];
const TEST_CORPUS = freezeBenchmark({
  version: TEST_CORPUS_VERSION,
  authored_by: "test",
  authored_at_iso: "2026-09-08T00:00:00Z",
  cases: TEST_CASES,
});

// ─── canonical fully-pinned authorization (mutated per test) ────────

const SYSTEM_PROMPT_TEXT = "You are NEX. Respond warmly and briefly.";
const SYSTEM_PROMPT_HASH = createHash("sha256").update(SYSTEM_PROMPT_TEXT, "utf8").digest("hex").slice(0, 24);

function canonicalSampling(): ControlledSampling {
  return { temperature: 0.7, top_p: 0.9, top_k: 40, max_tokens: 256, seed: 42 };
}

function canonicalReproducibility(): ReproducibilityAttestation {
  return {
    kind: "first_run_pending_reverify",
    first_run: true,
    pending_reverify_commitment: "will re-run within 7 days in a fresh Node process AND diff transcripts byte-identical",
  };
}

function canonicalAuth(): ControlledInstrumentAuthorization {
  return {
    founder_authorization_id: "founder_auth_test_20260908_001",
    mode: "controlled_instrument",
    pinned_model_tag: "synth-personality:always_frontier",
    sampling: canonicalSampling(),
    system_prompt_slot: "test_slot_v1",
    system_prompt_hash: SYSTEM_PROMPT_HASH,
    corpus_version: TEST_CORPUS_VERSION,
    deterministic: true,
    hardware_identifier: "test:in-process-node",
    runtime_identifier: "vitest-in-memory",
    reproducibility: canonicalReproducibility(),
    require_sentinel_pre_post: true,
    transcript_sink: new InMemoryTranscriptSink("test_sink"),
    paid_provider_used: false,
    measurement_tier: "raw_model",
  };
}

// ═══════════════════════════════════════════════════════════════════
// § VALIDATOR · 12 REFUSAL PATHS
// ═══════════════════════════════════════════════════════════════════

describe("V.5.4.2 · controlled-instrument · validator refuses each missing requirement", () => {

  it("R0 refuses when founder_authorization_id is empty", () => {
    const a = canonicalAuth();
    a.founder_authorization_id = "";
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.requirement_id).toBe("R0_founder_authorization_id");
  });

  it("R12 refuses when mode is 'smoke_test'", () => {
    const a = canonicalAuth();
    a.mode = "smoke_test";
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.requirement_id).toBe("R12_mode_literal");
  });

  it("R12 refuses when mode is 'sanity_check'", () => {
    const a = canonicalAuth();
    a.mode = "sanity_check";
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.requirement_id).toBe("R12_mode_literal");
  });

  it("R12 refuses when mode is 'spin_it_up'", () => {
    const a = canonicalAuth();
    a.mode = "spin_it_up";
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.requirement_id).toBe("R12_mode_literal");
  });

  it("R1 refuses when pinned_model_tag is empty", () => {
    const a = canonicalAuth();
    a.pinned_model_tag = "";
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.requirement_id).toBe("R1_pinned_model_tag");
  });

  it("R2 refuses when sampling.temperature is undefined", () => {
    const a = canonicalAuth();
    // deliberately reintroduce an undefined field to test the guard
    (a.sampling as unknown as Record<string, unknown>).temperature = undefined;
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.requirement_id).toBe("R2_sampling_pinned");
  });

  it("R2 refuses when sampling.max_tokens is undefined", () => {
    const a = canonicalAuth();
    (a.sampling as unknown as Record<string, unknown>).max_tokens = undefined;
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.requirement_id).toBe("R2_sampling_pinned");
  });

  it("R2 refuses when sampling itself is null", () => {
    const a = canonicalAuth();
    (a as unknown as Record<string, unknown>).sampling = null;
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.requirement_id).toBe("R2_sampling_pinned");
  });

  it("R5 refuses when sampling.seed is undefined", () => {
    const a = canonicalAuth();
    (a.sampling as unknown as Record<string, unknown>).seed = undefined;
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.requirement_id).toBe("R5_seed_or_deterministic_null");
  });

  it("R5 refuses when deterministic is undefined (must be true/false/null explicitly)", () => {
    const a = canonicalAuth();
    (a as unknown as Record<string, unknown>).deterministic = undefined;
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.requirement_id).toBe("R5_seed_or_deterministic_null");
  });

  it("R5 accepts sampling.seed = 'unspecified' (explicit acknowledgement · honest)", () => {
    const a = canonicalAuth();
    a.sampling.seed = "unspecified";
    a.deterministic = null;
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(true);
  });

  it("R3 refuses when system_prompt_slot is empty", () => {
    const a = canonicalAuth();
    a.system_prompt_slot = "";
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.requirement_id).toBe("R3_system_prompt_slot_hash");
  });

  it("R3 refuses when system_prompt_hash is empty", () => {
    const a = canonicalAuth();
    a.system_prompt_hash = "";
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.requirement_id).toBe("R3_system_prompt_slot_hash");
  });

  it("R3 refuses when system_prompt_hash is not 24-hex", () => {
    const a = canonicalAuth();
    a.system_prompt_hash = "not-a-hash";
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.requirement_id).toBe("R3_system_prompt_slot_hash");
  });

  it("R4 refuses when corpus_version is empty", () => {
    const a = canonicalAuth();
    a.corpus_version = "";
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.requirement_id).toBe("R4_corpus_version");
  });

  it("R6 refuses when hardware_identifier is empty", () => {
    const a = canonicalAuth();
    a.hardware_identifier = "";
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.requirement_id).toBe("R6_hardware_identifier");
  });

  it("R6 refuses when hardware_identifier is 'auto-detect' (vague)", () => {
    const a = canonicalAuth();
    a.hardware_identifier = "auto-detect";
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.requirement_id).toBe("R6_hardware_identifier");
  });

  it("R7 refuses when runtime_identifier is empty", () => {
    const a = canonicalAuth();
    a.runtime_identifier = "";
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.requirement_id).toBe("R7_runtime_identifier");
  });

  it("R7 refuses when runtime_identifier is 'auto' (vague)", () => {
    const a = canonicalAuth();
    a.runtime_identifier = "auto";
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.requirement_id).toBe("R7_runtime_identifier");
  });

  it("R8 refuses when reproducibility is null", () => {
    const a = canonicalAuth();
    (a as unknown as Record<string, unknown>).reproducibility = null;
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.requirement_id).toBe("R8_reproducibility_attestation");
  });

  it("R8 refuses when reproducibility.kind is unknown", () => {
    const a = canonicalAuth();
    (a as unknown as Record<string, unknown>).reproducibility = { kind: "yolo" };
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.requirement_id).toBe("R8_reproducibility_attestation");
  });

  it("R8 refuses first_run_pending_reverify with short commitment (<40 chars)", () => {
    const a = canonicalAuth();
    a.reproducibility = {
      kind: "first_run_pending_reverify",
      first_run: true,
      pending_reverify_commitment: "will re-run",  // too short
    };
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.requirement_id).toBe("R8_reproducibility_attestation");
  });

  it("R8 accepts already_verified with both fields", () => {
    const a = canonicalAuth();
    a.reproducibility = {
      kind: "already_verified",
      verified_at_iso: "2026-09-08T00:00:00Z",
      earlier_run_id: "l4run_test_earlier_001",
    };
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(true);
  });

  it("R9 refuses when require_sentinel_pre_post is not literal true", () => {
    const a = canonicalAuth();
    (a as unknown as Record<string, unknown>).require_sentinel_pre_post = false;
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.requirement_id).toBe("R9_sentinel_flag");
  });

  it("R10 refuses when transcript_sink is null", () => {
    const a = canonicalAuth();
    (a as unknown as Record<string, unknown>).transcript_sink = null;
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.requirement_id).toBe("R10_transcript_sink");
  });

  it("R10 refuses when transcript_sink lacks write() function", () => {
    const a = canonicalAuth();
    (a as unknown as Record<string, unknown>).transcript_sink = { sink_id: "x", pointer: () => "" };
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.requirement_id).toBe("R10_transcript_sink");
  });

  it("R11 refuses when paid_provider_used is not boolean", () => {
    const a = canonicalAuth();
    (a as unknown as Record<string, unknown>).paid_provider_used = undefined;
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.requirement_id).toBe("R11_paid_provider_declaration");
  });

  it("R11 refuses paid_provider_used=true without paid_provider_reason", () => {
    const a = canonicalAuth();
    a.paid_provider_used = true;
    // no paid_provider_reason
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.requirement_id).toBe("R11_paid_provider_declaration");
  });

  it("R11 accepts paid_provider_used=true when reason present", () => {
    const a = canonicalAuth();
    a.paid_provider_used = true;
    a.paid_provider_reason = "Founder opt-in 2026-09-08 · specific comparison run · NEX_ALLOW_PAID_FALLBACK true for this authorization";
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(true);
  });

  it("canonical fully-pinned authorization passes validation", () => {
    const a = canonicalAuth();
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § RUNNER · CROSS-CHECKS + POSITIVE PATH (SyntheticAdapter · in-process)
// ═══════════════════════════════════════════════════════════════════

describe("V.5.4.2 · controlled-instrument · runner cross-checks + positive path", () => {

  it("runner refuses when system_prompt_hash does not match supplied text", async () => {
    const a = canonicalAuth();
    // legal 24-hex but wrong hash for the text
    a.system_prompt_hash = "0".repeat(24);
    const adapter = makeSyntheticAdapter("always_frontier");
    const result = await runControlledInstrument({
      authorization: a,
      adapter,
      corpus: TEST_CORPUS,
      system_prompt_text: SYSTEM_PROMPT_TEXT,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.requirement_id).toBe("R3_system_prompt_slot_hash");
  });

  it("runner refuses when corpus_version mismatches corpus.version", async () => {
    const a = canonicalAuth();
    a.corpus_version = "different-corpus-version-v99";
    const adapter = makeSyntheticAdapter("always_frontier");
    const result = await runControlledInstrument({
      authorization: a,
      adapter,
      corpus: TEST_CORPUS,
      system_prompt_text: SYSTEM_PROMPT_TEXT,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.requirement_id).toBe("R4_corpus_version");
  });

  it("runner refuses when adapter.identity.metadata.is_paid_third_party contradicts authorization", async () => {
    const a = canonicalAuth();
    a.paid_provider_used = false;
    // Craft a synthetic adapter whose identity CLAIMS is_paid_third_party:true
    const base = makeSyntheticAdapter("always_frontier");
    const conflictingAdapter = {
      ...base,
      identity: {
        ...base.identity,
        metadata: { ...(base.identity.metadata ?? {}), is_paid_third_party: true },
      },
    };
    const result = await runControlledInstrument({
      authorization: a,
      adapter: conflictingAdapter,
      corpus: TEST_CORPUS,
      system_prompt_text: SYSTEM_PROMPT_TEXT,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.requirement_id).toBe("R11_paid_provider_declaration");
  });

  it("positive path · fully-pinned authorization · synthetic adapter · run succeeds · sentinels present · transcripts written", async () => {
    const sink = new InMemoryTranscriptSink("positive_path_sink");
    const a = canonicalAuth();
    a.transcript_sink = sink;
    const adapter = makeSyntheticAdapter("always_frontier");
    const result = await runControlledInstrument({
      authorization: a,
      adapter,
      corpus: TEST_CORPUS,
      system_prompt_text: SYSTEM_PROMPT_TEXT,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // R9 depth · both sentinels present
    expect(result.sentinel_start).toBeTruthy();
    expect(result.sentinel_end).toBeTruthy();
    expect(result.sentinel_start.benchmark_hash_frozen_at).toBe(result.sentinel_end.benchmark_hash_frozen_at);

    // R10 depth · transcript written per case · pointer returned per case
    expect(result.transcript_pointers.length).toBe(TEST_CORPUS.case_count);
    expect(sink.size()).toBe(TEST_CORPUS.case_count);
    for (const p of result.transcript_pointers) {
      expect(p).toMatch(/^memory:\/\/positive_path_sink\//);
    }

    // Op-Truth §OP.5 · provenance.final_status is null (never set by producer)
    expect(result.provenance.final_status).toBeNull();

    // R11 depth · paid_provider_used propagated honestly
    expect(result.paid_provider_used).toBe(false);

    // Founder authorization ID echoed back for audit
    expect(result.founder_authorization_id).toBe("founder_auth_test_20260908_001");
  });
});

// ═══════════════════════════════════════════════════════════════════
// § R13 · MEASUREMENT TIER (Founder 2026-09-08 · doctrine §3+)
// ═══════════════════════════════════════════════════════════════════

describe("V.5.4.3 · R13 · measurement_tier discipline", () => {
  it("refuses when measurement_tier is undefined", () => {
    const a = canonicalAuth();
    (a as unknown as Record<string, unknown>).measurement_tier = undefined;
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.requirement_id).toBe("R13_measurement_tier");
  });

  it("refuses when measurement_tier is an unknown string", () => {
    const a = canonicalAuth();
    (a as unknown as Record<string, unknown>).measurement_tier = "auto";
    const v = validateControlledInstrumentAuthorization(a);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.requirement_id).toBe("R13_measurement_tier");
  });

  it("accepts 'raw_model'", () => {
    const a = canonicalAuth();
    a.measurement_tier = "raw_model";
    expect(validateControlledInstrumentAuthorization(a).ok).toBe(true);
  });

  it("accepts 'nex_augmented'", () => {
    const a = canonicalAuth();
    a.measurement_tier = "nex_augmented";
    expect(validateControlledInstrumentAuthorization(a).ok).toBe(true);
  });

  it("accepts 'full_nex_system'", () => {
    const a = canonicalAuth();
    a.measurement_tier = "full_nex_system";
    expect(validateControlledInstrumentAuthorization(a).ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § R14 · ROUND INVARIANCE (Founder 2026-09-08 · doctrine §4)
// ═══════════════════════════════════════════════════════════════════

describe("V.5.4.3 · R14 · round-invariance validator", () => {
  it("refuses an empty round", () => {
    const r = validateRoundInvariance([]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.requirement_id).toBe("R14_round_invariance");
  });

  it("accepts a single-candidate round trivially", () => {
    const r = validateRoundInvariance([canonicalAuth()]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.round_size).toBe(1);
  });

  it("accepts a 3-candidate round when only pinned_model_tag + founder_authorization_id + transcript_sink differ", () => {
    const a1 = canonicalAuth();
    a1.pinned_model_tag = "candidate_A"; a1.founder_authorization_id = "founder_auth_A";
    a1.transcript_sink = new InMemoryTranscriptSink("sink_A");
    const a2 = canonicalAuth();
    a2.pinned_model_tag = "candidate_B"; a2.founder_authorization_id = "founder_auth_B";
    a2.transcript_sink = new InMemoryTranscriptSink("sink_B");
    const a3 = canonicalAuth();
    a3.pinned_model_tag = "candidate_C"; a3.founder_authorization_id = "founder_auth_C";
    a3.transcript_sink = new InMemoryTranscriptSink("sink_C");
    const r = validateRoundInvariance([a1, a2, a3]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.round_size).toBe(3);
  });

  it("refuses drift on sampling.temperature (no mid-round tweaking)", () => {
    const a1 = canonicalAuth();
    const a2 = canonicalAuth();
    a2.pinned_model_tag = "candidate_B"; a2.founder_authorization_id = "founder_auth_B";
    a2.sampling.temperature = 0.1;   // drifted from canonical 0.7
    const r = validateRoundInvariance([a1, a2]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("sampling.temperature");
  });

  it("refuses drift on corpus_version", () => {
    const a1 = canonicalAuth();
    const a2 = canonicalAuth();
    a2.pinned_model_tag = "candidate_B"; a2.founder_authorization_id = "founder_auth_B";
    a2.corpus_version = "other-corpus-v2";
    const r = validateRoundInvariance([a1, a2]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("corpus_version");
  });

  it("refuses drift on system_prompt_hash", () => {
    const a1 = canonicalAuth();
    const a2 = canonicalAuth();
    a2.pinned_model_tag = "candidate_B"; a2.founder_authorization_id = "founder_auth_B";
    a2.system_prompt_hash = createHash("sha256").update("DIFFERENT PROMPT", "utf8").digest("hex").slice(0, 24);
    const r = validateRoundInvariance([a1, a2]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("system_prompt_hash");
  });

  it("refuses drift on measurement_tier (no cross-tier folding within one round)", () => {
    const a1 = canonicalAuth(); a1.measurement_tier = "raw_model";
    const a2 = canonicalAuth();
    a2.pinned_model_tag = "candidate_B"; a2.founder_authorization_id = "founder_auth_B";
    a2.measurement_tier = "nex_augmented";
    const r = validateRoundInvariance([a1, a2]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("measurement_tier");
  });

  it("refuses drift on hardware_identifier", () => {
    const a1 = canonicalAuth();
    const a2 = canonicalAuth();
    a2.pinned_model_tag = "candidate_B"; a2.founder_authorization_id = "founder_auth_B";
    a2.hardware_identifier = "other:different-hardware";
    const r = validateRoundInvariance([a1, a2]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("hardware_identifier");
  });
});

// ═══════════════════════════════════════════════════════════════════
// § FORBIDDEN-VOCABULARY SENTINEL (doctrine §11 defensive detector)
// ═══════════════════════════════════════════════════════════════════

describe("V.5.4.2 · doctrine §11 forbidden-vocabulary detector", () => {

  it("flags 'let's see what Ollama does'", () => {
    const r = detectForbiddenV54Vocabulary("Let's see what Ollama does when I ask it about staircases.");
    expect(r.clean).toBe(false);
    expect(r.offending_phrases).toContain("let's see what ollama does");
  });

  it("flags 'quick smoke test'", () => {
    const r = detectForbiddenV54Vocabulary("Going to run a quick smoke test against qwen3.");
    expect(r.clean).toBe(false);
    expect(r.offending_phrases).toContain("quick smoke test");
  });

  it("flags 'spin it up'", () => {
    const r = detectForbiddenV54Vocabulary("Just spin it up and check the output.");
    expect(r.clean).toBe(false);
    expect(r.offending_phrases).toContain("spin it up");
  });

  it("passes controlled-instrument vocabulary", () => {
    const r = detectForbiddenV54Vocabulary(
      "Controlled instrument run against corpus V4 with model qwen3:8b · sampling temperature=0.7 top_p=0.9 · " +
      "system prompt slot 'test_slot_v1' hash 88f7eff3 · hardware 'local:rtx-2050' · runtime 'ollama-0.4'.",
    );
    expect(r.clean).toBe(true);
    expect(r.offending_phrases.length).toBe(0);
  });
});
