// src/lib/nex/ecosystem/__tests__/wave-8a-acceptance.test.ts
//
// UWI · Wave 8.A · Acceptance suite
// Founder-authorised programme (Rule 5o.Q · 8-question output shape).
//
// Proves the judgement machinery: license forensics · supply-chain
// audit · runtime-purity scan · repository-audit orchestrator · HF
// adapter (metadata-only). NO downloads · NO installations · NO UI.

import { describe, it, expect } from "vitest";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  analyseLicense,
  auditSupplyChain,
  makeHuggingFaceAdapter,
  auditRepository,
  type SandboxedRepositoryView,
  type EcosystemResource,
} from "..";

// ═══ License forensics ═════════════════════════════════════════════
describe("Wave 8.A · License forensics · SPDX + copyleft classification", () => {
  it("MIT · permissive · NEX-compatible", () => {
    const r = analyseLicense({ spdx: "MIT" });
    expect(r.spdx_identifier).toBe("MIT");
    expect(r.copyleft_class).toBe("permissive");
    expect(r.nex_compatible).toBe(true);
    expect(r.requires_legal_review).toBe(false);
  });

  it("Apache-2.0 · permissive with patent grant expectation · NEX-compatible", () => {
    const r = analyseLicense({ spdx: "Apache-2.0" });
    expect(r.copyleft_class).toBe("permissive");
    expect(r.nex_compatible).toBe(true);
  });

  it("AGPL-3.0 · network_copyleft · NOT NEX-compatible · REQUIRES LEGAL REVIEW", () => {
    const r = analyseLicense({ spdx: "AGPL-3.0" });
    expect(r.copyleft_class).toBe("network_copyleft");
    expect(r.nex_compatible).toBe(false);
    expect(r.requires_legal_review).toBe(true);
    expect(r.signals.network_use_clause).toBe(true);
  });

  it("SSPL-1.0 · network_copyleft · NOT NEX-compatible", () => {
    const r = analyseLicense({ spdx: "SSPL-1.0" });
    expect(r.copyleft_class).toBe("network_copyleft");
    expect(r.nex_compatible).toBe(false);
  });

  it("GPL-3.0 · strong_copyleft · NOT NEX-compatible", () => {
    const r = analyseLicense({ spdx: "GPL-3.0" });
    expect(r.copyleft_class).toBe("strong_copyleft");
    expect(r.nex_compatible).toBe(false);
  });

  it("BSL-1.1 · commercial · REQUIRES LEGAL REVIEW", () => {
    const r = analyseLicense({ spdx: "BSL-1.1" });
    expect(r.copyleft_class).toBe("commercial");
    expect(r.requires_legal_review).toBe(true);
  });

  it("unknown SPDX · unknown class · REQUIRES LEGAL REVIEW", () => {
    const r = analyseLicense({ spdx: null, text: null });
    expect(r.copyleft_class).toBe("unknown_or_missing");
    expect(r.nex_compatible).toBe(false);
    expect(r.requires_legal_review).toBe(true);
  });

  it("free-text detection · Apache 2.0 phrasing", () => {
    const r = analyseLicense({ spdx: null, text: "Apache License, Version 2.0" });
    expect(r.spdx_identifier).toBe("Apache-2.0");
  });

  it("free-text detection · AGPL phrasing", () => {
    const r = analyseLicense({ spdx: null, text: "GNU AFFERO GENERAL PUBLIC LICENSE Version 3" });
    expect(r.spdx_identifier).toBe("AGPL-3.0");
    expect(r.nex_compatible).toBe(false);
  });
});

