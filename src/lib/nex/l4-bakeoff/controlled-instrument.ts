// src/lib/nex/l4-bakeoff/controlled-instrument.ts
//
// V.5.4.2 · CONTROLLED INSTRUMENT RUNNER · gate around runBakeoff
// Founder BEGIN V.5.4 · 2026-09-08
//
// This module enforces Invisible Infrastructure doctrine §11 (V.5.4
// controlled instrument discipline) — the 12 non-negotiable pinning
// requirements a REAL-candidate invocation must satisfy BEFORE any
// inference is permitted.
//
// The runner is a strict gate. It COMPOSES with runBakeoff. It does
// not replace it. If any of the 12 requirements is missing or vague,
// the runner REFUSES with a typed reason. It never falls back to
// "smoke_test" or "sanity_check" mode. It never invents defaults.
//
// The 12 non-negotiable requirements (from §11):
//   R1  · model tag pinned (no defaults)
//   R2  · sampling pinned (no undefined)
//   R3  · system prompt slot @ hash both present
//   R4  · corpus version explicit (registered)
//   R5  · seed captured OR deterministic:null (never omitted)
//   R6  · hardware id explicit (not auto-detected)
//   R7  · runtime id explicit
//   R8  · fresh-process reproducibility attested (verified_at_iso OR
//         first_run+pending_reverify commitment)
//   R9  · sentinel pre + post (harness invariant · runner enforces flag)
//   R10 · transcript sink required (persists full transcript)
//   R11 · paid_provider_used honestly false-explicit (or true-declared)
//   R12 · mode must be "controlled_instrument" (never "smoke_test" ·
//         "sanity_check" · "spin_it_up" · "let_us_see")
//
// PLUS: separate Founder authorization ID per run · empty refuses.
//
// Discipline:
//   · Runner NEVER throws · every refusal is a typed { ok:false, ... }
//   · Runner NEVER invents a default for any of the 12 requirements
//   · Runner NEVER contacts external services on the refusal path
//   · Runner NEVER logs the paid_provider decision without recording
//     it in the authorization record
//   · Runner enforces sentinel_uniform via runBakeoff · which already
//     captures sentinel_start + sentinel_end · runner asserts both
//     present in returned result

import type {
  BenchmarkCorpus,
  CandidateAdapter,
  RunProvenance,
  CaseScore,
  AntiGamingSentinel,
} from "./types";
import { runBakeoff, type BakeoffRunResult } from "./harness";
import type { LatencySample } from "./latency";

// ═══════════════════════════════════════════════════════════════════
// § A · CONTROLLED-INSTRUMENT AUTHORIZATION TYPE
// ═══════════════════════════════════════════════════════════════════

/** Explicit sampling — every field required · no `undefined` fallbacks.
 *  Setting a field to `null` means "deliberately unspecified with awareness".
 *  Setting a field to `undefined` or omitting it is a REFUSAL. */
export type ControlledSampling = {
  temperature: number | null;   // null = provider default explicitly accepted
  top_p: number | null;
  top_k: number | null;
  max_tokens: number | null;
  seed: number | "unspecified"; // never omitted · "unspecified" is explicit acknowledgement
};

/** Attestation covering §11 R8 (fresh-process reproducibility).
 *  Either an earlier run's baseline was reproduced fresh-process
 *  (`verified_at_iso` + `earlier_run_id`) · or this is the FIRST run
 *  in which case `first_run` must be explicit AND the operator commits
 *  to a follow-up verification (`pending_reverify_commitment`).
 *  No other shape is accepted. */
export type ReproducibilityAttestation =
  | {
      kind: "already_verified";
      verified_at_iso: string;            // ISO-8601 · when fresh-process test confirmed determinism
      earlier_run_id: string;             // prior run whose transcript matched fresh-process re-run
    }
  | {
      kind: "first_run_pending_reverify";
      first_run: true;
      pending_reverify_commitment: string; // free-text but ≥40 chars · e.g. "will re-run 2026-09-15 in fresh node process AND diff transcripts"
    };

/** Transcript sink — full transcript preservation is mandatory (§11 R10).
 *  Sink MUST persist and expose a stable pointer the caller can dereference.
 *  In tests the sink is in-memory. In production a filesystem/S3 sink is used.
 *  The runner NEVER writes transcripts inline into logs. */
