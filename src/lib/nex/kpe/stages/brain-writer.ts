// KPE Stage 12 · Brain Writer
//
// Final stage. Takes decisions + chunks and persists them into the NEX Brain
// via the existing Brain Router (built earlier this session).
//
// Rules:
//   · Skip decisions with tier "skip"        (duplicates)
//   · Skip decisions with tier "human_review" (pending admin action)
//   · Store no_ai / rule_engine / local_llm / frontier_llm outcomes as memories
//   · Every memory carries full provenance (document_id, chunk_id, decision tier)

import type {
  BrainWriterInput, BrainWriterOutput, PipelineStage,
} from "../types";
import { appendMemory } from "../../brain/router";

export const BrainWriterStage: PipelineStage<BrainWriterInput, BrainWriterOutput> = {
  name: "brain_writer",
  version: "1.0.0",
  async run(input: BrainWriterInput): Promise<BrainWriterOutput> {
    const brainsWritten = new Set<string>();
    let memoriesCreated = 0;

    const targetBrains = input.document.target_brains.length > 0
      ? input.document.target_brains
      : ["Content Brain"];             // safe default

    const chunksById = new Map(input.chunks.map((c) => [c.chunk_id, c]));

    for (const decision of input.decisions) {
      if (decision.route.tier === "skip") continue;
      if (decision.route.tier === "human_review") continue;

      const chunk = chunksById.get(decision.chunk_id);
      if (!chunk) continue;

      for (const brainName of targetBrains) {
        await appendMemory(brainName, {
          source_job_id: input.document.document_id,        // KPE uses document_id as job id
          source_kind: `kpe:${decision.route.tier}`,
          source_owner: "kpe",
          knowledge_type: input.document.classifier_label,
          title: chunk.heading_path.at(-1) ?? input.document.title,
          content_length: chunk.content.length,
          inbox_item_id: input.document.document_id,
        });
        memoriesCreated += 1;
        brainsWritten.add(brainName);
      }
    }

    return {
      brains_written: [...brainsWritten],
      memories_created: memoriesCreated,
    };
  },
};
