// Presentation layer · 4 answer levels + progressive disclosure (Philip 2026-07-31).
//
// Constitutional principles enforced:
//   1. One section = one purpose
//   2. No section larger than 5 bullet points unless expanded (truncated=true flag)
//   3. Every staircase specialist should have an image (Rule B authoring · optional runtime · Reading A)
//   4. NEX teaches before she explains (Level 1 = hero + 30-sec overview · Level 2 = quick facts · etc.)
//
// The 80/30 rule: user should understand 80% from the image + first 30 seconds of reading.
//
// This module does NOT invent knowledge. It only reorganises atoms Philip authored
// into a progressive-disclosure shape the client can render.

import "server-only";

const MAX_BULLETS_PER_SECTION = 5;

export type PresentationSection = {
  title:      string;      // human-readable title · "Quick Facts", "Why customers choose it", etc.
  bullets:    string[];    // authored bullets · Rule B compliant
  truncated:  boolean;     // true if more bullets exist beyond MAX_BULLETS_PER_SECTION
  full_count: number;      // total bullets available (for "see more" UI)
  atom_type:  string | null; // source atom type · for client-side grouping
};

// Time-based level names (Philip 2026-07-31 · Teaching Intelligence renaming).
// Humans learn in stages · these names describe HOW LONG they want to spend, not
// abstract levels. The `one_sentence` level (was implicit Level 0) is now first-class.

export type OneSentenceLevel = {
  /** The single-sentence answer to "what is X?" · null if not composable in one sentence. */
  sentence: string | null;
};

export type ThirtySecondsLevel = {
  title:       string;   // e.g. "Straight Staircase (Closed String)"
  subtitle:    string | null;   // e.g. "Traditional concealed string construction"
  overview:    string;   // 30-second overview · one paragraph
  image_url:   string | null;   // hero image · null when specialist has no authored image
};

export type TwoMinutesLevel = {
  quick_facts:        PresentationSection | null;
  at_a_glance:        Array<{ label: string; value: string }> | null;
  common_questions:   PresentationSection | null;
};

export type TenMinutesLevel = {
  why_choose:         PresentationSection | null;
  common_options:     PresentationSection | null;
  things_to_consider: PresentationSection | null;
  related_knowledge:  PresentationSection | null;
};

export type MasterLevel = {
  // Every section including the ones summarised in shorter levels, at full length
  all_sections: PresentationSection[];
};

export type PresentedAnswer = {
  one_sentence:   OneSentenceLevel;
  thirty_seconds: ThirtySecondsLevel;
  two_minutes:    TwoMinutesLevel;
  ten_minutes:    TenMinutesLevel;
  master:         MasterLevel;
  learn_more:     string[];   // topics user can drill into
};

// ─── Bullet extraction ────────────────────────────────────────

/** Extract bullet points from an atom text. Handles both "* item" and "- item"
 *  markdown lists as well as newline-separated lines. */
export function extractBullets(text: string): string[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const bullets: string[] = [];
  for (const line of lines) {
    // Skip section headers (already handled by the containing atom)
    if (/^#/.test(line)) continue;
    // Bullet forms: "* text" "- text" "• text"
    const bulletMatch = line.match(/^[*\-•]\s+(.+)$/);
    if (bulletMatch) {
      bullets.push(bulletMatch[1].trim().replace(/[.]+$/, "."));
      continue;
    }
    // Numbered list "1. text"
    const numMatch = line.match(/^\d+\.\s+(.+)$/);
    if (numMatch) {
      bullets.push(numMatch[1].trim().replace(/[.]+$/, "."));
      continue;
    }
  }
  // If nothing was extracted as bullets, fall back to sentence-splitting the whole text
  if (bullets.length === 0) {
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 5);
    return sentences.slice(0, MAX_BULLETS_PER_SECTION);
  }
  return bullets;
}

/** Truncate a bullet list to MAX_BULLETS_PER_SECTION · flag truncation. */
export function truncateSection(
  title:     string,
  bullets:   string[],
  atom_type: string | null = null
): PresentationSection | null {
  if (bullets.length === 0) return null;
  return {
    title,
    bullets:    bullets.slice(0, MAX_BULLETS_PER_SECTION),
    truncated:  bullets.length > MAX_BULLETS_PER_SECTION,
    full_count: bullets.length,
    atom_type,
  };
}

// ─── Progressive-disclosure text renderer ──────────────────────

// ─── Teaching Intelligence · generic composition (Philip 2026-07-31) ─
//
// "Teaching Intelligence knows nothing. It only knows how to teach."
//
// composeTeaching takes normalised TeachingInput from ANY retrieval source
// (Terminology · type-profile · module-serve · subject-intent) and produces
// the same 5-level PresentedAnswer shape. Each source contributes an adapter
// that shapes its atoms into TeachingInput · Teaching Intelligence takes it
// from there.

