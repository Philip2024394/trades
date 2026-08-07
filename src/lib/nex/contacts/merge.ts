// NEX Contact Intelligence · Merge Engine
//
// The Merge Centre resolves duplicate contacts safely and permanently.
// Every merge follows deterministic rules and produces a full audit
// trail. Absorbed contacts do not disappear · they become aliases that
// resolve to the canonical contact for every future lookup.
//
// Doctrine (contact-registry constitution):
//   1. Never lose source history        — every source row survives · repointed to surviving
//   2. Never weaken compliance          — one-way ratchet across BOTH contacts' compliance state
//   3. Never remove audit history       — every event + merge row preserved
//   4. Preserve the safest consent      — false wins · TRUE never_contact wins · unsubscribe_at kept if either set
//   5. Preserve the earliest first-seen — min(first_seen_at) across both
//   6. Preserve all relationships       — nex.events.related_contact + linked_business_id repointed
//
// Every merge is reversible: mark contact_merges.reversed_at = now, and
// a follow-up "unmerge" API restores the absorbed contact's canonical
// snapshot (Phase 3c.3 · not shipped in 3c.2).

import { randomUUID } from "node:crypto";
import type { Contact, ContactDuplicateSuggestion } from "./types";
import { canonicalEmail, canonicalPhone, companyKey, nameKey } from "./identity";
import { orderedPair } from "./dedup";

type PgClientLike = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
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
    return new Pool({ connectionString: url, max: 5, ssl: needsSsl ? { rejectUnauthorized: false } : undefined });
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

// ── Alias resolution ────────────────────────────────────────────────
//
// A contact that was absorbed by a merge lives on as an alias pointing to
// the surviving contact. Every read-path caller with a possibly-stale
// contact_id should call resolveAlias() first · returns the canonical id.

export async function resolveAlias(contactId: string): Promise<string> {
  const result = await withClient(async (c) => {
    // Follow the merge chain · a rare case: A merged into B, B later
    // merged into C · looking up A should return C.
    let current = contactId;
    for (let depth = 0; depth < 10; depth++) {
      const r = await c.query(
        `SELECT surviving_contact_id FROM nex.contact_merges
         WHERE absorbed_contact_id = $1 AND reversed_at IS NULL
         ORDER BY decided_at DESC LIMIT 1`,
        [current],
      );
      if (r.rows.length === 0) return current;
      const next = String(r.rows[0].surviving_contact_id);
      if (next === current) return current;             // cycle guard
      current = next;
    }
    return current;
  });
  return result ?? contactId;
}

// ── Duplicate scan ───────────────────────────────────────────────────
//
// Populates nex.contact_duplicate_suggestions from the canonical
// contacts table. Three heuristics · same as dedup.ts. Only inserts NEW
// pairs · re-runs are idempotent thanks to the (contact_a, contact_b,
// match_kind) unique index.

export type ScanResult = {
  scanned_contacts: number;
  suggestions_inserted: number;
  suggestions_skipped_existing: number;
  by_kind: Record<string, number>;
  duration_ms: number;
};

