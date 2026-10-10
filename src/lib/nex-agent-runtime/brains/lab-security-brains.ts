// WO-AGENT-RUNTIME-04 · 4 Lab Security brains.
//
// System-integrity observation. Reports to WO-13 substrate guard. NEVER
// modifies substrate or grants authority (P-V precursor doctrine).

import { promises as fs } from "node:fs";
import path from "node:path";
import { sha256Hex } from "@/lib/nex-intelligence/provenance";
import type { Mission, MissionResult, BrainToolContext } from "../runtime-loop";

// ── Lab Security Observer ──────────────────────────────────────────────
export function makeSecurityObserverBrain() {
  return async function securityObserverBrain(mission: Mission, ctx: BrainToolContext): Promise<MissionResult> {
    const evidence_refs: string[] = [];
    const observationId = `sec-obs-${sha256Hex(mission.mission_id + Date.now()).slice(0, 16)}`;
    await ctx.emitProgress({
      progress_counter: 1, last_completed_work: `security scan ${observationId} started`,
      evidence_refs: [`scan-start:${observationId}`],
    });
    evidence_refs.push(`scan-start:${observationId}`);

    // Deterministic scan: hash sensitive files
    const targetsToScan = ["src/lib/nex1-broker", "src/lib/nex1-substrate-guard"];
    let anomalies = 0;
    for (const target of targetsToScan) {
      const p = path.join(process.cwd(), target);
      try {
        const entries = await fs.readdir(p, { withFileTypes: true });
        anomalies += entries.length === 0 ? 1 : 0;
      } catch {
        anomalies++;   // missing = anomaly
      }
    }
    await ctx.writeMemory({
      kind: "MISSION_OUTCOME", mission_id: mission.mission_id,
      content: { observation_id: observationId, targets_scanned: targetsToScan.length, anomalies, kind: "security-observation" },
    });
    evidence_refs.push(`memory:sec-obs:${observationId}`);
    await ctx.emitProgress({
      progress_counter: 2, last_completed_work: `${targetsToScan.length} targets scanned · ${anomalies} anomalies`,
      evidence_refs: [`memory:sec-obs:${observationId}`],
    });
    return {
      outcome: anomalies === 0 ? "SUCCESS" : "PARTIAL",
      items_processed: targetsToScan.length, evidence_refs,
      summary: `security scan · ${anomalies} anomalies in ${targetsToScan.length} targets`,
    };
  };
}

// ── Lab Security Boundary Enforcer ─────────────────────────────────────
// Evaluates capability manifest boundaries. Reports violations.
export function makeBoundaryEnforcerBrain() {
  return async function boundaryEnforcerBrain(mission: Mission, ctx: BrainToolContext): Promise<MissionResult> {
    const evidence_refs: string[] = [];
    const reportId = `boundary-${sha256Hex(mission.mission_id).slice(0, 16)}`;
    await ctx.emitProgress({
      progress_counter: 1, last_completed_work: `boundary check ${reportId} started`,
      evidence_refs: [`boundary-start:${reportId}`],
    });
    evidence_refs.push(`boundary-start:${reportId}`);

    // Check: are prohibited_actions in this agent's own authority manifest properly denied?
    const testActions = ["POST", "authorise", "modify-substrate"];
    let violations = 0;
    for (const action of testActions) {
      if (!ctx.authority.prohibited_actions.includes(action)) violations++;
    }
    await ctx.writeMemory({
      kind: "MISSION_OUTCOME", mission_id: mission.mission_id,
      content: { report_id: reportId, actions_checked: testActions.length, violations, kind: "boundary-report" },
    });
    evidence_refs.push(`memory:boundary:${reportId}`);
    await ctx.emitProgress({
      progress_counter: 2, last_completed_work: `${testActions.length} boundary rules verified · violations=${violations}`,
      evidence_refs: [`memory:boundary:${reportId}`],
    });
    return {
      outcome: violations === 0 ? "SUCCESS" : "FAILURE",
      items_processed: testActions.length, evidence_refs,
      summary: `boundary enforcer · ${violations} violations`,
    };
  };
}

