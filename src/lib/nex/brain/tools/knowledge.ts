// src/lib/nex/brain/tools/knowledge.ts
//
// Stage 3.35 · Phase E · Editorial knowledge tool (Philip 2026-08-31).
//
// Wraps `retrieveKnowledge` — the existing editorial JSON corpus at
// `data/indonesia/knowledge-entities.json`. Used for "what is X"
// questions where NEX has authoritative editorial content (kos-kosan
// explanations, batik, tourism context, etc).
//
// CONSTITUTIONAL: never present invented editorial facts. When no
// authoritative entry matches, returns `unavailable` explicitly.

import { retrieveKnowledge } from "@/lib/nex/indonesia/knowledge";

export type KnowledgeAnswer = {
  topic: string;
  content: string;
  region: string;
  lastVerified: string;
  sourceKey: string;
};

export type KnowledgeResult =
  | {
      found: true;
      answer: KnowledgeAnswer;
      replyText: { en: string; id: string };
    }
  | {
      found: false;
      reason: "no_query_extracted" | "no_matching_entry";
      message: { en: string; id: string };
    };

/**
 * Extract the subject of a "what is X" / "what does X mean" question.
 * Bilingual EN + ID. Returns undefined when the question shape isn't
 * a knowledge query (caller then routes elsewhere).
 */
export function extractKnowledgeSubject(message: string): string | undefined {
  const m = message.trim();
  // EN patterns · "what is X" · "what does X mean" · "tell me about X"
  const en = m.match(/\b(?:what\s+is|what\s+does|tell\s+me\s+about|explain)\s+(?:a\s+|an\s+|the\s+)?([a-z][\w\s-]{2,50}?)(?:\s+(?:mean|is|are|refer\s+to))?\s*[?.]?\s*$/i);
  if (en && en[1]) return en[1].trim();
  // ID patterns · "apa itu X" · "jelaskan X"
  const id = m.match(/\b(?:apa\s+itu|apa\s+arti|jelaskan)\s+([a-z][\w\s-]{2,50}?)\s*[?.]?\s*$/i);
  if (id && id[1]) return id[1].trim();
  return undefined;
}

export function runKnowledge(input: { message: string; market?: "ID" | "UK" | "US" }): KnowledgeResult {
  const subject = extractKnowledgeSubject(input.message);
  if (!subject) {
    return {
      found: false,
      reason: "no_query_extracted",
      message: {
        en: "I couldn't identify what you're asking about. Try 'what is a kos-kosan?' or 'tell me about batik'.",
        id: "Saya tidak bisa mengidentifikasi yang kamu tanyakan. Coba 'apa itu kos-kosan?' atau 'jelaskan batik'.",
      },
    };
  }

  const hits = retrieveKnowledge(subject, {
    limit: 3,
    minConfidence: 0.5,
    market: input.market,
  });
  // Filter to editorial entries only (not place records) · place records
  // ids start with "place:" · editorial ids are topic-shaped.
  const editorial = hits.filter((h) => !h.id.startsWith("place:"));
  const top = editorial[0];
  if (!top) {
    return {
      found: false,
      reason: "no_matching_entry",
      message: {
        en: `I don't have an authoritative editorial entry for "${subject}". I won't invent one.`,
        id: `Saya tidak punya entri editorial otoritatif untuk "${subject}". Saya tidak akan mengarang.`,
      },
    };
  }

  const answer: KnowledgeAnswer = {
    topic: top.topic ?? subject,
    content: top.content ?? "",
    region: top.region ?? "Indonesia",
    lastVerified: top.last_verified ?? "unknown",
    sourceKey: `nex.knowledge.${top.id}`,
  };
  const provenanceEn = ` (Source: NEX Indonesia knowledge · ${answer.region} · verified ${answer.lastVerified}.)`;
  const provenanceId = ` (Sumber: Pengetahuan NEX Indonesia · ${answer.region} · diverifikasi ${answer.lastVerified}.)`;

  return {
    found: true,
    answer,
    replyText: {
      en: `${answer.content}${provenanceEn}`,
      id: `${answer.content}${provenanceId}`,
    },
  };
}