export async function scanForDuplicates(): Promise<ScanResult> {
  const empty: ScanResult = { scanned_contacts: 0, suggestions_inserted: 0, suggestions_skipped_existing: 0, by_kind: {}, duration_ms: 0 };
  const started = Date.now();
  const result = await withClient(async (c) => {
    // Pull canonical contacts (latest per id · not deleted · has at least
    // one dedup key). ~50k rows fits easily in memory · large orgs would
    // stream, but Phase 3c.2 aims for correctness first.
    const contactsRes = await c.query(
      `SELECT DISTINCT ON (contact_id) contact_id, canonical_email, canonical_phone, name, company
       FROM nex.contacts
       WHERE deleted_at IS NULL AND (canonical_email IS NOT NULL OR canonical_phone IS NOT NULL)
       ORDER BY contact_id, updated_at DESC`,
    );
    const rows = contactsRes.rows as Array<{ contact_id: string; canonical_email: string | null; canonical_phone: string | null; name: string | null; company: string | null }>;

    // Build lookup maps
    const byEmail = new Map<string, string[]>();
    const byPhone = new Map<string, string[]>();
    const byNameCompany = new Map<string, string[]>();
    for (const r of rows) {
      if (r.canonical_email) {
        const arr = byEmail.get(r.canonical_email) ?? [];
        arr.push(r.contact_id); byEmail.set(r.canonical_email, arr);
      }
      if (r.canonical_phone) {
        const arr = byPhone.get(r.canonical_phone) ?? [];
        arr.push(r.contact_id); byPhone.set(r.canonical_phone, arr);
      }
      const nk = nameKey(r.name);
      const ck = companyKey(r.company);
      if (nk && ck) {
        const key = `${nk}|${ck}`;
        const arr = byNameCompany.get(key) ?? [];
        arr.push(r.contact_id); byNameCompany.set(key, arr);
      }
    }

    // Collect candidate pairs. A pair may hit multiple kinds — we insert
    // the strongest signal per (a, b) via the unique index (contact_a,
    // contact_b, match_kind).
    const candidates: Array<{ contact_a: string; contact_b: string; match_kind: "email_exact" | "phone_exact" | "name_company_fuzzy"; confidence: number }> = [];
    const emit = (ids: string[], match_kind: "email_exact" | "phone_exact" | "name_company_fuzzy", confidence: number) => {
      if (ids.length < 2) return;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const { contact_a, contact_b } = orderedPair(ids[i], ids[j]);
          candidates.push({ contact_a, contact_b, match_kind, confidence });
        }
      }
    };
    for (const ids of byEmail.values()) emit(ids, "email_exact", 99);
    for (const ids of byPhone.values()) emit(ids, "phone_exact", 95);
    for (const ids of byNameCompany.values()) emit(ids, "name_company_fuzzy", 60);

    // Insert · ON CONFLICT skips existing (same pair + kind) — no updates.
    // Suggestions decayed by admin ("keep_separate") stay decided · we
    // don't re-suggest them.
    let inserted = 0;
    let skipped = 0;
    const byKind: Record<string, number> = {};
    for (const cand of candidates) {
      byKind[cand.match_kind] = (byKind[cand.match_kind] ?? 0) + 1;
      const r = await c.query(
        `INSERT INTO nex.contact_duplicate_suggestions (contact_a, contact_b, match_kind, confidence, decision)
         VALUES ($1, $2, $3, $4, 'pending')
         ON CONFLICT (contact_a, contact_b, match_kind) DO NOTHING
         RETURNING suggestion_id`,
        [cand.contact_a, cand.contact_b, cand.match_kind, cand.confidence],
      );
      if ((r.rowCount ?? 0) > 0) inserted += 1;
      else skipped += 1;
    }

    return { scanned_contacts: rows.length, suggestions_inserted: inserted, suggestions_skipped_existing: skipped, by_kind: byKind };
  });

  const final: ScanResult = result ?? empty;
  final.duration_ms = Date.now() - started;
  return final;
}

// ── Duplicate queue ─────────────────────────────────────────────────

export type DuplicateQueueEntry = ContactDuplicateSuggestion & {
  contact_a_snapshot: Contact | null;
  contact_b_snapshot: Contact | null;
};

