import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { promises as fs } from "node:fs";

vi.mock("server-only", () => ({}));

const FIXTURE_SLUG = "fixture_extract_queue";

async function cleanFixture() {
  await fs.rm(path.join(process.cwd(), ".author-studio-drafts", FIXTURE_SLUG), { recursive: true, force: true });
}

beforeEach(cleanFixture);
afterEach(cleanFixture);

describe("extraction queue store", () => {
  it("round-trips a run through save + load", async () => {
    const { saveRun, loadRun } = await import("./_queue");
    const run = {
      run_id: "run_test",
      brain_slug: FIXTURE_SLUG,
      author_id: "author-1",
      input_hash: "abcdef1234567890",
      input_length: 100,
      llm_model: "claude-opus-4-7",
      created_at: new Date().toISOString(),
      candidates: []
    };
    await saveRun(run);
    const loaded = await loadRun(FIXTURE_SLUG, "run_test");
    expect(loaded?.run_id).toBe("run_test");
  });

  it("returns empty list when no runs exist", async () => {
    const { listRuns } = await import("./_queue");
    const runs = await listRuns(FIXTURE_SLUG);
    expect(runs).toEqual([]);
  });

  it("updateCandidate patches only the target candidate", async () => {
    const { saveRun, updateCandidate, loadRun } = await import("./_queue");
    const now = new Date().toISOString();
    await saveRun({
      run_id: "run1",
      brain_slug: FIXTURE_SLUG,
      author_id: "author-1",
      input_hash: "aa",
      input_length: 1,
      llm_model: "m",
      created_at: now,
      candidates: [
        { id: "c1", brain_slug: FIXTURE_SLUG, kind: "craft.fact", payload: {}, source_span: "span", needs_author_source: false, provenance: { llm_model: "m", proposed_at: now, prompt_version: "v", input_hash: "aa" }, status: "pending", admin_status: "unreviewed", review_history: [] },
        { id: "c2", brain_slug: FIXTURE_SLUG, kind: "craft.fact", payload: {}, source_span: null,   needs_author_source: true,  provenance: { llm_model: "m", proposed_at: now, prompt_version: "v", input_hash: "aa" }, status: "pending", admin_status: "unreviewed", review_history: [] }
      ]
    });
    await updateCandidate(FIXTURE_SLUG, "run1", "c1", { status: "accepted", reviewed_at: now });
    const loaded = await loadRun(FIXTURE_SLUG, "run1");
    expect(loaded?.candidates.find((c) => c.id === "c1")?.status).toBe("accepted");
    expect(loaded?.candidates.find((c) => c.id === "c2")?.status).toBe("pending");
  });
});
