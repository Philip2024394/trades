// src/lib/nex/ecosystem/__tests__/wave-8c-github-adapter.test.ts
//
// UWI · Wave 8.C · GitHub adapter acceptance suite
// Founder-authorised programme.
//
// Proves the `EcosystemAdapter` contract generalises off Hugging Face:
//   1. Mocked-fetch adapter round-trip (fetchMetadata happy path)
//   2. Mocked-fetch 404 handling (fetchMetadata returns null)
//   3. Mocked-fetch listResources shape parses correctly
//   4. Licence extraction from GitHub metadata shape (license.spdx_id)
//   5. Licence extraction NOASSERTION → null (GitHub convention)
//   6. Licence extraction missing license object → null
//   7. LIVE end-to-end: fetch sindresorhus/type-fest via stdlib fetch → adapter →
//      orchestrator → EcosystemFinding → bridge · gracefully skipped if offline

import { describe, it, expect } from "vitest";
import {
  auditRepository,
  makeGitHubAdapter,
  GITHUB_API_BASE,
  extractDeclaredGitHubLicense,
  bridgeEcosystemFindingToOpportunity,
} from "..";
import type { EcosystemResource, EcosystemFinding } from "../types";
import { OpportunityStore } from "../../research-memory/opportunity-store";
import { LifecycleHistoryLog } from "../../research-memory/lifecycle-history";

// ═══ Licence extraction · GitHub shape ════════════════════════════════
describe("Wave 8.C · GitHub licence extraction", () => {
  it("reads spdx_id from GitHub license object", () => {
    const r = extractDeclaredGitHubLicense({
      license: { key: "mit", name: "MIT License", spdx_id: "MIT", url: "https://…" },
    });
    expect(r.spdx).toBe("MIT");
    expect(r.text).toBe("MIT License");
  });

  it("reads Apache-2.0 spdx_id correctly", () => {
    const r = extractDeclaredGitHubLicense({
      license: { spdx_id: "Apache-2.0", name: "Apache License 2.0" },
    });
    expect(r.spdx).toBe("Apache-2.0");
  });

  it("NOASSERTION (GitHub convention for undetermined) → null", () => {
    const r = extractDeclaredGitHubLicense({
      license: { spdx_id: "NOASSERTION", name: "Other" },
    });
    expect(r.spdx).toBe(null);
    expect(r.text).toBe("Other");
  });

  it("no license object → both null", () => {
    const r = extractDeclaredGitHubLicense({});
    expect(r.spdx).toBe(null);
    expect(r.text).toBe(null);
  });

  it("license is a string not an object → both null (GitHub always returns object or null)", () => {
    const r = extractDeclaredGitHubLicense({ license: "MIT" });
    expect(r.spdx).toBe(null);
    expect(r.text).toBe(null);
  });
});

// ═══ Adapter · mocked fetcher ═════════════════════════════════════════
describe("Wave 8.C · GitHub adapter · mocked fetcher", () => {
  it("fetchMetadata · happy path returns EcosystemResource with resource_kind=repository", async () => {
    const adapter = makeGitHubAdapter({
      fetcher: async (url) => {
        expect(url).toContain("/repos/sindresorhus/type-fest");
        return {
          ok: true, status: 200,
          json: async () => ({
            full_name: "sindresorhus/type-fest",
            license: { spdx_id: "MIT", name: "MIT License" },
            stargazers_count: 15000,
            description: "A collection of essential TypeScript types",
          }),
        };
      },
      now: () => new Date("2026-09-21T00:00:00Z"),
    });
    const r = await adapter.fetchMetadata("sindresorhus/type-fest");
    expect(r).not.toBeNull();
    if (r) {
      expect(r.ecosystem).toBe("github");
      expect(r.resource_kind).toBe("repository");
      expect(r.id).toBe("sindresorhus/type-fest");
      expect((r.metadata as any).license.spdx_id).toBe("MIT");
    }
  });

  it("fetchMetadata · 404 returns null", async () => {
    const adapter = makeGitHubAdapter({
      fetcher: async () => ({ ok: false, status: 404, json: async () => ({ message: "Not Found" }) }),
    });
    const r = await adapter.fetchMetadata("nonexistent/repo");
    expect(r).toBe(null);
  });

  it("listResources · repository search returns items", async () => {
    const adapter = makeGitHubAdapter({
      fetcher: async (url) => {
        expect(url).toContain("/search/repositories");
        expect(url).toContain("q=video-editor");
        return {
          ok: true, status: 200,
          json: async () => ({
            total_count: 2,
            items: [
              { full_name: "org1/video-editor", license: { spdx_id: "MIT" } },
              { full_name: "org2/awesome-editor", license: { spdx_id: "Apache-2.0" } },
            ],
          }),
        };
      },
    });
    const r = await adapter.listResources({ resource_kind: "repository", query: "video-editor", limit: 5 });
    expect(r.length).toBe(2);
    expect(r[0].id).toBe("org1/video-editor");
    expect(r[1].id).toBe("org2/awesome-editor");
  });

  it("listResources · non-repository resource_kind returns empty array (no fetch)", async () => {
    const adapter = makeGitHubAdapter({
      fetcher: async () => { throw new Error("should not be called"); },
    });
    const r = await adapter.listResources({ resource_kind: "model", query: "x" });
    expect(r).toEqual([]);
  });
});

