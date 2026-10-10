// §36-V1 · WAVE-V1 · 2026-09-15 · nex-visual-intelligence-v1 · authorship-proof
// NEX bounded infrastructure · authorship-proof harness · 2026-09-15
//
// Persists the NEX1-emitted Visual Constraint Contract bytes to real repo
// paths on first run. Verifies byte-identity on every subsequent run.
// Divergence between persisted content and primitive re-emission fails the
// suite. Hand-editing the emitted capability files is a governance violation
// caught here.

import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import * as path from "node:path";
import { authorTypedDataContract } from "../../programming-mission/typed-data-contract-authoring";
import {
  V1_STYLE,
  V1_RANGES_TARGET_PATH,
  V1_CONTRACT_TARGET_PATH,
  buildV1RangesSpec,
  buildV1ContractSpec,
} from "../visual-constraint-contract-spec";

const REPO_ROOT = process.cwd();

const PERSISTED_RANGES_PATH = path.resolve(
  REPO_ROOT,
  "src/lib/nex-agent-runtime/nex-visual-intelligence-v1/visual-constraint-contract-ranges.ts",
);
const PERSISTED_CONTRACT_PATH = path.resolve(
  REPO_ROOT,
  "src/lib/nex-agent-runtime/nex-visual-intelligence-v1/visual-constraint-contract.ts",
);

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function emitRanges(): { content: string; sha: string } {
  const r = authorTypedDataContract({
    spec: buildV1RangesSpec(),
    style: V1_STYLE,
    target_path: V1_RANGES_TARGET_PATH,
  });
  if (!r.ok) throw new Error(`ranges authoring failed: ${r.refusal_code} · ${r.reason}`);
  return { content: r.content, sha: sha256Hex(r.content) };
}

function emitContract(): { content: string; sha: string } {
  const r = authorTypedDataContract({
    spec: buildV1ContractSpec(),
    style: V1_STYLE,
    target_path: V1_CONTRACT_TARGET_PATH,
  });
  if (!r.ok) throw new Error(`contract authoring failed: ${r.refusal_code} · ${r.reason}`);
  return { content: r.content, sha: sha256Hex(r.content) };
}

// ── Persist on first run · ensures the real repo files exist ──────────

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

// ── §A · Persistence + byte-identity ──────────────────────────────────

describe("§36-V1 · V1 · nex1-authorship-proof · persistence + byte-identity", () => {
  it("A-1 · both capability files persist at expected paths", () => {
    expect(existsSync(PERSISTED_RANGES_PATH)).toBe(true);
    expect(existsSync(PERSISTED_CONTRACT_PATH)).toBe(true);
  });

  it("A-2 · ranges file is byte-identical to the primitive's deterministic emission", () => {
    const persisted = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    const emitted = emitRanges();
    expect(sha256Hex(persisted)).toBe(emitted.sha);
  });

  it("A-3 · contract file is byte-identical to the primitive's deterministic emission", () => {
    const persisted = readFileSync(PERSISTED_CONTRACT_PATH, "utf8");
    const emitted = emitContract();
    expect(sha256Hex(persisted)).toBe(emitted.sha);
  });
});

// ── §B · Authorship headers ────────────────────────────────────────────

describe("§36-V1 · V1 · authorship provenance headers", () => {
  it("B-1 · ranges file declares NEX1 authorship via typed_data_contract", () => {
    const persisted = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    expect(persisted).toContain("Coded by NEX1 via typed_data_contract");
    expect(persisted).toContain("§36-V1 · WAVE-V1 · 2026-09-15 · nex-visual-intelligence-v1");
  });

  it("B-2 · contract file declares NEX1 authorship via typed_data_contract", () => {
    const persisted = readFileSync(PERSISTED_CONTRACT_PATH, "utf8");
    expect(persisted).toContain("Coded by NEX1 via typed_data_contract");
    expect(persisted).toContain("§36-V1 · WAVE-V1 · 2026-09-15 · nex-visual-intelligence-v1");
  });

  it("B-3 · spec module declares itself as MAI bounded infrastructure", () => {
    const spec = readFileSync(
      path.resolve(REPO_ROOT, "src/lib/nex-agent-runtime/nex-visual-intelligence-v1/visual-constraint-contract-spec.ts"),
      "utf8",
    );
    expect(spec).toContain("NEX bounded infrastructure");
    expect(spec).toContain("§36-V1 · WAVE-V1 · 2026-09-15 · nex-visual-intelligence-v1 · spec");
  });
});

