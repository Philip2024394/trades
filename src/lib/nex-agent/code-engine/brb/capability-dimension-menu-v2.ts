// src/lib/nex-agent/code-engine/brb/capability-dimension-menu-v2.ts
//
// NEX1 · γ menu v2 · Semantic-vocabulary extension · Ledger B.
//
// PURPOSE
//   Extend the γ dimension menu with semantic-vocabulary dimensions that
//   check for common negative-connotation and positive-connotation tokens
//   in FIELD NAMES. This tests whether the γ selector can data-derive
//   semantic signals when they exist in the corpus.
//
// IMPORTANT · Preservation Discipline
//   · v2 brain-similarities is FROZEN (LAMBDA-BRAINS-CHECKPOINT).
//     This file does NOT modify v2. It extends the γ menu only.
//   · The original 24-dimension menu (capability-dimension-menu.ts) is
//     unchanged. This is menu v2 — a separate module.
//
// ANTI-CHEATING PROTECTIONS
//   · Vocabularies are DELIBERATELY BROAD (13 negative words · 8 positive
//     words). They are common software-engineering terms · not tuned to
//     any specific test corpus.
//   · Every dimension applies to any experience regardless of schema.
//   · The MENU is Ledger B · the SELECTION is data-derived.
//
// LEDGER DISCLOSURE
//   · The vocabulary is Claude-authored (Ledger B extension of the γ menu)
//   · The specific selection outcome depends only on the corpus
//   · Full γ autonomy (invention of the vocabulary itself) is still NOT
//     proven · Gate 2' remains open. This extends the menu · does not
//     autonomously derive it.

import type { Experience } from "./capability-brain-similarities";
import type { DimensionDefinition } from "./capability-dimension-menu";
import { DIMENSION_MENU as BASE_MENU } from "./capability-dimension-menu";

// ── Semantic vocabularies · deliberately broad ────────────────────────

/** Field-name substrings that suggest failure / negative outcome. */
const NEGATIVE_VOCAB: readonly string[] = [
  "error",
  "fail",
  "silent",
  "dead",
  "broken",
  "orphan",
  "unused",
  "missing",
  "corrupt",
  "warning",
  "danger",
  "invalid",
  "reject",
];

/** Field-name substrings that suggest success / positive outcome. */
const POSITIVE_VOCAB: readonly string[] = [
  "ready",
  "active",
  "healthy",
  "success",
  "verified",
  "valid",
  "available",
  "confirmed",
];

// ── Semantic dimensions · 6 additions ─────────────────────────────────

const SEMANTIC_DIMENSIONS: readonly DimensionDefinition[] = [
  {
    id: "any_field_name_negative_word",
    description: "at least one field name contains a negative-connotation word",
    extract: (e) => {
      const keys = Object.keys(e.facts).map((k) => k.toLowerCase());
      return keys.some((k) => NEGATIVE_VOCAB.some((v) => k.includes(v)));
    },
  },
  {
    id: "any_field_name_positive_word",
    description: "at least one field name contains a positive-connotation word",
    extract: (e) => {
      const keys = Object.keys(e.facts).map((k) => k.toLowerCase());
      return keys.some((k) => POSITIVE_VOCAB.some((v) => k.includes(v)));
    },
  },
  {
    id: "negative_word_with_nonzero_value",
    description: "at least one negative-word field has a non-zero numeric value (semantic failure signal)",
    extract: (e) => {
      for (const [k, v] of Object.entries(e.facts)) {
        if (typeof v === "number" && v !== 0 && NEGATIVE_VOCAB.some((w) => k.toLowerCase().includes(w))) {
          return true;
        }
      }
      return false;
    },
  },
  {
    id: "positive_word_with_nonzero_value",
    description: "at least one positive-word field has a non-zero numeric value (semantic success signal)",
    extract: (e) => {
      for (const [k, v] of Object.entries(e.facts)) {
        if (typeof v === "number" && v !== 0 && POSITIVE_VOCAB.some((w) => k.toLowerCase().includes(w))) {
          return true;
        }
      }
      return false;
    },
  },
  {
    id: "negative_word_with_zero_value",
    description: "at least one negative-word field is zero (semantic absence-of-failure signal)",
    extract: (e) => {
      for (const [k, v] of Object.entries(e.facts)) {
        if (typeof v === "number" && v === 0 && NEGATIVE_VOCAB.some((w) => k.toLowerCase().includes(w))) {
          return true;
        }
      }
      return false;
    },
  },
  {
    id: "positive_word_with_zero_value",
    description: "at least one positive-word field is zero (semantic absence-of-success signal)",
    extract: (e) => {
      for (const [k, v] of Object.entries(e.facts)) {
        if (typeof v === "number" && v === 0 && POSITIVE_VOCAB.some((w) => k.toLowerCase().includes(w))) {
          return true;
        }
      }
      return false;
    },
  },
];

// ── Combined menu ─────────────────────────────────────────────────────

export const DIMENSION_MENU_V2: readonly DimensionDefinition[] = [
  ...BASE_MENU,
  ...SEMANTIC_DIMENSIONS,
];

export const DIMENSION_MENU_V2_VERSION = "dimension-menu.v2.n30";