export async function listPendingDuplicates(opts: { limit?: number; min_confidence?: number; match_kind?: string } = {}): Promise<DuplicateQueueEntry[]> {
  const result = await withClient(async (c) => {
    const limit = Math.min(Math.max(1, opts.limit ?? 50), 500);
    const wheres = ["s.decision IS NULL OR s.decision = 'pending'"];
    const params: unknown[] = [];
    if (typeof opts.min_confidence === "number") {
      params.push(opts.min_confidence);
      wheres.push(`s.confidence >= $${params.length}`);
    }
    if (opts.match_kind) {
      params.push(opts.match_kind);
      wheres.push(`s.match_kind = $${params.length}`);
    }
    params.push(limit);
    const res = await c.query(
      `SELECT
         s.*,
         (SELECT row_to_json(a) FROM (SELECT DISTINCT ON (contact_id) * FROM nex.contacts WHERE contact_id = s.contact_a ORDER BY contact_id, updated_at DESC LIMIT 1) a) AS a_snap,
         (SELECT row_to_json(b) FROM (SELECT DISTINCT ON (contact_id) * FROM nex.contacts WHERE contact_id = s.contact_b ORDER BY contact_id, updated_at DESC LIMIT 1) b) AS b_snap
       FROM nex.contact_duplicate_suggestions s
       WHERE ${wheres.join(" AND ")}
       ORDER BY s.confidence DESC, s.detected_at DESC
       LIMIT $${params.length}`,
      params,
    );
    return res.rows.map((r) => ({
      suggestion_id: String(r.suggestion_id),
      contact_a: String(r.contact_a),
      contact_b: String(r.contact_b),
      match_kind: String(r.match_kind) as ContactDuplicateSuggestion["match_kind"],
      confidence: Number(r.confidence),
      detected_at: String(r.detected_at),
      decided_at: (r.decided_at as string | null) ?? null,
      decided_by: (r.decided_by as string | null) ?? null,
      decision: (r.decision as ContactDuplicateSuggestion["decision"]) ?? null,
      merge_id: (r.merge_id as string | null) ?? null,
      contact_a_snapshot: (r.a_snap as unknown as Contact | null) ?? null,
      contact_b_snapshot: (r.b_snap as unknown as Contact | null) ?? null,
    }));
  });
  return result ?? [];
}

// ── Merge preview ───────────────────────────────────────────────────

export type MergeConflict = {
  field: string;
  surviving_value: unknown;
  absorbed_value: unknown;
  resolution: "surviving_wins" | "absorbed_wins" | "combined" | "ratcheted_safer";
  note?: string;
};

export type MergePreview = {
  surviving_id: string;
  absorbed_id: string;
  resulting: Contact;                     // computed canonical snapshot after merge
  conflicts: MergeConflict[];
  source_rows_to_repoint: number;
  events_to_repoint: number;
};

/**
 * Applies the deterministic merge rules WITHOUT writing. Used by the
 * preview modal and by executeMerge() itself (single source of truth
 * for the merge algorithm).
 */
async function loadCanonicalSnapshot(client: PgClientLike, contactId: string): Promise<Contact | null> {
  const r = await client.query(
    `SELECT DISTINCT ON (contact_id) *
     FROM nex.contacts
     WHERE contact_id = $1
     ORDER BY contact_id, updated_at DESC
     LIMIT 1`,
    [contactId],
  );
  return (r.rows[0] as unknown as Contact | undefined) ?? null;
}

function mergeArrays<T>(a: T[] | null | undefined, b: T[] | null | undefined): T[] {
  const set = new Set<T>();
  for (const x of a ?? []) set.add(x);
  for (const x of b ?? []) set.add(x);
  return Array.from(set);
}

