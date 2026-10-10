// src/lib/nex-agent/code-engine/capability-error-episode.ts
//
// NEX1 · Error Episode · Founder Mandate §13
// Ledger B additive · Zero LLM · Deterministic.
//
// PURPOSE
//   Founder §13: "The Error Episode is the index. The evidence stream
//   contains the details."
//
//   When a real error occurs, an Error Episode is created that references
//   relevant surrounding evidence by evidence_id. This is NOT a log · it is
//   an index into the evidence graph.
//
// INVARIANTS
//   · Every episode has episode_id + project_id + session_id + git_commit
//   · Episode references evidence_ids (not embeds the full evidence)
//   · Twin retrieves the episode + follows evidence_ids to get the world
//   · Zero LLM · deterministic

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const ERROR_EPISODE_VERSION = "error-episode.v1.2026-09-19";

// ── Error Episode shape ─────────────────────────────────────────────────

export interface ErrorEpisode {
  readonly episode_id: string;
  readonly project_id: string;
  readonly session_id: string;
  readonly user_id: string | null;

  readonly parent_change_id: string | null;
  readonly user_request: string | null;
  readonly specification_ref: string | null;

  readonly repository_snapshot_id: string | null;
  readonly git_commit: string | null;

  readonly relevant_evidence_ids: readonly string[];
  readonly changed_files: readonly string[];
  readonly changed_symbols: readonly string[];

  readonly error_type: string;
  readonly error_message: string;
  readonly stack_trace: string | null;

  readonly build_output_evidence_id: string | null;
  readonly test_results_evidence_id: string | null;
  readonly runtime_state_evidence_id: string | null;
  readonly preview_state_evidence_id: string | null;

  readonly detected_by_agent: string;

  readonly created_at_iso: string;
  readonly resolved_at_iso: string | null;
  readonly resolution: "unresolved" | "resolved_by_twin" | "resolved_by_nex1" | "escalated_to_user" | null;

  readonly zero_llm: true;
  readonly ledger: "B";
  readonly version: string;
}

export interface ErrorEpisodeOptions {
  readonly data_root: string;
}

function episodePath(opts: ErrorEpisodeOptions, project_id: string): string {
  return path.join(opts.data_root, "projects", project_id, "error-episodes.jsonl");
}

// ── Create ───────────────────────────────────────────────────────────────

export interface CreateEpisodeInput {
  readonly project_id: string;
  readonly session_id: string;
  readonly user_id?: string | null;
  readonly detected_by_agent: string;
  readonly error_type: string;
  readonly error_message: string;
  readonly stack_trace?: string | null;
  readonly parent_change_id?: string | null;
  readonly user_request?: string | null;
  readonly specification_ref?: string | null;
  readonly git_commit?: string | null;
  readonly repository_snapshot_id?: string | null;
  readonly relevant_evidence_ids?: readonly string[];
  readonly changed_files?: readonly string[];
  readonly changed_symbols?: readonly string[];
  readonly build_output_evidence_id?: string | null;
  readonly test_results_evidence_id?: string | null;
  readonly runtime_state_evidence_id?: string | null;
  readonly preview_state_evidence_id?: string | null;
}

export function createErrorEpisode(input: CreateEpisodeInput, opts: ErrorEpisodeOptions): ErrorEpisode {
  const now = new Date();
  const episode: ErrorEpisode = {
    episode_id: `epi_${now.getTime()}_${randomUUID().slice(0, 8)}`,
    project_id: input.project_id,
    session_id: input.session_id,
    user_id: input.user_id ?? null,
    parent_change_id: input.parent_change_id ?? null,
    user_request: input.user_request ?? null,
    specification_ref: input.specification_ref ?? null,
    repository_snapshot_id: input.repository_snapshot_id ?? null,
    git_commit: input.git_commit ?? null,
    relevant_evidence_ids: input.relevant_evidence_ids ?? [],
    changed_files: input.changed_files ?? [],
    changed_symbols: input.changed_symbols ?? [],
    error_type: input.error_type,
    error_message: input.error_message,
    stack_trace: input.stack_trace ?? null,
    build_output_evidence_id: input.build_output_evidence_id ?? null,
    test_results_evidence_id: input.test_results_evidence_id ?? null,
    runtime_state_evidence_id: input.runtime_state_evidence_id ?? null,
    preview_state_evidence_id: input.preview_state_evidence_id ?? null,
    detected_by_agent: input.detected_by_agent,
    created_at_iso: now.toISOString(),
    resolved_at_iso: null,
    resolution: "unresolved",
    zero_llm: true,
    ledger: "B",
    version: ERROR_EPISODE_VERSION,
  };
  const p = episodePath(opts, input.project_id);
  ensureDir(path.dirname(p));
  appendFileSync(p, JSON.stringify(episode) + "\n");
  return episode;
}

