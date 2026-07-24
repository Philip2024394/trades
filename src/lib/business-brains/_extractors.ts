// Business Brain extractors — turn CrawledPage output into structured
// products, services, FAQs, and page-category labels.
//
// V1 is heuristic (no LLM cost). Later phases plug LLM-assisted
// extraction into the same output shape. Every detection carries a
// confidence score so the sync engine can flag low-confidence items
// for owner review.

import "server-only";
import type { CrawledPage } from "./_crawler";
import type { PageCategory, DetectionMethod } from "./_types";

// ─── Page categorisation ─────────────────────────────────────────
//
// Bucket every crawled page into one of the standard categories so
// the admin dashboard and future chat retrieval can filter by type.

export function categorisePage(page: CrawledPage): PageCategory {
  const url = page.url.toLowerCase();
  const title = (page.title ?? "").toLowerCase();
  const path = new URL(url).pathname;

  if (path === "/" || path === "/index" || path === "/home") return "home";
  if (/\/contact/i.test(path) || /contact\s+us/i.test(title))    return "contact";
  if (/\/about/i.test(path) || /about\s+us/i.test(title))        return "about";
  if (/\/faq/i.test(path) || /frequently\s+asked/i.test(title))  return "faq";
  if (/\/(blog|news|articles|posts)/i.test(path))                return "blog";
  if (/\/(privacy|terms|cookies|policy|policies|gdpr)/i.test(path)) return "policy";
  if (/\/(download|downloads|resources|documents|brochure)/i.test(path)) return "downloads";
  if (/\/(product|products|shop|store|catalogue|catalog)/i.test(path)) return "product";
  if (/\/(service|services|installation|fitting|repair)/i.test(path)) return "service";
  return "other";
}

// ─── Product extraction (heuristic V1) ────────────────────────────
//
// Looks for pages with a product-like structure: a title, a body
// paragraph or two, and (crucially) a price signal like "£300",
// "from £250", "starting at £X" or "POA".
//
// The pattern is intentionally conservative — false-positive products
// pollute the dashboard, so heuristic V1 only flags high-signal pages.
// LLM-assisted extraction in Phase 2 will pick up the pages this
// heuristic misses.

export type ExtractedProduct = {
  name:             string;
  category:         string | null;
  materials:        string[];
  options:          string[];
  price_from_pence: number | null;
  price_display:    string | null;
  lead_time_text:   string | null;
  description:      string | null;
  detection_method: DetectionMethod;
  confidence_pct:   number;
};

const PRICE_PATTERN = /£\s?([\d,]+(?:\.\d{2})?)/;
const FROM_PRICE_PATTERN = /(?:from|starting\s+at|starting\s+from|prices?\s+from)\s*£\s?([\d,]+(?:\.\d{2})?)/i;
const POA_PATTERN = /\b(POA|price\s+on\s+application|call\s+for\s+price)\b/i;
const LEAD_TIME_PATTERN = /(?:lead\s+time|delivery|dispatch|ships?\s+in|working\s+days|business\s+days|weeks|days?)/i;

const MATERIAL_KEYWORDS = [
  "oak", "pine", "walnut", "ash", "sapele", "mahogany", "beech", "maple",
  "cherry", "iroko", "hemlock", "spruce", "redwood", "whitewood", "hardwood",
  "softwood", "mdf", "steel", "aluminium", "concrete", "glass", "brass", "chrome"
];

const OPTION_KEYWORDS = [
  "cut string", "closed string", "open string", "closed riser", "open riser",
  "glass balustrade", "metal balustrade", "timber balustrade",
  "bullnose", "curtail", "volute", "kite winder", "half turn", "quarter turn",
  "spiral", "helical", "floating"
];

