// Answer synthesizer — takes the hits from nlQuery and asks the LLM
// to compose a merchant-friendly one-paragraph answer.
//
// Grounded strictly in the returned records: the LLM sees facets +
// photos + reviews. Never invents. When there are zero hits, returns
// a plain "no matches" line without asking the LLM (cheap + honest).

import { completeJson } from "@/lib/llm/anthropic";
import type { QueryHit } from "./nlQuery";

export type SynthesisedAnswer = {
  summary: string;
  count: number;
  aggregate: {
    materials: string[];
    postcodes: string[];
    trades: string[];
    services: string[];
  };
};

export async function synthesiseAnswer(
  question: string,
  hits: QueryHit[]
): Promise<SynthesisedAnswer> {
  if (hits.length === 0) {
    return {
      summary: `No matching records in your archive for "${question}".`,
      count: 0,
      aggregate: { materials: [], postcodes: [], trades: [], services: [] }
    };
  }

  const aggregate = aggregateFacets(hits);
  const hitLines = hits.slice(0, 10).map((h, i) => {
    const f = h.record.facets as Record<string, unknown>;
    const parts = [
      f.trade,
      f.service,
      Array.isArray(f.materials) ? (f.materials as string[]).join("+") : "",
      h.record.postcode
    ]
      .filter(Boolean)
      .map((v) => (typeof v === "string" ? v.replace(/_/g, " ") : String(v)))
      .join(" · ");
    return `${i + 1}. ${parts}`;
  });

  const llm = await completeJson<{ summary?: string }>({
    system: `You answer a UK tradesperson's question about their own archive.
Use ONLY the record list provided. Never invent counts, materials, or clients.
Direct, one paragraph. Reference specifics from the records. No marketing-speak.
Respond in JSON: { "summary": string }`,
    maxTokens: 240,
    temperature: 0.3,
    messages: [
      {
        role: "user",
        content: `Question: "${question}"

Records matched (${hits.length} total):
${hitLines.join("\n")}

Return JSON with a one-paragraph answer that summarises what's in the archive
matching the question. Include the total count. Reference the most common
material or service if it's meaningful.`
      }
    ]
  });

  const summary =
    llm?.summary ??
    `Found ${hits.length} matching ${hits.length === 1 ? "record" : "records"} in your archive.`;
  return { summary, count: hits.length, aggregate };
}

function aggregateFacets(hits: QueryHit[]): SynthesisedAnswer["aggregate"] {
  const trades = new Set<string>();
  const services = new Set<string>();
  const materials = new Set<string>();
  const postcodes = new Set<string>();
  for (const h of hits) {
    const f = h.record.facets as Record<string, unknown>;
    if (typeof f.trade === "string") trades.add(f.trade);
    if (typeof f.service === "string") services.add(f.service);
    if (Array.isArray(f.materials)) {
      for (const m of f.materials as string[]) materials.add(m);
    }
    if (h.record.postcode) postcodes.add(h.record.postcode);
  }
  return {
    trades: Array.from(trades),
    services: Array.from(services),
    materials: Array.from(materials),
    postcodes: Array.from(postcodes)
  };
}
