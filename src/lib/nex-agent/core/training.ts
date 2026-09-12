// src/lib/nex-agent/core/training.ts
//
// NEX Agent v1.1-T · Training Room · deterministic lesson evaluator.
//
// Flow:
//   Claude curates a lesson (question · material · expected_answer · passing_criteria)
//   nex1 attempts the lesson using its regular tool surface
//   Auto-scorer compares the attempt against passing_criteria (deterministic · keyword+shape matches)
//   Mentor (Claude in the loop) reviews · promotes learnings into nex_agent.doctrine_entries
//   Promoted doctrine can be applied to rules/architecture.json → nex2/nex3 enforce automatically

import { Client } from "pg";
import { readFile, searchCode, architectureScan } from "../tools";
import type { ToolResult } from "../tools";
import { analyseADRImpact } from "./adr-impact";

function pgUrl(): string {
  return process.env.NEX_TAXONOMY_POSTGRES_URL ?? process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}
async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  await c.connect();
  try { return await fn(c); } finally { try { await c.end(); } catch { /* ignore */ } }
}

// ─── Types ──────────────────────────────────────────────────────
export type LessonKind = "explain_module" | "implement_small_feature" | "reject_bad_code" | "identify_protected_files" | "pick_canonical_path" | "doctrine_recognition" | "adr_impact";

export interface LessonRow {
  lesson_id: string; created_at: string; lesson_key: string; lesson_kind: LessonKind;
  title: string; description: string;
  material: Record<string, unknown>;         // input the learner sees
  expected_answer: Record<string, unknown>;  // ground truth
  passing_criteria: PassingCriteria;
  difficulty: "foundational" | "intermediate" | "advanced";
  curated_by: string; active: boolean;
}
export interface PassingCriteria {
  must_include?: string[];        // strings that MUST appear in the answer (case-insensitive)
  must_reject?: string[];         // patterns the learner must flag as forbidden
  expected_paths?: string[];      // paths that must appear in the answer
  min_understanding_score?: number; // 0..1 · % of expected keywords matched
  requires_field?: string[];      // JSON fields nex1 must populate
}
export interface AttemptRow {
  attempt_id: string; lesson_id: string; attempted_at: string; attempted_by: string;
  submitted_answer: Record<string, unknown>;
  auto_score: number | null; auto_verdict: "pass" | "partial" | "fail" | "error" | null;
  auto_findings: Array<{ severity: string; rule: string; detail: string }> | null;
  mentor_reviewed_at: string | null; mentor_verdict: string | null; mentor_notes: string | null;
  mentor_extracted_doctrine: unknown;
}

// ─── Deterministic scorer ────────────────────────────────────────
export interface AutoScore { score: number; verdict: "pass" | "partial" | "fail"; findings: Array<{ severity: string; rule: string; detail: string }>; }

export function scoreAttempt(criteria: PassingCriteria, submitted: Record<string, unknown>): AutoScore {
  const findings: Array<{ severity: string; rule: string; detail: string }> = [];
  const answerText = JSON.stringify(submitted).toLowerCase();
  const answerFields = Object.keys(submitted);

  let hits = 0;
  let total = 0;

  // 1. must_include keywords · every listed keyword must appear
  if (Array.isArray(criteria.must_include)) {
    for (const kw of criteria.must_include) {
      total++;
      if (answerText.includes(kw.toLowerCase())) hits++;
      else findings.push({ severity: "warning", rule: "missing_keyword", detail: `expected keyword '${kw}' not in answer` });
    }
  }
  // 2. must_reject patterns · the learner must FLAG each as forbidden
  if (Array.isArray(criteria.must_reject)) {
    for (const pat of criteria.must_reject) {
      total++;
      // Answer must mention rejection of the pattern (heuristic: pattern appears near "reject", "forbidden", "block", "banned")
      const lower = pat.toLowerCase();
      const idx = answerText.indexOf(lower);
      const nearReject = idx >= 0 && /reject|forbid|banned|block|violation|no\s+supabase|adr-\d+/.test(answerText.slice(Math.max(0, idx - 200), idx + 200));
      if (idx >= 0 && nearReject) hits++;
      else findings.push({ severity: "error", rule: "must_reject_missed", detail: `learner did not clearly reject forbidden pattern '${pat}'` });
    }
  }
  // 3. expected_paths · each canonical path must appear
  if (Array.isArray(criteria.expected_paths)) {
    for (const p of criteria.expected_paths) {
      total++;
      if (answerText.includes(p.toLowerCase())) hits++;
      else findings.push({ severity: "warning", rule: "missing_path", detail: `expected canonical path '${p}' not in answer` });
    }
  }
  // 4. requires_field · answer JSON must have specific keys
  if (Array.isArray(criteria.requires_field)) {
    for (const fld of criteria.requires_field) {
      total++;
      if (answerFields.includes(fld) && submitted[fld] !== null && submitted[fld] !== undefined && String(submitted[fld]).trim().length > 0) hits++;
      else findings.push({ severity: "warning", rule: "missing_field", detail: `answer must include field '${fld}'` });
    }
  }

  const score = total === 0 ? 1 : hits / total;
  const minUnderstanding = criteria.min_understanding_score ?? 0.75;
  const verdict: AutoScore["verdict"] = score >= minUnderstanding ? "pass" : score >= 0.5 ? "partial" : "fail";
  return { score: Number(score.toFixed(3)), verdict, findings };
}

