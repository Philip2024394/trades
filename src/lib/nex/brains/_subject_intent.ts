// Subject-Intent knowledge routing (Philip 2026-07-30 architectural correction).
//
// Replaces keyword-overlap-with-minimum-score retrieval with:
//   1. What is the human asking ABOUT? (subject)
//   2. What is the human TRYING TO DO? (intent)
//   3. Do I have authored knowledge on that subject?
//   4. If yes, serve it. Compose. Constitutional check.
//
// Rule A: subjects and vocab are derived ONLY from Philip's authored content
//   (Terminology canonicals + aliases + module `keywords[]` extracted from TERMS
//   sections). Never invented.
// Rule B: no trade content authored here. Composition assembles Philip's atoms.
// Rule C: every served atom carries `source_ref` back to the Layer 2 draft.
//
// This runs AFTER boundary intent (constitutional refusal wins first) and
// AFTER Terminology direct-serve (canonical whole-word definition wins), and
// BEFORE the older keyword-score module retrieval (kept as safety net).

import "server-only";
import { loadTerminologyModule } from "./_terminology_serve";
import { loadModule, MODULE_SLUGS, type ModuleSlug, type ModuleAtom } from "./_module_serve";
import { composeTeaching, type TeachingInput, type PresentedAnswer, type PresentationSection } from "./_presentation";

export type Intent =
  | "definition"     // "what is a rise" · single-concept definition
  | "discovery"      // "what staircases are available" · list what exists
  | "comparison"     // "oak vs pine" · contrast two things
  | "cause"          // "why does timber move" · explanatory
  | "howto"          // "how do I paint my staircase" · procedural
  | "general";       // fallback · "tell me about oak"

export type SubjectHit = {
  subject: string;
  in_modules: ModuleSlug[];
  in_terminology: boolean;
};

export type SubjectAtom = {
  atom: ModuleAtom;
  module_slug: ModuleSlug | "terminology";
  module_title: string;
};

export type SubjectIntentResponse = {
  subject: string;
  intent: Intent;
  atoms: SubjectAtom[];
  answer: string;
  modules_covered: string[];
};

// ─── Vocabulary ──────────────────────────────────────────────

type Vocab = Map<string, { modules: Set<ModuleSlug>; in_terminology: boolean }>;

function addToVocab(vocab: Vocab, term: string, slug: ModuleSlug | null, in_terminology: boolean): void {
  const key = term.toLowerCase().trim();
  if (key.length < 3 || key.length > 40) return;
  const existing = vocab.get(key) ?? { modules: new Set<ModuleSlug>(), in_terminology: false };
  if (slug) existing.modules.add(slug);
  if (in_terminology) existing.in_terminology = true;
  vocab.set(key, existing);
}

// Stopwords for topic-term derivation · common function words + Q-shape words
// that carry no subject meaning. Rule B: this list is *implementation detail*,
// not authored content. It only removes noise · never adds subjects.
const TOPIC_STOPWORDS = new Set([
  "the","and","for","with","that","this","from","have","has","had","are","was","were","been","being",
  "will","would","could","should","may","might","must","shall","its","their","there","then","than","when",
  "which","what","who","how","why","not","but","can","cannot","just","only","also","more","less","most","many","much",
  "one","two","three","four","five","some","any","all","every","each","other","another","same",
  "you","your","they","them","him","her","his","its","our","ours","this","these","those","those",
  "not","yes","don","doesnt","don't","doesn't","isn't","isnt","aren't","arent",
  "tell","show","give","need","want","get","take","make","use","see","know","help","please","try","ask",
  "very","really","quite","too","also","just","still","yet","again","always","never","often","sometimes",
  "example","note","see","above","below","first","second","third","step",
  "type","types","kind","kinds","form","forms","term","terms",
  "everything","anything","something","nothing","everyone","anyone","someone","nobody",
  "myself","yourself","himself","herself","itself","themselves","ourselves",
  "here","there","everywhere","somewhere","anywhere","nowhere","where","around",
  "back","away","along","across","through","before","after","during","while",
  "keep","kept","hold","held","put","let","made","gets","goes","went","come","came",
  "small","large","short","long","big","little","new","old","good","bad","best","worst",
  "before","after","during","today","tomorrow","yesterday","now","later","soon",
]);

/** Derive topic terms from atom text · Rule B compliant (vocab derived
 *  from Philip's authored content, not invented). Words appearing in
 *  ≥ 3 atoms of a module become subjects for that module. */
