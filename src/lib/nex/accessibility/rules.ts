// src/lib/nex/accessibility/rules.ts
//
// Founder Phase 23 · P23-1 · WCAG 2.1 lightweight rule engine.
//
// Scope · high-confidence rules that can be checked from HTML alone
// (no browser render · no CSS resolution). Deliberately narrow so we
// never flag a false positive · every violation traces to a hard rule.
//
// Discipline mirrors the Truth Engine · rules that require CSS layout
// (contrast, focus visibility, motion) are NOT included · they're
// listed as "cannot_check_from_html" for honest scope-reporting.

export type Severity = "critical" | "serious" | "moderate" | "minor";

export interface WcagViolation {
  rule_id: string;
  criterion: string;                 // e.g. "1.1.1"
  severity: Severity;
  snippet: string;                   // ~120 chars showing the offending element
  message: string;                   // human-readable
  suggestion: string;
}

export interface AuditReport {
  path: string;
  status: number;
  bytes: number;
  score: number;                     // 0..100 · 100 = clean · penalties by severity
  violations: WcagViolation[];
  cannot_check_from_html: string[];  // honest scope disclosure
  checked_rules: string[];
  ms: number;
}

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function stripComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, "");
}

function findAll(html: string, tagRe: RegExp): RegExpExecArray[] {
  const out: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html)) !== null) {
    out.push(m);
    if (m.index === tagRe.lastIndex) tagRe.lastIndex += 1;
  }
  return out;
}

function hasAttr(tag: string, attr: string): boolean {
  return new RegExp(`\\s${attr}(=|\\s|$|/>|>)`, "i").test(tag);
}

function attrValue(tag: string, attr: string): string | null {
  const m = new RegExp(`\\s${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3] ?? null) : null;
}

function textContent(html: string, tagRe: RegExp): string {
  const m = tagRe.exec(html);
  if (!m) return "";
  return m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

const SEVERITY_PENALTY: Record<Severity, number> = {
  critical: 25,
  serious: 12,
  moderate: 6,
  minor: 3,
};

// ═══════════════════════════════════════════════════════════════════
// Individual rules
// ═══════════════════════════════════════════════════════════════════

type Rule = { id: string; run: (html: string) => WcagViolation[] };

const R_HTML_LANG: Rule = {
  id: "html-has-lang",
  run: (html) => {
    const m = /<html\b[^>]*>/i.exec(html);
    if (!m) return [];
    if (hasAttr(m[0], "lang")) return [];
    return [{
      rule_id: "html-has-lang",
      criterion: "3.1.1",
      severity: "serious",
      snippet: m[0].slice(0, 120),
      message: "<html> is missing a lang attribute · screen readers won't announce the correct language.",
      suggestion: "Add lang=\"en\" (or the appropriate BCP-47 code) to <html>.",
    }];
  },
};

const R_TITLE: Rule = {
  id: "document-has-title",
  run: (html) => {
    const t = textContent(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    if (t.length > 0) return [];
    return [{
      rule_id: "document-has-title",
      criterion: "2.4.2",
      severity: "serious",
      snippet: "<title></title> (empty or missing)",
      message: "Document title is empty or missing.",
      suggestion: "Add a descriptive <title> element inside <head>.",
    }];
  },
};

const R_VIEWPORT: Rule = {
  id: "meta-viewport",
  run: (html) => {
    const has = /<meta\b[^>]*name\s*=\s*["']?viewport["']?[^>]*>/i.test(html);
    if (has) return [];
    return [{
      rule_id: "meta-viewport",
      criterion: "1.4.10",
      severity: "moderate",
      snippet: "(no <meta name=\"viewport\">)",
      message: "Missing viewport meta · mobile zoom + reflow will misbehave.",
      suggestion: "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> in <head>.",
    }];
  },
};

const R_IMG_ALT: Rule = {
  id: "img-has-alt",
  run: (html) => {
    const violations: WcagViolation[] = [];
    for (const m of findAll(html, /<img\b[^>]*>/gi)) {
      if (!hasAttr(m[0], "alt")) {
        violations.push({
          rule_id: "img-has-alt",
          criterion: "1.1.1",
          severity: "critical",
          snippet: m[0].slice(0, 120),
          message: "<img> missing alt attribute · screen readers cannot describe it.",
          suggestion: "Add alt=\"…\" (or alt=\"\" if purely decorative).",
        });
      }
    }
    return violations;
  },
};

const R_LINK_ACCESSIBLE_NAME: Rule = {
  id: "link-has-accessible-name",
  run: (html) => {
    const violations: WcagViolation[] = [];
    // Match <a ...>...</a> non-greedy
    for (const m of findAll(stripComments(html), /<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
      const openTag = `<a${m[1]}>`;
      const inner = m[2] ?? "";
      const innerText = inner.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      const ariaLabel = attrValue(openTag, "aria-label");
      const title = attrValue(openTag, "title");
      const hasImgAlt = /<img\b[^>]*\balt\s*=\s*"[^"]*[^"\s]/i.test(inner);
      if (innerText.length === 0 && !ariaLabel && !title && !hasImgAlt) {
        violations.push({
          rule_id: "link-has-accessible-name",
          criterion: "2.4.4",
          severity: "serious",
          snippet: openTag.slice(0, 120),
          message: "<a> has no accessible name · screen readers announce \"link\" with no context.",
          suggestion: "Add link text, or aria-label=\"…\", or a labelled child image.",
        });
      }
    }
    return violations;
  },
};

const R_BUTTON_ACCESSIBLE_NAME: Rule = {
  id: "button-has-accessible-name",
  run: (html) => {
    const violations: WcagViolation[] = [];
    for (const m of findAll(stripComments(html), /<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
      const openTag = `<button${m[1]}>`;
      const inner = m[2] ?? "";
      const innerText = inner.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      const ariaLabel = attrValue(openTag, "aria-label");
      const title = attrValue(openTag, "title");
      if (innerText.length === 0 && !ariaLabel && !title) {
        violations.push({
          rule_id: "button-has-accessible-name",
          criterion: "4.1.2",
          severity: "serious",
          snippet: openTag.slice(0, 120),
          message: "<button> has no accessible name.",
          suggestion: "Add button text, or aria-label=\"…\".",
        });
      }
    }
    return violations;
  },
};

const R_INPUT_HAS_LABEL: Rule = {
  id: "input-has-label",
  run: (html) => {
    const violations: WcagViolation[] = [];
    const html_ = stripComments(html);
    // Collect all <label for="id">
    const labelledIds = new Set<string>();
    for (const m of findAll(html_, /<label\b[^>]*\bfor\s*=\s*"([^"]+)"/gi)) {
      labelledIds.add(m[1]);
    }
    for (const m of findAll(html_, /<input\b[^>]*>/gi)) {
      const tag = m[0];
      const type = (attrValue(tag, "type") ?? "text").toLowerCase();
      // Types that don't need labels
      if (["hidden", "submit", "reset", "button", "image"].includes(type)) continue;
      const id = attrValue(tag, "id");
      const ariaLabel = attrValue(tag, "aria-label");
      const ariaLabelledBy = attrValue(tag, "aria-labelledby");
      const title = attrValue(tag, "title");
      if (!ariaLabel && !ariaLabelledBy && !title && !(id && labelledIds.has(id))) {
        violations.push({
          rule_id: "input-has-label",
          criterion: "1.3.1",
          severity: "serious",
          snippet: tag.slice(0, 120),
          message: `<input type=\"${type}\"> has no associated label.`,
          suggestion: "Add <label for=\"…\">…</label> matching the input's id, or aria-label=\"…\".",
        });
      }
    }
    return violations;
  },
};

