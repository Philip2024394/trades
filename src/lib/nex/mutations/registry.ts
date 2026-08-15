// NEX Mutations · declarative registry (Philip 2026-08-14).
//
// Every allowed mutation kind lives here. Adding a new kind is data · not code.
// The mutation engine (propose/apply) knows nothing about specific kinds.

import type { AppBlueprint } from "@/lib/app-builder/blueprint-schema";
import type { MutationRegistration, ValidationResult, MutationProposal } from "./types";
import { setKnown } from "@/lib/app-builder/provenance";

const REGISTRATIONS = new Map<string, MutationRegistration>();

export function registerMutation(reg: MutationRegistration): void {
  REGISTRATIONS.set(reg.kind, reg);
}

export function getMutation(kind: string): MutationRegistration | null {
  return REGISTRATIONS.get(kind) ?? null;
}

export function listMutationKinds(): string[] {
  return [...REGISTRATIONS.keys()];
}

// ============================================================================
// Blueprint helpers · used by multiple registrations
// ============================================================================

function findProductIndex(bp: AppBlueprint, selector: Record<string, unknown>): number {
  const products = bp.data.find((d) => d.id === "products")?.seed ?? [];
  const slug = String(selector.slug ?? "").toLowerCase();
  const name = String(selector.name ?? "").toLowerCase();
  const nameTokens = tokenise(name);
  return products.findIndex((p) => {
    const pSlug = String((p as Record<string, unknown>).slug ?? "").toLowerCase();
    const pName = String((p as Record<string, unknown>).name ?? "").toLowerCase();
    if (slug && pSlug === slug) return true;
    if (!name) return false;
    if (pName === name || pName.includes(name)) return true;
    // Word-intersection · every selector word must appear in the product name
    const productTokens = new Set(tokenise(pName).concat(tokenise(pSlug)));
    if (nameTokens.length > 0 && nameTokens.every((tok) => productTokens.has(tok))) return true;
    return false;
  });
}

function tokenise(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1);
}

function cloneBlueprintForMutation(bp: AppBlueprint): AppBlueprint {
  return structuredClone(bp);
}

function bumpMeta(bp: AppBlueprint): AppBlueprint {
  bp.meta = { ...bp.meta, revision: bp.meta.revision + 1, updatedAt: new Date().toISOString() };
  return bp;
}

function formatCurrency(amount: unknown, currency = "GBP"): string {
  if (typeof amount === "object" && amount !== null && "amount" in amount && typeof (amount as { amount: number }).amount === "number") {
    const value = (amount as { amount: number; currency?: string }).amount;
    const cur = (amount as { currency?: string }).currency ?? currency;
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: cur }).format(value / 100);
  }
  if (typeof amount === "number") {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount / 100);
  }
  return String(amount);
}

// ============================================================================
// product.price
// ============================================================================

registerMutation({
  kind: "product.price",
  validate(bp, selector, newValue): ValidationResult {
    const idx = findProductIndex(bp, selector);
    if (idx < 0) return { ok: false, error: `no product matches selector ${JSON.stringify(selector)}`, resolution: "Confirm the product name/slug" };
    const priceObj = extractPrice(newValue);
    if (!priceObj) return { ok: false, error: "newValue must be { amount: pence, currency? } or a positive number in pence", resolution: "Pass amount as integer pence · e.g. £54.95 → 5495" };
    if (priceObj.amount <= 0 || priceObj.amount > 100_000_00) return { ok: false, error: `price out of sensible bounds · got ${priceObj.amount}p` };
    return { ok: true };
  },
  readCurrent(bp, selector): unknown {
    const idx = findProductIndex(bp, selector);
    return idx >= 0 ? (bp.data.find((d) => d.id === "products")!.seed![idx] as Record<string, unknown>).price : null;
  },
  apply(bp, selector, newValue, mutationId) {
    const next = cloneBlueprintForMutation(bp);
    const products = next.data.find((d) => d.id === "products")!.seed! as Record<string, unknown>[];
    const idx = findProductIndex(next, selector);
    const priceObj = extractPrice(newValue)!;
    products[idx].price = priceObj;
    next.provenance = setKnown(next.provenance, `data.products.${idx}.price`, `owner-mutation:${mutationId}`, "applied via mutation engine");
    bumpMeta(next);
    return { blueprint: next, after: priceObj };
  },
  describe(before, after, selector) {
    const target = selector.slug ?? selector.name ?? "product";
    return `Change price for "${target}" · Current ${formatCurrency(before)} → New ${formatCurrency(after)}`;
  },
  parseInstruction(text): MutationProposal | null {
    // "change the oak staircase price to £5,495" / "set price of oak to £5495"
    const m = /(?:change|update|set)(?:\s+the)?\s+([\w\- ]+?)\s+(?:price\s+to|to\s+£|to)\s*£?\s*([\d,]+(?:\.\d+)?)/i.exec(text);
    if (!m) return null;
    const [, name, rawPrice] = m;
    // Extract product name — strip "staircase price" / trailing filler
    const cleanName = name.replace(/\s+(?:staircase|price|cost|to)\s*$/i, "").trim();
    const amountFloat = Number(rawPrice.replace(/,/g, ""));
    if (!Number.isFinite(amountFloat)) return null;
    const amountPence = Math.round(amountFloat * 100);
    return {
      kind: "product.price",
      selector: { name: cleanName },
      newValue: { amount: amountPence, currency: "GBP" },
      instructionText: text
    };
  }
});

