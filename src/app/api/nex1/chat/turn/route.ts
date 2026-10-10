// POST /api/nex1/chat/turn
//
// NEX1 · Native chat channel · HTTP surface · Fix 24 · 2026-09-17.
//
// Deterministic · zero LLM · zero external model.
// EXPLICIT DESTINATION: this route calls ONLY into NEX1's native code-engine
// runtime · specifically `capability-chat-turn.ts` which composes existing
// classifier + response-composer + conversation-context capabilities.
//
// THIS ROUTE MUST NEVER IMPORT FROM `src/lib/nex/brain/*`.
// THIS ROUTE MUST NEVER IMPORT FROM openai / anthropic / @google/generative /
// groq-sdk / any inference client.
//
// Request:
//   { "conversation_id": "<string>", "message": "<string>" }
//
// Response (200):
//   { ok: true, source: "NEX1_NATIVE", text, state, turn_id,
//     classification, summary, zero_llm: true, ... }
//
// This endpoint does NOT modify any source file, does NOT spawn any process,
// does NOT hit the network. It is pure classifier + template composition.

import { NextResponse } from "next/server";
import { runChatTurn } from "@/lib/nex-agent/code-engine/capability-chat-turn";
import { computeEvidenceStatus } from "@/lib/nex-agent/code-engine/capability-evidence-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RequestBody {
  conversation_id?: string;
  message?: string;
}

export async function POST(req: Request) {
  let body: RequestBody = {};
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const conversation_id = typeof body.conversation_id === "string" ? body.conversation_id : "";
  const message = typeof body.message === "string" ? body.message : "";
  if (!conversation_id || !message) {
    return NextResponse.json(
      { ok: false, error: "conversation_id + message required" },
      { status: 400 },
    );
  }
  const result = await runChatTurn({
    conversation_id,
    user_message: message,
    repo_root: process.cwd(),
  });
  // Stage 5+10 · Evidence-Status envelope (Wave yellow-to-green 2026-09-20).
  // Deterministic derivation from trace + state. Never mutates runChatTurn
  // output. Null on pure conversational states with no factual claim.
  const evidence_status = computeEvidenceStatus({
    state: (result as any).state ?? "",
    trace: (result as any).trace ?? [],
    response_text: (result as any).text ?? "",
  });
  const sources = evidence_status?.sources ?? [];
  // K14 · 2026-09-21 · Personalisation loop · applied_preferences.
  // Reads head.preferences (stored by detectPreference · Wave 3) and
  // exposes which stored preferences NEX considered for THIS turn.
  // Presence in applied_preferences means the preference influenced the
  // response envelope (e.g. sources shown because "always show source"
  // is stored). Absence means preference not applicable to this turn.
  // Deterministic · zero LLM · never overrides evidence truth.
  const head: any = (result as any).conversation_head ?? {};
  const storedPrefs: Array<{ id?: string; kind?: string; text?: string }> = Array.isArray(head.preferences) ? head.preferences : [];
  const applied_preferences: Array<{ id: string; text: string; applied_because: string }> = [];
  for (const p of storedPrefs) {
    const text = String(p.text ?? "").toLowerCase();
    if (!text) continue;
    // Note: preferences are stored in canonical form "always: X" or
    // "never: X" (via detectPreference). Match the value part after the
    // colon rather than requiring "always show source" verbatim.
    if (/(?:always|show|include|cite).*(?:source|provenance)/.test(text) || /source|provenance/.test(text)) {
      if (sources.length > 0) applied_preferences.push({ id: String(p.id ?? ""), text: String(p.text ?? ""), applied_because: `preference stored · turn emitted ${sources.length} source(s)` });
    }
    if (/(?:show|include).*evidence|evidence/.test(text) && !applied_preferences.some((a) => a.id === String(p.id ?? ""))) {
      if (evidence_status !== null) applied_preferences.push({ id: String(p.id ?? ""), text: String(p.text ?? ""), applied_because: `preference stored · turn emitted evidence_status=${evidence_status.level}` });
    }
    if (/(?:terse|brief|concise|short)/.test(text) && !applied_preferences.some((a) => a.id === String(p.id ?? ""))) {
      applied_preferences.push({ id: String(p.id ?? ""), text: String(p.text ?? ""), applied_because: "preference stored · composition-variety wiring pending (K14 downstream)" });
    }
  }
  return NextResponse.json({ ...result, evidence_status, sources, applied_preferences });
}
