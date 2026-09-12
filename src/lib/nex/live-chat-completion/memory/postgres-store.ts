// src/lib/nex/live-chat-completion/memory/postgres-store.ts
//
// Founder BEGIN Phase 3.10 · Postgres-backed L2 memory store.
//
// Reads/writes nex.user_profile + nex.user_memory (migration 151).
// Trust ceiling on retrieval is enforced OUTSIDE this store · the store
// simply persists · doctrine #4 (MEMORY IS NOT TRUTH) is enforced by the
// bundle assembler which maps memories to PersonalizationContext, never
// to EvidenceItem.

import type { Pool } from "pg";
import type {
  MemoryStore, UserId, UserProfile, UserMemory, CustomInstructions, UserMemoryCategory,
} from "./contract";
import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";

const MAX_MEMORIES_PER_USER = 200;

export function makePostgresMemoryStore(pool: Pool = getKnowledgeFactoryDbPool()): MemoryStore {
  return {
    name: "postgres-memory",

    async loadProfile(user_id: UserId): Promise<UserProfile | null> {
      const p = await pool.query(
        `SELECT user_id, display_name, custom_instructions, created_at, updated_at
           FROM nex.user_profile WHERE user_id = $1`,
        [user_id],
      );
      if (p.rowCount === 0) return null;
      const row = p.rows[0];
      const mems = await pool.query(
        `SELECT memory_id, user_id, claim_text, category, tier, confidence, source_turn_id,
                created_at, expires_at, last_referenced_at
           FROM nex.user_memory
           WHERE user_id = $1 AND deleted_at IS NULL
           ORDER BY COALESCE(last_referenced_at, created_at) DESC
           LIMIT $2`,
        [user_id, MAX_MEMORIES_PER_USER],
      );
      const memories: UserMemory[] = mems.rows.map((r) => ({
        memory_id: String(r.memory_id),
        user_id: String(r.user_id),
        claim_text: String(r.claim_text),
        category: r.category as UserMemoryCategory,
        tier: (r.tier as UserMemory["tier"]) ?? "semantic",
        confidence: Number(r.confidence),
        source_turn_id: r.source_turn_id ?? undefined,
        created_at: new Date(r.created_at).toISOString(),
        expires_at: r.expires_at ? new Date(r.expires_at).toISOString() : null,
        last_referenced_at: r.last_referenced_at ? new Date(r.last_referenced_at).toISOString() : null,
      }));
      return {
        user_id: String(row.user_id),
        display_name: row.display_name ?? undefined,
        custom_instructions: row.custom_instructions ?? undefined,
        memories,
        created_at: new Date(row.created_at).toISOString(),
        updated_at: new Date(row.updated_at).toISOString(),
      };
    },

    async upsertProfile(profile: UserProfile): Promise<void> {
      await pool.query(
        `INSERT INTO nex.user_profile (user_id, display_name, custom_instructions, created_at, updated_at)
         VALUES ($1, $2, $3::jsonb, now(), now())
         ON CONFLICT (user_id) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           custom_instructions = EXCLUDED.custom_instructions,
           updated_at = now()`,
        [
          profile.user_id,
          profile.display_name ?? null,
          profile.custom_instructions ? JSON.stringify(profile.custom_instructions) : null,
        ],
      );
    },

    async listMemories(user_id, opts): Promise<UserMemory[]> {
      const conds: string[] = ["user_id = $1", "deleted_at IS NULL"];
      const params: unknown[] = [user_id];
      let p = 1;
      if (opts?.category) {
        params.push(opts.category);
        conds.push(`category = $${++p}`);
      }
      params.push(Math.min(Math.max(opts?.limit ?? 25, 1), MAX_MEMORIES_PER_USER));
      const q = await pool.query(
        `SELECT memory_id, user_id, claim_text, category, tier, confidence, source_turn_id,
                created_at, expires_at, last_referenced_at
           FROM nex.user_memory
           WHERE ${conds.join(" AND ")}
           ORDER BY COALESCE(last_referenced_at, created_at) DESC
           LIMIT $${++p}`,
        params,
      );
      return q.rows.map((r) => ({
        memory_id: String(r.memory_id),
        user_id: String(r.user_id),
        claim_text: String(r.claim_text),
        category: r.category as UserMemoryCategory,
        tier: (r.tier as UserMemory["tier"]) ?? "semantic",
        confidence: Number(r.confidence),
        source_turn_id: r.source_turn_id ?? undefined,
        created_at: new Date(r.created_at).toISOString(),
        expires_at: r.expires_at ? new Date(r.expires_at).toISOString() : null,
        last_referenced_at: r.last_referenced_at ? new Date(r.last_referenced_at).toISOString() : null,
      }));
    },

    async saveMemory(mem: UserMemory): Promise<void> {
      await pool.query(
        `INSERT INTO nex.user_memory
           (memory_id, user_id, claim_text, category, tier, confidence, source_turn_id,
            created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8)
         ON CONFLICT (memory_id) DO UPDATE SET
           claim_text = EXCLUDED.claim_text,
           category   = EXCLUDED.category,
           tier       = EXCLUDED.tier,
           confidence = EXCLUDED.confidence,
           expires_at = EXCLUDED.expires_at`,
        [
          mem.memory_id, mem.user_id, mem.claim_text, mem.category,
          mem.tier ?? "semantic",
          mem.confidence, mem.source_turn_id ?? null,
          mem.expires_at ?? null,
        ],
      );
      // Ensure profile row exists (upsert-only touches updated_at).
      await pool.query(
        `INSERT INTO nex.user_profile (user_id, created_at, updated_at)
         VALUES ($1, now(), now())
         ON CONFLICT (user_id) DO UPDATE SET updated_at = now()`,
        [mem.user_id],
      );
    },

    async deleteMemory(user_id, memory_id): Promise<void> {
      await pool.query(
        `UPDATE nex.user_memory SET deleted_at = now()
         WHERE user_id = $1 AND memory_id = $2 AND deleted_at IS NULL`,
        [user_id, memory_id],
      );
    },

    async setCustomInstructions(user_id, ci: CustomInstructions): Promise<void> {
      const withStamp: CustomInstructions = { ...ci, updated_at: new Date().toISOString() };
      await pool.query(
        `INSERT INTO nex.user_profile (user_id, custom_instructions, created_at, updated_at)
         VALUES ($1, $2::jsonb, now(), now())
         ON CONFLICT (user_id) DO UPDATE SET
           custom_instructions = EXCLUDED.custom_instructions,
           updated_at = now()`,
        [user_id, JSON.stringify(withStamp)],
      );
    },
  };
}