// ── Resolve ──────────────────────────────────────────────────────────────

export function markEpisodeResolved(
  episode_id: string,
  project_id: string,
  resolution: Exclude<ErrorEpisode["resolution"], null | "unresolved">,
  opts: ErrorEpisodeOptions,
): { readonly ok: boolean; readonly reason: string } {
  const p = path.join(opts.data_root, "projects", project_id, "episode-resolutions.jsonl");
  ensureDir(path.dirname(p));
  appendFileSync(p, JSON.stringify({
    episode_id,
    resolution,
    resolved_at_iso: new Date().toISOString(),
  }) + "\n");
  return { ok: true, reason: `resolution_recorded:${resolution}` };
}

// ── Retrieve ─────────────────────────────────────────────────────────────

export interface EpisodeQuery {
  readonly project_id: string;
  readonly session_id?: string;
  readonly resolution_in?: readonly (ErrorEpisode["resolution"])[];
  readonly limit?: number;
}

export interface EpisodeQueryResult {
  readonly episodes: readonly ErrorEpisode[];
  readonly resolutions: Record<string, ErrorEpisode["resolution"]>;
  readonly caller_must_decide: true;
  readonly zero_llm: true;
  readonly ledger: "B";
}

export function retrieveErrorEpisodes(query: EpisodeQuery, opts: ErrorEpisodeOptions): EpisodeQueryResult {
  const episodes = loadEpisodes(query.project_id, opts);
  const resolutions = loadResolutions(query.project_id, opts);
  const resolutionMap: Record<string, ErrorEpisode["resolution"]> = {};
  for (const ep of episodes) resolutionMap[ep.episode_id] = ep.resolution;
  for (const r of resolutions) resolutionMap[r.episode_id] = r.resolution;

  const filtered = episodes.filter((ep) => {
    if (query.session_id && ep.session_id !== query.session_id) return false;
    if (query.resolution_in) {
      const cur = resolutionMap[ep.episode_id] ?? ep.resolution;
      if (!query.resolution_in.includes(cur)) return false;
    }
    return true;
  });
  const limit = query.limit ?? 100;
  return {
    episodes: filtered.slice(0, limit),
    resolutions: resolutionMap,
    caller_must_decide: true,
    zero_llm: true,
    ledger: "B",
  };
}

export function getEpisode(episode_id: string, project_id: string, opts: ErrorEpisodeOptions): ErrorEpisode | null {
  const episodes = loadEpisodes(project_id, opts);
  return episodes.find((ep) => ep.episode_id === episode_id) ?? null;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function loadEpisodes(project_id: string, opts: ErrorEpisodeOptions): ErrorEpisode[] {
  const p = episodePath(opts, project_id);
  if (!existsSync(p)) return [];
  const out: ErrorEpisode[] = [];
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try { out.push(JSON.parse(trimmed)); } catch { /* skip */ }
  }
  return out;
}

function loadResolutions(project_id: string, opts: ErrorEpisodeOptions): { episode_id: string; resolution: ErrorEpisode["resolution"] }[] {
  const p = path.join(opts.data_root, "projects", project_id, "episode-resolutions.jsonl");
  if (!existsSync(p)) return [];
  const out: { episode_id: string; resolution: ErrorEpisode["resolution"] }[] = [];
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try { out.push(JSON.parse(trimmed)); } catch { /* skip */ }
  }
  return out;
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
