// src/lib/nex-native/site-service.ts
//
// Wave D Slice 16a · Prompt-driven 1-page site builder.
// -------------------------------------------------------
// Founder directive 2026-09-25: merchants type a PROMPT and NEX generates a
// beautiful 1-page site with a Contact/Chat button that routes into the
// merchant's real conversation surface.
//
// Doctrine kept intact:
//   · Prompt drives STYLE + microcopy defaults · content is real business data
//   · No LLM in the loop this slice · deterministic keyword extraction
//   · Chat CTA always routes to /nex-native/<business.slug>
//   · One template ships (modern-minimal) · more templates in phase 2

import "server-only";
import { randomBytes } from "node:crypto";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid, NexTimestamp } from "./types";

export type NexSiteTemplate = "modern-minimal" | "warm-artisan";
export const NEX_SITE_TEMPLATES: readonly NexSiteTemplate[] = ["modern-minimal", "warm-artisan"] as const;

export type NexSiteAccent =
  | "sage" | "amber" | "slate" | "rose" | "indigo" | "black";

export const NEX_SITE_ACCENTS: readonly NexSiteAccent[] = [
  "sage", "amber", "slate", "rose", "indigo", "black",
] as const;

export type NexSiteSection =
  | "hero" | "banners" | "features" | "products" | "pricing"
  | "gallery" | "testimonials" | "faq" | "cta_band" | "hours_contact";

export const NEX_SITE_SECTIONS: readonly NexSiteSection[] = [
  "hero", "banners", "features", "products", "pricing",
  "gallery", "testimonials", "faq", "cta_band", "hours_contact",
] as const;

export const DEFAULT_SECTIONS: readonly NexSiteSection[] = [
  "hero", "banners", "features", "products", "cta_band", "hours_contact",
] as const;

export interface NexSiteParams {
  accent: NexSiteAccent;
  hero_headline: string;
  hero_subline: string;
  cta_label: string;
  /** Ordered · every entry must be in NEX_SITE_SECTIONS · Slice 16d. */
  sections?: NexSiteSection[];
  /** Legacy flags · retained for backward compat with pre-16d rows. */
  show_products?: boolean;
  show_hours?: boolean;
  show_banners?: boolean;
}

export interface NexGeneratedSiteRow {
  id: NexUuid;
  business_id: NexUuid;
  prompt: string;
  template_name: NexSiteTemplate;
  params: NexSiteParams;
  view_token: string;
  published_at: NexTimestamp | null;
  created_at: NexTimestamp;
  updated_at: NexTimestamp;
}

// ---------------------------------------------------------------------------
// Prompt → params (deterministic · keyword-based · no LLM)
// ---------------------------------------------------------------------------

const ACCENT_KEYWORDS: Record<NexSiteAccent, string[]> = {
  sage:   ["sage", "green", "nature", "organic", "botanical", "eco"],
  amber:  ["amber", "gold", "warm", "sun", "honey", "brass", "artisan"],
  slate:  ["slate", "grey", "gray", "cool", "minimal", "clean", "industrial"],
  rose:   ["rose", "pink", "blush", "romantic", "soft"],
  indigo: ["indigo", "blue", "deep", "trust", "professional", "corporate"],
  black:  ["black", "monochrome", "bold", "luxury", "premium", "high-end"],
};

// Distinctive accents first · slate (the fallback) is checked LAST so that
// generic keywords like "minimal" don't shadow a more specific "luxury/black".
const ACCENT_PRIORITY: readonly NexSiteAccent[] = [
  "black", "indigo", "rose", "amber", "sage", "slate",
] as const;

function pickAccentFromPrompt(prompt: string): NexSiteAccent {
  const p = prompt.toLowerCase();
  // Explicit accent name in the prompt wins (user's direct intent).
  for (const a of NEX_SITE_ACCENTS) {
    if (p.includes(a)) return a;
  }
  // Otherwise fall through to keyword priority (distinctive first).
  for (const a of ACCENT_PRIORITY) {
    if (ACCENT_KEYWORDS[a].some((kw) => p.includes(kw))) return a;
  }
  return "slate";
}

