// NEX AI · Contact Resolver
//
// The identity bridge between AI/NEX Brain workers and the Contact
// Registry. Every AI-adjacent surface that references a person should
// pass through this resolver so that:
//
//   · Aliases are followed automatically (merges are invisible to AI)
//   · AI never operates on duplicate identities
//   · Every resolution is auditable (ai.contact_resolved event)
//   · Confidence scoring surfaces ambiguity for AI to ask clarifying
//     questions rather than silently pick the wrong person
//
// Doctrine: constitution_nex_contact_intelligence_registry_2026_08_07.md
// (Consumer Wiring · AI branch)

import { randomUUID } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { findContactByIdentifiers, loadContactById } from "@/lib/nex/contacts/registry";
import { resolveAlias } from "@/lib/nex/contacts/merge";
import { canonicalEmail, canonicalPhone } from "@/lib/nex/contacts/identity";
import type { Contact } from "@/lib/nex/contacts/types";

export type ContactResolveInput = {
  // Provide any subset · resolver tries strongest signals first
  contact_id?: string;
  email?: string;
  phone?: string;
  name_hint?: string;
  company_hint?: string;
  free_text?: string;                     // last-resort · ILIKE across name/company/email/tags
  // Optional caller ref written to the audit event so we can track
  // WHICH ai worker is asking (e.g. "nex-brain:master-aggregator").
  caller?: string;
};

export type ContactMatch = {
  contact: Contact;
  confidence: number;                     // 0..100
  match_reason:
    | "contact_id_alias_resolved"          // input contact_id ≠ canonical (merge followed)
    | "contact_id_direct"                   // input contact_id matched canonical without alias hop
    | "email_exact"
    | "phone_exact"
    | "name_company_fuzzy"
    | "free_text_ilike";
};

export type ContactResolveResult = {
  matches: ContactMatch[];                // ordered by confidence · top 5 by default
  strategy_used: string;                  // "contact_id" | "email" | "phone" | "name_company" | "free_text" | "no_signal"
  input: ContactResolveInput;
  audit_event_id: string;
  resolved_at: string;
};

// ── Postgres helper (fuzzy search + free-text) ──────────────────────

type PgClientLike = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  release: () => void;
};
type PgPoolLike = { connect: () => Promise<PgClientLike>; end: () => Promise<void> };
let poolPromise: Promise<PgPoolLike | null> | null = null;

async function getPool(): Promise<PgPoolLike | null> {
  if (poolPromise) return poolPromise;
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) { poolPromise = Promise.resolve(null); return poolPromise; }
  poolPromise = (async () => {
    let pg: unknown;
    try { pg = await import("pg" as string); } catch { return null; }
    const { Pool } = ((pg as { default?: unknown }).default ?? pg) as {
      Pool: new (c: { connectionString: string; max?: number; ssl?: { rejectUnauthorized: boolean } | boolean }) => PgPoolLike;
    };
    const needsSsl = /supabase\.co|render\.com|neon\.tech|amazonaws\.com/.test(url);
    return new Pool({ connectionString: url, max: 3, ssl: needsSsl ? { rejectUnauthorized: false } : undefined });
  })();
  return poolPromise;
}

async function withClient<T>(fn: (c: PgClientLike) => Promise<T>): Promise<T | null> {
  const pool = await getPool();
  if (!pool) return null;
  const client = await pool.connect();
  try { return await fn(client); }
  finally { client.release(); }
}

async function fuzzyByNameCompany(name?: string, company?: string, limit = 5): Promise<Contact[]> {
  const result = await withClient(async (c) => {
    const params: string[] = [];
    const wheres: string[] = ["deleted_at IS NULL"];
    if (name) {
      params.push(`%${name.toLowerCase()}%`);
      wheres.push(`LOWER(COALESCE(name, '')) LIKE $${params.length}`);
    }
    if (company) {
      params.push(`%${company.toLowerCase()}%`);
      wheres.push(`LOWER(COALESCE(company, '')) LIKE $${params.length}`);
    }
    if (wheres.length === 1) return [];    // no signal beyond deleted-exclusion
    params.push(String(limit));
    const res = await c.query(
      `SELECT DISTINCT ON (contact_id) *
       FROM nex.contacts
       WHERE ${wheres.join(" AND ")}
       ORDER BY contact_id, updated_at DESC
       LIMIT $${params.length}`,
      params,
    );
    return res.rows as unknown as Contact[];
  });
  return result ?? [];
}

