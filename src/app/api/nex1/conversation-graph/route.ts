// /api/nex1/conversation-graph · C10 Phase 1 diagnostic surface · 2026-09-17.
//
// GET  ?conversation_id=X          → returns full graph snapshot
// GET  ?conversation_id=X&resolve=<message>  → returns reference resolver hits
// POST { conversation_id, op, payload }      → append a graph node
//
// Zero LLM · deterministic · single conversation-id namespace.
// Provided as the verification surface for C10 · consumers (chat-turn +
// orchestrator) will call the same capability functions directly in Phase 2.

import { NextResponse } from "next/server";
import {
  addPreference, addRefusedPrompt, addUnresolvedQuestion, resolveQuestion,
  addCorrection, getGraphSnapshot, resolveReference,
} from "@/lib/nex-agent/code-engine/capability-conversation-graph";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const conversation_id = (url.searchParams.get("conversation_id") ?? "").trim();
  if (!conversation_id) {
    return NextResponse.json({ ok: false, error: "conversation_id required" }, { status: 400 });
  }
  const resolveMsg = url.searchParams.get("resolve");
  if (resolveMsg) {
    const hits = resolveReference(conversation_id, resolveMsg);
    return NextResponse.json({ ok: true, source: "NEX1_NATIVE", zero_llm: true, resolve: resolveMsg, hits });
  }
  const snapshot = getGraphSnapshot(conversation_id);
  return NextResponse.json({ ok: true, source: "NEX1_NATIVE", zero_llm: true, snapshot });
}

interface PostBody {
  conversation_id?: string;
  op?: string;
  payload?: Record<string, unknown>;
}

export async function POST(req: Request) {
  let body: PostBody = {};
  try { body = await req.json(); } catch { /* empty */ }
  const cid = (body.conversation_id ?? "").toString().trim();
  if (!cid) return NextResponse.json({ ok: false, error: "conversation_id required" }, { status: 400 });
  const op = (body.op ?? "").toString();
  const p = (body.payload ?? {}) as Record<string, unknown>;

  try {
    switch (op) {
      case "addPreference": {
        const r = addPreference({
          conversation_id: cid,
          text: String(p.text ?? ""),
          kind: p.kind === "inferred" ? "inferred" : "explicit",
          turn: Number(p.turn ?? 0),
          derived_from_thread_id: (p.derived_from_thread_id as string | null | undefined) ?? null,
        });
        return NextResponse.json({ ok: true, result: r });
      }
      case "addRefusedPrompt": {
        const r = addRefusedPrompt({
          conversation_id: cid,
          turn: Number(p.turn ?? 0),
          prompt: String(p.prompt ?? ""),
          reason: String(p.reason ?? "unknown"),
          detail: (p.detail as string | null | undefined) ?? null,
        });
        return NextResponse.json({ ok: true, result: r });
      }
      case "addUnresolvedQuestion": {
        const r = addUnresolvedQuestion({
          conversation_id: cid,
          turn: Number(p.turn ?? 0),
          question: String(p.question ?? ""),
          asked_by: (p.asked_by as "nex1" | "system" | undefined) ?? "nex1",
          thread_id: (p.thread_id as string | null | undefined) ?? null,
        });
        return NextResponse.json({ ok: true, result: r });
      }
      case "resolveQuestion": {
        const r = resolveQuestion({
          conversation_id: cid,
          question_id: String(p.question_id ?? ""),
          turn: Number(p.turn ?? 0),
          answer: String(p.answer ?? ""),
        });
        return NextResponse.json({ ok: r.ok, result: r });
      }
      case "addCorrection": {
        const r = addCorrection({
          conversation_id: cid,
          turn: Number(p.turn ?? 0),
          kind: (p.kind as "intent" | "target" | "value" | "wording" | "other" | undefined) ?? "other",
          from_value: String(p.from_value ?? ""),
          to_value: String(p.to_value ?? ""),
          context: (p.context as string | null | undefined) ?? null,
          thread_id: (p.thread_id as string | null | undefined) ?? null,
        });
        return NextResponse.json({ ok: true, result: r });
      }
      default:
        return NextResponse.json({ ok: false, error: `unknown op: ${op}`, valid_ops: ["addPreference", "addRefusedPrompt", "addUnresolvedQuestion", "resolveQuestion", "addCorrection"] }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message.slice(0, 200) }, { status: 500 });
  }
}
