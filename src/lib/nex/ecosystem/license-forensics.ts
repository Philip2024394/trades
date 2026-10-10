// src/lib/nex/ecosystem/license-forensics.ts
//
// UWI · Wave 8.A · License forensics module
// Founder-authorised programme (Rule 5o.E).
//
// Deterministic classification of licence text or SPDX identifier into
// NEX-facing signals: copyleft class · attribution requirement · network
// clause · patent grant · commercial-use permission · NEX compatibility.
//
// Extends Wave 3.1 sourced-review pattern into a reusable module.
// No external service · no LLM · no network.

import type {
  CopyleftClass,
  LicenseForensicsReport,
  LicenseSignals,
} from "./types";

// SPDX identifier → copyleft classification (subset · extend as needed)
const SPDX_TO_CLASS: ReadonlyMap<string, CopyleftClass> = new Map([
  ["MIT", "permissive"],
  ["Apache-2.0", "permissive"],
  ["BSD-2-Clause", "permissive"],
  ["BSD-3-Clause", "permissive"],
  ["ISC", "permissive"],
  ["CC0-1.0", "permissive"],
  ["Unlicense", "permissive"],
  ["Public-Domain", "permissive"],
  ["0BSD", "permissive"],

  ["LGPL-2.1", "weak_copyleft"],
  ["LGPL-2.1-only", "weak_copyleft"],
  ["LGPL-2.1-or-later", "weak_copyleft"],
  ["LGPL-3.0", "weak_copyleft"],
  ["LGPL-3.0-only", "weak_copyleft"],
  ["LGPL-3.0-or-later", "weak_copyleft"],
  ["MPL-2.0", "weak_copyleft"],
  ["EPL-2.0", "weak_copyleft"],

  ["GPL-2.0", "strong_copyleft"],
  ["GPL-2.0-only", "strong_copyleft"],
  ["GPL-2.0-or-later", "strong_copyleft"],
  ["GPL-3.0", "strong_copyleft"],
  ["GPL-3.0-only", "strong_copyleft"],
  ["GPL-3.0-or-later", "strong_copyleft"],

  ["AGPL-3.0", "network_copyleft"],
  ["AGPL-3.0-only", "network_copyleft"],
  ["AGPL-3.0-or-later", "network_copyleft"],
  ["SSPL-1.0", "network_copyleft"],

  ["BSL-1.1", "commercial"],
  ["BUSL-1.1", "commercial"],
]);

// Free-text licence heuristics (used when SPDX identifier is missing).
const TEXT_PATTERNS: ReadonlyArray<{ pattern: RegExp; spdx: string }> = [
  { pattern: /permission is hereby granted, free of charge/i, spdx: "MIT" },
  { pattern: /apache license,?\s*version 2\.0/i, spdx: "Apache-2.0" },
  { pattern: /gnu affero general public license/i, spdx: "AGPL-3.0" },
  { pattern: /server side public license/i, spdx: "SSPL-1.0" },
  { pattern: /gnu (lesser )?general public license,?\s*version 3/i, spdx: "GPL-3.0" },
  { pattern: /gnu (lesser )?general public license,?\s*version 2/i, spdx: "GPL-2.0" },
  { pattern: /mozilla public license,?\s*version 2\.0/i, spdx: "MPL-2.0" },
  { pattern: /business source license/i, spdx: "BSL-1.1" },
  { pattern: /redistribution and use in source and binary forms.*conditions/i, spdx: "BSD-3-Clause" },
];

function detectSpdx(input: { spdx?: string | null; text?: string | null }): { spdx: string | null; source: "explicit" | "text_heuristic" | "unknown" } {
  if (input.spdx && input.spdx.trim().length > 0) {
    return { spdx: input.spdx.trim(), source: "explicit" };
  }
  if (input.text) {
    for (const { pattern, spdx } of TEXT_PATTERNS) {
      if (pattern.test(input.text)) return { spdx, source: "text_heuristic" };
    }
  }
  return { spdx: null, source: "unknown" };
}

function classifyCopyleft(spdx: string | null): CopyleftClass {
  if (!spdx) return "unknown_or_missing";
  return SPDX_TO_CLASS.get(spdx) ?? "unknown_or_missing";
}

function deriveSignals(cls: CopyleftClass, text: string | null): LicenseSignals {
  const has_patent_clause = text ? /patent/i.test(text) : cls === "permissive" && text === null ? false : false;
  return {
    requires_attribution: cls !== "unknown_or_missing" && cls !== "commercial",
    requires_source_redistribution: cls === "strong_copyleft" || cls === "network_copyleft",
    requires_modification_disclosure: cls === "weak_copyleft" || cls === "strong_copyleft" || cls === "network_copyleft",
    network_use_clause: cls === "network_copyleft",
    patent_grant: has_patent_clause,
    commercial_use_permitted: cls !== "commercial", // permissive/copyleft all permit; commercial licenses explicitly restrict
  };
}

function deriveNexCompatibility(cls: CopyleftClass): { compatible: boolean; requires_legal_review: boolean; note: string } {
  switch (cls) {
    case "permissive":
      return { compatible: true, requires_legal_review: false, note: "permissive licence · NEX-safe (with attribution preserved)" };
    case "weak_copyleft":
      return { compatible: true, requires_legal_review: true, note: "weak copyleft · modification-disclosure required · dynamic-link-only for LGPL · legal review before adoption" };
    case "strong_copyleft":
      return { compatible: false, requires_legal_review: true, note: "GPL strong copyleft · derivative works must be GPL · NEX-proprietary code would need re-licensing · REJECT unless dedicated GPL sub-project" };
    case "network_copyleft":
      return { compatible: false, requires_legal_review: true, note: "AGPL/SSPL network clause · serving via API forces source disclosure · REJECT for NEX runtime unless dedicated policy branch" };
    case "commercial":
      return { compatible: false, requires_legal_review: true, note: "commercial/BSL licence · requires paid licence for production · legal review required" };
    case "unknown_or_missing":
      return { compatible: false, requires_legal_review: true, note: "licence unknown or missing · MUST NOT adopt · escalate to legal review" };
  }
}

export function analyseLicense(input: {
  spdx?: string | null;
  text?: string | null;
}): LicenseForensicsReport {
  const detected = detectSpdx(input);
  const copyleft_class = classifyCopyleft(detected.spdx);
  const signals = deriveSignals(copyleft_class, input.text ?? null);
  const compat = deriveNexCompatibility(copyleft_class);
  const notes: string[] = [];
  if (detected.source === "text_heuristic") notes.push(`SPDX identified via text heuristic (${detected.spdx}) · confirm authoritatively before adoption`);
  if (detected.source === "unknown") notes.push("no SPDX identifier and no matching licence text · unknown-or-missing classification");
  notes.push(compat.note);

  return {
    checked_at_iso: new Date().toISOString(),
    spdx_identifier: detected.spdx,
    raw_license_text: input.text ?? null,
    copyleft_class,
    signals,
    nex_compatible: compat.compatible,
    requires_legal_review: compat.requires_legal_review,
    notes,
  };
}
