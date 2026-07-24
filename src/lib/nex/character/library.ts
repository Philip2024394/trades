// Character Library — loader, matcher, alternative picker.
//
// Static import of every JSON volume so the bundler tree-shakes them
// and the library ships in the same deploy as the code.
//
// Adding a new volume: create `library/volume_XX_name.json`, then add
// its import to VOLUMES below. No other changes.

import { createHash } from "node:crypto";
import { VolumeSchema, type CharacterEntry, type CompiledEntry, type Volume } from "./types";

// Volumes — static imports.
import volume00 from "./library/volume_00_core.json" with { type: "json" };

const VOLUMES: unknown[] = [volume00];

// ─── Load + validate + compile ─────────────────────────────────

let cached: CompiledEntry[] | null = null;

export function loadCharacterLibrary(): CompiledEntry[] {
  if (cached) return cached;
  const out: CompiledEntry[] = [];
  const seenIntents = new Set<string>();
  for (const raw of VOLUMES) {
    const vol = VolumeSchema.parse(raw) as Volume;
    for (const entry of vol.entries) {
      if (seenIntents.has(entry.intent)) {
        throw new Error(`Duplicate character intent "${entry.intent}" in ${vol.volume_id}`);
      }
      seenIntents.add(entry.intent);
      out.push(compile(entry, vol.volume_id));
    }
  }
  // Sort by priority desc so higher-priority patterns match first.
  out.sort((a, b) => b.priority - a.priority);
  cached = out;
  return out;
}

/** Test-only: clear the module cache between runs. */
export function _clearLibraryCache(): void { cached = null; }

function compile(entry: CharacterEntry, volumeId: string): CompiledEntry {
  const patterns = entry.patterns.map((src) => {
    try { return new RegExp(src, "i"); }
    catch (e) {
      throw new Error(`Bad regex in ${entry.intent}: ${src} (${e instanceof Error ? e.message : ""})`);
    }
  });
  return { ...entry, patterns, volume_id: volumeId };
}

// ─── Matcher ───────────────────────────────────────────────────

export function findEntry(text: string): CompiledEntry | null {
  const t = text.trim();
  if (!t) return null;
  const entries = loadCharacterLibrary();
  for (const e of entries) {
    for (const p of e.patterns) {
      if (p.test(t)) return e;
    }
  }
  return null;
}

// ─── Alternative picker ────────────────────────────────────────

/** Pick one alternative reply. Deterministic per (merchant, intent, day)
 *  so the same merchant sees the same answer within a day but the reply
 *  rotates across days. Merchants who ask the same thing twice in a
 *  minute get the same reply (not annoying variability), but tomorrow's
 *  answer varies. */
export function pickAlternative(entry: CompiledEntry, seed: {
  merchantSlug: string;
  now?:         Date;
}): string {
  const alts = entry.alternatives;
  if (alts.length === 1) return alts[0];
  const day = (seed.now ?? new Date()).toISOString().slice(0, 10);
  const key = `${seed.merchantSlug}|${entry.intent}|${day}`;
  const h = createHash("sha256").update(key).digest();
  const idx = h.readUInt32BE(0) % alts.length;
  return alts[idx];
}

// ─── Read-only helpers for admin UI ────────────────────────────

export function listByCategory(): Record<string, CompiledEntry[]> {
  const out: Record<string, CompiledEntry[]> = {};
  for (const e of loadCharacterLibrary()) {
    (out[e.category] ??= []).push(e);
  }
  return out;
}

export function libraryStats(): {
  total_entries:       number;
  total_alternatives:  number;
  by_category:         Record<string, number>;
  by_tone:             Record<string, number>;
  volumes_loaded:      number;
} {
  const entries = loadCharacterLibrary();
  const by_category: Record<string, number> = {};
  const by_tone:     Record<string, number> = {};
  let total_alternatives = 0;
  for (const e of entries) {
    by_category[e.category] = (by_category[e.category] ?? 0) + 1;
    by_tone[e.tone]         = (by_tone[e.tone] ?? 0) + 1;
    total_alternatives     += e.alternatives.length;
  }
  return {
    total_entries:      entries.length,
    total_alternatives,
    by_category,
    by_tone,
    volumes_loaded:     VOLUMES.length
  };
}
