// §36-D-A · ROUTE-R1A · 2026-09-14 · repo-scan
//
// Tests for the read-only repo-scan primitive.
// Every test uses a temp directory · no real repo scanning during tests.

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createHash } from "node:crypto";
import { repoScan } from "../repo-scan";
import type { RepoScanRequest, RepoScanFailure, RepoScanSuccess } from "../repo-scan-types";

// ── Test fixture · synthetic repo mirroring approved structure ─────────

let fixtureRoot: string;

beforeEach(() => {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "repo-scan-fixture-"));
  // Create the approved-root subdirectories with sample files
  const nexAgentRuntime = path.join(fixtureRoot, "src", "lib", "nex-agent-runtime");
  const capLabs = path.join(fixtureRoot, "src", "lib", "capability-labs");
  const buildGates = path.join(fixtureRoot, "docs", "NEX1", "BUILD_GATES");
  fs.mkdirSync(nexAgentRuntime, { recursive: true });
  fs.mkdirSync(capLabs, { recursive: true });
  fs.mkdirSync(buildGates, { recursive: true });

  fs.writeFileSync(path.join(nexAgentRuntime, "example.ts"),
    `// example
export function alpha(x: number): number { return x + 1; }
export const BETA = 42;
export interface Gamma { readonly n: number; }
export type Delta = string;
import type { Epsilon } from "./types";
import { zeta } from "./util";
`);
  fs.writeFileSync(path.join(capLabs, "sample.ts"),
    `export class Sample { m(): void {} }
export enum Mode { ON, OFF }
`);
  fs.writeFileSync(path.join(buildGates, "PLAN.md"),
    `# Plan\n\nContent here.\n`);
  // Also write a prohibited file to ensure it's filtered
  fs.writeFileSync(path.join(fixtureRoot, "src", ".env"), "SECRET=xyz");
  fs.writeFileSync(path.join(fixtureRoot, "src", "credentials.ts"), "export const K = 'x';");
  // Also write an un-approved-extension file
  fs.writeFileSync(path.join(nexAgentRuntime, "config.json"), "{}");
});

