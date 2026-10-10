// src/lib/nex/discovery-intel/__tests__/discovery-intel.test.ts
//
// NEX Fresh World Discovery + Search Intelligence · acceptance
// Founder-authorised programme · bounded wave 2026-09-21.

import { describe, it, expect, beforeEach } from "vitest";
import type { PoolClient, QueryResult } from "pg";
import {
  runDiscoveryCycle, loadRecentCycles, loadDiscoveryStatus,
  loadVocabulary, loadVocabularyTree, recordCandidateFromCycle,
  promoteCandidateToValidated, seedVocabularyFromTaxonomy,
  recordRelationshipEvidence, loadRelationships,
  DiscoveryGovernanceError,
  _DISCOVERY_INTEL_BOUNDARY_NO_ADDRESSES, _DISCOVERY_INTEL_BOUNDARY_NO_SEND,
  type CycleAdapter, type ProbeOutcome,
} from "..";

// ─── SQL-faithful in-memory mock for the 4 discovery tables ─────────
type Store = {
  cycles: any[];
  terms: Map<string, any>;                              // key: `${term}|${topic}|${language}`
  relationships: Map<string, any>;                       // key: `${parent}|${child}|${kind}|${topic}`
  source_health: Map<string, any>;
  // Canaries · flip true if any query touches these
  marketing_send_queue_touched: boolean;
  marketing_operating_budget_touched: boolean;
  marketing_package_touched: boolean;
  marketing_contact_touched: boolean;
  send_log_touched: boolean;
};

