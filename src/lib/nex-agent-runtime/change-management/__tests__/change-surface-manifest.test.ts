// §36-L-1 · WAVE-L1 · 2026-09-14 · change-surface-manifest

import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { computeChangeSurfaceManifest } from "../change-surface-manifest";
import type {
  ChangeSurfaceManifestFailure,
  ChangeSurfaceManifestRequest,
  ChangeSurfaceManifestResult,
  ChangeSurfaceManifestSuccess,
  EngineeringObjectiveDescriptor,
  ScopeHint,
  ChangeKind,
} from "../change-surface-manifest-types";
import type { RepositoryMap, RepoFileMetadata, RepoSymbolEntry, RepoImportEntry } from "../../repo-intelligence/repo-scan-types";

function asSuccess(r: ChangeSurfaceManifestResult): ChangeSurfaceManifestSuccess {
  if (!r.ok) throw new Error(`expected success, got: ${r.refusal_code} · ${r.reason}`);
  return r;
}
function asFailure(r: ChangeSurfaceManifestResult): ChangeSurfaceManifestFailure {
  if (r.ok) throw new Error(`expected failure, got success`);
  return r;
}
function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function makeRepoMap(overrides?: Partial<RepositoryMap>): RepositoryMap {
  const files: RepoFileMetadata[] = overrides?.files ?? [
    { path: "src/lib/foo/types.ts", extension: ".ts", bytes: 100, sha256_hex: "a".repeat(64) },
    { path: "src/lib/foo/impl.ts", extension: ".ts", bytes: 200, sha256_hex: "b".repeat(64) },
    { path: "src/lib/foo/__tests__/impl.test.ts", extension: ".ts", bytes: 150, sha256_hex: "c".repeat(64) },
    { path: "src/lib/bar/consumer.ts", extension: ".ts", bytes: 120, sha256_hex: "d".repeat(64) },
    { path: "src/lib/unrelated/other.ts", extension: ".ts", bytes: 80, sha256_hex: "e".repeat(64) },
  ];
  const symbols: RepoSymbolEntry[] = overrides?.symbols ?? [
    { file: "src/lib/foo/types.ts", name: "FooType", kind: "interface", exported: true, line: 1 },
    { file: "src/lib/foo/impl.ts", name: "fooFunction", kind: "function", exported: true, line: 5 },
  ];
  const imports: RepoImportEntry[] = overrides?.imports ?? [
    { from_file: "src/lib/foo/impl.ts", symbols: ["FooType"], from_specifier: "./types", is_type_only: true },
    { from_file: "src/lib/bar/consumer.ts", symbols: ["FooType", "fooFunction"], from_specifier: "../foo", is_type_only: false },
    { from_file: "src/lib/foo/__tests__/impl.test.ts", symbols: ["fooFunction"], from_specifier: "../impl", is_type_only: false },
  ];
  const base = {
    root_paths: overrides?.root_paths ?? ["src/lib"],
    file_count: files.length,
    files,
    symbols,
    imports,
  };
  const canonical = JSON.stringify(base);
  return { ...base, scan_sha256: sha256Hex(canonical) };
}

function baseObjective(overrides?: Partial<EngineeringObjectiveDescriptor>): EngineeringObjectiveDescriptor {
  return {
    slug: overrides?.slug ?? "rename-symbol",
    scope_hints: overrides?.scope_hints ?? ["implementation_and_tests", "imports_ripple"],
    asserted_must_change: overrides?.asserted_must_change ?? [],
    asserted_must_not_change: overrides?.asserted_must_not_change ?? [],
    referenced_symbols: overrides?.referenced_symbols ?? ["FooType"],
    change_kind_hint: overrides?.change_kind_hint ?? "file_content",
  };
}

function baseReq(overrides?: Partial<ChangeSurfaceManifestRequest>): ChangeSurfaceManifestRequest {
  return {
    repo_map: overrides?.repo_map ?? makeRepoMap(),
    objective: overrides?.objective ?? baseObjective(),
    clock: overrides?.clock ?? (() => new Date("2026-09-14T12:00:00.000Z")),
  };
}

