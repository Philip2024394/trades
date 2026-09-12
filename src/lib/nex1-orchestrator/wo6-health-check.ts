// WO-WORKSTATION-06 · HTTP health check
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// Real HTTP GET against http://127.0.0.1:{port}{path}. Uses node:http —
// no third-party runtime deps. Polls with a fixed interval until the
// response arrives or startup_timeout_ms is exhausted. Connection-refused
// during the poll window is treated as "still starting", not a failure.
//
// This module never rewrites the URL or follows redirects. What comes
// back is what the workstation records.

import * as http from "node:http";
import type { HealthCheckOutcome } from "./wo6-types";

const RESPONSE_BODY_CAP_BYTES = 1024;

export interface HealthPollInput {
  readonly host: string;                   // typically "127.0.0.1"
  readonly port: number;
  readonly path: string;                   // must start with "/"
  readonly startup_timeout_ms: number;
  readonly poll_interval_ms: number;
  readonly per_request_timeout_ms: number; // ms to allow a single GET
  /** Optional predicate: if the child process is still alive. When it
   *  returns false, polling stops immediately and the outcome records
   *  the process death — the caller then reports PROCESS_EXITED_EARLY. */
  readonly is_child_alive?: () => boolean;
  /** Test hook. Defaults to Date.now. */
  readonly now?: () => number;
}

export type HealthPollResult =
  | { kind: "READY"; outcome: HealthCheckOutcome }
  | { kind: "TIMEOUT"; outcome: HealthCheckOutcome }
  | { kind: "CHILD_DEAD"; outcome: HealthCheckOutcome };

/**
 * Poll the endpoint until it responds or startup_timeout_ms elapses.
 * Returns a discriminated union so the executor can branch on outcome
 * type rather than parsing strings.
 */
export async function pollHealth(input: HealthPollInput): Promise<HealthPollResult> {
  const now = input.now ?? Date.now;
  const started = now();
  const attempted_at = new Date(started).toISOString();
  let attempts = 0;
  let last_status: number | null = null;
  let last_body: string | null = null;
  let last_headers: Record<string, string> = {};

  // Poll loop
  while (true) {
    if (input.is_child_alive && !input.is_child_alive()) {
      return {
        kind: "CHILD_DEAD",
        outcome: {
          attempted_at,
          attempts,
          succeeded_at: null,
          response_status: last_status,
          response_body_first_1kb: last_body,
          response_headers: last_headers,
          total_wait_ms: now() - started,
        },
      };
    }
    attempts++;
    const attemptResult = await singleGet({
      host: input.host,
      port: input.port,
      path: input.path,
      per_request_timeout_ms: input.per_request_timeout_ms,
    });
    if (attemptResult.kind === "responded") {
      return {
        kind: "READY",
        outcome: {
          attempted_at,
          attempts,
          succeeded_at: new Date(now()).toISOString(),
          response_status: attemptResult.status,
          response_body_first_1kb: attemptResult.body,
          response_headers: attemptResult.headers,
          total_wait_ms: now() - started,
        },
      };
    }
    // Record last seen values so a final timeout has some context
    if (attemptResult.kind === "connection_error") {
      last_status = null;
      last_body = attemptResult.reason;
      last_headers = {};
    }
    if (now() - started >= input.startup_timeout_ms) {
      return {
        kind: "TIMEOUT",
        outcome: {
          attempted_at,
          attempts,
          succeeded_at: null,
          response_status: last_status,
          response_body_first_1kb: last_body,
          response_headers: last_headers,
          total_wait_ms: now() - started,
        },
      };
    }
    await sleep(input.poll_interval_ms);
  }
}

// ── Single-request helper ──────────────────────────────────────────────

type SingleGetResult =
  | { kind: "responded"; status: number; body: string; headers: Record<string, string> }
  | { kind: "connection_error"; reason: string };

function singleGet(input: {
  readonly host: string;
  readonly port: number;
  readonly path: string;
  readonly per_request_timeout_ms: number;
}): Promise<SingleGetResult> {
  return new Promise<SingleGetResult>((resolve) => {
    let settled = false;
    const settle = (r: SingleGetResult) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };
    const req = http.request(
      {
        host: input.host,
        port: input.port,
        path: input.path,
        method: "GET",
        headers: { host: `${input.host}:${input.port}` },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let received = 0;
        res.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (received <= RESPONSE_BODY_CAP_BYTES) chunks.push(chunk);
          else if (chunks.reduce((n, b) => n + b.length, 0) < RESPONSE_BODY_CAP_BYTES) {
            const remaining = RESPONSE_BODY_CAP_BYTES - chunks.reduce((n, b) => n + b.length, 0);
            if (remaining > 0) chunks.push(chunk.subarray(0, remaining));
          }
        });
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (typeof v === "string") headers[k] = v;
            else if (Array.isArray(v)) headers[k] = v.join(", ");
          }
          settle({ kind: "responded", status: res.statusCode ?? 0, body, headers });
        });
        res.on("error", (err) => settle({ kind: "connection_error", reason: err.message }));
      },
    );
    req.setTimeout(input.per_request_timeout_ms, () => {
      req.destroy(new Error(`per-request timeout ${input.per_request_timeout_ms}ms`));
    });
    req.on("error", (err) => settle({ kind: "connection_error", reason: err.message }));
    req.end();
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Exported for tests + documentation
export { RESPONSE_BODY_CAP_BYTES };
