// NEX BRAIN · persona loader.
//
// Reads data/nex-voice-profile.md and returns the design-conversation
// sections as one composed persona-extension block for the staircase
// agent to append to its system prompt.
//
// Why a dedicated loader (not reusing staircase-advisor's):
//   - The existing staircase-advisor loader
//     (`src/lib/nex/staircase-advisor/voice-profile.ts`) has typed
//     categories (definition, faq, closing, etc.) tailored for the
//     staircase-advisor brain — a different brain module.
//   - Our staircase agent needs the NEW Phase 1 sections
//     (design confirmations, multi-field extraction few-shot,
//     overwrites, unclear intent, selective updates,
//     teach-not-mutate, price/image policy, anti-chatbot patterns).
//   - Those live in the same file but under new section titles that
//     the existing loader silently ignores (unknown → drops into
//     `_all` bucket).
//   - This loader picks up exactly the new sections we care about
//     and formats them as few-shot examples inside the system prompt.
//
// Caching: profile is loaded once per process (voice profile changes
// require a server restart · matches the existing loader's behaviour).

import "server-only";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const VOICE_PROFILE_PATH = "data/nex-voice-profile.md";

/** The section titles from data/nex-voice-profile.md that the
 *  staircase agent injects as few-shot examples. Order matters —
 *  Claude reads them top-to-bottom. */
const DESIGN_PERSONA_SECTIONS: readonly string[] = [
  "NEX design conversation · commit acknowledgements",
  "NEX design conversation · multi-field extraction few-shot",
  "NEX design conversation · overwrites (customer changes their mind)",
  "NEX design conversation · unclear intent",
  "NEX design conversation · selective updates",
  "NEX design conversation · teach-not-mutate",
  "NEX price policy · never invent",
  "NEX image policy · never fabricate",
  "NEX anti-chatbot · never say these",
];

// ─── Parse ─────────────────────────────────────────────────────────

function stripFrontmatter(raw: string): string {
  if (!raw.startsWith("---")) return raw;
  const closeIdx = raw.indexOf("\n---", 3);
  if (closeIdx <= 0) return raw;
  return raw.slice(closeIdx + 4).replace(/^\r?\n/, "");
}

/** Parse the voice-profile markdown into a { sectionTitle → body } map.
 *  Each section's body is the raw text between the H2 heading and the
 *  next H2 (or the H1 heading for top-level dividers). Preserves
 *  bullet formatting and paragraphs so few-shot examples render
 *  intact in the model's context. */
function parseSections(raw: string): Record<string, string> {
  const body = stripFrontmatter(raw);
  const lines = body.split("\n");
  const sections: Record<string, string> = {};
  let currentTitle: string | null = null;
  let currentBody: string[] = [];

  const commit = () => {
    if (currentTitle) {
      sections[currentTitle] = currentBody.join("\n").trim();
    }
  };

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      commit();
      currentTitle = h2[1].trim();
      currentBody = [];
      continue;
    }
    // Any H1 (---divider or new top-level heading) ends the current section.
    if (/^#\s+/.test(line) || /^---\s*$/.test(line)) {
      commit();
      currentTitle = null;
      currentBody = [];
      continue;
    }
    if (currentTitle !== null) currentBody.push(line);
  }
  commit();
  return sections;
}

// ─── Cache ─────────────────────────────────────────────────────────

let cachedPersonaBlock: string | null = null;

/** Compose the design-conversation persona extension. Returns a
 *  single formatted string ready to append to the staircase agent's
 *  system prompt. Returns an empty string if the file is missing or
 *  none of the target sections are present (agent falls back to its
 *  inline persona only — no crash). */
export function loadDesignPersonaBlock(): string {
  if (cachedPersonaBlock !== null) return cachedPersonaBlock;

  const path = join(process.cwd(), VOICE_PROFILE_PATH);
  if (!existsSync(path)) {
    cachedPersonaBlock = "";
    return cachedPersonaBlock;
  }

  const raw = readFileSync(path, "utf8");
  const sections = parseSections(raw);

  const parts: string[] = [];
  for (const title of DESIGN_PERSONA_SECTIONS) {
    const body = sections[title];
    if (!body) continue; // section not present · skip silently
    parts.push(`### ${title}\n\n${body}`);
  }

  if (parts.length === 0) {
    cachedPersonaBlock = "";
    return cachedPersonaBlock;
  }

  cachedPersonaBlock = [
    "",
    "## PERSONA CONCRETE EXAMPLES",
    "",
    "The following few-shot examples show HOW NEX speaks and behaves in specific",
    "design-conversation situations. Match this voice exactly — same rhythm, same",
    "brevity, same tool-use discipline. Do not paraphrase, do not soften, do not",
    "add assistant-clichés that these examples deliberately avoid.",
    "",
    parts.join("\n\n"),
  ].join("\n");

  return cachedPersonaBlock;
}

/** Force reload · call after editing the voice profile file in a
 *  long-lived process. Matches the existing staircase-advisor
 *  loader's `reloadVoiceProfile()` behaviour. */
export function reloadDesignPersonaBlock(): void {
  cachedPersonaBlock = null;
  loadDesignPersonaBlock();
}
