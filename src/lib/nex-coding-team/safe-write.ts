// NEX Coding Team · Permission-gated file writer
// The single choke-point through which every agent-driven file write flows.
// Combines: role-based permission check, universal deny list, historical-receipt
// immutability, .env.local special-case, and audit log emission.
//
// Any agent that writes a file WITHOUT going through this function is a bug.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import type { AgentId } from "./types";
import { canWrite, REPO_ROOT } from "./permissions";
import { logFileWrite, logGovernanceCheck } from "./logger";

export interface SafeWriteResult {
  readonly ok: boolean;
  readonly target_abs: string | null;
  readonly target_rel: string | null;
  readonly bytes: number;
  readonly reason: string | null;
}

/**
 * Write a file on behalf of an agent. Denies the write if permissions fail.
 * Always logs (grant OR deny) to the run's audit log.
 */
export function safeWrite(
  run_id: string,
  agent: AgentId,
  target_path: string,
  content: string | Buffer,
): SafeWriteResult {
  const abs = path.isAbsolute(target_path) ? target_path : path.resolve(REPO_ROOT, target_path);
  const rel = path.relative(REPO_ROOT, abs).replace(/\\/g, "/");

  // Special case: `.env.local` is Integrator-only AND only with spec authority.
  // Runtime should not treat "Integrator can write env" as automatic — a separate
  // authorisation gate is expected before Integrator would legitimately touch env.
  if (rel === ".env.local") {
    logFileWrite(run_id, agent, rel, false, "special-case: .env.local requires explicit Founder authority");
    return {
      ok: false,
      target_abs: abs,
      target_rel: rel,
      bytes: 0,
      reason: ".env.local writes require explicit Founder authority beyond agent scope",
    };
  }

  const check = canWrite(agent, abs);
  if (!check.allowed) {
    logFileWrite(run_id, agent, rel, false, check.reason);
    logGovernanceCheck(run_id, "role_permission", false, `${agent} → ${rel}: ${check.reason}`);
    return { ok: false, target_abs: abs, target_rel: rel, bytes: 0, reason: check.reason };
  }

  // Ensure parent directory exists.
  const dir = path.dirname(abs);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
  writeFileSync(abs, buf);
  logFileWrite(run_id, agent, rel, true, null, buf.length);
  return { ok: true, target_abs: abs, target_rel: rel, bytes: buf.length, reason: null };
}
