// src/lib/nex-native/intelligence/business-evidence-retriever.ts
//
// Bridge 91 · Business-owned evidence retriever for the NEX Intelligence
// Gateway. Reads authoritative per-business data (business row + optional
// product + menu items relevant to the last customer message) and returns
// a typed EvidenceBundle with per-item provenance.
//
// Doctrine (sealed 2026-09-29, Bridge 91 architectural decision):
//   · Personal peer chat is E2E → server cannot see plaintext → this
//     retriever is NEVER called for peer chat
//   · Business-customer chat IS the authorised business support pathway
//     (server-visible plaintext by design) → this retriever operates here
//   · Every evidence item carries provenance: source, table, id, updated_at
//   · Zero LLM invocation, zero external fetch, zero mutations
//   · The retriever is a PURE READ against nex_business / nex_product /
//     nex_menu_item / nex_menu_section
//   · Off-doctrine content sources (UK trades knowledge graph, external
//     web, model parametric knowledge) are NEVER surfaced here

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexUuid, NexBusinessRow, NexProductRow } from "../types";
import type { NexMenuItemRow } from "../menu-service";

// ─── Public types ────────────────────────────────────────────────────

export type EvidenceProvenance = "business" | "product" | "menu_item" | "menu_section";

export interface EvidenceItem {
  /** Stable id `{provenance}.{row_id}.{field}` so the model can cite. */
  id: string;
  provenance: EvidenceProvenance;
  /** DB row id · authoritative record locator. */
  source_id: NexUuid;
  /** ISO timestamp of the underlying row's last update (or created_at). */
  updated_at: string;
  /** Short human-readable title for the item. */
  title: string;
  /** Full text content the model will see (kept short — model has 400
   *  token cap on output, so 200-500 char items are ideal). */
  content: string;
  /** Score 0..1 · higher = better match against the question. */
  score: number;
  /** Whitelisted figures + URLs from this item · used by the validator
   *  to allow those exact tokens in the model output. */
  figures: string[];
  urls: string[];
}

export interface EvidenceBundle {
  items: EvidenceItem[];
  /** True when we have zero matching items · gateway must return a
   *  gap-message rather than let the model guess. */
  empty: boolean;
  /** Which tables were consulted, for observability. */
  sources_consulted: EvidenceProvenance[];
  /** How many raw candidates the retriever scored before filtering. */
  total_candidates: number;
  /** Business + product identity, echoed for the audit log. */
  business_id: NexUuid;
  product_id: NexUuid | null;
}

export interface RetrieveOptions {
  conversationId: NexUuid;
  businessId: NexUuid;
  productId: NexUuid | null;
  lastCustomerMessage: string;
  /** Cap on items returned to the model. Default 8. */
  maxItems?: number;
}

// ─── Public entry ────────────────────────────────────────────────────

export async function retrieveBusinessEvidence(
  opts: RetrieveOptions,
): Promise<EvidenceBundle> {
  const maxItems = opts.maxItems ?? 8;
  const questionTokens = tokenize(opts.lastCustomerMessage);
  const sourcesConsulted: EvidenceProvenance[] = [];

  // 1 · Business row (always relevant)
  const business = await fetchBusiness(opts.businessId);
  const businessItems = business
    ? businessToEvidence(business)
    : [];
  if (businessItems.length > 0) sourcesConsulted.push("business");

  // 2 · Product row (if this conversation is scoped to a specific product)
  const productItems = opts.productId
    ? await productToEvidence(opts.productId)
    : [];
  if (productItems.length > 0) sourcesConsulted.push("product");

  // 3 · Menu items (if the business is a venue category)
  const isVenue = business ? IS_VENUE_CATEGORY.has(business.business_category ?? "") : false;
  const menuItems = isVenue
    ? await venueMenuToEvidence(opts.businessId, questionTokens)
    : [];
  if (menuItems.length > 0) sourcesConsulted.push("menu_item");

  // 4 · Score everything against the question
  const raw = [...businessItems, ...productItems, ...menuItems];
  const scored = raw.map((it) => ({
    ...it,
    score: scoreEvidence(it, questionTokens),
  }));

  // 5 · Sort by score, then by provenance rank (business > product > menu)
  const provenanceRank: Record<EvidenceProvenance, number> = {
    business: 3,
    product: 2,
    menu_item: 1,
    menu_section: 0,
  };
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return provenanceRank[b.provenance] - provenanceRank[a.provenance];
  });

  // 6 · Keep positively-scored items OR the business identity (always
  //    keep at least the business name/category so the model knows
  //    whose chat it's in).
  const identityCore = scored.filter((it) => it.id.startsWith("business.") && it.id.endsWith(".identity"));
  const positive = scored.filter((it) => it.score > 0 && !identityCore.includes(it));
  const kept = [...identityCore, ...positive].slice(0, maxItems);

  return {
    items: kept,
    empty: kept.filter((it) => it.score > 0).length === 0,
    sources_consulted: sourcesConsulted,
    total_candidates: scored.length,
    business_id: opts.businessId,
    product_id: opts.productId,
  };
}