export type TranscriptRecord = {
  request_id: string;
  case_id: string;
  candidate_id: string;
  prompt: string;
  system_prompt: string;
  response_kind: string;
  response_text?: string;
  response_reason?: string;
  latency_ms: number;
  ttft_ms?: number;
  input_tokens: number | "unknown" | undefined;
  output_tokens: number | "unknown" | undefined;
  captured_at_iso: string;
};

export interface TranscriptSink {
  readonly sink_id: string;
  write(record: TranscriptRecord): Promise<void> | void;
  /** Returns a stable pointer to the persisted transcript · caller
   *  stores this in the run provenance · never inlines the transcript. */
  pointer(request_id: string): string;
}

/** 3-tier measurement discipline (Founder 2026-09-08 addition to Candidate
 *  Selection Discipline §3+). Every controlled-instrument run must declare
 *  which tier is being measured so results are attributable + orchestration
 *  cannot silently make a weak model appear stronger:
 *    · "raw_model"        · what the model itself does (no NEX context injection)
 *    · "nex_augmented"    · model receives controlled NEX context/knowledge permitted by the bakeoff
 *    · "full_nex_system"  · model runs through the actual NEX inference architecture (RAG · memory · router · composer)
 *  Reports MUST keep tier results attributable · never fold across tiers. */
export type MeasurementTier = "raw_model" | "nex_augmented" | "full_nex_system";

/** All 12 pinning requirements + Founder-per-run authorization + tier declaration.
 *  Absent field / undefined value / empty string → REFUSAL. */
export type ControlledInstrumentAuthorization = {
  /** Human-verifiable authorization ID · Founder-issued per run · never empty. */
  founder_authorization_id: string;

  /** Mode discriminator · MUST be the literal "controlled_instrument".
   *  Any other value (including "smoke_test" · "sanity_check" · "spin_it_up") REFUSED.
   *  Typed as a string so the validator can refuse mistakes at runtime
   *  (rather than only at compile time). */
  mode: string;

  /** R1 · exact model tag as it will be sent to the provider · no default resolution.
   *  Empty / whitespace-only string REFUSED. */
  pinned_model_tag: string;

  /** R2 · fully-explicit sampling · undefined field REFUSED. */
  sampling: ControlledSampling;

  /** R3 · system prompt slot + hash — slot is the named registry entry ·
   *  hash is the SHA-256 truncated 24-hex of the resolved text. Both required. */
  system_prompt_slot: string;
  system_prompt_hash: string;

  /** R4 · exact benchmark corpus version (must match corpus.version at runtime). */
  corpus_version: string;

  /** R5 · already covered inside `sampling.seed` (never omitted) plus a
   *  determinism attestation. `null` means non-deterministic provider (honest). */
  deterministic: boolean | null;

  /** R6 · hardware identifier · MUST be operator-supplied · never auto-detected.
   *  Empty / vague / "auto-detect" style values REFUSED. */
  hardware_identifier: string;

  /** R7 · runtime identifier · similar discipline. */
  runtime_identifier: string;

  /** R8 · fresh-process reproducibility attestation. */
  reproducibility: ReproducibilityAttestation;

  /** R9 · sentinel discipline is enforced inside runBakeoff (pre + post).
   *  The runner asserts the returned result contains both sentinels ·
   *  callers can also opt to force stricter sentinel-hash equality checks. */
  require_sentinel_pre_post: true;

  /** R10 · transcript sink · required · never null. */
  transcript_sink: TranscriptSink;

  /** R11 · explicit paid-provider declaration · false-explicit for
   *  self-hosted candidates · true-explicit + reason for paid opt-in.
   *  Absence is REFUSED — the runner will not infer. */
  paid_provider_used: boolean;
  paid_provider_reason?: string;  // required when paid_provider_used=true

  /** R13 · 3-tier measurement discipline (Founder 2026-09-08 addition).
   *  Every run must declare which of raw_model / nex_augmented / full_nex_system
   *  is being measured. Missing → REFUSED. Cross-tier folding forbidden in reports. */
  measurement_tier: MeasurementTier;
};

// ═══════════════════════════════════════════════════════════════════
// § B · REFUSAL REASONS (typed · discriminated by requirement id)
// ═══════════════════════════════════════════════════════════════════

/** Every §11 requirement + Founder-authorization refusal has its own
 *  requirement_id so contract tests can pin each refusal path. */
