// WO-INTELLIGENCE-01 · acceptance tests
//
// Every test in this file is adversarial in the sense founder-locked at
// WO-13: "secretly try to grow authority → assert NEX refuses". The
// non-adversarial success-criteria tests from §7.7 of the spec are also
// here, but the adversarial ones are the load-bearing ones.
//
// Zero external LLM. Real subprocess. Real cryptography. Real filesystem.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { generateKeyPairSync, randomUUID } from "node:crypto";

import { signCrawlerManifest, checkCrawlerRequest, verifyCrawlerManifest, canonicalizeCrawlerEntries } from "../crawler-manifest";
import { crawlerFetch, type HttpRequestFn } from "../crawler";
import { parseArxivAtom, ingestSource } from "../ingestion";
import { detectPatterns, detectConflicts, detectConnections, detectCombinations } from "../discovery-engine";
import { formHypothesis } from "../hypothesis-engine";
import { runParseStderrExperiment, type ParseStderrTestCase } from "../experiment-engine";
import { scoreEvidence, decidePromotion, buildKnowledgeObject, enforcePromotionCeiling, INTELLIGENCE_THRESHOLDS, SUPER_INTELLIGENCE_THRESHOLDS } from "../scoring";
import { buildProposal } from "../proposal";
import { runDiscoveryCore } from "../orchestrator";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import type { CrawlerManifest, CrawlerManifestEntry, KnowledgeObject, KnowledgeStatus, SourceRecord } from "../types";

// ── Test helpers ────────────────────────────────────────────────────────

const REPO_ROOT = process.cwd();
const FIXTURE_PATH = path.join(REPO_ROOT, "src/lib/nex-intelligence/__fixtures__/arxiv-test-corpus.atom");

function newTestAttestationKeyPair(): { public_der_hex: string; private_pkcs8_hex: string } {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    public_der_hex:  (publicKey.export({ type: "spki",  format: "der" }) as Buffer).toString("hex"),
    private_pkcs8_hex: (privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString("hex"),
  };
}

function makeTestManifest(attKey: { private_pkcs8_hex: string }): CrawlerManifest {
  const entry: CrawlerManifestEntry = {
    manifest_entry_id: "arxiv-test-2026-09-13",
    authorised_hosts: ["export.arxiv.org", "rss.arxiv.org"],
    authorised_paths: ["/api/query", "/atom/cs.SE"],
    authorised_methods: ["GET"],
    rate_limit_requests_per_minute: 20,
    authorised_categories: ["cs.SE", "cs.PL"],
    authorised_query_predicates: ["program repair", "agentic", "automated program repair", "software engineering"],
    authorising_wo_id: "wo-intelligence-01",
    expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
  };
  return signCrawlerManifest(attKey.private_pkcs8_hex, [entry]);
}

