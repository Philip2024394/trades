// src/lib/nex/security-agent/security-agent.ts
//
// Main HQ Security Agent · 4th Guardian tier · Stage 1 of BUILD PLAN v1.1.
//
// Public entry: SecurityAgent.inspect(request) → SecurityDecision.
// Never mutates anything. Never writes to Work Map / file-capability-map /
// locked-doctrines. Reads registries once per inspection.

import { randomUUID } from "node:crypto";
import type {
  SecurityDecision,
  SecurityInspectionRequest,
  SecurityRejection,
} from "./types";
import { loadRegistries, type LoadedRegistries } from "./registries";
import { inspectFileRegistry } from "./inspect-file-registry";
import { inspectDoctrines } from "./inspect-doctrines";
import { inspectAction } from "./inspect-action";

export class SecurityAgent {
  private registriesCache: LoadedRegistries | null = null;
  private readonly cwd: string | undefined;

  constructor(cwd?: string) {
    this.cwd = cwd;
  }

  private async loadFresh(): Promise<LoadedRegistries> {
    // Every inspection reloads registries (deterministic · never stale) unless
    // an explicit long-running agent chooses to cache. For Stage 1 · fresh.
    return loadRegistries(this.cwd);
  }

  async inspect(request: SecurityInspectionRequest): Promise<SecurityDecision> {
    // Basic input validation
    const validationRejections = this.validateRequest(request);
    if (validationRejections.length > 0) {
      return {
        accepted: false,
        rejections: Object.freeze([...validationRejections]),
        runId: randomUUID(),
        agentId: request.agentId,
      };
    }

    const registries = await this.loadFresh();
    const rejections: SecurityRejection[] = [];

    // File-registry check
    for (const r of inspectFileRegistry(request.proposedFiles, registries)) {
      rejections.push(r);
    }
    // Doctrine check (whole change + per-file)
    for (const r of inspectDoctrines(request, registries)) {
      rejections.push(r);
    }
    // Action-scope check
    for (const r of inspectAction(request)) {
      rejections.push(r);
    }

    const runId = randomUUID();
    if (rejections.length === 0) {
      return { accepted: true, rejections: [], runId, agentId: request.agentId };
    }
    return {
      accepted: false,
      rejections: Object.freeze([...rejections]),
      runId,
      agentId: request.agentId,
    };
  }

  private validateRequest(
    request: SecurityInspectionRequest,
  ): readonly SecurityRejection[] {
    const rejections: SecurityRejection[] = [];
    if (!request.agentId || typeof request.agentId !== "string") {
      rejections.push({
        code: "sec.work_map_bypassed",
        message: "Missing agentId. Every inspection requires a named agent identity for audit provenance.",
      });
    }
    if (!request.changeReason || request.changeReason.trim().length === 0) {
      rejections.push({
        code: "sec.work_map_bypassed",
        message: "Missing changeReason. Every code change must cite a WHY that references a CAP-XXX.",
      });
    }
    if (!Array.isArray(request.proposedFiles) || request.proposedFiles.length === 0) {
      rejections.push({
        code: "sec.file_outside_registry",
        message: "proposedFiles must be a non-empty array. Nothing to inspect otherwise.",
      });
    }
    return rejections;
  }
}

/**
 * Convenience factory for one-shot inspections.
 */
export async function inspectChange(
  request: SecurityInspectionRequest,
  cwd?: string,
): Promise<SecurityDecision> {
  const agent = new SecurityAgent(cwd);
  return agent.inspect(request);
}
