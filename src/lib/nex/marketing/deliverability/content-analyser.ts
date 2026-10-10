// src/lib/nex/marketing/deliverability/content-analyser.ts
//
// NEX Deliverability · Content Quality Analyser
// Founder-authorised programme · Session-17 · Part 11k · 2026-09-22.
//
// PURE STRUCTURAL ANALYSER. Runs deterministic content-quality checks on
// a proposed email (subject + html/plain body) BEFORE the campaign is
// scheduled or sent. Detects issues that damage deliverability:
//   * Missing unsubscribe link (legal + deliverability)
//   * Missing physical address (CAN-SPAM structural marker)
//   * All-caps subject/body (spam-filter trigger)
//   * Excessive punctuation
//   * Link count anomalies
//   * Link text mismatched with href (phishing pattern)
//   * Image-to-text ratio (image-heavy emails filtered by many providers)
//
// GOVERNANCE HARD-LOCKS:
//   * Pure function · zero I/O · zero mutation · zero side effects
//   * No third-party AI · no LLM · no fuzzy "spam-phrase" classifier
//   * Every check has a deterministic rule with a fixed threshold
//   * Never blocks a send · returns advisory severity only · Founder decides
//   * Never modifies content · analyser only

export type CheckSeverity = "ok" | "advisory" | "warning" | "critical";

export interface ContentCheck {
  readonly name: string;
  readonly severity: CheckSeverity;
  readonly detail: string;
  readonly evidence: string | null;   // truncated snippet (≤120 chars) or null
}

export interface ContentAnalysisInput {
  readonly subject: string;
  readonly html_body: string;
  readonly plain_body?: string;
  readonly sender_domain?: string;    // used only for link-domain comparison (never fetched)
}

export interface ContentAnalysis {
  readonly checks: readonly ContentCheck[];
  readonly overall_severity: CheckSeverity;
  readonly summary: string;
  readonly link_count: number;
  readonly image_count: number;
  readonly text_char_count: number;
  readonly image_to_text_ratio: number | null;
}

// ─── Helpers ────────────────────────────────────────────────────────
function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(s: string, n = 120): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

// ─── Individual checks ──────────────────────────────────────────────
function checkUnsubscribeLink(html: string): ContentCheck {
  // Look for an anchor with unsubscribe-y intent in text or href
  const anchors = html.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi) ?? [];
  for (const a of anchors) {
    const text_m = a.match(/>([\s\S]*?)<\/a>/i);
    const href_m = a.match(/href=["']([^"']+)["']/i);
    const text = (text_m?.[1] ?? "").toLowerCase();
    const href = (href_m?.[1] ?? "").toLowerCase();
    if (/unsubscribe|opt[\s-]?out|manage[\s-]?preferences|email[\s-]?preferences/.test(text) ||
        /unsubscribe|opt[\s-]?out|manage[\s-]?preferences/.test(href)) {
      return { name: "unsubscribe_link", severity: "ok", detail: "unsubscribe link found", evidence: truncate(a) };
    }
  }
  return { name: "unsubscribe_link", severity: "critical", detail: "no unsubscribe link found · legally required + deliverability signal", evidence: null };
}

function checkPhysicalAddress(html: string, plain?: string): ContentCheck {
  const text = (plain ?? extractText(html)).toLowerCase();
  // UK postcode pattern OR US ZIP OR "PO Box" · basic structural check
  const uk = /\b[a-z]{1,2}\d[a-z\d]?\s*\d[a-z]{2}\b/i;
  const us = /\b\d{5}(-\d{4})?\b/;
  const po = /\bp\.?\s*o\.?\s*box\b/i;
  const street = /\b\d+\s+[a-z0-9. ]+(street|st|road|rd|avenue|ave|lane|ln|drive|dr|way|blvd|boulevard|court|ct|crescent)\b/i;
  if (uk.test(text) || us.test(text) || po.test(text) || street.test(text)) {
    return { name: "physical_address", severity: "ok", detail: "physical address pattern detected", evidence: null };
  }
  return { name: "physical_address", severity: "warning", detail: "no physical address pattern detected (CAN-SPAM · UK compliance)", evidence: null };
}