function makeMock() {
  const store: Store = {
    cycles: [], terms: new Map(), relationships: new Map(), source_health: new Map(),
    marketing_send_queue_touched: false, marketing_operating_budget_touched: false,
    marketing_package_touched: false, marketing_contact_touched: false, send_log_touched: false,
  };
  let seq = 1;
  const client: PoolClient = {
    async query(sql: string, params: any[] = []): Promise<QueryResult<any>> {
      const norm = sql.trim().replace(/\s+/g, " ");
      if (/marketing_send_queue/i.test(norm))       store.marketing_send_queue_touched = true;
      if (/marketing_operating_budget/i.test(norm)) store.marketing_operating_budget_touched = true;
      if (/marketing_package(?!_)/i.test(norm))     store.marketing_package_touched = true;
      if (/marketing_contact/i.test(norm))           store.marketing_contact_touched = true;
      if (/marketing_send_log/i.test(norm))          store.send_log_touched = true;

      // ─── discovery_cycle · MAX(cycle_seq) ────────────────────
      if (/COALESCE\(MAX\(cycle_seq\), 0\) \+ 1/i.test(norm)) {
        const topic = params[0];
        const max = store.cycles.filter(c => c.topic === topic).reduce((m, c) => Math.max(m, c.cycle_seq), 0);
        return r([{ n: max + 1 }]);
      }
      // Open a cycle row
      if (/^INSERT INTO nex\.discovery_cycle \(cycle_seq, topic, started_at, outcome\)/i.test(norm)) {
        const cycle = {
          cycle_id: `cyc-${seq++}`, cycle_seq: params[0], topic: params[1],
          started_at: new Date().toISOString(), finished_at: null, duration_ms: null,
          searches_attempted: 0, terms_used: [], countries_touched: [], sources_attempted: [],
          businesses_discovered: 0, new_emails: 0, existing_matched: 0, rejected_emails: 0,
          newly_classified: 0, newly_eligible: 0, categories_touched: [],
          source_outcomes: [], outcome: "in_progress", note: null,
          sends_triggered: 0, addresses_exposed: 0,
        };
        store.cycles.push(cycle);
        return r([{ cycle_id: cycle.cycle_id }]);
      }
      // Close cycle · big UPDATE with 16 params
      if (/^UPDATE nex\.discovery_cycle SET finished_at = now\(\)/i.test(norm)) {
        const [duration_ms, searches, terms_used, countries, sources, biz, newE, existE, rej, newlyC, newlyEl, catsT, srcOutcomes, outcome, note, cycle_id] = params;
        const c = store.cycles.find(x => x.cycle_id === cycle_id);
        if (c) {
          c.duration_ms = duration_ms; c.searches_attempted = searches; c.terms_used = terms_used;
          c.countries_touched = countries; c.sources_attempted = sources; c.businesses_discovered = biz;
          c.new_emails = newE; c.existing_matched = existE; c.rejected_emails = rej;
          c.newly_classified = newlyC; c.newly_eligible = newlyEl; c.categories_touched = catsT;
          c.source_outcomes = JSON.parse(srcOutcomes); c.outcome = outcome; c.note = note;
          c.finished_at = new Date().toISOString();
        }
        return r([]);
      }
      // Recent cycles
      if (/^SELECT cycle_id, cycle_seq, topic,/i.test(norm) && /FROM nex\.discovery_cycle/i.test(norm)) {
        const topic = params[0]; const limit = params[1];
        return r([...store.cycles].filter(c => c.topic === topic).sort((a, b) => b.cycle_seq - a.cycle_seq).slice(0, limit));
      }
      // Status · in_progress cycle
      if (/^SELECT cycle_id FROM nex\.discovery_cycle WHERE topic = \$1 AND outcome = 'in_progress'/i.test(norm)) {
        const topic = params[0];
        const c = [...store.cycles].filter(x => x.topic === topic && x.outcome === "in_progress").sort((a, b) => b.cycle_seq - a.cycle_seq)[0];
        return r(c ? [{ cycle_id: c.cycle_id }] : []);
      }

      // ─── vocabulary ───────────────────────────────────────────
      if (/^SELECT term_id FROM nex\.discovery_search_term WHERE term = \$1 AND topic = \$2 AND language = \$3/i.test(norm)) {
        const k = `${params[0]}|${params[1]}|${params[2]}`;
        const row = store.terms.get(k);
        return r(row ? [row] : []);
      }
      if (/^INSERT INTO nex\.discovery_search_term \(term, topic, family, language, status, source, primary_relationship\)/i.test(norm)) {
        const [term, topic, family, language, status, source, primary_relationship] = params;
        const term_id = `t-${seq++}`;
        const k = `${term}|${topic}|${language}`;
        store.terms.set(k, { term_id, term, topic, family, language, status, source, primary_relationship, evidence_count: 0, last_evidence_at: null, country_applicability: ["all"], discovery_date: new Date().toISOString(), first_promoted_at: null, first_promoted_by: null, metadata: {} });
        return r([]);
      }
      if (/^INSERT INTO nex\.discovery_search_term \(term, topic, family, language, status, source, primary_relationship, evidence_count, last_evidence_at\)/i.test(norm)) {
        const [term, topic, family, language, source, primary_relationship, evidence_count] = params;
        const term_id = `t-${seq++}`;
        const k = `${term}|${topic}|${language}`;
        store.terms.set(k, { term_id, term, topic, family, language, status: "candidate", source, primary_relationship, evidence_count, last_evidence_at: new Date().toISOString(), country_applicability: ["all"], discovery_date: new Date().toISOString(), first_promoted_at: null, first_promoted_by: null, metadata: {} });
        return r([{ term_id }]);
      }
      if (/^SELECT term_id, status FROM nex\.discovery_search_term/i.test(norm)) {
        const k = `${params[0]}|${params[1]}|${params[2]}`;
        const row = store.terms.get(k);
        return r(row ? [{ term_id: row.term_id, status: row.status }] : []);
      }
      if (/^UPDATE nex\.discovery_search_term SET evidence_count = evidence_count \+ \$1, last_evidence_at = now\(\) WHERE term_id = \$2/i.test(norm)) {
        for (const t of store.terms.values()) if (t.term_id === params[1]) { t.evidence_count += params[0]; t.last_evidence_at = new Date().toISOString(); }
        return r([]);
      }
      if (/^SELECT \* FROM nex\.discovery_search_term WHERE term_id = \$1/i.test(norm)) {
        for (const t of store.terms.values()) if (t.term_id === params[0]) return r([t]);
        return r([]);
      }
      if (/^UPDATE nex\.discovery_search_term SET status = 'validated'/i.test(norm)) {
        for (const t of store.terms.values()) if (t.term_id === params[1]) {
          t.status = "validated";
          t.first_promoted_at = t.first_promoted_at ?? new Date().toISOString();
          t.first_promoted_by = params[0];
          return r([{ ...t, discovery_date: t.discovery_date, last_evidence_at: t.last_evidence_at, first_promoted_at: t.first_promoted_at }]);
        }
        return r([]);
      }
      if (/^SELECT term_id, term, topic, family, language, country_applicability, status, source,/i.test(norm) && /FROM nex\.discovery_search_term WHERE topic = \$1/i.test(norm)) {
        const topic = params[0];
        const rows = [...store.terms.values()].filter(t => t.topic === topic).sort((a, b) => (a.status + a.family + a.term).localeCompare(b.status + b.family + b.term));
        return r(rows);
      }

      // ─── relationships ────────────────────────────────────────
      if (/^SELECT relationship_id, evidence_count FROM nex\.discovery_relationship WHERE parent_term = \$1 AND child_term = \$2/i.test(norm)) {
        const k = `${params[0]}|${params[1]}|${params[2]}|${params[3]}`;
        const row = store.relationships.get(k);
        return r(row ? [row] : []);
      }
      if (/^INSERT INTO nex\.discovery_relationship/i.test(norm)) {
        const [parent, child, kind, topic, evidence_count, confidence, cycle_id] = params;
        const relationship_id = `rel-${seq++}`;
        const k = `${parent}|${child}|${kind}|${topic}`;
        const row = { relationship_id, parent_term: parent, child_term: child, relationship_kind: kind, topic, evidence_count, confidence, first_observed_cycle: cycle_id, last_observed_cycle: cycle_id, first_observed_at: new Date().toISOString(), last_observed_at: new Date().toISOString(), status: "candidate", metadata: {} };
        store.relationships.set(k, row);
        return r([{ relationship_id, evidence_count, confidence }]);
      }
      if (/^UPDATE nex\.discovery_relationship SET evidence_count = \$1, confidence = \$2, last_observed_cycle = \$3/i.test(norm)) {
        for (const r0 of store.relationships.values()) if (r0.relationship_id === params[3]) {
          r0.evidence_count = params[0]; r0.confidence = params[1]; r0.last_observed_cycle = params[2]; r0.last_observed_at = new Date().toISOString();
          return r([{ relationship_id: r0.relationship_id, evidence_count: r0.evidence_count, confidence: r0.confidence }]);
        }
        return r([]);
      }
      if (/^SELECT relationship_id, parent_term, child_term, relationship_kind, topic,/i.test(norm) && /FROM nex\.discovery_relationship WHERE/i.test(norm)) {
        const topic = params[0];
        let rows = [...store.relationships.values()].filter(x => x.topic === topic);
        if (params.length >= 2) rows = rows.filter(x => x.parent_term === params[1]);
        return r(rows.sort((a, b) => b.evidence_count - a.evidence_count));
      }

      // ─── source health ────────────────────────────────────────
      if (/^INSERT INTO nex\.discovery_source_health/i.test(norm)) {
        const source = params[0];
        const s = store.source_health.get(source) ?? { source, requests_attempted: 0, requests_succeeded: 0, consecutive_failures: 0, bytes_in_total: 0 };
        s.requests_attempted += 1;
        if (params[1]) { s.requests_succeeded += 1; s.consecutive_failures = 0; s.last_success_at = new Date().toISOString(); }
        else { s.consecutive_failures += 1; s.last_failure_at = new Date().toISOString(); s.last_failure_reason = params[3]; }
        if (params[2]) s.bytes_in_total += params[2];
        store.source_health.set(source, s);
        return r([]);
      }

      throw new Error(`discovery-intel mock: unhandled SQL: ${norm.slice(0, 160)}`);
    },
    release() {},
  } as unknown as PoolClient;
  return { client, store };
}
function r(rows: any[]): QueryResult<any> { return { rows, rowCount: rows.length, command: "", oid: 0, fields: [] }; }