export type ControlledInstrumentRequirementId =
  | "R0_founder_authorization_id"
  | "R1_pinned_model_tag"
  | "R2_sampling_pinned"
  | "R3_system_prompt_slot_hash"
  | "R4_corpus_version"
  | "R5_seed_or_deterministic_null"
  | "R6_hardware_identifier"
  | "R7_runtime_identifier"
  | "R8_reproducibility_attestation"
  | "R9_sentinel_flag"
  | "R10_transcript_sink"
  | "R11_paid_provider_declaration"
  | "R12_mode_literal"
  | "R13_measurement_tier"
  | "R14_round_invariance";

export type ControlledInstrumentValidation =
  | { ok: true }
  | { ok: false; requirement_id: ControlledInstrumentRequirementId; reason: string };

// ═══════════════════════════════════════════════════════════════════
// § C · VALIDATOR (pure · no side-effects · never contacts provider)
// ═══════════════════════════════════════════════════════════════════

const FORBIDDEN_MODES = new Set([
  "smoke_test",
  "sanity_check",
  "spin_it_up",
  "spin_up",
  "let_us_see",
  "quick_test",
  "adhoc",
  "ad_hoc",
  "experiment",
]);

const VAGUE_HARDWARE_TOKENS = ["auto", "auto-detect", "autodetect", "detect", "unknown-auto", ""];
const VAGUE_RUNTIME_TOKENS = ["auto", "auto-detect", "autodetect", "detect", ""];

function isNonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

function isVagueHardware(s: string): boolean {
  return VAGUE_HARDWARE_TOKENS.includes(s.trim().toLowerCase());
}

function isVagueRuntime(s: string): boolean {
  return VAGUE_RUNTIME_TOKENS.includes(s.trim().toLowerCase());
}