// ═══ LIVE end-to-end · single small public repo ═══════════════════════
describe("Wave 8.C · LIVE GitHub · end-to-end audit (metadata-only)", () => {
  const NETWORK_TIMEOUT_MS = 15_000;

  it("fetches sindresorhus/type-fest and emits an EcosystemFinding via full orchestrator + bridge", async () => {
    // Reachability probe (60 req/hr unauthenticated · one call · well within limit)
    let reachable = false;
    try {
      const probe = await fetch(`${GITHUB_API_BASE}/repos/sindresorhus/type-fest`, {
        method: "GET",
        signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
        headers: {
          "user-agent": "Nex/1.0 (Wave 8.C live-integration acceptance)",
          "accept": "application/vnd.github+json",
        },
      });
      reachable = probe.ok;
    } catch {
      reachable = false;
    }
    if (!reachable) {
      console.warn("Wave 8.C live-GitHub probe: network unreachable or rate-limited · skipping live integration path");
      return;
    }

    const adapter = makeGitHubAdapter({});
    const resource = await adapter.fetchMetadata("sindresorhus/type-fest");
    expect(resource).not.toBeNull();
    if (!resource) return;

    expect(resource.ecosystem).toBe("github");
    expect(resource.resource_kind).toBe("repository");
    expect(resource.id).toBe("sindresorhus/type-fest");

    const declared = extractDeclaredGitHubLicense(resource.metadata as Record<string, unknown>);
    // type-fest is CC0-1.0 (public-domain dedication per its LICENSE file) · this is
    // exactly the reality-check Rule 5b calls for — I initially assumed MIT and this
    // test caught the assumption. Real ground truth beats plausible guess.
    // CC0-1.0 must be handled as permissive in license-forensics for nex_compatible=true.
    expect(declared.spdx).toBe("CC0-1.0");

    // Run orchestrator against live metadata (metadata-only mode · view=null)
    const finding: EcosystemFinding = await auditRepository({
      resource: resource as EcosystemResource,
      view: null,
      declared_license_spdx: declared.spdx,
      declared_license_text: declared.text,
      workflow_id: "wave-8c-live-github-integration",
      activity_name: "audit-type-fest",
      attempt_id: 1,
      user_relevance: 0.3,   // low · type-fest is a TS-types library, not directly user-relevant to trades platform
      nex_relevance: 0.6,    // higher · NEX itself uses TS types intensively
      novelty_score: 0.2,
    });

    // Founder-locked 8-question verdict shape populated
    expect(finding.finding_id).toMatch(/^ecofinding:[a-f0-9]{16}$/);
    expect(finding.verdict.licence.spdx_identifier).toBe("CC0-1.0");
    expect(finding.verdict.licence.copyleft_class).toBe("permissive");
    expect(finding.verdict.licence.nex_compatible).toBe(true);
    expect(["REUSE", "REBUILD", "REFERENCE", "REJECT", "LEGAL-REVIEW", "DEFER"]).toContain(finding.disposition);
    expect(finding.provenance_chain.map(s => s.stage)).toEqual([
      "resource_fetched",
      "license_forensics",
      "supply_chain_audit",
      "runtime_purity_scan",
      "capability_extraction",
      "disposition_derived",
    ]);

    // Bridge into Wave 5 lifecycle
    const store = new OpportunityStore(new LifecycleHistoryLog());
    const outcome = bridgeEcosystemFindingToOpportunity(finding, {
      actor: "wave-8c-live-integration",
      workflow_id: "wave-8c-live-github-integration",
      opportunity_store: store,
    });
    expect(["opportunity_created", "downgraded_to_observation", "disposition_blocked"]).toContain(outcome.kind);

    console.log("Wave 8.C live-GitHub verdict summary:", {
      resource_id: finding.resource.id,
      ecosystem: finding.resource.ecosystem,
      disposition: finding.disposition,
      licence: finding.verdict.licence.spdx_identifier,
      copyleft_class: finding.verdict.licence.copyleft_class,
      nex_compatible: finding.verdict.licence.nex_compatible,
      capability_category: finding.verdict.useful_technique.capability_category,
      bridge_outcome: outcome.kind,
    });
  }, NETWORK_TIMEOUT_MS + 10_000);
});
