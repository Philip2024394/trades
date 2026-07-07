// Turn a memory record into the text we embed. This is the shape
// vector search matches against — so it needs to be human-readable
// AND include every facet a query might mention.

import type { MemoryRecord } from "./types";

export function memoryRecordToEmbedText(record: MemoryRecord): string {
  const f = record.facets as Record<string, unknown>;
  const parts: string[] = [];

  parts.push(`Record type: ${record.recordType}.`);

  if (typeof f.trade === "string") parts.push(`Trade: ${humanise(f.trade)}.`);
  if (typeof f.service === "string") parts.push(`Service: ${humanise(f.service)}.`);
  if (Array.isArray(f.materials) && f.materials.length > 0) {
    parts.push(
      `Materials: ${(f.materials as string[]).map(humanise).join(", ")}.`
    );
  }
  if (Array.isArray(f.colours) && f.colours.length > 0) {
    parts.push(
      `Colours: ${(f.colours as string[]).map(humanise).join(", ")}.`
    );
  }
  if (Array.isArray(f.techniques) && f.techniques.length > 0) {
    parts.push(
      `Techniques: ${(f.techniques as string[]).map(humanise).join(", ")}.`
    );
  }
  if (typeof f.cost_band === "string") parts.push(`Cost band: ${humanise(f.cost_band)}.`);
  if (typeof f.customer_name === "string") parts.push(`Customer: ${f.customer_name}.`);
  if (record.postcode) parts.push(`Location: ${record.postcode}.`);
  if (typeof f.completed_at === "string") parts.push(`Completed: ${f.completed_at}.`);
  if (typeof f.started_at === "string") parts.push(`Started: ${f.started_at}.`);

  // Reviews carry their own bag of text worth embedding.
  const review = f.review as Record<string, unknown> | undefined;
  if (review) {
    if (typeof review.excerpt === "string") parts.push(`Review: ${review.excerpt}`);
    if (typeof review.rating === "number") parts.push(`Rating: ${review.rating}/5.`);
  }

  return parts.join(" ");
}

function humanise(s: string): string {
  return s.toString().replace(/_/g, " ").trim();
}
