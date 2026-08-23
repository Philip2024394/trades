// Stub NexPerceptualHashService · MVP default.
//
// Returns null. Exact dedup via sha256 content_hash already exists on
// nex.object_blobs. Perceptual (near-duplicate) hashing plugs in later via
// a sharp+pHash adapter without changing the interface or consumers.

import type { NexPerceptualHashService, NexPerceptualHashRequest, NexPerceptualHashResponse } from "../nex-perceptual-hash-service.js";

export const perceptualHashStub: NexPerceptualHashService = {
  name: "stub",
  async compute(_req: NexPerceptualHashRequest): Promise<NexPerceptualHashResponse | null> {
    return null;
  },
};
