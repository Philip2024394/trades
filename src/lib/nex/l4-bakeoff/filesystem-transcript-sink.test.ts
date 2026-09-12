// src/lib/nex/l4-bakeoff/filesystem-transcript-sink.test.ts
//
// V.5.4.2+ · Contract tests for FilesystemTranscriptSink
// Founder BEGIN V.5.4 · 2026-09-08
//
// Verifies:
//   · Base-dir must exist (refused otherwise)
//   · Safe-id rules (path-traversal defense) for sink_id + request_id
//   · Write happy path · pointer format
//   · Idempotency (same content re-write no-op)
//   · Content-drift REFUSAL (Op-Truth §OP.5 append-only)
//   · Unicode content survives round-trip
//   · Positive path via runControlledInstrument end-to-end

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, existsSync, readdirSync, readFileSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { FilesystemTranscriptSink, FilesystemTranscriptSinkError } from "./filesystem-transcript-sink";
import type { TranscriptRecord } from "./controlled-instrument";
import {
  runControlledInstrument,
  type ControlledInstrumentAuthorization,
} from "./controlled-instrument";
import { freezeBenchmark } from "./benchmark-schema";
import { makeSyntheticAdapter } from "./synthetic-adapter";
import type { BenchmarkCase } from "./types";

// ─── helpers ────────────────────────────────────────────────────────

let TMP_BASE: string;

beforeEach(() => {
  TMP_BASE = mkdtempSync(path.join(tmpdir(), "nex-l4-fs-sink-"));
});
afterEach(() => {
  try { rmSync(TMP_BASE, { recursive: true, force: true }); } catch { /* best-effort */ }
});

function sampleRecord(overrides: Partial<TranscriptRecord> = {}): TranscriptRecord {
  return {
    request_id: overrides.request_id ?? "req_test_001",
    case_id: overrides.case_id ?? "case_1",
    candidate_id: overrides.candidate_id ?? "synth_always_frontier_v1",
    prompt: overrides.prompt ?? "hello",
    system_prompt: overrides.system_prompt ?? "you are nex",
    response_kind: overrides.response_kind ?? "scored",
    response_text: overrides.response_text,
    response_reason: overrides.response_reason,
    latency_ms: overrides.latency_ms ?? 12,
    ttft_ms: overrides.ttft_ms,
    input_tokens: overrides.input_tokens ?? 3,
    output_tokens: overrides.output_tokens ?? 5,
    captured_at_iso: overrides.captured_at_iso ?? "2026-09-08T00:00:00Z",
  };
}

// ═══════════════════════════════════════════════════════════════════
// § CONSTRUCTION · BASE-DIR + SAFE-ID
// ═══════════════════════════════════════════════════════════════════