function extractPrice(v: unknown): { amount: number; currency: string } | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return { amount: Math.round(v), currency: "GBP" };
  if (typeof v === "object" && v !== null && "amount" in v) {
    const amount = Number((v as { amount: unknown }).amount);
    const currency = String((v as { currency?: unknown }).currency ?? "GBP");
    if (Number.isFinite(amount) && amount > 0) return { amount: Math.round(amount), currency };
  }
  return null;
}

// ============================================================================
// product.description
// ============================================================================

registerMutation({
  kind: "product.description",
  validate(bp, selector, newValue): ValidationResult {
    if (findProductIndex(bp, selector) < 0) return { ok: false, error: `no product matches selector ${JSON.stringify(selector)}` };
    if (typeof newValue !== "string" || newValue.trim().length < 5) return { ok: false, error: "description must be a string of at least 5 characters" };
    if (newValue.length > 2000) return { ok: false, error: "description too long (max 2000)" };
    return { ok: true };
  },
  readCurrent(bp, selector) {
    const idx = findProductIndex(bp, selector);
    return idx >= 0 ? (bp.data.find((d) => d.id === "products")!.seed![idx] as Record<string, unknown>).description : null;
  },
  apply(bp, selector, newValue, mutationId) {
    const next = cloneBlueprintForMutation(bp);
    const products = next.data.find((d) => d.id === "products")!.seed! as Record<string, unknown>[];
    const idx = findProductIndex(next, selector);
    products[idx].description = String(newValue).trim();
    next.provenance = setKnown(next.provenance, `data.products.${idx}.description`, `owner-mutation:${mutationId}`, "applied via mutation engine");
    bumpMeta(next);
    return { blueprint: next, after: products[idx].description };
  },
  describe(before, after, selector) {
    const target = selector.slug ?? selector.name ?? "product";
    return `Change description for "${target}"\n  Before: "${String(before).slice(0, 80)}${String(before).length > 80 ? "…" : ""}"\n  After:  "${String(after).slice(0, 80)}${String(after).length > 80 ? "…" : ""}"`;
  }
});

// ============================================================================
// product.image
// ============================================================================

registerMutation({
  kind: "product.image",
  validate(bp, selector, newValue): ValidationResult {
    if (findProductIndex(bp, selector) < 0) return { ok: false, error: `no product matches selector ${JSON.stringify(selector)}` };
    if (typeof newValue !== "string" || newValue.trim().length === 0) return { ok: false, error: "image must be a non-empty asset ref or URL" };
    // Accept hero:// refs or https URLs · reject others (constitutional · no fabricated hosts)
    const v = newValue.trim();
    if (!v.startsWith("hero://") && !v.startsWith("https://")) return { ok: false, error: "image must start with hero:// or https://" };
    return { ok: true };
  },
  readCurrent(bp, selector) {
    const idx = findProductIndex(bp, selector);
    const p = idx >= 0 ? (bp.data.find((d) => d.id === "products")!.seed![idx] as Record<string, unknown>) : null;
    return Array.isArray(p?.images) ? p.images[0] : null;
  },
  apply(bp, selector, newValue, mutationId) {
    const next = cloneBlueprintForMutation(bp);
    const products = next.data.find((d) => d.id === "products")!.seed! as Record<string, unknown>[];
    const idx = findProductIndex(next, selector);
    const images = Array.isArray(products[idx].images) ? [...(products[idx].images as unknown[])] : [];
    images[0] = String(newValue).trim();
    products[idx].images = images;
    next.provenance = setKnown(next.provenance, `data.products.${idx}.images.0`, `owner-mutation:${mutationId}`, "applied via mutation engine");
    bumpMeta(next);
    return { blueprint: next, after: images[0] };
  },
  describe(before, after, selector) {
    const target = selector.slug ?? selector.name ?? "product";
    return `Replace primary image for "${target}"\n  Before: ${before ?? "(none)"}\n  After:  ${after}`;
  }
});

