// src/lib/nex/github-round-trip/github-round-trip.test.ts
//
// Stage 8 · pure-function tests.

import { describe, it, expect } from "vitest";
import {
  branchNameFor,
  parseBranchName,
  validateBranch,
  buildPrTitle,
  buildPrBody,
  isLegalPrTransition,
  currentPrKind,
  appendPrEvent,
} from "./index";
import type { RoundTripState, PrLifecycleEvent } from "./index";
import type { BuildArtifact, SectionRevision } from "../section-build";

const mockRevision = (overrides: Partial<SectionRevision> = {}): SectionRevision => ({
  revision_id: "rev-1",
  capability_id: "CAP-091",
  version: "v1.0.0",
  parent_revision_id: null,
  artifact_id: "art-1",
  change_request_id: null,
  lifecycle_state: "IN_REVIEW",
  created_at: "2026-09-11T00:00:00Z",
  created_by_agent_id: "nex1",
  founder_approval_at: null,
  founder_signature: null,
  live_at: null,
  reverted_at: null,
  ...overrides,
});

const mockArtifact = (overrides: Partial<BuildArtifact> = {}): BuildArtifact => ({
  artifact_id: "art-1",
  content_hash: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
  created_at: "2026-09-11T00:00:00Z",
  created_by_agent_id: "nex1",
  security_run_id: null,
  files_included: [],
  files_count: 5,
  total_bytes: 1024,
  tests_passed: 25,
  tests_total: 25,
  guardian_verdict: "ACCEPT",
  truth_engine_ok: true,
  ui_dna_verdict: "PASS",
  notes: null,
  ...overrides,
});

describe("branchNameFor / parseBranchName", () => {
  it("produces deterministic branch name", () => {
    expect(branchNameFor("CAP-091", "v1.0.0")).toBe("nex-build/CAP-091/v1.0.0");
  });

  it("parses back", () => {
    const parsed = parseBranchName("nex-build/CAP-091/v1.0.0");
    expect(parsed).toEqual({ capabilityId: "CAP-091", version: "v1.0.0" });
  });

  it("returns null for malformed branch name", () => {
    expect(parseBranchName("main")).toBeNull();
    expect(parseBranchName("nex/CAP-091/v1.0.0")).toBeNull();
    expect(parseBranchName("nex-build/cap-091/v1.0.0")).toBeNull();
  });
});

describe("validateBranch", () => {
  it("accepts well-formed branch", () => {
    const r = validateBranch({
      name: "nex-build/CAP-091/v1.0.0",
      capabilityId: "CAP-091",
      version: "v1.0.0",
    });
    expect(r.ok).toBe(true);
  });

  it("rejects branch/capability mismatch", () => {
    const r = validateBranch({
      name: "nex-build/CAP-092/v1.0.0",
      capabilityId: "CAP-091",
      version: "v1.0.0",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.branch_name_mismatch");
  });

  it("rejects bad capability", () => {
    const r = validateBranch({
      name: "nex-build/cap-1/v1.0.0",
      capabilityId: "cap-1",
      version: "v1.0.0",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.branch_bad_capability");
  });

  it("rejects bad version", () => {
    const r = validateBranch({
      name: "nex-build/CAP-091/1.0.0",
      capabilityId: "CAP-091",
      version: "1.0.0",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.branch_bad_version");
  });
});

describe("buildPrTitle / buildPrBody", () => {
  it("title includes CAP id + version + trimmed title", () => {
    const title = buildPrTitle({
      revision: mockRevision(),
      artifact: mockArtifact(),
      capabilityTitle: "HQ Security Agent",
      previewUrl: null,
      founderMessage: null,
      parentVersion: null,
    });
    expect(title).toContain("[CAP-091/v1.0.0]");
    expect(title).toContain("HQ Security Agent");
  });

  it("body includes artifact metrics + preview URL + change request", () => {
    const body = buildPrBody({
      revision: mockRevision({ version: "v1.1.0" }),
      artifact: mockArtifact({ tests_passed: 89, tests_total: 89 }),
      capabilityTitle: "HQ Security Agent",
      previewUrl: "/preview/CAP-091/v1.1.0",
      founderMessage: "Increase card padding · use NEX orange",
      parentVersion: "v1.0.0",
    });
    expect(body).toContain("CAP-091");
    expect(body).toContain("v1.1.0");
    expect(body).toContain("(parent v1.0.0)");
    expect(body).toContain("89/89 passed");
    expect(body).toContain("/preview/CAP-091/v1.1.0");
    expect(body).toContain("Increase card padding");
    expect(body).toContain("Security Agent CI");
  });

  it("body omits preview when null", () => {
    const body = buildPrBody({
      revision: mockRevision(),
      artifact: mockArtifact(),
      capabilityTitle: "Test",
      previewUrl: null,
      founderMessage: null,
      parentVersion: null,
    });
    expect(body).not.toContain("Preview URL");
  });
});

describe("PR lifecycle transitions", () => {
  it("opened is the only legal starting event", () => {
    expect(isLegalPrTransition(null, "opened")).toBe(true);
    expect(isLegalPrTransition(null, "approved")).toBe(false);
    expect(isLegalPrTransition(null, "merged")).toBe(false);
  });

  it("opened → converted_to_ready legal", () => {
    expect(isLegalPrTransition("opened", "converted_to_ready")).toBe(true);
  });

  it("opened → merged illegal (must go through review)", () => {
    expect(isLegalPrTransition("opened", "merged")).toBe(false);
  });

  it("approved → merged legal · approved → opened illegal", () => {
    expect(isLegalPrTransition("approved", "merged")).toBe(true);
    expect(isLegalPrTransition("approved", "opened")).toBe(false);
  });

  it("merged is terminal", () => {
    expect(isLegalPrTransition("merged", "opened")).toBe(false);
    expect(isLegalPrTransition("merged", "closed")).toBe(false);
  });

  it("closed is terminal", () => {
    expect(isLegalPrTransition("closed", "opened")).toBe(false);
  });
});

describe("appendPrEvent", () => {
  const baseState: RoundTripState = {
    revisionId: "rev-1",
    capabilityId: "CAP-091",
    version: "v1.0.0",
    branchName: "nex-build/CAP-091/v1.0.0",
    prNumber: null,
    prUrl: null,
    events: [],
  };

  it("appends legal event", () => {
    const opened: PrLifecycleEvent = {
      kind: "opened",
      at: "2026-09-11T00:00:00Z",
      by: "nex1",
      note: null,
    };
    const r = appendPrEvent(baseState, opened);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.next.events.length).toBe(1);
  });

  it("rejects illegal event", () => {
    const merged: PrLifecycleEvent = {
      kind: "merged",
      at: "2026-09-11T00:00:00Z",
      by: "nex1",
      note: null,
    };
    const r = appendPrEvent(baseState, merged);
    expect(r.ok).toBe(false);
  });

  it("currentPrKind returns last event", () => {
    const opened: PrLifecycleEvent = { kind: "opened", at: "t", by: "nex1", note: null };
    const r1 = appendPrEvent(baseState, opened);
    if (r1.ok) {
      expect(currentPrKind(r1.next)).toBe("opened");
    }
  });
});