afterEach(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

function asSuccess(r: unknown): RepoScanSuccess {
  if (!r || typeof r !== "object" || (r as { ok?: boolean }).ok !== true) {
    throw new Error(`expected success, got: ${JSON.stringify(r).slice(0, 300)}`);
  }
  return r as RepoScanSuccess;
}
function asFailure(r: unknown): RepoScanFailure {
  if (!r || typeof r !== "object" || (r as { ok?: boolean }).ok !== false) {
    throw new Error(`expected failure, got: ${JSON.stringify(r).slice(0, 300)}`);
  }
  return r as RepoScanFailure;
}

function req(overrides: Partial<RepoScanRequest> = {}): RepoScanRequest {
  return {
    read_roots: ["src/lib/nex-agent-runtime/"],
    extensions: [".ts"],
    max_files: 100,
    include_symbols: true,
    include_imports: true,
    ...overrides,
  };
}

// ── Group 1 · Positive ─────────────────────────────────────────────────

describe("R1a · repo-scan · positive", () => {
  it("RSP-1 · scan of approved root produces RepositoryMap with expected file", () => {
    const r = asSuccess(repoScan({ request: req(), repo_root: fixtureRoot }));
    expect(r.map.file_count).toBeGreaterThanOrEqual(1);
    const paths = r.map.files.map((f) => f.path);
    expect(paths).toContain("src/lib/nex-agent-runtime/example.ts");
  });

  it("RSP-2 · file metadata contains sha256_hex + bytes + extension", () => {
    const r = asSuccess(repoScan({ request: req(), repo_root: fixtureRoot }));
    const file = r.map.files.find((f) => f.path === "src/lib/nex-agent-runtime/example.ts");
    expect(file).toBeDefined();
    expect(file!.extension).toBe(".ts");
    expect(file!.bytes).toBeGreaterThan(0);
    expect(file!.sha256_hex).toMatch(/^[0-9a-f]{64}$/);
  });

  it("RSP-3 · symbols extracted include function/const/interface/type", () => {
    const r = asSuccess(repoScan({ request: req(), repo_root: fixtureRoot }));
    const symbols = r.map.symbols.filter((s) => s.file === "src/lib/nex-agent-runtime/example.ts");
    const names = symbols.map((s) => s.name);
    expect(names).toContain("alpha");
    expect(names).toContain("BETA");
    expect(names).toContain("Gamma");
    expect(names).toContain("Delta");
  });

  it("RSP-4 · symbol kinds correctly classified", () => {
    const r = asSuccess(repoScan({ request: req(), repo_root: fixtureRoot }));
    const alpha = r.map.symbols.find((s) => s.name === "alpha");
    const beta = r.map.symbols.find((s) => s.name === "BETA");
    const gamma = r.map.symbols.find((s) => s.name === "Gamma");
    const delta = r.map.symbols.find((s) => s.name === "Delta");
    expect(alpha!.kind).toBe("function");
    expect(beta!.kind).toBe("const");
    expect(gamma!.kind).toBe("interface");
    expect(delta!.kind).toBe("type_alias");
  });

  it("RSP-5 · imports include both type-only and runtime distinguished correctly", () => {
    const r = asSuccess(repoScan({ request: req(), repo_root: fixtureRoot }));
    const imps = r.map.imports.filter((i) => i.from_file === "src/lib/nex-agent-runtime/example.ts");
    const typeImp = imps.find((i) => i.from_specifier === "./types");
    const runtimeImp = imps.find((i) => i.from_specifier === "./util");
    expect(typeImp!.is_type_only).toBe(true);
    expect(typeImp!.symbols).toContain("Epsilon");
    expect(runtimeImp!.is_type_only).toBe(false);
    expect(runtimeImp!.symbols).toContain("zeta");
  });

  it("RSP-6 · multiple approved roots scanned together", () => {
    const r = asSuccess(repoScan({
      request: req({ read_roots: ["src/lib/nex-agent-runtime/", "src/lib/capability-labs/"] }),
      repo_root: fixtureRoot,
    }));
    const paths = r.map.files.map((f) => f.path);
    expect(paths).toContain("src/lib/nex-agent-runtime/example.ts");
    expect(paths).toContain("src/lib/capability-labs/sample.ts");
  });

  it("RSP-7 · class + enum extracted correctly", () => {
    const r = asSuccess(repoScan({
      request: req({ read_roots: ["src/lib/capability-labs/"] }),
      repo_root: fixtureRoot,
    }));
    const sampleSyms = r.map.symbols.filter((s) => s.file === "src/lib/capability-labs/sample.ts");
    const classSym = sampleSyms.find((s) => s.name === "Sample");
    const enumSym = sampleSyms.find((s) => s.name === "Mode");
    expect(classSym!.kind).toBe("class");
    expect(enumSym!.kind).toBe("enum");
  });

  it("RSP-8 · Markdown files scanned (structural only · no symbol extraction)", () => {
    const r = asSuccess(repoScan({
      request: req({
        read_roots: ["docs/NEX1/BUILD_GATES/"],
        extensions: [".md"],
      }),
      repo_root: fixtureRoot,
    }));
    expect(r.map.files.map((f) => f.path)).toContain("docs/NEX1/BUILD_GATES/PLAN.md");
    // Markdown files have no TypeScript symbols
    const mdSymbols = r.map.symbols.filter((s) => s.file === "docs/NEX1/BUILD_GATES/PLAN.md");
    expect(mdSymbols.length).toBe(0);
  });
});

// ── Group 2 · Determinism ──────────────────────────────────────────────

describe("R1a · repo-scan · determinism", () => {
  function sha(s: string): string {
    return createHash("sha256").update(s, "utf8").digest("hex");
  }

  it("RSD-1 · scan of same fixture twice produces byte-identical map", () => {
    const a = asSuccess(repoScan({ request: req(), repo_root: fixtureRoot }));
    const b = asSuccess(repoScan({ request: req(), repo_root: fixtureRoot }));
    expect(sha(JSON.stringify(a.map))).toBe(sha(JSON.stringify(b.map)));
  });

  it("RSD-2 · scan_sha256 field is deterministic across runs", () => {
    const a = asSuccess(repoScan({ request: req(), repo_root: fixtureRoot }));
    const b = asSuccess(repoScan({ request: req(), repo_root: fixtureRoot }));
    expect(a.map.scan_sha256).toBe(b.map.scan_sha256);
  });

  it("RSD-3 · file order is alphabetic by path", () => {
    const r = asSuccess(repoScan({
      request: req({ read_roots: ["src/lib/nex-agent-runtime/", "src/lib/capability-labs/"] }),
      repo_root: fixtureRoot,
    }));
    const paths = r.map.files.map((f) => f.path);
    const sorted = [...paths].sort();
    expect(paths).toEqual(sorted);
  });
});

// ── Group 3 · Security · path / filename refusal ───────────────────────

describe("R1a · repo-scan · security · path/filename refusal", () => {
  it("RSS-1 · path traversal ('..') in read_roots refused", () => {
    const r = asFailure(repoScan({
      request: req({ read_roots: ["src/../etc"] }),
      repo_root: fixtureRoot,
    }));
    expect(r.refusal_code).toBe("REPO_SCAN_INVALID_PATH");
  });

  it("RSS-2 · absolute Unix path refused", () => {
    const r = asFailure(repoScan({
      request: req({ read_roots: ["/etc/passwd"] }),
      repo_root: fixtureRoot,
    }));
    expect(r.refusal_code).toBe("REPO_SCAN_INVALID_PATH");
  });

  it("RSS-3 · Windows drive path refused", () => {
    const r = asFailure(repoScan({
      request: req({ read_roots: ["C:/Windows"] }),
      repo_root: fixtureRoot,
    }));
    expect(r.refusal_code).toBe("REPO_SCAN_INVALID_PATH");
  });

  it("RSS-4 · backslash refused", () => {
    const r = asFailure(repoScan({
      request: req({ read_roots: ["src\\lib"] }),
      repo_root: fixtureRoot,
    }));
    expect(r.refusal_code).toBe("REPO_SCAN_INVALID_PATH");
  });

  it("RSS-5 · null-byte refused", () => {
    const r = asFailure(repoScan({
      request: req({ read_roots: ["src/lib/nex-agent-runtime/\0bad"] }),
      repo_root: fixtureRoot,
    }));
    expect(r.refusal_code).toBe("REPO_SCAN_INVALID_PATH");
  });

  it("RSS-6 · protocol-scheme read_root refused", () => {
    const r = asFailure(repoScan({
      request: req({ read_roots: ["http://evil.example"] }),
      repo_root: fixtureRoot,
    }));
    expect(r.refusal_code).toBe("REPO_SCAN_INVALID_PATH");
  });

  it("RSS-7 · un-approved root refused with REPO_SCAN_ROOT_NOT_APPROVED", () => {
    const r = asFailure(repoScan({
      request: req({ read_roots: ["scripts/"] }),
      repo_root: fixtureRoot,
    }));
    expect(r.refusal_code).toBe("REPO_SCAN_ROOT_NOT_APPROVED");
  });

  it("RSS-8 · .env pattern in read_root refused with PROHIBITED_FILE_PATTERN", () => {
    const r = asFailure(repoScan({
      request: req({ read_roots: ["src/lib/nex-agent-runtime/.envfile"] }),
      repo_root: fixtureRoot,
    }));
    expect(r.refusal_code).toBe("REPO_SCAN_PROHIBITED_FILE_PATTERN");
  });

  it("RSS-9 · files with prohibited names ('.env', 'credentials') are silently skipped during walk (not emitted)", () => {
    // .env and credentials.ts live under src/ · scan approved roots only · they should not appear anyway
    // because src/.env is outside any approved root. But we also ensure the filter works if such a file
    // sneaked inside an approved root. Test via a file directly placed inside the runtime folder.
    fs.writeFileSync(path.join(fixtureRoot, "src", "lib", "nex-agent-runtime", ".envfile"), "SECRET=x");
    fs.writeFileSync(path.join(fixtureRoot, "src", "lib", "nex-agent-runtime", "credentials.ts"), "export const K = '';");
    const r = asSuccess(repoScan({ request: req(), repo_root: fixtureRoot }));
    const paths = r.map.files.map((f) => f.path);
    expect(paths).not.toContain("src/lib/nex-agent-runtime/.envfile");
    expect(paths).not.toContain("src/lib/nex-agent-runtime/credentials.ts");
  });
});

// ── Group 4 · Extension refusal ────────────────────────────────────────

describe("R1a · repo-scan · extension refusal", () => {
  it("RSE-1 · un-approved extension .js refused", () => {
    const r = asFailure(repoScan({
      request: req({ extensions: [".js"] }),
      repo_root: fixtureRoot,
    }));
    expect(r.refusal_code).toBe("REPO_SCAN_EXTENSION_NOT_APPROVED");
  });

  it("RSE-2 · un-approved extension .json refused", () => {
    const r = asFailure(repoScan({
      request: req({ extensions: [".json"] }),
      repo_root: fixtureRoot,
    }));
    expect(r.refusal_code).toBe("REPO_SCAN_EXTENSION_NOT_APPROVED");
  });

  it("RSE-3 · un-approved extension .png refused", () => {
    const r = asFailure(repoScan({
      request: req({ extensions: [".png"] }),
      repo_root: fixtureRoot,
    }));
    expect(r.refusal_code).toBe("REPO_SCAN_EXTENSION_NOT_APPROVED");
  });

  it("RSE-4 · files with un-approved extensions inside approved roots are silently filtered", () => {
    // config.json exists in the fixture under nex-agent-runtime/
    const r = asSuccess(repoScan({ request: req(), repo_root: fixtureRoot }));
    const paths = r.map.files.map((f) => f.path);
    expect(paths).not.toContain("src/lib/nex-agent-runtime/config.json");
  });
});

// ── Group 5 · Request validation refusal ───────────────────────────────

describe("R1a · repo-scan · request validation", () => {
  it("RSV-1 · empty read_roots refused", () => {
    const r = asFailure(repoScan({
      request: req({ read_roots: [] }),
      repo_root: fixtureRoot,
    }));
    expect(r.refusal_code).toBe("REPO_SCAN_EMPTY_REQUEST");
  });

  it("RSV-2 · empty extensions refused", () => {
    const r = asFailure(repoScan({
      request: req({ extensions: [] }),
      repo_root: fixtureRoot,
    }));
    expect(r.refusal_code).toBe("REPO_SCAN_EMPTY_REQUEST");
  });

  it("RSV-3 · non-integer max_files refused", () => {
    const r = asFailure(repoScan({
      request: req({ max_files: 3.14 }),
      repo_root: fixtureRoot,
    }));
    expect(r.refusal_code).toBe("REPO_SCAN_INVALID_MAX_FILES");
  });

  it("RSV-4 · max_files above limit refused", () => {
    const r = asFailure(repoScan({
      request: req({ max_files: 999999 }),
      repo_root: fixtureRoot,
    }));
    expect(r.refusal_code).toBe("REPO_SCAN_INVALID_MAX_FILES");
  });

  it("RSV-5 · zero max_files refused", () => {
    const r = asFailure(repoScan({
      request: req({ max_files: 0 }),
      repo_root: fixtureRoot,
    }));
    expect(r.refusal_code).toBe("REPO_SCAN_INVALID_MAX_FILES");
  });
});

// ── Group 6 · Bounded output · no content leak ─────────────────────────

describe("R1a · repo-scan · bounded output + no content leak", () => {
  it("RSB-1 · scan_sha256 is deterministic 64-hex-char string", () => {
    const r = asSuccess(repoScan({ request: req(), repo_root: fixtureRoot }));
    expect(r.map.scan_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("RSNC-1 · emitted map contains NO file content (only structural metadata)", () => {
    const r = asSuccess(repoScan({ request: req(), repo_root: fixtureRoot }));
    // The unique string "SECRET=xyz" appears in the fixture's .env file · confirm never leaked
    const serialised = JSON.stringify(r.map);
    expect(serialised).not.toContain("SECRET=xyz");
    // The function body "return x + 1" from example.ts must not appear either
    expect(serialised).not.toContain("return x + 1");
    // The class body "m(): void" must not appear
    expect(serialised).not.toContain("m(): void");
  });

  it("RSNC-2 · file paths and symbol names have no newlines (sentinel invariant)", () => {
    const r = asSuccess(repoScan({ request: req(), repo_root: fixtureRoot }));
    for (const f of r.map.files) expect(f.path).not.toContain("\n");
    for (const s of r.map.symbols) expect(s.name).not.toContain("\n");
    for (const i of r.map.imports) expect(i.from_specifier).not.toContain("\n");
  });

  it("RSB-2 · file_count matches files array length", () => {
    const r = asSuccess(repoScan({ request: req(), repo_root: fixtureRoot }));
    expect(r.map.file_count).toBe(r.map.files.length);
  });
});