// ─── Lesson runner · nex1 attempts a lesson ──────────────────────
export async function nex1AttemptLesson(lesson: LessonRow): Promise<{ submitted_answer: Record<string, unknown>; auto: AutoScore }> {
  const answer: Record<string, unknown> = {};
  switch (lesson.lesson_kind) {
    case "explain_module": {
      const path = String(lesson.material?.path ?? "");
      const r = readFile(path, 20_000);
      answer.tool = "read_file";
      answer.target_path = path;
      answer.file_read_ok = r.ok;
      answer.content_snippet = r.ok ? String((r.data as { content: string }).content).slice(0, 800) : null;
      // Extract lines that start with comments (leading //) — the top-of-file summary
      if (r.ok) {
        const content = String((r.data as { content: string }).content);
        const commentLines = content.split("\n").slice(0, 30).filter(l => l.trim().startsWith("//")).map(l => l.replace(/^\s*\/\/\s?/, "").trim());
        answer.summary = commentLines.slice(0, 12).join(" ").slice(0, 500);
      }
      break;
    }
    case "reject_bad_code": {
      const snippet = String(lesson.material?.snippet ?? "");
      answer.snippet = snippet;
      // Run architecture_scan against the snippet
      const scan = architectureScan({ touched_paths: [], added_dependencies: [], diff_text: snippet });
      const findings = (scan.data as { findings: Array<{ severity: string; rule: string; detail: string; location?: string }> } | undefined)?.findings ?? [];
      answer.violations_detected = findings.map(f => ({ severity: f.severity, rule: f.rule, detail: f.detail, location: f.location }));
      answer.verdict = findings.some(f => f.severity === "block" || f.severity === "violation") ? "REJECTED" : "ACCEPTED";
      const reasons = findings.map(f => f.detail).join("; ");
      answer.rationale = findings.length > 0
        ? `nex1 REJECTS this code. Reasons flagged by architecture_scan: ${reasons}. NEX architecture requires alternative approach per rules/architecture.json.`
        : "nex1 sees no forbidden patterns in this snippet.";
      break;
    }
    case "identify_protected_files": {
      const paths = (lesson.material?.paths as string[]) ?? [];
      const scan = architectureScan({ touched_paths: paths, added_dependencies: [], diff_text: "" });
      const findings = (scan.data as { findings: Array<{ severity: string; rule: string; detail: string; location?: string }> } | undefined)?.findings ?? [];
      answer.paths_reviewed = paths;
      answer.protected_paths = findings.filter(f => f.rule === "protected_file_touched" || f.rule === "protected_directory_touched").map(f => f.location);
      answer.info_paths = findings.filter(f => f.rule === "append_only_new_file").map(f => f.location);
      answer.rationale = `nex1 ran architecture_scan on ${paths.length} paths. Found ${findings.length} findings.`;
      break;
    }
    case "pick_canonical_path": {
      const kind = String(lesson.material?.kind ?? "");
      const nameHint = String(lesson.material?.name ?? "TODO");
      // Read rules/architecture.json canonical_paths and match
      const r = readFile("rules/architecture.json", 20_000);
      if (r.ok) {
        try {
          const rules = JSON.parse(String((r.data as { content: string }).content));
          const canonical = rules.canonical_paths as Record<string, string>;
          const template = canonical[kind] ?? "";
          answer.matched_key = kind;
          answer.canonical_template = template;
          answer.canonical_path = template.replace(/\{name\}|\{slug\}|\{route\}/g, nameHint);
          answer.rationale = `nex1 read rules/architecture.json · canonical_paths['${kind}']='${template}' · substituted '${nameHint}' → '${answer.canonical_path}'`;
        } catch (e) { answer.error = String((e as Error).message); }
      }
      break;
    }
    case "implement_small_feature": {
      // Not implementing real code writing at V1.1-T · nex1 produces a PLAN
      const description = String(lesson.material?.description ?? "");
      const suggestedPath = String(lesson.material?.suggested_path ?? "");
      const r = suggestedPath ? readFile(suggestedPath, 5_000) : null;
      answer.description = description;
      answer.would_create_file = suggestedPath;
      answer.file_exists_check = r?.ok ?? false;
      answer.plan_steps = [
        "Read existing similar files for shape",
        `Create ${suggestedPath} with leading // summary comment`,
        "Add unit test",
        "Run typecheck + lint + tests",
        "Do NOT introduce @supabase/* · route to pg directly per ADR-0300",
      ];
      break;
    }
    case "doctrine_recognition": {
      const passage = String(lesson.material?.passage ?? "");
      const adrHits = Array.from(passage.matchAll(/adr-?\d{3,4}/gi)).map(m => m[0]);
      answer.passage_analyzed = passage.slice(0, 400);
      answer.adrs_referenced = adrHits;
      answer.doctrine_alignment = adrHits.length > 0 ? "aligned" : "unclear";
      break;
    }
    case "adr_impact": {
      const featureDescription = String(lesson.material?.feature_description ?? "");
      const report = analyseADRImpact(featureDescription);
      answer.feature_description = featureDescription;
      answer.affected_areas = report.affected_areas;
      answer.impacts = report.impacts;
      answer.overall_verdict = report.overall_verdict;
      answer.blockers = report.blockers;
      // Also produce a compact human-readable summary for the founder + scorer
      answer.report_summary = report.impacts.map(i => `${i.ref} · ${i.title} · ${i.adjudication}`).join(" | ");
      break;
    }
  }
  const auto = scoreAttempt(lesson.passing_criteria, answer);
  return { submitted_answer: answer, auto };
}