// ============================================================================
// page.heading — the hero/simple-heading headline on a page
// ============================================================================

registerMutation({
  kind: "page.heading",
  validate(bp, selector, newValue): ValidationResult {
    const pageId = String(selector.pageId ?? "");
    if (!pageId) return { ok: false, error: "selector.pageId required" };
    const page = bp.pages.find((p) => p.id === pageId);
    if (!page) return { ok: false, error: `no page with id "${pageId}"` };
    const heroSection = page.sections.find((s) => s.registryId.startsWith("hero/") || s.registryId.startsWith("hero."));
    if (!heroSection) return { ok: false, error: `no hero section on page "${pageId}"` };
    if (typeof newValue !== "string" || newValue.trim().length === 0) return { ok: false, error: "heading must be non-empty string" };
    if (newValue.length > 200) return { ok: false, error: "heading too long (max 200)" };
    return { ok: true };
  },
  readCurrent(bp, selector) {
    const page = bp.pages.find((p) => p.id === String(selector.pageId));
    const heroSection = page?.sections.find((s) => s.registryId.startsWith("hero"));
    return (heroSection?.props as Record<string, unknown> | undefined)?.headline ?? null;
  },
  apply(bp, selector, newValue, mutationId) {
    const next = cloneBlueprintForMutation(bp);
    const page = next.pages.find((p) => p.id === String(selector.pageId))!;
    const heroIndex = page.sections.findIndex((s) => s.registryId.startsWith("hero"));
    const hero = page.sections[heroIndex];
    hero.props = { ...hero.props, headline: String(newValue).trim() };
    next.provenance = setKnown(next.provenance, `pages.${selector.pageId}.sections.${heroIndex}.props.headline`, `owner-mutation:${mutationId}`, "applied via mutation engine");
    bumpMeta(next);
    return { blueprint: next, after: hero.props.headline };
  },
  describe(before, after, selector) {
    return `Change "${selector.pageId}" page heading\n  Before: "${before ?? "(none)"}"\n  After:  "${after}"`;
  }
});

// ============================================================================
// product.add
// ============================================================================

registerMutation({
  kind: "product.add",
  validate(bp, _selector, newValue): ValidationResult {
    if (typeof newValue !== "object" || newValue === null) return { ok: false, error: "newValue must be a product object" };
    const p = newValue as Record<string, unknown>;
    for (const f of ["slug", "name", "description", "price", "images"]) {
      if (p[f] === undefined || p[f] === null) return { ok: false, error: `missing required field "${f}"` };
    }
    if (typeof p.slug !== "string" || !/^[a-z0-9-]+$/.test(p.slug)) return { ok: false, error: "slug must be lowercase-alphanumeric-hyphen" };
    const products = bp.data.find((d) => d.id === "products")?.seed ?? [];
    if (products.some((existing) => (existing as Record<string, unknown>).slug === p.slug)) {
      return { ok: false, error: `slug "${p.slug}" already exists`, resolution: "Choose a different slug or use product.description/price to update the existing one" };
    }
    if (!extractPrice(p.price)) return { ok: false, error: "price must be { amount: pence, currency? }" };
    if (!Array.isArray(p.images) || p.images.length === 0) return { ok: false, error: "images must be non-empty array" };
    return { ok: true };
  },
  readCurrent(_bp, _selector) {
    return null; // adding a new record · no "before"
  },
  apply(bp, _selector, newValue, mutationId) {
    const next = cloneBlueprintForMutation(bp);
    const modelIdx = next.data.findIndex((d) => d.id === "products");
    if (modelIdx < 0) throw new Error("no products data model in Blueprint");
    const products = (next.data[modelIdx].seed ?? []) as Record<string, unknown>[];
    products.push(newValue as Record<string, unknown>);
    next.data[modelIdx].seed = products;
    next.provenance = setKnown(next.provenance, `data.products.${products.length - 1}`, `owner-mutation:${mutationId}`, "added via mutation engine");
    bumpMeta(next);
    return { blueprint: next, after: newValue };
  },
  describe(_before, after, _selector) {
    const p = after as Record<string, unknown>;
    return `Add new product: "${p.name}" (slug: ${p.slug}) at ${formatCurrency(p.price)}`;
  }
});

