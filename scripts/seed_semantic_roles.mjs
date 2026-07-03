#!/usr/bin/env node
// One-off codemod — seeds `role: "..."` on editableFields whose `key`
// matches a canonical name across the Xrated section registry.
//
// Idempotent: if `role:` already sits inside the same field object we
// skip. Safe to re-run. Prints a diff summary per file.
//
// Scope: hero + faq + testimonials + statistics + pricing + services +
// features + cta libraries. Extend the FIELD_ROLE_MAP for new libraries.

import { readFileSync, writeFileSync } from "node:fs";
import { globSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();

// Canonical key → semantic role. Order is stable — later entries do NOT
// override earlier ones at match time (we scan the file once per entry).
const FIELD_ROLE_MAP = [
  // Copy
  ["eyebrow", "eyebrow"],
  ["heading", "headline"],
  ["title", "headline"],
  ["mainTitle", "headline"],
  ["subheading", "subhead"],
  ["subheadline", "subhead"],
  ["supportingCopy", "supporting_copy"],
  ["subheadingCopy", "subhead"],
  ["bodyLead", "body"],
  ["quote", "quote"],
  ["pullQuote", "quote"],
  ["quoteAuthor", "quote_author"],
  ["pullQuoteAuthor", "quote_author"],
  ["author", "quote_author"],
  ["question", "question"],
  ["answer", "answer"],
  ["stepTitle", "step_title"],
  ["stepBody", "step_body"],
  ["caption", "caption"],
  ["locationLabel", "location_label"],
  ["disclaimer", "disclaimer"],
  ["trustBadgeText", "trust_line"],
  ["trustItems", "trust_line"],
  ["ratingText", "trust_line"],
  ["projectCountLabel", "trust_line"],
  // Actions
  ["primaryCtaLabel", "primary_action_label"],
  ["primaryCtaHref", "primary_action_href"],
  ["secondaryCtaLabel", "secondary_action_label"],
  ["secondaryCtaHref", "secondary_action_href"],
  ["ctaLabel", "primary_action_label"],
  ["ctaHref", "primary_action_href"],
  ["submitLabel", "primary_action_label"],
  // Media
  ["backgroundImageUrl", "background_media"],
  ["backgroundImageOpacity", "opacity"],
  ["overlayOpacity", "opacity"],
  ["imageUrl", "hero_media"],
  ["heroImageUrl", "hero_media"],
  ["posterImageUrl", "video_poster"],
  ["videoMp4Url", "video_url"],
  ["videoWebmUrl", "video_url"],
  ["logoUrl", "logo_media"],
  ["avatarUrl", "avatar_media"],
  ["customerAvatarUrl", "avatar_media"],
  // Data / stats
  ["statValue", "stat_value"],
  ["statUnit", "stat_unit"],
  ["statLabel", "stat_label"],
  ["ratingValue", "rating_value"],
  ["ratingCount", "rating_count"],
  // Commerce
  ["price", "price_value"],
  ["priceValue", "price_value"],
  ["currency", "price_currency"],
  ["period", "price_period"],
  ["productName", "product_name"],
  ["productLabel", "product_name"],
  ["productBadge", "product_badge"],
  // Meta
  ["surface", "surface_mode"],
  ["darkOrLight", "surface_mode"],
  ["variant", "layout_variant"],
  ["layoutStyle", "layout_variant"],
];

// Per-index for numbered fields (photo1..photo6, product1Image..product6Image, etc.)
const NUMBERED_PATTERNS = [
  { regex: /^photo\d+$/, role: "gallery_media" },
  { regex: /^product\d+Image$/, role: "hero_media" },
  { regex: /^product\d+Label$/, role: "product_name" },
  { regex: /^product\d+Badge$/, role: "product_badge" },
  { regex: /^review\d+$/, role: "quote" },
  { regex: /^review\d+Author$/, role: "quote_author" },
  { regex: /^chip\d+$/, role: "feature_line" },
  { regex: /^rowWords$/, role: "feature_line" },
];

const TARGET_DIRS = [
  "src/lib/studio/sections/hero",
  "src/lib/studio/sections/faq",
  "src/lib/studio/sections/testimonials",
  "src/lib/studio/sections/statistics",
  "src/lib/studio/sections/pricing",
  "src/lib/studio/sections/services",
  "src/lib/studio/sections/features",
  "src/lib/studio/sections/cta",
];

// Match a single editableFields object by its `key: "..."` entry. Then
// check whether `role:` already exists in the same object literal.
// Object literals in this codebase are consistently written across
// multiple lines: `{ key: "x", label: "…", type: {…}, default: …, … }`.
// A simple non-greedy scan between `{` and the matching `}` works
// because keys never nest more than one level deep (no objects with
// `key:` inside another key: block, except `type: { kind: "..." }`
// which contains `kind:`, not `key:`).

function resolveRoleForKey(key) {
  for (const [k, role] of FIELD_ROLE_MAP) {
    if (k === key) return role;
  }
  for (const p of NUMBERED_PATTERNS) {
    if (p.regex.test(key)) return p.role;
  }
  return null;
}

// A conservative per-object matcher. We locate each field object by
// finding `{\s*key: "..."`, then walk balanced braces to find the
// closing `}`. Insert `role: "..."` after `key: "..."` if:
//   • the object doesn't already contain `role:`
//   • the key has a canonical role
function seedRolesInSource(src) {
  let out = "";
  let cursor = 0;
  let inserted = 0;
  let skippedExisting = 0;
  let skippedUnknown = 0;

  const keyOpenRegex = /\{\s*key:\s*"([a-zA-Z0-9_]+)"/g;
  let m;
  while ((m = keyOpenRegex.exec(src)) !== null) {
    const objectStart = m.index; // position of `{`
    const key = m[1];
    // Walk balanced braces from objectStart.
    let depth = 0;
    let end = objectStart;
    for (let i = objectStart; i < src.length; i++) {
      const ch = src[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const objectSrc = src.slice(objectStart, end + 1);
    const alreadyHasRole = /\brole:\s*"/.test(objectSrc);

    // Emit everything up to and including the `key: "..."` line.
    // We'll insert `role: "..."` right after the key entry.
    const role = resolveRoleForKey(key);
    if (!role) {
      // No canonical mapping — copy through, advance cursor to end of
      // this object so we don't re-scan its inner keys (e.g. `kind:`
      // inside `type:` is fine because it starts with `kind`, not `key`,
      // so the regex won't match anyway — but we still skip forward).
      out += src.slice(cursor, end + 1);
      cursor = end + 1;
      keyOpenRegex.lastIndex = end + 1;
      skippedUnknown++;
      continue;
    }
    if (alreadyHasRole) {
      out += src.slice(cursor, end + 1);
      cursor = end + 1;
      keyOpenRegex.lastIndex = end + 1;
      skippedExisting++;
      continue;
    }

    // Insert after the `key: "..."` entry. Find the closing quote +
    // trailing comma if any.
    const keyEntryEnd = objectStart + m[0].length; // position after `key: "..."`
    // Include the trailing `,` if present.
    let afterKey = keyEntryEnd;
    if (src[afterKey] === ",") afterKey++;
    const preserved = src.slice(objectStart, afterKey);
    // Look at whitespace right after so we emit consistent indentation.
    const rest = src.slice(afterKey);
    const indentMatch = /^(\s*)/.exec(rest);
    const indent = indentMatch ? indentMatch[1] : " ";
    const insertion = `${preserved}${indent}role: "${role}",`;

    out += src.slice(cursor, objectStart);
    out += insertion;
    cursor = afterKey + indent.length; // skip the indent we just re-emitted
    inserted++;
    keyOpenRegex.lastIndex = end + 1;
  }
  out += src.slice(cursor);
  return { out, inserted, skippedExisting, skippedUnknown };
}

// ─── main ─────────────────────────────────────────────
const files = [];
for (const dir of TARGET_DIRS) {
  const pattern = join(ROOT, dir, "*.tsx");
  files.push(...globSync(pattern));
}

let totalInserted = 0;
let totalExisting = 0;
let totalUnknown = 0;
let touchedFiles = 0;

for (const abs of files) {
  const rel = relative(ROOT, abs);
  const src = readFileSync(abs, "utf8");
  const { out, inserted, skippedExisting, skippedUnknown } = seedRolesInSource(src);
  totalInserted += inserted;
  totalExisting += skippedExisting;
  totalUnknown += skippedUnknown;
  if (inserted > 0) {
    writeFileSync(abs, out, "utf8");
    touchedFiles++;
    console.log(`  +${inserted}  ${rel}`);
  }
}

console.log("");
console.log(`Files touched:       ${touchedFiles}`);
console.log(`Roles inserted:      ${totalInserted}`);
console.log(`Fields already tagged: ${totalExisting}`);
console.log(`Fields with no canonical role: ${totalUnknown}`);