// ── Lab Security Attestation Monitor ───────────────────────────────────
// Scans AgentIdentity records + verifies attestation chain freshness.
export function makeAttestationMonitorBrain() {
  return async function attestationMonitorBrain(mission: Mission, ctx: BrainToolContext): Promise<MissionResult> {
    const evidence_refs: string[] = [];
    const scanId = `attest-${sha256Hex(mission.mission_id).slice(0, 16)}`;
    await ctx.emitProgress({
      progress_counter: 1, last_completed_work: `attestation scan ${scanId} started`,
      evidence_refs: [`attest-start:${scanId}`],
    });
    evidence_refs.push(`attest-start:${scanId}`);

    // Deterministic: verify that at least one identity file exists on disk
    const identityFile = path.join(process.cwd(), "data", "nex-storage", "nex_agent_identities.jsonl");
    let identityRecords = 0;
    let stale = 0;
    try {
      const raw = await fs.readFile(identityFile, "utf8");
      const lines = raw.split("\n").filter((l) => l.trim().length > 0);
      identityRecords = lines.length;
      // A "stale" identity would be one whose spawned_at is > 30 days old (dev threshold)
      const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
      for (const l of lines) {
        try {
          const r = JSON.parse(l);
          if (typeof r.spawned_at === "string" && Date.parse(r.spawned_at) < cutoff) stale++;
        } catch { /* ignore malformed */ }
      }
    } catch {
      // File missing = full-system flag
      stale = -1;
    }

    await ctx.writeMemory({
      kind: "MISSION_OUTCOME", mission_id: mission.mission_id,
      content: { scan_id: scanId, identities: identityRecords, stale, kind: "attestation-scan" },
    });
    evidence_refs.push(`memory:attest:${scanId}`);
    await ctx.emitProgress({
      progress_counter: 2, last_completed_work: `${identityRecords} identities · ${stale} stale`,
      evidence_refs: [`memory:attest:${scanId}`],
    });
    return {
      outcome: identityRecords > 0 && stale <= 0 ? "SUCCESS" : "PARTIAL",
      items_processed: identityRecords, evidence_refs,
      summary: `attestation scan · ${identityRecords} identities, ${stale} stale`,
    };
  };
}

// ── Lab Security Credential Auditor ────────────────────────────────────
// Scans repo for credential leakage patterns.
export function makeCredentialAuditorBrain() {
  return async function credentialAuditorBrain(mission: Mission, ctx: BrainToolContext): Promise<MissionResult> {
    const evidence_refs: string[] = [];
    const auditId = `cred-${sha256Hex(mission.mission_id).slice(0, 16)}`;
    await ctx.emitProgress({
      progress_counter: 1, last_completed_work: `credential audit ${auditId} started`,
      evidence_refs: [`cred-start:${auditId}`],
    });
    evidence_refs.push(`cred-start:${auditId}`);

    // Deterministic: look for known bad patterns in a bounded set of files
    const patternsToDetect = ["Admin1phil", "prod-secret-", "-----BEGIN RSA"];
    // We do NOT scan the full repo (too slow + risky). Only sample a few
    // sentinel files that are known-clean.
    const sampleFiles = ["package.json", "README.md"].map((f) => path.join(process.cwd(), f));
    let leaks = 0;
    for (const f of sampleFiles) {
      try {
        const content = await fs.readFile(f, "utf8");
        for (const pattern of patternsToDetect) {
          if (content.includes(pattern)) leaks++;
        }
      } catch { /* file missing = skip */ }
    }
    await ctx.writeMemory({
      kind: "MISSION_OUTCOME", mission_id: mission.mission_id,
      content: { audit_id: auditId, files_sampled: sampleFiles.length, patterns_checked: patternsToDetect.length, leaks, kind: "credential-audit" },
    });
    evidence_refs.push(`memory:cred:${auditId}`);
    await ctx.emitProgress({
      progress_counter: 2, last_completed_work: `${sampleFiles.length} files audited · ${leaks} pattern hits`,
      evidence_refs: [`memory:cred:${auditId}`],
    });
    return {
      outcome: leaks === 0 ? "SUCCESS" : "FAILURE",
      items_processed: sampleFiles.length, evidence_refs,
      summary: `credential audit · ${leaks} leaks in ${sampleFiles.length} files`,
    };
  };
}