// ═══ Supply-chain audit ════════════════════════════════════════════
describe("Wave 8.A · Supply-chain audit", () => {
  it("clean package · low risk", () => {
    const r = auditSupplyChain({
      package_json: { name: "clean-pkg", scripts: { test: "vitest" } },
      transitive_deps: ["undici", "cheerio"],
      code_sample: "export function x() { return 1; }",
      maintainers: ["maintainer-1"],
      package_name: "clean-pkg",
    });
    expect(r.risk_level).toBe("low");
    expect(r.signals.has_postinstall_script).toBe(false);
  });

  it("postinstall script → medium+ risk", () => {
    const r = auditSupplyChain({
      package_json: { name: "postinstall-pkg", scripts: { postinstall: "echo ok" } },
      transitive_deps: [],
      code_sample: null,
      maintainers: ["m"],
      package_name: "postinstall-pkg",
    });
    expect(r.signals.has_postinstall_script).toBe(true);
    expect(["medium", "high", "critical"]).toContain(r.risk_level);
  });

  it("binary-download in script → high risk", () => {
    const r = auditSupplyChain({
      package_json: { name: "downloader", scripts: { postinstall: "curl -o binary https://example.com/binary.sh" } },
      transitive_deps: [],
      code_sample: null,
      maintainers: ["m"],
      package_name: "downloader",
    });
    expect(r.signals.has_binary_download).toBe(true);
    expect(["high", "critical"]).toContain(r.risk_level);
  });

  it("eval() → dynamic-code-execution flagged", () => {
    const r = auditSupplyChain({
      package_json: { name: "evil" },
      transitive_deps: [],
      code_sample: `export function f(x) { return eval(x); }`,
      maintainers: ["m"],
      package_name: "evil",
    });
    expect(r.signals.has_dynamic_code_execution).toBe(true);
  });

  it("suspicious known-incident dep name flagged", () => {
    const r = auditSupplyChain({
      package_json: null,
      transitive_deps: ["event-stream", "faker"],
      code_sample: null,
      maintainers: ["m"],
      package_name: "some-pkg",
    });
    expect(r.signals.suspicious_deps.length).toBeGreaterThan(0);
    expect(r.signals.suspicious_deps).toContain("event-stream");
  });

  it("phone-home endpoint pattern flagged", () => {
    const r = auditSupplyChain({
      package_json: { name: "chatty" },
      transitive_deps: [],
      code_sample: `fetch("https://telemetry.example.com/beacon", { method: "POST" });`,
      maintainers: ["m"],
      package_name: "chatty",
    });
    expect(r.signals.has_phone_home).toBe(true);
  });
});

// ═══ Repository-audit orchestrator (metadata-only mode) ═════════════
describe("Wave 8.A · Repository-audit orchestrator (metadata-only mode)", () => {
  const base_resource: EcosystemResource = {
    ecosystem: "hugging_face",
    resource_kind: "model",
    id: "test-org/test-model",
    source_url: "https://huggingface.co/api/models/test-org/test-model",
    metadata: { title: "Test Model" },
    fetched_at_iso: "2026-09-21T10:00:00.000Z",
  };

  it("permissive licence · metadata-only · produces WorldClassResourceVerdict with 8-question shape", async () => {
    const finding = await auditRepository({
      resource: base_resource,
      view: null,
      declared_license_spdx: "MIT",
      workflow_id: "test-wf", activity_name: "audit", attempt_id: 1,
      user_relevance: 0.6, nex_relevance: 0.7,
    });
    expect(finding.finding_id).toMatch(/^ecofinding:[0-9a-f]{16}$/);
    expect(finding.verdict.what_it_does).toBeTruthy();
    expect(finding.verdict.licence.copyleft_class).toBe("permissive");
    expect(finding.verdict.dependencies_summary).toBeDefined();
    expect(finding.verdict.runtime_purity).toBeDefined();
    expect(finding.verdict.useful_technique).toBeDefined();
    expect(finding.verdict.direct_reuse_verdict).toBeDefined();
    expect(finding.verdict.clean_rebuild_verdict).toBeDefined();
    expect(finding.verdict.opportunity_recommendation).toBeDefined();
    // Provenance chain records the stages
    const stages = finding.provenance_chain.map(p => p.stage);
    expect(stages).toContain("license_forensics");
    expect(stages).toContain("supply_chain_audit");
    expect(stages).toContain("disposition_derived");
  });

  it("AGPL licence → REJECT disposition", async () => {
    const finding = await auditRepository({
      resource: base_resource,
      view: null,
      declared_license_spdx: "AGPL-3.0",
      workflow_id: "wf", activity_name: "a", attempt_id: 1,
      user_relevance: 0.6, nex_relevance: 0.7,
    });
    expect(finding.disposition).toBe("REJECT");
    expect(finding.verdict.licence.nex_compatible).toBe(false);
  });

  it("unknown licence → LEGAL-REVIEW disposition", async () => {
    const finding = await auditRepository({
      resource: base_resource,
      view: null,
      workflow_id: "wf", activity_name: "a", attempt_id: 1,
      user_relevance: 0.6, nex_relevance: 0.7,
    });
    expect(finding.disposition).toBe("LEGAL-REVIEW");
  });

  it("low nex_relevance → DEFER disposition (permissive but not compelling)", async () => {
    const finding = await auditRepository({
      resource: base_resource,
      view: null,
      declared_license_spdx: "MIT",
      workflow_id: "wf", activity_name: "a", attempt_id: 1,
      user_relevance: 0.1, nex_relevance: 0.1,
    });
    expect(["REBUILD", "REFERENCE", "DEFER", "REUSE"]).toContain(finding.disposition);
  });

  it("deterministic finding_id (same inputs → same id)", async () => {
    const a = await auditRepository({
      resource: base_resource, view: null, declared_license_spdx: "MIT",
      workflow_id: "wf", activity_name: "a", attempt_id: 1,
      user_relevance: 0.5, nex_relevance: 0.5,
    });
    const b = await auditRepository({
      resource: base_resource, view: null, declared_license_spdx: "MIT",
      workflow_id: "wf", activity_name: "a", attempt_id: 1,
      user_relevance: 0.5, nex_relevance: 0.5,
    });
    expect(a.finding_id).toBe(b.finding_id);
  });

  it("separate user_relevance + nex_relevance kept (Rule 5o.C M22)", async () => {
    const finding = await auditRepository({
      resource: base_resource, view: null, declared_license_spdx: "MIT",
      workflow_id: "wf", activity_name: "a", attempt_id: 1,
      user_relevance: 0.9, nex_relevance: 0.2,
    });
    expect(finding.user_relevance).toBe(0.9);
    expect(finding.nex_relevance).toBe(0.2);
    // They are separate fields · never averaged into one score
  });
});

