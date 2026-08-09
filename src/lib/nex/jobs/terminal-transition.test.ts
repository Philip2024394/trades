// Wave 11 · Phase 5 · W-C-COMPANION Storage-contract extension.
// Behaviour tests for the idempotent KJ terminal-transition helper.
// See src/lib/nex/jobs/terminal-transition.ts for the doctrine.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyTerminalKnowledgeJobTransition } from "./terminal-transition";
import { createJob, getJob, type KnowledgeJob, updateJob } from "./fs-store";
import type { KnowledgeJobTransitionAudit } from "@/lib/nex/brain/types";

let originalCwd: string;
let tmp: string;

beforeEach(() => {
  originalCwd = process.cwd();
  tmp = mkdtempSync(join(tmpdir(), "wc-phase5-term-"));
  process.chdir(tmp);
});

afterEach(() => {
  process.chdir(originalCwd);
  try { rmSync(tmp, { recursive: true, force: true }); } catch { /* best effort */ }
});

interface CapturingStore {
  writes: KnowledgeJobTransitionAudit[];
  writeKnowledgeJobTransitionAudit: (input: KnowledgeJobTransitionAudit) => Promise<void>;
}

function makeCapturingStore(): CapturingStore {
  const writes: KnowledgeJobTransitionAudit[] = [];
  return {
    writes,
    async writeKnowledgeJobTransitionAudit(input) {
      writes.push(input);
    },
  };
}

async function seedClaimedJob(): Promise<KnowledgeJob> {
  const job = await createJob({
    source: "Knowledge Dump",
    owner: "test",
    knowledge_type: null,
    inbox_item_id: "nx_test_inbox",
    title: "test job",
    content_length: 0,
  });
  const claimed = await updateJob(job.job_id, { status: "claimed" });
  if (!claimed) throw new Error("failed to seed claimed job");
  return claimed;
}

describe("applyTerminalKnowledgeJobTransition", () => {
  it("transitions claimed → completed and writes paired audit", async () => {
    const kj = await seedClaimedJob();
    const store = makeCapturingStore();
    const res = await applyTerminalKnowledgeJobTransition(store, {
      kjid: kj.job_id,
      patch: { status: "completed", progress: 100 },
      actor: "worker:knowledge-extractor@1",
      reason: "extractor-terminal-success",
      worker_job_id: "wj-1",
    });
    expect(res.changed).toBe(true);
    expect(res.snapshot?.status).toBe("completed");
    const after = await getJob(kj.job_id);
    expect(after?.status).toBe("completed");
    expect(store.writes).toHaveLength(1);
    expect(store.writes[0]).toMatchObject({
      knowledge_job_id: kj.job_id,
      from_status: "claimed",
      to_status: "completed",
      actor: "worker:knowledge-extractor@1",
      reason: "extractor-terminal-success",
      worker_job_id: "wj-1",
    });
  });

  it("transitions claimed → failed and writes paired audit", async () => {
    const kj = await seedClaimedJob();
    const store = makeCapturingStore();
    const res = await applyTerminalKnowledgeJobTransition(store, {
      kjid: kj.job_id,
      patch: { status: "failed", completion_result: { error: "boom" } },
      actor: "worker:knowledge-extractor@2",
      reason: "extractor-terminal-failure",
    });
    expect(res.changed).toBe(true);
    expect(res.snapshot?.status).toBe("failed");
    expect(store.writes[0].to_status).toBe("failed");
    expect(store.writes[0].from_status).toBe("claimed");
  });

  it("is idempotent · repeated calls on already-terminal KJ produce zero extra audit rows", async () => {
    const kj = await seedClaimedJob();
    const store = makeCapturingStore();
    const first = await applyTerminalKnowledgeJobTransition(store, {
      kjid: kj.job_id,
      patch: { status: "completed", progress: 100 },
      actor: "actor-1",
    });
    expect(first.changed).toBe(true);
    expect(store.writes).toHaveLength(1);

    // Repeat with same target — no work should happen
    const second = await applyTerminalKnowledgeJobTransition(store, {
      kjid: kj.job_id,
      patch: { status: "completed", progress: 100 },
      actor: "actor-2",
    });
    expect(second.changed).toBe(false);
    expect(store.writes).toHaveLength(1); // still 1 · no duplicate
    expect(second.snapshot?.status).toBe("completed");
  });

  it("returns { changed:false, snapshot:null } when the KJ does not exist", async () => {
    const store = makeCapturingStore();
    const res = await applyTerminalKnowledgeJobTransition(store, {
      kjid: "no-such-kjid",
      patch: { status: "completed" },
      actor: "actor-3",
    });
    expect(res.changed).toBe(false);
    expect(res.snapshot).toBeNull();
    expect(store.writes).toHaveLength(0);
  });

  it("audit-write failure does not roll back the fs-store state · warning path", async () => {
    const kj = await seedClaimedJob();
    const store: CapturingStore = {
      writes: [],
      async writeKnowledgeJobTransitionAudit() {
        throw new Error("simulated audit failure");
      },
    };
    const res = await applyTerminalKnowledgeJobTransition(store, {
      kjid: kj.job_id,
      patch: { status: "completed", progress: 100 },
      actor: "actor",
    });
    // KJ was updated · audit failure is non-fatal
    expect(res.changed).toBe(true);
    expect(res.snapshot?.status).toBe("completed");
    const after = await getJob(kj.job_id);
    expect(after?.status).toBe("completed");
  });
});