const R_HEADING_HIERARCHY: Rule = {
  id: "heading-hierarchy",
  run: (html) => {
    const seq: number[] = [];
    for (const m of findAll(stripComments(html), /<h([1-6])\b[^>]*>/gi)) {
      seq.push(Number(m[1]));
    }
    const violations: WcagViolation[] = [];
    if (seq.length === 0) return violations;
    if (seq[0] !== 1) {
      violations.push({
        rule_id: "heading-hierarchy",
        criterion: "1.3.1",
        severity: "moderate",
        snippet: `first heading is <h${seq[0]}>`,
        message: "Page does not start with an <h1>.",
        suggestion: "Use <h1> as the top-level heading; nest lower levels beneath it.",
      });
    }
    for (let i = 1; i < seq.length; i++) {
      const gap = seq[i] - seq[i - 1];
      if (gap > 1) {
        violations.push({
          rule_id: "heading-hierarchy",
          criterion: "1.3.1",
          severity: "minor",
          snippet: `<h${seq[i - 1]}> → <h${seq[i]}>`,
          message: `Heading level jumps from h${seq[i - 1]} to h${seq[i]} (skipped ${gap - 1}).`,
          suggestion: "Don't skip heading levels — descend by one at a time.",
        });
      }
    }
    return violations;
  },
};

const R_LINK_TARGET_BLANK: Rule = {
  id: "link-target-blank-rel",
  run: (html) => {
    const violations: WcagViolation[] = [];
    for (const m of findAll(html, /<a\b([^>]*)>/gi)) {
      const tag = m[0];
      const target = (attrValue(tag, "target") ?? "").toLowerCase();
      if (target !== "_blank") continue;
      const rel = (attrValue(tag, "rel") ?? "").toLowerCase();
      if (!/noopener/.test(rel) && !/noreferrer/.test(rel)) {
        violations.push({
          rule_id: "link-target-blank-rel",
          criterion: "2.4.9",
          severity: "minor",
          snippet: tag.slice(0, 120),
          message: "target=\"_blank\" without rel=\"noopener\" · tabnabbing risk + browser hint missing.",
          suggestion: "Add rel=\"noopener noreferrer\".",
        });
      }
    }
    return violations;
  },
};

const ALL_RULES: Rule[] = [
  R_HTML_LANG, R_TITLE, R_VIEWPORT,
  R_IMG_ALT, R_LINK_ACCESSIBLE_NAME, R_BUTTON_ACCESSIBLE_NAME,
  R_INPUT_HAS_LABEL, R_HEADING_HIERARCHY, R_LINK_TARGET_BLANK,
];

const CANNOT_CHECK_FROM_HTML = [
  "colour-contrast (needs computed styles)",
  "focus-visible (needs :focus state resolution)",
  "prefers-reduced-motion (needs media query resolution)",
  "keyboard-trap (needs runtime tab order)",
  "live-region-announcements (needs ARIA-live semantics runtime)",
];

// ═══════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════

export function scoreFromViolations(violations: WcagViolation[]): number {
  let penalty = 0;
  for (const v of violations) penalty += SEVERITY_PENALTY[v.severity];
  return Math.max(0, 100 - penalty);
}

export function auditHtml(html: string): { violations: WcagViolation[]; checked_rules: string[]; cannot_check_from_html: string[] } {
  const all: WcagViolation[] = [];
  const checked: string[] = [];
  for (const r of ALL_RULES) {
    checked.push(r.id);
    for (const v of r.run(html)) all.push(v);
  }
  return {
    violations: all,
    checked_rules: checked,
    cannot_check_from_html: [...CANNOT_CHECK_FROM_HTML],
  };
}
