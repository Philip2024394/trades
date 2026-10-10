// §36-W-1 · WAVE-W1 · 2026-09-14 · workstation-live
//
// Real Server-Sent Events stream that surfaces real orchestrator trace state.
// Polls the existing in-memory trace store every 1s and emits ONLY when state
// materially changes. Never fabricates events. Never emits fake progress.

import type { NextRequest } from "next/server";
import { getTrace } from "@/lib/nex1-orchestrator/trace-store";
import type { WorkflowTrace } from "@/lib/nex1-orchestrator/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  readonly params: Promise<{ traceId: string }>;
}

/** Compute a deterministic fingerprint of the trace so we only emit on
 *  material state change. Never guesses; only reflects real fields. */
function fingerprint(t: WorkflowTrace): string {
  return JSON.stringify({
    current_state: t.current_state,
    audit_len: t.audit_trail.length,
    transitions_len: t.transitions.length,
    stage_statuses: t.stage_statuses,
    founder_decision: t.founder_decision ?? null,
    nex2_review_id: t.nex2_review_id ?? null,
    nex3_verdict: t.nex3_verdict ?? null,
  });
}

export async function GET(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { traceId } = await ctx.params;
  if (!traceId || typeof traceId !== "string" || !/^[a-zA-Z0-9_\-]+$/.test(traceId)) {
    return new Response("invalid traceId", { status: 400 });
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const write = (data: unknown, event?: string): void => {
        try {
          const payload = typeof data === "string" ? data : JSON.stringify(data);
          const chunk = (event ? `event: ${event}\n` : "") + `data: ${payload}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // stream already closed
        }
      };

      // Emit initial state (or NOT_CONNECTED if trace absent)
      let lastFingerprint = "";
      const trace = getTrace(traceId);
      if (!trace) {
        write({ ok: false, reason: "trace_not_found", traceId, connected: false }, "not-connected");
      } else {
        lastFingerprint = fingerprint(trace);
        write({ ok: true, trace, connected: true, source: "trace-store" }, "trace");
      }

      // Poll for changes every 1s. Emit only on material change.
      const interval = setInterval(() => {
        const current = getTrace(traceId);
        if (!current) {
          const fp = "MISSING";
          if (fp !== lastFingerprint) {
            lastFingerprint = fp;
            write({ ok: false, reason: "trace_disappeared", traceId }, "not-connected");
          }
          return;
        }
        const fp = fingerprint(current);
        if (fp !== lastFingerprint) {
          lastFingerprint = fp;
          write({ ok: true, trace: current, connected: true, source: "trace-store", at: new Date().toISOString() }, "trace");
        }
        // Also emit a periodic heartbeat every 10s to keep connection alive
      }, 1000);

      const heartbeat = setInterval(() => {
        write({ at: new Date().toISOString() }, "heartbeat");
      }, 10000);

      // Close on client disconnect
      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        clearInterval(heartbeat);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      // stream cancelled by consumer
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
