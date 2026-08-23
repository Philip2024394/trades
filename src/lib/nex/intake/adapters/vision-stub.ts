// Stub NexVisionService implementation.
//
// Returns null · deliberately no vision capability. Consumers must degrade
// gracefully to description + OCR (which they do). Ships as the MVP default
// so NEX has zero external-vision dependency to work.
//
// This is INTENTIONALLY MINIMAL: it proves the interface + consumers work
// without any provider · providing the provider-swap safety guarantee.

import type { NexVisionService, NexVisionRequest, NexVisionResponse } from "../nex-vision-service.js";

export const visionStub: NexVisionService = {
  name: "stub",
  async analyse(_req: NexVisionRequest): Promise<NexVisionResponse | null> {
    // Honest: no vision available in this deployment. Consumers must NOT
    // treat this as failure · they must fall back to description + OCR.
    return null;
  },
};
