// Type-profile intent detection · routing repair (Philip 2026-07-31).
//
// Runs BEFORE Terminology direct-serve. When a query contains a multi-word
// staircase-type subject (e.g. "closed string staircase", "open riser",
// "space saver"), route directly to the type_profiles module BEFORE single-word
// Terminology canonicals ("string", "riser") preempt the correct answer.
//
// If no multi-word type subject is detected, this function returns null and
// the composer proceeds through Terminology → subject-intent → module-serve
// → fallback exactly as before. **Nothing else changes.**
//
// Rule B compliance: phrases are derived ONLY from Philip's authored profile
// names + "Also Known As" aliases. Never invented.
// Rule A compliance: returns null when uncertain · falls through to normal path.

import "server-only";
import { loadModule, type ModuleAtom } from "./_module_serve";
import {
  extractBullets,
  renderPresentedAnswerAsText,
  composeTeaching,
  type PresentedAnswer,
  type PresentationSection,
  type TeachingInput,
} from "./_presentation";

type PhraseEntry = { phrase: string; profile_name: string };
const phraseCache = new Map<string, PhraseEntry[]>();

async function loadTypeProfilePhrases(brainSlug: string): Promise<PhraseEntry[]> {
  const cached = phraseCache.get(brainSlug);
  if (cached) return cached;

  const mod = await loadModule(brainSlug, "type_profiles");
  if (!mod) return [];

  // Group atoms by profile (section = profile name)
  const byProfile = new Map<string, ModuleAtom[]>();
  for (const atom of mod.atoms) {
    if (!atom.section) continue;
    const list = byProfile.get(atom.section) ?? [];
    list.push(atom);
    byProfile.set(atom.section, list);
  }

  const phrases: PhraseEntry[] = [];
  for (const [profileName, atoms] of byProfile.entries()) {
    // Full profile name (case-insensitive)
    phrases.push({ phrase: profileName.toLowerCase(), profile_name: profileName });

    // Canonical short-key phrases derived from profile name
    const nameLower = profileName.toLowerCase();
    if (nameLower.includes("closed string")) {
      phrases.push({ phrase: "closed string", profile_name: profileName });
      phrases.push({ phrase: "closed string staircase", profile_name: profileName });
    }
    if (nameLower.includes("cut string") && !nameLower.includes("double")) {
      phrases.push({ phrase: "cut string", profile_name: profileName });
      phrases.push({ phrase: "cut string staircase", profile_name: profileName });
    }
    if (nameLower.includes("open riser")) {
      phrases.push({ phrase: "open riser", profile_name: profileName });
      phrases.push({ phrase: "open riser staircase", profile_name: profileName });
    }
    if (nameLower.includes("double cut string")) {
      phrases.push({ phrase: "double cut string", profile_name: profileName });
      phrases.push({ phrase: "double cut string staircase", profile_name: profileName });
    }
    if (nameLower.includes("space saver")) {
      phrases.push({ phrase: "space saver", profile_name: profileName });
      phrases.push({ phrase: "space saver staircase", profile_name: profileName });
    }

    // Aliases from the "Also Known As" section (type: "also_known_as")
    const aliasAtom = atoms.find(a => a.type === "also_known_as");
    if (aliasAtom) {
      const aliasLines = aliasAtom.text.match(/^\*\s+(.+)$/gm);
      if (aliasLines) {
        for (const line of aliasLines) {
          const alias = line
            .replace(/^\*\s+/, "")
            .replace(/\s*\([^)]*\)\s*$/, "")
            .trim()
            .toLowerCase();
          // Only multi-word aliases (avoid competing with Terminology single-words)
          if (alias.length > 8 && alias.includes(" ")) {
            phrases.push({ phrase: alias, profile_name: profileName });
          }
        }
      }
    }
  }

  // Dedupe · then sort by phrase length descending so longer / more specific matches win
  const seen = new Set<string>();
  const unique = phrases.filter(p => {
    const key = `${p.phrase}::${p.profile_name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  unique.sort((a, b) => b.phrase.length - a.phrase.length);

  phraseCache.set(brainSlug, unique);
  return unique;
}

export type TypeProfileHit = {
  profile_name: string;
  matched_phrase: string;
  atoms: Array<{ atom: ModuleAtom; module_slug: string; module_title: string }>;
} | null;

/** Detect whether a query targets a specific staircase-type profile.
 *  Runs BEFORE Terminology so single-word canonicals inside compound
 *  phrases don't preempt. Returns null when no type-profile subject
 *  is detected, so the composer falls through to the normal path. */
export async function detectAndRetrieveTypeProfile(
  brainSlug: string,
  query: string
): Promise<TypeProfileHit> {
  const phrases = await loadTypeProfilePhrases(brainSlug);
  const q = query.toLowerCase();

  for (const { phrase, profile_name } of phrases) {
    if (q.includes(phrase)) {
      // Match found · retrieve profile atoms
      const mod = await loadModule(brainSlug, "type_profiles");
      if (!mod) return null;
      const results = mod.atoms
        .filter(a => a.section === profile_name)
        .map(a => ({ atom: a, module_slug: "type_profiles", module_title: mod.header.title }));
      if (results.length === 0) return null;
      return { profile_name, matched_phrase: phrase, atoms: results };
    }
  }
  return null;
}

// ─── Section text extraction ────────────────────────────────

/** Strip the "ProfileName · SectionTitle: " prefix from an atom's text. */
function stripSectionPrefix(text: string): string {
  return text.replace(/^[^·]+·\s*[^:]+:\s*/, "").trim();
}

/** Find the raw section text for an atom_type within a profile hit. */
function findSection(hit: NonNullable<TypeProfileHit>, atomType: string): string | null {
  const atom = hit.atoms.find(x => x.atom.type === atomType);
  if (!atom) return null;
  return stripSectionPrefix(atom.atom.text);
}

// ─── Progressive-disclosure composition ────────────────────

/** Adapt a type-profile hit into a TeachingInput. Teaching Intelligence takes
 *  it from there. All source-specific logic lives in this adapter · nothing
 *  else. */
export function typeProfileToTeaching(hit: NonNullable<TypeProfileHit>): TeachingInput {
  const definitionText = findSection(hit, "definition") ?? "";
  const alsoKnownAsText = findSection(hit, "also_known_as") ?? "";
  const aliases = alsoKnownAsText
    .split(/\r?\n/)
    .map(l => l.trim().replace(/^[*\-•]\s+/, "").replace(/\s*\([^)]*\)\s*$/, "").trim())
    .filter(a => a.length > 4);
  const subject_subtitle = aliases.length > 0 ? aliases[0] : null;

  const fact_bullets = extractBullets(findSection(hit, "characteristics") ?? "");
  const common_questions = extractBullets(findSection(hit, "common_customer_questions") ?? "");

  // At-a-glance derived key facts
  const spaceReq = (findSection(hit, "space_requirements") ?? "").split(/(?<=[.!?])\s+/)[0]?.trim() ?? null;
  const materialsBullets = extractBullets(findSection(hit, "materials_commonly_used") ?? "").slice(0, 4);
  const applicationsBullets = extractBullets(findSection(hit, "typical_applications") ?? "").slice(0, 3);

  const glance_rows: Array<{ label: string; value: string }> = [];
  const nameLower = hit.profile_name.toLowerCase();
  if (nameLower.includes("closed string")) {
    glance_rows.push({ label: "Structure", value: "Closed String" });
  } else if (nameLower.includes("double cut string")) {
    glance_rows.push({ label: "Structure", value: "Double Cut String" });
  } else if (nameLower.includes("cut string")) {
    glance_rows.push({ label: "Structure", value: "Cut String" });
  } else if (nameLower.includes("open riser")) {
    glance_rows.push({ label: "Structure", value: "Open Riser" });
  } else if (nameLower.includes("space saver")) {
    glance_rows.push({ label: "Structure", value: "Space Saver / Alternating Tread" });
  }
  if (nameLower.includes("straight")) {
    glance_rows.push({ label: "Type", value: "Straight Flight" });
  }
  if (materialsBullets.length > 0) {
    glance_rows.push({ label: "Popular materials", value: materialsBullets.join(" · ") });
  }
  if (applicationsBullets.length > 0) {
    glance_rows.push({ label: "Suitable for", value: applicationsBullets.join(" · ") });
  }
  if (spaceReq && spaceReq.length < 200) {
    glance_rows.push({ label: "Space required", value: spaceReq.replace(/[.]+$/, "") });
  }

  const advantages = extractBullets(findSection(hit, "advantages") ?? "");
  const compatible_options = extractBullets(findSection(hit, "compatible_features") ?? "");
  const disadvantagesBullets = extractBullets(findSection(hit, "disadvantages") ?? "");
  const misconceptionsBullets = extractBullets(findSection(hit, "common_misconceptions") ?? "");
  const disadvantages_and_considerations = [...disadvantagesBullets, ...misconceptionsBullets];
  const related_topics = extractBullets(findSection(hit, "related_staircase_types") ?? "");

  const preferredOrder = [
    "definition", "characteristics", "advantages", "disadvantages",
    "typical_applications", "space_requirements", "design_considerations",
    "installation_considerations", "materials_commonly_used", "compatible_features",
    "related_staircase_types", "common_customer_questions", "common_misconceptions",
    "summary", "also_known_as",
  ];
  const all_sections: PresentationSection[] = [];
  for (const type of preferredOrder) {
    const raw = findSection(hit, type);
    if (!raw) continue;
    const bullets = extractBullets(raw);
    const title = type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    all_sections.push({
      title,
      bullets:    bullets.length > 0 ? bullets : [raw],
      truncated:  false,
      full_count: bullets.length,
      atom_type:  type,
    });
  }

  const learn_more_topics: string[] = [];
  if (findSection(hit, "installation_considerations")) learn_more_topics.push("Installation");
  if (findSection(hit, "materials_commonly_used")) learn_more_topics.push("Materials");
  if (findSection(hit, "design_considerations")) learn_more_topics.push("Design options");
  if (findSection(hit, "compatible_features")) learn_more_topics.push("Compatible features and options");
  if (findSection(hit, "common_misconceptions")) learn_more_topics.push("Common misconceptions");

  return {
    subject_name:      hit.profile_name,
    subject_subtitle,
    primary_definition: definitionText,
    fact_bullets,
    glance_rows,
    advantages,
    disadvantages_and_considerations,
    compatible_options,
    related_topics,
    common_questions,
    all_sections,
    learn_more_topics,
    image_url:         null,   // authored specialist images not yet provided
  };
}

/** Compose a type-profile answer as a PresentedAnswer via Teaching Intelligence. */
export function composeTypeProfilePresentation(
  hit: NonNullable<TypeProfileHit>
): PresentedAnswer {
  return composeTeaching(typeProfileToTeaching(hit));
}

/** Compose a type-profile answer as clean progressive-disclosure text.
 *  Wraps composeTypeProfilePresentation with the text renderer. */
export function composeTypeProfileAnswer(hit: NonNullable<TypeProfileHit>): string {
  const presentation = composeTypeProfilePresentation(hit);
  return renderPresentedAnswerAsText(presentation);
}
