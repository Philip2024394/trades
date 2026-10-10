// NEX Code Brain · lesson extractor
// Reads a completed coding-team run's manifest + artefacts and produces a
// single KnowledgeEntry written to the Code Brain knowledge store.
//
// HONESTY POSTURE:
//   · The extractor NEVER fabricates a lesson from an incomplete run.
//   · If the manifest status is not "completed_merged", it refuses.
//   · If required artefacts are missing, it records what IS available and
//     tags the lesson `partial:true`.
//   · The lesson is UNSIGNED. It sits in Code Brain's advisory knowledge
//     store · Ed25519-signed learning-contributions remain the agent-runtime
//     lane's job (see docs/DECISIONS around WO-RUNTIME-*).

import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { addKnowledgeEntry } from "..";
import type { KnowledgeEntry } from "../types";

const REPO_ROOT = process.cwd();

interface RunManifestShape {
  readonly run_id: string;
  readonly founder_prompt: string;
  readonly status: string;
  readonly artifacts_dir: string;
  readonly agent_results: Readonly<Record<string, { verdict: string; summary: string; evidence: readonly string[]; blockers: readonly string[] } | null>>;
  readonly commit_sha: string | null;
}

export type ExtractOutcome =
  | {
      readonly ok: true;
      readonly entry_id: string;
      readonly partial: boolean;
      readonly stage_classification: "REAL";
    }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly stage_classification: "REJECTED" | "NOT_APPLICABLE";
    };

export interface ExtractInput {
  readonly run_id: string;
  readonly contributed_by_lane?: string; // default "nex-coding-primary"
  readonly extra_tags?: readonly string[];
}

/**
 * Read a completed run and write ONE KnowledgeEntry summarising what worked.
 * Refuses if the run didn't reach completed_merged (no false lessons from
 * halted/aborted runs).
 */
export function extractLessonFromRun(input: ExtractInput): ExtractOutcome {
  const manifestPath = path.join(REPO_ROOT, "data", "nex-coding-team", "runs", input.run_id, "manifest.json");
  if (!existsSync(manifestPath)) {
    return { ok: false, reason: `manifest not found: ${manifestPath}`, stage_classification: "REJECTED" };
  }
  let manifest: RunManifestShape;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as RunManifestShape;
  } catch (err) {
    return {
      ok: false,
      reason: `manifest unreadable: ${err instanceof Error ? err.message : String(err)}`,
      stage_classification: "REJECTED",
    };
  }
  if (manifest.status !== "completed_merged") {
    return {
      ok: false,
      reason: `refusing to distill lesson from status="${manifest.status}"; only completed_merged runs produce lessons`,
      stage_classification: "NOT_APPLICABLE",
    };
  }

  const runDir = path.join(REPO_ROOT, manifest.artifacts_dir);
  const specText = readArtefactIfPresent(runDir, "spec.md");
  const ticketText = readArtefactIfPresent(runDir, "ticket.md");
  const reviewText = readArtefactIfPresent(runDir, "review.md");
  const buildNotes = readArtefactIfPresent(runDir, "build-notes.md");

  const partial = !specText || !reviewText;

  const evidence: string[] = [];
  const tags = new Set<string>(input.extra_tags ?? []);
  for (const [agent_id, r] of Object.entries(manifest.agent_results)) {
    if (!r) continue;
    for (const e of r.evidence) evidence.push(e);
    tags.add(agent_id);
  }

  const title = `Run ${input.run_id.slice(0, 12)}… · ${manifest.founder_prompt.slice(0, 80)}`;
  const body = [
    `# Lesson from completed coding-team run`,
    ``,
    `**run_id:** \`${manifest.run_id}\``,
    `**status:** ${manifest.status}`,
    `**commit_sha:** ${manifest.commit_sha ?? "(not merged)"}`,
    ``,
    `## Founder prompt`,
    ``,
    "```",
    manifest.founder_prompt.slice(0, 800),
    "```",
    ``,
    `## Ticket (PM)`,
    ``,
    (ticketText ?? "_missing ticket.md_").slice(0, 1200),
    ``,
    `## Spec (Architect)`,
    ``,
    (specText ?? "_missing spec.md_").slice(0, 1200),
    ``,
    `## Build notes`,
    ``,
    (buildNotes ?? "_missing build-notes.md_").slice(0, 1200),
    ``,
    `## Review`,
    ``,
    (reviewText ?? "_missing review.md_").slice(0, 1200),
    ``,
    partial ? `_Note: partial lesson — some artefacts were missing._` : `_Complete lesson._`,
  ].join("\n");

  const entry = addKnowledgeEntry({
    kind: "pattern",
    title: title.length > 200 ? title.slice(0, 197) + "..." : title,
    body: body.length > 8000 ? body.slice(0, 7997) + "..." : body,
    contributed_by_lane: input.contributed_by_lane ?? "nex-coding-primary",
    contributed_by_agent: "coding-team-runtime",
    applicable_paths: [`data/nex-coding-team/runs/${input.run_id}/`],
    tags: Array.from(tags),
    evidence,
  });
  if (!entry.ok || !entry.entry) {
    return { ok: false, reason: entry.reason ?? "addEntry rejected", stage_classification: "REJECTED" };
  }
  return {
    ok: true,
    entry_id: (entry.entry as KnowledgeEntry).entry_id,
    partial,
    stage_classification: "REAL",
  };
}

function readArtefactIfPresent(runDir: string, fname: string): string | null {
  const p = path.join(runDir, fname);
  if (!existsSync(p)) return null;
  try {
    return readFileSync(p, "utf8");
  } catch {
    return null;
  }
}