// ─── DB helpers ─────────────────────────────────────────────────
export async function listLessons(): Promise<LessonRow[]> {
  return withClient(async c => {
    const r = await c.query(`SELECT * FROM nex_agent.lessons WHERE active = true ORDER BY difficulty, lesson_key`);
    return r.rows;
  });
}
export async function getLesson(lessonId: string): Promise<LessonRow | null> {
  return withClient(async c => {
    const r = await c.query(`SELECT * FROM nex_agent.lessons WHERE lesson_id = $1`, [lessonId]);
    return r.rows[0] ?? null;
  });
}
export async function insertAttempt(lessonId: string, submitted: Record<string, unknown>, auto: AutoScore): Promise<string> {
  return withClient(async c => {
    const r = await c.query(
      `INSERT INTO nex_agent.lesson_attempts (lesson_id, submitted_answer, auto_score, auto_verdict, auto_findings)
       VALUES ($1, $2, $3, $4, $5) RETURNING attempt_id`,
      [lessonId, JSON.stringify(submitted), auto.score, auto.verdict, JSON.stringify(auto.findings)],
    );
    return r.rows[0].attempt_id;
  });
}
export async function listAttempts(lessonId?: string): Promise<AttemptRow[]> {
  return withClient(async c => {
    const r = lessonId
      ? await c.query(`SELECT * FROM nex_agent.lesson_attempts WHERE lesson_id=$1 ORDER BY attempted_at DESC LIMIT 30`, [lessonId])
      : await c.query(`SELECT * FROM nex_agent.lesson_attempts ORDER BY attempted_at DESC LIMIT 60`);
    return r.rows;
  });
}
export async function recordMentorReview(attemptId: string, verdict: string, notes: string, extractedDoctrine: unknown): Promise<void> {
  await withClient(c => c.query(
    `UPDATE nex_agent.lesson_attempts SET mentor_reviewed_at=now(), mentor_verdict=$1, mentor_notes=$2, mentor_extracted_doctrine=$3 WHERE attempt_id=$4`,
    [verdict, notes, JSON.stringify(extractedDoctrine ?? null), attemptId],
  ));
}
export async function promoteDoctrine(input: { doctrine_key: string; doctrine_text: string; severity?: "guidance" | "mandatory" | "forbidden"; source_lesson_id?: string; source_attempt_id?: string; promoted_by: string; }): Promise<string> {
  return withClient(async c => {
    const r = await c.query(
      `INSERT INTO nex_agent.doctrine_entries (doctrine_key, doctrine_text, severity, source_lesson_id, source_attempt_id, promoted_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (doctrine_key) DO UPDATE SET doctrine_text=EXCLUDED.doctrine_text, severity=EXCLUDED.severity, promoted_by=EXCLUDED.promoted_by
       RETURNING doctrine_id`,
      [input.doctrine_key, input.doctrine_text, input.severity ?? "guidance", input.source_lesson_id ?? null, input.source_attempt_id ?? null, input.promoted_by],
    );
    return r.rows[0].doctrine_id;
  });
}
export async function listDoctrine(): Promise<Array<{ doctrine_id: string; created_at: string; doctrine_key: string; doctrine_text: string; severity: string; promoted_by: string; source_lesson_id: string | null }>> {
  return withClient(async c => {
    const r = await c.query(`SELECT doctrine_id, created_at, doctrine_key, doctrine_text, severity, promoted_by, source_lesson_id FROM nex_agent.doctrine_entries WHERE superseded_by IS NULL ORDER BY created_at DESC LIMIT 100`);
    return r.rows;
  });
}
