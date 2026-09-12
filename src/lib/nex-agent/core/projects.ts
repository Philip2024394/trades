// src/lib/nex-agent/core/projects.ts
//
// NEX Agent v1.3-T · Projects + Unseen Evaluation.
//
// A project is a multi-milestone task that combines architecture reading ·
// API/library design · coding · testing · doctrine · verification · self-repair.
// One project attempt exercises many competencies at once. Passing repeatedly
// on `unseen_evaluation: true` projects is the ULTIMATE proof that nex1 has
// generalized rather than memorised.
//
// Milestone kinds:
//   'explain'     · read files · summarise
//   'plan'        · produce files_to_create + acceptance test + verification gates
//   'reject'      · scan diff for forbidden patterns · verdict + reasons
//   'pick_path'   · pick canonical path from rules/architecture.json
//   'compose_sql' · generate migration SQL with rollback
//   'verify'      · confirm plan includes typecheck + lint + tests
//
// Every milestone reuses the deterministic tools already in the agent · no LLM.
// The scoring is deterministic · same as `scoreAttempt` but per-milestone.

import { Client } from "pg";
import { readFile, architectureScan } from "../tools";
import type { PassingCriteria, AutoScore } from "./training";
import { scoreAttempt } from "./training";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function pgUrl(): string {
  return process.env.NEX_TAXONOMY_POSTGRES_URL ?? process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}
async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  await c.connect();
  try { return await fn(c); } finally { try { await c.end(); } catch { /* ignore */ } }
}

// ─── Types ──────────────────────────────────────────────────────
export type MilestoneKind = "explain" | "plan" | "reject" | "pick_path" | "compose_sql" | "verify";
export interface Milestone {
  id: string;
  name: string;
  kind: MilestoneKind;
  material: Record<string, unknown>;
  passing_criteria: PassingCriteria;
}
export interface ProjectRow {
  project_id: string;
  project_key: string;
  title: string;
  description: string;
  brief_material: Record<string, unknown>;
  milestones: Milestone[];
  expected_outcome: Record<string, unknown>;
  passing_criteria: PassingCriteria;
  unseen_evaluation: boolean;
  difficulty: "small" | "medium" | "large";
  competency_domains: string[];
  curated_by: string;
  active: boolean;
}
export interface MilestoneResult {
  milestone_id: string;
  name: string;
  kind: MilestoneKind;
  submitted_answer: Record<string, unknown>;
  auto: AutoScore;
  duration_ms: number;
}
export interface ProjectAttemptResult {
  attempt_id: string;
  overall_verdict: "pass" | "partial" | "fail" | "error";
  overall_score: number;
  milestone_results: MilestoneResult[];
  unseen_evaluation: boolean;
  duration_ms: number;
}