const HEADLINE_HINT_KEYWORDS = ["bespoke", "handmade", "custom", "artisan", "premium", "modern", "luxury"];

function pickHeadline(prompt: string, businessName: string, description: string | null): string {
  // If the prompt itself starts with "make", "build", "create", strip those and use as headline
  const cleaned = prompt.trim().replace(/^(make|build|create|design)\s+(me\s+)?(a\s+)?(site|page|app|website)(\s+for)?/i, "").trim();
  if (cleaned.length > 8 && cleaned.length < 80 && !cleaned.includes("\n")) {
    // Capitalise first letter
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  // Prefer a hint keyword if present in prompt + build headline
  const p = prompt.toLowerCase();
  const hint = HEADLINE_HINT_KEYWORDS.find((kw) => p.includes(kw));
  if (hint) {
    return `${hint.charAt(0).toUpperCase() + hint.slice(1)} ${businessName}`;
  }
  return businessName;
}

function pickSubline(prompt: string, description: string | null): string {
  if (description && description.trim().length > 0 && description.length < 240) {
    return description.trim();
  }
  const p = prompt.trim();
  if (p.length > 20 && p.length < 240) return p;
  return "Message us on NEX to start a conversation.";
}

function pickCtaLabel(prompt: string): string {
  const p = prompt.toLowerCase();
  if (/quote|estimate/i.test(p)) return "Get a quote";
  if (/book/i.test(p)) return "Book a call";
  if (/shop|buy/i.test(p)) return "See products";
  return "Message us";
}

/** Deterministic · never fabricates business data. Only style + microcopy defaults. */
export function paramsFromPrompt(
  prompt: string,
  business: { display_name: string; description: string | null },
): NexSiteParams {
  return {
    accent: pickAccentFromPrompt(prompt),
    hero_headline: pickHeadline(prompt, business.display_name, business.description),
    hero_subline: pickSubline(prompt, business.description),
    cta_label: pickCtaLabel(prompt),
    sections: [...DEFAULT_SECTIONS],
    show_products: true,
    show_hours: true,
    show_banners: true,
  };
}

/** Return the effective ordered sections for a site · honours legacy flags. */
export function effectiveSections(params: NexSiteParams): NexSiteSection[] {
  if (Array.isArray(params.sections) && params.sections.length > 0) {
    return params.sections.filter((s): s is NexSiteSection =>
      (NEX_SITE_SECTIONS as readonly string[]).includes(s));
  }
  // Backward compat: derive from legacy flags
  const out: NexSiteSection[] = ["hero"];
  if (params.show_banners !== false) out.push("banners");
  out.push("features");
  if (params.show_products !== false) out.push("products");
  out.push("cta_band");
  if (params.show_hours !== false) out.push("hours_contact");
  return out;
}

/** Slice 16e · direct field update on a draft site (Engine 1 · deterministic).
 *  Whitelisted fields only · normalises strings · never regenerates from prompt.
 *  Existing accent CHECK still enforced via app-side enum match. */
export type NexSiteEditableField =
  | "hero_headline" | "hero_subline" | "cta_label" | "accent";
export const NEX_SITE_EDITABLE_FIELDS: readonly NexSiteEditableField[] = [
  "hero_headline", "hero_subline", "cta_label", "accent",
] as const;

export async function updateSiteField(
  id: NexUuid,
  field: NexSiteEditableField,
  value: string,
): Promise<NexGeneratedSiteRow> {
  if (!(NEX_SITE_EDITABLE_FIELDS as readonly string[]).includes(field)) {
    throw new Error(`site-service.updateSiteField: field '${field}' not editable`);
  }
  const existing = await getSiteById(id);
  if (!existing) throw new Error("site-service.updateSiteField: not found");
  const newParams: NexSiteParams = { ...existing.params };
  if (field === "accent") {
    const v = value.trim().toLowerCase();
    if (!(NEX_SITE_ACCENTS as readonly string[]).includes(v)) {
      throw new Error(`site-service.updateSiteField: unknown accent '${v}'`);
    }
    newParams.accent = v as NexSiteAccent;
  } else {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new Error(`site-service.updateSiteField: '${field}' cannot be empty`);
    }
    if (trimmed.length > 240) {
      throw new Error(`site-service.updateSiteField: '${field}' max 240 chars`);
    }
    (newParams as Record<string, string>)[field] = trimmed;
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_generated_site")
    .update({ params: newParams })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`site-service.updateSiteField: ${error.message}`);
  return data as NexGeneratedSiteRow;
}

