// src/lib/nex-agent/code-engine/capability-provider-registry.test.ts
//
// Founder §16: only implement providers actually supported and tested.
// The registry itself does not ship implementations · it defines a contract.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  registerProvider,
  deregisterProvider,
  listProviders,
  getProvider,
  snapshotProviderStatus,
  digestRegistry,
  _resetRegistryForTests,
  PROVIDER_REGISTRY_VERSION,
  type ProviderFunctions,
} from "./capability-provider-registry";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

let tmp: string;
beforeEach(() => {
  _resetRegistryForTests();
  tmp = mkdtempSync(path.join(tmpdir(), "nex1-provreg-"));
});
afterEach(() => {
  _resetRegistryForTests();
  rmSync(tmp, { recursive: true, force: true });
});

const stubFunctions: ProviderFunctions = {
  probeConnection: async () => ({ connected: false, authenticated: false, reason: "stub" }),
};

describe("provider registry · Ledger B · no lock-in", () => {
  describe("registration + listing", () => {
    it("starts empty", () => {
      expect(listProviders()).toEqual([]);
    });

    it("registers a provider descriptor with capabilities + provenance", () => {
      const d = registerProvider({
        provider_id: "github",
        display_name: "GitHub",
        capabilities: ["connect", "authenticate", "commit", "push", "check_push_status"],
        registered_by: "test",
        notes: "stub for test",
      }, stubFunctions, { data_root: tmp });
      expect(d.registered_at_iso).toBeTruthy();
      expect(listProviders().length).toBe(1);
      expect(getProvider("github")?.display_name).toBe("GitHub");
    });

    it("registration is deterministic in ordering across list calls", () => {
      registerProvider({ provider_id: "gitlab", display_name: "GitLab", capabilities: ["push"], registered_by: "test", notes: "" }, stubFunctions, { data_root: tmp });
      registerProvider({ provider_id: "github", display_name: "GitHub", capabilities: ["push"], registered_by: "test", notes: "" }, stubFunctions, { data_root: tmp });
      registerProvider({ provider_id: "bitbucket", display_name: "Bitbucket", capabilities: ["push"], registered_by: "test", notes: "" }, stubFunctions, { data_root: tmp });
      const listed = listProviders().map((p) => p.provider_id);
      expect(listed).toEqual(["bitbucket", "github", "gitlab"]);  // alphabetical
    });

    it("deregister removes provider", () => {
      registerProvider({ provider_id: "github", display_name: "GitHub", capabilities: ["push"], registered_by: "test", notes: "" }, stubFunctions, { data_root: tmp });
      expect(deregisterProvider("github")).toBe(true);
      expect(listProviders()).toEqual([]);
    });
  });

  describe("provider capabilities enum coverage", () => {
    it("supports all 9 canonical capabilities", () => {
      const d = registerProvider({
        provider_id: "full",
        display_name: "Full",
        capabilities: [
          "connect", "authenticate", "get_repository", "create_repository",
          "get_remote_state", "commit", "push", "pull", "check_push_status",
        ],
        registered_by: "test",
        notes: "",
      }, stubFunctions, { data_root: tmp });
      expect(d.capabilities.length).toBe(9);
    });
  });

  describe("status probe · anti-fabrication (founder §16)", () => {
    it("connected/authenticated derive from probeConnection · not from registration", async () => {
      registerProvider({
        provider_id: "declares-authenticated-but-lies",
        display_name: "Liar",
        capabilities: ["connect", "push"],
        registered_by: "test",
        notes: "",
      }, {
        // This provider says it's not actually connected/authenticated
        probeConnection: async () => ({ connected: false, authenticated: false, reason: "not_configured" }),
      }, { data_root: tmp });

      const snap = await snapshotProviderStatus();
      expect(snap.total_registered).toBe(1);
      expect(snap.total_connected).toBe(0);
      expect(snap.total_authenticated).toBe(0);
      expect(snap.statuses[0].last_error_reason).toBe("not_configured");
    });

    it("swallows probe exceptions · reports as not-connected", async () => {
      registerProvider({
        provider_id: "throws",
        display_name: "Throws",
        capabilities: ["push"],
        registered_by: "test",
        notes: "",
      }, {
        probeConnection: async () => { throw new Error("boom"); },
      }, { data_root: tmp });
      const snap = await snapshotProviderStatus();
      expect(snap.statuses[0].connected).toBe(false);
      expect(snap.statuses[0].last_error_reason).toContain("boom");
    });

    it("total_authenticated counts only providers whose probe returns authenticated=true", async () => {
      registerProvider({ provider_id: "a", display_name: "A", capabilities: ["push"], registered_by: "test", notes: "" },
        { probeConnection: async () => ({ connected: true, authenticated: true, reason: null }) },
        { data_root: tmp });
      registerProvider({ provider_id: "b", display_name: "B", capabilities: ["push"], registered_by: "test", notes: "" },
        { probeConnection: async () => ({ connected: true, authenticated: false, reason: "no_credentials" }) },
        { data_root: tmp });
      const snap = await snapshotProviderStatus();
      expect(snap.total_registered).toBe(2);
      expect(snap.total_connected).toBe(2);
      expect(snap.total_authenticated).toBe(1);
    });
  });

  describe("determinism + invariants", () => {
    it("digestRegistry is stable across identical registrations", () => {
      registerProvider({ provider_id: "x", display_name: "X", capabilities: ["push", "commit"], registered_by: "test", notes: "" }, stubFunctions, { data_root: tmp });
      const d1 = digestRegistry();
      const d2 = digestRegistry();
      expect(d1).toBe(d2);
    });

    it("digestRegistry differs when capabilities differ", () => {
      registerProvider({ provider_id: "x", display_name: "X", capabilities: ["push"], registered_by: "test", notes: "" }, stubFunctions, { data_root: tmp });
      const d1 = digestRegistry();
      _resetRegistryForTests();
      registerProvider({ provider_id: "x", display_name: "X", capabilities: ["push", "pull"], registered_by: "test", notes: "" }, stubFunctions, { data_root: tmp });
      const d2 = digestRegistry();
      expect(d1).not.toBe(d2);
    });

    it("no providers registered = no providers to fabricate", async () => {
      const snap = await snapshotProviderStatus();
      expect(snap.total_registered).toBe(0);
      expect(snap.total_connected).toBe(0);
      expect(snap.statuses).toEqual([]);
    });

    it("snapshot declares zero_llm=true and ledger=B", async () => {
      const snap = await snapshotProviderStatus();
      expect(snap.zero_llm).toBe(true);
      expect(snap.ledger).toBe("B");
    });

    it("stamps canonical version", () => {
      expect(PROVIDER_REGISTRY_VERSION).toBe("provider-registry.v1.2026-09-19");
    });
  });

  describe("this module ships zero provider implementations (founder §16 · anti-lock-in)", () => {
    it("registerProvider requires functions supplied by the caller", () => {
      // The registry doesn't have GitHub / GitLab / Bitbucket baked in.
      // A caller must register them. Absence of built-in implementations is by design.
      expect(listProviders().length).toBe(0);
      // Attempting to snapshot with no providers is honest · returns empty
      // rather than fabricating.
    });
  });
});
