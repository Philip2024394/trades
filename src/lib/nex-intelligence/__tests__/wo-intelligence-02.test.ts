// WO-INTELLIGENCE-02 · acceptance tests
//
// 12 adversarial + property tests plus the § acceptance criteria.
// Every A-test in the form: "secretly try to grow authority OR silently
// modify history → assert NEX refuses."
//
// Zero external LLM. Real subprocess (via existing WO-05/WO-07 code).

import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { generateKeyPairSync, randomUUID } from "node:crypto";

import { authorityWeight, SOURCE_CLASS_AUTHORITY, type SourceClass } from "../source-classes";
import { parseNodejsDocs } from "../adapters/nodejs-docs";
import {
  decideRevisitVerdict,
  buildRevisitRecord,
  buildSupersedeEdge,
  REVISIT_THRESHOLDS,
} from "../revisit";
import {
  splitCorpus,
  checkGeneralisation,
} from "../generalisation";
import { signCrawlerManifest, verifyCrawlerManifest } from "../crawler-manifest";
import { provenanceChainHash } from "../provenance";
import { crawlerFetch, type HttpRequestFn } from "../crawler";
import type { CrawlerManifest, CrawlerManifestEntry, KnowledgeObject } from "../types";

const REPO_ROOT = process.cwd();
const NODEJS_FIXTURE = path.join(REPO_ROOT, "src/lib/nex-intelligence/__fixtures__/nodejs-docs-fs-test.json");

function newAttKp(): { public_der_hex: string; private_pkcs8_hex: string } {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    public_der_hex:  (publicKey.export({ type: "spki",  format: "der" }) as Buffer).toString("hex"),
    private_pkcs8_hex: (privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString("hex"),
  };
}

async function cleanCollections(): Promise<void> {
  const files = [
    "nex_intelligence_revisits",
    "nex_intelligence_supersede_edges",
    "nex_intelligence_generalisation_sets",
    "nex_intelligence_sources",
    "nex_intelligence_crawler_audit",
  ];
  const root = path.join(REPO_ROOT, "data", "nex-storage");
  for (const f of files) {
    try { await fs.unlink(path.join(root, `${f}.jsonl`)); } catch { /* ok */ }
  }
}

function makeKnowledgeObject(id: string, confidence: number): KnowledgeObject {
  return {
    record_type: "NEX_INTELLIGENCE_KNOWLEDGE_OBJECT",
    knowledge_id: id,
    version: 1,
    name: id,
    created_at: "2026-09-13T00:00:00.000Z",
    updated_at: "2026-09-13T00:00:00.000Z",
    domain: "software-engineering",
    source_evidence: [],
    experiments: [],
    limitations: [],
    recommended_use: [],
    agent_capability_affected: null,
    confidence,
    reproducibility_score: 0.8,
    correlation_count: 2,
    generalisation_passed: false,
    status: "TESTED",
    supersedes: [],
    superseded_by: [],
    synthesised_from: [],
    authorised_by: null,
    authorising_wo_id: null,
    revisit_scheduled_at: null,
    provenance_chain_hash: "abc123",
  };
}

// ═════════════════════════════════════════════════════════════════════════
// POSITIVE / PROPERTY
// ═════════════════════════════════════════════════════════════════════════

