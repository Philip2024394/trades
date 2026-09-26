// src/lib/nex-native/site-spec.ts
//
// Wave D Slice 16g · NEX Site Specification (Engine 2 contract).
// -----------------------------------------------------------------
// Founder-sealed doctrine 2026-09-25:
//   · The LLM proposes · NEX owns and validates
//   · Every field/value MUST be in a NEX-owned enum
//   · Unknown values → deterministic rejection (code + message)
//   · Never accepts arbitrary JSX/HTML/URLs
//   · Versioned contract · producers must set `version`
//
// Consumers:
//   · SiteGenAdapter (email-send-adapter analogue) returns this shape
//   · applySpec() validates + creates a nex_generated_site row
//   · The renderer at /site/[token] never reads a spec directly · it
//     always reads the persisted NexSiteParams shape

import "server-only";
import type {
  NexSiteAccent, NexSiteSection, NexSiteTemplate, NexSiteParams,
} from "./site-service";
import { NEX_SITE_ACCENTS, NEX_SITE_SECTIONS, NEX_SITE_TEMPLATES } from "./site-service";

/** Current schema version. Bump when the shape changes materially. */
export const NEX_SITE_SPEC_VERSION = 1 as const;

/** Deterministic rejection codes returned by the validator. Producers
 *  should recognise these so they can retry with a corrected spec.       */
export type SpecError =
  | "MISSING_VERSION"
  | "UNKNOWN_VERSION"
  | "MISSING_IDENTITY"
  | "UNKNOWN_TEMPLATE"
  | "MISSING_BUSINESS"
  | "UNKNOWN_THEME_ACCENT"
  | "MISSING_SECTIONS"
  | "EMPTY_SECTIONS"
  | "UNKNOWN_SECTION_TYPE"
  | "UNKNOWN_CTA_ACTION"
  | "UNKNOWN_MEDIA_SOURCE"
  | "UNKNOWN_PRODUCTS_SOURCE"
  | "INVALID_CONTENT_FIELD"
  | "INVALID_PUBLICATION_STATE";

/** Allowed values for LLM-proposed source references. Renderers ignore any
 *  unknown value · the validator rejects at the boundary. */
export const NEX_SPEC_PRODUCTS_SOURCES = ["business.products"] as const;
export const NEX_SPEC_MEDIA_SOURCES    = ["business.product_images"] as const;
export const NEX_SPEC_CTA_ACTIONS      = ["open_nex_chat", "call_phone", "email"] as const;
export const NEX_SPEC_PUBLICATION      = ["draft", "published"] as const;

/** Content fields the spec may set. Anything else is rejected. */
export const NEX_SPEC_CONTENT_FIELDS = [
  "hero_headline", "hero_subline", "cta_label",
] as const;

// ---------------------------------------------------------------------------
// Spec shape
// ---------------------------------------------------------------------------

