// src/lib/nex/l4-bakeoff/candidates/free-slate-v1.test.ts
//
// V.5.4.2+ · Contract tests for the free-candidate slate v1.
// Founder correction 2026-09-08 · candidate selection must be justified ·
// none of these may be silently "chosen default" until L4 bakeoff ranks them.

import { describe, it, expect } from "vitest";
import { FREE_SLATE_V1, FREE_SLATE_V1_REJECTED_NOTES } from "./free-slate-v1";
import { makeOllamaQwen3_8bIdentity } from "./ollama-qwen3-8b";

describe("V.5.4.2+ · free-slate-v1 · candidate selection discipline", () => {

  it("slate contains multiple realistic free candidates (not just qwen3:8b)", () => {
    expect(FREE_SLATE_V1.length).toBeGreaterThanOrEqual(5);
    const ids = FREE_SLATE_V1.map((f) => f().candidate_id);
    expect(new Set(ids).size).toBe(ids.length); // all unique
  });

  it("every slate member declares self_sustainment_compliant + is_paid_third_party:false", () => {
    for (const factory of FREE_SLATE_V1) {
      const id = factory();
      expect(id.metadata?.is_paid_third_party).toBe(false);
      expect(id.metadata?.self_sustainment_compliant).toBe(true);
    }
  });

  it("every slate member declares license_commercial_ok:true (rejected licenses documented separately)", () => {
    for (const factory of FREE_SLATE_V1) {
      const id = factory();
      const notes = id.metadata?.free_slate_v1_notes as { license_commercial_ok: boolean };
      expect(notes.license_commercial_ok).toBe(true);
    }
  });

  it("no slate member is silently 'chosen_default' — all shortlisted for V.5.4.3 pending measured evidence", () => {
    for (const factory of FREE_SLATE_V1) {
      const id = factory();
      // Founder decision 2026-09-08 promoted all 7 to shortlisted_for_v5_4_3
      // · but NONE is chosen_default · Founder verbatim: "keep all seven
      // unselected_pending_l4_bakeoff until the measurements exist"
      expect(id.metadata?.selection_status).toBe("shortlisted_for_v5_4_3");
      expect(id.metadata?.selection_status).not.toBe("chosen_default");
      // Every shortlisted candidate MUST carry a non-null justification
      // (per Candidate Selection Discipline doctrine)
      expect(typeof id.metadata?.selection_justification).toBe("string");
      expect((id.metadata?.selection_justification as string).length).toBeGreaterThan(20);
    }
  });

  it("V.5.4.1 qwen3-8b identity carries shortlisted_for_v5_4_3 status (Founder shortlist retro-applied · LOW-RESOURCE BASELINE)", () => {
    const id = makeOllamaQwen3_8bIdentity();
    expect(id.metadata?.selection_status).toBe("shortlisted_for_v5_4_3");
    expect(id.metadata?.selection_justification).toContain("LOW-RESOURCE BASELINE");
  });

  it("exactly ZERO candidates hold chosen_default (Founder discipline · no winner declared before measurement)", () => {
    let chosenCount = 0;
    for (const factory of FREE_SLATE_V1) {
      if (factory().metadata?.selection_status === "chosen_default") chosenCount += 1;
    }
    if (makeOllamaQwen3_8bIdentity().metadata?.selection_status === "chosen_default") chosenCount += 1;
    expect(chosenCount).toBe(0);
  });

  it("every shortlisted candidate's justification cites Founder V.5.4.3 shortlist 2026-09-08", () => {
    for (const factory of FREE_SLATE_V1) {
      const j = factory().metadata?.selection_justification as string;
      expect(j).toContain("Founder V.5.4.3 shortlist 2026-09-08");
    }
  });

  it("rejected-notes documents at least one commercially-unusable model with reason", () => {
    expect(FREE_SLATE_V1_REJECTED_NOTES.length).toBeGreaterThan(0);
    for (const r of FREE_SLATE_V1_REJECTED_NOTES) {
      expect(r.family).toBeTruthy();
      expect(r.reason.length).toBeGreaterThan(20);
    }
  });

  it("slate includes candidates from multiple families (not all one vendor)", () => {
    const families = new Set(FREE_SLATE_V1.map((f) => f().model_family));
    // Expect at least 4 distinct model families (qwen3 · llama3 · gemma3 · mistral-small · phi4 · deepseek-r1-distill)
    expect(families.size).toBeGreaterThanOrEqual(4);
  });

  it("slate covers a mix of small (≤10GB VRAM) and larger candidates", () => {
    const small: string[] = [];
    const large: string[] = [];
    for (const factory of FREE_SLATE_V1) {
      const id = factory();
      const notes = id.metadata?.free_slate_v1_notes as { approximate_vram_q4_km_gb: number | "unknown" };
      const v = notes.approximate_vram_q4_km_gb;
      if (typeof v === "number" && v <= 10) small.push(id.candidate_id);
      else if (typeof v === "number" && v > 10) large.push(id.candidate_id);
    }
    expect(small.length).toBeGreaterThanOrEqual(3);
    expect(large.length).toBeGreaterThanOrEqual(1);
  });

  it("slate declares Indonesian coverage on at least one candidate (NEX requirement)", () => {
    const withId: string[] = [];
    for (const factory of FREE_SLATE_V1) {
      const id = factory();
      const notes = id.metadata?.free_slate_v1_notes as { languages_declared: readonly string[] };
      if (notes.languages_declared.some((l) => l.startsWith("id"))) {
        withId.push(id.candidate_id);
      }
    }
    expect(withId.length).toBeGreaterThanOrEqual(1);
  });
});
