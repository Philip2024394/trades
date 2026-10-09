// scripts/nex-canonical/admin-promote-lifecycle.test.ts
//
// Pure-logic tests for the admin lifecycle promotion planner.
// No DB. No network. No clock (clocks are injected).

import { describe, expect, test } from "vitest";
import {
  parseCliArgs,
  planAdminPromotion,
  PROMOTABLE_FROM,
  PROMOTABLE_TO,
  SEALED_LIFECYCLE_STATES,
  SEALED_TRANSITION_REASONS,
  type LifecycleState,
  type TransitionReason,
} from "./admin-promote-lifecycle";

const NOW = new Date("2026-10-09T13:00:00.000Z");
const UUID = "11111111-1111-1111-1111-111111111111";

describe("planAdminPromotion · happy paths", () => {
  test("DISCOVERED → VERIFIED by admin:philip", () => {
    const r = planAdminPromotion({
      canonical_business_id: UUID,
      current_lifecycle_state: "DISCOVERED",
      target_lifecycle_state: "VERIFIED",
      admin_id: "philip",
      transition_reason: "admin_verify",
      now: NOW,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.update_canonical.to_lifecycle_state).toBe("VERIFIED");
      expect(r.plan.update_canonical.updated_at).toEqual(NOW);
      expect(r.plan.insert_lifecycle_log.from_state).toBe("DISCOVERED");
      expect(r.plan.insert_lifecycle_log.to_state).toBe("VERIFIED");
      expect(r.plan.insert_lifecycle_log.transition_reason).toBe("admin_verify");
      expect(r.plan.insert_lifecycle_log.transitioned_by).toBe("admin:philip");
      expect(r.plan.insert_lifecycle_log.transitioned_at).toEqual(NOW);
    }
  });

  test("ENRICHED → VERIFIED", () => {
    const r = planAdminPromotion({
      canonical_business_id: UUID,
      current_lifecycle_state: "ENRICHED",
      target_lifecycle_state: "VERIFIED",
      admin_id: "philip",
      transition_reason: "admin_verify",
      now: NOW,
    });
    expect(r.ok).toBe(true);
  });

  test("DISCOVERED → OWNER_VERIFIED (admin acting on behalf of verified owner)", () => {
    const r = planAdminPromotion({
      canonical_business_id: UUID,
      current_lifecycle_state: "DISCOVERED",
      target_lifecycle_state: "OWNER_VERIFIED",
      admin_id: "philip",
      transition_reason: "owner_verify",
      now: NOW,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.insert_lifecycle_log.transition_reason).toBe("owner_verify");
    }
  });

  test("ENRICHED → DORMANT (admin dormancy)", () => {
    const r = planAdminPromotion({
      canonical_business_id: UUID,
      current_lifecycle_state: "ENRICHED",
      target_lifecycle_state: "DORMANT",
      admin_id: "philip",
      transition_reason: "dormancy",
      now: NOW,
    });
    expect(r.ok).toBe(true);
  });

  test("optional decision_record_id (64-char hex) passes through", () => {
    const r = planAdminPromotion({
      canonical_business_id: UUID,
      current_lifecycle_state: "DISCOVERED",
      target_lifecycle_state: "VERIFIED",
      admin_id: "philip",
      transition_reason: "admin_verify",
      now: NOW,
      decision_record_id: "a".repeat(64),
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.insert_lifecycle_log.decision_record_id).toBe("a".repeat(64));
    }
  });
});

