// src/lib/nex/directory/ask.ts
//
// Founder Phase 28 · P28-2 · Fast-info-finder for a directory listing.
//
// Answers a question about a listing WITHOUT the user visiting the site.
// Answer sources (in priority order):
//   1. Structured NEX fields (business_name, category, categories, amenities,
//      address, phone, whatsapp, star_rating, room_count, rating, review_count,
//      website URL)
//   2. Honesty audit (pricing / free-trial / credit-card signals) when the
//      question is pricing-related
//   3. Honest UNKNOWN (Doctrine #6 label) when the question isn't answerable
//      from what NEX knows
//
// This is composition-first · NEVER invokes an LLM · every answer chunk
// traces to a structured field OR a matched substring from the honesty audit.

import { applyDoctrine6 } from "@/lib/nex/unconfirmed-labeler";
import { getListingDetail, type DirectoryDetail } from "./index";
import { auditWebsiteHonesty, type HonestyVerdict } from "./honesty-audit";

export interface AskResult {
  ref_id: string;
  question: string;
  answer: string;                          // already Doctrine-6-labeled
  sources: Array<{ kind: "structured_field" | "honesty_audit" | "honest_unknown"; field?: string; span?: string }>;
  used_honesty_audit: boolean;
  unconfirmed_claim_count: number;
  ms: number;
}

const _INTENT_PATTERNS: Array<{ id: string; re: RegExp[] }> = [
  { id: "price_free_cc", re: [/\bfree\b/i, /\bcredit card\b/i, /\btrial\b/i, /\bhow much\b/i, /\bcost\b/i, /\bprice\b/i, /\bpricing\b/i, /\bpay(ment)?\b/i, /\bsubscription\b/i, /\bplan\b/i] },
  { id: "amenities", re: [/\bamenit(y|ies)\b/i, /\bfacilit(y|ies)\b/i, /\bwifi\b/i, /\bpool\b/i, /\bbreakfast\b/i, /\bparking\b/i, /\bgym\b/i, /\bair.?con(dition)?\b/i, /\bpets?\b/i] },
  { id: "location", re: [/\bwhere\b/i, /\baddress\b/i, /\blocated?\b/i, /\bcity\b/i, /\bdistrict\b/i, /\bneighbourhood\b/i, /\bnear(by)?\b/i] },
  { id: "contact", re: [/\bphone\b/i, /\bcall\b/i, /\bwhatsapp\b/i, /\bcontact\b/i, /\bemail\b/i, /\breach\b/i] },
  { id: "rating", re: [/\brating\b/i, /\breviews?\b/i, /\bhow (many )?stars?\b/i, /\bstar rating\b/i] },
  { id: "rooms", re: [/\brooms?\b/i, /\bhow many rooms?\b/i, /\bcapacity\b/i, /\bsize\b/i] },
  { id: "category", re: [/\bwhat (type|kind) of\b/i, /\bhotel or\b/i, /\bcategor(y|ies)\b/i, /\btype of business\b/i] },
  { id: "website", re: [/\bwebsite\b/i, /\burl\b/i, /\blink\b/i, /\bofficial site\b/i, /\bhomepage\b/i] },
];

function classifyIntent(question: string): string[] {
  const hits = new Set<string>();
  for (const { id, re } of _INTENT_PATTERNS) {
    if (re.some((r) => r.test(question))) hits.add(id);
  }
  return [...hits];
}

