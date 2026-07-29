// src/lib/nex/brains/_retrieval.ts
//
// D1 Runtime · Content Retrieval (Philip 2026-07-28)
// ──────────────────────────────────────────────────
// Given an Intent, retrieve the relevant published module content +
// attached evidence citations. NEVER reads drafts, pending versions,
// rejected content, or comments. Only the current immutable version.
//
// Philip's architectural rule (locked):
//   Runtime → hammerex_nex_brain_versions where id = brain.current_version_id
//   Runtime → NEVER hammerex_nex_brain_drafts
//
// This module owns the "published knowledge always wins" rule from
// Philip's runtime brief. If the published brain doesn't contain the
// answer, retrieval returns empty results — the synthesizer then
// classifies the answer as `unknown`.

import type { LoadedBrain } from "./_types";
import type { BrainEvidence } from "./_living_types";
import type { Intent } from "./_intent";

export type RetrievedTopic = {
  module: string;
  topic: string;
  content: Record<string, unknown>;   // the raw entry (definition, purpose, etc.)
  citations: string[];                 // _source / sources references from the entry
};

export type RetrievalResult = {
  hits: RetrievedTopic[];
  evidence: BrainEvidence[];
  matched_modules: string[];
  no_content_found: boolean;
};

/**
 * Retrieve content for an intent. Returns:
 *   • hits: matched topic entries from the current published version
 *   • evidence: BrainEvidence[] built from _source citations
 *   • matched_modules: the module keys that had any match
 *   • no_content_found: true when the intent matched nothing
 */
export function retrieveContent(brain: LoadedBrain, intent: Intent): RetrievalResult {
  const modules = (brain as unknown as { modules?: Record<string, unknown> }).modules;
  if (!modules) {
    return { hits: [], evidence: [], matched_modules: [], no_content_found: true };
  }

  const hits: RetrievedTopic[] = [];
  const matchedModules = new Set<string>();

  // For each candidate topic, look it up in the candidate modules first.
  // If not found there, fall back to a full scan across all modules.
  const candidateModules = intent.candidate_modules.length > 0
    ? intent.candidate_modules
    : Object.keys(modules);

  for (const topic of intent.candidate_topics) {
    let found = false;
    for (const mod of candidateModules) {
      const modContent = modules[mod];
      if (!modContent || typeof modContent !== "object") continue;
      const entry = (modContent as Record<string, unknown>)[topic];
      if (entry && typeof entry === "object") {
        const asObj = entry as Record<string, unknown>;
        // Skip explicitly-not-authored entries
        if (asObj._status === "not_yet_authored" || asObj._status === "blocked") continue;
        hits.push({
          module: mod,
          topic,
          content: asObj,
          citations: extractCitations(asObj),
        });
        matchedModules.add(mod);
        found = true;
        break;
      }
    }
    // Fall-back scan
    if (!found) {
      for (const [mod, modContent] of Object.entries(modules)) {
        if (candidateModules.includes(mod)) continue;
        if (!modContent || typeof modContent !== "object") continue;
        const entry = (modContent as Record<string, unknown>)[topic];
        if (entry && typeof entry === "object") {
          const asObj = entry as Record<string, unknown>;
          if (asObj._status === "not_yet_authored" || asObj._status === "blocked") continue;
          hits.push({
            module: mod,
            topic,
            content: asObj,
            citations: extractCitations(asObj),
          });
          matchedModules.add(mod);
          break;
        }
      }
    }
  }

  // If the intent had no candidate topics (e.g. regulation_check) but did
  // specify candidate modules, return module-level content for context.
  if (hits.length === 0 && intent.candidate_topics.length === 0) {
    for (const mod of candidateModules) {
      const modContent = modules[mod];
      if (!modContent || typeof modContent !== "object") continue;
      const asObj = modContent as Record<string, unknown>;
      if (asObj._status === "not_yet_authored" || asObj._status === "blocked") continue;
      // Push a whole-module hit (topic = "*")
      hits.push({
        module: mod,
        topic: "*",
        content: asObj,
        citations: extractCitations(asObj),
      });
      matchedModules.add(mod);
    }
  }

  const evidence = buildEvidenceArray(hits, brain);

  return {
    hits,
    evidence,
    matched_modules: Array.from(matchedModules),
    no_content_found: hits.length === 0,
  };
}

// ---------- Helpers ----------

function extractCitations(entry: Record<string, unknown>): string[] {
  const citations: string[] = [];
  const s1 = entry._source;
  if (typeof s1 === "string") citations.push(s1);
  else if (Array.isArray(s1)) for (const item of s1) if (typeof item === "string") citations.push(item);

  const s2 = entry.sources;
  if (Array.isArray(s2)) {
    for (const item of s2) {
      if (typeof item === "string") citations.push(item);
      else if (item && typeof item === "object" && "id" in item && typeof (item as { id: unknown }).id === "string") {
        citations.push((item as { id: string }).id);
      }
    }
  }
  return citations;
}

function buildEvidenceArray(hits: RetrievedTopic[], brain: LoadedBrain): BrainEvidence[] {
  const evidence: BrainEvidence[] = [];
  const seen = new Set<string>();
  const slug = brain.manifest.slug;
  for (const hit of hits) {
    const brainRef = `${slug}#${hit.module}.${hit.topic}`;
    if (!seen.has(brainRef)) {
      seen.add(brainRef);
      evidence.push({
        kind: "brain_module",
        ref: brainRef,
        excerpt: summariseHit(hit),
      });
    }
    for (const cite of hit.citations) {
      if (seen.has(cite)) continue;
      seen.add(cite);
      // Classify citation kind — regulation heuristic + URL heuristic
      const kind: BrainEvidence["kind"] =
        /^https?:\/\//.test(cite)              ? "url" :
        /doc[ -]?k|bs en|bs 5395|approved doc/i.test(cite) ? "regulation" :
        "material_spec";
      evidence.push({ kind, ref: cite });
    }
  }
  return evidence;
}

function summariseHit(hit: RetrievedTopic): string {
  const preferred = ["definition", "value", "description", "purpose", "summary"];
  for (const k of preferred) {
    const v = hit.content[k];
    if (typeof v === "string" && v.length > 0) {
      return v.length > 200 ? v.slice(0, 197) + "…" : v;
    }
  }
  return `${hit.module}.${hit.topic}`;
}