async function freeTextSearch(text: string, limit = 5): Promise<Contact[]> {
  const result = await withClient(async (c) => {
    const like = `%${text.toLowerCase()}%`;
    const res = await c.query(
      `SELECT DISTINCT ON (contact_id) *
       FROM nex.contacts
       WHERE deleted_at IS NULL
         AND (
           LOWER(COALESCE(name, '')) LIKE $1
           OR LOWER(COALESCE(company, '')) LIKE $1
           OR LOWER(COALESCE(email, '')) LIKE $1
           OR tags::text ILIKE $1
         )
       ORDER BY contact_id, updated_at DESC
       LIMIT $2`,
      [like, String(limit)],
    );
    return res.rows as unknown as Contact[];
  });
  return result ?? [];
}

// ── Audit ─────────────────────────────────────────────────────────

async function writeResolveAudit(payload: Record<string, unknown>): Promise<string> {
  const id = randomUUID();
  try {
    const store = getStorage();
    await store.save(COLLECTIONS.events, {
      event_id: id,
      event_type: "ai.contact_resolved",
      source: "nex-ai-resolver",
      actor_id: null,
      timestamp: new Date().toISOString(),
      business_id: null,
      related_department: "contact-intelligence",
      related_brain: (payload.caller as string) ?? null,
      related_job: null,
      related_contact: (payload.top_contact_id as string) ?? null,
      outcome: (payload.match_count as number) > 0 ? "ok" : "no_match",
      payload,
      reversible: false,
      reverse_of: null,
      supersedes: null,
    });
  } catch {
    // never mask the resolve result
  }
  return id;
}

// ── Public resolver ──────────────────────────────────────────────

export async function resolveContactForAI(input: ContactResolveInput): Promise<ContactResolveResult> {
  const started = Date.now();
  const matches: ContactMatch[] = [];
  let strategy = "no_signal";

  try {
    // 1. contact_id (strongest signal · alias-follow)
    if (input.contact_id) {
      strategy = "contact_id";
      const canonicalId = await resolveAlias(input.contact_id);
      const c = await loadContactById(canonicalId);
      if (c) {
        matches.push({
          contact: c,
          confidence: 100,
          match_reason: canonicalId !== input.contact_id ? "contact_id_alias_resolved" : "contact_id_direct",
        });
      }
    }

    // 2. email exact
    if (matches.length === 0 && input.email && canonicalEmail(input.email)) {
      strategy = "email";
      const c = await findContactByIdentifiers({ email: input.email });
      if (c) matches.push({ contact: c, confidence: 99, match_reason: "email_exact" });
    }

    // 3. phone exact
    if (matches.length === 0 && input.phone && canonicalPhone(input.phone)) {
      strategy = "phone";
      const c = await findContactByIdentifiers({ phone: input.phone });
      if (c) matches.push({ contact: c, confidence: 95, match_reason: "phone_exact" });
    }

    // 4. name + company fuzzy (ILIKE substring)
    if (matches.length === 0 && (input.name_hint || input.company_hint)) {
      strategy = "name_company";
      const rows = await fuzzyByNameCompany(input.name_hint, input.company_hint, 5);
      for (const c of rows) {
        matches.push({ contact: c, confidence: 60, match_reason: "name_company_fuzzy" });
      }
    }

    // 5. free-text (last resort)
    if (matches.length === 0 && input.free_text && input.free_text.trim().length >= 2) {
      strategy = "free_text";
      const rows = await freeTextSearch(input.free_text.trim(), 5);
      for (const c of rows) {
        matches.push({ contact: c, confidence: 40, match_reason: "free_text_ilike" });
      }
    }
  } catch {
    // registry unreachable · return whatever we have · never throw at AI
  }

  const audit_event_id = await writeResolveAudit({
    caller: input.caller ?? "unknown",
    strategy,
    match_count: matches.length,
    top_confidence: matches[0]?.confidence ?? null,
    top_contact_id: matches[0]?.contact.contact_id ?? null,
    duration_ms: Date.now() - started,
    input_signals: {
      has_contact_id: !!input.contact_id,
      has_email: !!input.email,
      has_phone: !!input.phone,
      has_name_hint: !!input.name_hint,
      has_company_hint: !!input.company_hint,
      has_free_text: !!input.free_text,
    },
    alias_resolved: matches[0]?.match_reason === "contact_id_alias_resolved",
    // Signals used by the Consumer Adoption tracker to count AI-flowing sends
    registry_resolved: matches.length > 0,
  });

  return {
    matches,
    strategy_used: strategy,
    input,
    audit_event_id,
    resolved_at: new Date().toISOString(),
  };
}
