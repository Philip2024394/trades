// src/lib/nex-native/surface-health/signature.ts
//
// Deterministic, non-content-bearing failure_signature derivation per
// doctrine §7.4 (NEX Chat Surfaces × Visual Themes × HQ · 2026-10-03).
//
// Input is restricted at the TYPE boundary to structured dimensions
// only. No conversation content, no raw error text, no PII may enter
// this function — the signature is a dedup/lifecycle key, not an error
// record. The sealed doctrine's anti-pattern list explicitly prohibits
// writing conversation content or raw error text into failure_signature.
//
// Derivation: lowercased + trimmed concat of six dimensions joined by
// '|', then SHA-256 digest truncated to 32 hex chars. Truncation is a
// storage optimisation; 32 hex chars = 128 bits of entropy which is
// comfortably above the collision horizon for a diagnostic dedup key.
//
// Dimensions (sealed order):
//   surface | visual_theme | component_module | error_classification
//   | app_version | theme_version
//
// Changing any dimension — or re-ordering them — would break dedup
// continuity across versions. Treat the order as part of the sealed
// contract.

import { createHash } from "node:crypto";
import type {
  ErrorClassification,
} from "./classification";

export interface FailureSignatureInput {
  surface: string;
  visual_theme: string;
  component_module: string;
  error_classification: ErrorClassification;
  app_version: string | null;
  theme_version: string | null;
}

export function deriveFailureSignature(input: FailureSignatureInput): string {
  const norm = (s: string | null): string =>
    (s ?? "-").toLowerCase().trim();
  const parts = [
    norm(input.surface),
    norm(input.visual_theme),
    norm(input.component_module),
    norm(input.error_classification),
    norm(input.app_version),
    norm(input.theme_version),
  ];
  return createHash("sha256")
    .update(parts.join("|"))
    .digest("hex")
    .slice(0, 32);
}
