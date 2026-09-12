// GET /api/nex/project-architecture/self-test
// Dedicated adversarial + constitutional tests. Read-only.

import { NextResponse } from "next/server";
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { inferArchitecture, signatureOfGraph } from "@/lib/nex-project-architecture/architecture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Case { id: string; ok: boolean; detail: string; }

function makeTempProject(files: readonly { path: string; content: string }[]): string {
  const root = mkdtempSync(join(tmpdir(), "nex-pa-test-"));
  for (const f of files) {
    const abs = join(root, ...f.path.split("/"));
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, f.content, "utf8");
  }
  return root;
}
function cleanup(root: string): void { try { rmSync(root, { recursive: true, force: true }); } catch { /* best-effort */ } }

const FORBIDDEN_VOCAB = ["good architecture","bad architecture","clean architecture","poor architecture","optimal architecture","better architecture","worse architecture","maintainable","unmaintainable","recommended architecture","should refactor","should move","should delete","should merge","should split"];

function containsForbiddenVocab(obj: unknown): { hit: boolean; word?: string; where?: string } {
  const seen = new WeakSet<object>();
  const walk = (v: unknown, path: string): { hit: boolean; word?: string; where?: string } => {
    if (typeof v === "string") {
      const lower = v.toLowerCase();
      for (const w of FORBIDDEN_VOCAB) if (lower.includes(w)) return { hit: true, word: w, where: path };
      return { hit: false };
    }
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) { const r = walk(v[i], path + "[" + i + "]"); if (r.hit) return r; }
      return { hit: false };
    }
    if (v && typeof v === "object") {
      if (seen.has(v as object)) return { hit: false };
      seen.add(v as object);
      for (const [k, val] of Object.entries(v as object)) {
        const r = walk(val, path + "." + k);
        if (r.hit) return r;
      }
      return { hit: false };
    }
    return { hit: false };
  };
  return walk(obj, "$");
}

