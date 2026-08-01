// Voice profile loader (Philip 2026-08-01 · Priority 5)
//
// Directive:
//   "Voice profile file — single markdown file you edit to change Nex's
//   voice patterns without touching code."
//
// Reads data/nex-voice-profile.md at startup · parses ## sections into
// phrase arrays · returns phrases per situation. Rotation is deterministic
// (hash-based) so the same conversation position gets the same phrase.

import "server-only";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const VOICE_PROFILE_PATH = "data/nex-voice-profile.md";

export type VoiceProfile = {
  // Openers
  definition:    string[];
  faq:           string[];
  principle:     string[];
  comparison:    string[];
  ambiguity:     string[];
  // Closings
  closing:       string[];
  stage_1_close: string[];
  // Situations
  correction_ack: string[];
  boundary_price: string[];
  boundary_fit:   string[];
  off_topic:      string[];
  identity:       string[];
  five_turn_handoff: string[];
  replacement_limit: string[];
  extension_limit:   string[];
  // Raw sections index (for direct lookup)
  _all: Record<string, string[]>;
};

// ─── Parser ───────────────────────────────────────────────────────

function stripFrontmatter(raw: string): string {
  if (!raw.startsWith("---")) return raw;
  const closeIdx = raw.indexOf("\n---", 3);
  if (closeIdx <= 0) return raw;
  return raw.slice(closeIdx + 4).replace(/^\r?\n/, "");
}

function parseVoiceMd(raw: string): Record<string, string[]> {
  const body = stripFrontmatter(raw);
  const lines = body.split("\n");
  const sections: Record<string, string[]> = {};
  let currentKey = "";
  let currentPhrases: string[] = [];

  const commit = () => {
    if (currentKey) sections[currentKey] = currentPhrases.slice();
  };

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      commit();
      currentKey = h2[1].trim();
      currentPhrases = [];
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (bullet && currentKey) {
      currentPhrases.push(bullet[1].trim());
    }
  }
  commit();
  return sections;
}

function sectionToKey(sectionTitle: string): keyof VoiceProfile | null {
  const t = sectionTitle.toLowerCase();
  if (t.includes("definition")) return "definition";
  if (t.includes("faq") || t.includes("why/how")) return "faq";
  if (t.includes("principle")) return "principle";
  if (t.includes("comparison")) return "comparison";
  if (t.includes("ambiguity")) return "ambiguity";
  if (t.includes("stage 1")) return "stage_1_close";
  if (t.includes("closing")) return "closing";
  if (t.includes("correction")) return "correction_ack";
  if (t.includes("price")) return "boundary_price";
  if (t.includes("fit-guarantee") || t.includes("fit guarantee")) return "boundary_fit";
  if (t.includes("off-topic")) return "off_topic";
  if (t.includes("identity")) return "identity";
  if (t.includes("5-turn") || t.includes("five-turn") || t.includes("handoff to designer")) return "five_turn_handoff";
  if (t.includes("replacement")) return "replacement_limit";
  if (t.includes("extension")) return "extension_limit";
  return null;
}

// ─── Cache ────────────────────────────────────────────────────────

let cachedProfile: VoiceProfile | null = null;

function emptyProfile(): VoiceProfile {
  return {
    definition:        [],
    faq:               [],
    principle:         [],
    comparison:        [],
    ambiguity:         [],
    closing:           [],
    stage_1_close:     [],
    correction_ack:    [],
    boundary_price:    [],
    boundary_fit:      [],
    off_topic:         [],
    identity:          [],
    five_turn_handoff: [],
    replacement_limit: [],
    extension_limit:   [],
    _all:              {},
  };
}

export function getVoiceProfile(): VoiceProfile {
  if (cachedProfile) return cachedProfile;
  const path = join(process.cwd(), VOICE_PROFILE_PATH);
  if (!existsSync(path)) {
    cachedProfile = emptyProfile();
    return cachedProfile;
  }
  const raw = readFileSync(path, "utf8");
  const sections = parseVoiceMd(raw);
  const profile = emptyProfile();
  profile._all = sections;
  for (const [sectionTitle, phrases] of Object.entries(sections)) {
    const key = sectionToKey(sectionTitle);
    if (key && key !== "_all") {
      (profile[key] as string[]).push(...phrases);
    }
  }
  cachedProfile = profile;
  return profile;
}

/** Pick a phrase deterministically from a category · rotates through variants. */
export function pickVoice(category: keyof Omit<VoiceProfile, "_all">, seed: string | number): string | null {
  const profile = getVoiceProfile();
  const phrases = profile[category] as string[];
  if (!phrases || phrases.length === 0) return null;
  const seedNum = typeof seed === "number" ? seed : seed.length + (seed.charCodeAt(0) || 0);
  return phrases[seedNum % phrases.length];
}

/** Force reload · call after editing the voice profile file. */
export function reloadVoiceProfile(): void {
  cachedProfile = null;
  getVoiceProfile();
}
