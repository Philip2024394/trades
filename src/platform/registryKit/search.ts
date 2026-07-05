// registryKit · weighted keyword search.
//
// Generalised from designSystemRegistry.search() + buttonRegistry.search().
// Every registry gets the same weighted-keyword scoring so Studio browsers
// and AI callers behave consistently.
//
// Scoring (per query word):
//   +10 exact id match
//   + 8 partial id match
//   + 6 name match
//   + 5 exact keyword match
//   + 3 partial keyword match
//   + 2 description match
//   + 1 category match
//
// Multi-word queries sum per-word scores. Results sorted highest first.
// Empty query returns the first `limit` in registration order.

import type { Frozen, RegistrationBase } from "./types";

export function searchRegistrations<T extends RegistrationBase>(
  registrations: Iterable<Frozen<T>>,
  query: string,
  limit = 20
): Frozen<T>[] {
  const q = query.trim().toLowerCase();
  const all = Array.from(registrations);
  if (!q) return all.slice(0, limit);

  const words = q.split(/\s+/);
  const scored: { reg: Frozen<T>; score: number }[] = [];

  for (const reg of all) {
    let score = 0;
    const id = reg.id.toLowerCase();
    const name = reg.name.toLowerCase();
    const desc = reg.description.toLowerCase();
    const category = reg.category.toLowerCase();
    const keywords = (reg.searchKeywords ?? []).map((k) => k.toLowerCase());
    const tags = (reg.tags ?? []).map((t) => t.toLowerCase());

    for (const w of words) {
      if (id === w) score += 10;
      else if (id.includes(w)) score += 8;
      if (name.includes(w)) score += 6;
      if (keywords.some((k) => k === w)) score += 5;
      else if (keywords.some((k) => k.includes(w))) score += 3;
      if (tags.some((t) => t === w)) score += 4;
      else if (tags.some((t) => t.includes(w))) score += 2;
      if (desc.includes(w)) score += 2;
      if (category.includes(w)) score += 1;
    }
    if (score > 0) scored.push({ reg, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.reg);
}