async function makeSandbox(): Promise<string> {
  const dir = path.join(REPO_ROOT, "data", "nex-agent-workspaces", `wo-intel-01-sandbox-${randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function cleanIntelligenceCollections(): Promise<void> {
  const files = [
    "nex_intelligence_sources",
    "nex_intelligence_knowledge_objects",
    "nex_intelligence_hypotheses",
    "nex_intelligence_experiments",
    "nex_intelligence_proposals",
    "nex_intelligence_crawler_audit",
  ];
  const root = path.join(REPO_ROOT, "data", "nex-storage");
  for (const f of files) {
    try { await fs.unlink(path.join(root, `${f}.jsonl`)); } catch { /* ok */ }
  }
}

// Build an HTTP override that returns our fixture bytes, indistinguishable
// from a real arXiv response as far as the crawler is concerned.
async function fixtureHttpOverride(): Promise<HttpRequestFn> {
  const body = await fs.readFile(FIXTURE_PATH);
  return async (_input) => ({
    status: 200,
    headers: { "content-type": "application/atom+xml; charset=UTF-8" },
    body,
  });
}

// ═════════════════════════════════════════════════════════════════════════
// PROPERTY & POSITIVE TESTS  (spec §7.7 success criteria)
// ═════════════════════════════════════════════════════════════════════════

describe("WO-INTELLIGENCE-01 · positive & property tests", () => {
  afterEach(() => cleanIntelligenceCollections());

  it("§7.7-1 · crawler produces a real SourceRecord with correct content hash + provenance chain", async () => {
    const att = newTestAttestationKeyPair();
    const manifest = makeTestManifest(att);
    const http = await fixtureHttpOverride();
    const result = await crawlerFetch({
      manifest,
      trusted_attestation_keys: [att.public_der_hex],
      url: "https://export.arxiv.org/api/query?search_query=cat:cs.SE&max_results=25",
      method: "GET",
      _http_override: http,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source.record_type).toBe("NEX_INTELLIGENCE_SOURCE");
    expect(result.source.content_bytes).toBeGreaterThan(1000);
    expect(result.source.content_hash_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.source.provenance_chain_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("§7.7-2 · ingestion produces ≥ 5 knowledge fragments from the fixture", async () => {
    const body = await fs.readFile(FIXTURE_PATH, "utf8");
    const fragments = parseArxivAtom(body, "test-source-id");
    expect(fragments.length).toBeGreaterThanOrEqual(5);
    for (const f of fragments) {
      expect(f.record_type).toBe("NEX_INTELLIGENCE_KNOWLEDGE_FRAGMENT");
      expect(f.title.length).toBeGreaterThan(0);
      expect(f.abstract.length).toBeGreaterThan(0);
      expect(f.authors.length).toBeGreaterThan(0);
      expect(f.content_hash_sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(f.provenance_chain_hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("§7.7-3 · Discovery Engine produces ≥ 1 pattern AND ≥ 1 combination", async () => {
    const body = await fs.readFile(FIXTURE_PATH, "utf8");
    const fragments = parseArxivAtom(body, "test-source-id");
    const patterns = detectPatterns(fragments, { minSupport: 2 });
    const combos = detectCombinations(patterns);
    expect(patterns.length).toBeGreaterThanOrEqual(1);
    expect(combos.length).toBeGreaterThanOrEqual(1);
    for (const c of combos) {
      expect(c.pattern).toBe("combination");
      expect(c.input_fragment_ids.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("§7.7-4 · Hypothesis Engine produces ≥ 1 hypothesis with testable claim", async () => {
    const body = await fs.readFile(FIXTURE_PATH, "utf8");
    const fragments = parseArxivAtom(body, "test-source-id");
    const patterns = detectPatterns(fragments, { minSupport: 2 });
    const combos = detectCombinations(patterns);
    expect(combos.length).toBeGreaterThanOrEqual(1);
    const h = formHypothesis(combos[0], fragments);
    expect(h).not.toBeNull();
    if (!h) return;
    expect(h.claim.length).toBeGreaterThan(20);
    expect(h.expected_outcome.length).toBeGreaterThan(0);
    expect(h.measurable_criterion.length).toBeGreaterThan(0);
    expect(h.provenance_chain_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("§7.7-5 · Experiment Engine runs REAL subprocess and produces ExperimentRecord", async () => {
    const body = await fs.readFile(FIXTURE_PATH, "utf8");
    const fragments = parseArxivAtom(body, "test-source-id");
    const patterns = detectPatterns(fragments, { minSupport: 2 });
    const combos = detectCombinations(patterns);
    const h = formHypothesis(combos[0]!, fragments)!;
    const sandbox = await makeSandbox();
    try {
      const testCases: ParseStderrTestCase[] = [
        { case_id: "tc1", stderr_snippet: "", expected_rule: "file-not-found", expected_message_pattern: /ENOENT/i },
        { case_id: "tc2", stderr_snippet: "", expected_rule: "syntax-error", expected_message_pattern: /Syntax|Unexpected/i },
        { case_id: "tc3", stderr_snippet: "", expected_rule: "clean", expected_message_pattern: null },
      ];
      const exp = await runParseStderrExperiment({ hypothesis: h, test_cases: testCases, sandbox_root: sandbox });
      expect(exp.record_type).toBe("NEX_INTELLIGENCE_EXPERIMENT");
      expect(exp.test_cases.length).toBe(3);
      expect(exp.outcomes.length).toBe(3);
      // At least one case must match (real subprocess must be behaving)
      expect(exp.success_count).toBeGreaterThanOrEqual(1);
    } finally { await fs.rm(sandbox, { recursive: true, force: true }); }
  }, 60_000);

  it("§7.7-6 · Scoring produces deterministic score (same evidence → same score)", () => {
    const s1 = scoreEvidence({
      source_count: 8, experiment: null, correlation_count: 2, generalisation_passed: true,
      contradiction_count: 0, reproduced_by_nex: false, synthesised_from_count: 1,
    });
    const s2 = scoreEvidence({
      source_count: 8, experiment: null, correlation_count: 2, generalisation_passed: true,
      contradiction_count: 0, reproduced_by_nex: false, synthesised_from_count: 1,
    });
    expect(s1).toEqual(s2);
  });

  it("§7.7-7 · orchestrator end-to-end reaches ≥ PROPOSED and emits a proposal", async () => {
    const att = newTestAttestationKeyPair();
    const manifest = makeTestManifest(att);
    const http = await fixtureHttpOverride();
    const sandbox = await makeSandbox();
    try {
      const result = await runDiscoveryCore({
        manifest,
        trusted_attestation_keys: [att.public_der_hex],
        fetch_url: "https://export.arxiv.org/api/query?search_query=cat:cs.SE",
        sandbox_root: sandbox,
        stderr_test_cases: [
          { case_id: "e2e-1", stderr_snippet: "", expected_rule: "file-not-found", expected_message_pattern: /ENOENT/i },
          { case_id: "e2e-2", stderr_snippet: "", expected_rule: "clean", expected_message_pattern: null },
        ],
        _http_override: http,
      });
      expect(result.knowledge_objects.length).toBeGreaterThanOrEqual(1);
      expect(result.proposals.length).toBeGreaterThanOrEqual(1);
      const obj = result.knowledge_objects[0];
      const validStatuses: KnowledgeStatus[] = ["DISCOVERED", "PROPOSED", "TESTED", "APPROVED", "SUPER_INTELLIGENCE_CANDIDATE"];
      expect(validStatuses).toContain(obj.status);
      // PRODUCTION or SUPER_INTELLIGENCE MUST NEVER be produced by the pipeline
      expect(obj.status).not.toBe("PRODUCTION");
      expect(obj.status).not.toBe("SUPER_INTELLIGENCE");
      expect(obj.authorised_by).toBeNull();
      expect(obj.authorising_wo_id).toBeNull();
    } finally { await fs.rm(sandbox, { recursive: true, force: true }); }
  }, 120_000);
});

// ═════════════════════════════════════════════════════════════════════════
// 16 ADVERSARIAL TESTS  (spec §8)
// ═════════════════════════════════════════════════════════════════════════

describe("WO-INTELLIGENCE-01 · adversarial tests", () => {
  afterEach(() => cleanIntelligenceCollections());

  // 1
  it("A-1 · KnowledgeObject with status=PRODUCTION and authorised_by=null cannot be produced by the pipeline", async () => {
    const att = newTestAttestationKeyPair();
    const manifest = makeTestManifest(att);
    const http = await fixtureHttpOverride();
    const sandbox = await makeSandbox();
    try {
      const result = await runDiscoveryCore({
        manifest,
        trusted_attestation_keys: [att.public_der_hex],
        fetch_url: "https://export.arxiv.org/api/query?search_query=cat:cs.SE",
        sandbox_root: sandbox,
        stderr_test_cases: [
          { case_id: "adv1-1", stderr_snippet: "", expected_rule: "file-not-found", expected_message_pattern: null },
          { case_id: "adv1-2", stderr_snippet: "", expected_rule: "clean", expected_message_pattern: null },
        ],
        _http_override: http,
      });
      for (const k of result.knowledge_objects) {
        expect(k.status).not.toBe("PRODUCTION");
        expect(k.status).not.toBe("SUPER_INTELLIGENCE");
        expect(k.authorised_by).toBeNull();
      }
    } finally { await fs.rm(sandbox, { recursive: true, force: true }); }
  }, 120_000);

  // 2
  it("A-2 · Crawler fetch to URL not in authorised manifest is REFUSED", async () => {
    const att = newTestAttestationKeyPair();
    const manifest = makeTestManifest(att);
    const result = await crawlerFetch({
      manifest,
      trusted_attestation_keys: [att.public_der_hex],
      url: "https://evil.example.com/steal",
      method: "GET",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason_code).toBe("REFUSED_UNAUTHORISED_HOST");
  });

  // 3
  it("A-3 · Attempting to add a URL to the manifest at runtime is refused (manifest is signed; the attacker cannot re-sign)", async () => {
    const legitAtt = newTestAttestationKeyPair();
    const legitManifest = makeTestManifest(legitAtt);

    // Attacker constructs a tampered manifest (adds evil.example.com) and
    // tries to have it verified against the LEGIT trusted-key set. It fails.
    const tampered: CrawlerManifest = {
      ...legitManifest,
      entries: [
        ...legitManifest.entries,
        { ...legitManifest.entries[0], manifest_entry_id: "evil", authorised_hosts: ["evil.example.com"] },
      ],
    };
    expect(verifyCrawlerManifest(tampered, [legitAtt.public_der_hex])).toBe(false);

    // The attacker's own signature is only valid against the attacker's
    // key — verification against the LEGIT trusted-key set still fails.
    const attackerAtt = newTestAttestationKeyPair();
    const attackerManifest = signCrawlerManifest(attackerAtt.private_pkcs8_hex, tampered.entries);
    expect(verifyCrawlerManifest(attackerManifest, [legitAtt.public_der_hex])).toBe(false);
  });

  // 4 (delegated to WO-13 substrate integrity)
  it("A-4 · Intelligence subsystem attempting to modify substrate files is caught by WO-13", async () => {
    // The intelligence subsystem does not import any substrate write path.
    // Verify by grep that no substrate write helper is imported.
    const nexIntelDir = path.join(REPO_ROOT, "src/lib/nex-intelligence");
    const files = ["types.ts", "crawler-manifest.ts", "crawler.ts", "ingestion.ts", "discovery-engine.ts", "hypothesis-engine.ts", "experiment-engine.ts", "scoring.ts", "proposal.ts", "orchestrator.ts"];
    for (const f of files) {
      const src = await fs.readFile(path.join(nexIntelDir, f), "utf8");
      expect(src).not.toMatch(/from ["']@\/lib\/nex-authority-broker/);
      expect(src).not.toMatch(/wo4-executor|wo3-templates|wo5-allowed-executables|wo13-integrity(?!.*wo13-attestation)/);
    }
  });

  // 5
  it("A-5 · Experiment Engine cannot write outside its sandbox_root", async () => {
    // The Experiment Engine's writes are scoped to the caller-provided
    // sandbox_root. Verify by inspection that the module never writes to
    // paths outside the sandbox_root argument.
    const src = await fs.readFile(path.join(REPO_ROOT, "src/lib/nex-intelligence/experiment-engine.ts"), "utf8");
    // The only write is `path.join(caseDir, ...)` where caseDir is `path.join(input.sandbox_root, tc.case_id)`.
    // We assert the source contains no absolute-path writes and no ".." traversal.
    expect(src).not.toMatch(/fs\.writeFile\(["'`]\//);      // absolute path literal
    expect(src).not.toMatch(/\.\.\//);                       // parent traversal
  });

  // 6
  it("A-6 · Promotion produces neither PRODUCTION nor SUPER_INTELLIGENCE for below-threshold evidence (property-based)", () => {
    // Below-threshold: 1 source, no experiment, no correlations, no generalisation.
    for (let i = 0; i < 50; i++) {
      const score = scoreEvidence({
        source_count: 1 + (i % 2),
        experiment: null,
        correlation_count: 0,
        generalisation_passed: false,
        contradiction_count: 0,
        reproduced_by_nex: false,
        synthesised_from_count: 0,
      });
      const d = decidePromotion("DISCOVERED", score);
      expect(d.targetStatus).not.toBe("PRODUCTION");
      expect(d.targetStatus).not.toBe("SUPER_INTELLIGENCE");
    }
    // Even meeting Intelligence thresholds only produces APPROVED, not PRODUCTION.
    const meetsIntel = scoreEvidence({
      source_count: 20,
      experiment: { record_type: "NEX_INTELLIGENCE_EXPERIMENT", experiment_id: "x", hypothesis_id: "h", run_at: "", sandbox_id: "s", test_cases: [], outcomes: [], success_count: 10, failure_count: 0, limitation_count: 0, runtime_ms: 1, provenance_chain_hash: "" },
      correlation_count: 5, generalisation_passed: true, contradiction_count: 0, reproduced_by_nex: true, synthesised_from_count: 3,
    });
    const d = decidePromotion("APPROVED", meetsIntel);
    expect(["APPROVED", "SUPER_INTELLIGENCE_CANDIDATE"]).toContain(d.targetStatus);
    expect(d.targetStatus).not.toBe("PRODUCTION");
    expect(d.targetStatus).not.toBe("SUPER_INTELLIGENCE");
  });

  // 7
  it("A-7 · Intelligence has no capability to sign a WO (no signing helper exported / no private-key import)", async () => {
    const nexIntelDir = path.join(REPO_ROOT, "src/lib/nex-intelligence");
    const files = ["types.ts", "ingestion.ts", "discovery-engine.ts", "hypothesis-engine.ts", "experiment-engine.ts", "scoring.ts", "proposal.ts", "orchestrator.ts", "crawler.ts"];
    for (const f of files) {
      const src = await fs.readFile(path.join(nexIntelDir, f), "utf8");
      expect(src).not.toMatch(/signAuthorization/);   // WO-02 signing helper
      expect(src).not.toMatch(/signFounderKeyManifest/);
    }
    // Note: crawler-manifest.ts DOES import from wo13-attestation for VERIFICATION,
    // and exports signCrawlerManifest for founder / test use. Neither creates
    // execution authority — the manifest only unlocks fetches through the gate.
  });

  // 8
  it("A-8 · Scoring is a pure function — same evidence → same score, always", () => {
    const inputs = {
      source_count: 12,
      experiment: null,
      correlation_count: 3,
      generalisation_passed: true,
      contradiction_count: 1,
      reproduced_by_nex: false,
      synthesised_from_count: 2,
    };
    const runs = Array.from({ length: 100 }, () => scoreEvidence(inputs));
    for (const r of runs) expect(r).toEqual(runs[0]);
  });

  // 9
  it("A-9 · Crawler refuses non-GET methods at runtime", async () => {
    const att = newTestAttestationKeyPair();
    const manifest = makeTestManifest(att);
    const result = await crawlerFetch({
      manifest,
      trusted_attestation_keys: [att.public_der_hex],
      url: "https://export.arxiv.org/api/query",
      method: "POST" as never,   // <-- adversarial: type-forced
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason_code).toBe("REFUSED_UNAUTHORISED_METHOD");
  });

  // 10
  it("A-10 · Crawler enforces rate limit per manifest entry", async () => {
    const att = newTestAttestationKeyPair();
    const manifest: CrawlerManifest = signCrawlerManifest(att.private_pkcs8_hex, [{
      manifest_entry_id: "rate-limited-test",
      authorised_hosts: ["export.arxiv.org"],
      authorised_paths: ["/api/query"],
      authorised_methods: ["GET"],
      rate_limit_requests_per_minute: 2,   // very tight
      authorised_categories: ["cs.SE"],
      authorised_query_predicates: [],
      authorising_wo_id: "wo-intelligence-01",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    }]);
    const http = await fixtureHttpOverride();
    // First two fetches OK, third refused
    const r1 = await crawlerFetch({ manifest, trusted_attestation_keys: [att.public_der_hex], url: "https://export.arxiv.org/api/query?a=1", method: "GET", _http_override: http });
    const r2 = await crawlerFetch({ manifest, trusted_attestation_keys: [att.public_der_hex], url: "https://export.arxiv.org/api/query?a=2", method: "GET", _http_override: http });
    const r3 = await crawlerFetch({ manifest, trusted_attestation_keys: [att.public_der_hex], url: "https://export.arxiv.org/api/query?a=3", method: "GET", _http_override: http });
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(r3.ok).toBe(false);
    if (r3.ok) return;
    expect(r3.reason_code).toBe("REFUSED_RATE_LIMIT");
  });

  // 11
  it("A-11 · Ingestion tampering (byte flip) breaks the provenance chain hash", async () => {
    const body = await fs.readFile(FIXTURE_PATH, "utf8");
    const fragments = parseArxivAtom(body, "test-source-id");
    const first = fragments[0];
    // Tamper: change the title without recomputing content_hash.
    const tampered = { ...first, title: first.title + " TAMPERED" };
    // The recorded provenance_chain_hash was computed BEFORE the tamper.
    // Recomputing it now yields a different hash, so the record's stored
    // provenance is invalid — any downstream verifier that recomputes will
    // detect this.
    const { provenanceChainHash } = await import("../provenance");
    const strippedOrig = { ...first };
    delete (strippedOrig as { provenance_chain_hash?: string }).provenance_chain_hash;
    const strippedTampered = { ...tampered };
    delete (strippedTampered as { provenance_chain_hash?: string }).provenance_chain_hash;
    const hOrig = provenanceChainHash(strippedOrig as Record<string, unknown>, []);
    const hTamp = provenanceChainHash(strippedTampered as Record<string, unknown>, []);
    expect(hOrig).not.toBe(hTamp);
    expect(hOrig).toBe(first.provenance_chain_hash);
  });

  // 12
  it("A-12 · DEPRECATED objects cannot be silently elevated by scoring — decidePromotion always respects thresholds", () => {
    // No matter what score, an already-DEPRECATED object is never returned
    // as PRODUCTION or SUPER_INTELLIGENCE by decidePromotion.
    const meetsSuper = scoreEvidence({
      source_count: 20,
      experiment: { record_type: "NEX_INTELLIGENCE_EXPERIMENT", experiment_id: "x", hypothesis_id: "h", run_at: "", sandbox_id: "s", test_cases: [], outcomes: [], success_count: 20, failure_count: 0, limitation_count: 0, runtime_ms: 1, provenance_chain_hash: "" },
      correlation_count: 5, generalisation_passed: true, contradiction_count: 0, reproduced_by_nex: true, synthesised_from_count: 3,
    });
    // decidePromotion tops out at CANDIDATE, never PRODUCTION or SUPER_INTELLIGENCE
    const d = decidePromotion("DEPRECATED", meetsSuper);
    expect(d.targetStatus).not.toBe("PRODUCTION");
    expect(d.targetStatus).not.toBe("SUPER_INTELLIGENCE");
    // enforcePromotionCeiling refuses any external attempt to set PRODUCTION or SUPER_INTELLIGENCE
    expect(enforcePromotionCeiling("PRODUCTION", meetsSuper)).not.toBe("PRODUCTION");
    expect(enforcePromotionCeiling("SUPER_INTELLIGENCE", meetsSuper)).not.toBe("SUPER_INTELLIGENCE");
  });

  // 13
  it("A-13 · Combination discovery restricted to fragments in the same authorised domain", async () => {
    // The manifest authorises cs.SE + cs.PL only. A fragment in a different
    // category should not enter the discovery pool (this is enforced by the
    // crawler's category check, upstream of discovery).
    const att = newTestAttestationKeyPair();
    // Manifest allows ONLY cs.SE
    const restrictedManifest: CrawlerManifest = signCrawlerManifest(att.private_pkcs8_hex, [{
      manifest_entry_id: "cs-se-only",
      authorised_hosts: ["export.arxiv.org"],
      authorised_paths: ["/api/query"],
      authorised_methods: ["GET"],
      rate_limit_requests_per_minute: 20,
      authorised_categories: ["cs.SE"],           // strict
      authorised_query_predicates: [],
      authorising_wo_id: "wo-intelligence-01",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    }]);
    // Attempt fetch declaring an unauthorised category
    const http = await fixtureHttpOverride();
    const result = await crawlerFetch({
      manifest: restrictedManifest,
      trusted_attestation_keys: [att.public_der_hex],
      url: "https://export.arxiv.org/api/query",
      method: "GET",
      match_categories: ["cs.CR"],   // NOT in allowlist
      _http_override: http,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason_code).toBe("REFUSED_CATEGORY_MISMATCH");
  });

  // 14
  it("A-14 · Non-arxiv host redirect at request time is refused (host mismatch)", async () => {
    const att = newTestAttestationKeyPair();
    const manifest = makeTestManifest(att);
    const result = await crawlerFetch({
      manifest,
      trusted_attestation_keys: [att.public_der_hex],
      url: "https://export.arxiv.org.attacker.example/api/query?a=1",   // hostname is not export.arxiv.org
      method: "GET",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason_code).toBe("REFUSED_UNAUTHORISED_HOST");
  });

  // 15
  it("A-15 · Provenance chain hash covers everything material — one byte tamper is detected", () => {
    const attKp = newTestAttestationKeyPair();
    const entry: CrawlerManifestEntry = {
      manifest_entry_id: "m1",
      authorised_hosts: ["export.arxiv.org"],
      authorised_paths: ["/api/query"],
      authorised_methods: ["GET"],
      rate_limit_requests_per_minute: 5,
      authorised_categories: ["cs.SE"],
      authorised_query_predicates: [],
      authorising_wo_id: "wo-intelligence-01",
      expires_at: "2027-01-01T00:00:00.000Z",
    };
    const m = signCrawlerManifest(attKp.private_pkcs8_hex, [entry]);
    // Tamper one byte in the entry (change rate limit)
    const tampered: CrawlerManifest = { ...m, entries: [{ ...m.entries[0], rate_limit_requests_per_minute: 999 }] };
    expect(verifyCrawlerManifest(tampered, [attKp.public_der_hex])).toBe(false);
  });

  // 16
  it("A-16 · Zero external-LLM SDK imports anywhere in nex-intelligence", async () => {
    const nexIntelDir = path.join(REPO_ROOT, "src/lib/nex-intelligence");
    const walk = async (dir: string): Promise<string[]> => {
      const out: string[] = [];
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) out.push(...await walk(p));
        else if (e.isFile() && /\.(ts|tsx|mjs|mts|js)$/.test(e.name)) out.push(p);
      }
      return out;
    };
    const files = await walk(nexIntelDir);
    const forbidden = /from\s+["'](openai|@anthropic-ai\/sdk|@anthropic\/sdk|@google\/generative-ai|@google-ai|cohere|@cohere-ai|mistral|@mistralai|@aws-sdk\/client-bedrock)/;
    for (const f of files) {
      const src = await fs.readFile(f, "utf8");
      expect(src).not.toMatch(forbidden);
    }
  });
});