export function extractProduct(page: CrawledPage, categorisedAs: PageCategory): ExtractedProduct | null {
  // Skip categories that cannot possibly be products, regardless of price signals.
  // Legal/policy/blog/contact pages sometimes mention prices in text but aren't products.
  const NON_PRODUCT_CATEGORIES: PageCategory[] = ["policy", "contact", "faq", "blog", "about", "home"];
  if (NON_PRODUCT_CATEGORIES.includes(categorisedAs)) return null;

  const text  = page.clean_text;
  const title = page.title?.trim() ?? "";

  // Need a name — falls back to first non-empty title-cased line
  const name = title || firstNonEmptyLine(text) || "";
  if (name.length < 3 || name.length > 200) return null;

  // Price detection — POA counts as a valid product with unknown price
  const fromPriceMatch = FROM_PRICE_PATTERN.exec(text);
  const plainPriceMatch = fromPriceMatch ? null : PRICE_PATTERN.exec(text);
  const poaMatch = POA_PATTERN.exec(text);

  const priceMatch = fromPriceMatch ?? plainPriceMatch;
  let priceFromPence: number | null = null;
  let priceDisplay:   string | null = null;

  if (priceMatch) {
    const numeric = Number(priceMatch[1].replace(/,/g, ""));
    if (Number.isFinite(numeric)) {
      priceFromPence = Math.round(numeric * 100);
      priceDisplay   = fromPriceMatch ? `From £${priceMatch[1]}` : `£${priceMatch[1]}`;
    }
  } else if (poaMatch) {
    priceDisplay = "POA";
  } else {
    // No price signal — not a candidate for heuristic V1.
    return null;
  }

  // Materials and options — simple keyword scan in the clean text
  const textLower = text.toLowerCase();
  const materials = MATERIAL_KEYWORDS.filter((k) => textLower.includes(k));
  const options   = OPTION_KEYWORDS.filter((k) => textLower.includes(k));

  // For non-product-URL pages we require STRONGER signals to avoid
  // false positives from "£25 gift voucher" mentions in headers etc.
  // Rule: outside /product* paths, need EITHER (a) a from-price pattern,
  // (b) POA, or (c) a plain price AND at least one material keyword.
  const isProductUrl = categorisedAs === "product";
  if (!isProductUrl) {
    const strongPriceSignal = fromPriceMatch !== null || poaMatch !== null;
    const supportingSignal  = materials.length > 0 || options.length > 0;
    if (!strongPriceSignal && !supportingSignal) return null;
  }

  // Lead time — grab the first sentence that mentions delivery/working days
  const leadTimeMatch = /([A-Z][^.]{5,120}(?:working\s+days|business\s+days|weeks|days?)[^.]{0,40})\./i.exec(text);
  const leadTime = leadTimeMatch ? leadTimeMatch[1].trim() : null;

  // Description — first paragraph after the title
  const description = firstMeaningfulParagraph(text, name);

  // Confidence: product-URL start=60, non-product-URL start=45 (needs review).
  // +10 price, +5 materials, +5 lead time, +5 description. Cap 90.
  let confidence = isProductUrl ? 60 : 45;
  if (priceFromPence !== null) confidence += 10;
  if (materials.length > 0)    confidence += 5;
  if (leadTime)                confidence += 5;
  if (description)             confidence += 5;
  confidence = Math.min(90, confidence);

  return {
    name,
    category:         guessCategoryFromUrl(page.url),
    materials,
    options,
    price_from_pence: priceFromPence,
    price_display:    priceDisplay,
    lead_time_text:   leadTime,
    description,
    detection_method: "heuristic_v1",
    confidence_pct:   confidence
  };
}

// ─── Service extraction (heuristic V1) ────────────────────────────

export type ExtractedService = {
  name:             string;
  description:      string | null;
  detection_method: DetectionMethod;
  confidence_pct:   number;
};

export function extractService(page: CrawledPage, categorisedAs: PageCategory): ExtractedService | null {
  if (categorisedAs !== "service") return null;
  const name = page.title?.trim() ?? firstNonEmptyLine(page.clean_text);
  if (!name || name.length < 3 || name.length > 200) return null;

  const description = firstMeaningfulParagraph(page.clean_text, name);
  return {
    name,
    description,
    detection_method: "heuristic_v1",
    confidence_pct:   description ? 70 : 60
  };
}

// ─── FAQ extraction (heuristic V1) ────────────────────────────────
//
// Looks for the standard FAQ page pattern: multiple questions ending
// in "?" each followed by a short answer paragraph. Also picks up FAQ
// blocks anywhere in the site, not just /faq pages.

export type ExtractedFaq = {
  question:         string;
  answer:           string;
  detection_method: DetectionMethod;
  confidence_pct:   number;
};

export function extractFaqs(page: CrawledPage): ExtractedFaq[] {
  const text = page.clean_text;
  const faqs: ExtractedFaq[] = [];

  // Split text into blocks by double newline; look for Q/A pairs
  const blocks = text.split(/\n{2,}/);
  for (let i = 0; i < blocks.length - 1; i++) {
    const q = blocks[i].trim();
    if (!q.endsWith("?") || q.length < 8 || q.length > 300) continue;
    const a = blocks[i + 1]?.trim();
    if (!a || a.length < 10 || a.length > 2000) continue;
    // Reject next-block-is-also-a-question (that's a list of questions, no answers)
    if (a.endsWith("?")) continue;
    faqs.push({
      question: q,
      answer:   a,
      detection_method: "heuristic_v1",
      confidence_pct:   page.url.toLowerCase().includes("faq") ? 85 : 65
    });
    i++;   // skip past the answer block we just consumed
  }
  return faqs;
}

// ─── Helpers ─────────────────────────────────────────────────────

function firstNonEmptyLine(text: string): string {
  for (const line of text.split(/\n/)) {
    const t = line.trim();
    if (t.length > 0) return t;
  }
  return "";
}

function firstMeaningfulParagraph(text: string, excludeName: string): string | null {
  for (const paragraph of text.split(/\n{2,}/)) {
    const p = paragraph.trim();
    if (p.length < 30) continue;
    if (p === excludeName) continue;
    return p.length > 500 ? p.slice(0, 500).trim() + "…" : p;
  }
  return null;
}

function guessCategoryFromUrl(url: string): string | null {
  const path = new URL(url).pathname.toLowerCase();
  const parts = path.split("/").filter(Boolean);
  // /products/staircases/straight-flight → returns "staircases"
  if (parts.length >= 2 && (parts[0] === "products" || parts[0] === "product" || parts[0] === "shop")) {
    return parts[1].replace(/-/g, " ");
  }
  return null;
}

// ─── Slug helper (shared with sync engine when writing products) ───

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}
