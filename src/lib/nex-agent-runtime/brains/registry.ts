// WO-AGENT-RUNTIME-01…05 · brain registry.
//
// Maps agent_id → brain factory. The runner uses this to spawn each
// registered agent with its role-specific brain.

import type { AgentBrain } from "../runtime-loop";
import { makeCrawlerBrain } from "./crawler-brain";
import {
  makeSanitizerBrain,
  makeDiscoveryBrain,
  makeHypothesisBrain,
  makeExperimentBrain,
  makeScoringBrain,
  makeProposalBrain,
} from "./intelligence-brains";
import {
  makeMasterEngineerBrain,
  makeCodeGenerationBrain,
  makeBrokerBrain,
  makeBuildBrain,
  makeRuntimeBrain,
  makeSpecialistBrain,
  makeCorrectorBrain,
  makeSubstrateGuardBrain,
} from "./orchestrator-brains";
import {
  makeSecurityObserverBrain,
  makeBoundaryEnforcerBrain,
  makeAttestationMonitorBrain,
  makeCredentialAuditorBrain,
} from "./lab-security-brains";
import {
  makeCodeGeneratorBrain,
  makeCodeReviewerBrain,
  makeCodeRefactorerBrain,
  makeTestAuthorBrain,
} from "./nex-coding-brains";

/** Returns a fresh brain instance for a given agent_id, or a fallback brain
 *  that emits a PARTIAL result explaining the missing implementation. */
export function brainForAgent(agent_id: string): AgentBrain {
  const factories: Record<string, () => AgentBrain> = {
    // Intelligence lane
    "intelligence-crawler": () => makeCrawlerBrain(),
    "intelligence-sanitizer": () => makeSanitizerBrain(),
    "intelligence-discovery": () => makeDiscoveryBrain(),
    "intelligence-hypothesis": () => makeHypothesisBrain(),
    "intelligence-experiment": () => makeExperimentBrain(),
    "intelligence-scoring": () => makeScoringBrain(),
    "intelligence-proposal": () => makeProposalBrain(),
    // Orchestrator lane
    "nex1-master-engineer": () => makeMasterEngineerBrain(),
    "wo3-code-generation-pipeline": () => makeCodeGenerationBrain(),
    "wo4-broker-executor": () => makeBrokerBrain(),
    "wo5-build-executor": () => makeBuildBrain(),
    "wo6-runtime-executor": () => makeRuntimeBrain(),
    "wo7-node-syntax-specialist": () => makeSpecialistBrain(),
    "wo9-corrector": () => makeCorrectorBrain(),
    "wo13-substrate-guard": () => makeSubstrateGuardBrain(),
    // Lab Security lane
    "lab-security-observer": () => makeSecurityObserverBrain(),
    "lab-security-boundary-enforcer": () => makeBoundaryEnforcerBrain(),
    "lab-security-attestation-monitor": () => makeAttestationMonitorBrain(),
    "lab-security-credential-auditor": () => makeCredentialAuditorBrain(),
    // NEX Coding lane
    "nex-coding-generator": () => makeCodeGeneratorBrain(),
    "nex-coding-reviewer": () => makeCodeReviewerBrain(),
    "nex-coding-refactorer": () => makeCodeRefactorerBrain(),
    "nex-coding-test-author": () => makeTestAuthorBrain(),
  };
  const factory = factories[agent_id];
  if (factory) return factory();
  return async () => ({
    outcome: "PARTIAL" as const,
    items_processed: 0,
    evidence_refs: [],
    summary: `no brain registered for ${agent_id} · falling back to PARTIAL`,
  });
}