function applyMergeRules(surviving: Contact, absorbed: Contact): { resulting: Contact; conflicts: MergeConflict[] } {
  const conflicts: MergeConflict[] = [];

  // Consent · one-way ratchet toward safety (same doctrine as upsertContact)
  const never_contact = surviving.never_contact === true || absorbed.never_contact === true;
  const unsubscribe_at = surviving.unsubscribe_at ?? absorbed.unsubscribe_at ?? null;
  const consent_marketing =
    (surviving.consent_marketing === false || absorbed.consent_marketing === false)
      ? false
      : (surviving.consent_marketing ?? absorbed.consent_marketing ?? null);
  const consent_transactional =
    (surviving.consent_transactional === false || absorbed.consent_transactional === false)
      ? false
      : (surviving.consent_transactional ?? absorbed.consent_transactional ?? null);

  if (surviving.consent_marketing !== absorbed.consent_marketing) {
    conflicts.push({
      field: "consent_marketing",
      surviving_value: surviving.consent_marketing,
      absorbed_value: absorbed.consent_marketing,
      resolution: "ratcheted_safer",
      note: consent_marketing === false ? "false wins across both" : "safer of the two kept",
    });
  }
  if (surviving.never_contact !== absorbed.never_contact) {
    conflicts.push({
      field: "never_contact",
      surviving_value: surviving.never_contact,
      absorbed_value: absorbed.never_contact,
      resolution: "ratcheted_safer",
      note: "once TRUE, stays TRUE",
    });
  }
  if ((surviving.unsubscribe_at ?? null) !== (absorbed.unsubscribe_at ?? null)) {
    conflicts.push({
      field: "unsubscribe_at",
      surviving_value: surviving.unsubscribe_at,
      absorbed_value: absorbed.unsubscribe_at,
      resolution: "ratcheted_safer",
      note: "earliest set wins · never cleared",
    });
  }

  // Identity · surviving usually wins unless it's null and absorbed has a value
  const pickWithConflict = (field: string, sVal: unknown, aVal: unknown): unknown => {
    if (sVal !== null && sVal !== undefined && sVal !== "") {
      if (aVal !== null && aVal !== undefined && aVal !== "" && String(sVal) !== String(aVal)) {
        conflicts.push({ field, surviving_value: sVal, absorbed_value: aVal, resolution: "surviving_wins" });
      }
      return sVal;
    }
    if (aVal !== null && aVal !== undefined && aVal !== "") {
      conflicts.push({ field, surviving_value: sVal, absorbed_value: aVal, resolution: "absorbed_wins" });
      return aVal;
    }
    return sVal ?? aVal ?? null;
  };

  const name = pickWithConflict("name", surviving.name, absorbed.name);
  const company = pickWithConflict("company", surviving.company, absorbed.company);
  const email = pickWithConflict("email", surviving.email, absorbed.email);
  const canonical_email = pickWithConflict("canonical_email", surviving.canonical_email, absorbed.canonical_email);
  const phone = pickWithConflict("phone", surviving.phone, absorbed.phone);
  const canonical_phone = pickWithConflict("canonical_phone", surviving.canonical_phone, absorbed.canonical_phone);
  const country = pickWithConflict("country", surviving.country, absorbed.country);
  const region = pickWithConflict("region", surviving.region, absorbed.region);
  const lifecycle_stage = pickWithConflict("lifecycle_stage", surviving.lifecycle_stage, absorbed.lifecycle_stage);
  const consent_source = pickWithConflict("consent_source", surviving.consent_source, absorbed.consent_source);

  // Arrays · always union
  const tags = mergeArrays(surviving.tags, absorbed.tags);
  const trade_categories = mergeArrays(surviving.trade_categories, absorbed.trade_categories);
  const languages = mergeArrays(surviving.languages, absorbed.languages);
  const preferred_channels = mergeArrays(surviving.preferred_channels, absorbed.preferred_channels);
  if ((absorbed.tags?.length ?? 0) > 0 && JSON.stringify(surviving.tags) !== JSON.stringify(tags)) {
    conflicts.push({ field: "tags", surviving_value: surviving.tags, absorbed_value: absorbed.tags, resolution: "combined" });
  }

  // Attributes · deep merge (absorbed values fill gaps · surviving wins on collision)
  const attributes = { ...(absorbed.attributes ?? {}), ...(surviving.attributes ?? {}) };

  // Timestamps · preserve the earliest first-seen
  const first_seen_at = ((surviving.first_seen_at ?? "") < (absorbed.first_seen_at ?? "") ? surviving.first_seen_at : absorbed.first_seen_at) ?? surviving.first_seen_at ?? absorbed.first_seen_at;
  const last_seen_at = ((surviving.last_seen_at ?? "") > (absorbed.last_seen_at ?? "") ? surviving.last_seen_at : absorbed.last_seen_at) ?? surviving.last_seen_at ?? absorbed.last_seen_at;
  const last_contacted_at = ((surviving.last_contacted_at ?? "") > (absorbed.last_contacted_at ?? "") ? surviving.last_contacted_at : absorbed.last_contacted_at) ?? surviving.last_contacted_at ?? absorbed.last_contacted_at;

  const linked_business_id = surviving.linked_business_id ?? absorbed.linked_business_id ?? null;
  const business_id = surviving.business_id ?? absorbed.business_id ?? null;

  const resulting: Contact = {
    contact_id: surviving.contact_id,
    name: (name as string | null) ?? null,
    company: (company as string | null) ?? null,
    email: (email as string | null) ?? null,
    canonical_email: (canonical_email as string | null) ?? null,
    phone: (phone as string | null) ?? null,
    canonical_phone: (canonical_phone as string | null) ?? null,
    country: (country as string | null) ?? null,
    region: (region as string | null) ?? null,
    languages,
    trade_categories,
    tags,
    kind: surviving.kind ?? absorbed.kind ?? null,
    lifecycle_stage: (lifecycle_stage as string | null) ?? null,
    attributes,
    consent_marketing,
    consent_transactional,
    consent_source: (consent_source as string | null) ?? null,
    never_contact,
    unsubscribe_at,
    preferred_channels,
    first_seen_at,
    last_seen_at,
    last_contacted_at,
    updated_at: new Date().toISOString(),
    business_id,
    linked_business_id,
    source: surviving.source ?? absorbed.source ?? null,
    source_ref: surviving.source_ref ?? absorbed.source_ref ?? null,
    deleted_at: null,
  };

  return { resulting, conflicts };
}

