// §36-E-1 · WAVE-E1 · 2026-09-14 · execution-bridge
// NEX bounded infrastructure · execution-bridge tests · 2026-09-14

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { bridgeExecution } from "../execution-bridge";
import type {
  AuthorisedTarget,
  ExecutionBridgeFailure,
  ExecutionBridgeRequest,
  ExecutionBridgeResult,
  ExecutionBridgeSuccess,
} from "../execution-bridge-types";
import type { TypedDataContractSpec, StyleProfile } from "../../programming-mission/types";

function asSuccess(r: ExecutionBridgeResult): ExecutionBridgeSuccess {
  if (!r.ok) throw new Error(`expected success · got ${r.refusal_code} · ${r.reason}`);
  return r;
}
function asFailure(r: ExecutionBridgeResult): ExecutionBridgeFailure {
  if (r.ok) throw new Error("expected failure · got success");
  return r;
}

const STYLE: StyleProfile = {
  naming_convention: "snake_case",
  export_style: "named",
  semicolons: "yes",
  quote_style: "double",
  test_framework: "vitest",
  detected_from_files: [],
  detection_confidence: "high",
};

const MINIMAL_SPEC: TypedDataContractSpec = {
  contract_name: "sample_contract",
  type_only_imports: [],
  declarations: [
    {
      declaration_kind: "literal_union",
      name: "COLOUR",
      literals: ["red", "green", "blue"],
      exported: true,
    },
  ],
  header_comment: "// sample",
  runtime_imports: [],
};

const TARGET_PATH = "src/lib/foo/generated-contract.ts";

function baseReq(overrides?: Partial<ExecutionBridgeRequest>): ExecutionBridgeRequest {
  const authorised: AuthorisedTarget[] = overrides?.authorised_file_set
    ? [...overrides.authorised_file_set]
    : [{ workspace_relative_path: TARGET_PATH, expected_change_kind: "file_new", current_sha256_hex: null }];
  return {
    mission_id: overrides?.mission_id ?? "M-abc123",
    workspace_root: overrides?.workspace_root ?? "/tmp/workspace",
    authorised_file_set: authorised,
    spec: overrides?.spec ?? MINIMAL_SPEC,
    target_path: overrides?.target_path ?? TARGET_PATH,
    style: overrides?.style ?? STYLE,
    clock: overrides?.clock ?? (() => new Date("2026-09-14T12:00:00.000Z")),
  };
}

// ══════════════════════════════════════════════════════════════════════
// §A · Positive path (6)
// ══════════════════════════════════════════════════════════════════════