// ============================================================================
// Phase 17 · additional mutation kinds · all use the same governance
// ============================================================================

// ─── contact.email ─────────────────────────────────────────────────
registerMutation({
  kind: "contact.email",
  validate(_bp, _selector, newValue): ValidationResult {
    if (typeof newValue !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newValue.trim())) {
      return { ok: false, error: "must be a valid email address", resolution: "e.g. hello@yourcompany.co.uk" };
    }
    return { ok: true };
  },
  readCurrent(bp) { return bp.identity.contact.primaryEmail ?? null; },
  apply(bp, _selector, newValue, mutationId) {
    const next = cloneBlueprintForMutation(bp);
    next.identity.contact.primaryEmail = String(newValue).trim();
    next.provenance = setKnown(next.provenance, "identity.contact.primaryEmail", `owner-mutation:${mutationId}`, "applied via mutation engine");
    bumpMeta(next);
    return { blueprint: next, after: next.identity.contact.primaryEmail };
  },
  describe(before, after) {
    return `Change contact email\n  Before: ${before ?? "(none)"}\n  After:  ${after}`;
  },
  parseInstruction(text): MutationProposal | null {
    const m = /(?:change|update|set)(?:\s+the|\s+our)?\s+(?:contact\s+)?email(?:\s+to)?\s+([^\s]+@[^\s]+\.[^\s]+)/i.exec(text);
    if (!m) return null;
    return { kind: "contact.email", selector: {}, newValue: m[1], instructionText: text };
  }
});

// ─── contact.phone ─────────────────────────────────────────────────
registerMutation({
  kind: "contact.phone",
  validate(_bp, _selector, newValue): ValidationResult {
    if (typeof newValue !== "string" || newValue.trim().length < 6) return { ok: false, error: "phone number must be at least 6 characters" };
    if (!/^[+0-9()\s\-.]+$/.test(newValue.trim())) return { ok: false, error: "phone number contains unusual characters", resolution: "Use digits, spaces, +, ( ), - only" };
    return { ok: true };
  },
  readCurrent(bp) { return bp.identity.contact.primaryPhone ?? null; },
  apply(bp, _selector, newValue, mutationId) {
    const next = cloneBlueprintForMutation(bp);
    next.identity.contact.primaryPhone = String(newValue).trim();
    next.provenance = setKnown(next.provenance, "identity.contact.primaryPhone", `owner-mutation:${mutationId}`, "applied via mutation engine");
    bumpMeta(next);
    return { blueprint: next, after: next.identity.contact.primaryPhone };
  },
  describe(before, after) {
    return `Change contact phone\n  Before: ${before ?? "(none)"}\n  After:  ${after}`;
  },
  parseInstruction(text): MutationProposal | null {
    const m = /(?:change|update|set)(?:\s+the|\s+our)?\s+(?:contact\s+)?(?:phone|number|telephone)(?:\s+to)?\s+([+0-9()\s\-.]{6,})/i.exec(text);
    if (!m) return null;
    return { kind: "contact.phone", selector: {}, newValue: m[1].trim(), instructionText: text };
  }
});

// ─── service.add + service.description ─────────────────────────────
function findServiceIndex(bp: AppBlueprint, selector: Record<string, unknown>): number {
  const services = bp.data.find((d) => d.id === "services")?.seed ?? [];
  const name = String(selector.name ?? "").toLowerCase();
  const nameTokens = tokenise(name);
  return services.findIndex((s) => {
    const sName = String((s as Record<string, unknown>).name ?? "").toLowerCase();
    if (!name) return false;
    if (sName === name || sName.includes(name)) return true;
    const svcTokens = new Set(tokenise(sName));
    if (nameTokens.length > 0 && nameTokens.every((tok) => svcTokens.has(tok))) return true;
    return false;
  });
}