export async function previewMerge(survivingId: string, absorbedId: string): Promise<MergePreview | { error: string }> {
  if (survivingId === absorbedId) return { error: "surviving and absorbed cannot be the same contact_id" };
  const result = await withClient(async (c) => {
    const surviving = await loadCanonicalSnapshot(c, survivingId);
    const absorbed = await loadCanonicalSnapshot(c, absorbedId);
    if (!surviving) return { error: `surviving contact ${survivingId} not found` };
    if (!absorbed) return { error: `absorbed contact ${absorbedId} not found` };
    if (surviving.deleted_at || absorbed.deleted_at) return { error: "cannot merge a contact that is already deleted / merged" };

    const { resulting, conflicts } = applyMergeRules(surviving, absorbed);
    const [sourcesRes, eventsRes] = await Promise.all([
      c.query(`SELECT COUNT(*)::int AS n FROM nex.contact_sources WHERE contact_id = $1`, [absorbedId]),
      c.query(`SELECT COUNT(*)::int AS n FROM nex.events WHERE related_contact = $1`, [absorbedId]),
    ]);
    const preview: MergePreview = {
      surviving_id: survivingId,
      absorbed_id: absorbedId,
      resulting,
      conflicts,
      source_rows_to_repoint: Number((sourcesRes.rows[0] as { n?: number })?.n ?? 0),
      events_to_repoint: Number((eventsRes.rows[0] as { n?: number })?.n ?? 0),
    };
    return preview;
  });
  return result ?? { error: "registry not reachable" };
}

// ── Execute merge ────────────────────────────────────────────────────

export type ExecuteMergeInput = {
  surviving_id: string;
  absorbed_id: string;
  decided_by?: string;
  rationale?: string;
  suggestion_id?: string;                 // optional · marks the suggestion decided if provided
};

export type ExecuteMergeResult =
  | { ok: true; merge_id: string; resulting: Contact; source_rows_repointed: number; events_repointed: number }
  | { ok: false; error: string };

