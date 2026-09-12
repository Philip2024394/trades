// src/lib/nex-agent/core/orchestrator.ts
//
// NEX Agent v1.1 · Orchestrator with multi-round discussion + proposed-diff preview.
//
// V1.1 principles:
//   · READ + PLAN + proposed-diff preview. Zero autonomous source modification.
//   · nex1 ↔ nex2 ↔ nex3 debate in rounds (up to 5) until consensus.
//   · Deterministic revision engine · no LLM.
//   · Every step written to nex_agent.task_steps for durable memory + SSE stream.
//   · Founder approval is the ONLY path from plan → engineering brief.
//
// Round flow:
//   round 1:
//     nex1 · classify + plan + proposed_files
//     nex2 · architecture scan
//     nex3 · doctrine + security scan
//     if both pass → CONSENSUS → plan_ready
//     else → nex1 revises based on critique → round 2
//   ...
//   round 5:
//     if still no consensus → HALT · founder_decides · plan_stuck

import { Client } from "pg";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readFile, searchCode, architectureScan } from "../tools";
import type { Intent, Plan, PlanStep, ReviewResult, ProposedFile } from "./orchestrator-types";
import { MAX_ROUNDS, reviseFromCritique, isConsensus, summariseRound } from "./discussion";
import { generateProposedFiles } from "./proposed-diff";
import { analyseADRImpact } from "./adr-impact";
import { runMergeGate, scanSecurity, scanTruthEngineGuard } from "./architecture-guardian";
import { parseIntent } from "@/lib/nex/language/intent-parser";
import { CODE_INTENT_REGISTRY } from "@/lib/nex-agent/language/code-intent-registry";
import { resolveConcept } from "@/lib/nex/language/concept-resolver";
import { matchQuestion } from "@/lib/nex/language/question-resolver";
import { normalise } from "@/lib/nex/language/normaliser";

const REPO_ROOT = process.cwd();

function pgUrl(): string {
  return process.env.NEX_TAXONOMY_POSTGRES_URL ?? process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}
async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  await c.connect();
  try { return await fn(c); } finally { try { await c.end(); } catch { /* ignore */ } }
}

// ─── Task state I/O ─────────────────────────────────────────────
export interface TaskRow {
  task_id: string; submitted_at: string; updated_at: string; submitted_by: string; prompt: string;
  status: string; current_actor: string | null; plan: unknown; brief: string | null;
}
export async function getTask(taskId: string): Promise<TaskRow | null> {
  return withClient(async (c) => {
    const r = await c.query(`SELECT * FROM nex_agent.tasks WHERE task_id = $1`, [taskId]);
    return r.rows[0] ?? null;
  });
}
export async function listRecentTasks(limit = 25): Promise<TaskRow[]> {
  return withClient(async (c) => {
    const r = await c.query(`SELECT * FROM nex_agent.tasks ORDER BY submitted_at DESC LIMIT $1`, [limit]);
    return r.rows;
  });
}
async function updateTask(taskId: string, patch: Partial<Pick<TaskRow, "status" | "current_actor" | "plan" | "brief">>): Promise<void> {
  const fields: string[] = ["updated_at = now()"];
  const values: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(patch)) { fields.push(`${k} = $${i++}`); values.push(v); }
  values.push(taskId);
  await withClient((c) => c.query(`UPDATE nex_agent.tasks SET ${fields.join(", ")} WHERE task_id = $${i}`, values));
}

async function emitStep(taskId: string, actor: "nex1" | "nex2" | "nex3" | "founder" | "system", step_kind: string, title: string, body?: unknown): Promise<void> {
  await withClient((c) => c.query(
    `INSERT INTO nex_agent.task_steps (task_id, actor, step_kind, title, body) VALUES ($1,$2,$3,$4,$5)`,
    [taskId, actor, step_kind, title, body ? JSON.stringify(body) : null],
  ));
}

// ─── Deterministic prompt classifier ─────────────────────────────
// Two-pass model. Layer 1: NEX language engine (normalises UK slang + spoken
// English into canonical tokens · scores against CODE_INTENT_REGISTRY). Layer
// 2: legacy regex fallback for prompts the language engine can't confidently
// classify. Both layers are 100% deterministic · zero LLM.
//
// The language engine gives nex1 much wider English coverage without changing
// the downstream decision path — same Intent shape, same plan generation,
// same review gates.