function answerFromStructured(intent: string[], d: DirectoryDetail): { parts: string[]; sources: AskResult["sources"] } {
  const parts: string[] = [];
  const sources: AskResult["sources"] = [];
  const push = (part: string, field: string) => {
    parts.push(part); sources.push({ kind: "structured_field", field });
  };
  if (intent.includes("amenities")) {
    if (d.amenities_full.length > 0) push(`Amenities on record: ${d.amenities_full.join(", ")}.`, "amenities");
    else parts.push("Amenities not listed on NEX.");
  }
  if (intent.includes("location")) {
    const loc = [d.address, d.district, d.city].filter(Boolean).join(", ");
    if (loc) push(`Location: ${loc}.`, "address");
    else parts.push("Location not fully recorded on NEX.");
  }
  if (intent.includes("contact")) {
    if (d.phone) push(`Phone: ${d.phone}.`, "phone");
    if (d.whatsapp) push(`WhatsApp: ${d.whatsapp}.`, "whatsapp_number");
    if (!d.phone && !d.whatsapp) parts.push("Contact details not on record.");
  }
  if (intent.includes("rating")) {
    if (d.rating != null) push(`Rating: ${d.rating.toFixed(1)}${d.review_count ? ` (${d.review_count} reviews)` : ""}.`, "rating");
    if (d.star_rating != null) push(`Star rating: ${d.star_rating}.`, "star_rating");
    if (d.rating == null && d.star_rating == null) parts.push("No rating on record.");
  }
  if (intent.includes("rooms")) {
    if (d.room_count != null) push(`Room count: ${d.room_count}.`, "room_count");
    else parts.push("Room count not recorded.");
  }
  if (intent.includes("category")) {
    if (d.primary_category) push(`Category: ${d.primary_category}${d.categories.length > 1 ? ` (also: ${d.categories.slice(1).join(", ")})` : ""}.`, "category");
    else parts.push("Category not on record.");
  }
  if (intent.includes("website")) {
    if (d.website) push(`Website: ${d.website}`, "website");
    else parts.push("No website on record.");
  }
  return { parts, sources };
}

function answerFromHonesty(intent: string[], v: HonestyVerdict | null): { parts: string[]; sources: AskResult["sources"] } {
  if (!v || !intent.includes("price_free_cc")) return { parts: [], sources: [] };
  const parts: string[] = [];
  const sources: AskResult["sources"] = [];
  if (!v.fetched) {
    parts.push(`Pricing on the official site could not be scanned (site returned an error or blocked our request).`);
    sources.push({ kind: "honesty_audit", span: v.overall_reason });
    return { parts, sources };
  }
  parts.push(`Pricing verdict on landing page: ${v.overall_reason}`);
  sources.push({ kind: "honesty_audit", span: v.overall });
  const cc = v.claims.find((c) => c.kind === "credit_card_required" || c.kind === "credit_card_not_required");
  if (cc) { parts.push(`Credit-card signal: "${cc.matched}"`); sources.push({ kind: "honesty_audit", span: cc.matched }); }
  const trial = v.claims.find((c) => c.kind === "trial_length_days");
  if (trial) { parts.push(`Trial length detected: ${trial.detail} days.`); sources.push({ kind: "honesty_audit", span: String(trial.matched) }); }
  if (v.contradictions.length > 0) {
    parts.push(`⚠ Contradictions on the site: ${v.contradictions.join(", ")}.`);
    sources.push({ kind: "honesty_audit", span: v.contradictions.join(",") });
  }
  return { parts, sources };
}

export async function askListing(args: {
  ref_id: string;
  question: string;
  language?: string;
  scan_site?: boolean;
}): Promise<AskResult | null> {
  const t0 = performance.now();
  const q = args.question.trim();
  const detail = await getListingDetail(args.ref_id);
  if (!detail) return null;
  const intent = classifyIntent(q);
  if (intent.length === 0) intent.push("category", "location", "contact");   // sensible default

  // Structured fields first (deterministic).
  const s = answerFromStructured(intent, detail);
  let parts = [...s.parts];
  let sources = [...s.sources];

  // Honesty audit only if the question is pricing-related and site exists.
  let used_honesty = false;
  if (intent.includes("price_free_cc") && detail.website && args.scan_site !== false) {
    const v = await auditWebsiteHonesty(detail.ref_id, detail.website);
    const h = answerFromHonesty(intent, v);
    if (h.parts.length > 0) { parts.push(...h.parts); sources.push(...h.sources); used_honesty = true; }
  }

  if (parts.length === 0) {
    parts = [`I don't have that on record for ${detail.title}.`];
    sources = [{ kind: "honest_unknown" }];
  }

  const raw = parts.join(" ");
  const labeled = applyDoctrine6({
    text: raw,
    has_verified_evidence: sources.some((s) => s.kind === "structured_field"),
    language: args.language ?? "en",
  });
  return {
    ref_id: detail.ref_id,
    question: q,
    answer: labeled.labeled_text,
    sources,
    used_honesty_audit: used_honesty,
    unconfirmed_claim_count: labeled.unconfirmed_claim_count,
    ms: Math.round(performance.now() - t0),
  };
}
