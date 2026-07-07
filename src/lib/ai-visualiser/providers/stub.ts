// Stub provider — used when no live provider is configured. Lets the
// UI + database plumbing work end-to-end during dev without external
// API access. In prod this row should never be enabled; the admin
// config UI defaults to disabled and the render route refuses to serve
// customers against the stub.
import "server-only";
import type {
  AiVisualiserProvider,
  ProviderClassifyInput,
  ProviderClassifyResult,
  ProviderGenerateInput,
  ProviderGenerateResult
} from "./types";

export function makeStubProvider(): AiVisualiserProvider {
  return {
    id: "stub",
    displayName: "Development stub",
    async classify(input: ProviderClassifyInput): Promise<ProviderClassifyResult> {
      const first = input.candidatePrompts[0];
      return {
        bestLeafSlug: first?.leafSlug ?? null,
        bestPrompt: first?.prompt ?? null,
        confidence: first ? 0.99 : 0,
        scores: input.candidatePrompts.map((c) => ({
          leafSlug: c.leafSlug,
          score: c === first ? 0.99 : 0.01
        }))
      };
    },
    async generate(_input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
      // Returns the source image back — the flow can still render a
      // "before/after" but they'll match. Cost is zero.
      return {
        imageUrl: _input.sourceImageUrl,
        providerRequestId: `stub-${Date.now()}`,
        costPence: 0
      };
    },
    async test() {
      return { ok: true } as const;
    }
  };
}