/** Set the sections array on a site · validates all entries + dedups. */
export async function updateSiteSections(
  id: NexUuid,
  sections: NexSiteSection[],
): Promise<NexGeneratedSiteRow> {
  const existing = await getSiteById(id);
  if (!existing) throw new Error("site-service.updateSiteSections: not found");
  const uniq = Array.from(new Set(sections)).filter(
    (s): s is NexSiteSection => (NEX_SITE_SECTIONS as readonly string[]).includes(s),
  );
  if (uniq.length === 0) throw new Error("site-service.updateSiteSections: at least one section required");
  const newParams: NexSiteParams = { ...existing.params, sections: uniq };
  const { data, error } = await nexSupabaseAdmin
    .from("nex_generated_site")
    .update({ params: newParams })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`site-service.updateSiteSections: ${error.message}`);
  return data as NexGeneratedSiteRow;
}

function generateViewToken(): string {
  // 16 chars · lowercase alphanumeric to satisfy DB CHECK
  const raw = randomBytes(12).toString("base64").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (raw.length >= 16) return raw.slice(0, 16);
  // Fall back: pad from another draw (very rare)
  return (raw + Math.random().toString(36).slice(2)).slice(0, 16);
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createSite(input: {
  business_id: NexUuid;
  prompt: string;
  template_name?: NexSiteTemplate;
  business: { display_name: string; description: string | null };
}): Promise<NexGeneratedSiteRow> {
  const promptTrimmed = input.prompt.trim();
  if (promptTrimmed.length > 2000) {
    throw new Error("site-service.createSite: prompt max 2000 chars");
  }
  const template = input.template_name ?? "modern-minimal";
  if (!NEX_SITE_TEMPLATES.includes(template)) {
    throw new Error(`site-service.createSite: unknown template '${template}'`);
  }
  const params = paramsFromPrompt(promptTrimmed, input.business);
  const token = generateViewToken();
  const { data, error } = await nexSupabaseAdmin
    .from("nex_generated_site")
    .insert({
      business_id: input.business_id,
      prompt: promptTrimmed,
      template_name: template,
      params,
      view_token: token,
    })
    .select("*")
    .single();
  if (error) throw new Error(`site-service.createSite: ${error.message}`);
  return data as NexGeneratedSiteRow;
}

export async function listSitesByBusiness(businessId: NexUuid): Promise<NexGeneratedSiteRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_generated_site")
    .select("*")
    .eq("business_id", businessId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`site-service.listSitesByBusiness: ${error.message}`);
  return (data as NexGeneratedSiteRow[]) ?? [];
}

export async function getSiteById(id: NexUuid): Promise<NexGeneratedSiteRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_generated_site")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`site-service.getSiteById: ${error.message}`);
  return (data as NexGeneratedSiteRow | null) ?? null;
}

export async function getSiteByToken(token: string): Promise<NexGeneratedSiteRow | null> {
  if (!/^[a-z0-9]{16}$/.test(token)) return null;
  const { data, error } = await nexSupabaseAdmin
    .from("nex_generated_site")
    .select("*")
    .eq("view_token", token)
    .maybeSingle();
  if (error) throw new Error(`site-service.getSiteByToken: ${error.message}`);
  return (data as NexGeneratedSiteRow | null) ?? null;
}

