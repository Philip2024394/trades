// Structural loader + validator for Staircase Brain test scenarios.
//
// This module verifies STRUCTURE only. Content correctness is not
// asserted — expected_answer + expected_confidence_tier are marked
// 'pending_author' by design (per ADR-0017 §4 Author authority).
//
// When the Author onboards, they fill in expected_answer +
// expected_confidence_tier per scenario, and this loader will refuse
// the file if any scenario is missing final values.

import { z } from "zod";
import raw from "./staircase_scenarios.json";

export const StaircaseScenarioSchema = z.object({
  id:                          z.string().regex(/^[a-z_]+\.\d{3}$/),
  category:                    z.enum(["identification", "materials", "defects", "estimation", "regulations", "workflow"]),
  question:                    z.string().min(3),
  scope:                       z.record(z.string(), z.unknown()),
  acceptance_criteria:         z.array(z.string().min(3)).min(1),
  expected_answer:             z.union([z.string(), z.record(z.string(), z.unknown())]),
  expected_confidence_tier:    z.union([z.enum(["low", "medium", "high"]), z.literal("pending_author")])
});
export type StaircaseScenario = z.infer<typeof StaircaseScenarioSchema>;

export const StaircaseScenarioFileSchema = z.object({
  brain_slug:        z.literal("staircase"),
  scenario_version:  z.string(),
  generated_at:      z.string(),
  note:              z.string(),
  categories:        z.record(z.string(), z.object({
    target_count: z.number().int().positive(),
    kind:         z.string()
  })),
  scenarios:         z.array(StaircaseScenarioSchema)
});

export function loadStaircaseScenarios(): {
  scenarios: StaircaseScenario[];
  countsByCategory: Record<string, number>;
  authorPending: number;
} {
  const parsed = StaircaseScenarioFileSchema.parse(raw);
  const countsByCategory: Record<string, number> = {};
  let authorPending = 0;
  for (const s of parsed.scenarios) {
    countsByCategory[s.category] = (countsByCategory[s.category] ?? 0) + 1;
    if (s.expected_answer === "pending_author" || s.expected_confidence_tier === "pending_author") {
      authorPending++;
    }
  }
  return { scenarios: parsed.scenarios, countsByCategory, authorPending };
}
