// §36-PCE1 · WAVE-PCE-V1 · 2026-09-15 · nex-perceptual-contract-extraction-v1 · authorship-proof
// NEX bounded infrastructure · authorship-proof harness · 2026-09-15

import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import * as path from "node:path";
import { authorTypedDataContract } from "../../programming-mission/typed-data-contract-authoring";
import {
  PCE_STYLE,
  PCE_RANGES_TARGET_PATH,
  PCE_CONTRACT_TARGET_PATH,
  buildPCERangesSpec,
  buildPCEContractSpec,
} from "../perceptual-extraction-spec";

const REPO_ROOT = process.cwd();
const PERSISTED_RANGES_PATH = path.resolve(REPO_ROOT, "src/lib/nex-agent-runtime/nex-perceptual-contract-extraction-v1/perceptual-extraction-ranges.ts");
const PERSISTED_CONTRACT_PATH = path.resolve(REPO_ROOT, "src/lib/nex-agent-runtime/nex-perceptual-contract-extraction-v1/perceptual-extraction.ts");

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function emitRanges(): { content: string; sha: string } {
  const r = authorTypedDataContract({ spec: buildPCERangesSpec(), style: PCE_STYLE, target_path: PCE_RANGES_TARGET_PATH });
  if (!r.ok) throw new Error(`ranges authoring failed: ${r.refusal_code} · ${r.reason}`);
  return { content: r.content, sha: sha256Hex(r.content) };
}
function emitContract(): { content: string; sha: string } {
  const r = authorTypedDataContract({ spec: buildPCEContractSpec(), style: PCE_STYLE, target_path: PCE_CONTRACT_TARGET_PATH });
  if (!r.ok) throw new Error(`contract authoring failed: ${r.refusal_code} · ${r.reason}`);
  return { content: r.content, sha: sha256Hex(r.content) };
}

beforeAll(() => {
  const dir = path.dirname(PERSISTED_RANGES_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const ranges = emitRanges();
  if (!existsSync(PERSISTED_RANGES_PATH)) writeFileSync(PERSISTED_RANGES_PATH, ranges.content, "utf8");
  const contract = emitContract();
  if (!existsSync(PERSISTED_CONTRACT_PATH)) writeFileSync(PERSISTED_CONTRACT_PATH, contract.content, "utf8");
});

describe("§36-PCE1 · authorship-proof · persistence + byte-identity", () => {
  it("A-1 · both capability files persist", () => {
    expect(existsSync(PERSISTED_RANGES_PATH)).toBe(true);
    expect(existsSync(PERSISTED_CONTRACT_PATH)).toBe(true);
  });
  it("A-2 · ranges file byte-identical to primitive re-emission", () => {
    expect(sha256Hex(readFileSync(PERSISTED_RANGES_PATH, "utf8"))).toBe(emitRanges().sha);
  });
  it("A-3 · contract file byte-identical to primitive re-emission", () => {
    expect(sha256Hex(readFileSync(PERSISTED_CONTRACT_PATH, "utf8"))).toBe(emitContract().sha);
  });
});

describe("§36-PCE1 · authorship provenance headers", () => {
  it("B-1 · ranges file declares NEX1 authorship", () => {
    const p = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    expect(p).toContain("Coded by NEX1 via typed_data_contract");
    expect(p).toContain("§36-PCE1 · WAVE-PCE-V1 · 2026-09-15 · nex-perceptual-contract-extraction-v1");
  });
  it("B-2 · contract file declares NEX1 authorship", () => {
    const p = readFileSync(PERSISTED_CONTRACT_PATH, "utf8");
    expect(p).toContain("Coded by NEX1 via typed_data_contract");
    expect(p).toContain("§36-PCE1 · WAVE-PCE-V1 · 2026-09-15 · nex-perceptual-contract-extraction-v1");
  });
});

describe("§36-PCE1 · real vocabulary content", () => {
  it("C-1 · ranges file contains 3 numeric ranges", () => {
    const p = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    expect(p).toContain("PCE_MAX_EXTRACTED_PROPERTIES");
    expect(p).toContain("PCE_MAX_IMAGE_BYTES");
    expect(p).toContain("PCE_MIN_IMAGE_BYTES");
  });
  it("C-2 · ranges file contains 5 literal unions", () => {
    const p = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    expect(p).toContain("PCE_ImageFormat");
    expect(p).toContain("PCE_VerificationStatus");
    expect(p).toContain("PCE_ExtractionMethodKind");
    expect(p).toContain("PCE_DeterminismKind");
    expect(p).toContain("PCE_PerceptualDomain");
  });
  it("C-3 · VerificationStatus contains the load-bearing unable_to_verify literal", () => {
    expect(readFileSync(PERSISTED_RANGES_PATH, "utf8")).toContain('"unable_to_verify"');
  });
  it("C-4 · PerceptualDomain has 9 members", () => {
    const p = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    for (const m of ["dimensions", "format", "provenance", "geometry", "material", "colour", "camera", "composition", "identity"]) {
      expect(p).toContain(`"${m}"`);
    }
  });
  it("C-5 · refusal union has 9 members", () => {
    const p = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    for (const m of ["PCE_INVALID_REQUEST", "PCE_INVALID_IMAGE_BYTES", "PCE_UNSUPPORTED_FORMAT", "PCE_IMAGE_TOO_LARGE", "PCE_IMAGE_TOO_SMALL", "PCE_MALFORMED_HEADER", "PCE_PROHIBITED_STRING_CONTENT", "PCE_MAX_EXTRACTIONS_EXCEEDED", "PCE_INTERNAL"]) {
      expect(p).toContain(`"${m}"`);
    }
  });
  it("C-6 · contract file declares 3 interfaces", () => {
    const p = readFileSync(PERSISTED_CONTRACT_PATH, "utf8");
    expect(p).toContain("interface PCE_ExtractedProperty");
    expect(p).toContain("interface PCE_ExtractionProvenance");
    expect(p).toContain("interface PerceptualExtractionResult");
  });
  it("C-7 · PCE_ExtractedProperty wires verification_status + rationale + method_kind", () => {
    const p = readFileSync(PERSISTED_CONTRACT_PATH, "utf8");
    expect(p).toContain("verification_status");
    expect(p).toContain("extraction_method_kind");
    expect(p).toContain("rationale");
    expect(p).toContain("perceptual_domain");
  });
});

describe("§36-PCE1 · anti-injection sanity", () => {
  it("D-1 · emitted files contain zero prohibited execution patterns", () => {
    const r = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    const c = readFileSync(PERSISTED_CONTRACT_PATH, "utf8");
    for (const bad of ["eval(", "new Function", "child_process", "<script", "process.exit(", "require("]) {
      expect(r).not.toContain(bad);
      expect(c).not.toContain(bad);
    }
  });
  it("D-2 · emitted files contain zero provider names", () => {
    const r = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    const c = readFileSync(PERSISTED_CONTRACT_PATH, "utf8");
    for (const prov of ["anthropic", "claude", "openai", "gpt-", "gemini", "midjourney", "dall-e", "stability", "flux."]) {
      expect(r.toLowerCase()).not.toContain(prov);
      expect(c.toLowerCase()).not.toContain(prov);
    }
  });
});
