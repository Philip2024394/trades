import { describe, it, expect } from "vitest";
import {
  createErrorEpisode,
  retrieveErrorEpisodes,
  markEpisodeResolved,
  getEpisode,
  ERROR_EPISODE_VERSION,
} from "./capability-error-episode";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

function tmp() {
  return { data_root: mkdtempSync(path.join(tmpdir(), "nex1-episode-")) };
}

const base = {
  project_id: "proj_A",
  session_id: "sess_1",
  detected_by_agent: "NEX1",
  error_type: "BuildError",
  error_message: "Module not found",
};

describe("error episode · index into surrounding evidence (§13)", () => {
  it("creates an episode with evidence-id references, not embedded evidence", () => {
    const opts = tmp();
    try {
      const ep = createErrorEpisode({
        ...base,
        relevant_evidence_ids: ["ev_1", "ev_2", "ev_3"],
        build_output_evidence_id: "ev_1",
        changed_files: ["src/foo.ts"],
      }, opts);
      expect(ep.episode_id).toMatch(/^epi_/);
      expect(ep.relevant_evidence_ids).toEqual(["ev_1", "ev_2", "ev_3"]);
      expect(ep.build_output_evidence_id).toBe("ev_1");
      expect(ep.resolution).toBe("unresolved");
    } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
  });

  it("retrieveErrorEpisodes returns episodes for a project", () => {
    const opts = tmp();
    try {
      createErrorEpisode(base, opts);
      createErrorEpisode({ ...base, error_type: "TypeError" }, opts);
      const q = retrieveErrorEpisodes({ project_id: "proj_A" }, opts);
      expect(q.episodes.length).toBe(2);
    } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
  });

  it("markEpisodeResolved records resolution durably", () => {
    const opts = tmp();
    try {
      const ep = createErrorEpisode(base, opts);
      markEpisodeResolved(ep.episode_id, "proj_A", "resolved_by_twin", opts);
      const q = retrieveErrorEpisodes({ project_id: "proj_A" }, opts);
      expect(q.resolutions[ep.episode_id]).toBe("resolved_by_twin");
    } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
  });

  it("filter by resolution status", () => {
    const opts = tmp();
    try {
      const a = createErrorEpisode(base, opts);
      const b = createErrorEpisode({ ...base, error_type: "TypeError" }, opts);
      markEpisodeResolved(a.episode_id, "proj_A", "resolved_by_twin", opts);
      const unresolved = retrieveErrorEpisodes({ project_id: "proj_A", resolution_in: ["unresolved"] }, opts);
      expect(unresolved.episodes.length).toBe(1);
      expect(unresolved.episodes[0].episode_id).toBe(b.episode_id);
    } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
  });

  it("getEpisode retrieves by id", () => {
    const opts = tmp();
    try {
      const ep = createErrorEpisode(base, opts);
      const found = getEpisode(ep.episode_id, "proj_A", opts);
      expect(found?.episode_id).toBe(ep.episode_id);
    } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
  });

  it("multi-project isolation", () => {
    const opts = tmp();
    try {
      createErrorEpisode({ ...base, project_id: "proj_A" }, opts);
      createErrorEpisode({ ...base, project_id: "proj_B" }, opts);
      const a = retrieveErrorEpisodes({ project_id: "proj_A" }, opts);
      const b = retrieveErrorEpisodes({ project_id: "proj_B" }, opts);
      expect(a.episodes.length).toBe(1);
      expect(b.episodes.length).toBe(1);
    } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
  });

  it("canonical version", () => {
    expect(ERROR_EPISODE_VERSION).toBe("error-episode.v1.2026-09-19");
  });
});