/** Aggregate every figure + URL across the bundle · used by the
 *  extended validator to whitelist tokens that came from evidence. */
export function bundleWhitelistTokens(
  bundle: EvidenceBundle,
): { figures: string[]; urls: string[] } {
  const figures = new Set<string>();
  const urls = new Set<string>();
  for (const item of bundle.items) {
    for (const f of item.figures) figures.add(f);
    for (const u of item.urls) urls.add(u);
  }
  return { figures: Array.from(figures), urls: Array.from(urls) };
}

// ─── Loaders (read-only) ─────────────────────────────────────────────

async function fetchBusiness(id: NexUuid): Promise<NexBusinessRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  return (data as NexBusinessRow | null) ?? null;
}

async function fetchProduct(id: NexUuid): Promise<NexProductRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  return (data as NexProductRow | null) ?? null;
}

async function fetchVenueMenu(businessId: NexUuid): Promise<NexMenuItemRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_menu_item")
    .select("*")
    .eq("business_id", businessId)
    .order("sort_order", { ascending: true })
    .limit(40);
  if (error) return [];
  return (data as NexMenuItemRow[]) ?? [];
}

// ─── Row → evidence transformers ─────────────────────────────────────

function businessToEvidence(b: NexBusinessRow): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  const updatedAt = b.updated_at ?? b.created_at ?? new Date().toISOString();

  items.push({
    id: `business.${b.id}.identity`,
    provenance: "business",
    source_id: b.id,
    updated_at: updatedAt,
    title: `About ${b.display_name}`,
    content: composeBusinessIdentityLine(b),
    score: 0,
    figures: [],
    urls: [],
  });

  if (b.description && b.description.trim().length > 0) {
    items.push({
      id: `business.${b.id}.description`,
      provenance: "business",
      source_id: b.id,
      updated_at: updatedAt,
      title: "About us",
      content: b.description.slice(0, 400),
      score: 0,
      figures: extractFigures(b.description),
      urls: extractUrls(b.description),
    });
  }

  if (b.hours_display && b.hours_display.trim().length > 0) {
    items.push({
      id: `business.${b.id}.hours`,
      provenance: "business",
      source_id: b.id,
      updated_at: updatedAt,
      title: "Opening hours",
      content: b.hours_display.slice(0, 300),
      score: 0,
      figures: [],
      urls: [],
    });
  }

  if (b.city && b.city.trim().length > 0) {
    items.push({
      id: `business.${b.id}.location`,
      provenance: "business",
      source_id: b.id,
      updated_at: updatedAt,
      title: "Location",
      content: `Based in ${b.city}${b.address ? ` · ${b.address}` : ""}.`,
      score: 0,
      figures: [],
      urls: [],
    });
  }

  if (b.payment_instructions && b.payment_instructions.trim().length > 0) {
    items.push({
      id: `business.${b.id}.payment`,
      provenance: "business",
      source_id: b.id,
      updated_at: updatedAt,
      title: "How to pay",
      content: b.payment_instructions.slice(0, 400),
      score: 0,
      figures: extractFigures(b.payment_instructions),
      urls: extractUrls(b.payment_instructions),
    });
  }

  if (b.status_message && b.status_message.trim().length > 0) {
    items.push({
      id: `business.${b.id}.status`,
      provenance: "business",
      source_id: b.id,
      updated_at: updatedAt,
      title: "Current status",
      content: b.status_message.slice(0, 300),
      score: 0,
      figures: [],
      urls: [],
    });
  }

  return items;
}