export interface NexSiteSpec {
  version: number;
  identity: {
    template: NexSiteTemplate;
    /** Template Intent registry key · Wave 3 · 2026-09-25. Optional for
     *  backward compat: specs from pre-Wave-3 producers omit this field
     *  and applySpec skips the coherence check. Producers that emit it
     *  (Template Picker UI, coherence-aware Engine 2 adapter) get the
     *  full subject-coherence enforcement per sealed doctrine. */
    template_id?: string;
  };
  business: {
    business_id: string;  // caller supplies · adapter must echo
    /** Business category · Wave 3 · 2026-09-25. Optional. When supplied
     *  together with identity.template_id, applySpec runs
     *  validateSubjectCoherence and throws on mismatched combinations. */
    category?: string;
  };
  theme: {
    accent: NexSiteAccent;
  };
  navigation?: {
    /** Reserved for future · currently ignored (Engine 1 has no nav yet). */
    links?: Array<{ label: string; target: "chat" | "products" | "hours" }>;
  };
  sections: Array<{ type: NexSiteSection }>;
  content: Partial<Record<(typeof NEX_SPEC_CONTENT_FIELDS)[number], string>>;
  products?: { source: (typeof NEX_SPEC_PRODUCTS_SOURCES)[number] };
  media?: { source: (typeof NEX_SPEC_MEDIA_SOURCES)[number] };
  ctas?: Array<{ action: (typeof NEX_SPEC_CTA_ACTIONS)[number] }>;
  permissions?: {
    viewer_scope?: "public";
    edit_scope?: "owner_only";
    publish_scope?: "owner_only";
  };
  publication_state: (typeof NEX_SPEC_PUBLICATION)[number];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface SpecValidationOk {
  ok: true;
  spec: NexSiteSpec;
}
export interface SpecValidationErr {
  ok: false;
  code: SpecError;
  message: string;
  field_path?: string;
}
export type SpecValidationResult = SpecValidationOk | SpecValidationErr;

function fail(code: SpecError, message: string, field_path?: string): SpecValidationErr {
  return { ok: false, code, message, field_path };
}

/** Deep-validate a raw spec object from any producer. Returns a discriminated
 *  union so callers get an exact error code · never throws. */
export function validateSiteSpec(raw: unknown): SpecValidationResult {
  if (!raw || typeof raw !== "object") return fail("MISSING_VERSION", "spec must be an object");
  const s = raw as Record<string, unknown>;

  if (typeof s.version !== "number") return fail("MISSING_VERSION", "spec.version is required");
  if (s.version !== NEX_SITE_SPEC_VERSION) return fail("UNKNOWN_VERSION", `only version ${NEX_SITE_SPEC_VERSION} is supported`);

  if (!s.identity || typeof s.identity !== "object") return fail("MISSING_IDENTITY", "spec.identity is required", "identity");
  const identity = s.identity as { template?: unknown };
  if (typeof identity.template !== "string" || !(NEX_SITE_TEMPLATES as readonly string[]).includes(identity.template)) {
    return fail("UNKNOWN_TEMPLATE", `identity.template must be one of [${NEX_SITE_TEMPLATES.join(", ")}]`, "identity.template");
  }

  if (!s.business || typeof s.business !== "object") return fail("MISSING_BUSINESS", "spec.business is required", "business");
  const business = s.business as { business_id?: unknown };
  if (typeof business.business_id !== "string" || business.business_id.length === 0) {
    return fail("MISSING_BUSINESS", "business.business_id is required", "business.business_id");
  }

  if (!s.theme || typeof s.theme !== "object") return fail("UNKNOWN_THEME_ACCENT", "spec.theme is required", "theme");
  const theme = s.theme as { accent?: unknown };
  if (typeof theme.accent !== "string" || !(NEX_SITE_ACCENTS as readonly string[]).includes(theme.accent)) {
    return fail("UNKNOWN_THEME_ACCENT", `theme.accent must be one of [${NEX_SITE_ACCENTS.join(", ")}]`, "theme.accent");
  }

  if (!Array.isArray(s.sections)) return fail("MISSING_SECTIONS", "spec.sections is required", "sections");
  if (s.sections.length === 0) return fail("EMPTY_SECTIONS", "spec.sections must contain at least one section", "sections");
  for (let i = 0; i < s.sections.length; i++) {
    const sec = s.sections[i] as { type?: unknown };
    if (!sec || typeof sec.type !== "string" || !(NEX_SITE_SECTIONS as readonly string[]).includes(sec.type)) {
      return fail("UNKNOWN_SECTION_TYPE", `sections[${i}].type '${String((sec as { type?: unknown })?.type ?? "")}' is not a NEX-owned section`, `sections[${i}].type`);
    }
  }

  const content = (s.content ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(content)) {
    if (!(NEX_SPEC_CONTENT_FIELDS as readonly string[]).includes(key)) {
      return fail("INVALID_CONTENT_FIELD", `content field '${key}' is not editable by AI · owned by Engine 1`, `content.${key}`);
    }
    const v = content[key];
    if (typeof v !== "string" || v.trim().length === 0 || v.length > 240) {
      return fail("INVALID_CONTENT_FIELD", `content.${key} must be a 1..240 char string`, `content.${key}`);
    }
  }

  if (s.products !== undefined) {
    const src = (s.products as { source?: unknown }).source;
    if (typeof src !== "string" || !(NEX_SPEC_PRODUCTS_SOURCES as readonly string[]).includes(src)) {
      return fail("UNKNOWN_PRODUCTS_SOURCE", `products.source must be one of [${NEX_SPEC_PRODUCTS_SOURCES.join(", ")}]`, "products.source");
    }
  }
  if (s.media !== undefined) {
    const src = (s.media as { source?: unknown }).source;
    if (typeof src !== "string" || !(NEX_SPEC_MEDIA_SOURCES as readonly string[]).includes(src)) {
      return fail("UNKNOWN_MEDIA_SOURCE", `media.source must be one of [${NEX_SPEC_MEDIA_SOURCES.join(", ")}]`, "media.source");
    }
  }
  if (s.ctas !== undefined) {
    if (!Array.isArray(s.ctas)) return fail("UNKNOWN_CTA_ACTION", "ctas must be an array", "ctas");
    for (let i = 0; i < s.ctas.length; i++) {
      const c = s.ctas[i] as { action?: unknown };
      if (!c || typeof c.action !== "string" || !(NEX_SPEC_CTA_ACTIONS as readonly string[]).includes(c.action)) {
        return fail("UNKNOWN_CTA_ACTION", `ctas[${i}].action must be one of [${NEX_SPEC_CTA_ACTIONS.join(", ")}]`, `ctas[${i}].action`);
      }
    }
  }

  if (typeof s.publication_state !== "string" || !(NEX_SPEC_PUBLICATION as readonly string[]).includes(s.publication_state)) {
    return fail("INVALID_PUBLICATION_STATE", `publication_state must be one of [${NEX_SPEC_PUBLICATION.join(", ")}]`, "publication_state");
  }

  return { ok: true, spec: raw as NexSiteSpec };
}

// ---------------------------------------------------------------------------
// Spec → NexSiteParams (renderer input)
// ---------------------------------------------------------------------------

/** Convert a validated spec into the NexSiteParams shape the renderer reads.
 *  Missing content fields fall back to sensible defaults · never fabricates
 *  business data (business_id is threaded separately by applySpec). */
export function specToParams(spec: NexSiteSpec, defaults: {
  hero_headline: string; hero_subline: string; cta_label: string;
}): NexSiteParams {
  return {
    accent: spec.theme.accent,
    hero_headline: spec.content.hero_headline ?? defaults.hero_headline,
    hero_subline: spec.content.hero_subline ?? defaults.hero_subline,
    cta_label: spec.content.cta_label ?? defaults.cta_label,
    sections: spec.sections.map((s) => s.type),
  };
}