describe("planAdminPromotion · refuses invalid input", () => {
  test("blank canonical_business_id", () => {
    const r = planAdminPromotion({
      canonical_business_id: "   ",
      current_lifecycle_state: "DISCOVERED",
      target_lifecycle_state: "VERIFIED",
      admin_id: "philip",
      transition_reason: "admin_verify",
      now: NOW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("blank_canonical_business_id");
  });

  test("blank admin_id", () => {
    const r = planAdminPromotion({
      canonical_business_id: UUID,
      current_lifecycle_state: "DISCOVERED",
      target_lifecycle_state: "VERIFIED",
      admin_id: "",
      transition_reason: "admin_verify",
      now: NOW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("blank_admin_id");
  });

  test("unknown current state", () => {
    const r = planAdminPromotion({
      canonical_business_id: UUID,
      current_lifecycle_state: "FROZEN" as LifecycleState,
      target_lifecycle_state: "VERIFIED",
      admin_id: "philip",
      transition_reason: "admin_verify",
      now: NOW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("unknown_current_state");
  });

  test("unknown target state", () => {
    const r = planAdminPromotion({
      canonical_business_id: UUID,
      current_lifecycle_state: "DISCOVERED",
      target_lifecycle_state: "FLAGGED" as LifecycleState,
      admin_id: "philip",
      transition_reason: "admin_verify",
      now: NOW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("unknown_target_state");
  });

  test("unknown transition reason", () => {
    const r = planAdminPromotion({
      canonical_business_id: UUID,
      current_lifecycle_state: "DISCOVERED",
      target_lifecycle_state: "VERIFIED",
      admin_id: "philip",
      transition_reason: "cleanup" as TransitionReason,
      now: NOW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("unknown_transition_reason");
  });

  test("not promotable from VERIFIED (terminal-for-admin)", () => {
    const r = planAdminPromotion({
      canonical_business_id: UUID,
      current_lifecycle_state: "VERIFIED",
      target_lifecycle_state: "OWNER_VERIFIED",
      admin_id: "philip",
      transition_reason: "owner_verify",
      now: NOW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_promotable_from");
  });

  test("not promotable from SUPERSEDED (terminal)", () => {
    const r = planAdminPromotion({
      canonical_business_id: UUID,
      current_lifecycle_state: "SUPERSEDED",
      target_lifecycle_state: "VERIFIED",
      admin_id: "philip",
      transition_reason: "admin_verify",
      now: NOW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_promotable_from");
  });

  test("not promotable TO DISCOVERED (regression refused)", () => {
    const r = planAdminPromotion({
      canonical_business_id: UUID,
      current_lifecycle_state: "ENRICHED",
      target_lifecycle_state: "DISCOVERED",
      admin_id: "philip",
      transition_reason: "admin_verify",
      now: NOW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_promotable_to");
  });

  test("not promotable TO OWNER_CLAIMED (requires claim verification)", () => {
    const r = planAdminPromotion({
      canonical_business_id: UUID,
      current_lifecycle_state: "DISCOVERED",
      target_lifecycle_state: "OWNER_CLAIMED",
      admin_id: "philip",
      transition_reason: "admin_verify",
      now: NOW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_promotable_to");
  });

  test("same-state no-op refused", () => {
    const r = planAdminPromotion({
      canonical_business_id: UUID,
      current_lifecycle_state: "DISCOVERED",
      target_lifecycle_state: "DISCOVERED",
      admin_id: "philip",
      transition_reason: "admin_verify",
      now: NOW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("same_state_noop");
  });

  test("invalid decision_record_id format", () => {
    const r = planAdminPromotion({
      canonical_business_id: UUID,
      current_lifecycle_state: "DISCOVERED",
      target_lifecycle_state: "VERIFIED",
      admin_id: "philip",
      transition_reason: "admin_verify",
      now: NOW,
      decision_record_id: "not-a-64-hex-hash",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_decision_record_fmt");
  });
});

describe("sealed value sets", () => {
  test("all SEALED_LIFECYCLE_STATES values match migration 167", () => {
    expect([...SEALED_LIFECYCLE_STATES].sort()).toEqual([
      "DISCOVERED",
      "DORMANT",
      "ENRICHED",
      "OWNER_CLAIMED",
      "OWNER_VERIFIED",
      "SUPERSEDED",
      "VERIFIED",
    ]);
  });

  test("PROMOTABLE_FROM is exactly DISCOVERED + ENRICHED", () => {
    expect([...PROMOTABLE_FROM].sort()).toEqual(["DISCOVERED", "ENRICHED"]);
  });

  test("PROMOTABLE_TO excludes OWNER_CLAIMED (requires claim verification)", () => {
    expect([...PROMOTABLE_TO]).not.toContain("OWNER_CLAIMED");
    expect([...PROMOTABLE_TO]).not.toContain("DISCOVERED");
    expect([...PROMOTABLE_TO]).not.toContain("SUPERSEDED");
  });

  test("SEALED_TRANSITION_REASONS matches migration 168 CHECK subset for admin", () => {
    expect([...SEALED_TRANSITION_REASONS].sort()).toEqual([
      "admin_verify",
      "dormancy",
      "owner_verify",
    ]);
  });
});

describe("parseCliArgs", () => {
  test("parses canonical-id, to, admin, reason", () => {
    const args = parseCliArgs([
      "--canonical-id",
      UUID,
      "--to",
      "VERIFIED",
      "--admin",
      "philip",
      "--reason",
      "admin_verify",
    ]);
    expect(args.canonicalId).toBe(UUID);
    expect(args.to).toBe("VERIFIED");
    expect(args.admin).toBe("philip");
    expect(args.reason).toBe("admin_verify");
  });

  test("defaults to VERIFIED + admin_verify", () => {
    const args = parseCliArgs(["--canonical-id", UUID, "--admin", "philip"]);
    expect(args.to).toBe("VERIFIED");
    expect(args.reason).toBe("admin_verify");
  });
});
