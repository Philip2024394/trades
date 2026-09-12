// src/lib/nex/intervention/intervention.test.ts
//
// Stage 7 tests · three-level intervention + auto-rebuild lock.

import { describe, it, expect } from "vitest";
import {
  validateIntervention,
  InMemoryInterventionStore,
  type InterventionRecord,
} from "./index";

const makeRecord = (overrides: Partial<InterventionRecord> = {}): InterventionRecord => ({
  interventionId: "int-1",
  capabilityId: "CAP-091",
  targetRevisionId: "rev-1",
  kind: "DISABLE",
  rollbackTargetRevisionId: null,
  reason: "regression",
  issuedBy: "founder-sig",
  issuedAt: new Date().toISOString(),
  autoRebuildLocked: false,
  ...overrides,
});

describe("validateIntervention", () => {
  it("accepts a well-formed DISABLE", () => {
    const r = validateIntervention({
      capabilityId: "CAP-091",
      targetRevisionId: "rev-1",
      kind: "DISABLE",
      reason: "hidden temporarily",
      issuedBy: "founder-sig",
    });
    expect(r.ok).toBe(true);
  });

  it("accepts a ROLLBACK with valid target", () => {
    const r = validateIntervention({
      capabilityId: "CAP-091",
      targetRevisionId: "rev-2",
      kind: "ROLLBACK",
      rollbackTargetRevisionId: "rev-1",
      reason: "regression",
      issuedBy: "founder-sig",
    });
    expect(r.ok).toBe(true);
  });

  it("rejects ROLLBACK without target", () => {
    const r = validateIntervention({
      capabilityId: "CAP-091",
      targetRevisionId: "rev-2",
      kind: "ROLLBACK",
      reason: "regression",
      issuedBy: "founder-sig",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.intervention_rollback_missing_target");
  });

  it("rejects rollback to same revision", () => {
    const r = validateIntervention({
      capabilityId: "CAP-091",
      targetRevisionId: "rev-1",
      kind: "ROLLBACK",
      rollbackTargetRevisionId: "rev-1",
      reason: "regression",
      issuedBy: "founder-sig",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.intervention_rollback_self");
  });

  it("rejects DISABLE with rollback target", () => {
    const r = validateIntervention({
      capabilityId: "CAP-091",
      targetRevisionId: "rev-1",
      kind: "DISABLE",
      rollbackTargetRevisionId: "rev-0",
      reason: "regression",
      issuedBy: "founder-sig",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.intervention_rollback_target_on_non_rollback");
  });

  it("rejects missing signature", () => {
    const r = validateIntervention({
      capabilityId: "CAP-091",
      targetRevisionId: "rev-1",
      kind: "DISABLE",
      reason: "x",
      issuedBy: "",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.intervention_missing_signature");
  });

  it("rejects missing reason (audit trail)", () => {
    const r = validateIntervention({
      capabilityId: "CAP-091",
      targetRevisionId: "rev-1",
      kind: "DISABLE",
      reason: "",
      issuedBy: "founder-sig",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.intervention_missing_reason");
  });

  it("rejects bad capability id", () => {
    const r = validateIntervention({
      capabilityId: "cap-91",
      targetRevisionId: "rev-1",
      kind: "DISABLE",
      reason: "x",
      issuedBy: "founder-sig",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.intervention_bad_capability");
  });
});

describe("InMemoryInterventionStore · auto-rebuild lock", () => {
  it("REMOVE_FROM_LIVE locks the capability", () => {
    const store = new InMemoryInterventionStore();
    store.record(
      makeRecord({
        kind: "REMOVE_FROM_LIVE",
        capabilityId: "CAP-091",
        autoRebuildLocked: true,
      }),
    );
    expect(store.isCapabilityLocked("CAP-091")).toBe(true);
  });

  it("DISABLE does NOT lock", () => {
    const store = new InMemoryInterventionStore();
    store.record(makeRecord({ kind: "DISABLE" }));
    expect(store.isCapabilityLocked("CAP-091")).toBe(false);
  });

  it("ROLLBACK does NOT lock", () => {
    const store = new InMemoryInterventionStore();
    store.record(
      makeRecord({
        kind: "ROLLBACK",
        rollbackTargetRevisionId: "rev-0",
        targetRevisionId: "rev-1",
      }),
    );
    expect(store.isCapabilityLocked("CAP-091")).toBe(false);
  });

  it("attemptAutoRebuild allowed when unlocked", () => {
    const store = new InMemoryInterventionStore();
    const r = store.attemptAutoRebuild({ capabilityId: "CAP-091", attemptedBy: "master-ai" });
    expect(r.allowed).toBe(true);
    expect(r.blockingInterventionId).toBeNull();
  });

  it("attemptAutoRebuild blocked when locked · records the attempt", () => {
    const store = new InMemoryInterventionStore();
    store.record(
      makeRecord({
        kind: "REMOVE_FROM_LIVE",
        capabilityId: "CAP-091",
        interventionId: "int-lock-1",
        autoRebuildLocked: true,
      }),
    );
    const r = store.attemptAutoRebuild({ capabilityId: "CAP-091", attemptedBy: "master-ai" });
    expect(r.allowed).toBe(false);
    expect(r.blockingInterventionId).toBe("int-lock-1");
    const attempts = store.listAutoRebuildAttempts();
    expect(attempts.length).toBe(1);
    expect(attempts[0].rejectionCode).toBe("sec.constitutional_auto_rebuild_attempted");
    expect(attempts[0].attemptedBy).toBe("master-ai");
    expect(attempts[0].blockingInterventionId).toBe("int-lock-1");
  });

  it("unlockAutoRebuild founder-only · requires signature + reason", () => {
    const store = new InMemoryInterventionStore();
    store.record(
      makeRecord({
        kind: "REMOVE_FROM_LIVE",
        capabilityId: "CAP-091",
        autoRebuildLocked: true,
      }),
    );
    expect(store.isCapabilityLocked("CAP-091")).toBe(true);

    const noSig = store.unlockAutoRebuild({ capabilityId: "CAP-091", unlockedBy: "", reason: "x" });
    expect(noSig.unlocked).toBe(false);
    expect(store.isCapabilityLocked("CAP-091")).toBe(true);

    const noReason = store.unlockAutoRebuild({ capabilityId: "CAP-091", unlockedBy: "founder", reason: "" });
    expect(noReason.unlocked).toBe(false);
    expect(store.isCapabilityLocked("CAP-091")).toBe(true);

    const okUnlock = store.unlockAutoRebuild({
      capabilityId: "CAP-091",
      unlockedBy: "founder",
      reason: "restored after review",
    });
    expect(okUnlock.unlocked).toBe(true);
    expect(store.isCapabilityLocked("CAP-091")).toBe(false);
  });

  it("multiple caps · isolation preserved", () => {
    const store = new InMemoryInterventionStore();
    store.record(
      makeRecord({ kind: "REMOVE_FROM_LIVE", capabilityId: "CAP-091", autoRebuildLocked: true }),
    );
    store.record(makeRecord({ kind: "DISABLE", capabilityId: "CAP-092" }));
    expect(store.isCapabilityLocked("CAP-091")).toBe(true);
    expect(store.isCapabilityLocked("CAP-092")).toBe(false);
    expect(store.isCapabilityLocked("CAP-999")).toBe(false);
  });

  it("history preserved (record kept even after unlock)", () => {
    const store = new InMemoryInterventionStore();
    store.record(
      makeRecord({
        kind: "REMOVE_FROM_LIVE",
        interventionId: "int-remove-1",
        capabilityId: "CAP-091",
        autoRebuildLocked: true,
      }),
    );
    store.unlockAutoRebuild({ capabilityId: "CAP-091", unlockedBy: "founder", reason: "ok" });
    const all = store.listInterventions();
    expect(all.length).toBe(1);
    expect(all[0].kind).toBe("REMOVE_FROM_LIVE");
  });
});
