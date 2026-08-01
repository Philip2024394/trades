// Authoring parser (Philip 2026-08-01)
// Splits pasted content into snippets · runs auto-checks · classifies risks.
//
// Auto-publish rule (Philip · "goes live · review later"):
//   - Sections with hard-block issues (price / guarantee / structural claim)
//     → status: "blocked" · NOT indexed by Nex
//   - Sections with soft warnings (typo / grammar / passive voice)
//     → status: "unreviewed" · LIVE for customers · flagged for review
//   - Sections that pass everything → status: "unreviewed" · LIVE

import "server-only";

export type SectionIssueSeverity = "block" | "warn" | "info";

export type SectionIssue = {
  code:     string;
  severity: SectionIssueSeverity;
  message:  string;
  hint?:    string;
};

export type ParsedSection = {
  id:              string;        // stable id derived from heading
  order:           number;
  heading:         string;
  body:            string;
  char_count:      number;
  word_count:      number;
  sentence_count:  number;
  issues:          SectionIssue[];
  status:          "unreviewed" | "blocked";  // set by parser · never "approved"
  auto_fix_available: boolean;
};

// Topic type · determines whether content is served to customers or kept
// as internal Philip reference. Philip 2026-08-01 · "leave open · I judge".
export type TopicType =
  | "customer_facing"   // staircase advice · answered to customers via Advisor
  | "business"          // sales · quotes · warranty · delivery · ops · shown to customers with business questions
  | "apprentice"        // internal training · NOT indexed for customer chat
  | "internal_notes";   // Philip's reference · NEVER indexed for customer chat

export type ParseResult = {
  file_slug:       string;
  file_title:      string;
  topic_type:      TopicType;
  sections:        ParsedSection[];
  summary: {
    total:         number;
    live:          number;  // published as unreviewed
    blocked:       number;  // hard-blocked
    warnings:      number;  // soft-warnings (still live)
    clean:         number;
  };
};

// ─── Hard-block patterns (never auto-publish) ─────────────────────

const PRICE_PATTERNS: RegExp[] = [
  /£\s?\d/,                        // £3,500 · £3.50
  /\$\s?\d/,                       // $3,500
  /\d+\s*(pounds|dollars|euros|gbp|usd|eur)\b/i,
  /\bstarts?\s+(from|at)\s+£/i,
  /\b(costs?|priced?\s+at|pricing\s+is)\s+£/i,
  /\bfor\s+£\s?\d/i,
];

const GUARANTEE_PATTERNS: RegExp[] = [
  /\bguarantee[ds]?\s+(to\s+fit|it\s+fits|the\s+fit|installation|compliance)/i,
  /\bwill\s+(definitely|certainly)\s+(fit|pass)/i,
  /\bwarrant(y|ies|ed)\s+(against|for|to)\s+/i,
  /\bmust\s+(pass|comply)\s+(regulations|building\s+control)\b/i,
];

const STRUCTURAL_CLAIM_PATTERNS: RegExp[] = [
  /\bstructural(ly)?\s+(approved|certified|sound|safe|adequate)\b/i,
  /\bload[\s-]?bearing\s+(certified|approved|guaranteed)\b/i,
  /\bmeets?\s+building\s+regulations?\b/i,
  /\bpart\s+k\s+compliant\b/i,
];

// ─── Soft-warning heuristics ──────────────────────────────────────

const COMMON_TYPOS: Record<string, string> = {
  "apperance":       "appearance",
  "occassionally":   "occasionally",
  "recieve":         "receive",
  "seperate":        "separate",
  "definately":      "definitely",
  "occured":         "occurred",
  "durabillity":     "durability",
  "durabilty":       "durability",
  "premiun":         "premium",
  "instalation":     "installation",
  "instaling":       "installing",
  "professionaly":   "professionally",
  "recomend":        "recommend",
  "recomendation":   "recommendation",
  "materia":         "material",
  "acheive":         "achieve",
  "sucessful":       "successful",
  "beleive":         "believe",
  "wich":            "which",
  "priviledge":      "privilege",
  "occurence":       "occurrence",
  "manufacterer":    "manufacturer",
  "manufacter":      "manufacture",
  "furnature":       "furniture",
};