function allCapsRatio(text: string): number {
  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (letters.length === 0) return 0;
  const upper = letters.replace(/[^A-Z]/g, "").length;
  return upper / letters.length;
}

function checkSubjectQuality(subject: string): ContentCheck {
  if (subject.length === 0) {
    return { name: "subject_quality", severity: "critical", detail: "subject line is empty", evidence: null };
  }
  if (subject.length > 200) {
    return { name: "subject_quality", severity: "warning", detail: `subject line ${subject.length} chars (>200 will be truncated by many clients)`, evidence: truncate(subject) };
  }
  const caps = allCapsRatio(subject);
  if (caps > 0.6 && subject.length > 10) {
    return { name: "subject_quality", severity: "warning", detail: `subject is ${Math.round(caps*100)}% uppercase (spam-filter trigger)`, evidence: truncate(subject) };
  }
  const exclaim = (subject.match(/[!?]/g) ?? []).length;
  if (exclaim >= 3) {
    return { name: "subject_quality", severity: "warning", detail: `subject has ${exclaim} exclamation/question marks (spam-filter trigger)`, evidence: truncate(subject) };
  }
  return { name: "subject_quality", severity: "ok", detail: "subject line within quality thresholds", evidence: null };
}

function checkBodyAllCaps(text: string): ContentCheck {
  if (text.length < 100) {
    return { name: "body_case", severity: "ok", detail: "body too short to evaluate case ratio", evidence: null };
  }
  const caps = allCapsRatio(text);
  if (caps > 0.3) {
    return { name: "body_case", severity: "warning", detail: `body is ${Math.round(caps*100)}% uppercase letters (spam-filter trigger)`, evidence: null };
  }
  return { name: "body_case", severity: "ok", detail: "body case within thresholds", evidence: null };
}

function checkImageToTextRatio(html: string, image_count: number, text_len: number): ContentCheck {
  if (image_count === 0 && text_len === 0) {
    return { name: "image_text_ratio", severity: "critical", detail: "body contains no images and no text", evidence: null };
  }
  if (text_len < 20 && image_count > 0) {
    return { name: "image_text_ratio", severity: "critical", detail: `image-only email (${text_len} text chars) · high spam-filter risk`, evidence: null };
  }
  if (image_count === 0) {
    return { name: "image_text_ratio", severity: "ok", detail: "text-only email", evidence: null };
  }
  const ratio = image_count / (text_len / 100); // images per 100 chars of text
  if (ratio > 1.0) {
    return { name: "image_text_ratio", severity: "warning", detail: `${image_count} images with only ${text_len} text chars (ratio ${ratio.toFixed(2)} per 100 chars · spam risk)`, evidence: null };
  }
  return { name: "image_text_ratio", severity: "ok", detail: `${image_count} images · ${text_len} chars · ratio ${ratio.toFixed(2)}`, evidence: null };
}

interface LinkInfo { readonly href: string; readonly text: string; }

function extractLinks(html: string): LinkInfo[] {
  const anchors = html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);
  const out: LinkInfo[] = [];
  for (const m of anchors) {
    out.push({ href: m[1] ?? "", text: extractText(m[2] ?? "") });
  }
  return out;
}

function checkLinkCount(links: readonly LinkInfo[]): ContentCheck {
  if (links.length === 0) {
    return { name: "link_count", severity: "advisory", detail: "no links found (unusual for a marketing email)", evidence: null };
  }
  if (links.length > 40) {
    return { name: "link_count", severity: "warning", detail: `${links.length} links (>40 is a spam-filter trigger)`, evidence: null };
  }
  return { name: "link_count", severity: "ok", detail: `${links.length} links`, evidence: null };
}

