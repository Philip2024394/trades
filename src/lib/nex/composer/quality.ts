// NEX Composer · quality checks
//
// 7 categories (spec Philip 2026-08-07) run before Approval / Scheduling:
//   missing_subject · missing_unsubscribe · broken_variables ·
//   missing_images · missing_buttons · accessibility · spam_risk
//
// Every check returns a severity so the UI can decide whether to
// hard-block scheduling (error) or just warn (warning · info).

import type { Block, QualityCheck } from "./types";
import { findVariables } from "./variables";
import { VARIABLES } from "./types";

export type QualityInput = {
  subject: string | null | undefined;
  preview_text?: string | null;
  blocks: Block[];
  campaign_type?: "marketing" | "transactional" | "announcement" | "newsletter";
};

const KNOWN_VARS = new Set(VARIABLES.map((v) => v.name as string));

const SPAMMY_TOKENS = [
  "FREE!!!", "!!!!", "FREE MONEY", "GUARANTEED", "ACT NOW", "CLICK HERE!!!",
  "LIMITED TIME", "$$$", "100% FREE", "RISK-FREE", "NO COST",
];

export function runQualityChecks(input: QualityInput): QualityCheck[] {
  const out: QualityCheck[] = [];
  const blocks = input.blocks ?? [];
  const isMarketing = (input.campaign_type ?? "marketing") === "marketing" || (input.campaign_type ?? "marketing") === "newsletter" || (input.campaign_type ?? "marketing") === "announcement";

  // ── 1 · missing_subject ────────────────────────────────────────
  if (!input.subject || input.subject.trim().length === 0) {
    out.push({ id: "subject_empty", severity: "error", category: "missing_subject",
      message: "Subject line is empty · required before scheduling" });
  } else if (input.subject.length < 8) {
    out.push({ id: "subject_short", severity: "warning", category: "missing_subject",
      message: `Subject is only ${input.subject.length} chars · consider making it clearer` });
  } else if (input.subject.length > 90) {
    out.push({ id: "subject_long", severity: "warning", category: "missing_subject",
      message: `Subject is ${input.subject.length} chars · most clients truncate around 60-70` });
  }

  // ── 2 · missing_unsubscribe (marketing only) ───────────────────
  if (isMarketing) {
    const flatText = flattenText(blocks);
    if (!/\{\{\s*unsubscribe_link\s*\}\}/i.test(flatText)) {
      out.push({ id: "unsubscribe_missing", severity: "error", category: "missing_unsubscribe",
        message: "Marketing email must include {{unsubscribe_link}} · UK PECR + GDPR + CAN-SPAM require it",
        detail: "Add a Footer block · it inserts the link automatically." });
    }
  }

  // ── 3 · broken_variables ──────────────────────────────────────
  const vars = new Set<string>();
  walkStrings(blocks, (s) => findVariables(s).forEach((v) => vars.add(v)));
  findVariables(input.subject ?? "").forEach((v) => vars.add(v));
  findVariables(input.preview_text ?? "").forEach((v) => vars.add(v));
  const unknown = Array.from(vars).filter((v) => !KNOWN_VARS.has(v));
  for (const v of unknown) {
    out.push({ id: `bad_var_${v}`, severity: "error", category: "broken_variables",
      message: `Unknown variable {{${v}}}`,
      detail: `Registered variables: ${Array.from(KNOWN_VARS).join(", ")}` });
  }

  // ── 4 · missing_images (empty src) ────────────────────────────
  const imageBlocks = collectBlocks(blocks, "image");
  const heroBlocks  = collectBlocks(blocks, "hero");
  const galleryBlocks = collectBlocks(blocks, "gallery");
  for (const b of imageBlocks) {
    if (b.type === "image" && (!b.src || b.src.trim().length === 0)) {
      out.push({ id: `img_empty_${b.id}`, severity: "warning", category: "missing_images",
        message: "Image block has no src · will render blank" });
    }
    if (b.type === "image" && b.src && (!b.alt || b.alt.trim().length === 0)) {
      out.push({ id: `img_alt_${b.id}`, severity: "warning", category: "accessibility",
        message: "Image is missing alt text · screen readers + image-blocking clients need it" });
    }
  }
  for (const b of heroBlocks) {
    if (b.type === "hero" && b.src && !b.heading) {
      out.push({ id: `hero_no_heading_${b.id}`, severity: "warning", category: "accessibility",
        message: "Hero has an image but no heading · screen readers will skip it" });
    }
  }
  for (const b of galleryBlocks) {
    if (b.type === "gallery") {
      for (const item of b.items) {
        if (!item.alt || item.alt.trim().length === 0) {
          out.push({ id: `gal_alt_${b.id}_${item.src}`, severity: "info", category: "accessibility",
            message: "Gallery image is missing alt text" });
          break; // one message per gallery is enough
        }
      }
    }
  }

  // ── 5 · missing_buttons (empty href / text) ───────────────────
  const buttonLike = [
    ...collectBlocks(blocks, "button"),
    ...collectBlocks(blocks, "cta"),
    ...collectBlocks(blocks, "hero"),
  ];
  for (const b of buttonLike) {
    if (b.type === "button") {
      if (!b.href || b.href.trim().length === 0) out.push({ id: `btn_href_${b.id}`, severity: "warning", category: "missing_buttons", message: "Button has no href" });
      if (!b.text || b.text.trim().length === 0) out.push({ id: `btn_text_${b.id}`, severity: "warning", category: "missing_buttons", message: "Button has no label" });
    }
    if (b.type === "cta") {
      if (!b.cta_href) out.push({ id: `cta_href_${b.id}`, severity: "warning", category: "missing_buttons", message: "CTA has no destination URL" });
      if (!b.cta_text) out.push({ id: `cta_text_${b.id}`, severity: "warning", category: "missing_buttons", message: "CTA has no label" });
    }
    if (b.type === "hero") {
      if (b.cta_text && !b.cta_href) out.push({ id: `hero_cta_${b.id}`, severity: "warning", category: "missing_buttons", message: "Hero CTA text is set but has no destination URL" });
    }
  }

  // ── 6 · accessibility · overall ───────────────────────────────
  // (Alt-text checks above · here add heading-level guidance.)
  const headings = collectBlocks(blocks, "heading");
  if (headings.some((h) => h.type === "heading" && h.level === 1) === false && headings.length > 0) {
    out.push({ id: "no_h1", severity: "info", category: "accessibility", message: "No H1 heading · consider adding one so screen readers can identify the main topic" });
  }

  // ── 7 · spam_risk observations ────────────────────────────────
  const combined = `${input.subject ?? ""}\n${input.preview_text ?? ""}\n${flattenText(blocks)}`;
  const upperRatio = (combined.match(/[A-Z]/g)?.length ?? 0) / Math.max(1, combined.length);
  if (upperRatio > 0.4 && combined.length > 60) {
    out.push({ id: "too_uppercase", severity: "warning", category: "spam_risk",
      message: `~${Math.round(upperRatio * 100)}% of text is uppercase · Gmail penalises this` });
  }
  const exclamations = (combined.match(/!/g)?.length ?? 0);
  if (exclamations > 6) {
    out.push({ id: "too_exclaim", severity: "warning", category: "spam_risk",
      message: `${exclamations} exclamation marks · aim for <3 per email` });
  }
  const hits = SPAMMY_TOKENS.filter((t) => combined.toUpperCase().includes(t));
  if (hits.length > 0) {
    out.push({ id: "spammy_tokens", severity: "warning", category: "spam_risk",
      message: `Contains spam-trigger phrases: ${hits.slice(0, 3).join(", ")}` });
  }
  if ((input.subject ?? "").length > 0 && (input.subject ?? "").toUpperCase() === (input.subject ?? "")) {
    out.push({ id: "subject_shouty", severity: "warning", category: "spam_risk",
      message: "Subject is entirely uppercase · high spam-filter risk" });
  }

  return out;
}