registerMutation({
  kind: "service.add",
  validate(bp, _selector, newValue): ValidationResult {
    if (typeof newValue !== "object" || newValue === null) return { ok: false, error: "newValue must be a service object" };
    const s = newValue as Record<string, unknown>;
    if (typeof s.name !== "string" || s.name.length < 2) return { ok: false, error: "service name required" };
    if (typeof s.summary !== "string" || s.summary.length < 5) return { ok: false, error: "service summary required" };
    const services = bp.data.find((d) => d.id === "services")?.seed ?? [];
    if (services.some((existing) => String((existing as Record<string, unknown>).name ?? "").toLowerCase() === (s.name as string).toLowerCase())) {
      return { ok: false, error: `service "${s.name}" already exists`, resolution: "Use service.description to update the existing one" };
    }
    return { ok: true };
  },
  readCurrent() { return null; },
  apply(bp, _selector, newValue, mutationId) {
    const next = cloneBlueprintForMutation(bp);
    const modelIdx = next.data.findIndex((d) => d.id === "services");
    if (modelIdx < 0) throw new Error("no services data model in Blueprint");
    const services = (next.data[modelIdx].seed ?? []) as Record<string, unknown>[];
    services.push(newValue as Record<string, unknown>);
    next.data[modelIdx].seed = services;
    next.provenance = setKnown(next.provenance, `data.services.${services.length - 1}`, `owner-mutation:${mutationId}`, "added via mutation engine");
    bumpMeta(next);
    return { blueprint: next, after: newValue };
  },
  describe(_before, after) {
    const s = after as Record<string, unknown>;
    return `Add new service: "${s.name}" · ${s.summary}`;
  }
});

registerMutation({
  kind: "service.description",
  validate(bp, selector, newValue): ValidationResult {
    if (findServiceIndex(bp, selector) < 0) return { ok: false, error: `no service matches selector ${JSON.stringify(selector)}` };
    if (typeof newValue !== "string" || newValue.trim().length < 5) return { ok: false, error: "description must be at least 5 chars" };
    return { ok: true };
  },
  readCurrent(bp, selector) {
    const idx = findServiceIndex(bp, selector);
    return idx >= 0 ? (bp.data.find((d) => d.id === "services")!.seed![idx] as Record<string, unknown>).summary : null;
  },
  apply(bp, selector, newValue, mutationId) {
    const next = cloneBlueprintForMutation(bp);
    const services = next.data.find((d) => d.id === "services")!.seed! as Record<string, unknown>[];
    const idx = findServiceIndex(next, selector);
    services[idx].summary = String(newValue).trim();
    next.provenance = setKnown(next.provenance, `data.services.${idx}.summary`, `owner-mutation:${mutationId}`, "applied via mutation engine");
    bumpMeta(next);
    return { blueprint: next, after: services[idx].summary };
  },
  describe(before, after, selector) {
    return `Change description for service "${selector.name ?? "?"}"\n  Before: "${String(before).slice(0, 80)}"\n  After:  "${String(after).slice(0, 80)}"`;
  }
});

// ─── seo.title-template ────────────────────────────────────────────
registerMutation({
  kind: "seo.title-template",
  validate(_bp, _selector, newValue): ValidationResult {
    if (typeof newValue !== "string" || newValue.trim().length < 3) return { ok: false, error: "title template must be a non-empty string" };
    if (newValue.length > 200) return { ok: false, error: "title template too long (max 200)" };
    return { ok: true };
  },
  readCurrent(bp) { return bp.seo.siteTitleTemplate ?? null; },
  apply(bp, _selector, newValue, mutationId) {
    const next = cloneBlueprintForMutation(bp);
    next.seo.siteTitleTemplate = String(newValue).trim();
    next.provenance = setKnown(next.provenance, "seo.siteTitleTemplate", `owner-mutation:${mutationId}`, "applied via mutation engine");
    bumpMeta(next);
    return { blueprint: next, after: next.seo.siteTitleTemplate };
  },
  describe(before, after) {
    return `Change SEO title template\n  Before: "${before}"\n  After:  "${after}"`;
  }
});