describe("§36-E-1 · E1 · §A · positive path", () => {
  it("A-1 · authorised target + valid spec → success with proposed_content", () => {
    const r = asSuccess(bridgeExecution(baseReq()));
    expect(r.emitted_files.length).toBe(1);
    expect(r.emitted_files[0].workspace_relative_path).toBe(TARGET_PATH);
    expect(r.proposed_content).toContain("COLOUR");
  });
  it("A-2 · emitted_files[0].proposed_bytes_sha256 is a 64-hex string", () => {
    const r = asSuccess(bridgeExecution(baseReq()));
    expect(r.emitted_files[0].proposed_bytes_sha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it("A-3 · evidence_sha256 is a 64-hex string", () => {
    const r = asSuccess(bridgeExecution(baseReq()));
    expect(r.evidence_sha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it("A-4 · file_new kind reflected in emitted_file", () => {
    const r = asSuccess(bridgeExecution(baseReq()));
    expect(r.emitted_files[0].kind).toBe("file_new");
    expect(r.emitted_files[0].current_sha256_declared).toBeNull();
  });
  it("A-5 · file_content kind carries current_sha256_declared", () => {
    const shaHex = "a".repeat(64);
    const r = asSuccess(bridgeExecution(baseReq({
      authorised_file_set: [{ workspace_relative_path: TARGET_PATH, expected_change_kind: "file_content", current_sha256_hex: shaHex }],
    })));
    expect(r.emitted_files[0].kind).toBe("file_content");
    expect(r.emitted_files[0].current_sha256_declared).toBe(shaHex);
  });
  it("A-6 · typed_data_contract_source labels the authoring primitive", () => {
    const r = asSuccess(bridgeExecution(baseReq()));
    expect(r.emitted_files[0].typed_data_contract_source).toBe("authorTypedDataContract");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §B · Determinism (4)
// ══════════════════════════════════════════════════════════════════════

describe("§36-E-1 · E1 · §B · determinism", () => {
  it("B-1 · identical inputs → identical evidence_sha256", () => {
    const a = asSuccess(bridgeExecution(baseReq()));
    const b = asSuccess(bridgeExecution(baseReq()));
    expect(a.evidence_sha256).toBe(b.evidence_sha256);
  });
  it("B-2 · identical inputs → identical proposed_content", () => {
    const a = asSuccess(bridgeExecution(baseReq()));
    const b = asSuccess(bridgeExecution(baseReq()));
    expect(a.proposed_content).toBe(b.proposed_content);
  });
  it("B-3 · injected clock deterministic", () => {
    const r = asSuccess(bridgeExecution(baseReq({ clock: () => new Date("2030-01-01T00:00:00.000Z") })));
    expect(r.assessed_at).toBe("2030-01-01T00:00:00.000Z");
  });
  it("B-4 · different mission_id → different evidence_sha256", () => {
    const a = asSuccess(bridgeExecution(baseReq({ mission_id: "M-aaaa" })));
    const b = asSuccess(bridgeExecution(baseReq({ mission_id: "M-bbbb" })));
    expect(a.evidence_sha256).not.toBe(b.evidence_sha256);
  });
});

// ══════════════════════════════════════════════════════════════════════
// §C · Authorisation refusals (locked whitelist enforcement · 6)
// ══════════════════════════════════════════════════════════════════════

describe("§36-E-1 · E1 · §C · authorisation whitelist", () => {
  it("C-1 · target_path not in authorised_file_set → WE_UNAUTHORISED_TARGET", () => {
    const r = asFailure(bridgeExecution(baseReq({
      target_path: "src/lib/other/unauthorised.ts",
      // authorised_file_set defaults to only TARGET_PATH
    })));
    expect(r.refusal_code).toBe("WE_UNAUTHORISED_TARGET");
    expect(r.offending_field).toBe("src/lib/other/unauthorised.ts");
  });
  it("C-2 · authorised_file_set empty → WE_INVALID_REQUEST", () => {
    const r = asFailure(bridgeExecution(baseReq({ authorised_file_set: [] })));
    expect(r.refusal_code).toBe("WE_INVALID_REQUEST");
  });
  it("C-3 · authorised target with malformed path (target_path valid) → WE_INVALID_AUTHORISED_TARGET", () => {
    // target_path is valid; but one entry in authorised_file_set has a malformed path.
    const r = asFailure(bridgeExecution(baseReq({
      target_path: TARGET_PATH,
      authorised_file_set: [
        { workspace_relative_path: "..", expected_change_kind: "file_new", current_sha256_hex: null },
        { workspace_relative_path: TARGET_PATH, expected_change_kind: "file_new", current_sha256_hex: null },
      ],
    })));
    expect(r.refusal_code).toBe("WE_INVALID_AUTHORISED_TARGET");
  });
  it("C-4 · file_new with non-null current_sha256_hex → WE_INVALID_AUTHORISED_TARGET", () => {
    const r = asFailure(bridgeExecution(baseReq({
      authorised_file_set: [{ workspace_relative_path: TARGET_PATH, expected_change_kind: "file_new", current_sha256_hex: "a".repeat(64) }],
    })));
    expect(r.refusal_code).toBe("WE_INVALID_AUTHORISED_TARGET");
  });
  it("C-5 · file_content with invalid current_sha256_hex → WE_INVALID_AUTHORISED_TARGET", () => {
    const r = asFailure(bridgeExecution(baseReq({
      authorised_file_set: [{ workspace_relative_path: TARGET_PATH, expected_change_kind: "file_content", current_sha256_hex: "not-hex" }],
    })));
    expect(r.refusal_code).toBe("WE_INVALID_AUTHORISED_TARGET");
  });
  it("C-6 · authorised_file_set length > 32 → WE_INVALID_REQUEST", () => {
    const many: AuthorisedTarget[] = Array.from({ length: 33 }, (_, i) => ({
      workspace_relative_path: `src/lib/a/f${i}.ts`,
      expected_change_kind: "file_new" as const,
      current_sha256_hex: null,
    }));
    const r = asFailure(bridgeExecution(baseReq({ authorised_file_set: many })));
    expect(r.refusal_code).toBe("WE_INVALID_REQUEST");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §D · Refusal propagation from typed_data_contract (3)
// ══════════════════════════════════════════════════════════════════════

describe("§36-E-1 · E1 · §D · TDC refusal propagation", () => {
  it("D-1 · malformed spec (empty declarations) → WE_INVALID_SPEC", () => {
    const badSpec: TypedDataContractSpec = { ...MINIMAL_SPEC, declarations: [] };
    const r = asFailure(bridgeExecution(baseReq({ spec: badSpec })));
    expect(r.refusal_code).toBe("WE_INVALID_SPEC");
  });
  it("D-2 · invalid contract_name propagates as WE_TYPED_DATA_CONTRACT_REFUSED", () => {
    const badSpec: TypedDataContractSpec = { ...MINIMAL_SPEC, contract_name: "<script>" };
    const r = asFailure(bridgeExecution(baseReq({ spec: badSpec })));
    expect(r.refusal_code).toBe("WE_TYPED_DATA_CONTRACT_REFUSED");
    expect(r.propagated_refusal_code).toBe("TDC_PROHIBITED_STRING_CONTENT");
  });
  it("D-3 · target path .txt (unsupported extension) propagates as WE_TYPED_DATA_CONTRACT_REFUSED", () => {
    const r = asFailure(bridgeExecution(baseReq({
      target_path: "src/lib/foo/generated.txt",
      authorised_file_set: [{
        workspace_relative_path: "src/lib/foo/generated.txt",
        expected_change_kind: "file_new",
        current_sha256_hex: null,
      }],
    })));
    expect(r.refusal_code).toBe("WE_TYPED_DATA_CONTRACT_REFUSED");
    expect(r.propagated_refusal_code).toBe("TDC_INVALID_EXTENSION");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §E · Path safety (5)
// ══════════════════════════════════════════════════════════════════════

describe("§36-E-1 · E1 · §E · path safety", () => {
  it("E-1 · target_path with '..' → WE_INVALID_REQUEST", () => {
    const r = asFailure(bridgeExecution(baseReq({
      target_path: "src/../etc/passwd.ts",
      authorised_file_set: [{ workspace_relative_path: "src/../etc/passwd.ts", expected_change_kind: "file_new", current_sha256_hex: null }],
    })));
    expect(r.refusal_code).toBe("WE_INVALID_REQUEST");
  });
  it("E-2 · absolute path → WE_INVALID_REQUEST", () => {
    const r = asFailure(bridgeExecution(baseReq({
      target_path: "/etc/passwd.ts",
      authorised_file_set: [{ workspace_relative_path: "/etc/passwd.ts", expected_change_kind: "file_new", current_sha256_hex: null }],
    })));
    expect(r.refusal_code).toBe("WE_INVALID_REQUEST");
  });
  it("E-3 · Windows absolute path → WE_INVALID_REQUEST", () => {
    const r = asFailure(bridgeExecution(baseReq({
      target_path: "C:/etc/x.ts",
      authorised_file_set: [{ workspace_relative_path: "C:/etc/x.ts", expected_change_kind: "file_new", current_sha256_hex: null }],
    })));
    expect(r.refusal_code).toBe("WE_INVALID_REQUEST");
  });
  it("E-4 · protocol scheme in path → WE_INVALID_REQUEST", () => {
    const r = asFailure(bridgeExecution(baseReq({
      target_path: "file:src/lib/foo/x.ts",
      authorised_file_set: [{ workspace_relative_path: "file:src/lib/foo/x.ts", expected_change_kind: "file_new", current_sha256_hex: null }],
    })));
    expect(r.refusal_code).toBe("WE_INVALID_REQUEST");
  });
  it("E-5 · prohibited substring in path → WE_INVALID_REQUEST", () => {
    const r = asFailure(bridgeExecution(baseReq({
      target_path: "src/lib/foo/<script>.ts",
      authorised_file_set: [{ workspace_relative_path: "src/lib/foo/<script>.ts", expected_change_kind: "file_new", current_sha256_hex: null }],
    })));
    expect(r.refusal_code).toBe("WE_INVALID_REQUEST");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §F · Mission-id validation (3)
// ══════════════════════════════════════════════════════════════════════

describe("§36-E-1 · E1 · §F · mission_id validation", () => {
  it("F-1 · empty mission_id → WE_INVALID_REQUEST", () => {
    const r = asFailure(bridgeExecution(baseReq({ mission_id: "" })));
    expect(r.refusal_code).toBe("WE_INVALID_REQUEST");
  });
  it("F-2 · mission_id with invalid chars → WE_INVALID_REQUEST", () => {
    const r = asFailure(bridgeExecution(baseReq({ mission_id: "M-abc#123" })));
    expect(r.refusal_code).toBe("WE_INVALID_REQUEST");
  });
  it("F-3 · valid mission_id (alphanumeric + underscore + hyphen) → success", () => {
    const r = asSuccess(bridgeExecution(baseReq({ mission_id: "M_test-01" })));
    expect(r.mission_id).toBe("M_test-01");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §G · Boundary preservation (6 static-grep tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-E-1 · E1 · §G · boundary preservation", () => {
  const primitivePath = path.resolve(__dirname, "..", "execution-bridge.ts");
  const src = fs.readFileSync(primitivePath, "utf8");
  it("G-1 · no fs.* filesystem writes/reads", () => {
    expect(src).not.toMatch(/\bfs\.(readFileSync|readdirSync|statSync|readFile|readdir|stat|open|write|mkdir|unlink|rmdir|rmSync|appendFile|copyFile|rename|chmod|chown)/);
  });
  it("G-2 · no subprocess", () => {
    expect(src).not.toMatch(/\b(child_process|spawnSync|execSync|fork\()/);
    expect(src.match(/\bexec\(/g) ?? []).toHaveLength(0);
  });
  it("G-3 · no network", () => {
    expect(src).not.toMatch(/\b(fetch\(|http\.|https\.|dns\.|net\.|WebSocket)/);
  });
  it("G-4 · no writes", () => {
    expect(src).not.toMatch(/\b(writeFile|writeFileSync|mkdirSync|unlink|rmdir|rmSync|appendFile|copyFile|rename|chmod|chown)/);
  });
  it("G-5 · synchronous", () => {
    expect(src).not.toMatch(/\basync\s+function|\bawait\s+|\bPromise\./);
  });
  it("G-6 · no LLM", () => {
    expect(src.toLowerCase()).not.toMatch(/anthropic|openai|\bllm\b/);
  });
});

// ══════════════════════════════════════════════════════════════════════
// §H · Anti-pattern discipline (2)
// ══════════════════════════════════════════════════════════════════════

describe("§36-E-1 · E1 · §H · anti-pattern", () => {
  it("H-1 · output contains no 'write' or 'commit' or 'file_written' fields", () => {
    const r = asSuccess(bridgeExecution(baseReq()));
    const s = JSON.stringify(r);
    expect(s).not.toContain('"file_written"');
    expect(s).not.toContain('"commit"');
    expect(s).not.toContain('"applied"');
    expect(s).not.toContain('"executed"');
  });
  it("H-2 · TDC refusals propagate verbatim (never repackaged)", () => {
    const badSpec: TypedDataContractSpec = { ...MINIMAL_SPEC, contract_name: "eval(1)" };
    const r = asFailure(bridgeExecution(baseReq({ spec: badSpec })));
    expect(r.refusal_code).toBe("WE_TYPED_DATA_CONTRACT_REFUSED");
    expect(r.propagated_refusal_code).toBeDefined();
    expect(r.propagated_reason).toBeDefined();
  });
});
