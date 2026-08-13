// KPE Stage 8 · Relationship Detection
//
// Produces typed edges between the current document and other nodes (URLs,
// doc references, extracted entities). This is the seed of the knowledge
// graph. No AI in v1 — a future plugin can add LLM-inferred edges (e.g.,
// "contradicts", "elaborates on") but the reference implementation covers
// the structural edges every document produces.

import { randomUUID } from "node:crypto";
import type { EdgeRecord, PipelineStage, RelationshipsInput, RelationshipsOutput } from "../types";

function makeEdge(from: string, to: string, type: EdgeRecord["type"], confidence: number): EdgeRecord {
  return {
    edge_id: randomUUID(),
    from_id: from,
    to_id: to,
    type,
    confidence,
    created_at: new Date().toISOString(),
  };
}

export const RelationshipsStage: PipelineStage<RelationshipsInput, RelationshipsOutput> = {
  name: "relationships",
  version: "1.0.0",
  async run(input: RelationshipsInput): Promise<RelationshipsOutput> {
    const edges: EdgeRecord[] = [];
    const { document, chunks, metadata } = input;

    // Structural: every chunk is `part_of` its document
    for (const c of chunks) {
      edges.push(makeEdge(c.chunk_id, document.document_id, "part_of", 1.0));
    }

    // Provenance: each URL cited becomes a `derived_from` from the document
    for (const url of metadata.urls) {
      edges.push(makeEdge(document.document_id, url, "derived_from", 0.9));
    }

    // References: doc-ref tokens in chunks become `references` edges
    for (const ref of metadata.references) {
      edges.push(makeEdge(document.document_id, ref, "references", 0.7));
    }

    // Authorship: each detected author is a distinct entity
    for (const author of metadata.authors) {
      edges.push(makeEdge(document.document_id, `author:${author}`, "authored_by", 0.6));
    }

    // Entities: each extracted named entity is `about` the document
    for (const entity of metadata.extracted_entities) {
      edges.push(makeEdge(document.document_id, `entity:${entity}`, "about", 0.5));
    }
    return { edges };
  },
};