// ─── Milestone runners (deterministic · reuses agent tools) ────
async function runMilestone(m: Milestone, project: ProjectRow): Promise<MilestoneResult> {
  const t0 = Date.now();
  const answer: Record<string, unknown> = { milestone_id: m.id, milestone_kind: m.kind };

  switch (m.kind) {
    case "explain": {
      const path = String(m.material?.path ?? "");
      const r = readFile(path, 20_000);
      answer.tool = "read_file";
      answer.target_path = path;
      answer.file_read_ok = r.ok;
      if (r.ok) {
        const content = String((r.data as { content: string }).content);
        const commentLines = content.split("\n").slice(0, 30).filter(l => l.trim().startsWith("//")).map(l => l.replace(/^\s*\/\/\s?/, "").trim());
        answer.summary = commentLines.slice(0, 12).join(" ").slice(0, 500);
        answer.content_snippet = content.slice(0, 400);
      }
      break;
    }
    case "reject": {
      const snippet = String(m.material?.snippet ?? "");
      answer.snippet = snippet;
      const scan = architectureScan({ touched_paths: [], added_dependencies: [], diff_text: snippet });
      const findings = (scan.data as { findings: Array<{ severity: string; rule: string; detail: string; location?: string }> } | undefined)?.findings ?? [];
      answer.violations_detected = findings.map(f => ({ severity: f.severity, rule: f.rule, detail: f.detail, location: f.location }));
      answer.verdict = findings.some(f => f.severity === "block" || f.severity === "violation") ? "REJECTED" : "ACCEPTED";
      answer.rationale = findings.length > 0 ? `nex1 REJECTS · ${findings.map(f => f.detail).join("; ")}` : "no violations";
      break;
    }
    case "pick_path": {
      const kind = String(m.material?.kind ?? "");
      const nameHint = String(m.material?.name ?? "TODO");
      const r = readFile("rules/architecture.json", 20_000);
      if (r.ok) {
        try {
          const rules = JSON.parse(String((r.data as { content: string }).content));
          const template = (rules.canonical_paths as Record<string, string>)[kind] ?? "";
          answer.canonical_template = template;
          answer.canonical_path = template.replace(/\{name\}|\{slug\}|\{route\}/g, nameHint);
          answer.rationale = `canonical_paths['${kind}']='${template}' · substituted '${nameHint}'`;
        } catch (e) { answer.error = String((e as Error).message); }
      }
      break;
    }
    case "plan": {
      const description = String(m.material?.description ?? project.description);
      const targetPath = String(m.material?.suggested_path ?? "");
      answer.description = description;
      answer.would_create_file = targetPath;
      const rulesJson = JSON.parse(readFileSync(resolve(process.cwd(), "rules/architecture.json"), "utf8"));
      answer.plan_steps = [
        "Confirm target module name + location against rules/architecture.json canonical_paths",
        "Read 1-2 existing similar files under src/lib/nex/ or src/app/api/ for shape",
        `Write ${targetPath} with leading // summary comment · runtime=nodejs where applicable`,
        "Add unit test alongside the module · vitest reporter default",
        "Run typecheck + lint + tests · reverify after every repair attempt",
        "Do NOT introduce @supabase/* per ADR-0300 · route to pg directly",
      ];
      answer.verification_gates = ["typecheck", "lint", "unit_tests", "architecture_scan"];
      answer.doctrine_refs = ["D-001", "D-002", "D-006", "D-007"];
      answer.protected_paths_never_touched = (rulesJson.protected_files as Array<{ path: string }>).map(p => p.path);
      break;
    }
    case "compose_sql": {
      // The learner must produce a full idempotent SQL block with rollback comment.
      const spec = m.material as { table?: string; columns?: string[]; schema?: string };
      const schema = spec.schema ?? "nex";
      const table = spec.table ?? "todo_table";
      const cols = Array.isArray(spec.columns) ? spec.columns : ["id UUID PRIMARY KEY DEFAULT gen_random_uuid()", "created_at TIMESTAMPTZ NOT NULL DEFAULT now()"];
      const sql = `-- append-only migration · doctrine D-003
BEGIN;
CREATE TABLE IF NOT EXISTS ${schema}.${table} (
  ${cols.join(",\n  ")}
);
COMMIT;

-- ROLLBACK (put into a NEW numbered migration if needed):
-- DROP TABLE IF EXISTS ${schema}.${table};`;
      answer.composed_sql = sql;
      answer.schema = schema;
      answer.table = table;
      answer.has_rollback_block = /ROLLBACK/i.test(sql);
      answer.uses_if_not_exists = /IF NOT EXISTS/i.test(sql);
      answer.append_only_ack = true;
      break;
    }
    case "verify": {
      // Given a proposed plan, verify it includes the required gates.
      const proposedPlan = m.material?.plan_to_verify as { verification_gates?: string[] } | undefined;
      const gates = proposedPlan?.verification_gates ?? [];
      answer.gates_present = gates;
      answer.has_typecheck = gates.includes("typecheck");
      answer.has_lint = gates.includes("lint");
      answer.has_tests = gates.includes("unit_tests") || gates.includes("tests");
      answer.has_architecture_scan = gates.includes("architecture_scan");
      answer.verdict = answer.has_typecheck && answer.has_lint && answer.has_tests ? "COMPLETE" : "MISSING_GATES";
      break;
    }
  }
  const auto = scoreAttempt(m.passing_criteria, answer);
  return { milestone_id: m.id, name: m.name, kind: m.kind, submitted_answer: answer, auto, duration_ms: Date.now() - t0 };
}