function deriveTopicTerms(atoms: ReadonlyArray<{ text: string }>): Set<string> {
  const counts = new Map<string, number>();
  for (const atom of atoms) {
    const tokens = atom.text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length >= 3 && w.length <= 30 && !TOPIC_STOPWORDS.has(w) && !/^\d+$/.test(w));
    const seen = new Set<string>();
    for (const t of tokens) {
      if (seen.has(t)) continue;
      seen.add(t);
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  const topics = new Set<string>();
  for (const [word, count] of counts.entries()) {
    if (count >= 3) topics.add(word);
  }
  return topics;
}

/** Build subject vocabulary from Philip's authored content:
 *  - Terminology 11 canonicals + all aliases
 *  - Each module's `keywords[]` (extracted from TERMS sections)
 *  - Each module's TOPIC TERMS derived from atom text (words appearing ≥3
 *    atoms — captures domain vocabulary like "staircase", "oak", "timber",
 *    "handrail" that aren't in TERMS lists but saturate the authored atoms).
 *  Never invents subjects. */
async function loadSubjectVocabulary(brain_slug: string): Promise<Vocab> {
  const vocab: Vocab = new Map();
  const term = await loadTerminologyModule(brain_slug);
  if (term) {
    for (const t of term.terms) {
      addToVocab(vocab, t.term, null, true);
      for (const alias of t.aliases) addToVocab(vocab, alias, null, true);
    }
  }
  for (const slug of MODULE_SLUGS) {
    const m = await loadModule(brain_slug, slug);
    if (!m) continue;
    for (const kw of m.keywords) addToVocab(vocab, kw, slug, false);
    // Topic terms derived from authored atoms
    for (const topic of deriveTopicTerms(m.atoms)) {
      addToVocab(vocab, topic, slug, false);
    }
  }
  return vocab;
}

// ─── Matching with simple plural handling ────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function subjectForms(subject: string): string[] {
  const forms = new Set<string>();
  forms.add(subject);
  if (!subject.endsWith("s")) forms.add(subject + "s");
  if (subject.endsWith("s") && subject.length > 3) forms.add(subject.slice(0, -1));
  if (subject.endsWith("y") && subject.length > 3) forms.add(subject.slice(0, -1) + "ies");
  return Array.from(forms);
}

