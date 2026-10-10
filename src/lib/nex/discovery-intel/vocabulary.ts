// src/lib/nex/discovery-intel/vocabulary.ts
//
// NEX Fresh World Discovery · vocabulary loader + governance
// Founder-authorised programme · bounded wave 2026-09-21.

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { PoolClient } from "pg";
import type { SearchTerm, SearchTermStatus } from "./types";
import { DiscoveryGovernanceError } from "./types";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

export interface TaxonomyFileEntry {
  keyword: string;
  language: string;
  primary_relationship: string;
  source: string;
  discovery_date: string;
  country_applicability?: string[];
  notes?: string;
}

export interface TaxonomyFile {
  seeds: Array<TaxonomyFileEntry>;
  related_family: Array<{ family: string; keywords: TaxonomyFileEntry[] }>;
}

export function readTaxonomyFile(path: string = resolve(REPO_ROOT, "data/nex-scaffolding-taxonomy.json")): TaxonomyFile | null {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, "utf8")) as TaxonomyFile; } catch { return null; }
}

export async function seedVocabularyFromTaxonomy(
  client: PoolClient,
  topic: string,
  file: TaxonomyFile,
): Promise<{ seeds_inserted: number; related_inserted: number; already_present: number }> {
  let seeds_inserted = 0, related_inserted = 0, already_present = 0;
  const upsert = async (term: string, family: string | null, language: string, status: SearchTermStatus, source: string, primary_relationship: string) => {
    const existing = await client.query(
      `SELECT term_id FROM nex.discovery_search_term WHERE term = $1 AND topic = $2 AND language = $3`,
      [term, topic, language],
    );
    if (existing.rows.length > 0) { already_present += 1; return; }
    await client.query(
      `INSERT INTO nex.discovery_search_term (term, topic, family, language, status, source, primary_relationship)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [term, topic, family, language, status, source, primary_relationship],
    );
    if (status === "seed") seeds_inserted += 1; else related_inserted += 1;
  };
  for (const s of file.seeds) {
    await upsert(s.keyword, "core", s.language, "seed", "founder-seed", s.primary_relationship);
  }
  for (const f of file.related_family) {
    for (const k of f.keywords) {
      const status: SearchTermStatus = k.source === "related-expansion" ? "validated" : "candidate";
      await upsert(k.keyword, f.family, k.language, status, k.source, k.primary_relationship);
    }
  }
  return { seeds_inserted, related_inserted, already_present };
}

export async function loadVocabulary(client: PoolClient, topic: string): Promise<ReadonlyArray<SearchTerm>> {
  const res = await client.query(
    `SELECT term_id, term, topic, family, language, country_applicability, status, source,
            primary_relationship, discovery_date::text AS discovery_date, evidence_count,
            last_evidence_at::text AS last_evidence_at, first_promoted_at::text AS first_promoted_at,
            first_promoted_by, metadata
       FROM nex.discovery_search_term
      WHERE topic = $1
      ORDER BY status, family, term`,
    [topic],
  );
  return res.rows.map(r => ({
    term_id: r.term_id, term: r.term, topic: r.topic, family: r.family, language: r.language,
    country_applicability: r.country_applicability ?? ["all"], status: r.status, source: r.source,
    primary_relationship: r.primary_relationship, discovery_date: r.discovery_date,
    evidence_count: r.evidence_count, last_evidence_at: r.last_evidence_at,
    first_promoted_at: r.first_promoted_at, first_promoted_by: r.first_promoted_by, metadata: r.metadata ?? {},
  }));
}

export interface VocabularyTree {
  readonly topic: string;
  readonly seeds: ReadonlyArray<SearchTerm>;
  readonly validated: ReadonlyArray<SearchTerm>;
  readonly candidates: ReadonlyArray<SearchTerm>;
  readonly rejected: ReadonlyArray<SearchTerm>;
  readonly by_family: Readonly<Record<string, ReadonlyArray<SearchTerm>>>;
}

export async function loadVocabularyTree(client: PoolClient, topic: string): Promise<VocabularyTree> {
  const rows = await loadVocabulary(client, topic);
  const by_family: Record<string, SearchTerm[]> = {};
  for (const r of rows) {
    const key = r.family ?? "unfamilied";
    by_family[key] = by_family[key] ?? [];
    by_family[key].push(r);
  }
  return {
    topic,
    seeds: rows.filter(r => r.status === "seed"),
    validated: rows.filter(r => r.status === "validated"),
    candidates: rows.filter(r => r.status === "candidate"),
    rejected: rows.filter(r => r.status === "rejected"),
    by_family,
  };
}

export async function recordCandidateFromCycle(
  client: PoolClient,
  input: { term: string; topic: string; language?: string; family?: string; cycle_id: string; evidence_added: number },
): Promise<{ kind: "new_candidate" | "evidence_appended" | "already_seed_or_validated"; term_id: string }> {
  const language = input.language ?? "en";
  const existing = await client.query(
    `SELECT term_id, status FROM nex.discovery_search_term WHERE term = $1 AND topic = $2 AND language = $3`,
    [input.term, input.topic, language],
  );
  if (existing.rows.length === 0) {
    const insert = await client.query(
      `INSERT INTO nex.discovery_search_term (term, topic, family, language, status, source, primary_relationship, evidence_count, last_evidence_at)
       VALUES ($1, $2, $3, $4, 'candidate', $5, $6, $7, now()) RETURNING term_id`,
      [
        input.term, input.topic, input.family ?? null, language,
        `observed-from-cycle:${input.cycle_id}`,
        input.family ? `${input.family}_of:${input.topic}` : `related_to:${input.topic}`,
        Math.max(0, Math.floor(input.evidence_added ?? 0)),
      ],
    );
    return { kind: "new_candidate", term_id: insert.rows[0].term_id };
  }
  const row = existing.rows[0];
  await client.query(
    `UPDATE nex.discovery_search_term SET evidence_count = evidence_count + $1, last_evidence_at = now() WHERE term_id = $2`,
    [Math.max(0, Math.floor(input.evidence_added ?? 0)), row.term_id],
  );
  if (row.status === "seed" || row.status === "validated") return { kind: "already_seed_or_validated", term_id: row.term_id };
  return { kind: "evidence_appended", term_id: row.term_id };
}

export async function promoteCandidateToValidated(
  client: PoolClient,
  input: { term_id: string; actor: string },
): Promise<SearchTerm> {
  if (input.actor.startsWith("system:")) {
    throw new DiscoveryGovernanceError(`system actor ${input.actor} may not promote candidate → validated · Founder-authored decision required`);
  }
  const before = await client.query(`SELECT * FROM nex.discovery_search_term WHERE term_id = $1`, [input.term_id]);
  if (before.rows.length === 0) throw new DiscoveryGovernanceError(`term_id ${input.term_id} not found`);
  const b = before.rows[0];
  if (b.status !== "candidate") throw new DiscoveryGovernanceError(`term ${b.term} status=${b.status} · only 'candidate' can be promoted`);
  const res = await client.query(
    `UPDATE nex.discovery_search_term
        SET status = 'validated', first_promoted_at = COALESCE(first_promoted_at, now()), first_promoted_by = $1
      WHERE term_id = $2
    RETURNING term_id, term, topic, family, language, country_applicability, status, source,
              primary_relationship, discovery_date::text AS discovery_date, evidence_count,
              last_evidence_at::text AS last_evidence_at, first_promoted_at::text AS first_promoted_at,
              first_promoted_by, metadata`,
    [input.actor, input.term_id],
  );
  const row = res.rows[0];
  return {
    term_id: row.term_id, term: row.term, topic: row.topic, family: row.family, language: row.language,
    country_applicability: row.country_applicability ?? ["all"], status: row.status, source: row.source,
    primary_relationship: row.primary_relationship, discovery_date: row.discovery_date,
    evidence_count: row.evidence_count, last_evidence_at: row.last_evidence_at,
    first_promoted_at: row.first_promoted_at, first_promoted_by: row.first_promoted_by, metadata: row.metadata ?? {},
  };
}
