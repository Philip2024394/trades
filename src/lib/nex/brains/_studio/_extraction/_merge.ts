// Extraction confirm-merge — takes an Author-accepted candidate and
// merges its payload into the appropriate draft module.
//
// This is the only path by which extraction output ever reaches a
// real Brain module. Every merge requires the Author's Accept action
// captured in the queue (status = "accepted" or "edited"). Nothing
// merges automatically.

import "server-only";
import { z } from "zod";
import {
  MODULE_SCHEMAS,
  BrainManifestSchema,
  type V1ModuleName
} from "@/lib/nex/brains/_schema";
import { readDraft, writeDraft } from "../_draft_store";
import { scaffoldModule } from "../_scaffold";
import type { CandidateKind, ExtractionCandidate } from "./types";

const KIND_TO_MODULE: Record<CandidateKind, V1ModuleName> = {
  "craft.fact":          "craft",
  "craft.glossary":      "craft",
  "regulations.reg":     "regulations",
  "materials.mat":       "materials",
  "workflow.playbook":   "workflow",
  "defects.defect":      "defects",
  "pricing_model.rule":  "pricing_model"
};

export type MergeInput = {
  brain_slug: string;
  author_id:  string;
  candidate:  ExtractionCandidate;
};

export type MergeResult =
  | { ok: true; module: V1ModuleName }
  | { ok: false; reason: "no_draft" | "invalid_payload" | "invalid_module_after_merge"; detail: string };

/** Merge one Accepted candidate into its target draft module. Refuses
 *  to merge if the candidate itself is not Accepted or Edited. */
export async function mergeCandidate(input: MergeInput): Promise<MergeResult> {
  const c = input.candidate;
  if (c.status !== "accepted" && c.status !== "edited") {
    return { ok: false, reason: "invalid_payload", detail: `Candidate status=${c.status} — only 'accepted' or 'edited' can be merged.` };
  }

  const module = KIND_TO_MODULE[c.kind];

  // If no draft yet, auto-scaffold an empty module keyed to this
  // Author. First Accept in a fresh Brain creates the module scaffold
  // implicitly · Author never has to click Save on empty forms first.
  const existing = await readDraft({ brain_slug: input.brain_slug, module });
  const currentPayload = existing?.payload ?? scaffoldModule(module, {
    author_id: input.author_id,
    version:   "0.1.0"
  });
  const version = existing?.version ?? "0.1.0";

  // Apply the candidate to the draft based on its kind. Each apply
  // function is a deterministic list-append into the right sub-field.
  let nextPayload: unknown;
  try {
    nextPayload = applyCandidate(currentPayload, c);
  } catch (err) {
    return { ok: false, reason: "invalid_payload", detail: err instanceof Error ? err.message : String(err) };
  }

  const parsed = MODULE_SCHEMAS[module].safeParse(nextPayload);
  if (!parsed.success) {
    return { ok: false, reason: "invalid_module_after_merge", detail: parsed.error.message };
  }

  await writeDraft({
    brain_slug: input.brain_slug,
    module,
    author_id:  input.author_id,
    version,
    payload:    parsed.data
  });

  return { ok: true, module };
}

// ─── Per-kind apply functions ───────────────────────────────────

type PayloadWithFacts       = { facts:       Array<Record<string, unknown>>; [k: string]: unknown };
type PayloadWithGlossary    = { glossary:    Array<Record<string, unknown>>; [k: string]: unknown };
type PayloadWithRegs        = { regulations: Array<Record<string, unknown>>; [k: string]: unknown };
type PayloadWithMaterials   = { materials:   Array<Record<string, unknown>>; [k: string]: unknown };
type PayloadWithPlaybooks   = { playbooks:   Array<Record<string, unknown>>; [k: string]: unknown };
type PayloadWithDefects     = { defects:     Array<Record<string, unknown>>; [k: string]: unknown };
type PayloadWithPricingRules = { rules:       Array<Record<string, unknown>>; [k: string]: unknown };

function applyCandidate(existing: unknown, c: ExtractionCandidate): unknown {
  const payload = c.payload as Record<string, unknown>;
  switch (c.kind) {
    case "craft.fact": {
      const cur = existing as PayloadWithFacts;
      return { ...cur, facts: [...(cur.facts ?? []), payload] };
    }
    case "craft.glossary": {
      const cur = existing as PayloadWithGlossary;
      return { ...cur, glossary: [...(cur.glossary ?? []), payload] };
    }
    case "regulations.reg": {
      const cur = existing as PayloadWithRegs;
      return { ...cur, regulations: [...(cur.regulations ?? []), payload] };
    }
    case "materials.mat": {
      const cur = existing as PayloadWithMaterials;
      return { ...cur, materials: [...(cur.materials ?? []), payload] };
    }
    case "workflow.playbook": {
      const cur = existing as PayloadWithPlaybooks;
      return { ...cur, playbooks: [...(cur.playbooks ?? []), payload] };
    }
    case "defects.defect": {
      const cur = existing as PayloadWithDefects;
      return { ...cur, defects: [...(cur.defects ?? []), payload] };
    }
    case "pricing_model.rule": {
      const cur = existing as PayloadWithPricingRules;
      return { ...cur, rules: [...(cur.rules ?? []), payload] };
    }
  }
}