// ── Walkers ───────────────────────────────────────────────────────
function walkStrings(blocks: Block[], visit: (s: string) => void): void {
  for (const b of blocks) {
    switch (b.type) {
      case "heading":      visit(b.text); break;
      case "paragraph":    visit(b.text); break;
      case "image":        visit(b.alt); if (b.href) visit(b.href); break;
      case "button":       visit(b.text); visit(b.href); break;
      case "hero":         visit(b.heading); if (b.subheading) visit(b.subheading); if (b.cta_text) visit(b.cta_text); if (b.cta_href) visit(b.cta_href); break;
      case "feature_grid": b.features.forEach((f) => { visit(f.title); visit(f.body); }); break;
      case "cta":          visit(b.heading); if (b.body) visit(b.body); visit(b.cta_text); visit(b.cta_href); break;
      case "gallery":      b.items.forEach((it) => { visit(it.alt); if (it.href) visit(it.href); }); break;
      case "signature":    visit(b.name); if (b.role) visit(b.role); if (b.company) visit(b.company); break;
      case "footer":       visit(b.company); if (b.address) visit(b.address); if (b.unsubscribe_text) visit(b.unsubscribe_text); break;
      case "columns":      b.columns.flat().forEach((c) => walkStrings([c], visit)); break;
      case "social_links": b.links.forEach((l) => visit(l.href)); break;
    }
  }
}

function flattenText(blocks: Block[]): string {
  const parts: string[] = [];
  walkStrings(blocks, (s) => parts.push(s));
  return parts.join(" ");
}

function collectBlocks<T extends Block["type"]>(blocks: Block[], type: T): Extract<Block, { type: T }>[] {
  const out: Extract<Block, { type: T }>[] = [];
  for (const b of blocks) {
    if (b.type === type) out.push(b as Extract<Block, { type: T }>);
    if (b.type === "columns") out.push(...collectBlocks(b.columns.flat(), type));
  }
  return out;
}