// ─── Test adapters ────────────────────────────────────────────────
function makeAdapter(source_id: string, outcomes: ProbeOutcome[]): CycleAdapter {
  let i = 0;
  return {
    source_id,
    async probe() {
      const next = outcomes[Math.min(i, outcomes.length - 1)];
      i += 1;
      return { ...next, source: source_id };
    },
  };
}

const okOutcome = (elements = 5, related: any[] = []): ProbeOutcome => ({
  source: "test", outcome: "responded", ms: 100, bytes: 2048, note: null,
  elements_seen: elements, new_email_count: 2, existing_email_matched: 1,
  rejected_email_count: 1, newly_classified: 2, newly_eligible: 2,
  categories_touched: ["construction"], related_terms: related,
});
const zeroOutcome = (): ProbeOutcome => ({
  source: "test", outcome: "responded_zero", ms: 40, bytes: 24, note: null,
  elements_seen: 0, new_email_count: 0, existing_email_matched: 0, rejected_email_count: 0,
  newly_classified: 0, newly_eligible: 0, categories_touched: [], related_terms: [],
});
const unavailableOutcome = (): ProbeOutcome => ({
  source: "test", outcome: "unavailable", ms: 20000, bytes: null, note: "timeout",
  elements_seen: 0, new_email_count: 0, existing_email_matched: 0, rejected_email_count: 0,
  newly_classified: 0, newly_eligible: 0, categories_touched: [], related_terms: [],
});

