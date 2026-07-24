import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { promises as fs } from "node:fs";

vi.mock("server-only", () => ({}));

const FIXTURE_SLUG = "fixture_admin_review";

async function cleanFixture() {
  await fs.rm(path.join(process.cwd(), ".author-studio-drafts", FIXTURE_SLUG), { recursive: true, force: true });
}

beforeEach(cleanFixture);
afterEach(cleanFixture);

async function seedRun(overrides: {
  candidates: Array<{
    id: string; status: "pending" | "accepted" | "edited" | "rejected";
    admin_status: "unreviewed" | "approved" | "rejected" | "changes_requested" | "merged" | "sent_back";
  }>;
}) {
  const { saveRun } = await import("./_queue");
  const now = new Date().toISOString();
  await saveRun({
    run_id: "run_admin",
    brain_slug: FIXTURE_SLUG,
    author_id: "author-1",
    input_hash: "hh",
    input_length: 1,
    llm_model: "test",
    created_at: now,
    candidates: overrides.candidates.map((c) => ({
      id: c.id, brain_slug: FIXTURE_SLUG, kind: "craft.fact",
      payload: {},
      source_span: "s",
      needs_author_source: false,
      provenance: { llm_model: "test", proposed_at: now, prompt_version: "v", input_hash: "h" },
      status: c.status,
      admin_status: c.admin_status,
      review_history: []
    }))
  });
}

describe("Admin queue helpers", () => {
  it("listAdminPending returns only Author-accepted candidates with unreviewed admin_status", async () => {
    // Admin's active work queue = candidates awaiting Admin's first look.
    // sent_back / changes_requested = ball back with Author, out of Admin queue.
    // Terminal (approved / rejected / merged) = done.
    // Publish gate is a separate wider check that includes non-terminals.
    await seedRun({
      candidates: [
        { id: "c1", status: "accepted", admin_status: "unreviewed" },          // in queue
        { id: "c2", status: "accepted", admin_status: "approved" },            // terminal
        { id: "c3", status: "accepted", admin_status: "rejected" },            // terminal
        { id: "c4", status: "accepted", admin_status: "changes_requested" },   // back with Author
        { id: "c5", status: "accepted", admin_status: "sent_back" },           // back with Author
        { id: "c6", status: "accepted", admin_status: "merged" },              // terminal
        { id: "c7", status: "pending",  admin_status: "unreviewed" },          // Author hasn't accepted
        { id: "c8", status: "rejected", admin_status: "unreviewed" }           // Author rejected
      ]
    });
    const { listAdminPending } = await import("./_queue");
    const pending = await listAdminPending(FIXTURE_SLUG);
    expect(pending.map((c) => c.id).sort()).toEqual(["c1"]);
  });

  it("listAdminApproved returns only admin-approved", async () => {
    await seedRun({
      candidates: [
        { id: "c1", status: "accepted", admin_status: "unreviewed" },
        { id: "c2", status: "accepted", admin_status: "approved" },
        { id: "c3", status: "accepted", admin_status: "approved" },
        { id: "c4", status: "accepted", admin_status: "rejected" }
      ]
    });
    const { listAdminApproved } = await import("./_queue");
    const approved = await listAdminApproved(FIXTURE_SLUG);
    expect(approved.map((c) => c.id).sort()).toEqual(["c2", "c3"]);
  });

  it("updateCandidate appends review event to history when provided", async () => {
    await seedRun({ candidates: [{ id: "c1", status: "accepted", admin_status: "unreviewed" }] });
    const { updateCandidate, loadRun } = await import("./_queue");
    const now = new Date().toISOString();
    await updateCandidate(FIXTURE_SLUG, "run_admin", "c1",
      { admin_status: "approved" },
      { actor: { kind: "brain_admin", id: "reviewer1" }, action: "approve", at: now, brain_version: "current" }
    );
    const run = await loadRun(FIXTURE_SLUG, "run_admin");
    expect(run?.candidates[0].admin_status).toBe("approved");
    expect(run?.candidates[0].review_history).toHaveLength(1);
    expect((run?.candidates[0].review_history[0] as { action?: string }).action).toBe("approve");
  });
});