export type TeachingInput = {
  /** What the user was asking about (title of the answer). */
  subject_name:                      string;
  /** Concise descriptor · e.g. an alias or short qualifier. */
  subject_subtitle:                  string | null;
  /** The definitional text · used for one-sentence and thirty-second overview. */
  primary_definition:                string;
  /** Factual bullets for the quick-facts section. */
  fact_bullets:                      string[];
  /** Structured "at a glance" rows · e.g. {Structure: Closed String, Popular materials: Oak · Pine}. */
  glance_rows:                       Array<{ label: string; value: string }>;
  /** Positive/why-choose bullets. */
  advantages:                        string[];
  /** Warnings, considerations, misconceptions. */
  disadvantages_and_considerations:  string[];
  /** Options / compatible features. */
  compatible_options:                string[];
  /** Related specialists / topics for cross-reference. */
  related_topics:                    string[];
  /** Common questions users ask about this subject. */
  common_questions:                  string[];
  /** All authored sections at full detail (master level). */
  all_sections:                      PresentationSection[];
  /** Drill-down topics for the "would you like to know more" prompt. */
  learn_more_topics:                 string[];
  /** Hero image URL · null when no authored image exists. */
  image_url:                         string | null;
};

/** Generic Teaching Intelligence composer. Takes TeachingInput from any
 *  retrieval source · produces a 5-level PresentedAnswer. Never invents
 *  content · only reorganises what the adapter provided. */
export function composeTeaching(input: TeachingInput): PresentedAnswer {
  return {
    one_sentence: {
      sentence: firstSentence(input.primary_definition),
    },
    thirty_seconds: {
      title:     input.subject_name,
      subtitle:  input.subject_subtitle,
      overview:  input.primary_definition,
      image_url: input.image_url,
    },
    two_minutes: {
      quick_facts:      truncateSection("Quick facts", input.fact_bullets),
      at_a_glance:      input.glance_rows.length > 0 ? input.glance_rows : null,
      common_questions: truncateSection("Common questions", input.common_questions),
    },
    ten_minutes: {
      why_choose:         truncateSection("Why customers choose it", input.advantages),
      common_options:     truncateSection("Common options", input.compatible_options),
      things_to_consider: truncateSection("Things to consider", input.disadvantages_and_considerations),
      related_knowledge:  truncateSection("Related knowledge", input.related_topics),
    },
    master: {
      all_sections: input.all_sections,
    },
    learn_more: input.learn_more_topics,
  };
}

/** Extract the first complete sentence from a longer text · for the one-sentence
 *  level. Rule A safe: uses only the authored content · never invents. */
export function firstSentence(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^([^.!?]+[.!?])/);
  if (match) return match[1].trim();
  return trimmed;
}

/** Render a PresentedAnswer as clean progressive-disclosure markdown.
 *  Follows the constitutional progression · start with one sentence · then thirty
 *  seconds · then invitation to go deeper. Never dumps ten-minute or master content
 *  unless the caller renders those levels specifically.
 *
 *  Clients that can render structured presentation should use the PresentedAnswer
 *  directly. Clients that only render text (legacy chat surfaces) get this. */
export function renderPresentedAnswerAsText(p: PresentedAnswer): string {
  const parts: string[] = [];

  // One-sentence lead (if available and different from overview)
  if (p.one_sentence.sentence && p.one_sentence.sentence !== p.thirty_seconds.overview.trim()) {
    parts.push(`**${p.one_sentence.sentence}**\n`);
  }

  // Thirty seconds · hero + overview
  parts.push(`# ${p.thirty_seconds.title}`);
  if (p.thirty_seconds.subtitle) parts.push(`*${p.thirty_seconds.subtitle}*`);
  if (p.thirty_seconds.image_url) parts.push(`![${p.thirty_seconds.title}](${p.thirty_seconds.image_url})`);
  parts.push(p.thirty_seconds.overview);

  // Two minutes · quick facts + at-a-glance + common questions
  if (p.two_minutes.quick_facts) {
    parts.push(`\n## ${p.two_minutes.quick_facts.title}`);
    for (const b of p.two_minutes.quick_facts.bullets) parts.push(`- ${b}`);
    if (p.two_minutes.quick_facts.truncated) parts.push(`_...and ${p.two_minutes.quick_facts.full_count - p.two_minutes.quick_facts.bullets.length} more · ask for the full list._`);
  }
  if (p.two_minutes.at_a_glance && p.two_minutes.at_a_glance.length > 0) {
    parts.push(`\n## At a glance`);
    for (const item of p.two_minutes.at_a_glance) {
      parts.push(`- **${item.label}:** ${item.value}`);
    }
  }
  if (p.two_minutes.common_questions) {
    parts.push(`\n## ${p.two_minutes.common_questions.title}`);
    for (const b of p.two_minutes.common_questions.bullets) parts.push(`- ${b}`);
    if (p.two_minutes.common_questions.truncated) parts.push(`_...and ${p.two_minutes.common_questions.full_count - p.two_minutes.common_questions.bullets.length} more._`);
  }

  // Learn-more prompt · encourages drill-down · NEX stops talking
  if (p.learn_more.length > 0) {
    parts.push(`\n## Would you like to know more about`);
    for (const topic of p.learn_more) parts.push(`- ${topic}`);
  }

  return parts.join("\n").trim();
}
