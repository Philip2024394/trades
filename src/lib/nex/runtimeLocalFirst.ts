// runLocalFirstStream · thin wrapper that tries the local Ollama
// provider first and silently swaps to a cloud-side fallback if the
// local stream errors BEFORE any user-visible text has been streamed.
//
// The user experience the wrapper protects:
//
//   User asks NEX → local Ollama serves it              (fast, private)
//   Ollama crashes mid-run before first token
//     → wrapper swallows the error event
//     → dispatches the fallback stream (Anthropic)
//     → user sees a normal streamed NEX answer
//
// Contract:
//   - If the local stream emits ANY text delta before erroring, we
//     commit — mid-stream text can't be un-sent, so we surface the
//     error the same way runProviderStream would.
//   - If the local stream errors BEFORE the first text delta (network
//     drop at request start, model missing surfaced late, provider
//     protocol error, etc.) AND a fallback factory is supplied, we
//     silently switch. The user never sees the error.
//   - We do NOT reissue tool_start/tool_end events on switchover —
//     those only happen after model output, and by definition we
//     haven't reached that point if we're still eligible to switch.

import type { StreamEvent } from "./runtimeStream";

export type LocalFirstInput = {
  /** Primary attempt · usually runProviderStream() bound to Ollama. */
  local: () => AsyncGenerator<StreamEvent>;
  /** Cloud fallback · usually runAgenticStream() bound to Anthropic.
   *  Omit to disable fallback (errors propagate to the caller). */
  fallback?: () => AsyncGenerator<StreamEvent>;
  /** Optional callback fired when we actually swap. Useful for
   *  telemetry / DB annotation ("this row was served by fallback"). */
  onSwap?: (reason: string) => void;
};

export async function* runLocalFirstStream(input: LocalFirstInput): AsyncGenerator<StreamEvent> {
  const localGen = input.local();
  let sawUserVisibleOutput = false;

  while (true) {
    const next = await localGen.next();
    if (next.done) return;

    const evt = next.value;

    // A `done` event with stoppedBy: "error" is how runProviderStream
    // surfaces an unrecoverable provider failure. Everything else is
    // "we made real progress" and should flow through.
    const isErrorDone = evt.type === "done" && evt.stoppedBy === "error";

    if (isErrorDone && !sawUserVisibleOutput && input.fallback) {
      // Silent switchover. Local produced nothing the user can see;
      // discard its error done and replay with the fallback.
      input.onSwap?.(evt.finalText || "local_stream_error");
      for await (const cloudEvt of input.fallback()) yield cloudEvt;
      return;
    }

    // Track whether we've emitted anything the user actually sees.
    if (evt.type === "text" || evt.type === "thinking" || evt.type === "tool_end") {
      sawUserVisibleOutput = true;
    }

    yield evt;
  }
}
