// src/app/api/nex/agent/learning/record/route.ts
//
// Records skill successes · pattern captures · anti-pattern captures into the
// learning ledger. Called by the workstation client when the SSE stream
// transitions a task into a terminal state.
//
// POST { kind: "success" | "failure" | "pattern" | "antipattern", skill?, taskId, ... }

import { NextResponse } from "next/server";
import {
  loadLedger, saveLedger,
  recordSkillSuccess, recordSkillFailure,
  recordPattern, recordAntiPattern,
} from "@/lib/nex-agent/learning-ledger";
import { checkRateLimit, rateLimitKeyFor, detectBotUA, WORKSTATION_SEC_HEADERS } from "@/lib/nex-agent/anti-bot";
import { createHash } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Heuristic skill inference from a file path. */
export function skillsFromFile(path: string): string[] {
  const p = path.toLowerCase();
  const out: string[] = [];
  if (/^src\/app\/.*\/page\.tsx?$/.test(p)) out.push("nextjs-app-router");
  if (/^src\/app\/api\/.*\/route\.tsx?$/.test(p)) out.push("nextjs-api-route");
  if (/^db\/migrations\/.*\.sql$/.test(p)) out.push("sql-migration");
  if (/\.test\.(ts|tsx|js|jsx)$/.test(p)) out.push("unit-tests");
  if (/^src\/lib\/nex\/.*\.(ts|tsx)$/.test(p)) out.push("nex-library-code");
  if (/^src\/lib\/nex-agent\/.*\.(ts|tsx)$/.test(p)) out.push("nex-agent-library");
  if (/^src\/components\/.*\.tsx$/.test(p)) out.push("react-component");
  if (/\.css$/.test(p)) out.push("css-styling");
  if (/tsconfig|package\.json/.test(p)) out.push("project-config");
  return out;
}

export async function POST(req: Request) {
  const rl = checkRateLimit(rateLimitKeyFor(req, "learning-record"), { windowMs: 60_000, maxRequests: 60 });
  if (!rl.allowed) return NextResponse.json({ ok: false, error: rl.reason }, { status: 429, headers: WORKSTATION_SEC_HEADERS });
  const bot = detectBotUA(req.headers.get("user-agent"));
  if (bot.isBot) return NextResponse.json({ ok: false, error: bot.reason }, { status: 403, headers: WORKSTATION_SEC_HEADERS });

  let body: {
    kind?: "success" | "failure" | "pattern" | "antipattern";
    skill?: string;
    skills?: string[];
    taskId?: string;
    title?: string;
    diff?: string;
    rejectionCode?: string | null;
    filePaths?: string[];
  } = {};
  try { body = await req.json(); } catch { /* */ }

  const kind = body.kind;
  const taskId = String(body.taskId ?? "").trim();
  if (!kind) return NextResponse.json({ ok: false, error: "kind_required" }, { status: 400, headers: WORKSTATION_SEC_HEADERS });
  if (!taskId) return NextResponse.json({ ok: false, error: "taskId_required" }, { status: 400, headers: WORKSTATION_SEC_HEADERS });

  let ledger = loadLedger();
  const derivedSkills: string[] = [];
  if (body.filePaths) for (const p of body.filePaths) for (const s of skillsFromFile(p)) if (!derivedSkills.includes(s)) derivedSkills.push(s);
  if (body.skills) for (const s of body.skills) if (!derivedSkills.includes(s)) derivedSkills.push(s);
  if (body.skill && !derivedSkills.includes(body.skill)) derivedSkills.push(body.skill);

  if (kind === "success") {
    if (derivedSkills.length === 0) derivedSkills.push("general-coding");
    for (const s of derivedSkills) ledger = recordSkillSuccess(ledger, s);
  } else if (kind === "failure") {
    for (const s of derivedSkills) ledger = recordSkillFailure(ledger, s);
  } else if (kind === "pattern") {
    const title = String(body.title ?? "").slice(0, 120) || "unnamed pattern";
    const idSource = body.diff ? body.diff : `${title}::${taskId}`;
    const id = createHash("sha256").update(idSource).digest("hex").slice(0, 16);
    ledger = recordPattern(ledger, { id, title, skills: derivedSkills, capturedAt: new Date().toISOString(), taskId });
  } else if (kind === "antipattern") {
    const title = String(body.title ?? "").slice(0, 120) || "unnamed anti-pattern";
    const rejectionCode = body.rejectionCode ?? null;
    const idSource = `${title}::${rejectionCode ?? ""}`;
    const id = createHash("sha256").update(idSource).digest("hex").slice(0, 16);
    ledger = recordAntiPattern(ledger, { id, title, rejectionCode, capturedAt: new Date().toISOString(), taskId });
  } else {
    return NextResponse.json({ ok: false, error: "kind_invalid" }, { status: 400, headers: WORKSTATION_SEC_HEADERS });
  }

  saveLedger(ledger);
  return NextResponse.json({
    ok: true,
    kind,
    taskId,
    derived_skills: derivedSkills,
    counts: {
      skills: Object.keys(ledger.skills).length,
      patterns: ledger.patterns.length,
      antiPatterns: ledger.antiPatterns.length,
    },
  }, { headers: { ...WORKSTATION_SEC_HEADERS, "Cache-Control": "no-store" } });
}