const PASSIVE_VOICE = /\b(is|are|was|were|be|been|being)\s+\w+(ed|en)\b/gi;

// ─── Helpers ──────────────────────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function countSentences(text: string): number {
  return text.split(/[.!?]+\s/).filter((s) => s.trim().length > 0).length;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

// ─── Check runners ────────────────────────────────────────────────

// Note (Philip 2026-08-01): price / guarantee / structural checks are
// FLAGS not blocks. Legitimate content covers business ops, apprentice
// training, price context, etc. Philip judges per section · we surface
// the flag so he can decide.
function checkPriceContent(body: string): SectionIssue | null {
  for (const p of PRICE_PATTERNS) {
    if (p.test(body)) {
      return {
        code:     "contains_price",
        severity: "warn",
        message:  "Contains a price figure · check if this should be shown to customers verbatim",
        hint:     "For customer-facing staircase FAQs · consider rewording. For business/apprentice notes · fine as-is.",
      };
    }
  }
  return null;
}

function checkGuaranteeContent(body: string): SectionIssue | null {
  for (const p of GUARANTEE_PATTERNS) {
    if (p.test(body)) {
      return {
        code:     "contains_guarantee",
        severity: "warn",
        message:  "Contains a guarantee phrase · verify context is appropriate",
        hint:     "For customer-facing content · softer wording usually better. For internal notes · fine.",
      };
    }
  }
  return null;
}

function checkStructuralClaim(body: string): SectionIssue | null {
  for (const p of STRUCTURAL_CLAIM_PATTERNS) {
    if (p.test(body)) {
      return {
        code:     "contains_structural_claim",
        severity: "warn",
        message:  "Contains structural/regulatory language · verify context",
        hint:     "Fine in apprentice or business content · flag for customer FAQ context.",
      };
    }
  }
  return null;
}

function checkTypos(body: string): SectionIssue[] {
  const issues: SectionIssue[] = [];
  const lower = body.toLowerCase();
  for (const [typo, fix] of Object.entries(COMMON_TYPOS)) {
    const pattern = new RegExp(`\\b${typo}\\b`, "i");
    if (pattern.test(lower)) {
      issues.push({
        code:     "typo",
        severity: "warn",
        message:  `Likely typo: "${typo}" → "${fix}"`,
        hint:     "Apply fix or dismiss",
      });
    }
  }
  return issues;
}

function checkPassiveVoice(body: string): SectionIssue | null {
  const matches = body.match(PASSIVE_VOICE);
  if (matches && matches.length >= 2) {
    return {
      code:     "passive_voice",
      severity: "info",
      message:  `${matches.length} passive constructions detected`,
      hint:     "Consider rephrasing in active voice for warmer tone",
    };
  }
  return null;
}

// Length check · too-short is the ONLY hard technical block. Nex physically
// cannot index sections below 60 chars. Everything else is a flag Philip can
// choose to accept or edit.
function checkLength(char_count: number): SectionIssue | null {
  if (char_count < 60) {
    return {
      code:     "too_short",
      severity: "block",
      message:  "Section too short · Nex requires 60+ characters to index",
      hint:     "Expand with 1-2 more sentences of context",
    };
  }
  if (char_count > 2500) {
    return {
      code:     "too_long",
      severity: "warn",
      message:  "Section over 2500 characters · Nex won't index the whole section (only the first part)",
      hint:     "Split into 2-3 focused sub-sections if you want Nex to search the whole thing",
    };
  }
  return null;
}

function checkBulletOnly(body: string): SectionIssue | null {
  const lines = body.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 3) return null;
  const bulletLines = lines.filter((l) => /^\s*[-*•]\s/.test(l)).length;
  if (bulletLines / lines.length >= 0.8) {
    return {
      code:     "bullet_only",
      severity: "info",
      message:  "Section is mostly bullets · reads robotic when spoken",
      hint:     "Add an intro sentence and a summary sentence to bookend the bullets",
    };
  }
  return null;
}

// ─── Splitter ─────────────────────────────────────────────────────

function stripFrontmatter(raw: string): string {
  if (!raw.startsWith("---")) return raw;
  const closeIdx = raw.indexOf("\n---", 3);
  if (closeIdx <= 0) return raw;
  return raw.slice(closeIdx + 4).replace(/^\r?\n/, "");
}