function checkLinkTextVsHref(links: readonly LinkInfo[]): ContentCheck {
  // Detect anchor whose visible text is a full URL that DOESN'T match the actual href host
  for (const link of links) {
    const text = link.text.trim();
    const text_url_m = text.match(/https?:\/\/([a-z0-9.-]+)/i);
    const href_url_m = link.href.match(/^https?:\/\/([a-z0-9.-]+)/i);
    if (text_url_m && href_url_m) {
      const th = text_url_m[1]!.toLowerCase();
      const hh = href_url_m[1]!.toLowerCase();
      if (th !== hh && !hh.endsWith("." + th) && !th.endsWith("." + hh)) {
        return {
          name: "link_text_vs_href",
          severity: "critical",
          detail: `link text shows "${th}" but href goes to "${hh}" · classic phishing pattern`,
          evidence: truncate(`${text} → ${link.href}`),
        };
      }
    }
  }
  return { name: "link_text_vs_href", severity: "ok", detail: "no link-text/href mismatches detected", evidence: null };
}

function checkSuspiciousLinkPatterns(links: readonly LinkInfo[]): ContentCheck {
  const shorteners = /^https?:\/\/(bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|ow\.ly|buff\.ly)\b/i;
  const found: string[] = [];
  for (const l of links) if (shorteners.test(l.href)) found.push(l.href);
  if (found.length > 0) {
    return {
      name: "url_shorteners",
      severity: "warning",
      detail: `${found.length} URL-shortener link(s) · spam-filter trigger + reduced trust`,
      evidence: truncate(found[0]!),
    };
  }
  return { name: "url_shorteners", severity: "ok", detail: "no URL shorteners", evidence: null };
}

// ─── Public API ────────────────────────────────────────────────────
export function analyzeEmailContent(input: ContentAnalysisInput): ContentAnalysis {
  const html = input.html_body ?? "";
  const plain = input.plain_body;
  const text = extractText(html);
  const image_count = (html.match(/<img\b/gi) ?? []).length;
  const links = extractLinks(html);

  const checks: ContentCheck[] = [
    checkSubjectQuality(input.subject),
    checkUnsubscribeLink(html),
    checkPhysicalAddress(html, plain),
    checkBodyAllCaps(text),
    checkImageToTextRatio(html, image_count, text.length),
    checkLinkCount(links),
    checkLinkTextVsHref(links),
    checkSuspiciousLinkPatterns(links),
  ];

  // Roll-up severity: most-severe wins
  const order: Record<CheckSeverity, number> = { ok: 0, advisory: 1, warning: 2, critical: 3 };
  const overall = checks.reduce<CheckSeverity>((acc, c) => order[c.severity] > order[acc] ? c.severity : acc, "ok");

  const summary =
    overall === "critical" ? `${checks.filter(c => c.severity === "critical").length} critical issue(s) · fix before sending`
    : overall === "warning" ? `${checks.filter(c => c.severity === "warning").length} warning(s) · review recommended`
    : overall === "advisory" ? "minor advisories · content acceptable"
    : "content passes all structural checks";

  const image_to_text_ratio = text.length > 0 && image_count > 0
    ? Math.round((image_count / (text.length / 100)) * 100) / 100
    : image_count > 0 ? Infinity : null;

  return {
    checks,
    overall_severity: overall,
    summary,
    link_count: links.length,
    image_count,
    text_char_count: text.length,
    image_to_text_ratio: image_to_text_ratio === Infinity ? null : image_to_text_ratio,
  };
}

// ─── Structural boundary markers ───────────────────────────────────
export const _ANALYSER_NEVER_BLOCKS_SENDS = "advisory_only_founder_decides_never_hard_blocks";
export const _ANALYSER_NEVER_MODIFIES_CONTENT = "read_only_analyser_returns_findings_never_rewrites_subject_or_body";
export const _ANALYSER_NO_THIRD_PARTY_AI = "deterministic_structural_rules_only_no_LLM_no_fuzzy_classifier";
export const _ANALYSER_NEVER_NETWORK_FETCHES = "no_fetch_no_dns_no_url_expansion_pure_static_analysis";
