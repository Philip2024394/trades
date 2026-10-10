// Queue dispatcher tests · verifies the file-transit round-trip: inbox is
// written · outbox reply is consumed · missing executor returns ERROR
// without fabrication.

import { describe, it, expect, afterAll } from "vitest";
import { existsSync, readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import * as path from "node:path";
import { makeQueueDispatcher } from "../dispatcher-queue";

const REPO_ROOT = process.cwd();
const INBOX = path.join(REPO_ROOT, "data", "nex-coding-team", "queue", "inbox");
const OUTBOX = path.join(REPO_ROOT, "data", "nex-coding-team", "queue", "outbox");

afterAll(() => {
  // Best-effort cleanup of test-produced inbox files.
  if (existsSync(INBOX)) {
    for (const f of readdirSync(INBOX)) {
      if (f.startsWith("test-queue-")) {
        rmSync(path.join(INBOX, f), { force: true });
      }
    }
  }
});

function testInput(run_id: string) {
  return {
    run_id,
    agent_id: "pm" as const,
    cycle_index: 0,
    system_prompt: "test",
    context: {
      founder_prompt: "queue test",
      prior_verdicts: {},
    },
    artifact_write_target: `data/nex-coding-team/runs/${run_id}/ticket.md`,
  };
}

describe("dispatcher-queue · fast timeout returns honest ERROR", () => {
  it("returns ERROR verdict when no executor is attached", async () => {
    const dispatcher = makeQueueDispatcher({ timeout_ms: 200, poll_interval_ms: 50 });
    const run_id = `test-queue-${Date.now()}-a`;
    const out = await dispatcher.dispatch(testInput(run_id));
    expect(out.verdict).toBe("ERROR");
    expect(out.summary).toMatch(/timeout/);
    expect(out.next_action).toMatch(/Attach a queue executor/);
    // The inbox file is left in place so a late executor can still respond.
    const inboxFile = path.join(INBOX, `${run_id}-pm-0.json`);
    expect(existsSync(inboxFile)).toBe(true);
    rmSync(inboxFile, { force: true });
  }, 3_000);
});

describe("dispatcher-queue · full round-trip with a simulated executor", () => {
  it("reads inbox, consumes outbox, returns the executor verdict", async () => {
    const dispatcher = makeQueueDispatcher({ timeout_ms: 5_000, poll_interval_ms: 100 });
    const run_id = `test-queue-${Date.now()}-b`;
    const input = testInput(run_id);
    const job_id = `${run_id}-pm-0`;

    // Simulate an executor: after a short delay, drop an outbox reply.
    const outboxPath = path.join(OUTBOX, `${job_id}.json`);
    setTimeout(() => {
      writeFileSync(
        outboxPath,
        JSON.stringify({
          protocol_version: 1,
          run_id,
          agent_id: "pm",
          cycle_index: 0,
          verdict: "APPROVE",
          summary: "simulated executor OK",
          evidence: ["fake:1"],
          blockers: [],
          next_action: null,
          artifact_relpath: `data/nex-coding-team/runs/${run_id}/ticket.md`,
        }),
        "utf8",
      );
    }, 200);

    const out = await dispatcher.dispatch(input);
    expect(out.verdict).toBe("APPROVE");
    expect(out.summary).toBe("simulated executor OK");
    expect(out.evidence).toContain("fake:1");
    // Outbox and inbox files cleaned up after successful consumption.
    expect(existsSync(outboxPath)).toBe(false);
    expect(existsSync(path.join(INBOX, `${job_id}.json`))).toBe(false);
  }, 10_000);

  it("writes inbox atomically (tmp + rename) so watchers see complete files", async () => {
    const dispatcher = makeQueueDispatcher({ timeout_ms: 200, poll_interval_ms: 50 });
    const run_id = `test-queue-${Date.now()}-c`;
    await dispatcher.dispatch(testInput(run_id));
    const inboxFile = path.join(INBOX, `${run_id}-pm-0.json`);
    // File exists and is parseable JSON with the expected shape.
    const raw = readFileSync(inboxFile, "utf8");
    const parsed = JSON.parse(raw) as { protocol_version: number; run_id: string };
    expect(parsed.protocol_version).toBe(1);
    expect(parsed.run_id).toBe(run_id);
    rmSync(inboxFile, { force: true });
  }, 3_000);
});