// ─── brand.primary-color ───────────────────────────────────────────
registerMutation({
  kind: "brand.primary-color",
  validate(_bp, _selector, newValue): ValidationResult {
    if (typeof newValue !== "string" || !/^#[0-9a-fA-F]{6}$/.test(newValue.trim())) {
      return { ok: false, error: "colour must be a 6-digit hex like #8b5a2b" };
    }
    return { ok: true };
  },
  readCurrent(bp) { return bp.brand.palette.primary; },
  apply(bp, _selector, newValue, mutationId) {
    const next = cloneBlueprintForMutation(bp);
    next.brand.palette.primary = String(newValue).trim();
    next.provenance = setKnown(next.provenance, "brand.palette.primary", `owner-mutation:${mutationId}`, "applied via mutation engine");
    bumpMeta(next);
    return { blueprint: next, after: next.brand.palette.primary };
  },
  describe(before, after) {
    return `Change brand primary colour\n  Before: ${before}\n  After:  ${after}`;
  },
  parseInstruction(text): MutationProposal | null {
    const m = /(?:change|update|set)(?:\s+the|\s+our)?\s+(?:brand\s+)?(?:primary\s+)?(?:colour|color)(?:\s+to)?\s+(#[0-9a-fA-F]{6})/i.exec(text);
    if (!m) return null;
    return { kind: "brand.primary-color", selector: {}, newValue: m[1], instructionText: text };
  }
});

// ─── product.feature (visibility · toggle featured flag) ───────────
registerMutation({
  kind: "product.feature",
  validate(bp, selector, newValue): ValidationResult {
    if (findProductIndex(bp, selector) < 0) return { ok: false, error: `no product matches selector ${JSON.stringify(selector)}` };
    if (typeof newValue !== "boolean") return { ok: false, error: "featured value must be true or false" };
    return { ok: true };
  },
  readCurrent(bp, selector) {
    const idx = findProductIndex(bp, selector);
    return idx >= 0 ? Boolean((bp.data.find((d) => d.id === "products")!.seed![idx] as Record<string, unknown>).featured) : null;
  },
  apply(bp, selector, newValue, mutationId) {
    const next = cloneBlueprintForMutation(bp);
    const products = next.data.find((d) => d.id === "products")!.seed! as Record<string, unknown>[];
    const idx = findProductIndex(next, selector);
    products[idx].featured = Boolean(newValue);
    next.provenance = setKnown(next.provenance, `data.products.${idx}.featured`, `owner-mutation:${mutationId}`, "applied via mutation engine");
    bumpMeta(next);
    return { blueprint: next, after: products[idx].featured };
  },
  describe(before, after, selector) {
    const target = selector.slug ?? selector.name ?? "product";
    return `${after ? "Feature" : "Unfeature"} "${target}"\n  Before: ${before ? "featured" : "not featured"}\n  After:  ${after ? "featured" : "not featured"}`;
  },
  parseInstruction(text): MutationProposal | null {
    // "make Alpine featured" / "feature the Alpine staircase" / "unfeature Meridian"
    const feat = /(?:make|mark|set|feature)\s+(?:the\s+)?([\w\- ]+?)\s+(?:as\s+)?(featured|not featured|unfeatured)/i.exec(text);
    if (feat) {
      const [, name, verdict] = feat;
      const featured = /^featured$/i.test(verdict);
      return { kind: "product.feature", selector: { name: name.replace(/\s+(?:staircase|range|product)\s*$/i, "").trim() }, newValue: featured, instructionText: text };
    }
    const featSimple = /^feature\s+(?:the\s+)?([\w\- ]+?)(?:\s+(?:staircase|range|product))?\s*$/i.exec(text.trim());
    if (featSimple) {
      return { kind: "product.feature", selector: { name: featSimple[1].trim() }, newValue: true, instructionText: text };
    }
    const unfeat = /^unfeature\s+(?:the\s+)?([\w\- ]+?)(?:\s+(?:staircase|range|product))?\s*$/i.exec(text.trim());
    if (unfeat) {
      return { kind: "product.feature", selector: { name: unfeat[1].trim() }, newValue: false, instructionText: text };
    }
    return null;
  }
});
