// KPE Stage 1 · Intake
//
// Accepts raw input · assigns a document ID · hashes content · records timestamp.
// No AI. No side-effects beyond returning the built record. Persistence
// happens in the pipeline orchestrator so this stage stays pure.

import { createHash, randomUUID } from "node:crypto";
import type {
  IntakeInput, IntakeOutput, PipelineStage, StageContext,
  DocumentRecord,
} from "../types";

export const IntakeStage: PipelineStage<IntakeInput, IntakeOutput> = {
  name: "intake",
  version: "1.0.0",
  async run(input: IntakeInput, _ctx: StageContext): Promise<IntakeOutput> {
    const raw = String(input.content ?? "").trim();
    if (!raw) throw new Error("intake: content is empty");

    const content_hash = createHash("sha256").update(raw).digest("hex");
    const byte_length = Buffer.byteLength(raw, "utf8");

    const document: DocumentRecord = {
      document_id: randomUUID(),
      source: input.source || "unknown",
      title: input.title?.trim() || null,
      content_hash,
      byte_length,
      ingested_at: new Date().toISOString(),
      classifier_label: null,
      classifier_confidence: null,
      target_brains: [],
    };
    return { document, raw_content: raw };
  },
};