export function validateControlledInstrumentAuthorization(
  auth: ControlledInstrumentAuthorization,
): ControlledInstrumentValidation {
  // R0 · Founder authorization ID required per run · empty REFUSED
  if (!isNonEmpty(auth.founder_authorization_id)) {
    return {
      ok: false,
      requirement_id: "R0_founder_authorization_id",
      reason: "founder_authorization_id required per run · empty or missing REFUSED",
    };
  }

  // R12 · mode literal (evaluated early because it disqualifies "smoke_test" fastest)
  if (!isNonEmpty(auth.mode)) {
    return {
      ok: false,
      requirement_id: "R12_mode_literal",
      reason: "mode required · must be literal 'controlled_instrument'",
    };
  }
  const modeNormalized = auth.mode.trim().toLowerCase();
  if (modeNormalized !== "controlled_instrument") {
    return {
      ok: false,
      requirement_id: "R12_mode_literal",
      reason: `mode='${auth.mode}' REFUSED · only 'controlled_instrument' permitted · smoke-test / sanity-check modes forbidden by doctrine §11`,
    };
  }
  if (FORBIDDEN_MODES.has(modeNormalized)) {
    // Defense in depth · already handled above but explicit is better
    return {
      ok: false,
      requirement_id: "R12_mode_literal",
      reason: `mode='${auth.mode}' explicitly forbidden by doctrine §11`,
    };
  }

  // R1 · pinned model tag
  if (!isNonEmpty(auth.pinned_model_tag)) {
    return {
      ok: false,
      requirement_id: "R1_pinned_model_tag",
      reason: "pinned_model_tag required · no defaults · empty REFUSED",
    };
  }

  // R2 · sampling pinned (every field must be present · undefined REFUSED)
  const s = auth.sampling as unknown as Record<string, unknown> | null | undefined;
  if (s === null || s === undefined) {
    return {
      ok: false,
      requirement_id: "R2_sampling_pinned",
      reason: "sampling required · every field must be pinned · null/undefined REFUSED",
    };
  }
  for (const field of ["temperature", "top_p", "top_k", "max_tokens"] as const) {
    if (!(field in s) || s[field] === undefined) {
      return {
        ok: false,
        requirement_id: "R2_sampling_pinned",
        reason: `sampling.${field} required · undefined REFUSED · set to explicit number OR null (null = provider default explicitly accepted)`,
      };
    }
  }

  // R5 · seed captured OR deterministic:null (never omitted)
  if (!("seed" in s) || s.seed === undefined) {
    return {
      ok: false,
      requirement_id: "R5_seed_or_deterministic_null",
      reason: "sampling.seed required · undefined REFUSED · set to number OR 'unspecified' literal (never elided)",
    };
  }
  if (auth.deterministic === undefined) {
    return {
      ok: false,
      requirement_id: "R5_seed_or_deterministic_null",
      reason: "deterministic required · true/false/null all permitted · undefined REFUSED (null means non-deterministic provider · honest carve-out)",
    };
  }

  // R3 · system prompt slot + hash
  if (!isNonEmpty(auth.system_prompt_slot)) {
    return {
      ok: false,
      requirement_id: "R3_system_prompt_slot_hash",
      reason: "system_prompt_slot required · named slot from prompt registry · empty REFUSED",
    };
  }
  if (!isNonEmpty(auth.system_prompt_hash)) {
    return {
      ok: false,
      requirement_id: "R3_system_prompt_slot_hash",
      reason: "system_prompt_hash required · 24-hex SHA-256 truncation · empty REFUSED",
    };
  }
  if (!/^[a-f0-9]{24}$/i.test(auth.system_prompt_hash)) {
    return {
      ok: false,
      requirement_id: "R3_system_prompt_slot_hash",
      reason: `system_prompt_hash must be 24-hex characters · got '${auth.system_prompt_hash}'`,
    };
  }

  // R4 · corpus version explicit
  if (!isNonEmpty(auth.corpus_version)) {
    return {
      ok: false,
      requirement_id: "R4_corpus_version",
      reason: "corpus_version required · must match a registered corpus version · empty REFUSED",
    };
  }

  // R6 · hardware identifier explicit (not auto-detected)
  if (!isNonEmpty(auth.hardware_identifier)) {
    return {
      ok: false,
      requirement_id: "R6_hardware_identifier",
      reason: "hardware_identifier required · operator-supplied · empty REFUSED",
    };
  }
  if (isVagueHardware(auth.hardware_identifier)) {
    return {
      ok: false,
      requirement_id: "R6_hardware_identifier",
      reason: `hardware_identifier='${auth.hardware_identifier}' REFUSED · auto-detect tokens forbidden · supply explicit id (e.g. 'local:rtx-2050-8gb' · 'cloud:openai')`,
    };
  }

  // R7 · runtime identifier explicit
  if (!isNonEmpty(auth.runtime_identifier)) {
    return {
      ok: false,
      requirement_id: "R7_runtime_identifier",
      reason: "runtime_identifier required · operator-supplied · empty REFUSED",
    };
  }
  if (isVagueRuntime(auth.runtime_identifier)) {
    return {
      ok: false,
      requirement_id: "R7_runtime_identifier",
      reason: `runtime_identifier='${auth.runtime_identifier}' REFUSED · auto-detect tokens forbidden · supply explicit id (e.g. 'ollama-0.4' · 'openai-sdk-v5')`,
    };
  }

  // R8 · fresh-process reproducibility attestation
  const rep = auth.reproducibility as unknown as Record<string, unknown> | null | undefined;
  if (!rep || typeof rep !== "object") {
    return {
      ok: false,
      requirement_id: "R8_reproducibility_attestation",
      reason: "reproducibility required · either { kind:'already_verified', verified_at_iso, earlier_run_id } OR { kind:'first_run_pending_reverify', first_run:true, pending_reverify_commitment }",
    };
  }
  if (rep.kind === "already_verified") {
    if (!isNonEmpty(rep.verified_at_iso as string) || !isNonEmpty(rep.earlier_run_id as string)) {
      return {
        ok: false,
        requirement_id: "R8_reproducibility_attestation",
        reason: "reproducibility.already_verified requires verified_at_iso + earlier_run_id · both non-empty",
      };
    }
  } else if (rep.kind === "first_run_pending_reverify") {
    if (rep.first_run !== true) {
      return {
        ok: false,
        requirement_id: "R8_reproducibility_attestation",
        reason: "reproducibility.first_run_pending_reverify requires first_run:true (literal)",
      };
    }
    const commit = rep.pending_reverify_commitment;
    if (!isNonEmpty(commit as string) || (commit as string).trim().length < 40) {
      return {
        ok: false,
        requirement_id: "R8_reproducibility_attestation",
        reason: "reproducibility.first_run_pending_reverify.pending_reverify_commitment must be ≥40 chars describing when and how the fresh-process re-run will be executed",
      };
    }
  } else {
    return {
      ok: false,
      requirement_id: "R8_reproducibility_attestation",
      reason: `reproducibility.kind='${String(rep.kind)}' REFUSED · only 'already_verified' or 'first_run_pending_reverify' accepted`,
    };
  }

  // R9 · sentinel flag literal
  if (auth.require_sentinel_pre_post !== true) {
    return {
      ok: false,
      requirement_id: "R9_sentinel_flag",
      reason: "require_sentinel_pre_post must be true (literal) · doctrine §11 requires pre + post sentinel discipline",
    };
  }

  // R10 · transcript sink required
  if (!auth.transcript_sink || typeof auth.transcript_sink.write !== "function" ||
      typeof auth.transcript_sink.pointer !== "function" ||
      !isNonEmpty(auth.transcript_sink.sink_id)) {
    return {
      ok: false,
      requirement_id: "R10_transcript_sink",
      reason: "transcript_sink required · must implement { sink_id, write(record), pointer(request_id) } · null / partial REFUSED",
    };
  }

  // R11 · paid provider explicit declaration
  if (typeof auth.paid_provider_used !== "boolean") {
    return {
      ok: false,
      requirement_id: "R11_paid_provider_declaration",
      reason: "paid_provider_used required · boolean · true or false explicit · runner will not infer",
    };
  }
  if (auth.paid_provider_used === true && !isNonEmpty(auth.paid_provider_reason)) {
    return {
      ok: false,
      requirement_id: "R11_paid_provider_declaration",
      reason: "paid_provider_used=true requires non-empty paid_provider_reason explaining the Founder-authorized opt-in per Self-Sustainment doctrine",
    };
  }

  // R13 · measurement_tier discipline (Founder 2026-09-08)
  const tier = auth.measurement_tier as unknown;
  if (tier !== "raw_model" && tier !== "nex_augmented" && tier !== "full_nex_system") {
    return {
      ok: false,
      requirement_id: "R13_measurement_tier",
      reason: `measurement_tier required · must be one of 'raw_model' | 'nex_augmented' | 'full_nex_system' · got '${String(tier)}' · doctrine §3+ 3-tier measurement`,
    };
  }

  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════
// § D · TRANSCRIPT SINK (in-memory implementation for tests)
// ═══════════════════════════════════════════════════════════════════

export class InMemoryTranscriptSink implements TranscriptSink {
  readonly sink_id: string;
  private records: Map<string, TranscriptRecord> = new Map();
  constructor(sink_id: string = `mem_sink_${Date.now().toString(36)}`) {
    this.sink_id = sink_id;
  }
  write(record: TranscriptRecord): void {
    this.records.set(record.request_id, record);
  }
  pointer(request_id: string): string {
    return `memory://${this.sink_id}/${request_id}`;
  }
  read(request_id: string): TranscriptRecord | undefined {
    return this.records.get(request_id);
  }
  size(): number {
    return this.records.size;
  }
}

// ═══════════════════════════════════════════════════════════════════
// § E · RUN RESULT + REFUSAL RESULT (typed union · never throws)
// ═══════════════════════════════════════════════════════════════════

export type ControlledInstrumentResult =
  | {
      ok: true;
      founder_authorization_id: string;
      run_id: string;
      provenance: RunProvenance;
      case_scores: readonly CaseScore[];
      latency_samples: readonly LatencySample[];
      sentinel_start: AntiGamingSentinel;
      sentinel_end: AntiGamingSentinel;
      transcript_pointers: readonly string[];
      paid_provider_used: boolean;
      paid_provider_reason?: string;
    }
  | {
      ok: false;
      founder_authorization_id: string | null; // null when R0 refuses before ID captured
      requirement_id: ControlledInstrumentRequirementId;
      reason: string;
    };

// ═══════════════════════════════════════════════════════════════════
// § F · RUNNER (composes validator + runBakeoff + transcript capture)
// ═══════════════════════════════════════════════════════════════════

export type ControlledInstrumentInput = {
  authorization: ControlledInstrumentAuthorization;
  adapter: CandidateAdapter;
  corpus: BenchmarkCorpus;
  system_prompt_text: string;   // must match hash in authorization · runner will verify
  /** V.5.4.3-002 · optional per-case progress callback · fires after
   *  each case completes (post-invoke + post-score + post-transcript).
   *  Never throws (errors caught + swallowed to preserve run integrity). */
  progress_callback?: (info: {
    case_id: string;
    case_index: number;
    case_total: number;
    elapsed_ms: number;
    response_kind: string;
    case_latency_ms: number;
    output_tokens_or_unknown: number | "unknown";
    passed_or_unknown: boolean | "unknown";
  }) => void;
};

import { createHash } from "node:crypto";

function hashSystemPromptText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 24);
}

