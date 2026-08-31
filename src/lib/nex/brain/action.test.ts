// Stage 3.21 · Phase 14 · Action unit tests.

import { describe, it, expect } from "vitest";
import { proposeAction, executeAction, type ActionTarget } from "./action";
import type { GovernanceReport } from "./governance";

const T: ActionTarget = { canonical: "hotel trim tiga", raw: "Hotel Trim Tiga", refId: "place:accommodation:osm:node_1359116507" };

function govAllow(): GovernanceReport {
  return {
    policy: "default",
    findings: [{ permission: "read.world_knowledge", decision: "allow", context: "read", policyName: "default" }],
    hasDenies: false,
    hasRequiresConsent: false,
    allowedCount: 1,
  };
}
function govRequireConsent(): GovernanceReport {
  return {
    policy: "default",
    findings: [
      { permission: "read.world_knowledge", decision: "allow", context: "read", policyName: "default" },
      { permission: "execute.user_action", decision: "require_consent", context: "book intent", policyName: "default" },
    ],
    hasDenies: false,
    hasRequiresConsent: true,
    allowedCount: 1,
  };
}

describe("proposeAction · open_directory (v1 wired)", () => {
  it("available when target has refId", () => {
    const p = proposeAction({ requestedKind: "open_directory", target: T, governance: govAllow() });
    expect(p.availability).toBe("available");
    expect(p.linkPreview).toContain("/nex-app/centre?ref=");
    expect(p.linkPreview).toContain(encodeURIComponent(T.refId!));
    expect(p.consentRequired).toBe(false);
  });

  it("available when target has raw name but no refId · falls back to q= query", () => {
    const p = proposeAction({ requestedKind: "open_directory", target: { canonical: "griya", raw: "Griya Sentana" }, governance: govAllow() });
    expect(p.availability).toBe("available");
    expect(p.linkPreview).toContain("/nex-app/centre?q=");
    expect(p.linkPreview).toContain(encodeURIComponent("Griya Sentana"));
  });

  it("requires_data when no target at all", () => {
    const p = proposeAction({ requestedKind: "open_directory", target: undefined, governance: govAllow() });
    expect(p.availability).toBe("requires_data");
    expect(p.linkPreview).toBeUndefined();
  });

  it("propagates consent requirement from Governance", () => {
    const p = proposeAction({ requestedKind: "open_directory", target: T, governance: govRequireConsent() });
    expect(p.consentRequired).toBe(true);
  });
});

describe("proposeAction · declared_not_wired actions", () => {
  const kinds = ["contact_via_whatsapp", "email_seller", "save_to_list", "book_now", "add_to_cart"] as const;
  for (const kind of kinds) {
    it(`${kind} → declared_not_wired with honest reason`, () => {
      const p = proposeAction({ requestedKind: kind, target: T, governance: govAllow() });
      expect(p.availability).toBe("declared_not_wired");
      expect(p.reason.length).toBeGreaterThan(0);
      expect(p.linkPreview).toBeUndefined();
    });
  }
});

describe("executeAction · v1 semantics", () => {
  it("executes open_directory when consent is not required", () => {
    const p = proposeAction({ requestedKind: "open_directory", target: T, governance: govAllow() });
    const e = executeAction(p);
    expect(e.executed).toBe(true);
    if (e.executed) {
      expect(e.result.url).toContain("/nex-app/centre");
      expect(e.result.message).toContain(T.raw);
    }
  });

  it("refuses to execute when consent is required · returns no_consent", () => {
    const p = proposeAction({ requestedKind: "open_directory", target: T, governance: govRequireConsent() });
    const e = executeAction(p);
    expect(e.executed).toBe(false);
    if (!e.executed) {
      expect(e.reason).toBe("no_consent");
      expect(e.message).toContain("consent");
    }
  });

  it("refuses to execute when no target · returns no_target", () => {
    const p = proposeAction({ requestedKind: "open_directory", target: undefined, governance: govAllow() });
    const e = executeAction(p);
    expect(e.executed).toBe(false);
    if (!e.executed) expect(e.reason).toBe("no_target");
  });

  it("refuses to execute declared_not_wired action · returns not_wired", () => {
    const p = proposeAction({ requestedKind: "book_now", target: T, governance: govAllow() });
    const e = executeAction(p);
    expect(e.executed).toBe(false);
    if (!e.executed) expect(e.reason).toBe("not_wired");
  });

  it("NEVER fabricates a URL for a target with no id or name", () => {
    const p = proposeAction({ requestedKind: "open_directory", target: { canonical: "", raw: "" }, governance: govAllow() });
    expect(p.availability).toBe("requires_data");
    const e = executeAction(p);
    expect(e.executed).toBe(false);
  });
});
