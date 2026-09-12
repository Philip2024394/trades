// src/lib/nex/live-chat-completion/kf-pool.ts
//
// Founder BEGIN Phase 2 · Knowledge Factory Postgres pool.
//
// The knowledge factory tables (nex.entity_index · nex.question_variant ·
// nex.knowledge_gap · nex.kf_worker_heartbeat · nex.category_scorecard ·
// nex.master_rulebook) live in the Postgres pointed to by
// NEX_KF_POSTGRES_URL (falls back to NEX_TAXONOMY_POSTGRES_URL, then
// NEX_POSTGRES_URL as a last resort).
//
// Deliberately separate from getAccommodationDbPool() — the KF pool may
// point at a different host than the accommodation source of truth.
// The generator handles cross-pool reads (accommodation from source,
// writes to KF) as an explicit design choice.

import { Pool } from "pg";

let _pool: Pool | null = null;

export function getKnowledgeFactoryDbPool(): Pool {
  if (_pool) return _pool;
  const url =
    process.env.NEX_KF_POSTGRES_URL
    ?? process.env.NEX_TAXONOMY_POSTGRES_URL
    ?? process.env.NEX_POSTGRES_URL;
  if (!url) {
    throw new Error(
      "Knowledge factory pool: no connection URL. Set NEX_KF_POSTGRES_URL or NEX_TAXONOMY_POSTGRES_URL.",
    );
  }
  const needsSsl = /supabase\.co|render\.com|neon\.tech|amazonaws\.com/.test(url);
  _pool = new Pool({
    connectionString: url,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    max: 8,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  return _pool;
}