/** Execute a controlled-instrument run. Validates all 12 §11 requirements
 *  BEFORE any adapter invocation. Refuses cleanly on any failure. Never throws. */
export async function runControlledInstrument(
  input: ControlledInstrumentInput,
): Promise<ControlledInstrumentResult> {
  const { authorization, adapter, corpus, system_prompt_text } = input;

  const validation = validateControlledInstrumentAuthorization(authorization);
  if (!validation.ok) {
    return {
      ok: false,
      founder_authorization_id: authorization.founder_authorization_id?.length ? authorization.founder_authorization_id : null,
      requirement_id: validation.requirement_id,
      reason: validation.reason,
    };
  }

  // Cross-check the supplied prompt text matches the pinned hash (R3 depth)
  const computedHash = hashSystemPromptText(system_prompt_text);
  if (computedHash !== authorization.system_prompt_hash.toLowerCase()) {
    return {
      ok: false,
      founder_authorization_id: authorization.founder_authorization_id,
      requirement_id: "R3_system_prompt_slot_hash",
      reason: `system_prompt_hash mismatch · computed=${computedHash} · pinned=${authorization.system_prompt_hash.toLowerCase()} · REFUSED (indicates the text drifted from the pinned hash)`,
    };
  }

  // Cross-check corpus version (R4 depth)
  if (corpus.version !== authorization.corpus_version) {
    return {
      ok: false,
      founder_authorization_id: authorization.founder_authorization_id,
      requirement_id: "R4_corpus_version",
      reason: `corpus_version mismatch · authorization=${authorization.corpus_version} · corpus.version=${corpus.version} · REFUSED`,
    };
  }

  // Cross-check adapter identity self-consistency for paid-provider (R11 depth)
  const idMeta = adapter.identity.metadata ?? {};
  const identityPaidField = idMeta["is_paid_third_party"];
  if (typeof identityPaidField === "boolean" && identityPaidField !== authorization.paid_provider_used) {
    return {
      ok: false,
      founder_authorization_id: authorization.founder_authorization_id,
      requirement_id: "R11_paid_provider_declaration",
      reason: `paid_provider_used mismatch · authorization=${authorization.paid_provider_used} · candidate.metadata.is_paid_third_party=${identityPaidField} · REFUSED (must agree)`,
    };
  }

  // All 12 requirements satisfied · delegate to runBakeoff.
  // V.5.4.3-002 · we now install a per-case hook so the sink receives the
  // FULL adapter response (text · tool_calls · latency · ttft · tokens)
  // AT THE MOMENT each case completes · not as a metadata-only pass at the
  // end. Progress-callback also fires here so a runner can log live.
  const transcript_pointers: string[] = [];
  let bakeoffResult: BakeoffRunResult;
  try {
    bakeoffResult = await runBakeoff({
      corpus,
      adapter,
      system_prompt_slot: authorization.system_prompt_slot,
      system_prompt_text,
      sampling: {
        temperature: authorization.sampling.temperature ?? undefined,
        top_p: authorization.sampling.top_p ?? undefined,
        top_k: authorization.sampling.top_k ?? undefined,
        max_tokens: authorization.sampling.max_tokens ?? undefined,
        seed: authorization.sampling.seed,
      },
      hardware_identifier: authorization.hardware_identifier,
      runtime_identifier: authorization.runtime_identifier,
      deterministic: authorization.deterministic,
      on_case_complete: async ({ bcase, request, response, score, case_index, case_total, elapsed_ms }) => {
        const request_id = request.request_id;
        const record: TranscriptRecord = {
          request_id,
          case_id: bcase.case_id,
          candidate_id: adapter.identity.candidate_id,
          prompt: bcase.prompt,
          system_prompt: system_prompt_text,
          response_kind: response.kind,
          response_text: response.kind === "ok" ? response.text : undefined,
          response_reason: response.kind === "ok" ? undefined : response.reason,
          latency_ms: response.latency_ms,
          ttft_ms: response.kind === "ok" ? response.ttft_ms : undefined,
          input_tokens: response.kind === "ok" ? response.input_tokens : undefined,
          output_tokens: response.kind === "ok" ? response.output_tokens : undefined,
          captured_at_iso: score.scored_at_iso,
        };
        // Also preserve tool_calls when present (extend TranscriptRecord metadata via a discriminated extra bag).
        const enrichedRecord = response.kind === "ok" && response.tool_calls && response.tool_calls.length > 0
          ? { ...record, tool_calls: response.tool_calls }
          : record;
        await Promise.resolve(authorization.transcript_sink.write(enrichedRecord as TranscriptRecord));
        transcript_pointers.push(authorization.transcript_sink.pointer(request_id));
        if (input.progress_callback) {
          try {
            input.progress_callback({
              case_id: bcase.case_id,
              case_index,
              case_total,
              elapsed_ms,
              response_kind: response.kind,
              case_latency_ms: response.latency_ms,
              output_tokens_or_unknown: response.kind === "ok" ? response.output_tokens : "unknown",
              passed_or_unknown: score.passed,
            });
          } catch { /* progress-callback errors must never abort a run */ }
        }
      },
    });
  } catch (err) {
    // runBakeoff should not throw · but if it does · treat as adapter-side
    // failure and preserve authorization ID
    return {
      ok: false,
      founder_authorization_id: authorization.founder_authorization_id,
      requirement_id: "R9_sentinel_flag",
      reason: `runBakeoff threw · likely sentinel drift or benchmark integrity failure: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Sentinel post-condition (R9 depth · runner enforces both present)
  if (!bakeoffResult.sentinel_start || !bakeoffResult.sentinel_end) {
    return {
      ok: false,
      founder_authorization_id: authorization.founder_authorization_id,
      requirement_id: "R9_sentinel_flag",
      reason: "runBakeoff returned without both sentinel_start and sentinel_end · doctrine §11 R9 violated",
    };
  }

  return {
    ok: true,
    founder_authorization_id: authorization.founder_authorization_id,
    run_id: bakeoffResult.run_id,
    provenance: bakeoffResult.provenance,
    case_scores: bakeoffResult.case_scores,
    latency_samples: bakeoffResult.latency_samples,
    sentinel_start: bakeoffResult.sentinel_start,
    sentinel_end: bakeoffResult.sentinel_end,
    transcript_pointers,
    paid_provider_used: authorization.paid_provider_used,
    paid_provider_reason: authorization.paid_provider_reason,
  };
}

// ═══════════════════════════════════════════════════════════════════
// § G+ · ROUND INVARIANCE (Founder 2026-09-08 · doctrine §4)
// ═══════════════════════════════════════════════════════════════════
//
// "Do not optimize after seeing the first candidate. Run the same frozen
//  corpus and measurement protocol. The candidate must be measured under
//  the same rules." — Founder verbatim 2026-09-08
//
// V.5.4.2 R9 enforces PER-RUN sentinel discipline (corpus + scoring +
// system_prompt frozen within one run). This validator enforces ROUND-
// LEVEL invariance: across ALL candidates in one bakeoff round, the
// authorizations MUST be identical in every dimension EXCEPT:
//   · pinned_model_tag (necessarily differs · that IS the variable being tested)
//   · founder_authorization_id (per-candidate · that IS the audit primitive)
//   · transcript_sink (different sink_id per candidate is legitimate)
// Everything else — sampling · seed · deterministic · system_prompt_slot ·
// system_prompt_hash · corpus_version · hardware_identifier · runtime_identifier ·
// require_sentinel_pre_post · paid_provider_used · measurement_tier — MUST
// be identical. Any deviation is REFUSED with requirement_id: R14_round_invariance.

export type RoundInvarianceResult =
  | { ok: true; round_size: number }
  | { ok: false; requirement_id: "R14_round_invariance"; reason: string; offending_candidate_id: string };

export function validateRoundInvariance(
  authorizations: readonly ControlledInstrumentAuthorization[],
): RoundInvarianceResult {
  if (authorizations.length === 0) {
    return {
      ok: false,
      requirement_id: "R14_round_invariance",
      reason: "round requires at least 1 authorization · empty REFUSED",
      offending_candidate_id: "<empty-round>",
    };
  }
  if (authorizations.length === 1) {
    // A single-candidate "round" trivially satisfies invariance
    return { ok: true, round_size: 1 };
  }

  const first = authorizations[0];
  const baseline = {
    sampling_temperature: first.sampling.temperature,
    sampling_top_p: first.sampling.top_p,
    sampling_top_k: first.sampling.top_k,
    sampling_max_tokens: first.sampling.max_tokens,
    sampling_seed: first.sampling.seed,
    deterministic: first.deterministic,
    system_prompt_slot: first.system_prompt_slot,
    system_prompt_hash: first.system_prompt_hash.toLowerCase(),
    corpus_version: first.corpus_version,
    hardware_identifier: first.hardware_identifier,
    runtime_identifier: first.runtime_identifier,
    require_sentinel_pre_post: first.require_sentinel_pre_post,
    paid_provider_used: first.paid_provider_used,
    measurement_tier: first.measurement_tier,
    mode: first.mode.trim().toLowerCase(),
  };

  for (let i = 1; i < authorizations.length; i++) {
    const a = authorizations[i];
    const candidateId = `<auth[${i}] founder_id=${a.founder_authorization_id}>`;
    const drift = (field: string, expected: unknown, actual: unknown) => ({
      ok: false as const,
      requirement_id: "R14_round_invariance" as const,
      reason: `round_invariance_drift on ${field} · candidate[0]=${JSON.stringify(expected)} · candidate[${i}]=${JSON.stringify(actual)} · Founder 2026-09-08 · no mid-round optimization permitted`,
      offending_candidate_id: candidateId,
    });
    if (a.sampling.temperature !== baseline.sampling_temperature) return drift("sampling.temperature", baseline.sampling_temperature, a.sampling.temperature);
    if (a.sampling.top_p !== baseline.sampling_top_p) return drift("sampling.top_p", baseline.sampling_top_p, a.sampling.top_p);
    if (a.sampling.top_k !== baseline.sampling_top_k) return drift("sampling.top_k", baseline.sampling_top_k, a.sampling.top_k);
    if (a.sampling.max_tokens !== baseline.sampling_max_tokens) return drift("sampling.max_tokens", baseline.sampling_max_tokens, a.sampling.max_tokens);
    if (a.sampling.seed !== baseline.sampling_seed) return drift("sampling.seed", baseline.sampling_seed, a.sampling.seed);
    if (a.deterministic !== baseline.deterministic) return drift("deterministic", baseline.deterministic, a.deterministic);
    if (a.system_prompt_slot !== baseline.system_prompt_slot) return drift("system_prompt_slot", baseline.system_prompt_slot, a.system_prompt_slot);
    if (a.system_prompt_hash.toLowerCase() !== baseline.system_prompt_hash) return drift("system_prompt_hash", baseline.system_prompt_hash, a.system_prompt_hash.toLowerCase());
    if (a.corpus_version !== baseline.corpus_version) return drift("corpus_version", baseline.corpus_version, a.corpus_version);
    if (a.hardware_identifier !== baseline.hardware_identifier) return drift("hardware_identifier", baseline.hardware_identifier, a.hardware_identifier);
    if (a.runtime_identifier !== baseline.runtime_identifier) return drift("runtime_identifier", baseline.runtime_identifier, a.runtime_identifier);
    if (a.require_sentinel_pre_post !== baseline.require_sentinel_pre_post) return drift("require_sentinel_pre_post", baseline.require_sentinel_pre_post, a.require_sentinel_pre_post);
    if (a.paid_provider_used !== baseline.paid_provider_used) return drift("paid_provider_used", baseline.paid_provider_used, a.paid_provider_used);
    if (a.measurement_tier !== baseline.measurement_tier) return drift("measurement_tier", baseline.measurement_tier, a.measurement_tier);
    if (a.mode.trim().toLowerCase() !== baseline.mode) return drift("mode", baseline.mode, a.mode.trim().toLowerCase());
    // pinned_model_tag INTENTIONALLY NOT checked · that IS the variable being tested
    // founder_authorization_id INTENTIONALLY NOT checked · per-candidate audit primitive
    // transcript_sink INTENTIONALLY NOT checked · sink_id per candidate is legitimate
  }

  return { ok: true, round_size: authorizations.length };
}

// ═══════════════════════════════════════════════════════════════════
// § G · FORBIDDEN-VOCABULARY SENTINEL (defensive · doctrine §11)
// ═══════════════════════════════════════════════════════════════════

/** Programmatic detector for the forbidden vocabulary about V.5.4 runs.
 *  Callers can invoke this on operator-supplied notes / commit messages /
 *  Founder authorization descriptions to flag doctrine drift. */
export function detectForbiddenV54Vocabulary(text: string): {
  clean: boolean;
  offending_phrases: readonly string[];
} {
  const lower = text.toLowerCase();
  const forbidden = [
    "let's see what ollama does",
    "let us see what ollama does",
    "quick smoke test",
    "smoke test",
    "spin it up",
    "spin up and see",
    "sanity check",
    "ad-hoc",
    "adhoc",
    "let's try",
    "connect ollama and see what happens",
  ];
  const hits = forbidden.filter((p) => lower.includes(p));
  return { clean: hits.length === 0, offending_phrases: hits };
}
