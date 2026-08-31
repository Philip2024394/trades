// Stage 3.20 · Phase 13 · Governance unit tests.

import { describe, it, expect } from "vitest";
import {
  checkPermissions,
  isAllowed,
  DEFAULT_POLICY,
  STRICT_POLICY,
  type PermissionUse,
} from "./governance";

describe("checkPermissions · default policy", () => {
  it("all safe reads allowed", () => {
    const uses: PermissionUse[] = [
      { permission: "read.world_knowledge", context: "retrieveKnowledge" },
      { permission: "read.commerce", context: "findOffers" },
      { permission: "read.session", context: "getSession" },
    ];
    const r = checkPermissions(uses, DEFAULT_POLICY);
    expect(r.hasDenies).toBe(false);
    expect(r.hasRequiresConsent).toBe(false);
    expect(r.allowedCount).toBe(3);
    expect(isAllowed(r)).toBe(true);
  });

  it("safe writes (session/gap/learning) allowed", () => {
    const uses: PermissionUse[] = [
      { permission: "write.session", context: "upsertSession" },
      { permission: "write.workforce_gap", context: "recordInsightGap" },
      { permission: "write.learning_ledger", context: "recordLearning" },
    ];
    const r = checkPermissions(uses, DEFAULT_POLICY);
    expect(r.hasDenies).toBe(false);
    expect(r.hasRequiresConsent).toBe(false);
    expect(r.allowedCount).toBe(3);
  });

  it("user_action requires consent under default policy", () => {
    const uses: PermissionUse[] = [
      { permission: "read.world_knowledge", context: "retrieve" },
      { permission: "execute.user_action", context: "book the second one" },
    ];
    const r = checkPermissions(uses, DEFAULT_POLICY);
    expect(r.hasRequiresConsent).toBe(true);
    expect(r.hasDenies).toBe(false);
    expect(isAllowed(r)).toBe(false);
    expect(r.findings.find((f) => f.permission === "execute.user_action")?.decision).toBe("require_consent");
  });

  it("long_term_memory requires consent under default policy", () => {
    const r = checkPermissions([{ permission: "write.long_term_memory", context: "save preference" }], DEFAULT_POLICY);
    expect(r.hasRequiresConsent).toBe(true);
    expect(r.findings[0].decision).toBe("require_consent");
  });

  it("image_bytes requires consent", () => {
    const r = checkPermissions([{ permission: "read.image_bytes", context: "process photo" }], DEFAULT_POLICY);
    expect(r.hasRequiresConsent).toBe(true);
  });

  it("call.live_source + call.external_llm allowed under default", () => {
    const r = checkPermissions([
      { permission: "call.live_source", context: "BMKG earthquake" },
      { permission: "call.external_llm", context: "Qwen UK staircase" },
    ], DEFAULT_POLICY);
    expect(r.hasDenies).toBe(false);
    expect(r.hasRequiresConsent).toBe(false);
  });

  it("unknown permission defaults to deny", () => {
    // Cast around the type · we're testing runtime safety.
    const uses = [{ permission: "read.unknown_thing" as unknown as PermissionUse["permission"], context: "hypothetical" }];
    const r = checkPermissions(uses, DEFAULT_POLICY);
    expect(r.hasDenies).toBe(true);
    expect(r.findings[0].decision).toBe("deny");
  });
});

describe("checkPermissions · strict policy", () => {
  it("blocks external LLM calls under strict policy", () => {
    const r = checkPermissions([{ permission: "call.external_llm", context: "Qwen" }], STRICT_POLICY);
    expect(r.hasDenies).toBe(true);
    expect(r.findings[0].decision).toBe("deny");
    expect(isAllowed(r)).toBe(false);
  });

  it("blocks writes without consent under strict policy", () => {
    const r = checkPermissions([
      { permission: "write.session", context: "session update" },
      { permission: "write.learning_ledger", context: "ledger write" },
    ], STRICT_POLICY);
    expect(r.hasRequiresConsent).toBe(true);
    expect(r.hasDenies).toBe(false);
  });

  it("allows pure reads under strict policy", () => {
    const r = checkPermissions([
      { permission: "read.world_knowledge", context: "read" },
      { permission: "read.commerce", context: "read" },
      { permission: "read.session", context: "read" },
    ], STRICT_POLICY);
    expect(r.hasDenies).toBe(false);
    expect(r.hasRequiresConsent).toBe(false);
    expect(r.allowedCount).toBe(3);
  });
});

describe("checkPermissions · report shape", () => {
  it("empty uses → empty findings · counts zero", () => {
    const r = checkPermissions([], DEFAULT_POLICY);
    expect(r.findings).toEqual([]);
    expect(r.allowedCount).toBe(0);
    expect(r.hasDenies).toBe(false);
    expect(r.hasRequiresConsent).toBe(false);
    expect(isAllowed(r)).toBe(true);
  });

  it("policy name propagates to findings", () => {
    const r = checkPermissions([{ permission: "read.world_knowledge", context: "test" }], STRICT_POLICY);
    expect(r.policy).toBe("strict");
    expect(r.findings[0].policyName).toBe("strict");
  });

  it("context is preserved in findings", () => {
    const r = checkPermissions([{ permission: "read.world_knowledge", context: "specific op" }], DEFAULT_POLICY);
    expect(r.findings[0].context).toBe("specific op");
  });
});