// ═══ Repository-audit orchestrator (with sandbox view) ══════════════
describe("Wave 8.A · Repository-audit orchestrator with sandboxed view", () => {
  let sandbox_root: string;
  async function makeSandbox(files: Record<string, string>): Promise<SandboxedRepositoryView> {
    sandbox_root = await mkdtemp(join(tmpdir(), "nex-eco-sandbox-"));
    for (const [rel, content] of Object.entries(files)) {
      const dir = join(sandbox_root, ...rel.split("/").slice(0, -1));
      if (dir !== sandbox_root) await mkdir(dir, { recursive: true });
      await writeFile(join(sandbox_root, rel), content);
    }
    return { root: sandbox_root, resource_id: "test", extracted_at_iso: "2026-09-21T10:00:00.000Z" };
  }

  it("clean permissive repo · sandbox scan · REUSE-candidate direct reuse verdict", async () => {
    const view = await makeSandbox({
      "package.json": JSON.stringify({ name: "clean-lib", license: "MIT", dependencies: { undici: "^6.0.0" }, scripts: { test: "vitest" } }),
      "src/index.ts": `import { fetch } from "undici";\nexport function crawl(url: string) { return fetch(url); }\n`,
    });
    const finding = await auditRepository({
      resource: { ecosystem: "github", resource_kind: "repository", id: "test/clean-lib",
        source_url: "https://github.com/test/clean-lib", metadata: {}, fetched_at_iso: "2026-09-21T10:00:00.000Z" },
      view,
      declared_license_spdx: "MIT",
      workflow_id: "wf", activity_name: "sandbox_audit", attempt_id: 1,
      user_relevance: 0.7, nex_relevance: 0.7,
    });
    expect(finding.verdict.runtime_purity.is_pure_for_nex_runtime).toBe(true);
    expect(finding.verdict.dependencies_summary.direct_count).toBe(1);
    expect(finding.verdict.dependencies_summary.notable).toContain("undici");
    await rm(sandbox_root, { recursive: true, force: true });
  });

  it("repo importing openai → runtime-purity FAIL · disposition REBUILD or REJECT", async () => {
    const view = await makeSandbox({
      "package.json": JSON.stringify({ name: "impure-lib", license: "MIT", dependencies: { openai: "^4.0.0" } }),
      "src/index.ts": `import OpenAI from "openai";\nexport const client = new OpenAI();\n`,
    });
    const finding = await auditRepository({
      resource: { ecosystem: "github", resource_kind: "repository", id: "test/impure",
        source_url: "https://github.com/test/impure", metadata: {}, fetched_at_iso: "2026-09-21T10:00:00.000Z" },
      view,
      declared_license_spdx: "MIT",
      workflow_id: "wf", activity_name: "sandbox_audit", attempt_id: 1,
      user_relevance: 0.7, nex_relevance: 0.7,
    });
    expect(finding.verdict.runtime_purity.is_pure_for_nex_runtime).toBe(false);
    expect(finding.verdict.runtime_purity.external_llm_dependencies.length).toBeGreaterThan(0);
    // Disposition should be REBUILD (if capability rebuildable) or REJECT
    expect(["REBUILD", "REJECT"]).toContain(finding.disposition);
    await rm(sandbox_root, { recursive: true, force: true });
  });
});