let mock: ReturnType<typeof makeMock>;
beforeEach(async () => {
  mock = makeMock();
  // Seed vocabulary
  await mock.client.query(
    `INSERT INTO nex.discovery_search_term (term, topic, family, language, status, source, primary_relationship) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    ["scaffolding", "scaffolding", "core", "en", "seed", "founder-seed", "self"],
  );
  await mock.client.query(
    `INSERT INTO nex.discovery_search_term (term, topic, family, language, status, source, primary_relationship) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    ["scaffold hire", "scaffolding", "equipment", "en", "validated", "related-expansion", "equipment_of:scaffolding"],
  );
});

// ═════════════════════════════════════════════════════════════════
// A · CYCLE MACHINERY
// ═════════════════════════════════════════════════════════════════
describe("Discovery cycle · (A) machinery", () => {
  it("(A1) runs one cycle end-to-end and persists a durable row", async () => {
    const adapter = makeAdapter("test-source", [okOutcome(5)]);
    const report = await runDiscoveryCycle(mock.client, {
      topic: "scaffolding", countries: ["GB"], adapters: [adapter], now: () => Date.now(),
    });
    expect(report.cycle_seq).toBe(1);
    expect(report.outcome).toBe("complete");
    expect(report.businesses_discovered).toBeGreaterThan(0);
    expect(report.searches_attempted).toBeGreaterThan(0);
  });

  it("(A2) cycle_seq is monotonic per topic", async () => {
    const adapter = makeAdapter("test-source", [zeroOutcome()]);
    const r1 = await runDiscoveryCycle(mock.client, { topic: "scaffolding", countries: ["GB"], adapters: [adapter] });
    const r2 = await runDiscoveryCycle(mock.client, { topic: "scaffolding", countries: ["GB"], adapters: [adapter] });
    expect(r2.cycle_seq).toBe(r1.cycle_seq + 1);
  });

  it("(A3) zero_results is distinct from source_unavailable", async () => {
    const zeroAdapter = makeAdapter("z", [zeroOutcome()]);
    const naAdapter   = makeAdapter("u", [unavailableOutcome()]);
    const zeroReport = await runDiscoveryCycle(mock.client, { topic: "scaffolding", countries: ["GB"], adapters: [zeroAdapter] });
    expect(zeroReport.outcome).toBe("zero_results");
    const naReport = await runDiscoveryCycle(mock.client, { topic: "scaffolding", countries: ["GB"], adapters: [naAdapter] });
    expect(naReport.outcome).toBe("source_unavailable");
    expect(naReport.note).toBeTruthy();
  });

  it("(A4) partial when one source unavailable + one responded", async () => {
    const okA = makeAdapter("ok", [okOutcome(3)]);
    const badA = makeAdapter("bad", [unavailableOutcome()]);
    const rep = await runDiscoveryCycle(mock.client, { topic: "scaffolding", countries: ["GB"], adapters: [okA, badA] });
    expect(rep.outcome).toBe("partial");
  });

  it("(A5) no fabricated zeroes · source_outcomes carries per-source truth", async () => {
    const ok = makeAdapter("ok", [okOutcome(2)]);
    const na = makeAdapter("na", [unavailableOutcome()]);
    const rep = await runDiscoveryCycle(mock.client, { topic: "scaffolding", countries: ["GB"], adapters: [ok, na] });
    const sources = rep.source_outcomes.map(s => s.outcome);
    expect(sources).toContain("responded");
    expect(sources).toContain("unavailable");
  });
});

