// GET /api/nex/project-profile/self-test
// Dedicated adversarial + constitutional tests. Read-only.

import { NextResponse } from "next/server";
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { inferProfile } from "@/lib/nex-project-profile/profile";
import { witnessKeyFiles } from "@/lib/nex-project-profile/scanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Case { id: string; ok: boolean; detail: string; }

function makeTempProject(files: readonly { path: string; content: string }[]): string {
  const root = mkdtempSync(join(tmpdir(), "nex-pp-test-"));
  for (const f of files) {
    // Split the incoming forward-slash path into segments and join with platform separator
    const abs = join(root, ...f.path.split("/"));
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, f.content, "utf8");
  }
  return root;
}
function cleanup(root: string): void { try { rmSync(root, { recursive: true, force: true }); } catch { /* best-effort */ } }

export async function GET(): Promise<NextResponse> {
  const cases: Case[] = [];

  // 1. Clean TypeScript project · single_package · npm
  cases.push(await runCase("PP.clean-typescript-project", () => {
    const root = makeTempProject([
      { path: "package.json", content: JSON.stringify({ name: "demo", version: "1.0.0", scripts: { build: "tsc", test: "vitest run" }, dependencies: { react: "^19", next: "^14" }, devDependencies: { typescript: "^5", vitest: "^1", prettier: "^3" } }) },
      { path: "package-lock.json", content: "{}" },
      { path: "tsconfig.json", content: JSON.stringify({ compilerOptions: { strict: true } }) },
      { path: "src/util.ts", content: "export const add = (a: number, b: number): number => {\n  return a + b;\n};\n" },
      { path: "src/main.ts", content: "import { add } from './util';\nconsole.log(add(1, 2));\n" },
      { path: "src/util.test.ts", content: "import { add } from './util';\ntest('add', () => {\n  expect(add(1,2)).toBe(3);\n});\n" },
    ]);
    try {
      const p = inferProfile({ root });
      const ok = p.identity.project_type.value === "node.js"
        && p.identity.repository_structure.value === "single_package"
        && (p.identity.primary_languages.value ?? []).includes("typescript")
        && (p.identity.detected_frameworks.value ?? []).includes("next.js")
        && (p.identity.detected_package_managers.value ?? []).includes("npm")
        && p.tooling.type_checker_configuration.value === "tsconfig.json"
        && p.style_signals.indentation.value === "2_spaces"
        && p.style_signals.test_naming_pattern.value === ".test.ts"
        && p.byte_identity_witness.identical === true;
      return { ok, detail: `type=${p.identity.project_type.value} · repo=${p.identity.repository_structure.value} · frameworks=${JSON.stringify(p.identity.detected_frameworks.value)} · indent=${p.style_signals.indentation.value} · byte-id=${p.byte_identity_witness.identical}` };
    } finally { cleanup(root); }
  }));

  // 2. Rust project · Cargo
  cases.push(await runCase("PP.rust-project", () => {
    const root = makeTempProject([
      { path: "Cargo.toml", content: "[package]\nname='demo'\nversion='0.1.0'\n[dependencies]\ntokio = '1'\n" },
      { path: "Cargo.lock", content: "" },
      { path: "src/main.rs", content: "fn main() { println!(\"hi\"); }\n" },
    ]);
    try {
      const p = inferProfile({ root });
      const ok = p.identity.project_type.value === "rust"
        && (p.identity.primary_languages.value ?? []).includes("rust")
        && (p.identity.detected_package_managers.value ?? []).includes("cargo")
        && (p.identity.detected_frameworks.value ?? []).includes("tokio")
        && p.byte_identity_witness.identical === true;
      return { ok, detail: `type=${p.identity.project_type.value} · frameworks=${JSON.stringify(p.identity.detected_frameworks.value)}` };
    } finally { cleanup(root); }
  }));

  // 3. Monorepo · workspaces detected
  cases.push(await runCase("PP.monorepo", () => {
    const root = makeTempProject([
      { path: "package.json", content: JSON.stringify({ name: "root", workspaces: ["packages/*"] }) },
      { path: "packages/a/package.json", content: JSON.stringify({ name: "a", version: "1.0.0" }) },
      { path: "packages/a/src/index.ts", content: "export const x = 1;\n" },
      { path: "packages/b/package.json", content: JSON.stringify({ name: "b" }) },
      { path: "packages/b/src/index.ts", content: "export const y = 2;\n" },
    ]);
    try {
      const p = inferProfile({ root });
      const ok = p.identity.repository_structure.value === "monorepo";
      return { ok, detail: `repo=${p.identity.repository_structure.value}` };
    } finally { cleanup(root); }
  }));

  // 4. Mixed-language project
  cases.push(await runCase("PP.mixed-language", () => {
    const root = makeTempProject([
      { path: "package.json", content: JSON.stringify({ name: "poly" }) },
      { path: "pyproject.toml", content: "[project]\nname='poly'\n" },
      { path: "Cargo.toml", content: "[package]\nname='poly'\nversion='0.1'\n" },
      { path: "src/a.ts", content: "export const a = 1;\n" },
      { path: "src/b.py", content: "def b():\n    return 2\n" },
      { path: "src/c.rs", content: "fn c(){}\n" },
    ]);
    try {
      const p = inferProfile({ root });
      const ok = p.identity.project_type.value === "mixed"
        && (p.identity.primary_languages.value ?? []).length >= 1
        && p.byte_identity_witness.identical === true;
      return { ok, detail: `type=${p.identity.project_type.value} · primary=${JSON.stringify(p.identity.primary_languages.value)}` };
    } finally { cleanup(root); }
  }));

  // 5. Conflicting indentation (mix of tabs + 2-space)
  cases.push(await runCase("PP.conflicting-indentation", () => {
    const root = makeTempProject([
      { path: "package.json", content: JSON.stringify({ name: "c" }) },
      { path: "src/a.ts", content: "function a() {\n\treturn 1;\n}\n" },
      { path: "src/b.ts", content: "function b() {\n  return 2;\n}\n" },
      { path: "src/c.ts", content: "function c() {\n\treturn 3;\n}\n" },
      { path: "src/d.ts", content: "function d() {\n  return 4;\n}\n" },
    ]);
    try {
      const p = inferProfile({ root });
      const state = p.style_signals.indentation.state;
      // With 2 tab-favouring and 2 space-favouring files · either becomes STRONGLY (if tie broken) or CONFLICTING · not UNKNOWN
      const ok = state === "CONFLICTING" || state === "WEAKLY_INFERRED" || state === "STRONGLY_INFERRED";
      return { ok, detail: `indent state=${state} value=${p.style_signals.indentation.value} · support=${p.style_signals.indentation.supporting_count}/${p.style_signals.indentation.sample_size}` };
    } finally { cleanup(root); }
  }));

  // 6. Vendor directories excluded from primary language count
  cases.push(await runCase("PP.vendor-excluded", () => {
    const root = makeTempProject([
      { path: "package.json", content: JSON.stringify({ name: "v" }) },
      { path: "src/a.ts", content: "export const a = 1;\n" },
      { path: "node_modules/lib/index.js", content: "module.exports = {};\n" },
      { path: "node_modules/lib/big.js", content: "// vendor\n".repeat(100) },
    ]);
    try {
      const p = inferProfile({ root });
      const ok = (p.identity.primary_languages.value ?? []).includes("typescript")
        && !(p.identity.primary_languages.value ?? []).includes("javascript")
        && p.organisation.vendor_directories.value?.includes("node_modules");
      return { ok, detail: `primary=${JSON.stringify(p.identity.primary_languages.value)} · vendor=${JSON.stringify(p.organisation.vendor_directories.value)}` };
    } finally { cleanup(root); }
  }));

  // 7. Empty repository · UNKNOWN not silently guessed
  cases.push(await runCase("PP.empty-repository", () => {
    const root = makeTempProject([]);
    try {
      const p = inferProfile({ root });
      const ok = p.identity.project_type.state === "UNKNOWN"
        && p.identity.primary_languages.state === "UNKNOWN"
        && p.style_signals.indentation.state === "UNKNOWN";
      return { ok, detail: `types=${p.identity.project_type.state} · lang=${p.identity.primary_languages.state} · indent=${p.style_signals.indentation.state}` };
    } finally { cleanup(root); }
  }));

  // 8. Read-only guarantee (byte-identity witness identical)
  cases.push(await runCase("PP.read-only-byte-identity", () => {
    const root = makeTempProject([
      { path: "package.json", content: JSON.stringify({ name: "ro" }) },
      { path: "src/a.ts", content: "export const a = 1;\n" },
      { path: "src/b.ts", content: "export const b = 2;\n" },
    ]);
    try {
      const before = witnessKeyFiles(root);
      const p = inferProfile({ root });
      const after = witnessKeyFiles(root);
      const ok = before.combined_hash_prefix === after.combined_hash_prefix && p.byte_identity_witness.identical === true;
      return { ok, detail: `before=${before.combined_hash_prefix} · after=${after.combined_hash_prefix} · witness=${p.byte_identity_witness.identical}` };
    } finally { cleanup(root); }
  }));

  // 9. Generated files marked
  cases.push(await runCase("PP.generated-detected", () => {
    const root = makeTempProject([
      { path: "package.json", content: JSON.stringify({ name: "g" }) },
      { path: "src/gen.ts", content: "// GENERATED FILE\nexport const gen = 1;\n" },
      { path: "src/real.ts", content: "export const real = 2;\n" },
    ]);
    try {
      const p = inferProfile({ root });
      // The generated file should not appear in files_scanned since skip_generated=true
      // Check that only the non-generated file contributed to language counts
      const scanCount = p.scan_stats.files_scanned;
      const excludedCount = p.scan_stats.files_excluded;
      const ok = excludedCount >= 1 && scanCount >= 1;
      return { ok, detail: `scanned=${scanCount} · excluded=${excludedCount}` };
    } finally { cleanup(root); }
  }));

  // 10. Constitutional · attribution + role
  cases.push(await runCase("PP.constitutional.attribution", () => {
    const root = makeTempProject([
      { path: "package.json", content: JSON.stringify({ name: "a" }) },
      { path: "src/a.ts", content: "export const a = 1;\n" },
    ]);
    try {
      const p = inferProfile({ root });
      const ok = p.attribution.external_llm_used === false
        && p.attribution.role === "project_profile_scanner"
        && p.attribution.authority === "descriptive_read_only"
        && p.attribution.deterministic === true
        && p.record_type === "PROJECT_PROFILE";
      return { ok, detail: `role=${p.attribution.role} · llm=${p.attribution.external_llm_used} · type=${p.record_type}` };
    } finally { cleanup(root); }
  }));

  // 11. Sampling limitations declared
  cases.push(await runCase("PP.sampling-limitations-declared", () => {
    const root = makeTempProject([
      { path: "package.json", content: JSON.stringify({ name: "s" }) },
      { path: "src/a.ts", content: "export const a = 1;\n" },
    ]);
    try {
      const p = inferProfile({ root });
      const ok = typeof p.scan_stats.sampling_methodology === "string"
        && p.scan_stats.sampling_methodology.length > 20
        && typeof p.limitations === "string"
        && p.limitations.length > 20;
      return { ok, detail: `methodology_len=${p.scan_stats.sampling_methodology.length} · limitations_len=${p.limitations.length}` };
    } finally { cleanup(root); }
  }));

  // Summary
  const pass = cases.filter((c) => c.ok).length;
  const fail = cases.filter((c) => !c.ok).length;
  return NextResponse.json({
    at: new Date().toISOString(),
    total: cases.length,
    pass,
    fail,
    cases,
    attribution: { external_llm_used: false, deterministic: true, taught_by: "master_ai_engineer", role: "project_profile_scanner", authority: "descriptive_read_only" },
  }, { headers: { "Cache-Control": "no-store" } });
}

async function runCase(id: string, fn: () => { ok: boolean; detail: string } | Promise<{ ok: boolean; detail: string }>): Promise<Case> {
  try { const r = await fn(); return { id, ok: r.ok, detail: r.detail }; }
  catch (e) { return { id, ok: false, detail: "harness error · " + (e as Error).message }; }
}