/** Update params or prompt on a site (regenerates params if prompt changes). */
export async function updateSite(
  id: NexUuid,
  patch: {
    prompt?: string;
    params?: Partial<NexSiteParams>;
    business: { display_name: string; description: string | null };
  },
): Promise<NexGeneratedSiteRow> {
  const existing = await getSiteById(id);
  if (!existing) throw new Error("site-service.updateSite: not found");
  const update: Record<string, string | NexSiteParams> = {};
  let newParams = existing.params;
  if (patch.prompt !== undefined) {
    const promptTrimmed = patch.prompt.trim();
    if (promptTrimmed.length > 2000) throw new Error("site-service.updateSite: prompt max 2000 chars");
    update.prompt = promptTrimmed;
    newParams = paramsFromPrompt(promptTrimmed, patch.business);
  }
  if (patch.params !== undefined) {
    newParams = { ...newParams, ...patch.params };
  }
  if (patch.prompt !== undefined || patch.params !== undefined) {
    update.params = newParams;
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_generated_site")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`site-service.updateSite: ${error.message}`);
  return data as NexGeneratedSiteRow;
}

export async function publishSite(id: NexUuid): Promise<NexGeneratedSiteRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_generated_site")
    .update({ published_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`site-service.publishSite: ${error.message}`);
  return data as NexGeneratedSiteRow;
}

export async function unpublishSite(id: NexUuid): Promise<NexGeneratedSiteRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_generated_site")
    .update({ published_at: null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`site-service.unpublishSite: ${error.message}`);
  return data as NexGeneratedSiteRow;
}

// ---------------------------------------------------------------------------
// Slice 16g · applySpec · Engine 2 hook · never called with unvalidated input
// ---------------------------------------------------------------------------
import type { NexSiteSpec } from "./site-spec";
import { specToParams, validateSiteSpec } from "./site-spec";
import { validateSubjectCoherence } from "./site-templates";

export interface ApplySpecOptions {
  business: { display_name: string; description: string | null };
}

/** Create a site from a validated NEX Site Specification.
 *  Runs the validator again defensively · rejects with error code · never
 *  trusts the caller. business_id in the spec MUST match the caller's owned
 *  business (caller checks) · adapter output is untrusted.
 *
 *  Wave 3 · 2026-09-25 · when spec.identity.template_id AND
 *  spec.business.category are both supplied, runs the Template Intent
 *  subject-coherence validator as an additional gate. Throws on any
 *  coherence rejection (BUSINESS_CATEGORY_MISMATCH,
 *  PROHIBITED_CATEGORY_REFERENCED, etc). */
export async function applySpec(
  spec: NexSiteSpec,
  options: ApplySpecOptions,
): Promise<NexGeneratedSiteRow> {
  const check = validateSiteSpec(spec);
  if (!check.ok) {
    throw new Error(`site-service.applySpec: ${check.code} · ${check.message}`);
  }
  const validSpec = check.spec;

  // Wave 3 · Template Intent coherence gate. Skipped when spec is
  // pre-Wave-3 (no template_id or category). When present, mismatched
  // combinations are rejected at the boundary — no site row is written.
  if (validSpec.identity.template_id && validSpec.business.category) {
    const coherence = validateSubjectCoherence({
      business_category: validSpec.business.category,
      template_id: validSpec.identity.template_id,
      sections: validSpec.sections.map((s) => s.type),
      copy_bag: [
        validSpec.content.hero_headline,
        validSpec.content.hero_subline,
        validSpec.content.cta_label,
        options.business.display_name,
        options.business.description ?? "",
      ].filter((s): s is string => typeof s === "string" && s.length > 0),
    });
    if (!coherence.ok) {
      throw new Error(
        `site-service.applySpec: coherence rejection · ${coherence.code} · ${coherence.message}`,
      );
    }
  }
  const params = specToParams(validSpec, {
    hero_headline: options.business.display_name,
    hero_subline: options.business.description ?? "Message us on NEX to start a conversation.",
    cta_label: "Message us",
  });
  const token = generateViewToken();
  const { data, error } = await nexSupabaseAdmin
    .from("nex_generated_site")
    .insert({
      business_id: validSpec.business.business_id,
      prompt: "",   // no free-form prompt · spec-driven creation
      template_name: validSpec.identity.template,
      params,
      view_token: token,
    })
    .select("*")
    .single();
  if (error) throw new Error(`site-service.applySpec: ${error.message}`);
  return data as NexGeneratedSiteRow;
}

export async function deleteSite(id: NexUuid): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_generated_site")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`site-service.deleteSite: ${error.message}`);
}