// ═════════════════════════════════════════════════════════════════
// B · GOVERNANCE
// ═════════════════════════════════════════════════════════════════
describe("Discovery cycle · (B) governance", () => {
  it("(B1) system actor cannot promote candidate → validated", async () => {
    const rec = await recordCandidateFromCycle(mock.client, { term: "temporary works", topic: "scaffolding", family: "industry_context", cycle_id: "cyc-x", evidence_added: 3 });
    await expect(promoteCandidateToValidated(mock.client, { term_id: rec.term_id, actor: "system:cycle-runner" })).rejects.toThrow(DiscoveryGovernanceError);
  });

  it("(B2) Founder actor CAN promote candidate → validated", async () => {
    const rec = await recordCandidateFromCycle(mock.client, { term: "access scaffolding", topic: "scaffolding", family: "industry_context", cycle_id: "cyc-x", evidence_added: 3 });
    const promoted = await promoteCandidateToValidated(mock.client, { term_id: rec.term_id, actor: "founder" });
    expect(promoted.status).toBe("validated");
    expect(promoted.first_promoted_by).toBe("founder");
  });

  it("(B3) seed / already-validated cannot be re-promoted", async () => {
    const vocab = await loadVocabulary(mock.client, "scaffolding");
    const seed = vocab.find(v => v.status === "seed")!;
    await expect(promoteCandidateToValidated(mock.client, { term_id: seed.term_id, actor: "founder" })).rejects.toThrow(DiscoveryGovernanceError);
  });

  it("(B4) recording candidate does not silently promote existing seed / validated", async () => {
    const before = await loadVocabulary(mock.client, "scaffolding");
    await recordCandidateFromCycle(mock.client, { term: "scaffolding", topic: "scaffolding", cycle_id: "c1", evidence_added: 100 });
    const after = await loadVocabulary(mock.client, "scaffolding");
    const seed = after.find(v => v.term === "scaffolding")!;
    expect(seed.status).toBe("seed");
  });
});

// ═════════════════════════════════════════════════════════════════
// C · CANARIES · NO SEND · NO ADDRESSES · NO LANE CONTAMINATION
// ═════════════════════════════════════════════════════════════════
describe("Discovery cycle · (C) canaries", () => {
  it("(C1) cycle NEVER touches send_queue / operating_budget / package / send_log", async () => {
    const adapter = makeAdapter("t", [okOutcome(3, [{ term: "scaffold hire", kind: "equipment_of", evidence: 4 }])]);
    await runDiscoveryCycle(mock.client, { topic: "scaffolding", countries: ["GB"], adapters: [adapter] });
    expect(mock.store.marketing_send_queue_touched).toBe(false);
    expect(mock.store.marketing_operating_budget_touched).toBe(false);
    expect(mock.store.marketing_package_touched).toBe(false);
    expect(mock.store.send_log_touched).toBe(false);
  });

  it("(C2) response contains NO email addresses (D-style substring guard)", async () => {
    const adapter = makeAdapter("t", [okOutcome(3, [{ term: "scaffold hire", kind: "equipment_of", evidence: 4 }])]);
    const rep = await runDiscoveryCycle(mock.client, { topic: "scaffolding", countries: ["GB"], adapters: [adapter] });
    const serialised = JSON.stringify(rep);
    expect(serialised).not.toMatch(/@\w+\.\w+/);
    expect(rep.addresses_exposed).toBe(0);
    expect(rep.sends_triggered).toBe(0);
  });

  it("(C3) structural exports · no address-listing function", async () => {
    const mod = await import("..");
    expect((mod as any).listAddresses).toBeUndefined();
    expect((mod as any).getDiscoveredEmails).toBeUndefined();
    expect((mod as any).exportCycleContacts).toBeUndefined();
    expect(_DISCOVERY_INTEL_BOUNDARY_NO_ADDRESSES).toBe("counts_and_relationships_only_no_addresses");
    expect(_DISCOVERY_INTEL_BOUNDARY_NO_SEND).toBe("cycle_never_triggers_send");
  });
});