const LANG_TO_ORCH_KIND: Record<string, Intent["kind"]> = {
  add_feature: "add_feature",
  fix_bug: "fix_bug",
  explain: "explain",
  explain_error: "explain",
  refactor: "refactor",
  add_migration: "add_migration",
  add_api_route: "add_api_route",
  add_test: "add_feature",
  small_talk: "unknown",
};

export function classifyPrompt(prompt: string): Intent {
  const p = String(prompt || "").trim();
  const lower = p.toLowerCase();
  const fileHints = Array.from(p.matchAll(/([\w.\-/]+\.(?:ts|tsx|mjs|js|sql|md|json|css|py))/g)).map(m => m[1]).slice(0, 6);

  // ── Layer 1: language engine ────────────────────────────────────
  const lang = parseIntent(p, { intents: CODE_INTENT_REGISTRY, minConfidence: 0.35 });
  if (lang.intent_slug && lang.confidence >= 0.35) {
    const kind = LANG_TO_ORCH_KIND[lang.intent_slug] ?? "unknown";
    // Blend language-engine confidence with orchestrator's usual heuristics
    let confidence = 0.5 + lang.confidence * 0.4;
    if (fileHints.length > 0) confidence = Math.min(0.95, confidence + 0.1);
    if (p.length < 20) confidence -= 0.15;
    if (p.length > 400) confidence = Math.min(0.95, confidence + 0.05);
    return {
      kind,
      subject: p.slice(0, 200),
      hints: { file_hints: fileHints, verbs: lang.trigger_matches.slice(0, 8) },
      confidence: Math.max(0.05, Math.min(0.98, confidence)),
    };
  }

  // ── Layer 2: legacy regex fallback ──────────────────────────────
  const verbs: string[] = [];
  const yes = (re: RegExp) => { if (re.test(lower)) verbs.push(re.source); };
  yes(/\badd\b/); yes(/\bcreate\b/); yes(/\bbuild\b/); yes(/\bimplement\b/);
  yes(/\bfix\b/); yes(/\brepair\b/); yes(/\bbug\b/); yes(/\bbroken\b/);
  yes(/\bexplain\b/); yes(/\bwhat\b/); yes(/\bhow\b/); yes(/\bwhere\b/);
  yes(/\brefactor\b/); yes(/\brename\b/); yes(/\brestructure\b/);
  yes(/\bmigrat(e|ion)\b/); yes(/\bschema\b/); yes(/\btable\b/);
  yes(/\broute\b/); yes(/\bendpoint\b/); yes(/\bapi\b/);

  let kind: Intent["kind"] = "unknown";
  let confidence = 0.3;
  if (/\bfix\b|\bbug\b|\bbroken\b|\bnot working\b/.test(lower)) { kind = "fix_bug"; confidence = 0.72; }
  else if (/\bexplain\b|\bhow does\b|\bwhat (is|does)\b|\bwhere is\b/.test(lower)) { kind = "explain"; confidence = 0.7; }
  else if (/\brefactor\b|\brename\b|\bmove\b/.test(lower)) { kind = "refactor"; confidence = 0.65; }
  else if (/\bmigrat(e|ion)\b|\balter table\b|\bnew (table|column)\b/.test(lower)) { kind = "add_migration"; confidence = 0.7; }
  else if (/\bapi route\b|\bendpoint\b|\/api\//.test(lower)) { kind = "add_api_route"; confidence = 0.7; }
  else if (/\badd\b|\bcreate\b|\bbuild\b|\bimplement\b/.test(lower)) { kind = "add_feature"; confidence = 0.6; }

  if (fileHints.length > 0) confidence = Math.min(0.95, confidence + 0.1);
  if (verbs.length >= 3) confidence = Math.min(0.95, confidence + 0.05);
  if (p.length < 20) confidence -= 0.2;
  if (p.length > 400) confidence = Math.min(0.95, confidence + 0.05);

  return { kind, subject: p.slice(0, 200), hints: { file_hints: fileHints, verbs }, confidence: Math.max(0.05, Math.min(0.98, confidence)) };
}

export function clarifyingQuestions(intent: Intent): string[] {
  const qs: string[] = [];
  switch (intent.kind) {
    case "add_feature":
      qs.push("Which area of NEX should this land in? (e.g. accommodation adapter · chat composer · lab room · admin dashboard)");
      qs.push("Is there an existing similar feature I should mirror? Give a file path if you know one.");
      qs.push("What's the acceptance test? (one sentence describing when this is 'done')");
      break;
    case "fix_bug":
      qs.push("What's the reproduction? (steps, URL, or the smallest example that triggers it)");
      qs.push("What's the observed vs expected behaviour?");
      qs.push("Any error message or stack trace to paste?");
      break;
    case "explain":
      qs.push("Should I explain the code as-is, or trace how it behaves at runtime?");
      qs.push("Which file(s) should I start from? Paste any path you already know.");
      break;
    case "refactor":
      qs.push("What's the goal — smaller files, better naming, or removing duplication?");
      qs.push("Which files are in scope? Any protected files (rules/, db/migrations/, ADRs) that must NOT be touched?");
      break;
    case "add_migration":
      qs.push("Postgres migration under db/migrations/ or supabase/migrations/ ?");
      qs.push("Give me the target table + columns + constraints in plain English.");
      qs.push("Do we need a rollback SQL block?");
      break;
    case "add_api_route":
      qs.push("Route path? (e.g. /api/nex/lab/foo)");
      qs.push("GET, POST, or both? Auth requirements?");
      qs.push("What's the response shape?");
      break;
    default:
      qs.push("Can you say this in a different way? I couldn't classify the prompt into: add · fix · explain · refactor · migration · API route.");
      qs.push("If it's a feature idea, look at the Innovation Room — the Approve button gives you a ready-to-send engineering brief.");
  }
  return qs;
}

// ─── Plan composition (initial · round 1) ────────────────────────
export async function composeInitialPlan(taskId: string, prompt: string, intent: Intent): Promise<Plan> {
  await emitStep(taskId, "nex1", "thought", `intent=${intent.kind} · confidence=${intent.confidence.toFixed(2)}`, { intent, round: 1 });

  const read_results: Plan["read_results"] = [];
  for (const path of intent.hints.file_hints.slice(0, 3)) {
    const r = readFile(path, 12_000);
    await emitStep(taskId, "nex1", "tool_call", `read_file ${path}`, { input: { path }, round: 1 });
    await emitStep(taskId, "nex1", "tool_result", `read_file ${r.ok ? "ok" : "fail"} · ${r.data ? (r.data as { size: number }).size : 0} bytes`, { ...r, round: 1 });
    read_results.push({ tool: "read_file", ok: r.ok, summary: r.ok ? `read ${path} (${(r.data as { size: number }).size} bytes)` : (r.reason ?? "error") });
  }
  if (intent.kind === "add_feature" || intent.kind === "add_api_route") {
    const q = intent.subject.split(/\s+/).find(w => w.length > 4) ?? "";
    if (q) {
      const r = searchCode(q, { pathPrefix: "src", maxMatches: 12 });
      await emitStep(taskId, "nex1", "tool_call", `search_code "${q}"`, { input: { query: q }, round: 1 });
      await emitStep(taskId, "nex1", "tool_result", `search_code · ${r.ok ? (r.data as { matches: unknown[] }).matches.length : 0} matches`, { ...r, round: 1 });
      read_results.push({ tool: "search_code", ok: r.ok, summary: r.ok ? `${(r.data as { matches: unknown[] }).matches.length} matches for "${q}"` : (r.reason ?? "error") });
    }
  }

  const steps: PlanStep[] = [];
  const files_to_read: string[] = [...intent.hints.file_hints];
  const files_to_touch: string[] = [];
  const files_to_create: string[] = [];
  const risks: string[] = [];
  let acceptance_test = "Not specified · engineer to confirm.";
  const verification_gates_to_run = ["typecheck", "lint", "unit_tests", "architecture_scan"];

  const rulesJson = JSON.parse(readFileSync(resolve(REPO_ROOT, "rules/architecture.json"), "utf8"));
  const canonical = rulesJson.canonical_paths as Record<string, string>;

  switch (intent.kind) {
    case "add_feature":
      files_to_create.push(canonical.library.replace("{name}", "TBD"));
      steps.push({ number: 1, action: "Confirm target library + module name with founder", rationale: "canonical library path is " + canonical.library });
      steps.push({ number: 2, action: "Look at 2-3 existing similar modules in src/lib/nex/", tool: "list_directory", target: "src/lib/nex/", rationale: "mirror the shape rather than invent one" });
      steps.push({ number: 3, action: "Write the module + one-line file summary comment", rationale: "codebase convention" });
      steps.push({ number: 4, action: "Wire the module into its consumer (route/adapter/etc.)", rationale: "" });
      steps.push({ number: 5, action: "Add tests", rationale: "verification gate requires unit tests" });
      risks.push("If the module needs Postgres access, use `pg` directly — do NOT introduce @supabase/*");
      acceptance_test = "Feature is reachable from the target surface + unit test passes + typecheck clean.";
      break;
    case "fix_bug":
      steps.push({ number: 1, action: "Reproduce the bug locally with the founder-supplied steps", rationale: "no fix without repro" });
      steps.push({ number: 2, action: "Locate the failing code path", tool: "search_code", rationale: "" });
      steps.push({ number: 3, action: "Write a failing test that reproduces the bug", rationale: "regression prevention" });
      steps.push({ number: 4, action: "Fix the minimum lines needed to make the test pass", rationale: "" });
      risks.push("Do not add error handling for scenarios that can't happen · CLAUDE.md rule");
      acceptance_test = "New regression test passes · existing tests still pass · manual repro no longer triggers the bug.";
      break;
    case "explain":
      steps.push({ number: 1, action: "Read the file(s) the founder mentioned", tool: "read_file", rationale: "" });
      steps.push({ number: 2, action: "Trace imports one level out", tool: "search_code", rationale: "understand context" });
      steps.push({ number: 3, action: "Return a plain-language summary + file:line pointers", rationale: "" });
      acceptance_test = "Founder can restate the code's purpose in one sentence after reading nex1's explanation.";
      break;
    case "add_migration":
      files_to_create.push(canonical.migration_new_pg.replace("{next_number}", "TBD").replace("{title}", "TBD"));
      steps.push({ number: 1, action: "Pick next migration number by scanning db/migrations/", tool: "list_directory", rationale: "migrations are append-only" });
      steps.push({ number: 2, action: "Write CREATE/ALTER statements in idempotent form (IF NOT EXISTS)", rationale: "safe to re-run" });
      steps.push({ number: 3, action: "Include rollback SQL as a comment block", rationale: "" });
      steps.push({ number: 4, action: "Never modify an existing migration file", rationale: "immutable per architecture constitution" });
      risks.push("Migrations touch shared Postgres · founder approval required before apply");
      acceptance_test = "Migration applies cleanly on a fresh nex_dev DB + rollback SQL cleans up.";
      break;
    case "add_api_route":
      files_to_create.push(canonical.api_route.replace("{route}", "TBD"));
      steps.push({ number: 1, action: "Confirm exact route path + auth model with founder", rationale: "" });
      steps.push({ number: 2, action: "Write route handler with leading `//` summary comment", rationale: "codebase convention" });
      steps.push({ number: 3, action: "Never surface secrets · never accept forbidden strings in body", rationale: "security" });
      acceptance_test = "Route returns expected JSON shape · handles missing params gracefully.";
      break;
    case "refactor":
      steps.push({ number: 1, action: "Identify exact files in scope", tool: "list_directory", rationale: "avoid scope creep" });
      steps.push({ number: 2, action: "Confirm no protected files are touched", tool: "architecture_scan", rationale: "constitution enforcement" });
      steps.push({ number: 3, action: "Preserve public API · only move internal structure", rationale: "" });
      risks.push("Cannot rename or delete files under db/migrations · docs/DECISIONS · rules/");
      acceptance_test = "All existing tests still pass · public exports unchanged.";
      break;
    default:
      steps.push({ number: 1, action: "Ask founder to rephrase or narrow the request", rationale: "intent classifier below confidence threshold" });
      acceptance_test = "Founder confirms the intent classification.";
  }

  const proposed_files = generateProposedFiles(intent, prompt);
  if (proposed_files.length > 0) {
    await emitStep(taskId, "nex1", "plan", `proposed ${proposed_files.length} file(s) for preview`, { proposed_files: proposed_files.map(pf => ({ path: pf.path, action: pf.action, language: pf.language, why: pf.why })), round: 1 });
  }

  return { intent, files_to_read, files_to_touch, files_to_create, acceptance_test, steps, risks, verification_gates_to_run, read_results, proposed_files, round: 1 };
}

// ─── nex2 · Architecture Guardian · V1.4 (adds ADR IMPACT) ──────
export async function nex2Review(taskId: string, plan: Plan, round: number): Promise<ReviewResult> {
  await emitStep(taskId, "nex2", "thought", `round ${round} · starting architecture scan + ADR impact`, { round });
  const touched = [...plan.files_to_touch, ...plan.files_to_create];
  const scan = architectureScan({ touched_paths: touched, added_dependencies: [], diff_text: (plan.proposed_files ?? []).map(pf => pf.preview_content).join("\n") });
  const findings = (scan.data as { findings: Array<{ severity: string; rule: string; detail: string; location?: string }> } | undefined)?.findings ?? [];
  // V1.4 · run ADR IMPACT against the feature description
  const adrReport = analyseADRImpact(plan.intent?.subject ?? "");
  for (const impact of adrReport.impacts) {
    if (impact.adjudication === "FAIL") {
      findings.push({ severity: "block", rule: "adr_impact_fail", detail: `${impact.ref} · ${impact.title} · ${impact.reasoning}`, location: impact.ref });
    } else if (impact.adjudication === "ATTENTION") {
      findings.push({ severity: "warn", rule: "adr_impact_attention", detail: `${impact.ref} · ${impact.reasoning}`, location: impact.ref });
    }
  }
  const pass = !findings.some(f => f.severity === "block" || f.severity === "violation");
  await emitStep(taskId, "nex2", pass ? "review_pass" : "review_fail",
    `round ${round} · nex2 · ${findings.length} finding(s) · ADR verdict: ${adrReport.overall_verdict}${pass ? "" : " · asks nex1 to revise"}`,
    { findings, adr_impact_report: adrReport, round });
  return { pass, findings, reviewer: "nex2", round };
}

// ─── nex3 · Security + Doctrine Reviewer · V1.4 (adds deep security + truth-engine + merge gate) ─
export async function nex3Review(taskId: string, plan: Plan, prompt: string, round: number): Promise<ReviewResult> {
  await emitStep(taskId, "nex3", "thought", `round ${round} · deep security + truth-engine + merge gate`, { intent: plan.intent.kind, round });
  const findings: Array<{ severity: string; rule: string; detail: string; location?: string }> = [];
  const haystack = (prompt + " " + JSON.stringify(plan)).toLowerCase();
  const forbiddenPhrases = [
    { needle: "supabase auth", detail: "ADR-0300 · migrate away from supabase" },
    { needle: "commission", detail: "ADR-0003 · no commission" },
    { needle: "per-lead-fee", detail: "ADR-0003 · no lead sales" },
    { needle: "instagram.com", detail: "ADR-0022 · no third-party image copy" },
    { needle: "facebook.com/", detail: "ADR-0022 · no third-party image copy" },
  ];
  for (const p of forbiddenPhrases) {
    if (haystack.includes(p.needle)) findings.push({ severity: "warn", rule: "doctrine_phrase", detail: p.detail, location: p.needle });
  }
  const gates = plan.verification_gates_to_run;
  if (!gates.includes("typecheck")) findings.push({ severity: "warn", rule: "verification_missing", detail: "typecheck not in plan gates" });
  if (!gates.includes("architecture_scan")) findings.push({ severity: "warn", rule: "verification_missing", detail: "architecture_scan not in plan gates" });

  // V1.4 · deep security scan on proposed_files content · also scans intent.subject
  const securityFindings = scanSecurity(plan.proposed_files ?? [], plan.intent?.subject);
  for (const s of securityFindings) {
    const severity = s.severity === "critical" || s.severity === "high" ? "block" : s.severity === "medium" ? "warn" : "info";
    findings.push({ severity, rule: `security_${s.rule}`, detail: s.detail, location: s.path });
  }

  // V1.4 · truth-engine guard
  const teFindings = scanTruthEngineGuard([...(plan.files_to_touch ?? []), ...(plan.files_to_create ?? [])]);
  for (const t of teFindings) {
    findings.push({ severity: "block", rule: "truth_engine_protected", detail: t.detail, location: t.path });
  }

  // V1.4 · merge gate summary (recorded but doesn't add extra findings beyond above)
  const mergeGate = runMergeGate(plan);

  const pass = !findings.some(f => f.severity === "block" || f.severity === "violation");
  await emitStep(taskId, "nex3", pass ? "review_pass" : "review_fail",
    `round ${round} · nex3 · ${findings.length} finding(s) · merge_gate: ${mergeGate.can_merge ? "PASS" : "BLOCK"}${pass ? "" : " · asks nex1 to revise"}`,
    { findings, merge_gate: mergeGate, round });
  return { pass, findings, reviewer: "nex3", round };
}

// ─── Brief composer ─────────────────────────────────────────────
export function composeBrief(task: TaskRow, plan: Plan, reviews: ReviewResult[], rounds_used: number): string {
  const rulesJson = JSON.parse(readFileSync(resolve(REPO_ROOT, "rules/architecture.json"), "utf8"));
  const parts: string[] = [];
  parts.push(`# ENGINEERING BRIEF · NEX Agent v1.1 · task ${task.task_id}`);
  parts.push("");
  parts.push(`**Founder prompt**: ${task.prompt}`);
  parts.push("");
  parts.push(`**Classified intent**: ${plan.intent.kind} · confidence ${plan.intent.confidence.toFixed(2)}`);
  parts.push(`**Rounds of discussion**: ${rounds_used} of ${MAX_ROUNDS} max`);
  parts.push("");
  parts.push("## Acceptance test");
  parts.push(plan.acceptance_test);
  parts.push("");
  parts.push("## Files to create");
  parts.push(plan.files_to_create.length ? plan.files_to_create.map(f => `- ${f}`).join("\n") : "_none_");
  parts.push("");
  parts.push("## Files to modify");
  parts.push(plan.files_to_touch.length ? plan.files_to_touch.map(f => `- ${f}`).join("\n") : "_none_");
  parts.push("");
  parts.push("## Steps");
  parts.push(plan.steps.map(s => `${s.number}. **${s.action}** — ${s.rationale}${s.tool ? ` _(tool: ${s.tool})_` : ""}${s.target ? ` _(target: ${s.target})_` : ""}`).join("\n"));
  parts.push("");
  parts.push("## Risks");
  parts.push(plan.risks.length ? plan.risks.map(r => `- ${r}`).join("\n") : "_none flagged_");
  parts.push("");
  parts.push("## Verification gates");
  parts.push(plan.verification_gates_to_run.map(g => `- [ ] ${g}`).join("\n"));
  parts.push("");
  parts.push("## Architecture reviews");
  for (const r of reviews) {
    parts.push(`### ${r.reviewer} · round ${r.round} · ${r.pass ? "PASS ✓" : "FAIL ✗"}`);
    if (r.findings.length === 0) parts.push("_no findings_");
    else for (const f of r.findings) parts.push(`- \`${f.severity}\` · ${f.rule} · ${f.detail}${f.location ? ` (${f.location})` : ""}`);
  }
  parts.push("");
  if (plan.proposed_files && plan.proposed_files.length > 0) {
    parts.push("## Proposed files (preview · engineer applies)");
    for (const pf of plan.proposed_files) {
      parts.push(`### ${pf.action.toUpperCase()} · \`${pf.path}\` · ${pf.language}`);
      parts.push(`_Why:_ ${pf.why}`);
      parts.push("```" + pf.language);
      parts.push(pf.preview_content);
      parts.push("```");
      parts.push("");
    }
  }
  parts.push("## Doctrine constraints (must respect)");
  parts.push(`- **Hard rule**: ${rulesJson.hard_rule}`);
  parts.push("- ADR-0022 · no third-party image copy · ODbL/CC only");
  parts.push("- ADR-0023 · seed rows text-only");
  parts.push("- ADR-0003 · fixed subscription only · no commission · no lead sales");
  parts.push("- ADR-0300 · phase out supabase · new features route to `pg` (PostgreSQL) direct");
  parts.push("- ADR-0028 / ADR-0033 · preserve knowledge · brain isolation · <70 confidence save fails");
  parts.push("");
  parts.push("## Delivery checklist");
  parts.push("- [ ] Implementation lands under the canonical path listed above");
  parts.push("- [ ] Leading `//` summary comment at the top of every new file");
  parts.push("- [ ] Type-check + lint pass");
  parts.push("- [ ] Manual test in dev server before reporting complete");
  parts.push(`- [ ] After ship: \`UPDATE nex_agent.tasks SET status='shipped' WHERE task_id='${task.task_id}';\``);
  return parts.join("\n");
}

// ─── MAIN · discussion-loop orchestrator ────────────────────────
export async function processTask(taskId: string): Promise<{ status: string; plan?: Plan; questions?: string[]; brief?: string; rounds_used?: number }> {
  const task = await getTask(taskId);
  if (!task) throw new Error("task_not_found");

  // ── Layer 2 pre-check · nex.questions surface pattern ──────────
  // If a canonical question pattern matches strongly, use its intent_slug
  // instead of falling through the trigger-token scorer. Same substrate as
  // chat · nex-agent achieves parity here (ADR-0308 rule 5: chat + nex1 use
  // the same resolver).
  let layer2Slug: string | null = null;
  try {
    const q = await matchQuestion(task.prompt, 0.85);
    if (q) {
      layer2Slug = q.intent_slug;
      await emitStep(taskId, "nex1", "thought", `Layer 2 pattern hit · ${q.surface_pattern} → ${q.intent_slug}`, {
        question_id: q.question_id, entities: q.entities, answer_type: q.answer_type, concept_id: q.concept_id, confidence: q.confidence,
      });
    }
  } catch (e) {
    // Layer 2 failure is non-fatal · Layer 1 classifier will take over.
    await emitStep(taskId, "nex1", "thought", `Layer 2 soft-fail · ${(e as Error).message.slice(0, 80)}`, {});
  }

  // ── Phase 4 · meta-intent short-circuit ─────────────────────────
  // Before running the full classifier, check whether the founder is asking
  // a meta question (what can you do · hello · etc). These get an immediate
  // natural-English answer via the shared code-intent-registry reply template.
  // No plan · no review cycle · no clarify questions. NEX1 talks back.
  const metaParse = parseIntent(task.prompt, { intents: CODE_INTENT_REGISTRY, minConfidence: 0.2 });
  // Layer 2 slug wins if it says meta · overrides parser's guess.
  const isMetaByLayer2 = layer2Slug === "capabilities" || layer2Slug === "small_talk";
  const isMetaByLayer1 = metaParse.intent_slug === "capabilities" || metaParse.intent_slug === "small_talk";
  if (isMetaByLayer2 || isMetaByLayer1) {
    const chosenMetaSlug = isMetaByLayer2 ? (layer2Slug as string) : (metaParse.intent_slug as string);
    const intent = classifyPrompt(task.prompt);
    await emitStep(taskId, "nex1", "thought", `meta intent detected · ${chosenMetaSlug} · answering directly`, { intent, meta: chosenMetaSlug, source: isMetaByLayer2 ? "layer2_question_pattern" : "layer1_trigger_score" });
    const metaIntent = CODE_INTENT_REGISTRY.find(i => i.slug === chosenMetaSlug)!;
    const reply = metaIntent.reply_template;
    // Uses "handoff" step_kind (existing enum) since "answer" would need
    // a schema migration · founder-controlled boundary preserved.
    await emitStep(taskId, "nex1", "handoff", reply.split("\n")[0].slice(0, 120), { reply, intent_slug: chosenMetaSlug, kind: "meta_answer" });
    // Compose a minimal no-op plan so downstream flows have a shape to look at,
    // but mark the task plan_ready so the founder sees closure.
    const emptyPlan: Plan = {
      intent, files_to_read: [], files_to_touch: [], files_to_create: [],
      acceptance_test: "Meta answer only · no code change.",
      steps: [{ number: 1, action: "answer_meta_question", rationale: `intent=${chosenMetaSlug}` }],
      risks: [], verification_gates_to_run: [], read_results: [], round: 1,
    };
    await updateTask(taskId, { status: "plan_ready", current_actor: "founder", plan: emptyPlan, brief: reply });
    return { status: "plan_ready", plan: emptyPlan, brief: reply, rounds_used: 0 };
  }

  const intent = classifyPrompt(task.prompt);
  await updateTask(taskId, { status: "clarifying", current_actor: "nex1" });
  await emitStep(taskId, "nex1", "thought", "classifying prompt", { intent });

  // ── Concept resolution · shared with NEX Chat via nex.concept_senses ─
  // NEX1 reads the SAME concept substrate as NEX Chat. Programming knowledge
  // is layered ON TOP of the shared concept (ADR-0308 rule 6-7). For every
  // canonical-shaped token in the prompt, try to resolve it and log the
  // chosen sense_id · this is the observability proof that nex1 sees the
  // same sense_id as chat for the same concept.
  try {
    const norm = normalise(task.prompt);
    const resolved: Array<{ token: string; concept: string; sense_key: string; sense_id: string; ambiguous: boolean }> = [];
    for (const tok of norm.canonical_tokens.slice(0, 6)) {
      const r = await resolveConcept(tok, { cooccur_tokens: norm.canonical_tokens, domain_hint: ["programming"] });
      if (r && r.chosen_sense) resolved.push({ token: tok, concept: r.canonical_key, sense_key: r.chosen_sense.sense_key, sense_id: r.chosen_sense.sense_id, ambiguous: r.ambiguous });
    }
    if (resolved.length > 0) {
      await emitStep(taskId, "nex1", "thought", `resolved ${resolved.length} concept(s) from shared substrate`, { resolved });
    }
  } catch (e) {
    // Never let resolver failure break plan · log and move on.
    await emitStep(taskId, "nex1", "thought", `concept_resolver_soft_fail:${(e as Error).message.slice(0, 100)}`, {});
  }

  if (intent.confidence < 0.55 || intent.kind === "unknown") {
    const questions = clarifyingQuestions(intent);
    for (const q of questions) await emitStep(taskId, "nex1", "question", q, { intent });
    await updateTask(taskId, { status: "clarifying" });
    return { status: "clarifying", questions };
  }

  await updateTask(taskId, { status: "planning" });
  await emitStep(taskId, "system", "handoff", `starting discussion · MAX_ROUNDS=${MAX_ROUNDS}`, { round: 1 });

  let plan = await composeInitialPlan(taskId, task.prompt, intent);
  const allReviews: ReviewResult[] = [];
  let round = 1;
  let consensus = false;
  let hardStop = false;
  let lastStuck: string[] = [];

  while (round <= MAX_ROUNDS && !consensus && !hardStop) {
    plan.round = round;
    await emitStep(taskId, "system", "handoff", `─── ROUND ${round} · reviewers now inspecting nex1's plan ───`, { round });

    const nex2 = await nex2Review(taskId, plan, round);
    const nex3 = await nex3Review(taskId, plan, task.prompt, round);
    allReviews.push(nex2, nex3);

    if (isConsensus(nex2, nex3)) {
      consensus = true;
      await emitStep(taskId, "system", "handoff", `✓ CONSENSUS reached at round ${round}`, { round });
      break;
    }

    // nex1 revises based on both reviewers' findings
    const combinedFindings = [...nex2.findings, ...nex3.findings];
    const revision = reviseFromCritique(plan, combinedFindings);
    lastStuck = revision.cannot_revise;

    await emitStep(taskId, "nex1", "handoff",
      `round ${round} · nex1 revises · applied ${revision.changes_applied.length} change(s)${revision.cannot_revise.length > 0 ? ` · ${revision.cannot_revise.length} stuck` : ""}`,
      { round, changes_applied: revision.changes_applied, cannot_revise: revision.cannot_revise, summary: summariseRound(round, nex2, nex3, revision) });

    if (revision.cannot_revise.length > 0 && revision.changes_applied.length === 0) {
      // nex1 has nothing more to offer · stop the loop
      hardStop = true;
      await emitStep(taskId, "system", "handoff", `⛔ HALT · nex1 cannot auto-fix ${revision.cannot_revise.length} finding(s) · founder decides`, { round, stuck: revision.cannot_revise });
      break;
    }

    plan = revision.revised_plan;
    round++;
  }

  const rounds_used = round;
  const brief = composeBrief(task, plan, allReviews, rounds_used);

  let finalStatus: string;
  if (consensus) finalStatus = "plan_ready";
  else if (hardStop) finalStatus = "plan_rejected";
  else finalStatus = "plan_rejected"; // hit MAX_ROUNDS · founder decides

  await updateTask(taskId, {
    status: finalStatus,
    current_actor: finalStatus === "plan_ready" ? "founder" : "nex1",
    plan: plan as unknown as Record<string, unknown>,
    brief,
  });

  await emitStep(taskId, "system",
    finalStatus === "plan_ready" ? "handoff" : "review_fail",
    finalStatus === "plan_ready"
      ? `plan handed to founder for approval · ${rounds_used} round(s) of discussion`
      : `plan rejected after ${rounds_used} round(s)${hardStop ? " · stuck on: " + lastStuck.slice(0, 2).join("; ") : " · hit MAX_ROUNDS"}`);

  return { status: finalStatus, plan, brief, rounds_used };
}