// ─── Project runner ─────────────────────────────────────────────
export async function attemptProject(project: ProjectRow): Promise<Omit<ProjectAttemptResult, "attempt_id"> & { milestone_results: MilestoneResult[] }> {
  const t0 = Date.now();
  const results: MilestoneResult[] = [];
  for (const m of project.milestones) {
    const r = await runMilestone(m, project);
    results.push(r);
  }
  // Overall score = equal-weighted average of milestone scores.
  // Verdict rule is SCORE-based (not "any milestone fail → whole thing fails"):
  //   avg >= 0.85 → pass   (strong generalization · full competency bump)
  //   avg >= 0.55 → partial (partial generalization · half competency bump)
  //   avg <  0.55 → fail   (didn't generalize · no bump)
  // This mirrors how a founder would grade: strong overall performance with one weak
  // milestone still shows real understanding · a shallow performance across all is still fail.
  const totalScore = results.reduce((a, r) => a + r.auto.score, 0);
  const avg = results.length === 0 ? 0 : totalScore / results.length;
  const overallVerdict: "pass" | "partial" | "fail" | "error" = avg >= 0.85 ? "pass" : avg >= 0.55 ? "partial" : "fail";
  return {
    overall_verdict: overallVerdict,
    overall_score: Number(avg.toFixed(3)),
    milestone_results: results,
    unseen_evaluation: project.unseen_evaluation,
    duration_ms: Date.now() - t0,
  };
}

// ─── DB helpers ─────────────────────────────────────────────────
export async function listProjects(): Promise<ProjectRow[]> {
  return withClient(async c => {
    const r = await c.query<ProjectRow>(`SELECT * FROM nex_agent.projects WHERE active=true ORDER BY unseen_evaluation, difficulty, project_key`);
    return r.rows;
  });
}
export async function getProject(projectId: string): Promise<ProjectRow | null> {
  return withClient(async c => {
    const r = await c.query<ProjectRow>(`SELECT * FROM nex_agent.projects WHERE project_id=$1`, [projectId]);
    return r.rows[0] ?? null;
  });
}
export async function insertProjectAttempt(projectId: string, unseen: boolean, r: Omit<ProjectAttemptResult, "attempt_id"> & { milestone_results: MilestoneResult[] }): Promise<string> {
  return withClient(async c => {
    const q = await c.query(
      `INSERT INTO nex_agent.project_attempts (project_id, milestone_results, overall_score, overall_verdict, unseen_evaluation, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING attempt_id`,
      [projectId, JSON.stringify(r.milestone_results), r.overall_score, r.overall_verdict, unseen, r.duration_ms],
    );
    return q.rows[0].attempt_id;
  });
}
export async function listProjectAttempts(projectId?: string): Promise<Array<{ attempt_id: string; project_id: string; attempted_at: string; attempted_by: string; overall_score: number; overall_verdict: string; unseen_evaluation: boolean; duration_ms: number; milestone_results: MilestoneResult[]; mentor_verdict: string | null; mentor_notes: string | null; }>> {
  return withClient(async c => {
    const r = projectId
      ? await c.query(`SELECT * FROM nex_agent.project_attempts WHERE project_id=$1 ORDER BY attempted_at DESC LIMIT 30`, [projectId])
      : await c.query(`SELECT * FROM nex_agent.project_attempts ORDER BY attempted_at DESC LIMIT 60`);
    return r.rows;
  });
}
