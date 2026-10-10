// §36-V3 · WAVE-V3 · 2026-09-15 · nex-visual-intelligence-v3 · authorship-proof
// NEX bounded infrastructure · authorship-proof harness · 2026-09-15
//
// Persists the NEX1-emitted Visual Generation Contract bytes to real repo
// paths on first run. Verifies byte-identity on every subsequent run.

import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import * as path from "node:path";
import { authorTypedDataContract } from "../../programming-mission/typed-data-contract-authoring";
import {
  V3_STYLE,
  V3_RANGES_TARGET_PATH,
  V3_CONTRACT_TARGET_PATH,
  buildV3RangesSpec,
  buildV3ContractSpec,
} from "../visual-generation-contract-spec";

const REPO_ROOT = process.cwd();

const PERSISTED_RANGES_PATH = path.resolve(
  REPO_ROOT,
  "src/lib/nex-agent-runtime/nex-visual-intelligence-v3/visual-generation-contract-ranges.ts",
);
const PERSISTED_CONTRACT_PATH = path.resolve(
  REPO_ROOT,
  "src/lib/nex-agent-runtime/nex-visual-intelligence-v3/visual-generation-contract.ts",
);

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function emitRanges(): { content: string; sha: string } {
  const r = authorTypedDataContract({
    spec: buildV3RangesSpec(),
    style: V3_STYLE,
    target_path: V3_RANGES_TARGET_PATH,
  });
  if (!r.ok) throw new Error(`ranges authoring failed: ${r.refusal_code} · ${r.reason}`);
  return { content: r.content, sha: sha256Hex(r.content) };
}

function emitContract(): { content: string; sha: string } {
  const r = authorTypedDataContract({
    spec: buildV3ContractSpec(),
    style: V3_STYLE,
    target_path: V3_CONTRACT_TARGET_PATH,
  });
  if (!r.ok) throw new Error(`contract authoring failed: ${r.refusal_code} · ${r.reason}`);
  return { content: r.content, sha: sha256Hex(r.content) };
}