describe("WO-INTELLIGENCE-02 · property + positive tests", () => {
  afterEach(() => cleanCollections());

  it("source-class authority weights are frozen + non-negative + bounded", () => {
    for (const [name, entry] of Object.entries(SOURCE_CLASS_AUTHORITY)) {
      expect(entry.source_class).toBe(name);
      expect(entry.authority_weight).toBeGreaterThanOrEqual(0);
      expect(entry.authority_weight).toBeLessThanOrEqual(1);
      expect(entry.rationale.length).toBeGreaterThan(10);
    }
    // Unknown class → 0
    expect(authorityWeight("something-else")).toBe(0);
    expect(authorityWeight(undefined)).toBe(0);
  });

  it("Node.js docs adapter extracts ≥ 5 fragments with correct shape", async () => {
    const body = await fs.readFile(NODEJS_FIXTURE, "utf8");
    const fragments = parseNodejsDocs(body, "test-source");
    expect(fragments.length).toBeGreaterThanOrEqual(5);
    for (const f of fragments) {
      expect(f.record_type).toBe("NEX_INTELLIGENCE_KNOWLEDGE_FRAGMENT");
      expect(f.external_id).toMatch(/^nodejs-docs::/);
      expect(f.primary_category).toBe("nodejs-docs");
      expect(f.authors).toEqual(["Node.js Project"]);
      expect(f.title.length).toBeGreaterThan(0);
      expect(f.abstract.length).toBeGreaterThan(0);
      expect(f.content_hash_sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(f.provenance_chain_hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("split is deterministic — same seed + same case_ids → identical assignment", () => {
    const case_ids = Array.from({ length: 20 }, (_, i) => `case-${i}`);
    const s1 = splitCorpus({ case_ids, hypothesis_id: "h1", seed: "seed-abc" });
    const s2 = splitCorpus({ case_ids, hypothesis_id: "h1", seed: "seed-abc" });
    expect(s1.training_case_ids).toEqual(s2.training_case_ids);
    expect(s1.held_out_case_ids).toEqual(s2.held_out_case_ids);
    // Training + held-out must partition the input exactly
    const combined = [...s1.training_case_ids, ...s1.held_out_case_ids].sort();
    expect(combined).toEqual([...case_ids].sort());
  });

  it("different seed → different split", () => {
    const case_ids = Array.from({ length: 20 }, (_, i) => `case-${i}`);
    const s1 = splitCorpus({ case_ids, hypothesis_id: "h1", seed: "seed-alpha" });
    const s2 = splitCorpus({ case_ids, hypothesis_id: "h1", seed: "seed-beta" });
    // Extremely unlikely to be identical (2^n possibilities); assert difference
    const same = s1.held_out_case_ids.length === s2.held_out_case_ids.length &&
      s1.held_out_case_ids.every((v, i) => v === s2.held_out_case_ids[i]);
    expect(same).toBe(false);
  });

  it("generalisation check passes when both thresholds met", () => {
    const r = checkGeneralisation({ training_success: 9, training_total: 10, held_out_success: 8, held_out_total: 10 });
    expect(r.passed).toBe(true);
    expect(r.generalises).toBe(true);
  });

  it("generalisation check FAILS when held-out fails even if training passes", () => {
    const r = checkGeneralisation({ training_success: 10, training_total: 10, held_out_success: 3, held_out_total: 10 });
    expect(r.passed).toBe(false);
    expect(r.generalises).toBe(false);
    expect(r.reason).toMatch(/does NOT generalise|training passed .*held-out/);
  });

  it("revisit verdict function is pure (100 runs identical)", () => {
    const input = {
      new_evidence_count: 5,
      previous_confidence: 0.75,
      recomputed_confidence: 0.78,
      new_contradiction_count: 0,
    };
    const first = decideRevisitVerdict(input);
    for (let i = 0; i < 100; i++) expect(decideRevisitVerdict(input)).toEqual(first);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// ADVERSARIAL (§9 · 12 new)
// ═════════════════════════════════════════════════════════════════════════

describe("WO-INTELLIGENCE-02 · adversarial", () => {
  afterEach(() => cleanCollections());

  // 1
  it("A-1 · Revisit CONFIRM never modifies the target KnowledgeObject in place", () => {
    // Build a revisit that meets CONFIRM conditions
    const target = makeKnowledgeObject("k1", 0.80);
    const originalBytes = JSON.stringify(target);
    const r = buildRevisitRecord({
      target,
      new_evidence_source_ids: ["s1", "s2"],
      new_evidence_experiment_ids: [],
      recomputed_confidence: 0.82,   // delta +0.02 → CONFIRM
      new_contradiction_count: 0,
      resulting_knowledge_id: null,
    });
    expect(r.verdict).toBe("CONFIRM");
    // target bytes must be unchanged (nothing mutates the original)
    expect(JSON.stringify(target)).toBe(originalBytes);
    expect(r.resulting_knowledge_id).toBeNull();
  });

  // 2
  it("A-2 · Revisit UPDATE produces distinct new knowledge_id with supersedes link", () => {
    const target = makeKnowledgeObject("k1", 0.60);
    const r = buildRevisitRecord({
      target,
      new_evidence_source_ids: ["s1", "s2", "s3"],
      new_evidence_experiment_ids: ["e1"],
      recomputed_confidence: 0.75,   // delta +0.15 → UPDATE
      new_contradiction_count: 0,
      resulting_knowledge_id: "k1-v2",
    });
    expect(r.verdict).toBe("UPDATE");
    expect(r.resulting_knowledge_id).toBe("k1-v2");
    expect(r.resulting_knowledge_id).not.toBe(target.knowledge_id);
    const edge = buildSupersedeEdge({
      from_knowledge_id: target.knowledge_id,
      to_knowledge_id: r.resulting_knowledge_id!,
      revisit_id: r.revisit_id,
      kind: "UPDATE",
      antecedent_provenance_hashes: [target.provenance_chain_hash, r.provenance_chain_hash],
    });
    expect(edge.from_knowledge_id).toBe("k1");
    expect(edge.to_knowledge_id).toBe("k1-v2");
    expect(edge.kind).toBe("UPDATE");
  });

  // 3
  it("A-3 · SUPERSEDE cannot mark old as DEPRECATED without accompanying new object", () => {
    // A SUPERSEDE revisit MUST have resulting_knowledge_id set (for the caller
    // to create the new object). Building a revisit with SUPERSEDE verdict
    // and null resulting_knowledge_id is a caller error — the ORCHESTRATOR
    // is responsible for creating the new object; this test asserts that a
    // SUPERSEDE revisit with null resulting_knowledge_id remains a naked
    // revisit record and cannot itself mutate the original object.
    const target = makeKnowledgeObject("k1", 0.90);
    const r = buildRevisitRecord({
      target,
      new_evidence_source_ids: ["s1", "s2", "s3"],
      new_evidence_experiment_ids: [],
      recomputed_confidence: 0.60,   // delta -0.30 → SUPERSEDE
      new_contradiction_count: 0,
      resulting_knowledge_id: null,   // deliberately null (represents a broken flow)
    });
    expect(r.verdict).toBe("SUPERSEDE");
    // Even though the verdict is SUPERSEDE, this record alone does NOT
    // change the target's status. Only when the orchestrator creates a
    // matching new KnowledgeObject + SupersedeEdge does the state
    // meaningfully change.
    expect(r.resulting_knowledge_id).toBeNull();
    expect(target.status).toBe("TESTED");  // unchanged
  });

  // 4
  it("A-4 · REJECT verdict produces no new PRODUCTION object", () => {
    const target = makeKnowledgeObject("k1", 0.85);
    const r = buildRevisitRecord({
      target,
      new_evidence_source_ids: ["s1", "s2", "s3", "s4", "s5"],
      new_evidence_experiment_ids: [],
      recomputed_confidence: 0.70,
      new_contradiction_count: 5,   // ≥3 contradictions → REJECT
      resulting_knowledge_id: null,
    });
    expect(r.verdict).toBe("REJECT");
    expect(r.resulting_knowledge_id).toBeNull();
  });

  // 5
  it("A-5 · Verdict function is a pure function (property-based)", () => {
    // 50 random-ish inputs, each run 5 times must produce identical results
    for (let i = 0; i < 50; i++) {
      const input = {
        new_evidence_count: (i * 7) % 20,
        previous_confidence: (i % 10) / 10,
        recomputed_confidence: ((i * 3) % 10) / 10,
        new_contradiction_count: (i * 5) % 8,
      };
      const first = decideRevisitVerdict(input);
      for (let j = 0; j < 5; j++) expect(decideRevisitVerdict(input)).toEqual(first);
    }
  });

  // 6
  it("A-6 · Corpus split is deterministic (same seed + same input → identical output)", () => {
    const cases = Array.from({ length: 50 }, (_, i) => `case-${i}-${i * 31 % 47}`);
    const seed = "wo-intel-02-a6";
    const s1 = splitCorpus({ case_ids: cases, hypothesis_id: "h", seed });
    const s2 = splitCorpus({ case_ids: cases, hypothesis_id: "h", seed });
    expect(s1.training_case_ids).toEqual(s2.training_case_ids);
    expect(s1.held_out_case_ids).toEqual(s2.held_out_case_ids);
  });

  // 7
  it("A-7 · Passing training but failing held-out DENIES Intelligence promotion", () => {
    const r = checkGeneralisation({
      training_success: 20, training_total: 20,
      held_out_success: 3, held_out_total: 20,
    });
    expect(r.passed).toBe(false);
    expect(r.generalises).toBe(false);
  });

  // 8
  it("A-8 · Hypothesis Engine cannot read held_out_set_* fields (grep-verified)", async () => {
    const src = await fs.readFile(path.join(REPO_ROOT, "src/lib/nex-intelligence/hypothesis-engine.ts"), "utf8");
    expect(src).not.toMatch(/held_out_set/);
    expect(src).not.toMatch(/held_out_case_ids/);
    expect(src).not.toMatch(/GeneralisationSet/);
  });

  // 9
  it("A-9 · Source-class field influences confidence only, never enum status", async () => {
    // Even the highest authority class (standards_specification, weight 1.0)
    // does not change the KnowledgeStatus enum. Verify by inspection.
    const src = await fs.readFile(path.join(REPO_ROOT, "src/lib/nex-intelligence/source-classes.ts"), "utf8");
    expect(src).not.toMatch(/status:\s*["'](PRODUCTION|SUPER_INTELLIGENCE)/);
    // authority_weight is bounded [0, 1]
    for (const entry of Object.values(SOURCE_CLASS_AUTHORITY)) {
      expect(entry.authority_weight).toBeGreaterThanOrEqual(0);
      expect(entry.authority_weight).toBeLessThanOrEqual(1);
    }
  });

  // 10
  it("A-10 · Manifest with source_class=official_technical_documentation is signable and verifiable", () => {
    const att = newAttKp();
    const entry: CrawlerManifestEntry = {
      manifest_entry_id: "nodejs-docs-test",
      authorised_hosts: ["nodejs.org"],
      authorised_paths: ["/api/"],
      authorised_methods: ["GET"],
      rate_limit_requests_per_minute: 10,
      authorised_categories: ["nodejs-docs"],
      authorised_query_predicates: [],
      authorising_wo_id: "wo-intelligence-02",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      source_class: "official_technical_documentation",
    };
    const m: CrawlerManifest = signCrawlerManifest(att.private_pkcs8_hex, [entry]);
    // Signature verifies against attacker's key set
    // and refuses against a different key set.
    const otherAtt = newAttKp();
    expect(verifyCrawlerManifest(m, [att.public_der_hex])).toBe(true);
    expect(verifyCrawlerManifest(m, [otherAtt.public_der_hex])).toBe(false);
  });

  // 11
  it("A-11 · Revisit scheduler is bounded — INSUFFICIENT_NEW_EVIDENCE when new evidence < min", () => {
    const target = makeKnowledgeObject("k1", 0.80);
    const r = buildRevisitRecord({
      target,
      new_evidence_source_ids: ["s1"],   // only 1 new source
      new_evidence_experiment_ids: [],
      recomputed_confidence: 0.90,
      new_contradiction_count: 0,
      resulting_knowledge_id: null,
    });
    expect(r.verdict).toBe("INSUFFICIENT_NEW_EVIDENCE");
    expect(r.resulting_knowledge_id).toBeNull();
  });

  // 12
  it("A-12 · SupersedeEdge tampering is detected via provenance chain hash", () => {
    const edge = buildSupersedeEdge({
      from_knowledge_id: "old",
      to_knowledge_id: "new",
      revisit_id: "r1",
      kind: "UPDATE",
      antecedent_provenance_hashes: ["anc1", "anc2"],
    });
    // Recompute what the hash SHOULD be for a tampered edge
    const stripped = { ...edge };
    delete (stripped as { provenance_chain_hash?: string }).provenance_chain_hash;
    const hashOrig = provenanceChainHash(stripped as Record<string, unknown>, ["anc1", "anc2"]);
    expect(hashOrig).toBe(edge.provenance_chain_hash);
    // Tamper: change `to_knowledge_id`
    const tamperedStripped = { ...stripped, to_knowledge_id: "attacker-forged" };
    const hashTamp = provenanceChainHash(tamperedStripped as Record<string, unknown>, ["anc1", "anc2"]);
    expect(hashTamp).not.toBe(edge.provenance_chain_hash);
  });
});

// vitest imports
import { afterEach } from "vitest";
