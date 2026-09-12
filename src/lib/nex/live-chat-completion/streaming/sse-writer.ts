// src/lib/nex/live-chat-completion/streaming/sse-writer.ts
//
// Founder BEGIN Phase 3.3 · Server-Sent Events writer for NEX chat.
//
// Contract (v1):
//   event: stage       data: {"name": "state_load", "ms": 1.2}
//   event: meta        data: {"intent": "list_in_city", "entity_ref": null,
//                             "reply_kind": "list", "trust": "canonical_verified"}
//   event: token       data: {"chunk": "I have "}
//   event: done        data: {"full_reply": "...", "voice_reply": {...}, ...}
//   event: error       data: {"message": "...", "stage": "adapter"}
//
// Rules:
//   - Every event line begins with "event: <name>\n" then "data: <json>\n\n".
//   - Two trailing \n\n signal end-of-message per SSE spec.
//   - The stream MUST end with a done OR error event, then controller.close().
//   - Deterministic replies are produced fully before token events fire —
//     TTFT is dominated by adapter latency in this BEGIN. Future LLM
//     fallback will emit tokens as the model produces them (real TTFT).

export type SseEventName = "stage" | "meta" | "token" | "done" | "error" | "hello";

const _encoder = new TextEncoder();

/** Serialise a single SSE event to a Uint8Array ready to enqueue. */
export function encodeSseEvent(event: SseEventName, data: unknown): Uint8Array {
  const payload = JSON.stringify(data);
  return _encoder.encode(`event: ${event}\ndata: ${payload}\n\n`);
}

/** Build a Response object with SSE headers around a ReadableStream. */
export function sseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      // Disable proxy buffering (nginx / Vercel edge) so clients receive
      // events as they are enqueued rather than in one flush at close.
      "X-Accel-Buffering": "no",
    },
  });
}

/** Small helper to run a producer function against a stream controller. */
export function makeSseController() {
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { controllerRef = controller; },
    cancel() { closed = true; },
  });
  return {
    stream,
    send(event: SseEventName, data: unknown): void {
      if (closed || !controllerRef) return;
      try { controllerRef.enqueue(encodeSseEvent(event, data)); }
      catch { closed = true; }
    },
    close(): void {
      if (closed || !controllerRef) return;
      closed = true;
      try { controllerRef.close(); } catch { /* already closed */ }
    },
    error(err: unknown): void {
      if (closed) return;
      // Best-effort emit an error event then close.
      try {
        controllerRef?.enqueue(encodeSseEvent("error", {
          message: err instanceof Error ? err.message : String(err),
        }));
      } catch { /* swallow */ }
      this.close();
    },
    isClosed(): boolean { return closed; },
  };
}