export async function executeMerge(input: ExecuteMergeInput): Promise<ExecuteMergeResult> {
  const preview = await previewMerge(input.surviving_id, input.absorbed_id);
  if ("error" in preview) return { ok: false, error: preview.error };

  const result = await withClient(async (c) => {
    // Transaction bounds the entire merge · either all steps succeed or
    // none do. Postgres default isolation READ COMMITTED is sufficient.
    await c.query("BEGIN");
    try {
      const mergeId = randomUUID();
      const now = new Date().toISOString();

      // 1. Insert merge audit row
      await c.query(
        `INSERT INTO nex.contact_merges
           (merge_id, surviving_contact_id, absorbed_contact_id, decided_by, decided_at, rationale, match_signals)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
        [mergeId, input.surviving_id, input.absorbed_id, input.decided_by ?? null, now, input.rationale ?? null,
         JSON.stringify({ preview_conflicts: preview.conflicts.map((x) => x.field) })],
      );

      // 2. Repoint source rows
      const srcRes = await c.query(
        `UPDATE nex.contact_sources SET contact_id = $1 WHERE contact_id = $2`,
        [input.surviving_id, input.absorbed_id],
      );

      // 3. Repoint events
      const evRes = await c.query(
        `UPDATE nex.events SET related_contact = $1 WHERE related_contact = $2`,
        [input.surviving_id, input.absorbed_id],
      );

      // 4. Append merged snapshot to surviving contact (new canonical state)
      const s = preview.resulting;
      await c.query(
        `INSERT INTO nex.contacts (
           contact_id, email, canonical_email, phone, canonical_phone, name, company,
           country, region, languages, trade_categories, tags, kind, source, source_ref,
           consent_marketing, consent_transactional, consent_source, attributes,
           lifecycle_stage, first_seen_at, last_seen_at, last_contacted_at,
           linked_business_id, updated_at, business_id,
           never_contact, unsubscribe_at, preferred_channels, deleted_at
         )
         VALUES (
           $1, $2, $3, $4, $5, $6, $7,
           $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13, $14, $15,
           $16, $17, $18, $19::jsonb,
           $20, $21, $22, $23,
           $24, $25, $26,
           $27, $28, $29::jsonb, NULL
         )`,
        [
          s.contact_id, s.email, s.canonical_email, s.phone, s.canonical_phone, s.name, s.company,
          s.country, s.region, JSON.stringify(s.languages ?? []), JSON.stringify(s.trade_categories ?? []),
          JSON.stringify(s.tags ?? []), s.kind, s.source, s.source_ref,
          s.consent_marketing, s.consent_transactional, s.consent_source, JSON.stringify(s.attributes ?? {}),
          s.lifecycle_stage, s.first_seen_at, s.last_seen_at, s.last_contacted_at,
          s.linked_business_id, s.updated_at, s.business_id,
          s.never_contact, s.unsubscribe_at, JSON.stringify(s.preferred_channels ?? []),
        ],
      );

      // 5. Insert tombstone snapshot for absorbed contact (still queryable
      //    for detail views · never returned as canonical)
      await c.query(
        `INSERT INTO nex.contacts (
           contact_id, name, source, source_ref, updated_at, deleted_at,
           attributes
         )
         VALUES ($1, $2, 'merge', $3, $4, $4, $5::jsonb)`,
        [input.absorbed_id, `merged into ${input.surviving_id}`, mergeId, now,
         JSON.stringify({ merged_into: input.surviving_id, merge_id: mergeId, merged_at: now, merged_by: input.decided_by ?? null })],
      );

      // 6. If a suggestion prompted this merge, mark it decided
      if (input.suggestion_id) {
        await c.query(
          `UPDATE nex.contact_duplicate_suggestions
           SET decision = 'merge', decided_at = $1, decided_by = $2, merge_id = $3
           WHERE suggestion_id = $4`,
          [now, input.decided_by ?? null, mergeId, input.suggestion_id],
        );
      }
      // Any OTHER suggestions that reference the absorbed contact should
      // also be resolved (that contact no longer exists as canonical).
      await c.query(
        `UPDATE nex.contact_duplicate_suggestions
         SET decision = 'merge', decided_at = $1, decided_by = $2, merge_id = $3
         WHERE (contact_a = $4 OR contact_b = $4) AND decision IS NULL
           AND suggestion_id != COALESCE($5, '00000000-0000-0000-0000-000000000000')`,
        [now, input.decided_by ?? null, mergeId, input.absorbed_id, input.suggestion_id ?? null],
      );

      await c.query("COMMIT");
      return {
        ok: true as const,
        merge_id: mergeId,
        resulting: preview.resulting,
        source_rows_repointed: srcRes.rowCount ?? 0,
        events_repointed: evRes.rowCount ?? 0,
      };
    } catch (err) {
      await c.query("ROLLBACK");
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });

  return result ?? { ok: false, error: "registry not reachable" };
}

// ── Decide (keep separate) ───────────────────────────────────────────

export async function decideKeepSeparate(suggestionId: string, decidedBy: string | undefined): Promise<{ ok: boolean; error?: string }> {
  const result = await withClient(async (c) => {
    const r = await c.query(
      `UPDATE nex.contact_duplicate_suggestions
       SET decision = 'keep_separate', decided_at = NOW(), decided_by = $1
       WHERE suggestion_id = $2 AND (decision IS NULL OR decision = 'pending')
       RETURNING suggestion_id`,
      [decidedBy ?? null, suggestionId],
    );
    return { ok: (r.rowCount ?? 0) > 0 };
  });
  return result ?? { ok: false, error: "registry not reachable" };
}

// ── Merge stats for the Mission Control section ──────────────────────

export type MergeStats = {
  pending_duplicates: number;
  high_confidence: number;                // confidence >= 90
  merges_today: number;
  merges_all_time: number;
  average_confidence_pending: number | null;
  by_kind_pending: Record<string, number>;
};

export async function getMergeStats(): Promise<MergeStats> {
  const empty: MergeStats = { pending_duplicates: 0, high_confidence: 0, merges_today: 0, merges_all_time: 0, average_confidence_pending: null, by_kind_pending: {} };
  const result = await withClient(async (c) => {
    const [pending, high, todayMerges, allMerges, byKind, avg] = await Promise.all([
      c.query(`SELECT COUNT(*)::int AS n FROM nex.contact_duplicate_suggestions WHERE decision IS NULL OR decision = 'pending'`),
      c.query(`SELECT COUNT(*)::int AS n FROM nex.contact_duplicate_suggestions WHERE (decision IS NULL OR decision = 'pending') AND confidence >= 90`),
      c.query(`SELECT COUNT(*)::int AS n FROM nex.contact_merges WHERE reversed_at IS NULL AND decided_at >= date_trunc('day', NOW())`),
      c.query(`SELECT COUNT(*)::int AS n FROM nex.contact_merges WHERE reversed_at IS NULL`),
      c.query(`SELECT match_kind, COUNT(*)::int AS n FROM nex.contact_duplicate_suggestions WHERE decision IS NULL OR decision = 'pending' GROUP BY match_kind`),
      c.query(`SELECT AVG(confidence)::numeric(6,2) AS avg FROM nex.contact_duplicate_suggestions WHERE decision IS NULL OR decision = 'pending'`),
    ]);
    return {
      pending_duplicates: Number((pending.rows[0] as { n?: number })?.n ?? 0),
      high_confidence: Number((high.rows[0] as { n?: number })?.n ?? 0),
      merges_today: Number((todayMerges.rows[0] as { n?: number })?.n ?? 0),
      merges_all_time: Number((allMerges.rows[0] as { n?: number })?.n ?? 0),
      average_confidence_pending: (avg.rows[0] as { avg?: number | string })?.avg != null ? Number((avg.rows[0] as { avg: number | string }).avg) : null,
      by_kind_pending: Object.fromEntries(byKind.rows.map((r) => [String(r.match_kind), Number(r.n)])),
    };
  });
  return result ?? empty;
}