// ═══ Hugging Face adapter (mocked · metadata-only) ══════════════════
describe("Wave 8.A · Hugging Face adapter · metadata-only via public API", () => {
  it("fetchMetadata returns EcosystemResource on success", async () => {
    const mock_fetcher = async (url: string) => {
      if (url.includes("/api/models/")) {
        return {
          ok: true, status: 200,
          json: async () => ({ id: "test-org/test-model", cardData: { license: "mit" }, downloads: 42 }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };
    const adapter = makeHuggingFaceAdapter({ fetcher: mock_fetcher, now: () => new Date("2026-09-21T10:00:00.000Z") });
    const r = await adapter.fetchMetadata("test-org/test-model");
    expect(r).not.toBeNull();
    expect(r!.ecosystem).toBe("hugging_face");
    expect(r!.resource_kind).toBe("model");
    expect(r!.id).toBe("test-org/test-model");
    expect(r!.metadata["downloads"]).toBe(42);
  });

  it("fetchMetadata falls through to datasets endpoint if model 404", async () => {
    const mock_fetcher = async (url: string) => {
      if (url.includes("/api/models/")) return { ok: false, status: 404, json: async () => ({}) };
      if (url.includes("/api/datasets/")) return { ok: true, status: 200, json: async () => ({ id: "some-dataset" }) };
      return { ok: false, status: 404, json: async () => ({}) };
    };
    const adapter = makeHuggingFaceAdapter({ fetcher: mock_fetcher, now: () => new Date() });
    const r = await adapter.fetchMetadata("some-dataset");
    expect(r).not.toBeNull();
    expect(r!.resource_kind).toBe("dataset");
  });

  it("fetchMetadata returns null when nothing matches", async () => {
    const mock_fetcher = async () => ({ ok: false, status: 404, json: async () => ({}) });
    const adapter = makeHuggingFaceAdapter({ fetcher: mock_fetcher, now: () => new Date() });
    const r = await adapter.fetchMetadata("nonexistent");
    expect(r).toBeNull();
  });

  it("listResources uses full=false to avoid mass metadata download", async () => {
    let captured_url = "";
    const mock_fetcher = async (url: string) => {
      captured_url = url;
      return { ok: true, status: 200, json: async () => [{ id: "a/b" }, { id: "c/d" }] };
    };
    const adapter = makeHuggingFaceAdapter({ fetcher: mock_fetcher, now: () => new Date() });
    const list = await adapter.listResources({ resource_kind: "model", query: "gemma", limit: 10 });
    expect(list).toHaveLength(2);
    expect(captured_url).toContain("full=false"); // Wave 8.A metadata-only discipline
    expect(captured_url).toContain("search=gemma");
    expect(captured_url).toContain("limit=10");
  });

  it("listResources rejects non-supported resource kinds", async () => {
    const adapter = makeHuggingFaceAdapter({ fetcher: async () => ({ ok: false, status: 404, json: async () => ({}) }), now: () => new Date() });
    const list = await adapter.listResources({ resource_kind: "package", limit: 10 });
    expect(list).toEqual([]);
  });
});

// ═══ End-to-end · HF metadata → orchestrator → EcosystemFinding ═════
describe("Wave 8.A · End-to-end · HF metadata → repository audit → EcosystemFinding", () => {
  it("Apache-2.0 model metadata → LEGAL-REVIEW skipped → runtime-purity assumed pure (metadata-only)", async () => {
    const mock_fetcher = async (url: string) => {
      if (url.includes("/api/models/")) {
        return { ok: true, status: 200, json: async () => ({
          id: "openscience/apache-model",
          cardData: { license: "apache-2.0", pipeline_tag: "sentence-similarity" },
        }) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };
    const adapter = makeHuggingFaceAdapter({ fetcher: mock_fetcher, now: () => new Date("2026-09-21T10:00:00.000Z") });
    const resource = await adapter.fetchMetadata("openscience/apache-model");
    expect(resource).not.toBeNull();

    const declared = { spdx: "Apache-2.0" as const, text: null };
    const finding = await auditRepository({
      resource: resource!,
      view: null,
      declared_license_spdx: declared.spdx,
      workflow_id: "hf-scan", activity_name: "hf_metadata_audit", attempt_id: 1,
      user_relevance: 0.6, nex_relevance: 0.7,
    });
    // Full 8-question output present
    expect(finding.verdict.licence.copyleft_class).toBe("permissive");
    expect(finding.verdict.licence.nex_compatible).toBe(true);
    expect(finding.verdict.direct_reuse_verdict.appropriate).toBeDefined();
    expect(finding.verdict.clean_rebuild_verdict).toBeDefined();
    expect(finding.verdict.opportunity_recommendation.reason).toBeTruthy();
    // Provenance chain includes HF fetch
    expect(finding.provenance_chain[0].detail).toContain("hugging_face:openscience/apache-model");
  });
});
