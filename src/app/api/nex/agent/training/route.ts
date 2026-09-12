// src/app/api/nex/agent/training/route.ts
//
// NEX Agent v1.1-T · Training Room API.
// - GET → { lessons, recent_attempts, doctrine } snapshot for the UI
// - POST { action: 'attempt' | 'review' | 'promote', ... } → runs the action
//
// The attempt path invokes nex1's deterministic learner (no LLM). The review
// + promote paths let the mentor (founder / Claude) commit learnings into
// nex_agent.doctrine_entries so future rules can reference them.

import { NextResponse } from "next/server";
import { getLesson, listLessons, insertAttempt, listAttempts, nex1AttemptLesson, recordMentorReview, promoteDoctrine, listDoctrine } from "@/lib/nex-agent/core/training";
import { listCompetencies, deriveAutonomy, bumpCompetencyForAttempt, grantCompetency } from "@/lib/nex-agent/core/competency";
import { listProjects, getProject, attemptProject, insertProjectAttempt, listProjectAttempts } from "@/lib/nex-agent/core/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [lessons, attempts, doctrine, competencies, projects, projectAttempts] = await Promise.all([listLessons(), listAttempts(), listDoctrine(), listCompetencies(), listProjects(), listProjectAttempts()]);
  const autonomy = deriveAutonomy(competencies);
  return NextResponse.json({ ok: true, lessons, attempts, doctrine, competencies, autonomy, projects, project_attempts: projectAttempts }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  let body: { action?: string; lesson_id?: string; attempt_id?: string; verdict?: string; notes?: string; extracted_doctrine?: unknown; doctrine_key?: string; doctrine_text?: string; severity?: "guidance" | "mandatory" | "forbidden"; promoted_by?: string; source_lesson_id?: string; source_attempt_id?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const action = String(body.action ?? "");
  try {
    switch (action) {
      case "attempt": {
        if (!body.lesson_id) return NextResponse.json({ ok: false, error: "lesson_id_required" }, { status: 400 });
        const lesson = await getLesson(body.lesson_id);
        if (!lesson) return NextResponse.json({ ok: false, error: "lesson_not_found" }, { status: 404 });
        const { submitted_answer, auto } = await nex1AttemptLesson(lesson);
        const attempt_id = await insertAttempt(lesson.lesson_id, submitted_answer, auto);
        // Auto-bump the competency ledger if the lesson is linked to a domain and the attempt passed (or partial)
        let competency_bump: { ok: boolean; new_achieved: number; delta: number; reason: string } | null = null;
        const domainKey = (lesson as unknown as { competency_domain_key?: string }).competency_domain_key;
        if (domainKey && (auto.verdict === "pass" || auto.verdict === "partial")) {
          competency_bump = await bumpCompetencyForAttempt({ domain_key: domainKey, lesson_id: lesson.lesson_id, attempt_id, auto_verdict: auto.verdict, auto_score: auto.score });
        }
        return NextResponse.json({ ok: true, attempt_id, submitted_answer, auto, competency_bump });
      }
      case "grant_competency": {
        if (!body.domain_key || typeof body.delta !== "number") return NextResponse.json({ ok: false, error: "domain_key_and_delta_required" }, { status: 400 });
        const r = await grantCompetency({ domain_key: body.domain_key, delta: body.delta, reason: body.reason ?? "manual_grant", source_lesson_id: body.source_lesson_id, source_attempt_id: body.source_attempt_id, recorded_by: body.recorded_by ?? "founder" });
        return NextResponse.json({ ok: r.ok, new_achieved: r.new_achieved });
      }
      case "attempt_project": {
        if (!body.project_id) return NextResponse.json({ ok: false, error: "project_id_required" }, { status: 400 });
        const project = await getProject(body.project_id);
        if (!project) return NextResponse.json({ ok: false, error: "project_not_found" }, { status: 404 });
        const result = await attemptProject(project);
        const attempt_id = await insertProjectAttempt(project.project_id, project.unseen_evaluation, result);
        // Auto-bump competencies · project passes count DOUBLE for unseen · that's the real signal
        const bumps: Array<{ domain: string; delta: number; reason: string }> = [];
        if (result.overall_verdict === "pass" || result.overall_verdict === "partial") {
          const delta = result.overall_verdict === "pass" ? 1 : 0.5;
          for (const dom of project.competency_domains ?? []) {
            const r = await grantCompetency({ domain_key: dom, delta, reason: `project ${result.overall_verdict}${project.unseen_evaluation ? " · UNSEEN" : ""}`, recorded_by: "training_project_auto" });
            bumps.push({ domain: dom, delta, reason: `${r.ok ? "bumped" : "skipped"} · new_achieved=${r.new_achieved}` });
          }
          // Unseen projects also bump `unseen_task_success` directly (double-count intentional)
          if (project.unseen_evaluation && result.overall_verdict === "pass") {
            const r = await grantCompetency({ domain_key: "unseen_task_success", delta: 1, reason: "unseen_project_pass", recorded_by: "training_project_auto" });
            bumps.push({ domain: "unseen_task_success", delta: 1, reason: `unseen_pass · new_achieved=${r.new_achieved}` });
          }
        }
        return NextResponse.json({ ok: true, attempt_id, result, competency_bumps: bumps });
      }
      case "review": {
        if (!body.attempt_id || !body.verdict) return NextResponse.json({ ok: false, error: "attempt_id_and_verdict_required" }, { status: 400 });
        await recordMentorReview(body.attempt_id, body.verdict, body.notes ?? "", body.extracted_doctrine);
        return NextResponse.json({ ok: true, attempt_id: body.attempt_id });
      }
      case "promote": {
        if (!body.doctrine_key || !body.doctrine_text) return NextResponse.json({ ok: false, error: "doctrine_key_and_text_required" }, { status: 400 });
        const doctrine_id = await promoteDoctrine({
          doctrine_key: body.doctrine_key,
          doctrine_text: body.doctrine_text,
          severity: body.severity ?? "guidance",
          source_lesson_id: body.source_lesson_id,
          source_attempt_id: body.source_attempt_id,
          promoted_by: body.promoted_by ?? "founder",
        });
        return NextResponse.json({ ok: true, doctrine_id });
      }
      default:
        return NextResponse.json({ ok: false, error: `unknown_action:${action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message.slice(0, 200) }, { status: 500 });
  }
}