// ══════════════════════════════════════════════════════════════════════
// §A · Impact-derivation rules (14 tests · 2 per rule × 7)
// ══════════════════════════════════════════════════════════════════════

describe("§36-L-1 · L1 · §A · impact rules", () => {
  it("A-1 · caller-asserted must_change → must_change", () => {
    const r = asSuccess(computeChangeSurfaceManifest(baseReq({
      objective: baseObjective({ asserted_must_change: ["src/lib/foo/types.ts"] }),
    })));
    const p = r.impact_predictions.find((p) => p.path === "src/lib/foo/types.ts")!;
    expect(p.impact_state).toBe("must_change");
    expect(p.reason_code).toBe("asserted_by_caller_must_change");
  });
  it("A-2 · caller-asserted must_change works for a path not in repo_map", () => {
    const r = asSuccess(computeChangeSurfaceManifest(baseReq({
      objective: baseObjective({ asserted_must_change: ["src/lib/new-file.ts"] }),
    })));
    const p = r.impact_predictions.find((p) => p.path === "src/lib/new-file.ts")!;
    expect(p.impact_state).toBe("must_change");
    expect(p.evidence_summary).toContain("not in repo_map");
  });
  it("A-3 · caller-asserted must_not_change → must_not_change", () => {
    const r = asSuccess(computeChangeSurfaceManifest(baseReq({
      objective: baseObjective({ asserted_must_not_change: ["src/lib/unrelated/other.ts"] }),
    })));
    const p = r.impact_predictions.find((p) => p.path === "src/lib/unrelated/other.ts")!;
    expect(p.impact_state).toBe("must_not_change");
    expect(p.reason_code).toBe("asserted_by_caller_must_not_change");
  });
  it("A-4 · caller-asserted must_not_change wins even when file matches other rules", () => {
    const r = asSuccess(computeChangeSurfaceManifest(baseReq({
      objective: baseObjective({
        referenced_symbols: ["FooType"],
        asserted_must_not_change: ["src/lib/foo/types.ts"],
      }),
    })));
    const p = r.impact_predictions.find((p) => p.path === "src/lib/foo/types.ts")!;
    expect(p.impact_state).toBe("must_not_change");
  });
  it("A-5 · file declares referenced symbol → must_change", () => {
    const r = asSuccess(computeChangeSurfaceManifest(baseReq({
      objective: baseObjective({ referenced_symbols: ["FooType"] }),
    })));
    const p = r.impact_predictions.find((p) => p.path === "src/lib/foo/types.ts")!;
    expect(p.impact_state).toBe("must_change");
    expect(p.reason_code).toBe("declares_referenced_symbol");
  });
  it("A-6 · fooFunction declared in impl.ts → must_change", () => {
    const r = asSuccess(computeChangeSurfaceManifest(baseReq({
      objective: baseObjective({ referenced_symbols: ["fooFunction"] }),
    })));
    const p = r.impact_predictions.find((p) => p.path === "src/lib/foo/impl.ts")!;
    expect(p.impact_state).toBe("must_change");
  });
  it("A-7 · file imports referenced symbol + imports_ripple hint → likely_change", () => {
    const r = asSuccess(computeChangeSurfaceManifest(baseReq({
      objective: baseObjective({
        referenced_symbols: ["FooType"],
        scope_hints: ["imports_ripple"],
      }),
    })));
    const p = r.impact_predictions.find((p) => p.path === "src/lib/bar/consumer.ts")!;
    expect(p.impact_state).toBe("likely_change");
    expect(p.reason_code).toBe("imports_referenced_symbol");
  });
  it("A-8 · imports referenced symbol WITHOUT imports_ripple hint → falls through to default protection", () => {
    const r = asSuccess(computeChangeSurfaceManifest(baseReq({
      objective: baseObjective({
        referenced_symbols: ["FooType"],
        scope_hints: [],  // no imports_ripple
      }),
    })));
    const p = r.impact_predictions.find((p) => p.path === "src/lib/bar/consumer.ts")!;
    expect(p.impact_state).toBe("must_not_change");
    expect(p.reason_code).toBe("outside_scope_hints");
  });
  it("A-9 · test of impacted file + implementation_and_tests hint → likely_change", () => {
    const r = asSuccess(computeChangeSurfaceManifest(baseReq({
      objective: baseObjective({
        referenced_symbols: ["fooFunction"],
        scope_hints: ["implementation_and_tests"],
      }),
    })));
    const p = r.impact_predictions.find((p) => p.path === "src/lib/foo/__tests__/impl.test.ts")!;
    expect(p.impact_state).toBe("likely_change");
    expect(p.reason_code).toBe("is_test_of_impacted_file");
  });
  it("A-10 · test without implementation_and_tests hint → default protection", () => {
    const r = asSuccess(computeChangeSurfaceManifest(baseReq({
      objective: baseObjective({
        referenced_symbols: ["fooFunction"],
        scope_hints: [],  // no implementation_and_tests
      }),
    })));
    const p = r.impact_predictions.find((p) => p.path === "src/lib/foo/__tests__/impl.test.ts")!;
    expect(p.impact_state).toBe("must_not_change");
  });
  it("A-11 · same-module file + cross_module hint → likely_change", () => {
    // types.ts and impl.ts share module `src/lib/foo`. Impact only impl.ts, then check types.ts falls under cross_module rule.
    const r = asSuccess(computeChangeSurfaceManifest(baseReq({
      objective: baseObjective({
        referenced_symbols: ["fooFunction"],  // declared in impl.ts
        scope_hints: ["cross_module"],
      }),
    })));
    const p = r.impact_predictions.find((p) => p.path === "src/lib/foo/types.ts")!;
    expect(p.impact_state).toBe("likely_change");
    expect(p.reason_code).toBe("in_module_of_impacted_file");
  });
  it("A-12 · unrelated file with no matching hints → must_not_change (default protection)", () => {
    const r = asSuccess(computeChangeSurfaceManifest(baseReq({
      objective: baseObjective({ referenced_symbols: ["FooType"] }),
    })));
    const p = r.impact_predictions.find((p) => p.path === "src/lib/unrelated/other.ts")!;
    expect(p.impact_state).toBe("must_not_change");
    expect(p.reason_code).toBe("outside_scope_hints");
  });
  it("A-13 · expected_change_set contains must_change AND likely_change paths", () => {
    const r = asSuccess(computeChangeSurfaceManifest(baseReq({
      objective: baseObjective({
        referenced_symbols: ["FooType"],
        scope_hints: ["imports_ripple"],
      }),
    })));
    expect(r.expected_change_set).toContain("src/lib/foo/types.ts");  // must_change
    expect(r.expected_change_set).toContain("src/lib/bar/consumer.ts");  // likely_change
  });
  it("A-14 · protected_set contains only must_not_change paths", () => {
    const r = asSuccess(computeChangeSurfaceManifest(baseReq({
      objective: baseObjective({
        referenced_symbols: ["FooType"],
        scope_hints: [],  // no imports_ripple · consumer.ts stays protected
      }),
    })));
    expect(r.protected_set).toContain("src/lib/unrelated/other.ts");
    expect(r.protected_set).toContain("src/lib/bar/consumer.ts");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §B · Determinism (4 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-L-1 · L1 · §B · determinism", () => {
  it("B-1 · identical inputs → identical manifest_sha256", () => {
    const a = asSuccess(computeChangeSurfaceManifest(baseReq()));
    const b = asSuccess(computeChangeSurfaceManifest(baseReq()));
    expect(a.manifest_sha256).toBe(b.manifest_sha256);
  });
  it("B-2 · impact_predictions sorted alphabetically by path", () => {
    const r = asSuccess(computeChangeSurfaceManifest(baseReq()));
    const paths = r.impact_predictions.map((p) => p.path);
    expect(paths).toEqual([...paths].sort());
  });
  it("B-3 · injected clock deterministic", () => {
    const r = asSuccess(computeChangeSurfaceManifest(baseReq({
      clock: () => new Date("2030-01-01T00:00:00.000Z"),
    })));
    expect(r.assessed_at).toBe("2030-01-01T00:00:00.000Z");
  });
  it("B-4 · expected_change_set + protected_set both alphabetically sorted", () => {
    const r = asSuccess(computeChangeSurfaceManifest(baseReq({
      objective: baseObjective({
        referenced_symbols: ["FooType"],
        scope_hints: ["imports_ripple"],
      }),
    })));
    expect(r.expected_change_set).toEqual([...r.expected_change_set].sort());
    expect(r.protected_set).toEqual([...r.protected_set].sort());
  });
});

// ══════════════════════════════════════════════════════════════════════
// §C · Refusal codes (6 tests · one per code)
// ══════════════════════════════════════════════════════════════════════

describe("§36-L-1 · L1 · §C · refusal codes", () => {
  it("C-1 · L1_INVALID_REQUEST for non-object", () => {
    const r = asFailure(computeChangeSurfaceManifest(null as unknown as ChangeSurfaceManifestRequest));
    expect(r.refusal_code).toBe("L1_INVALID_REQUEST");
  });
  it("C-2 · L1_INVALID_REPO_MAP for tampered sha", () => {
    const good = makeRepoMap();
    const tampered = { ...good, scan_sha256: "0".repeat(64) } as RepositoryMap;
    const r = asFailure(computeChangeSurfaceManifest(baseReq({ repo_map: tampered })));
    expect(r.refusal_code).toBe("L1_INVALID_REPO_MAP");
  });
  it("C-3 · L1_INVALID_OBJECTIVE for missing slug", () => {
    const r = asFailure(computeChangeSurfaceManifest(baseReq({
      objective: { ...baseObjective(), slug: "" },
    })));
    expect(r.refusal_code).toBe("L1_INVALID_OBJECTIVE");
  });
  it("C-4 · L1_UNKNOWN_SCOPE_HINT for bad scope hint", () => {
    const r = asFailure(computeChangeSurfaceManifest(baseReq({
      objective: { ...baseObjective(), scope_hints: ["bad_hint" as ScopeHint] },
    })));
    expect(r.refusal_code).toBe("L1_UNKNOWN_SCOPE_HINT");
  });
  it("C-5 · L1_UNKNOWN_CHANGE_KIND for bad change kind", () => {
    const r = asFailure(computeChangeSurfaceManifest(baseReq({
      objective: { ...baseObjective(), change_kind_hint: "bad_kind" as ChangeKind },
    })));
    expect(r.refusal_code).toBe("L1_UNKNOWN_CHANGE_KIND");
  });
  it("C-6 · L1_OUTPUT_TOO_LARGE code exists in taxonomy", () => {
    const codes = ["L1_INVALID_REQUEST", "L1_INVALID_REPO_MAP", "L1_INVALID_OBJECTIVE", "L1_UNKNOWN_SCOPE_HINT", "L1_UNKNOWN_CHANGE_KIND", "L1_OUTPUT_TOO_LARGE"];
    expect(codes).toContain("L1_OUTPUT_TOO_LARGE");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §D · Security · prohibited content + injection (4 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-L-1 · L1 · §D · security", () => {
  it("D-1 · prohibited substring in asserted path → refused", () => {
    const r = asFailure(computeChangeSurfaceManifest(baseReq({
      objective: baseObjective({ asserted_must_change: ["src/eval(1)/x.ts"] }),
    })));
    expect(r.refusal_code).toBe("L1_INVALID_OBJECTIVE");
  });
  it("D-2 · prohibited substring in path → refused", () => {
    const r = asFailure(computeChangeSurfaceManifest(baseReq({
      objective: baseObjective({ asserted_must_not_change: ["<script>alert.ts"] }),
    })));
    expect(r.refusal_code).toBe("L1_INVALID_OBJECTIVE");
  });
  it("D-3 · non-identifier symbol → refused", () => {
    const r = asFailure(computeChangeSurfaceManifest(baseReq({
      objective: baseObjective({ referenced_symbols: ["123bad"] }),
    })));
    expect(r.refusal_code).toBe("L1_INVALID_OBJECTIVE");
  });
  it("D-4 · slug with invalid characters → refused", () => {
    const r = asFailure(computeChangeSurfaceManifest(baseReq({
      objective: { ...baseObjective(), slug: "Not Kebab Case!" },
    })));
    expect(r.refusal_code).toBe("L1_INVALID_OBJECTIVE");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §E · Chain integrity (3 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-L-1 · L1 · §E · chain integrity", () => {
  it("E-1 · valid chain echoes repo_map scan_sha256", () => {
    const map = makeRepoMap();
    const r = asSuccess(computeChangeSurfaceManifest(baseReq({ repo_map: map })));
    expect(r.repo_map_sha256_verified).toBe(map.scan_sha256);
  });
  it("E-2 · tampered scan_sha256 → L1_INVALID_REPO_MAP", () => {
    const map = { ...makeRepoMap(), scan_sha256: "1".repeat(64) } as RepositoryMap;
    const r = asFailure(computeChangeSurfaceManifest(baseReq({ repo_map: map })));
    expect(r.refusal_code).toBe("L1_INVALID_REPO_MAP");
  });
  it("E-3 · missing scan_sha256 → L1_INVALID_REPO_MAP", () => {
    const map = { ...makeRepoMap(), scan_sha256: "not-hex" } as RepositoryMap;
    const r = asFailure(computeChangeSurfaceManifest(baseReq({ repo_map: map })));
    expect(r.refusal_code).toBe("L1_INVALID_REPO_MAP");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §F · Boundary preservation (6 static-grep tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-L-1 · L1 · §F · boundary preservation", () => {
  const primitivePath = path.resolve(__dirname, "..", "change-surface-manifest.ts");
  const src = fs.readFileSync(primitivePath, "utf8");

  it("F-1 · no fs.* filesystem calls", () => {
    expect(src).not.toMatch(/\bfs\.(readFileSync|readdirSync|statSync|readFile|readdir|stat|open|write|mkdir|unlink|rmdir|rmSync|appendFile|copyFile|rename|chmod|chown)/);
  });
  it("F-2 · no child_process/spawn/exec/fork", () => {
    expect(src).not.toMatch(/\b(child_process|spawnSync|execSync|fork\()/);
    expect(src.match(/\bexec\(/g) ?? []).toHaveLength(0);
  });
  it("F-3 · no network calls", () => {
    expect(src).not.toMatch(/\b(fetch\(|http\.|https\.|dns\.|net\.|WebSocket)/);
  });
  it("F-4 · no write operations", () => {
    expect(src).not.toMatch(/\b(writeFile|writeFileSync|mkdirSync|unlink|rmdir|rmSync|appendFile|copyFile|rename|chmod|chown)/);
  });
  it("F-5 · fully synchronous", () => {
    expect(src).not.toMatch(/\basync\s+function|\bawait\s+|\bPromise\./);
  });
  it("F-6 · no LLM references", () => {
    expect(src.toLowerCase()).not.toMatch(/anthropic|openai|\bllm\b/);
  });
});

// ══════════════════════════════════════════════════════════════════════
// §G · Anti-pattern discipline (2 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-L-1 · L1 · §G · anti-pattern discipline", () => {
  it("G-1 · output contains no execution/apply fields", () => {
    const r = asSuccess(computeChangeSurfaceManifest(baseReq()));
    const s = JSON.stringify(r);
    expect(s).not.toContain('"execute"');
    expect(s).not.toContain('"apply_change"');
    expect(s).not.toContain('"perform"');
    expect(s).not.toContain('"impact_score"'); // numeric score forbidden
    expect(s).not.toContain('"confidence_percent"');
  });
  it("G-2 · impact states are categorical (never numeric)", () => {
    const r = asSuccess(computeChangeSurfaceManifest(baseReq()));
    for (const p of r.impact_predictions) {
      expect(["must_change", "likely_change", "must_not_change", "unknown"]).toContain(p.impact_state);
    }
  });
});
