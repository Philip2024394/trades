// POST /api/nex1/chat/turn/stream
//
// NEX1 · Native chat channel · REAL streaming surface · Batch 2A · 2026-09-17.
// Founder-authorised.
//
// This endpoint accepts the same body as /api/nex1/chat/turn but instead of
// returning a single terminal JSON response, it streams observable native
// stage events as they happen — one SSE frame per event boundary reached
// inside runChatTurn.
//
// STREAMING SEMANTICS
//
//   · The stream carries REAL native stage events, not simulated typing.
//   · There are NO artificial delays.
//   · A stage event is emitted only when that stage genuinely completes
//     inside the native runtime (classifier, follow-up synthesis, pending
//     goal store, recall dispatch, authorization, coding_loop_start/stage/
//     done, investigation_start/done, composer).
//   · A terminal `event: done` frame carries the full RunChatTurnResult
//     — identical to the payload the non-streaming route returns.
//   · Every event carries `execution_source: NEX1_NATIVE` and `zero_llm: true`
//     in the event data so downstream telemetry stays honest.
//
// INVARIANTS
//
//   · This route MUST NEVER import from openai / anthropic / @google/generative /
//     groq-sdk / any inference client.
//   · This route MUST NEVER import from src/lib/nex/brain/*.
//   · The non-streaming /api/nex1/chat/turn route remains unchanged.
//   · If runChatTurn throws, an `event: error` frame is emitted and the
//     stream closes with an honest error payload — no silent fallback.

import { runChatTurn, type ChatTurnEvent, type RunChatTurnResult } from "@/lib/nex-agent/code-engine/capability-chat-turn";
import { computeEvidenceStatus } from "@/lib/nex-agent/code-engine/capability-evidence-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RequestBody {
  conversation_id?: string;
  message?: string;
  coding_goal_override?: string;
}

function frame(event: string, data: unknown): string {
  // SSE frame: `event: <name>\ndata: <json>\n\n`
  const json = JSON.stringify({
    ...(typeof data === "object" && data !== null ? data : { value: data }),
    execution_source: "NEX1_NATIVE",
    zero_llm: true,
    emitted_at: new Date().toISOString(),
  });
  return `event: ${event}\ndata: ${json}\n\n`;
}

export async function POST(req: Request) {
  let body: RequestBody = {};
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const conversation_id = typeof body.conversation_id === "string" ? body.conversation_id : "";
  const message = typeof body.message === "string" ? body.message : "";
  if (!conversation_id || !message) {
    return new Response(
      JSON.stringify({ ok: false, error: "conversation_id + message required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (chunk: string): void => {
        try { controller.enqueue(encoder.encode(chunk)); } catch { /* client disconnected */ }
      };

      // Announce readiness so clients can flush any TTFB latency measurement
      // against a real event · this is NOT a synthetic delay, just a hello.
      write(frame("hello", {
        conversation_id,
        streaming_version: "batch2a-2026-09-17",
      }));

      // Wire the observer callback to the SSE writer. onEvent is called
      // synchronously as each real boundary is reached inside runChatTurn.
      const onEvent = (e: ChatTurnEvent): void => {
        write(frame(e.kind, e.data));
      };

      let terminal: RunChatTurnResult | null = null;
      try {
        terminal = await runChatTurn({
          conversation_id,
          user_message: message,
          repo_root: process.cwd(),
          coding_goal_override: body.coding_goal_override,
          onEvent,
        });
      } catch (err) {
        write(frame("error", {
          message: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
        }));
        try { controller.close(); } catch { /* already closed */ }
        return;
      }

      // K1 · 2026-09-20 · Streaming evidence-status parity.
      // Runtime evidence classifier runs post-hoc over the terminal trace.
      // UI never stronger than runtime · stream carries the SAME envelope
      // as the non-stream `/api/nex1/chat/turn` endpoint.
      const evidence_status = computeEvidenceStatus({
        state: (terminal as any).state ?? "",
        trace: (terminal as any).trace ?? [],
        response_text: (terminal as any).text ?? "",
      });
      const sources = evidence_status?.sources ?? [];
      // Terminal frame · full RunChatTurnResult verbatim so callers who
      // only need the final answer can still get it from a single frame.
      write(frame("done", {
        ok: terminal.ok,
        source: terminal.source,
        text: terminal.text,
        state: terminal.state,
        turn_id: terminal.turn_id,
        classification: terminal.classification,
        summary: terminal.summary,
        resolved_target: terminal.resolved_target,
        evidence_kind: terminal.evidence_kind,
        evidence_status,
        sources,
      }));
      try { controller.close(); } catch { /* already closed */ }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Nex-Execution-Source": "NEX1_NATIVE",
      "X-Nex-Zero-LLM": "true",
    },
  });
}