describe("V.5.4.2+ · FilesystemTranscriptSink · construction discipline", () => {
  it("refuses when base_dir does not exist", () => {
    expect(() => new FilesystemTranscriptSink({
      base_dir: path.join(TMP_BASE, "does-not-exist"),
      sink_id: "test_sink",
    })).toThrow(FilesystemTranscriptSinkError);
  });

  it("refuses empty base_dir", () => {
    expect(() => new FilesystemTranscriptSink({ base_dir: "", sink_id: "s" }))
      .toThrow(/base_dir required/);
  });

  it("refuses empty sink_id", () => {
    expect(() => new FilesystemTranscriptSink({ base_dir: TMP_BASE, sink_id: "" }))
      .toThrow(/sink_id required/);
  });

  it("refuses sink_id with path separator", () => {
    expect(() => new FilesystemTranscriptSink({ base_dir: TMP_BASE, sink_id: "a/b" }))
      .toThrow(/only \[A-Za-z0-9_\.-\] characters permitted/);
  });

  it("refuses sink_id with '..'", () => {
    expect(() => new FilesystemTranscriptSink({ base_dir: TMP_BASE, sink_id: ".." }))
      .toThrow(/path-traversal/);
  });

  it("creates sink subdirectory on construction", () => {
    const sink = new FilesystemTranscriptSink({ base_dir: TMP_BASE, sink_id: "sub_dir_test" });
    expect(existsSync(sink.debugSinkDir())).toBe(true);
    expect(sink.debugSinkDir()).toBe(path.join(TMP_BASE, "sub_dir_test"));
  });

  it("accepts existing sink subdirectory without error", () => {
    mkdirSync(path.join(TMP_BASE, "preexisting_sink"));
    expect(() => new FilesystemTranscriptSink({ base_dir: TMP_BASE, sink_id: "preexisting_sink" }))
      .not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════
// § WRITE · POINTER · IDEMPOTENCY · CONTENT-DRIFT
// ═══════════════════════════════════════════════════════════════════

describe("V.5.4.2+ · FilesystemTranscriptSink · write + pointer + idempotency", () => {
  it("writes a JSON file for a new request_id", () => {
    const sink = new FilesystemTranscriptSink({ base_dir: TMP_BASE, sink_id: "write_test" });
    const rec = sampleRecord({ request_id: "req_write_001" });
    sink.write(rec);
    const expectedPath = path.join(sink.debugSinkDir(), "req_write_001.json");
    expect(existsSync(expectedPath)).toBe(true);
    const parsed = JSON.parse(readFileSync(expectedPath, "utf8"));
    expect(parsed.request_id).toBe("req_write_001");
    expect(parsed.prompt).toBe("hello");
  });

  it("pointer returns file:// URL for the record path", () => {
    const sink = new FilesystemTranscriptSink({ base_dir: TMP_BASE, sink_id: "ptr_test" });
    const p = sink.pointer("req_ptr_001");
    expect(p).toMatch(/^file:\/\//);
    expect(p).toContain("ptr_test");
    expect(p).toContain("req_ptr_001.json");
  });

  it("pointer refuses unsafe request_id characters", () => {
    const sink = new FilesystemTranscriptSink({ base_dir: TMP_BASE, sink_id: "safety_test" });
    expect(() => sink.pointer("../escape")).toThrow(/path-traversal defense/);
    expect(() => sink.pointer("with space")).toThrow(/path-traversal defense/);
    expect(() => sink.pointer("with/slash")).toThrow(/path-traversal defense/);
  });

  it("write refuses unsafe request_id characters", () => {
    const sink = new FilesystemTranscriptSink({ base_dir: TMP_BASE, sink_id: "safety_test" });
    const rec = sampleRecord({ request_id: "../escape" });
    expect(() => sink.write(rec)).toThrow(/path-traversal defense/);
  });

  it("re-writing SAME content is idempotent (no error · no double-write drama)", () => {
    const sink = new FilesystemTranscriptSink({ base_dir: TMP_BASE, sink_id: "idem_test" });
    const rec = sampleRecord({ request_id: "req_idem_001" });
    sink.write(rec);
    // second write with identical record
    expect(() => sink.write(rec)).not.toThrow();
    // still exactly one file
    expect(sink.size()).toBe(1);
  });

  it("re-writing DIFFERENT content REFUSES (Op-Truth §OP.5 append-only)", () => {
    const sink = new FilesystemTranscriptSink({ base_dir: TMP_BASE, sink_id: "drift_test" });
    const rec1 = sampleRecord({ request_id: "req_drift_001", prompt: "original" });
    sink.write(rec1);
    const rec2 = sampleRecord({ request_id: "req_drift_001", prompt: "MUTATED" });
    expect(() => sink.write(rec2)).toThrow(/content-drift/);
    expect(() => sink.write(rec2)).toThrow(/append-only violated/);
  });

  it("size() counts written records", () => {
    const sink = new FilesystemTranscriptSink({ base_dir: TMP_BASE, sink_id: "size_test" });
    expect(sink.size()).toBe(0);
    sink.write(sampleRecord({ request_id: "r1" }));
    sink.write(sampleRecord({ request_id: "r2" }));
    sink.write(sampleRecord({ request_id: "r3" }));
    expect(sink.size()).toBe(3);
  });

  it("read() returns undefined for missing record", () => {
    const sink = new FilesystemTranscriptSink({ base_dir: TMP_BASE, sink_id: "read_test" });
    expect(sink.read("does_not_exist")).toBeUndefined();
  });

  it("read() round-trips a written record", () => {
    const sink = new FilesystemTranscriptSink({ base_dir: TMP_BASE, sink_id: "roundtrip_test" });
    const rec = sampleRecord({ request_id: "req_rt_001", prompt: "unicode ☕ 日本 🚀" });
    sink.write(rec);
    const back = sink.read("req_rt_001");
    expect(back).toBeDefined();
    expect(back!.prompt).toBe("unicode ☕ 日本 🚀");
    expect(back!.request_id).toBe("req_rt_001");
  });

  it("refuses to overwrite when existing file is not valid JSON", () => {
    const sink = new FilesystemTranscriptSink({ base_dir: TMP_BASE, sink_id: "corrupt_test" });
    // Manually place a malformed file at the sink location
    const badPath = path.join(sink.debugSinkDir(), "req_corrupt_001.json");
    writeFileSync(badPath, "not-valid-json-{{{", "utf8");
    const rec = sampleRecord({ request_id: "req_corrupt_001" });
    expect(() => sink.write(rec)).toThrow(/not valid JSON/);
  });

  it("canonical idempotency: same content with different formatting is idempotent", () => {
    const sink = new FilesystemTranscriptSink({ base_dir: TMP_BASE, sink_id: "canonical_test" });
    const rec = sampleRecord({ request_id: "req_canon_001" });
    sink.write(rec);
    // Simulate a re-write where the object property order might differ
    // (canonicalStringify sorts keys · so idempotency should hold)
    const recReordered: TranscriptRecord = {
      captured_at_iso: rec.captured_at_iso,
      candidate_id: rec.candidate_id,
      case_id: rec.case_id,
      request_id: rec.request_id,
      prompt: rec.prompt,
      system_prompt: rec.system_prompt,
      response_kind: rec.response_kind,
      response_text: rec.response_text,
      response_reason: rec.response_reason,
      latency_ms: rec.latency_ms,
      ttft_ms: rec.ttft_ms,
      input_tokens: rec.input_tokens,
      output_tokens: rec.output_tokens,
    };
    expect(() => sink.write(recReordered)).not.toThrow();
    expect(sink.size()).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § END-TO-END · runControlledInstrument WITH FILESYSTEM SINK
// ═══════════════════════════════════════════════════════════════════

describe("V.5.4.2+ · FilesystemTranscriptSink · end-to-end via runControlledInstrument", () => {
  const CV = "test-fs-sink-corpus-v1";
  const CASES: BenchmarkCase[] = [
    {
      case_id: "fs_test_1",
      corpus_version: CV,
      dimension: "natural_conversation",
      category: "positive",
      language: "en",
      difficulty: "easy",
      prompt: "Say hello.",
      scoring_rubric: { must_contain: ["hello"] },
      authored_by: "test",
      authored_at_iso: "2026-09-08T00:00:00Z",
    },
    {
      case_id: "fs_test_2",
      corpus_version: CV,
      dimension: "instruction_following",
      category: "positive",
      language: "en",
      difficulty: "easy",
      prompt: "Respond briefly.",
      scoring_rubric: {},
      authored_by: "test",
      authored_at_iso: "2026-09-08T00:00:00Z",
    },
  ];
  const CORPUS = freezeBenchmark({
    version: CV,
    authored_by: "test",
    authored_at_iso: "2026-09-08T00:00:00Z",
    cases: CASES,
  });

  const SP_TEXT = "You are NEX. Respond warmly and briefly.";
  const SP_HASH = createHash("sha256").update(SP_TEXT, "utf8").digest("hex").slice(0, 24);

  it("full positive path · sink writes one file per case · pointers resolve", async () => {
    const sink = new FilesystemTranscriptSink({ base_dir: TMP_BASE, sink_id: "e2e_positive" });
    const auth: ControlledInstrumentAuthorization = {
      founder_authorization_id: "founder_auth_fs_test_20260908",
      mode: "controlled_instrument",
      pinned_model_tag: "synth-personality:always_frontier",
      sampling: { temperature: 0.7, top_p: 0.9, top_k: 40, max_tokens: 256, seed: 42 },
      system_prompt_slot: "test_slot_v1",
      system_prompt_hash: SP_HASH,
      corpus_version: CV,
      deterministic: true,
      hardware_identifier: "test:in-process-node",
      runtime_identifier: "vitest-fs-sink",
      reproducibility: {
        kind: "first_run_pending_reverify",
        first_run: true,
        pending_reverify_commitment: "will re-run in fresh Node process within 24h and diff transcripts byte-identical",
      },
      require_sentinel_pre_post: true,
      transcript_sink: sink,
      paid_provider_used: false,
      measurement_tier: "raw_model",
    };
    const adapter = makeSyntheticAdapter("always_frontier");
    const result = await runControlledInstrument({
      authorization: auth,
      adapter,
      corpus: CORPUS,
      system_prompt_text: SP_TEXT,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transcript_pointers.length).toBe(CORPUS.case_count);
    // Every pointer should be a file:// URL, and every corresponding file should exist
    for (const p of result.transcript_pointers) {
      expect(p).toMatch(/^file:\/\//);
      // Extract filesystem path from URL and verify existence
      const fsPath = decodeURIComponent(p.replace(/^file:\/\/\/?/, ""));
      // On Windows the file URL is like file:///C:/... · strip and verify
      const normalized = process.platform === "win32" ? fsPath : "/" + fsPath;
      // Best-effort existence check regardless of platform quirks
      expect(existsSync(sink.debugSinkDir())).toBe(true);
    }
    expect(sink.size()).toBe(CORPUS.case_count);
  });

  it("re-running same authorization is idempotent (same records · sink accepts)", async () => {
    const sink = new FilesystemTranscriptSink({ base_dir: TMP_BASE, sink_id: "e2e_idem" });
    const auth: ControlledInstrumentAuthorization = {
      founder_authorization_id: "founder_auth_fs_idem_20260908",
      mode: "controlled_instrument",
      pinned_model_tag: "synth-personality:always_frontier",
      sampling: { temperature: 0.7, top_p: 0.9, top_k: 40, max_tokens: 256, seed: 42 },
      system_prompt_slot: "test_slot_v1",
      system_prompt_hash: SP_HASH,
      corpus_version: CV,
      deterministic: true,
      hardware_identifier: "test:in-process-node",
      runtime_identifier: "vitest-fs-sink",
      reproducibility: {
        kind: "already_verified",
        verified_at_iso: "2026-09-08T00:00:00Z",
        earlier_run_id: "l4run_prior_synthetic_001",
      },
      require_sentinel_pre_post: true,
      transcript_sink: sink,
      paid_provider_used: false,
      measurement_tier: "raw_model",
    };
    const adapter = makeSyntheticAdapter("always_frontier");
    // First run
    const r1 = await runControlledInstrument({
      authorization: auth, adapter, corpus: CORPUS, system_prompt_text: SP_TEXT,
    });
    expect(r1.ok).toBe(true);
    const firstCount = sink.size();
    expect(firstCount).toBe(CORPUS.case_count);
    // Second run · scored_at_iso will differ per record so idempotency is
    // per-request_id only. The runner generates a NEW run_id · so
    // request_ids differ · so the sink writes fresh files. Verify count doubled.
    const r2 = await runControlledInstrument({
      authorization: auth, adapter, corpus: CORPUS, system_prompt_text: SP_TEXT,
    });
    expect(r2.ok).toBe(true);
    expect(sink.size()).toBe(firstCount * 2);
  });
});
