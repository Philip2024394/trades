// Explainability — "how did you reach that answer?"
//
// Merchants can ask Nex to open the hood. This module produces a
// deterministic trace: which specialists were consulted, their
// individual confidence, their evidence tables, and (if applicable)
// which conflicts were resolved which way.
//
// The regular Nex reply never shows agent names. `explain()` is the
// only surface that does.

import type { Conflict } from "./confidence";
import type { AgentResult } from "./types";

export type ExplainInput = {
  ask:               string;
  contributions:     AgentResult[];
  conflicts:         Conflict[];
  overall_confidence: "low" | "medium" | "high";
};

export function explain(input: ExplainInput): string {
  const good = input.contributions.filter((c) => !c.error);
  const bad  = input.contributions.filter((c) =>  c.error);

  const lines: string[] = [];
  lines.push(`How I answered "${input.ask}":`);
  lines.push("");
  lines.push(`- ${good.length} specialist${good.length === 1 ? "" : "s"} contributed.`);
  lines.push(`- Overall confidence: ${input.overall_confidence}.`);
  if (input.conflicts.length > 0) {
    lines.push(`- ${input.conflicts.length} conflict${input.conflicts.length === 1 ? "" : "s"} between sources.`);
  }
  lines.push("");
  lines.push("Contributors:");
  for (const c of good) {
    const evTables = c.evidence.tables.length > 0 ? ` [${c.evidence.tables.join(", ")}]` : "";
    const official = c.is_official ? " · official" : "";
    lines.push(`  · ${c.agent_id} (${c.confidence}${official})${evTables}`);
  }
  if (bad.length > 0) {
    lines.push("");
    lines.push("Specialists that couldn't respond:");
    for (const c of bad) lines.push(`  · ${c.agent_id}: ${c.error}`);
  }
  return lines.join("\n");
}