export async function GET(): Promise<NextResponse> {
  const cases: Case[] = [];

  // 1. Clean single-package TypeScript project
  cases.push(await runCase("PA.clean-typescript-project", () => {
    const root = makeTempProject([
      { path: "package.json", content: JSON.stringify({ name: "demo" }) },
      { path: "src/util.ts", content: "export function add(a:number,b:number):number{return a+b;}\n" },
      { path: "src/main.ts", content: "import { add } from './util';\nconsole.log(add(1,2));\n" },
    ]);
    try {
      const a = inferArchitecture({ root });
      const hasImport = a.graph.edges.some((e) => e.internal_external === "internal" && e.raw_specifier === "./util");
      const ok = a.graph.nodes.length >= 2
        && hasImport
        && a.cycles.length === 0
        && a.byte_identity_witness.drift_count === 0
        && a.determinism_witness.identical
        && a.packages.length === 1
        && !containsForbiddenVocab(a).hit;
      return { ok, detail: `nodes=${a.graph.nodes.length} edges=${a.graph.edges.length} cycles=${a.cycles.length} drift=${a.byte_identity_witness.drift_count}` };
    } finally { cleanup(root); }
  }));

  // 2. Monorepo with workspaces
  cases.push(await runCase("PA.monorepo", () => {
    const root = makeTempProject([
      { path: "package.json", content: JSON.stringify({ name: "root", workspaces: ["packages/*"] }) },
      { path: "packages/a/package.json", content: JSON.stringify({ name: "a" }) },
      { path: "packages/a/src/index.ts", content: "export const a = 1;\n" },
      { path: "packages/b/package.json", content: JSON.stringify({ name: "b" }) },
      { path: "packages/b/src/index.ts", content: "export const b = 2;\n" },
    ]);
    try {
      const arch = inferArchitecture({ root });
      const ok = arch.packages.length >= 3 && !containsForbiddenVocab(arch).hit;
      return { ok, detail: `packages=${arch.packages.length} · names=${arch.packages.map(p=>p.package_name).join(",")}` };
    } finally { cleanup(root); }
  }));

  // 3. Circular dependency detected
  cases.push(await runCase("PA.circular-dependency", () => {
    const root = makeTempProject([
      { path: "package.json", content: JSON.stringify({ name: "cyc" }) },
      { path: "src/a.ts", content: "import { b } from './b';\nexport const a = () => b();\n" },
      { path: "src/b.ts", content: "import { a } from './a';\nexport const b = () => a();\n" },
    ]);
    try {
      const arch = inferArchitecture({ root });
      const ok = arch.cycles.length >= 1 && arch.cycles[0].size >= 2 && !containsForbiddenVocab(arch).hit;
      return { ok, detail: `cycles=${arch.cycles.length} size=${arch.cycles[0]?.size}` };
    } finally { cleanup(root); }
  }));

  // 4. Deep dependency chain
  cases.push(await runCase("PA.deep-chain", () => {
    const files: { path: string; content: string }[] = [{ path: "package.json", content: "{}" }];
    for (let i = 0; i < 8; i++) files.push({ path: `src/m${i}.ts`, content: i < 7 ? `import { x } from './m${i+1}';\nexport const x = () => x;\n` : `export const x = 1;\n` });
    const root = makeTempProject(files);
    try {
      const arch = inferArchitecture({ root });
      const ok = arch.graph.edges.filter(e=>e.internal_external==="internal").length >= 7 && arch.cycles.length === 0;
      return { ok, detail: `internal_edges=${arch.graph.edges.filter(e=>e.internal_external==="internal").length} cycles=${arch.cycles.length}` };
    } finally { cleanup(root); }
  }));

  // 5. High fan-out
  cases.push(await runCase("PA.high-fan-out", () => {
    const files: { path: string; content: string }[] = [
      { path: "package.json", content: "{}" },
      { path: "src/hub.ts", content: Array.from({length:6}, (_,i) => `import './leaf${i}';`).join("\n") + "\nexport {};\n" },
    ];
    for (let i = 0; i < 6; i++) files.push({ path: `src/leaf${i}.ts`, content: `export const x${i} = 1;\n` });
    const root = makeTempProject(files);
    try {
      const arch = inferArchitecture({ root });
      const hubOut = arch.fan_out.find(r => arch.graph.nodes.find(n => n.node_id === r.node_id)?.source_path === "src/hub.ts");
      const ok = hubOut !== undefined && hubOut.count >= 6;
      return { ok, detail: `hub fan_out=${hubOut?.count ?? 0}` };
    } finally { cleanup(root); }
  }));

  // 6. High fan-in
  cases.push(await runCase("PA.high-fan-in", () => {
    const files: { path: string; content: string }[] = [
      { path: "package.json", content: "{}" },
      { path: "src/shared.ts", content: "export const s = 1;\n" },
    ];
    for (let i = 0; i < 6; i++) files.push({ path: `src/u${i}.ts`, content: `import { s } from './shared';\nexport const y${i} = s;\n` });
    const root = makeTempProject(files);
    try {
      const arch = inferArchitecture({ root });
      const sharedIn = arch.fan_in.find(r => arch.graph.nodes.find(n => n.node_id === r.node_id)?.source_path === "src/shared.ts");
      const ok = sharedIn !== undefined && sharedIn.count >= 6;
      return { ok, detail: `shared fan_in=${sharedIn?.count ?? 0}` };
    } finally { cleanup(root); }
  }));

  // 7. Orphan module (no imports, not imported)
  cases.push(await runCase("PA.orphan-module", () => {
    const root = makeTempProject([
      { path: "package.json", content: "{}" },
      { path: "src/main.ts", content: "console.log(1);\n" },
      { path: "src/orphan.ts", content: "// nobody imports this and it imports nothing\nexport const orphan = 1;\n" },
    ]);
    try {
      const arch = inferArchitecture({ root });
      const orphanNodeId = arch.graph.nodes.find(n => n.source_path === "src/orphan.ts")?.node_id;
      const ok = orphanNodeId !== undefined && arch.orphans.includes(orphanNodeId);
      return { ok, detail: `orphans=${arch.orphans.length}` };
    } finally { cleanup(root); }
  }));

  // 8. Generated code excluded
  cases.push(await runCase("PA.generated-excluded", () => {
    const root = makeTempProject([
      { path: "package.json", content: "{}" },
      { path: "src/real.ts", content: "export const real = 1;\n" },
      { path: "src/gen.ts", content: "// GENERATED FILE\nexport const gen = 2;\n" },
    ]);
    try {
      const arch = inferArchitecture({ root });
      const generatedFound = arch.graph.nodes.some(n => n.source_path === "src/gen.ts");
      const ok = !generatedFound && arch.scan_stats.files_excluded >= 1;
      return { ok, detail: `generated_in_graph=${generatedFound} excluded=${arch.scan_stats.files_excluded}` };
    } finally { cleanup(root); }
  }));

  // 9. Vendor excluded (node_modules)
  cases.push(await runCase("PA.vendor-excluded", () => {
    const root = makeTempProject([
      { path: "package.json", content: "{}" },
      { path: "src/main.ts", content: "import 'react';\n" },
      { path: "node_modules/react/index.js", content: "module.exports = {};\n" },
    ]);
    try {
      const arch = inferArchitecture({ root });
      const vendorInGraph = arch.graph.nodes.some(n => n.source_path.startsWith("node_modules/"));
      const externalReact = arch.graph.edges.some(e => e.raw_specifier === "react" && e.internal_external === "external");
      const ok = !vendorInGraph && externalReact;
      return { ok, detail: `vendor_in_graph=${vendorInGraph} external_react=${externalReact}` };
    } finally { cleanup(root); }
  }));

  // 10. Empty repository · UNKNOWN honestly
  cases.push(await runCase("PA.empty-repository", () => {
    const root = makeTempProject([]);
    try {
      const arch = inferArchitecture({ root });
      const ok = arch.graph.nodes.length === 0 && arch.cycles.length === 0 && arch.byte_identity_witness.drift_count === 0;
      return { ok, detail: `nodes=${arch.graph.nodes.length} cycles=${arch.cycles.length}` };
    } finally { cleanup(root); }
  }));

  // 11. Determinism · run twice · byte-identical graph signature
  cases.push(await runCase("PA.determinism", () => {
    const root = makeTempProject([
      { path: "package.json", content: "{}" },
      { path: "src/a.ts", content: "import { b } from './b';\nimport { c } from './c';\nexport const a = ()=>b()+c();\n" },
      { path: "src/b.ts", content: "export const b = () => 1;\n" },
      { path: "src/c.ts", content: "export const c = () => 2;\n" },
    ]);
    try {
      const a1 = inferArchitecture({ root });
      const a2 = inferArchitecture({ root });
      const sig1 = signatureOfGraph(a1.graph);
      const sig2 = signatureOfGraph(a2.graph);
      const ok = sig1 === sig2 && a1.determinism_witness.identical && a2.determinism_witness.identical;
      return { ok, detail: `sig1=${sig1} sig2=${sig2}` };
    } finally { cleanup(root); }
  }));

  // 12. Byte-identity · scanning does not modify anything
  cases.push(await runCase("PA.read-only-byte-identity", () => {
    const root = makeTempProject([
      { path: "package.json", content: "{}" },
      { path: "src/a.ts", content: "export const a = 1;\n" },
      { path: "src/b.ts", content: "import { a } from './a';\nexport const b = a;\n" },
    ]);
    try {
      const arch = inferArchitecture({ root });
      const ok = arch.byte_identity_witness.drift_count === 0 && arch.byte_identity_witness.before_hash === arch.byte_identity_witness.after_hash;
      return { ok, detail: `drift=${arch.byte_identity_witness.drift_count} before=${arch.byte_identity_witness.before_hash} after=${arch.byte_identity_witness.after_hash}` };
    } finally { cleanup(root); }
  }));

  // 13. Constitutional · no judgement vocabulary in output
  cases.push(await runCase("PA.constitutional.no-judgement-vocabulary", () => {
    const root = makeTempProject([
      { path: "package.json", content: "{}" },
      { path: "src/a.ts", content: "import { b } from './b';\nexport const a = ()=>b();\n" },
      { path: "src/b.ts", content: "import { a } from './a';\nexport const b = ()=>a();\n" },  // cycle · would trigger judgement in weak systems
    ]);
    try {
      const arch = inferArchitecture({ root });
      const chk = containsForbiddenVocab(arch);
      return { ok: !chk.hit, detail: chk.hit ? `HIT '${chk.word}' at ${chk.where}` : "clean · no judgement vocabulary in output" };
    } finally { cleanup(root); }
  }));

  // 14. Constitutional · attribution + role
  cases.push(await runCase("PA.constitutional.attribution", () => {
    const root = makeTempProject([{ path: "package.json", content: "{}" }]);
    try {
      const arch = inferArchitecture({ root });
      const ok = arch.attribution.external_llm_used === false
        && arch.attribution.role === "project_architecture_intelligence"
        && arch.attribution.authority === "descriptive_read_only"
        && arch.attribution.deterministic === true
        && arch.record_type === "PROJECT_ARCHITECTURE";
      return { ok, detail: `role=${arch.attribution.role} auth=${arch.attribution.authority} llm=${arch.attribution.external_llm_used}` };
    } finally { cleanup(root); }
  }));

  // 15. Cross-package edge detection in a monorepo with internal cross-package import
  cases.push(await runCase("PA.cross-package-edges", () => {
    const root = makeTempProject([
      { path: "package.json", content: JSON.stringify({ name: "root", workspaces: ["packages/*"] }) },
      { path: "packages/a/package.json", content: JSON.stringify({ name: "a" }) },
      { path: "packages/a/src/index.ts", content: "export const a = 1;\n" },
      { path: "packages/b/package.json", content: JSON.stringify({ name: "b" }) },
      { path: "packages/b/src/index.ts", content: "import { a } from '../../a/src';\nexport const b = a;\n" },
    ]);
    try {
      const arch = inferArchitecture({ root });
      const ok = arch.cross_package_edges.length >= 1 && !containsForbiddenVocab(arch).hit;
      return { ok, detail: `cross_package_edges=${arch.cross_package_edges.length}` };
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
    attribution: { external_llm_used: false, deterministic: true, taught_by: "master_ai_engineer", role: "project_architecture_intelligence", authority: "descriptive_read_only" },
  }, { headers: { "Cache-Control": "no-store" } });
}

async function runCase(id: string, fn: () => { ok: boolean; detail: string } | Promise<{ ok: boolean; detail: string }>): Promise<Case> {
  try { const r = await fn(); return { id, ok: r.ok, detail: r.detail }; }
  catch (e) { return { id, ok: false, detail: "harness error · " + (e as Error).message }; }
}
