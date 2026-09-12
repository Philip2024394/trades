// GET /api/nex/code-health/self-test
// Dedicated adversarial + constitutional test suite for Code Health.
// Read-only. Deterministic.

import { NextResponse } from "next/server";
import { measureCodeHealth } from "@/lib/nex-code-health/report";
import { resolveProvenance } from "@/lib/nex-code-health/provenance";
import type { HealthMeasurement, CodeHealthReport } from "@/lib/nex-code-health/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Case { id: string; ok: boolean; detail: string; }

const FORBIDDEN_VOCAB = [
  "bad code","good code","clean code","poor code","optimal code","better code","worse code",
  "maintainable","unmaintainable","recommended","should refactor","should split","should merge",
  "high complexity","low complexity","excessive","insufficient","poorly designed","well designed",
  "code smell","anti-pattern","best practice","worst practice"
];

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

  // 1. Simple file: cyclomatic + line counts
  cases.push(await runCase("CH.simple-file", () => {
    const rpt = measureCodeHealth({
      project_root: "test", source_files: [
        { path: "src/a.ts", content: "export function add(a:number,b:number){ return a+b; }\n" },
      ]
    });
    const cyc = rpt.measurements.find(m => m.kind === "cyclomatic_complexity" && m.scope === "file");
    const ok = cyc?.state === "MEASURED" && (cyc.value as any).file_total >= 1;
    return { ok, detail: `cyclomatic file_total=${(cyc?.value as any)?.file_total}` };
  }));

  // 2. High complexity function
  cases.push(await runCase("CH.high-complexity", () => {
    const rpt = measureCodeHealth({
      project_root: "test", source_files: [
        { path: "src/hi.ts", content: "export function f(x:number){ if(x<0)return 1; else if(x<5){ for(let i=0;i<x;i++)if(i%2)return 2; } else if(x<10){ while(x>0){x--;if(x===3)return 3;} } return 4; }\n" },
      ]
    });
    const cyc = rpt.measurements.find(m => m.kind === "cyclomatic_complexity" && m.scope === "function");
    const ok = cyc?.state === "MEASURED" && (cyc.value as number) >= 6 && !containsForbiddenVocab(rpt).hit;
    return { ok, detail: `function complexity=${cyc?.value}` };
  }));

  // 3. Nesting depth
  cases.push(await runCase("CH.nesting-depth", () => {
    const rpt = measureCodeHealth({
      project_root: "test", source_files: [
        { path: "src/n.ts", content: "export function f(){ if(true){ for(let i=0;i<1;i++){ while(false){ if(i){} } } } }\n" },
      ]
    });
    const nd = rpt.measurements.find(m => m.kind === "nesting_depth");
    const ok = nd?.state === "MEASURED" && (nd.value as number) >= 4;
    return { ok, detail: `nesting_depth=${nd?.value}` };
  }));

  // 4. API surface (exports count)
  cases.push(await runCase("CH.api-surface", () => {
    const rpt = measureCodeHealth({
      project_root: "test", source_files: [
        { path: "src/api.ts", content: "export const a = 1;\nexport function b(){}\nexport class C {}\nexport type T = number;\nexport default 42;\n" },
      ]
    });
    const api = rpt.measurements.find(m => m.kind === "api_surface");
    const ok = api?.state === "MEASURED" && (api.value as any).count === 5;
    return { ok, detail: `api count=${(api?.value as any)?.count}` };
  }));

  // 5. Function size records span
  cases.push(await runCase("CH.function-size", () => {
    const rpt = measureCodeHealth({
      project_root: "test", source_files: [
        { path: "src/fn.ts", content: "export function f(a:number,b:number,c:number){\n  const x = 1;\n  const y = 2;\n  return a+b+c+x+y;\n}\n" },
      ]
    });
    const fs = rpt.measurements.find(m => m.kind === "function_size");
    const ok = fs?.state === "MEASURED" && (fs.value as any).param_count === 3 && (fs.value as any).span_lines >= 4;
    return { ok, detail: `params=${(fs?.value as any)?.param_count} span=${(fs?.value as any)?.span_lines}` };
  }));

  // 6. Line counts distinguish code / comment / blank
  cases.push(await runCase("CH.line-counts", () => {
    const rpt = measureCodeHealth({
      project_root: "test", source_files: [
        { path: "src/l.ts", content: "// a comment\nexport const x = 1;\n\nexport const y = 2;\n/* block\nlines */\n" },
      ]
    });
    const lc = rpt.measurements.find(m => m.kind === "line_counts");
    const ok = lc?.state === "MEASURED" && (lc.value as any).comment >= 3 && (lc.value as any).code >= 2 && (lc.value as any).blank >= 1;
    return { ok, detail: `code=${(lc?.value as any)?.code} comment=${(lc?.value as any)?.comment} blank=${(lc?.value as any)?.blank}` };
  }));

  // 7. Duplication detected between two files
  cases.push(await runCase("CH.duplication", () => {
    const body = "return x + y + z + (a > 0 ? a : b) * 2;";
    const rpt = measureCodeHealth({
      project_root: "test", source_files: [
        { path: "src/d1.ts", content: `export function a(x:number,y:number,z:number,a:number,b:number){ ${body} }\n` },
        { path: "src/d2.ts", content: `export function b(x:number,y:number,z:number,a:number,b:number){ ${body} }\n` },
      ]
    });
    const dup = rpt.measurements.find(m => m.kind === "duplication");
    const ok = dup?.state === "MEASURED" && (dup.value as any).occurrence_count === 2;
    return { ok, detail: `occurrences=${(dup?.value as any)?.occurrence_count}` };
  }));

  // 8. Non-JS file: metrics marked NOT_APPLICABLE
  cases.push(await runCase("CH.non-js-not-applicable", () => {
    const rpt = measureCodeHealth({
      project_root: "test", source_files: [
        { path: "config.toml", content: "[a]\nk='v'\n" },
      ]
    });
    const cyc = rpt.measurements.find(m => m.kind === "cyclomatic_complexity");
    const nd  = rpt.measurements.find(m => m.kind === "nesting_depth");
    const api = rpt.measurements.find(m => m.kind === "api_surface");
    const ok = cyc?.state === "NOT_APPLICABLE" && nd?.state === "NOT_APPLICABLE" && api?.state === "NOT_APPLICABLE";
    return { ok, detail: `cyc=${cyc?.state} nd=${nd?.state} api=${api?.state}` };
  }));

  // 9. Broken syntax: MUST be INCONCLUSIVE with value=null · never MEASURED · never fabricated 0
  cases.push(await runCase("CH.broken-syntax-inconclusive", () => {
    const rpt = measureCodeHealth({
      project_root: "test", source_files: [
        { path: "src/broken.ts", content: "export function f({{{ invalid syntax !!! )}\n" },
      ]
    });
    const cyc = rpt.measurements.find(m => m.kind === "cyclomatic_complexity" && m.scope === "file");
    const api = rpt.measurements.find(m => m.kind === "api_surface");
    const nd  = rpt.measurements.find(m => m.kind === "nesting_depth");
    const strict = (m?: HealthMeasurement) => m?.state === "INCONCLUSIVE" && m.value === null && typeof m.reason === "string" && m.reason.length > 0;
    const ok = strict(cyc) && strict(api) && strict(nd);
    return { ok, detail: `cyc=${cyc?.state}/${cyc?.value === null ? "null" : cyc?.value} api=${api?.state}/${api?.value === null ? "null" : api?.value} nd=${nd?.state}/${nd?.value === null ? "null" : nd?.value}` };
  }));

  // 10. Empty file
  cases.push(await runCase("CH.empty-file", () => {
    const rpt = measureCodeHealth({
      project_root: "test", source_files: [
        { path: "src/e.ts", content: "" },
      ]
    });
    const fs = rpt.measurements.find(m => m.kind === "file_size");
    const cyc = rpt.measurements.find(m => m.kind === "cyclomatic_complexity" && m.scope === "file");
    const ok = fs?.value === 0 && cyc?.state === "MEASURED" && (cyc.value as any).file_total === 0;
    return { ok, detail: `file_size=${fs?.value} cyc_total=${(cyc?.value as any)?.file_total}` };
  }));

  // 11. Determinism · two identical runs produce the same signature
  cases.push(await runCase("CH.determinism", () => {
    const src = [{ path: "src/x.ts", content: "export function f(a:number){ if(a>0){for(let i=0;i<a;i++){}} return a; }\n" }];
    const r1 = measureCodeHealth({ project_root: "test", source_files: src });
    const r2 = measureCodeHealth({ project_root: "test", source_files: src });
    const ok = r1.determinism_witness.identical && r2.determinism_witness.identical && r1.determinism_witness.first_run_hash === r2.determinism_witness.first_run_hash;
    return { ok, detail: `r1.sig=${r1.determinism_witness.first_run_hash} r2.sig=${r2.determinism_witness.first_run_hash}` };
  }));

  // 12. Byte-identity: measurement never touches inputs
  cases.push(await runCase("CH.byte-identity", () => {
    const rpt = measureCodeHealth({
      project_root: "test", source_files: [
        { path: "src/i.ts", content: "export const x = 1;\n" },
      ]
    });
    const ok = rpt.byte_identity_witness.before_hash === rpt.byte_identity_witness.after_hash && rpt.byte_identity_witness.drift_count === 0;
    return { ok, detail: `before=${rpt.byte_identity_witness.before_hash} after=${rpt.byte_identity_witness.after_hash}` };
  }));

  // 13. Constitutional · no judgement vocabulary anywhere in output
  cases.push(await runCase("CH.constitutional.no-judgement-vocabulary", () => {
    const rpt = measureCodeHealth({
      project_root: "test", source_files: [
        { path: "src/complex.ts", content: "export function f(x:number){ if(x<0)return 1; else if(x<5){for(let i=0;i<x;i++)if(i%2)return 2;} else if(x<10){while(x>0){x--;}} return 4; }\n" },
      ]
    });
    const chk = containsForbiddenVocab(rpt);
    return { ok: !chk.hit, detail: chk.hit ? `HIT '${chk.word}' at ${chk.where}` : "clean · no judgement vocabulary in output" };
  }));

  // 14. Attribution correct · authority=descriptive_read_only · produced_by=code_health_intelligence
  cases.push(await runCase("CH.attribution", () => {
    const rpt = measureCodeHealth({ project_root: "test", source_files: [{ path: "src/a.ts", content: "export const x = 1;\n" }] });
    const ok = rpt.attribution.external_llm_used === false
      && rpt.attribution.role === "code_health_measurement"
      && rpt.attribution.authority === "descriptive_read_only"
      && rpt.attribution.produced_by === "code_health_intelligence"
      && rpt.attribution.deterministic === true
      && rpt.record_type === "CODE_HEALTH_REPORT"
      && rpt.measurements.every(m => m.attribution.role === "code_health_measurement"
        && m.attribution.authority === "descriptive_read_only"
        && m.attribution.produced_by === "code_health_intelligence");
    return { ok, detail: `role=${rpt.attribution.role} authority=${rpt.attribution.authority} produced_by=${rpt.attribution.produced_by}` };
  }));

  // 15. Provenance chain · full walk from metric_id back to reproducibility
  cases.push(await runCase("CH.provenance-chain-full-walk", () => {
    const rpt: CodeHealthReport = measureCodeHealth({
      project_root: "test", source_files: [{ path: "src/p.ts", content: "export function f(x:number){ return x*2; }\n" }]
    });
    const target: HealthMeasurement | undefined = rpt.measurements.find(m => m.kind === "cyclomatic_complexity" && m.scope === "function");
    if (!target) return { ok: false, detail: "no target measurement found" };
    const chain = resolveProvenance({
      claim_text: "This function has cyclomatic complexity of 1.",
      evidence_id: target.metric_id,
      measurements: rpt.measurements,
    });
    const kinds = chain.steps.map(s => s.step_kind);
    const expected = ["claim","evidence_pointer","measurement","source","source_hash","tool","methodology","reproducibility"];
    const ok = chain.fully_resolvable === true
      && expected.every(e => kinds.includes(e as any))
      && chain.broken_links.length === 0;
    return { ok, detail: `steps=${kinds.join(">")} broken=${chain.broken_links.length}` };
  }));

  // 16. Provenance rejects orphan claim (evidence_id not in pool)
  cases.push(await runCase("CH.provenance-rejects-orphan", () => {
    const chain = resolveProvenance({
      claim_text: "orphan claim",
      evidence_id: "CH-does-not-exist",
      measurements: [],
    });
    const ok = chain.fully_resolvable === false && chain.broken_links.length >= 1;
    return { ok, detail: `broken=${chain.broken_links.join(", ")}` };
  }));

  // 17. Delegated fan_in / fan_out · when architecture supplied → MEASURED with delegated_from
  cases.push(await runCase("CH.delegation.fan-in-out-verified-when-supplied", () => {
    const rpt = measureCodeHealth({
      project_root: "test",
      source_files: [{ path: "src/a.ts", content: "export const x = 1;\n" }],
      architecture: {
        project_architecture_version: "v0.1.0",
        report_id: "PA-RPT-TEST",
        fan_in:  [{ node_id: "src/a.ts", count: 3 }],
        fan_out: [{ node_id: "src/a.ts", count: 2 }],
      },
    });
    const fi = rpt.measurements.find(m => m.kind === "dependency_fan_in"  && m.scope_target === "src/a.ts");
    const fo = rpt.measurements.find(m => m.kind === "dependency_fan_out" && m.scope_target === "src/a.ts");
    const ok = fi?.state === "MEASURED" && fi.value === 3 && fi.delegated_from?.subsystem === "project_architecture_intelligence"
            && fo?.state === "MEASURED" && fo.value === 2 && fo.delegated_from?.subsystem === "project_architecture_intelligence";
    return { ok, detail: `fan_in=${fi?.value} fan_out=${fo?.value} delegated_from=${fi?.delegated_from?.subsystem}` };
  }));

  // 18. Delegation refused when input absent · state MUST be NOT_MEASURED with reason
  cases.push(await runCase("CH.delegation.absent-input-not-measured", () => {
    const rpt = measureCodeHealth({
      project_root: "test",
      source_files: [{ path: "src/a.ts", content: "export const x = 1;\n" }],
      // architecture omitted
    });
    const kinds: any[] = ["dependency_fan_in", "dependency_fan_out", "dependency_depth", "unused_exports", "test_relationship"];
    const results = kinds.map(k => rpt.measurements.find(m => m.kind === k));
    const ok = results.every(m => m?.state === "NOT_MEASURED" && m.value === null && typeof m.reason === "string" && m.reason === "project_architecture_input_not_supplied");
    return { ok, detail: results.map((m, i) => `${kinds[i]}=${m?.state}`).join(" ") };
  }));

  // 19. Provenance rejects unavailable delegated metric · dependency_depth MUST be NOT_MEASURED even when architecture supplied
  cases.push(await runCase("CH.provenance-rejects-unavailable-delegated-metric", () => {
    const rpt = measureCodeHealth({
      project_root: "test",
      source_files: [{ path: "src/a.ts", content: "export const x = 1;\n" }],
      architecture: {
        project_architecture_version: "v0.1.0",
        report_id: "PA-RPT-TEST",
        fan_in:  [{ node_id: "src/a.ts", count: 1 }],
        fan_out: [{ node_id: "src/a.ts", count: 0 }],
      },
    });
    const dep_depth      = rpt.measurements.find(m => m.kind === "dependency_depth");
    const unused_exports = rpt.measurements.find(m => m.kind === "unused_exports");
    const test_rel       = rpt.measurements.find(m => m.kind === "test_relationship");
    const strict = (m?: HealthMeasurement) => m?.state === "NOT_MEASURED"
      && m.value === null
      && typeof m.reason === "string"
      && m.reason === "not_authoritatively_provided_by_project_architecture_v0.1.0";
    const ok = strict(dep_depth) && strict(unused_exports) && strict(test_rel);
    return { ok, detail: `dep_depth=${dep_depth?.state}/${dep_depth?.reason}, unused=${unused_exports?.state}/${unused_exports?.reason}, test_rel=${test_rel?.state}/${test_rel?.reason}` };
  }));

  // 20. Provenance chain walk on a NOT_MEASURED delegated metric MUST NOT fabricate a source_hash / methodology when value is null
  cases.push(await runCase("CH.provenance-chain-not-measured-remains-honest", () => {
    const rpt = measureCodeHealth({
      project_root: "test",
      source_files: [{ path: "src/a.ts", content: "export const x = 1;\n" }],
    });
    const dep_depth = rpt.measurements.find(m => m.kind === "dependency_depth");
    if (!dep_depth) return { ok: false, detail: "dependency_depth measurement missing" };
    const chain = resolveProvenance({
      claim_text: "This project has dependency depth of X",
      evidence_id: dep_depth.metric_id,
      measurements: rpt.measurements,
    });
    // The chain must be resolvable to the measurement · but the measurement itself is NOT_MEASURED with reason
    const measurementStep = chain.steps.find(s => s.step_kind === "measurement");
    const state = (measurementStep?.detail as any)?.state;
    const value = (measurementStep?.detail as any)?.value;
    const reason = (measurementStep?.detail as any)?.reason;
    const ok = state === "NOT_MEASURED" && (value === null || value === undefined) && typeof reason === "string" && reason.length > 0;
    return { ok, detail: `state=${state} value=${value === null ? "null" : String(value)} reason=${String(reason).slice(0,60)}` };
  }));

  // 21. State model boundary · Code Health report MUST NOT emit PASSED or FAILED anywhere
  cases.push(await runCase("CH.state-model-boundary.no-passed-or-failed", () => {
    const rpt = measureCodeHealth({
      project_root: "test",
      source_files: [
        { path: "src/a.ts", content: "export function f(x:number){ if(x)return 1; return 2; }\n" },
        { path: "src/b.toml", content: "[a]\nk='v'\n" },
        { path: "src/broken.ts", content: "export function f({{{ !!!\n" },
      ],
      architecture: {
        project_architecture_version: "v0.1.0",
        report_id: "PA-RPT-TEST",
        fan_in:  [{ node_id: "src/a.ts", count: 1 }],
        fan_out: [{ node_id: "src/a.ts", count: 0 }],
      },
    });
    const allowed = new Set(["MEASURED", "NOT_MEASURED", "NOT_APPLICABLE", "INCONCLUSIVE", "BLOCKED", "STALE"]);
    const seenStates = new Set(rpt.measurements.map(m => m.state));
    const ok = Array.from(seenStates).every(s => allowed.has(s));
    return { ok, detail: `states seen: ${Array.from(seenStates).join(", ")}` };
  }));

  const pass = cases.filter(c => c.ok).length;
  const fail = cases.filter(c => !c.ok).length;
  return NextResponse.json({
    at: new Date().toISOString(),
    total: cases.length, pass, fail, cases,
    attribution: { external_llm_used: false, deterministic: true, taught_by: "master_ai_engineer", role: "code_health_measurement", authority: "descriptive_read_only", produced_by: "code_health_intelligence" },
  }, { headers: { "Cache-Control": "no-store" } });
}

async function runCase(id: string, fn: () => { ok: boolean; detail: string } | Promise<{ ok: boolean; detail: string }>): Promise<Case> {
  try { const r = await fn(); return { id, ok: r.ok, detail: r.detail }; }
  catch (e) { return { id, ok: false, detail: "harness error · " + (e as Error).message }; }
}
