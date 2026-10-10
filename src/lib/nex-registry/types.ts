// src/lib/nex-registry/types.ts
//
// NEX Registry · Foundation Types (Ledger B additive · Zero LLM)
//
// Governs every entry that flows into NEX1 Workstation Live's creation library.
// Anti-fabrication invariant: no entry becomes CORE/APPROVED without an
// evidence-backed ProvenanceRecord.

import { createHash } from "node:crypto";

export const NEX_REGISTRY_VERSION = "nex-registry.v1.2026-09-19";

// ── License classes (§10) ─────────────────────────────────────────────
export type LicenseClass =
  | "MIT"
  | "APACHE_2_0"
  | "ISC"
  | "BSD_3_CLAUSE"
  | "BSD_2_CLAUSE"
  | "SIL_OFL"
  | "CC0"
  | "CC_BY"
  | "CC_BY_SA"
  | "GPL_3"
  | "LGPL_3"
  | "MPL_2"
  | "COMMERCIAL"
  | "PROPRIETARY_NEX"
  | "UNCLEAR"
  | "REVIEW_REQUIRED";

export const COMMERCIAL_SAFE_LICENSES: readonly LicenseClass[] = Object.freeze([
  "MIT",
  "APACHE_2_0",
  "ISC",
  "BSD_3_CLAUSE",
  "BSD_2_CLAUSE",
  "SIL_OFL",
  "CC0",
  "MPL_2",
  "PROPRIETARY_NEX",
]);

// ── Quality tiers (§23) ───────────────────────────────────────────────
export type QualityTier =
  | "CORE"          // Approved NEX foundation
  | "APPROVED"      // Safe and verified external material
  | "ALTERNATIVE"   // Good but not default
  | "SPECIALIST"    // Only for particular products
  | "EXPERIMENTAL"  // Not production default
  | "LEGACY"        // Existing but not recommended for new work
  | "QUARANTINED"   // License/security/quality unresolved
  | "DO_NOT_USE";   // Explicitly rejected

export const AUTO_SELECTABLE_TIERS: readonly QualityTier[] = Object.freeze([
  "CORE",
  "APPROVED",
]);

// ── Registry categories (§22) ─────────────────────────────────────────
export type RegistryCategory =
  | "component"
  | "icon"
  | "font"
  | "animation"
  | "section"
  | "asset"
  | "template"
  | "layout"
  | "design_system";

export const REGISTRY_CATEGORIES: readonly RegistryCategory[] = Object.freeze([
  "component",
  "icon",
  "font",
  "animation",
  "section",
  "asset",
  "template",
  "layout",
  "design_system",
]);

// ── Modernity status (§20 template age filter) ────────────────────────
export type ModernityStatus =
  | "current"       // Released or updated recently · matches modern practice
  | "modern"        // Contemporary but not the newest wave
  | "legacy"        // Older but still viable
  | "outdated"      // Materially obsolete design conventions
  | "not_assessed";

// ── Security status ────────────────────────────────────────────────────
export type SecurityStatus =
  | "clean"
  | "review_required"
  | "not_scanned";

// ── Accessibility status ───────────────────────────────────────────────
export type AccessibilityStatus =
  | "aria_verified"
  | "keyboard_verified"
  | "aria_and_keyboard_verified"
  | "not_assessed";

// ── Visual quality band (deterministic bands only) ─────────────────────
export type VisualQualityBand =
  | "excellent"
  | "good"
  | "acceptable"
  | "needs_review"
  | "not_assessed";

// ── NEX compatibility ──────────────────────────────────────────────────
export type NexCompatibility =
  | "verified"           // Real integration proof exists
  | "adapter_required"   // Works via a NEX adapter
  | "unknown";

// ── ProvenanceRecord (§21 · every external component must carry this) ─
export interface ProvenanceRecord {
  readonly source_repository: string | null;   // e.g. "shadcn/ui" · null for NEX-native
  readonly source_url: string | null;
  readonly source_commit: string | null;
  readonly source_version: string | null;
  readonly license: LicenseClass;
  readonly license_verified: boolean;
  readonly framework: readonly string[];       // e.g. ["react","tailwindcss"]
  readonly dependencies: readonly string[];    // npm package names
  readonly security_status: SecurityStatus;
  readonly accessibility_status: AccessibilityStatus;
  readonly visual_quality: VisualQualityBand;
  readonly modernity_status: ModernityStatus;
  readonly nex_compatibility: NexCompatibility;
  readonly nex_modifications: readonly string[];
  readonly import_date: string;                // ISO
  readonly provenance_hash: string;            // SHA-256 of the record content
}

// ── Device support (§5-§7 · desktop/tablet/mobile/pwa) ────────────────
export interface DeviceSupport {
  readonly desktop: boolean;
  readonly tablet: boolean;
  readonly mobile: boolean;
  readonly pwa: boolean;
}

// ── Library entry (union · every registry item conforms) ──────────────
export interface LibraryEntry {
  readonly entry_id: string;                   // deterministic SHA-256 prefix
  readonly category: RegistryCategory;
  readonly name: string;
  readonly description: string;
  readonly quality_tier: QualityTier;
  readonly provenance: ProvenanceRecord;
  readonly usage_context: readonly string[];   // e.g. ["desktop","mobile","dashboard"]
  readonly variants: readonly string[];        // e.g. ["primary","secondary","outline"]
  readonly device_support: DeviceSupport;
  readonly path_in_repo: string | null;        // where the implementation lives (if native)
  readonly proxy_target: string | null;        // if this entry is a proxy pointer to another store
  readonly documented_at_iso: string;
  readonly zero_llm: true;
  readonly ledger: "B";
}

// ── Deterministic ID and hash helpers ─────────────────────────────────
export function computeProvenanceHash(rec: Omit<ProvenanceRecord, "provenance_hash">): string {
  const payload = JSON.stringify({
    source_repository: rec.source_repository,
    source_url: rec.source_url,
    source_commit: rec.source_commit,
    source_version: rec.source_version,
    license: rec.license,
    license_verified: rec.license_verified,
    framework: [...rec.framework].sort(),
    dependencies: [...rec.dependencies].sort(),
    security_status: rec.security_status,
    accessibility_status: rec.accessibility_status,
    visual_quality: rec.visual_quality,
    modernity_status: rec.modernity_status,
    nex_compatibility: rec.nex_compatibility,
    nex_modifications: [...rec.nex_modifications].sort(),
    import_date: rec.import_date,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function computeEntryId(input: {
  category: RegistryCategory;
  name: string;
  source_repository: string | null;
}): string {
  const payload = `${input.category}::${input.name}::${input.source_repository ?? "nex-native"}`;
  return createHash("sha256").update(payload).digest("hex").slice(0, 20);
}

// ── Type guards ────────────────────────────────────────────────────────
export function isCommercialSafe(license: LicenseClass): boolean {
  return COMMERCIAL_SAFE_LICENSES.includes(license);
}

export function isAutoSelectable(tier: QualityTier): boolean {
  return AUTO_SELECTABLE_TIERS.includes(tier);
}

export function requiresLicenseReview(license: LicenseClass): boolean {
  return license === "UNCLEAR"
      || license === "REVIEW_REQUIRED"
      || license === "COMMERCIAL"
      || license === "GPL_3"
      || license === "LGPL_3"
      || license === "CC_BY_SA";
}
