// NEX Knowledge Factory · Worker Personas · Phase 12.4
//
// Human names for the six pipeline worker types so operators can
// think about "Iris the checker" instead of "quality-checker@11300".
// Names are alphabet-sorted for the M/B/R/A/H/I grid layout Philip
// specified — reading top-to-bottom, left-to-right matches the
// pipeline order (context → voice → learning → extractor → image →
// quality).
//
// Do NOT introduce animals, emojis in names, or cutesy suffixes.
// Straight given names only — this is a factory floor, not a mascot
// parade. Personas are labels for humans; every debug/log surface
// still uses worker_type as the machine-readable identity.

import type { WorkerType } from "@/lib/nex/brain/types";

export type PersonaInfo = {
  worker_type: WorkerType;
  name: string;           // Given name shown on the card
  role: string;           // Short human role description
  glyph: string;          // Single emoji · rendered subtly, not center-stage
  stage_index: number;    // 1-based position in the pipeline
};

export const FACTORY_PERSONAS: PersonaInfo[] = [
  { worker_type: "knowledge-context",   name: "Mason",  role: "Memory quarry",       glyph: "📚", stage_index: 1 },
  { worker_type: "voice-context",       name: "Blake",  role: "Voice + brand",       glyph: "🎨", stage_index: 2 },
  { worker_type: "learning-context",    name: "Rowan",  role: "Past-feedback recall",glyph: "🧭", stage_index: 3 },
  { worker_type: "knowledge-extractor", name: "Avery",  role: "Author drafts",       glyph: "✍️", stage_index: 4 },
  { worker_type: "image-analyst",       name: "Harper", role: "Visual analyst",      glyph: "🖼️", stage_index: 5 },
  { worker_type: "quality-checker",     name: "Iris",   role: "Constitution gate",   glyph: "🔍", stage_index: 6 },
];

const BY_TYPE: Record<string, PersonaInfo> = Object.fromEntries(
  FACTORY_PERSONAS.map((p) => [p.worker_type, p])
);

export function personaFor(worker_type: string): PersonaInfo | null {
  return BY_TYPE[worker_type] ?? null;
}
