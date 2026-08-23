// NEX BRAIN · stub provider.
//
// Dev fallback returning canned responses when no real provider is
// available (missing API key, offline dev, test environment). Never
// used in production — resolver rejects it if a real provider is
// configured.
//
// Follows the "Silence over Fabrication" doctrine: stub responses
// are honest ("[STUB — no real brain provider configured]") not
// fake pretend-answers that could get shipped by mistake.

import type {
  NexBrainCapabilities,
  NexBrainProvider,
  NexChatEvent,
  NexChatInput,
  NexMessage,
} from "../provider";

const STUB_TEXT =
  "[NEX brain stub · no real provider configured. Set ANTHROPIC_API_KEY " +
  "or configure another provider in the resolver to enable a real response.]";

const stubCapabilities: NexBrainCapabilities = {
  supportsTools: false,
  supportsVision: false,
  supportsThinking: false,
  supportsPromptCaching: false,
  supportsStreaming: true,
  maxContextTokens: 0,
};

export function createStubBrainProvider(): NexBrainProvider {
  return {
    id: "stub:nex-brain",
    capabilities: stubCapabilities,
    async *chat(_input: NexChatInput): AsyncGenerator<NexChatEvent> {
      // Yield the honest stub message char-by-char (small delay) so
      // the UI stream-render path is exercised in dev even without a
      // real provider.
      for (const chunk of chunkString(STUB_TEXT, 12)) {
        yield { type: "text_delta", text: chunk };
      }
      const finalMessage: NexMessage = {
        role: "assistant",
        content: [{ type: "text", text: STUB_TEXT }],
      };
      yield {
        type: "done",
        stopReason: "end_turn",
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          cachedInputTokens: 0,
          cacheWriteTokens: 0,
        },
        finalMessage,
      };
    },
  };
}

function chunkString(str: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < str.length; i += size) out.push(str.slice(i, i + size));
  return out;
}