function extractFileTitle(raw: string, fallback: string): string {
  const body = stripFrontmatter(raw);
  for (const line of body.split("\n")) {
    if (line.trim() === "") continue;
    const h1 = line.match(/^#\s+(.+?)\s*$/);
    if (h1) return h1[1].trim();
    break;
  }
  return fallback;
}

function splitIntoSections(raw: string): { heading: string; body: string }[] {
  const body = stripFrontmatter(raw);
  const lines = body.split("\n");
  const sections: { heading: string; body: string }[] = [];
  let currentHeading = "";
  let currentBody: string[] = [];
  let hasH1 = false;

  const commit = () => {
    const bodyText = currentBody.join("\n").trim();
    if (currentHeading && bodyText.length > 0) {
      sections.push({ heading: currentHeading, body: bodyText });
    } else if (!currentHeading && bodyText.length > 60 && !hasH1) {
      sections.push({ heading: "Introduction", body: bodyText });
    }
  };

  for (const line of lines) {
    const h1 = line.match(/^#\s+(.+?)\s*$/);
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h1) {
      hasH1 = true;
      commit();
      currentHeading = "";
      currentBody = [];
      continue;
    }
    if (h2) {
      commit();
      currentHeading = h2[1].trim();
      currentBody = [];
      continue;
    }
    if (line.trim() === "---") continue;
    currentBody.push(line);
  }
  commit();

  return sections;
}

// ─── Main entry ───────────────────────────────────────────────────

export function parseContent(topicName: string, raw: string, topicType: TopicType = "customer_facing"): ParseResult {
  const fileTitle = extractFileTitle(raw, topicName);
  const fileSlug = slugify(topicName);
  const rawSections = splitIntoSections(raw);

  const sections: ParsedSection[] = rawSections.map((s, i) => {
    const issues: SectionIssue[] = [];

    // Hard-block checks (fire first · determine status)
    const price = checkPriceContent(s.body);
    if (price) issues.push(price);
    const guarantee = checkGuaranteeContent(s.body);
    if (guarantee) issues.push(guarantee);
    const structural = checkStructuralClaim(s.body);
    if (structural) issues.push(structural);
    const length = checkLength(s.body.length);
    if (length) issues.push(length);

    // Soft-warning checks
    issues.push(...checkTypos(s.body));
    const passive = checkPassiveVoice(s.body);
    if (passive) issues.push(passive);
    const bullet = checkBulletOnly(s.body);
    if (bullet) issues.push(bullet);

    const hasBlock = issues.some((it) => it.severity === "block");
    const hasFixableTypo = issues.some((it) => it.code === "typo");

    return {
      id:                 slugify(s.heading) || `section-${i}`,
      order:              i,
      heading:            s.heading,
      body:               s.body,
      char_count:         s.body.length,
      word_count:         countWords(s.body),
      sentence_count:     countSentences(s.body),
      issues,
      status:             hasBlock ? "blocked" : "unreviewed",
      auto_fix_available: hasFixableTypo,
    };
  });

  const summary = {
    total:    sections.length,
    live:     sections.filter((s) => s.status === "unreviewed").length,
    blocked:  sections.filter((s) => s.status === "blocked").length,
    warnings: sections.filter((s) => s.issues.some((i) => i.severity === "warn")).length,
    clean:    sections.filter((s) => s.issues.length === 0).length,
  };

  return {
    file_slug: `nex-knowledge-base-${fileSlug}`,
    file_title: fileTitle,
    topic_type: topicType,
    sections,
    summary,
  };
}

// ─── Auto-fix ─────────────────────────────────────────────────────

/** Apply all fixable auto-fixes to a section body · returns updated text. */
export function applyAutoFixes(body: string): string {
  let out = body;
  for (const [typo, fix] of Object.entries(COMMON_TYPOS)) {
    // preserve capitalization if word starts uppercase
    const upperPattern = new RegExp(`\\b${typo.charAt(0).toUpperCase() + typo.slice(1)}\\b`, "g");
    out = out.replace(upperPattern, fix.charAt(0).toUpperCase() + fix.slice(1));
    const lowerPattern = new RegExp(`\\b${typo}\\b`, "gi");
    out = out.replace(lowerPattern, fix);
  }
  return out;
}
