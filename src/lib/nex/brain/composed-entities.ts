// src/lib/nex/brain/composed-entities.ts
//
// P0.2 · Composed-reply entity extraction (Philip 2026-09-05 P0.2 doctrine).
//
// PURPOSE
// -------
// Attacks P0.2 gap #4: reference resolution not feeding composed
// results back into the entity window.
//
// When the Response Composition Layer produces a reply containing an
// enumerated list ("three main coffee-producing regions are Aceh,
// Java, and Sulawesi"), the entities in that list must become
// addressable in the next conversational turn ("tell me more about
// the second one" → Java).
//
// Before this module, composed lists were disposable UI. The entities
// they contained never entered `session.entities`, so reference
// resolution failed on turn N+1. This module bridges that gap.
//
// DISCIPLINE
// ----------
//   · Never invent entities that don't appear in the reply text
//   · Never use LLM to extract · this is deterministic pattern-matching
//   · Never claim to have recognised more than we actually parsed
//   · Cross-reference every extracted entity against the reply text
//     for provenance (raw span preserved)
//   · Attach source="nex_reply" so downstream code can distinguish
//     from user-produced entities

import type { RecognisedEntity } from "./entities";

// ─── Extraction patterns (deterministic) ─────────────────────────

/**
 * Extract enumerated entities from a composed reply. Handles the
 * shapes composition most commonly produces:
 *
 *   · "1. X 2. Y 3. Z" · numbered lists
 *   · "X, Y, and Z" · comma-separated with "and"
 *   · "X · Y · Z" · bullet-separated
 *   · "including X, Y, Z" · list after "including"
 *   · "such as X, Y, Z" · list after "such as"
 *   · "regions like X, Y, Z" / "hubs like X, Y, Z"
 *
 * Never over-extracts · pure regex on well-formed enumerated
 * patterns only. Prose without an obvious list is left alone.
 */
export function extractEnumeratedEntities(replyText: string): Array<{
  raw: string;
  canonical: string;
  position: number;
}> {
  if (!replyText || typeof replyText !== "string") return [];
  const found: Array<{ raw: string; canonical: string; position: number }> = [];
  const seen = new Set<string>();

  // Pattern 1 · numbered list "1. Foo 2. Bar 3. Baz"
  const numberedPattern = /(?:^|\s)(\d)[.\)]\s+([A-Z][A-Za-z][A-Za-z\s\-']{1,40}?)(?=\s*(?:\d[.\)]|[.,;\n]|$))/g;
  for (const m of replyText.matchAll(numberedPattern)) {
    const position = Number.parseInt(m[1], 10);
    const raw = m[2].trim();
    const canonical = normalizeEntity(raw);
    if (canonical && !seen.has(canonical) && Number.isFinite(position)) {
      seen.add(canonical);
      found.push({ raw, canonical, position });
    }
  }

  if (found.length > 0) return found.slice(0, 12);

  // Pattern 2 · "X, Y, and Z" (list intro varies)
  // Look for triggering phrases first (list intro), then parse the trailing list
  const listIntros = [
    /(?:like|include(?:s)?|including|such as|are|regions?|hubs?|areas?|producers?|options?|choices?|examples?|primarily|especially)[\s:]+([A-Z][A-Za-z][^.!?\n]{5,300})/g,
  ];
  for (const rx of listIntros) {
    for (const m of replyText.matchAll(rx)) {
      const tail = m[1];
      const items = parseListTail(tail);
      let pos = 1;
      for (const it of items) {
        const canonical = normalizeEntity(it);
        if (canonical && !seen.has(canonical)) {
          seen.add(canonical);
          found.push({ raw: it, canonical, position: pos });
          pos += 1;
          if (found.length >= 12) break;
        }
      }
      if (found.length >= 12) break;
    }
    if (found.length >= 12) break;
  }

  return found;
}

function parseListTail(tail: string): string[] {
  // Split on comma / semicolon / " and " / " or " / bullets
  const cleaned = tail.replace(/\.$/, "").replace(/\s+/g, " ").trim();
  const parts = cleaned
    .split(/,|;| and | or | · | \| /i)
    .map((p) => p.trim())
    .filter(Boolean);
  const items: string[] = [];
  for (const raw of parts) {
    let p = raw;
    // P1 · Strip leading article "the "/"a "/"an " (with case-insensitive
    // match). Composed lists frequently emit "the Indian Ocean south of Java,
    // the Banda Sea, and the Molucca Sea" — the articles are grammatical,
    // not part of the entity name.
    p = p.replace(/^(the |a |an )/i, "").trim();
    // Reject pronoun-shaped fragments (still likely prose)
    if (/^(it |they |we |these |those |i |you |he |she )/i.test(p)) continue;
    // Reject long prose fragments
    if (p.length > 60) continue;
    // Must start with a capital letter (proper noun / named entity)
    if (!/^[A-Z]/.test(p)) continue;
    // Reject items that contain verb-shaped clauses (multi-word with
    // "is/are/was/were/has/have/had" tokens · usually indicates a
    // sentence fragment rather than a list item)
    if (/\b(is|are|was|were|has|have|had)\b/i.test(p)) continue;
    // Strip trailing punctuation
    const trimmed = p.replace(/[.,;:!?]$/, "").trim();
    if (trimmed.length < 2) continue;
    items.push(trimmed);
    if (items.length >= 12) break;
  }
  return items;
}

function normalizeEntity(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\w\s\-']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Session-window integration ──────────────────────────────────

/**
 * Convert enumerated entities extracted from a composed reply into
 * `RecognisedEntity` records suitable for `mergeEntityWindow`.
 *
 * Deterministic. Attaches source="nex_reply" and now-ish timestamp.
 * Kind defaulted to "place" because that's the dominant entity kind
 * in enumerated composed lists (Aceh/Java/Sulawesi · Solo/Yogyakarta/
 * Bandung · etc). Future extension can add per-item kind detection.
 */
export function composedListToEntities(
  replyText: string,
  atIso: string = new Date().toISOString(),
): RecognisedEntity[] {
  const extracted = extractEnumeratedEntities(replyText);
  const entities: RecognisedEntity[] = [];
  for (const item of extracted) {
    const id = `place:${item.canonical.replace(/\s+/g, "-")}`;
    entities.push({
      id,
      kind: "place",
      canonical: item.canonical,
      raw: item.raw,
      source: "nex_reply",
      atIso,
      // Use RecognisedEntity's canonical `presentedOffset` field so
      // downstream reference-resolution ("the second one") can
      // resolve against composed-reply lists without a schema change.
      presentedOffset: item.position,
    });
  }
  return entities;
}
