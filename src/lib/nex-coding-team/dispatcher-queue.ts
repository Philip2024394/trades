// NEX Coding Team · File-transit queue dispatcher
// Writes each agent job to data/nex-coding-team/queue/inbox/<job_id>.json
// then polls data/nex-coding-team/queue/outbox/<job_id>.json for the reply.
// External executors (Claude Code MAI · NEX1 autonomous runtime · any language)
// attach to the queue by watching the inbox and writing outbox files.
//
// Never fabricates a verdict on timeout · returns ERROR so the pipeline halts
// honestly rather than pretending an executor answered.

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, renameSync } from "node:fs";
import * as path from "node:path";
import type { AgentDispatcher, AgentDispatchInput, AgentDispatchOutput } from "./runtime";
import type { AgentVerdict } from "./types";
import { isAborted } from "./interrupt";

const REPO_ROOT = process.cwd();
const QUEUE_ROOT = path.join(REPO_ROOT, "data", "nex-coding-team", "queue");
const INBOX = path.join(QUEUE_ROOT, "inbox");
const OUTBOX = path.join(QUEUE_ROOT, "outbox");

function ensureDirs(): void {
  if (!existsSync(INBOX)) mkdirSync(INBOX, { recursive: true });
  if (!existsSync(OUTBOX)) mkdirSync(OUTBOX, { recursive: true });
}

export interface QueueDispatcherOptions {
  readonly timeout_ms: number;
  readonly poll_interval_ms: number;
}

export const DEFAULT_QUEUE_OPTIONS: QueueDispatcherOptions = {
  timeout_ms: 5 * 60 * 1000,
  poll_interval_ms: 500,
};

interface QueueOutboxPayload {
  readonly protocol_version: 1;
  readonly run_id: string;
  readonly agent_id: string;
  readonly cycle_index: number;
  readonly verdict: AgentVerdict;
  readonly summary: string;
  readonly evidence?: readonly string[];
  readonly blockers?: readonly string[];
  readonly next_action?: string | null;
  readonly artifact_relpath?: string | null;
}

export function makeQueueDispatcher(opts: QueueDispatcherOptions = DEFAULT_QUEUE_OPTIONS): AgentDispatcher {
  return {
    async dispatch(input: AgentDispatchInput): Promise<AgentDispatchOutput> {
      ensureDirs();
      const job_id = `${input.run_id}-${input.agent_id}-${input.cycle_index}`;
      const inboxPath = path.join(INBOX, `${job_id}.json`);
      const outboxPath = path.join(OUTBOX, `${job_id}.json`);

      const inboxPayload = {
        protocol_version: 1,
        job_id,
        run_id: input.run_id,
        agent_id: input.agent_id,
        cycle_index: input.cycle_index,
        system_prompt: input.system_prompt,
        context: input.context,
        artifact_write_target: input.artifact_write_target,
        submitted_at: new Date().toISOString(),
      };

      const tmp = inboxPath + ".tmp";
      writeFileSync(tmp, JSON.stringify(inboxPayload, null, 2), "utf8");
      renameSync(tmp, inboxPath);

      const start = Date.now();
      while (Date.now() - start < opts.timeout_ms) {
        // Founder-interrupt check · exit poll early with ERROR so the runtime
        // sees the failure and halts cleanly on its next abort check.
        if (isAborted(input.run_id)) {
          safeUnlink(inboxPath);
          return {
            verdict: "ERROR",
            summary: `queue poll aborted by Founder interrupt for job ${job_id}`,
            evidence: [],
            blockers: ["founder-interrupt"],
            next_action: null,
            artifact_relpath: null,
          };
        }
        if (existsSync(outboxPath)) {
          try {
            const out = JSON.parse(readFileSync(outboxPath, "utf8")) as QueueOutboxPayload;
            safeUnlink(outboxPath);
            safeUnlink(inboxPath);
            return {
              verdict: out.verdict,
              summary: out.summary,
              evidence: out.evidence ?? [],
              blockers: out.blockers ?? [],
              next_action: out.next_action ?? null,
              artifact_relpath: out.artifact_relpath ?? null,
            };
          } catch (err) {
            return errorOutput(
              `queue outbox malformed for ${job_id}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
        await sleep(opts.poll_interval_ms);
      }

      // Leave inbox in place so a late executor can still respond.
      return errorOutput(
        `queue dispatcher timeout after ${opts.timeout_ms}ms · no executor attached for job ${job_id}`,
      );
    },
  };
}

function safeUnlink(p: string): void {
  try {
    unlinkSync(p);
  } catch {
    /* nothing to do */
  }
}

function errorOutput(msg: string): AgentDispatchOutput {
  return {
    verdict: "ERROR",
    summary: msg,
    evidence: [],
    blockers: [msg],
    next_action:
      "Attach a queue executor (MAI or NEX1) that watches data/nex-coding-team/queue/inbox and writes outbox replies.",
    artifact_relpath: null,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const QUEUE_DISPATCHER: AgentDispatcher = makeQueueDispatcher();
