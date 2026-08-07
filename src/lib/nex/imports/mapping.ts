// NEX Data Import Wizard · column mapping
//
// Auto-detects a mapping from CSV/TSV headers to canonical registry fields.
// Any unknown header defaults to "attribute" (lands in attributes[column_name]
// at import time). Explicit "ignore" can be set by the admin for junk columns.
//
// Header signature normalizes column order + names so mapping profiles
// can be matched to future uploads even if the file names / column
// casing / whitespace differ slightly.

import { createHash } from "node:crypto";
import type { CanonicalField, ColumnMapping, MappingTarget } from "./types";

/**
 * Canonical target for a header string. Case-insensitive · punctuation-
 * insensitive. Returns "attribute" when no rule matches (admin can override
 * to a canonical field or to "ignore").
 */
function autoTargetFor(header: string): MappingTarget {
  const norm = header.trim().toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ");
  // Order matters · more specific rules first.
  if (/^(email|e mail|email address|electronic mail|contact email)$/.test(norm)) return "email";
  if (/^(phone|tel|telephone|mobile|whatsapp|contact phone|phone number)$/.test(norm)) return "phone";
  if (/^(name|full name|contact name|display name|person)$/.test(norm)) return "name";
  if (/^(first name|firstname|given name)$/.test(norm)) return "name";      // best-effort · admin can remap
  if (/^(company|business|organisation|organization|trading name|firm)$/.test(norm)) return "company";
  if (/^(country|nation|country code)$/.test(norm)) return "country";
  if (/^(region|city|county|state|province|town|area)$/.test(norm)) return "region";
  if (/^(lifecycle|lifecycle stage|stage|status)$/.test(norm)) return "lifecycle_stage";
  if (/^(tags|labels|category|categories)$/.test(norm)) return "tags";
  if (/^(trade|trades|trade category|trade categories|specialty|primary trade)$/.test(norm)) return "trade_categories";
  return "attribute";
}

/** Produce a default ColumnMapping from a header row. */
export function autoMapping(header: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const col of header) {
    const key = col.trim();
    if (!key) continue;
    mapping[key] = autoTargetFor(col);
  }
  return mapping;
}

/**
 * Merge an admin's manual overrides onto an existing mapping. Only listed
 * columns change · every other column retains its prior target.
 */
export function overrideMapping(current: ColumnMapping, overrides: ColumnMapping): ColumnMapping {
  return { ...current, ...overrides };
}

/**
 * Header signature = SHA-256 (first 16 chars) of the normalized, lowercased,
 * sorted list of column names. Two files with the same set of columns (in
 * any order) share a signature and can suggest the same profile.
 */
export function headerSignature(header: string[]): string {
  const norm = header
    .map((h) => h.trim().toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " "))
    .filter(Boolean)
    .sort();
  return createHash("sha256").update(norm.join("|")).digest("hex").slice(0, 16);
}

/** Which canonical fields are present in the mapping. */
export function mappedCanonicalFields(mapping: ColumnMapping): CanonicalField[] {
  const set = new Set<CanonicalField>();
  for (const target of Object.values(mapping)) {
    if (target !== "attribute" && target !== "ignore") set.add(target);
  }
  return Array.from(set);
}

/** Return { column → value } for a row using the given mapping. */
export function applyMappingToRow(
  header: string[],
  values: string[],
  mapping: ColumnMapping,
): { mapped: Partial<Record<CanonicalField, string>>; attributes: Record<string, string>; ignored: string[] } {
  const mapped: Partial<Record<CanonicalField, string>> = {};
  const attributes: Record<string, string> = {};
  const ignored: string[] = [];
  for (let i = 0; i < header.length; i++) {
    const col = header[i]?.trim();
    if (!col) continue;
    const target = mapping[col] ?? "attribute";
    const value = (values[i] ?? "").trim();
    if (!value) continue;
    if (target === "ignore") { ignored.push(col); continue; }
    if (target === "attribute") { attributes[col] = value; continue; }
    mapped[target] = value;
  }
  return { mapped, attributes, ignored };
}
