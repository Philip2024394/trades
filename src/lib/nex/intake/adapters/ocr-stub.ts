// Stub NexOcrService · MVP default.
//
// Returns null. Consumers must degrade gracefully (description carries).
//
// A real tesseract-based OCR adapter can be added as ocr-tesseract.ts using
// the `tesseract.js` npm package (~30MB · lightweight · no ML model beyond
// language pack · runs locally without RAM impact worth flagging). Not
// shipped in MVP to keep dependency footprint zero for the initial banana
// test which passes on description alone.

import type { NexOcrService, NexOcrRequest, NexOcrResponse } from "../nex-ocr-service.js";

export const ocrStub: NexOcrService = {
  name: "stub",
  async extract(_req: NexOcrRequest): Promise<NexOcrResponse | null> {
    return null;
  },
};