beforeAll(() => {
  const dir = path.dirname(PERSISTED_RANGES_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const ranges = emitRanges();
  if (!existsSync(PERSISTED_RANGES_PATH)) {
    writeFileSync(PERSISTED_RANGES_PATH, ranges.content, "utf8");
  }
  const contract = emitContract();
  if (!existsSync(PERSISTED_CONTRACT_PATH)) {
    writeFileSync(PERSISTED_CONTRACT_PATH, contract.content, "utf8");
  }
});

describe("§36-V3 · V3 · nex1-authorship-proof · persistence + byte-identity", () => {
  it("A-1 · both capability files persist at expected paths", () => {
    expect(existsSync(PERSISTED_RANGES_PATH)).toBe(true);
    expect(existsSync(PERSISTED_CONTRACT_PATH)).toBe(true);
  });

  it("A-2 · ranges file is byte-identical to primitive re-emission", () => {
    const persisted = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    const emitted = emitRanges();
    expect(sha256Hex(persisted)).toBe(emitted.sha);
  });

  it("A-3 · contract file is byte-identical to primitive re-emission", () => {
    const persisted = readFileSync(PERSISTED_CONTRACT_PATH, "utf8");
    const emitted = emitContract();
    expect(sha256Hex(persisted)).toBe(emitted.sha);
  });
});

describe("§36-V3 · V3 · authorship provenance headers", () => {
  it("B-1 · ranges file declares NEX1 authorship via typed_data_contract", () => {
    const persisted = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    expect(persisted).toContain("Coded by NEX1 via typed_data_contract");
    expect(persisted).toContain("§36-V3 · WAVE-V3 · 2026-09-15 · nex-visual-intelligence-v3");
  });

  it("B-2 · contract file declares NEX1 authorship via typed_data_contract", () => {
    const persisted = readFileSync(PERSISTED_CONTRACT_PATH, "utf8");
    expect(persisted).toContain("Coded by NEX1 via typed_data_contract");
    expect(persisted).toContain("§36-V3 · WAVE-V3 · 2026-09-15 · nex-visual-intelligence-v3");
  });

  it("B-3 · spec module declares itself as MAI bounded infrastructure", () => {
    const spec = readFileSync(
      path.resolve(REPO_ROOT, "src/lib/nex-agent-runtime/nex-visual-intelligence-v3/visual-generation-contract-spec.ts"),
      "utf8",
    );
    expect(spec).toContain("NEX bounded infrastructure");
    expect(spec).toContain("§36-V3 · WAVE-V3 · 2026-09-15 · nex-visual-intelligence-v3 · spec");
  });
});

describe("§36-V3 · V3 · real vocabulary content", () => {
  it("C-1 · ranges file contains 3 numeric ranges", () => {
    const p = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    expect(p).toContain("V3_MAX_PROMPT_LENGTH");
    expect(p).toContain("V3_MAX_OUTPUT_IMAGES");
    expect(p).toContain("V3_MAX_REGISTERED_ENGINES");
  });

  it("C-2 · ranges file contains 6 literal-union vocabularies", () => {
    const p = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    expect(p).toContain("V3_GenerationKind");
    expect(p).toContain("V3_OutputFormatKind");
    expect(p).toContain("V3_EngineRegistrationStatus");
    expect(p).toContain("V3_ResponseKind");
    expect(p).toContain("V3_PerceptionVerificationStatus");
    expect(p).toContain("V3_LicenceCommercialUseKind");
  });

  it("C-3 · GenerationKind has 4 locked members", () => {
    const p = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    expect(p).toContain('"text_to_image"');
    expect(p).toContain('"image_to_image"');
    expect(p).toContain('"reference_conditioned"');
    expect(p).toContain('"multi_reference_composition"');
  });

  it("C-4 · ResponseKind has 4 locked members incl. engine_registration_incomplete", () => {
    const p = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    expect(p).toContain('"engine_registration_incomplete"');
    expect(p).toContain('"engine_invocation_success"');
    expect(p).toContain('"engine_refused"');
    expect(p).toContain('"adapter_refused"');
  });

  it("C-5 · PerceptionVerificationStatus enumerates the perception gap", () => {
    const p = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    expect(p).toContain('"not_applicable"');
    expect(p).toContain('"pending_perceptual_layer"');
    expect(p).toContain('"verified"');
  });

  it("C-6 · refusal reason vocabulary complete (11 members)", () => {
    const p = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    expect(p).toContain("V3_EngineAdapterRefusalReason");
    for (const m of [
      "V3_INVALID_REQUEST",
      "V3_INVALID_CONSTRAINT_CONTRACT_REFERENCE",
      "V3_MAX_PROMPT_EXCEEDED",
      "V3_MAX_OUTPUT_IMAGES_EXCEEDED",
      "V3_PROHIBITED_STRING_CONTENT",
      "V3_ENGINE_NOT_REGISTERED",
      "V3_ENGINE_INSUFFICIENT_LICENCE",
      "V3_ENGINE_DISABLED",
      "V3_ENGINE_UNKNOWN_SLUG",
      "V3_PERCEPTION_NOT_AVAILABLE",
      "V3_INTERNAL",
    ]) {
      expect(p).toContain(`"${m}"`);
    }
  });

  it("C-7 · contract file declares 4 interfaces", () => {
    const p = readFileSync(PERSISTED_CONTRACT_PATH, "utf8");
    expect(p).toContain("interface V3GenerationRequest");
    expect(p).toContain("interface V3EngineProvenance");
    expect(p).toContain("interface V3EngineRegistration");
    expect(p).toContain("interface V3GenerationOutcome");
  });

  it("C-8 · V3GenerationRequest wires reference contract link + prompt", () => {
    const p = readFileSync(PERSISTED_CONTRACT_PATH, "utf8");
    expect(p).toContain("reference_contract_id");
    expect(p).toContain("reference_contract_sha256");
    expect(p).toContain("generation_kind");
    expect(p).toContain("output_format");
    expect(p).toContain("max_output_images");
  });

  it("C-9 · V3GenerationOutcome carries perception_verification_status", () => {
    const p = readFileSync(PERSISTED_CONTRACT_PATH, "utf8");
    expect(p).toContain("perception_verification_status");
    expect(p).toContain("engine_registration_status");
    expect(p).toContain("response_kind");
    expect(p).toContain("candidate_asset_ids");
  });
});

describe("§36-V3 · V3 · determinism", () => {
  it("D-1 · ranges re-emission byte-identical", () => {
    const a = emitRanges();
    const b = emitRanges();
    expect(a.sha).toBe(b.sha);
    expect(a.content).toBe(b.content);
  });

  it("D-2 · contract re-emission byte-identical", () => {
    const a = emitContract();
    const b = emitContract();
    expect(a.sha).toBe(b.sha);
    expect(a.content).toBe(b.content);
  });
});

describe("§36-V3 · V3 · anti-injection sanity", () => {
  it("E-1 · emitted files contain zero prohibited execution patterns", () => {
    const r = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    const c = readFileSync(PERSISTED_CONTRACT_PATH, "utf8");
    for (const bad of ["eval(", "new Function", "child_process", "<script", "process.exit(", "require("]) {
      expect(r).not.toContain(bad);
      expect(c).not.toContain(bad);
    }
  });

  it("E-2 · emitted files contain zero provider names", () => {
    const r = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    const c = readFileSync(PERSISTED_CONTRACT_PATH, "utf8");
    for (const prov of ["anthropic", "claude", "openai", "gpt-", "gemini", "midjourney", "dall-e", "stability", "flux."]) {
      expect(r.toLowerCase()).not.toContain(prov);
      expect(c.toLowerCase()).not.toContain(prov);
    }
  });
});
