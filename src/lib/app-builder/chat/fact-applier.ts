// NEX App Builder · Chat · Fact applier (Philip 2026-08-14).
//
// Takes a Blueprint + { fieldPath, value } → returns updated Blueprint
// with the value written to the correct nested location + provenance
// marked KNOWN with source="customer:chat".
//
// Constitutional rule: only writes to KNOWN paths in the validation
// map. Refuses unknown paths (so a malformed client request can't
// mutate arbitrary Blueprint fields).

import type { AppBlueprint } from "../blueprint-schema";
import { setKnown } from "../provenance";

const ALLOWED_PATHS = new Set([
  "identity.displayName",
  "identity.legalName",
  "identity.aboutBlurb",
  "identity.contact.primaryEmail",
  "identity.contact.primaryPhone",
  "identity.contact.whatsapp",
  "identity.contact.serviceRadius.centre",
  "identity.contact.serviceRadius.radiusMiles",
  "brand.palette.primary",
  "brand.palette.background",
  "brand.palette.foreground"
]);

export type FactApplyResult =
  | { ok: true; blueprint: AppBlueprint }
  | { ok: false; error: string };

export function applyFact(
  bp: AppBlueprint,
  fieldPath: string,
  rawValue: string
): FactApplyResult {
  if (!ALLOWED_PATHS.has(fieldPath)) {
    return { ok: false, error: `path "${fieldPath}" is not customer-writable via chat` };
  }

  const value = coerce(fieldPath, rawValue);
  if (value === null) {
    return { ok: false, error: `invalid value for "${fieldPath}"` };
  }

  // Clone Blueprint (shallow copy of top-level + necessary nested branches)
  const next: AppBlueprint = structuredClone(bp);
  writePath(next, fieldPath, value);

  // Provenance
  next.provenance = setKnown(
    next.provenance,
    fieldPath,
    "customer:chat",
    "supplied via chat"
  );

  // Bookkeeping
  next.meta = {
    ...next.meta,
    revision: next.meta.revision + 1,
    updatedAt: new Date().toISOString()
  };
  next.sourceUtterances = [
    ...next.sourceUtterances,
    `[chat] ${humaniseField(fieldPath)}: ${rawValue}`
  ];

  return { ok: true, blueprint: next };
}

function coerce(fieldPath: string, raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  if (fieldPath === "identity.contact.serviceRadius.centre") {
    return { kind: "postcode", value: trimmed.toUpperCase() };
  }
  if (fieldPath === "identity.contact.serviceRadius.radiusMiles") {
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0 || n > 500) return null;
    return n;
  }
  if (fieldPath.startsWith("brand.palette.")) {
    if (!/^#[0-9a-fA-F]{6}$/.test(trimmed)) return null;
    return trimmed;
  }
  if (fieldPath === "identity.contact.primaryEmail") {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) return null;
    return trimmed;
  }
  return trimmed;
}

function writePath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (cur[key] === undefined || cur[key] === null || typeof cur[key] !== "object") {
      cur[key] = {};
    }
    cur = cur[key] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

function humaniseField(path: string): string {
  return path
    .replace(/^identity\./, "")
    .replace(/^brand\./, "brand › ")
    .replace(/\./g, " › ");
}