// ── §C · Real vocabulary content (proving-challenge phase-1 readiness) ─

describe("§36-V1 · V1 · real vocabulary content · merchant-readable identity", () => {
  it("C-1 · ranges file contains all 7 numeric range constants", () => {
    const persisted = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    expect(persisted).toContain("V1_HUE_DEGREES_BOUNDS");
    expect(persisted).toContain("V1_UNIT_INTERVAL_BOUNDS");
    expect(persisted).toContain("V1_DELTA_E_BOUNDS");
    expect(persisted).toContain("V1_ASPECT_RATIO_COMPONENT_BOUNDS");
    expect(persisted).toContain("V1_MAX_IDENTITY_FEATURES");
    expect(persisted).toContain("V1_MAX_LOCKED_MATERIALS");
    expect(persisted).toContain("V1_MAX_LOCKED_COLOURS");
  });

  it("C-2 · ranges file contains the merchant-facing view-angle vocabulary", () => {
    const persisted = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    // Vocabulary the merchant will read: "front", "three-quarter", etc.
    expect(persisted).toContain('"front"');
    expect(persisted).toContain('"rear"');
    expect(persisted).toContain('"three_quarter_left"');
    expect(persisted).toContain('"three_quarter_right"');
    expect(persisted).toContain('"eye_level"');
  });

  it("C-3 · ranges file contains focal-length + colour-space + criticality vocabularies", () => {
    const persisted = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    expect(persisted).toContain('"wide"');
    expect(persisted).toContain('"standard"');
    expect(persisted).toContain('"telephoto"');
    expect(persisted).toContain('"sRGB"');
    expect(persisted).toContain('"absolute"');
    expect(persisted).toContain('"advisory"');
  });

  it("C-4 · ranges file declares the refusal-reason vocabulary with 12 members", () => {
    const persisted = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    expect(persisted).toContain("VisualConstraintContractRefusalReason");
    expect(persisted).toContain('"V1_INVALID_IDENTITY_FEATURE"');
    expect(persisted).toContain('"V1_INVALID_GEOMETRY_LOCK"');
    expect(persisted).toContain('"V1_INVALID_CAMERA_LOCK"');
    expect(persisted).toContain('"V1_INVALID_COMPOSITION_LOCK"');
    expect(persisted).toContain('"V1_INVALID_MATERIAL_LOCK"');
    expect(persisted).toContain('"V1_INVALID_COLOUR_LOCK"');
    expect(persisted).toContain('"V1_INVALID_PROVENANCE"');
    expect(persisted).toContain('"V1_MAX_ARRAY_LENGTH_EXCEEDED"');
    expect(persisted).toContain('"V1_INVALID_STRING_CONTENT"');
    expect(persisted).toContain('"V1_DUPLICATE_IDENTITY_FEATURE_ID"');
    expect(persisted).toContain('"V1_DUPLICATE_MATERIAL_ID"');
    expect(persisted).toContain('"V1_DUPLICATE_COLOUR_ID"');
  });

  it("C-5 · ranges file emits _MEMBERS arrays for every literal union (Route 2c behaviour)", () => {
    const persisted = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    expect(persisted).toContain("FeatureCriticality_MEMBERS");
    expect(persisted).toContain("ViewAngleKind_MEMBERS");
    expect(persisted).toContain("HeightRelativeKind_MEMBERS");
    expect(persisted).toContain("FocalLengthKind_MEMBERS");
    expect(persisted).toContain("ColourSpaceKind_MEMBERS");
    expect(persisted).toContain("PromotionState_MEMBERS");
    expect(persisted).toContain("AuthoredByKind_MEMBERS");
  });

  it("C-6 · contract file declares all 9 interfaces the merchant will read", () => {
    const persisted = readFileSync(PERSISTED_CONTRACT_PATH, "utf8");
    expect(persisted).toContain("interface IdentityFeature");
    expect(persisted).toContain("interface ComponentCount");
    expect(persisted).toContain("interface GeometryLock");
    expect(persisted).toContain("interface CameraLock");
    expect(persisted).toContain("interface CompositionLock");
    expect(persisted).toContain("interface MaterialLock");
    expect(persisted).toContain("interface ColourLock");
    expect(persisted).toContain("interface ContractProvenance");
    expect(persisted).toContain("interface VisualConstraintContract");
  });

  it("C-7 · contract file imports categorical types via type-only imports from ranges", () => {
    const persisted = readFileSync(PERSISTED_CONTRACT_PATH, "utf8");
    expect(persisted).toContain("import type");
    expect(persisted).toContain("./visual-constraint-contract-ranges");
    expect(persisted).toContain("FeatureCriticality");
    expect(persisted).toContain("ViewAngleKind");
    expect(persisted).toContain("HeightRelativeKind");
    expect(persisted).toContain("FocalLengthKind");
    expect(persisted).toContain("ColourSpaceKind");
    expect(persisted).toContain("PromotionState");
    expect(persisted).toContain("AuthoredByKind");
  });

  it("C-8 · contract's top-level VisualConstraintContract wires every load-bearing field", () => {
    const persisted = readFileSync(PERSISTED_CONTRACT_PATH, "utf8");
    // These are the fields a merchant needs to read to say
    // "yes, that is what my staircase is."
    expect(persisted).toContain("contract_id");
    expect(persisted).toContain("subject_kind");
    expect(persisted).toContain("identity_features");
    expect(persisted).toContain("geometry");
    expect(persisted).toContain("camera");
    expect(persisted).toContain("composition");
    expect(persisted).toContain("locked_materials");
    expect(persisted).toContain("locked_colours");
    expect(persisted).toContain("provenance");
  });

  it("C-9 · ColourLock exposes tolerance-bounded ranges (not point colours)", () => {
    const persisted = readFileSync(PERSISTED_CONTRACT_PATH, "utf8");
    expect(persisted).toContain("hue_min");
    expect(persisted).toContain("hue_max");
    expect(persisted).toContain("saturation_min");
    expect(persisted).toContain("saturation_max");
    expect(persisted).toContain("lightness_min");
    expect(persisted).toContain("lightness_max");
    expect(persisted).toContain("tolerance_deltaE");
  });
});