async function productToEvidence(productId: NexUuid): Promise<EvidenceItem[]> {
  const p = await fetchProduct(productId);
  if (!p) return [];
  const items: EvidenceItem[] = [];
  const updatedAt = p.updated_at ?? p.created_at ?? new Date().toISOString();

  const priceStr = `${p.currency} ${(p.price_pence / 100).toFixed(2)}`;
  const parts: string[] = [`${p.name} · ${priceStr}`];
  if (p.stock_status) parts.push(`Stock: ${p.stock_status}`);
  items.push({
    id: `product.${p.id}.summary`,
    provenance: "product",
    source_id: p.id,
    updated_at: updatedAt,
    title: `Product · ${p.name}`,
    content: parts.join(" · "),
    score: 0,
    figures: [priceStr],
    urls: [],
  });

  if (p.description && p.description.trim().length > 0) {
    items.push({
      id: `product.${p.id}.description`,
      provenance: "product",
      source_id: p.id,
      updated_at: updatedAt,
      title: `${p.name} · details`,
      content: p.description.slice(0, 400),
      score: 0,
      figures: extractFigures(p.description),
      urls: extractUrls(p.description),
    });
  }

  return items;
}

async function venueMenuToEvidence(
  businessId: NexUuid,
  questionTokens: Set<string>,
): Promise<EvidenceItem[]> {
  const menu = await fetchVenueMenu(businessId);
  if (menu.length === 0) return [];

  // Rough pre-filter · only pull menu items whose name / description
  // shares at least one token with the question. Prevents dumping the
  // entire menu into every reply.
  const filtered = menu.filter((mi) => {
    if (questionTokens.size === 0) return false;
    const tokens = tokenize(`${mi.name} ${mi.description ?? ""} ${(mi.dietary_tags ?? []).join(" ")}`);
    for (const t of questionTokens) if (tokens.has(t)) return true;
    return false;
  });

  const target = filtered.length > 0 ? filtered : menu.slice(0, 6);
  return target.slice(0, 12).map((mi): EvidenceItem => {
    const priceStr = `${mi.currency} ${(mi.price_pence / 100).toFixed(2)}`;
    const parts: string[] = [`${mi.name} · ${priceStr}`];
    if (mi.description) parts.push(mi.description.slice(0, 160));
    if (mi.dietary_tags && mi.dietary_tags.length > 0) {
      parts.push(`Dietary: ${mi.dietary_tags.join(", ")}`);
    }
    if (mi.perks && mi.perks.length > 0) {
      parts.push(`Perks: ${mi.perks.join(", ")}`);
    }
    return {
      id: `menu_item.${mi.id}.summary`,
      provenance: "menu_item",
      source_id: mi.id,
      updated_at: mi.updated_at ?? mi.created_at ?? new Date().toISOString(),
      title: `Menu item · ${mi.name}`,
      content: parts.join(" · "),
      score: 0,
      figures: [priceStr],
      urls: [],
    };
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────

const IS_VENUE_CATEGORY = new Set([
  "restaurant", "cafe", "ice-cream-shop", "dessert-shop", "drinks-shop",
  "juice-bar", "bar", "nightclub", "event-space", "hotel", "bakery",
]);

function composeBusinessIdentityLine(b: NexBusinessRow): string {
  const parts: string[] = [b.display_name];
  if (b.business_category) parts.push(`(${b.business_category})`);
  if (b.city) parts.push(`· in ${b.city}`);
  if (b.verified_at) parts.push("· verified");
  return parts.join(" ");
}

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "of", "for", "in", "on", "to",
  "with", "at", "by", "is", "are", "was", "were", "be", "been", "being",
  "do", "does", "did", "have", "has", "had", "will", "would", "could",
  "should", "may", "might", "can", "must", "i", "you", "he", "she", "we",
  "they", "my", "your", "his", "her", "its", "our", "their", "this",
  "that", "these", "those", "if", "then", "so", "as", "than",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t)),
  );
}

function scoreEvidence(item: EvidenceItem, questionTokens: Set<string>): number {
  if (questionTokens.size === 0) return 0;
  const itemTokens = tokenize(`${item.title} ${item.content}`);
  let hits = 0;
  for (const t of questionTokens) if (itemTokens.has(t)) hits += 1;
  return hits / questionTokens.size;
}

function extractFigures(text: string): string[] {
  const numeric = String.raw`\d[\d,]*(?:\.\d+)?`;
  const explicit = text.match(new RegExp(`[£$€¥]\\s?${numeric}`, "gi")) ?? [];
  const currencyPrefixed =
    text.match(new RegExp(`\\b(?:GBP|USD|EUR|JPY|IDR|Rp)\\s?${numeric}`, "gi")) ?? [];
  return [...explicit, ...currencyPrefixed].map((s) => s.trim());
}

function extractUrls(text: string): string[] {
  return text.match(/https?:\/\/[^\s)>\]]+/gi) ?? [];
}