function subjectMatches(haystack: string, subject: string): boolean {
  const h = haystack.toLowerCase();
  for (const f of subjectForms(subject)) {
    const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(f)}([^a-z0-9]|$)`, "i");
    if (re.test(h)) return true;
  }
  return false;
}

// ─── Subject detection ──────────────────────────────────────

export async function detectSubjects(brain_slug: string, query: string): Promise<SubjectHit[]> {
  const vocab = await loadSubjectVocabulary(brain_slug);
  const hits: SubjectHit[] = [];
  for (const [subject, info] of vocab.entries()) {
    if (subjectMatches(query, subject)) {
      hits.push({
        subject,
        in_modules: Array.from(info.modules),
        in_terminology: info.in_terminology,
      });
    }
  }
  // Prefer longer (more specific) subjects · then wider module coverage
  return hits.sort((a, b) => b.subject.length - a.subject.length || b.in_modules.length - a.in_modules.length);
}

// ─── Intent detection ────────────────────────────────────────

export function detectIntent(query: string): Intent {
  const q = query.toLowerCase().trim();
  // Definition question shape · "what is a rise" · but NOT "what is available"
  if (/^what\s+is\s+(a|an|the)?\s*[a-z]+/i.test(q) && !/(available|there|exist|any\b)/i.test(q)) return "definition";
  // Discovery · asking what exists / list
  if (/\b(what|which|available|tell\s+me|show\s+me|list|are\s+there|exist|any\b)\b/i.test(q)) return "discovery";
  // Comparison
  if (/\b(vs|versus|difference\s+between|compare|comparison|between\s+\w+\s+and)\b/i.test(q)) return "comparison";
  // Cause
  if (/\b(why|what\s+causes|how\s+come|reason)\b/i.test(q)) return "cause";
  // How-to
  if (/\bhow\s+(do|does|to|can|should)\b/i.test(q)) return "howto";
  return "general";
}

// ─── Retrieval ──────────────────────────────────────────────

export async function findAtomsForSubject(
  brain_slug: string,
  subject: string,
  modules: Set<ModuleSlug>,
  limit = 6
): Promise<SubjectAtom[]> {
  const results: SubjectAtom[] = [];
  for (const slug of modules) {
    const m = await loadModule(brain_slug, slug);
    if (!m) continue;
    for (const atom of m.atoms) {
      if (subjectMatches(atom.text, subject)) {
        results.push({ atom, module_slug: slug, module_title: m.header.title });
      }
    }
  }
  // Deterministic ordering · prefer atoms whose section title also mentions the subject,
  // then keep insertion order (which reflects source order in the draft).
  results.sort((a, b) => {
    const aInSection = a.atom.section ? (subjectMatches(a.atom.section, subject) ? 1 : 0) : 0;
    const bInSection = b.atom.section ? (subjectMatches(b.atom.section, subject) ? 1 : 0) : 0;
    return bInSection - aInSection;
  });
  return results.slice(0, limit);
}

// ─── Composition ────────────────────────────────────────────

export function composeSubjectAnswer(subject: string, intent: Intent, atoms: SubjectAtom[]): string {
  if (atoms.length === 0) return "";

  const byModule = new Map<string, SubjectAtom[]>();
  for (const a of atoms) {
    const list = byModule.get(a.module_title) ?? [];
    list.push(a);
    byModule.set(a.module_title, list);
  }

  const sections: string[] = [];
  for (const [title, list] of byModule.entries()) {
    const bullets = list.map(a =>
      `- ${a.atom.text}${a.atom.type ? ` *(${a.atom.type})*` : ""}`
    );
    sections.push(`**${title}:**\n${bullets.join("\n")}`);
  }

  let intro: string;
  switch (intent) {
    case "discovery":
      intro = `About **${subject}**, NEX has the following authored knowledge:\n\n`;
      break;
    case "definition":
      intro = "";
      break;
    case "comparison":
      intro = `On **${subject}**:\n\n`;
      break;
    case "cause":
      intro = `On why **${subject}** behaves the way it does:\n\n`;
      break;
    case "howto":
      intro = `Regarding **${subject}**:\n\n`;
      break;
    default:
      intro = `About **${subject}**:\n\n`;
  }

  return intro + sections.join("\n\n");
}

// ─── Top-level entry ────────────────────────────────────────

/** Attempt to answer a query by (subjects, intent, authored knowledge).
 *
 *  PHASE 2 CONSTITUTIONAL RULE (Philip 2026-07-30):
 *  Modules must never compete to win a question. When multiple modules
 *  possess relevant knowledge they should contribute to a single composed
 *  answer. Knowledge completeness is preferred over module priority.
 *
 *  This function iterates through EVERY detected subject and gathers atoms
 *  from EVERY module that mentions any of them, dedupes, and composes a
 *  single answer that groups contributions by module. No "best subject wins."
 *  No "best module wins." Every relevant authored atom contributes.
 *
 *  Rule A safe: only serves Philip's atoms. Returns null only when no
 *  authored subject is detected or no atoms mention any detected subject. */
export async function respondBySubject(brain_slug: string, query: string): Promise<SubjectIntentResponse | null> {
  const subjects = await detectSubjects(brain_slug, query);
  if (subjects.length === 0) return null;

  const intent = detectIntent(query);

  // Gather atoms from EVERY detected subject across EVERY module that
  // mentions it. Dedupe by atom text (Rule NEW: no silent duplication).
  const atomMap = new Map<string, SubjectAtom>();
  const subjectsServed: string[] = [];
  const perAtomLimit = 4;
  const totalCap = 12;

  for (const s of subjects) {
    if (atomMap.size >= totalCap) break;
    const moduleSet = new Set<ModuleSlug>(s.in_modules);
    if (s.in_terminology) {
      for (const slug of MODULE_SLUGS) moduleSet.add(slug);
    }
    if (moduleSet.size === 0) continue;

    const atoms = await findAtomsForSubject(brain_slug, s.subject, moduleSet, perAtomLimit);
    if (atoms.length === 0) continue;

    subjectsServed.push(s.subject);
    for (const a of atoms) {
      const key = a.atom.text;
      if (!atomMap.has(key)) atomMap.set(key, a);
      if (atomMap.size >= totalCap) break;
    }
  }

  if (atomMap.size === 0) return null;

  const combinedAtoms = Array.from(atomMap.values());
  const primarySubject = subjectsServed.join(" + ");
  const answer = composeMultiSubjectAnswer(subjectsServed, intent, combinedAtoms);
  const modules_covered = Array.from(new Set(combinedAtoms.map(a => a.module_title)));

  return { subject: primarySubject, intent, atoms: combinedAtoms, answer, modules_covered };
}

/** Adapt a subject-intent response into TeachingInput. Teaching Intelligence
 *  takes it from there. Groups atoms by knowledge type · Rule B compliant. */
export function subjectIntentToTeaching(response: SubjectIntentResponse): TeachingInput {
  const atoms = response.atoms;
  const isType = (t: string | null | undefined, ...targets: string[]) =>
    t !== null && t !== undefined && targets.some(s => t === s || t.startsWith(s));

  const factualAtoms  = atoms.filter(a => isType(a.atom.type, "factual", "classification"));
  const expertAtoms   = atoms.filter(a => isType(a.atom.type, "expert perspective"));
  const warningAtoms  = atoms.filter(a => isType(a.atom.type, "warning"));
  const directiveAtoms = atoms.filter(a => isType(a.atom.type, "directive"));
  const perceptionAtoms = atoms.filter(a => isType(a.atom.type, "customer perception"));
  const processAtoms  = atoms.filter(a => isType(a.atom.type, "process"));

  const primary_definition = (factualAtoms[0] ?? atoms[0])?.atom.text ?? "";
  const fact_bullets = factualAtoms.slice(0, 8).map(a => a.atom.text);
  const advantages = expertAtoms.slice(0, 6).map(a => a.atom.text);
  const disadvantages_and_considerations = [
    ...warningAtoms.map(a => a.atom.text),
    ...directiveAtoms.map(a => a.atom.text),
  ];

  // Group atoms by module for master detail
  const byModule = new Map<string, typeof atoms>();
  for (const a of atoms) {
    const list = byModule.get(a.module_title) ?? [];
    list.push(a);
    byModule.set(a.module_title, list);
  }
  const all_sections: PresentationSection[] = [];
  for (const [moduleTitle, moduleAtoms] of byModule.entries()) {
    all_sections.push({
      title:      moduleTitle,
      bullets:    moduleAtoms.map(a => a.atom.text),
      truncated:  false,
      full_count: moduleAtoms.length,
      atom_type:  "multi_module",
    });
  }

  const primarySubjectName = response.subject.split(" + ")[0] ?? response.subject;
  const titleCased = primarySubjectName
    .split(/\s+/)
    .map(w => w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)
    .join(" ");
  return {
    subject_name:                     titleCased,
    subject_subtitle:                 response.subject.includes(" + ") ? response.subject : null,
    primary_definition,
    fact_bullets,
    glance_rows:                      [],
    advantages,
    disadvantages_and_considerations,
    compatible_options:               [],
    related_topics:                   perceptionAtoms.slice(0, 3).map(a => a.atom.text),
    common_questions:                 [],
    all_sections,
    learn_more_topics:                response.modules_covered,
    image_url:                        null,
  };
}

/** Compose a subject-intent response as a PresentedAnswer via Teaching Intelligence. */
export function composeSubjectIntentPresentation(response: SubjectIntentResponse): PresentedAnswer {
  return composeTeaching(subjectIntentToTeaching(response));
}

/** Compose a single answer from multiple subjects across multiple modules.
 *  Groups atoms by module title (each module contributes its own section).
 *  Never competes · every module that has authored knowledge on any detected
 *  subject contributes to the single answer. */
export function composeMultiSubjectAnswer(subjects: string[], intent: Intent, atoms: SubjectAtom[]): string {
  if (atoms.length === 0) return "";

  const byModule = new Map<string, SubjectAtom[]>();
  for (const a of atoms) {
    const list = byModule.get(a.module_title) ?? [];
    list.push(a);
    byModule.set(a.module_title, list);
  }

  const sections: string[] = [];
  for (const [title, list] of byModule.entries()) {
    const bullets = list.map(a =>
      `- ${a.atom.text}${a.atom.type ? ` *(${a.atom.type})*` : ""}`
    );
    sections.push(`**${title}:**\n${bullets.join("\n")}`);
  }

  const subjectLabel = subjects.length === 1 ? `**${subjects[0]}**` : `**${subjects.join(" + ")}**`;
  let intro: string;
  switch (intent) {
    case "discovery":
      intro = `About ${subjectLabel}, NEX has the following authored knowledge across ${byModule.size} module${byModule.size === 1 ? "" : "s"}:\n\n`;
      break;
    case "definition":
      intro = "";
      break;
    case "comparison":
      intro = `On ${subjectLabel}:\n\n`;
      break;
    case "cause":
      intro = `On why ${subjectLabel} behaves the way it does:\n\n`;
      break;
    case "howto":
      intro = `Regarding ${subjectLabel}:\n\n`;
      break;
    default:
      intro = `About ${subjectLabel}:\n\n`;
  }

  return intro + sections.join("\n\n");
}
