// src/app/api/nex/agent/turbopack-error/route.ts
//
// Receives Turbopack / Next.js compile errors from any surface (watchdog,
// error boundary, manual paste) and auto-queues a fix task for NEX1.
// Master AI Engineer + Claude review the fix.
//
// Guard: same error signature won't queue twice within 5 minutes · prevents
// runaway loops. Stored in data/nex-agent-turbopack-errors/last.json.

import { NextResponse } from "next/server";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

function ledgerPath(): string {
  return resolve(process.cwd(), "data/nex-agent-turbopack-errors/ledger.json");
}
function loadLedger(): Record<string, number> {
  const p = ledgerPath();
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return {}; }
}
function saveLedger(m: Record<string, number>): void {
  const p = ledgerPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(m, null, 2), "utf8");
}
function errorSignature(msg: string, path: string): string {
  return createHash("sha256").update(`${path}::${msg.slice(0, 200)}`).digest("hex").slice(0, 24);
}

export async function POST(req: Request) {
  let body: { message?: string; stack?: string; source?: string; route?: string; file?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const message = String(body.message ?? "").trim();
  const stack = String(body.stack ?? "").trim().slice(0, 3000);
  const source = String(body.source ?? "turbopack").trim();
  const route = String(body.route ?? "").trim();
  const file = String(body.file ?? "").trim();
  if (!message) return NextResponse.json({ ok: false, error: "message_required" }, { status: 400 });

  // Dedupe by signature within window
  const sig = errorSignature(message, file || route);
  const ledger = loadLedger();
  const now = Date.now();
  const last = ledger[sig] ?? 0;
  if (now - last < DEDUPE_WINDOW_MS) {
    return NextResponse.json({
      ok: true, skipped: true, reason: "dedupe_within_5min",
      signature: sig, last_seen_at: new Date(last).toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  }
  ledger[sig] = now;
  // Prune ledger of stale entries
  for (const k of Object.keys(ledger)) {
    if (now - ledger[k] > DEDUPE_WINDOW_MS * 12) delete ledger[k];
  }
  saveLedger(ledger);

  // Compose fix-task prompt · NEX1 codes · Engineer + Claude review
  const promptLines = [
    `Turbopack / build error detected · fix required. NEX1 codes · Master AI Engineer + Claude review before commit.`,
    ``,
    `Error message:`,
    message,
  ];
  if (file) promptLines.push(``, `File: ${file}`);
  if (route) promptLines.push(`Route: ${route}`);
  if (stack) promptLines.push(``, `Stack:`, "```", stack, "```");
  promptLines.push(``, `Source: ${source}`);
  const composedPrompt = promptLines.join("\n");

  // Submit as a new NEX1 task via the existing submit endpoint (same origin)
  const origin = new URL(req.url).origin;
  let submit: { ok: boolean; task_id?: string; error?: string } = { ok: false };
  try {
    const r = await fetch(`${origin}/api/nex/agent/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: composedPrompt, submitted_by: `auto-${source}` }),
    });
    submit = await r.json();
  } catch (e) { submit = { ok: false, error: (e as Error).message }; }

  return NextResponse.json({
    ok: !!submit.ok,
    signature: sig,
    submitted: submit.ok ? { task_id: submit.task_id } : null,
    submit_error: submit.ok ? null : submit.error ?? "submit_failed",
  }, { headers: { "Cache-Control": "no-store" } });
}