// ── §D · Determinism ───────────────────────────────────────────────────

describe("§36-V1 · V1 · determinism", () => {
  it("D-1 · ranges re-emission produces byte-identical content", () => {
    const a = emitRanges();
    const b = emitRanges();
    expect(a.sha).toBe(b.sha);
    expect(a.content).toBe(b.content);
  });

  it("D-2 · contract re-emission produces byte-identical content", () => {
    const a = emitContract();
    const b = emitContract();
    expect(a.sha).toBe(b.sha);
    expect(a.content).toBe(b.content);
  });
});

// ── §E · Anti-injection sanity ─────────────────────────────────────────

describe("§36-V1 · V1 · anti-injection sanity", () => {
  it("E-1 · neither emitted file contains prohibited execution patterns", () => {
    const ranges = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    const contract = readFileSync(PERSISTED_CONTRACT_PATH, "utf8");
    for (const bad of ["eval(", "new Function", "child_process", "<script", "process.exit(", "require("]) {
      expect(ranges).not.toContain(bad);
      expect(contract).not.toContain(bad);
    }
  });

  it("E-2 · neither emitted file references any external AI provider name", () => {
    const ranges = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    const contract = readFileSync(PERSISTED_CONTRACT_PATH, "utf8");
    for (const provider of ["anthropic", "claude", "openai", "gpt-", "gemini", "midjourney", "dall-e", "stability", "flux."]) {
      expect(ranges.toLowerCase()).not.toContain(provider);
      expect(contract.toLowerCase()).not.toContain(provider);
    }
  });
});