// ═════════════════════════════════════════════════════════════════
// D · EVIDENCE-BACKED RELATIONSHIPS
// ═════════════════════════════════════════════════════════════════
describe("Discovery cycle · (D) evidence-backed relationships", () => {
  it("(D1) related-term evidence creates a candidate term + relationship", async () => {
    const adapter = makeAdapter("t", [okOutcome(3, [{ term: "scaffold erection", kind: "commercial_service_of", evidence: 5 }])]);
    await runDiscoveryCycle(mock.client, { topic: "scaffolding", countries: ["GB"], adapters: [adapter] });
    const vocab = await loadVocabulary(mock.client, "scaffolding");
    const t = vocab.find(v => v.term === "scaffold erection");
    expect(t).toBeTruthy();
    expect(t?.status).toBe("candidate");
    expect(t?.evidence_count).toBeGreaterThan(0);
    const rels = await loadRelationships(mock.client, { topic: "scaffolding", parent_term: "scaffolding" });
    expect(rels.some(r => r.child_term === "scaffold erection")).toBe(true);
  });

  it("(D2) relationship evidence accumulates across cycles", async () => {
    const adapter = makeAdapter("t", [
      okOutcome(3, [{ term: "scaffold hire", kind: "equipment_of", evidence: 2 }]),
      okOutcome(3, [{ term: "scaffold hire", kind: "equipment_of", evidence: 5 }]),
    ]);
    await runDiscoveryCycle(mock.client, { topic: "scaffolding", countries: ["GB"], adapters: [adapter] });
    await runDiscoveryCycle(mock.client, { topic: "scaffolding", countries: ["GB"], adapters: [adapter] });
    const rels = await loadRelationships(mock.client, { topic: "scaffolding", parent_term: "scaffolding" });
    const rel = rels.find(r => r.child_term === "scaffold hire" && r.relationship_kind === "equipment_of");
    expect(rel).toBeTruthy();
    // First cycle 2 (× however many searches probed the same source), second cycle 5. Both accumulate.
    expect(rel!.evidence_count).toBeGreaterThanOrEqual(7);
  });

  it("(D3) zero evidence never records a relationship", async () => {
    const adapter = makeAdapter("t", [okOutcome(3, [{ term: "unused_term", kind: "trade_of", evidence: 0 }])]);
    await runDiscoveryCycle(mock.client, { topic: "scaffolding", countries: ["GB"], adapters: [adapter] });
    const rels = await loadRelationships(mock.client, { topic: "scaffolding" });
    expect(rels.some(r => r.child_term === "unused_term")).toBe(false);
  });

  it("(D4) confidence scales with evidence · caps at 1", async () => {
    const adapter = makeAdapter("t", [okOutcome(3, [{ term: "big_evidence_term", kind: "trade_of", evidence: 100 }])]);
    await runDiscoveryCycle(mock.client, { topic: "scaffolding", countries: ["GB"], adapters: [adapter] });
    const rels = await loadRelationships(mock.client, { topic: "scaffolding", parent_term: "scaffolding" });
    const r0 = rels.find(r => r.child_term === "big_evidence_term")!;
    expect(r0.confidence).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════
// E · STATUS + RECENT HISTORY
// ═════════════════════════════════════════════════════════════════
describe("Discovery cycle · (E) status + history", () => {
  it("(E1) loadRecentCycles returns most-recent first", async () => {
    const adapter = makeAdapter("t", [zeroOutcome()]);
    await runDiscoveryCycle(mock.client, { topic: "scaffolding", countries: ["GB"], adapters: [adapter] });
    await runDiscoveryCycle(mock.client, { topic: "scaffolding", countries: ["GB"], adapters: [adapter] });
    const recent = await loadRecentCycles(mock.client, "scaffolding", 12);
    expect(recent.length).toBe(2);
    expect(recent[0].cycle_seq).toBeGreaterThan(recent[1].cycle_seq);
  });

  it("(E2) status reports last_completed_cycle + next_expected_at ~5min after start", async () => {
    const adapter = makeAdapter("t", [okOutcome(2)]);
    await runDiscoveryCycle(mock.client, { topic: "scaffolding", countries: ["GB"], adapters: [adapter] });
    const status = await loadDiscoveryStatus(mock.client, "scaffolding");
    expect(status.last_completed_cycle).toBeTruthy();
    expect(status.cadence_seconds).toBe(300);
    if (status.last_completed_cycle && status.next_expected_at) {
      const t0 = Date.parse(status.last_completed_cycle.started_at);
      const t1 = Date.parse(status.next_expected_at);
      expect(t1 - t0).toBe(300_000);
    }
  });
});
