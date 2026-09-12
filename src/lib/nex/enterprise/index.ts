// src/lib/nex/enterprise/index.ts
//
// Founder Phase 16 · Enterprise library.
//
// Every team-scoped mutation records an audit_event · SIEM export never
// synthesises data · rows come straight from the audit table.

import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";

export type TeamRole = "owner" | "admin" | "member";
export type TeamTier = "starter" | "pro" | "enterprise";

export interface TeamRow {
  team_id: string;
  slug: string;
  name: string;
  created_by: string;
  created_at: string;
  tier: TeamTier;
}

export interface TeamMemberRow {
  team_id: string;
  user_id: string;
  role: TeamRole;
  joined_at: string;
  invited_by: string | null;
}

export interface AuditEventRow {
  audit_event_id: string;
  team_id: string | null;
  actor_user_id: string | null;
  action: string;
  target: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════════
// Slug helper · deterministic, no fabrication
// ═══════════════════════════════════════════════════════════════════

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "team";
}

// ═══════════════════════════════════════════════════════════════════
// Teams
// ═══════════════════════════════════════════════════════════════════

export async function createTeam(args: {
  name: string;
  created_by: string;
  tier?: TeamTier;
}): Promise<TeamRow> {
  const pool = getKnowledgeFactoryDbPool();
  const base = slugify(args.name);
  // Uniqueness suffix if needed.
  let slug = base;
  for (let i = 0; i < 10; i++) {
    const exists = await pool.query(`SELECT 1 FROM nex.team WHERE slug = $1`, [slug]);
    if (exists.rowCount === 0) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  const r = await pool.query(
    `INSERT INTO nex.team (slug, name, created_by, tier)
     VALUES ($1,$2,$3,$4)
     RETURNING team_id::text, slug, name, created_by, created_at::text, tier`,
    [slug, args.name.slice(0, 120), args.created_by, args.tier ?? "starter"],
  );
  const team = r.rows[0] as unknown as TeamRow;
  // Creator auto-becomes owner.
  await pool.query(
    `INSERT INTO nex.team_member (team_id, user_id, role) VALUES ($1,$2,'owner')
     ON CONFLICT DO NOTHING`,
    [team.team_id, args.created_by],
  );
  await recordAuditEvent({
    team_id: team.team_id,
    actor_user_id: args.created_by,
    action: "team.create",
    target: team.team_id,
    meta: { slug, name: team.name, tier: team.tier },
  });
  return team;
}

export async function listTeamsForUser(user_id: string): Promise<Array<TeamRow & { role: TeamRole }>> {
  const pool = getKnowledgeFactoryDbPool();
  const r = await pool.query(
    `SELECT t.team_id::text, t.slug, t.name, t.created_by, t.created_at::text, t.tier, m.role
       FROM nex.team t
       JOIN nex.team_member m ON m.team_id = t.team_id
      WHERE m.user_id = $1 AND t.deleted_at IS NULL
      ORDER BY t.created_at DESC`,
    [user_id],
  );
  return r.rows as unknown as Array<TeamRow & { role: TeamRole }>;
}

export async function getTeamBySlug(slug: string): Promise<TeamRow | null> {
  const pool = getKnowledgeFactoryDbPool();
  const r = await pool.query(
    `SELECT team_id::text, slug, name, created_by, created_at::text, tier
       FROM nex.team WHERE slug = $1 AND deleted_at IS NULL`,
    [slug],
  );
  return (r.rows[0] as unknown as TeamRow) ?? null;
}

export async function getRoleInTeam(team_id: string, user_id: string): Promise<TeamRole | null> {
  const pool = getKnowledgeFactoryDbPool();
  const r = await pool.query(
    `SELECT role FROM nex.team_member WHERE team_id = $1 AND user_id = $2`,
    [team_id, user_id],
  );
  const row = r.rows[0] as { role?: TeamRole } | undefined;
  return row?.role ?? null;
}

// ═══════════════════════════════════════════════════════════════════
// Members
// ═══════════════════════════════════════════════════════════════════

export async function addMember(args: {
  team_id: string;
  actor_user_id: string;
  new_user_id: string;
  role: TeamRole;
}): Promise<{ ok: boolean; error?: string; row?: TeamMemberRow }> {
  const actorRole = await getRoleInTeam(args.team_id, args.actor_user_id);
  if (!actorRole || (actorRole !== "owner" && actorRole !== "admin")) {
    return { ok: false, error: "forbidden_actor_role" };
  }
  // Owners cannot be added by non-owners.
  if (args.role === "owner" && actorRole !== "owner") {
    return { ok: false, error: "only_owner_can_grant_owner" };
  }
  const pool = getKnowledgeFactoryDbPool();
  const r = await pool.query(
    `INSERT INTO nex.team_member (team_id, user_id, role, invited_by)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role
     RETURNING team_id::text, user_id, role, joined_at::text, invited_by`,
    [args.team_id, args.new_user_id, args.role, args.actor_user_id],
  );
  await recordAuditEvent({
    team_id: args.team_id,
    actor_user_id: args.actor_user_id,
    action: "member.add",
    target: args.new_user_id,
    meta: { role: args.role },
  });
  return { ok: true, row: r.rows[0] as unknown as TeamMemberRow };
}

export async function removeMember(args: {
  team_id: string;
  actor_user_id: string;
  target_user_id: string;
}): Promise<{ ok: boolean; error?: string }> {
  const actorRole = await getRoleInTeam(args.team_id, args.actor_user_id);
  if (!actorRole || (actorRole !== "owner" && actorRole !== "admin")) {
    return { ok: false, error: "forbidden_actor_role" };
  }
  const pool = getKnowledgeFactoryDbPool();
  // Can't remove the last owner.
  const targetRole = await getRoleInTeam(args.team_id, args.target_user_id);
  if (targetRole === "owner") {
    const ownersR = await pool.query(
      `SELECT count(*)::int AS n FROM nex.team_member WHERE team_id = $1 AND role = 'owner'`,
      [args.team_id],
    );
    const n = Number((ownersR.rows[0] as { n: number }).n ?? 0);
    if (n <= 1) return { ok: false, error: "cannot_remove_last_owner" };
    if (actorRole !== "owner") return { ok: false, error: "only_owner_can_remove_owner" };
  }
  const r = await pool.query(
    `DELETE FROM nex.team_member WHERE team_id = $1 AND user_id = $2`,
    [args.team_id, args.target_user_id],
  );
  if ((r.rowCount ?? 0) === 0) return { ok: false, error: "member_not_found" };
  await recordAuditEvent({
    team_id: args.team_id,
    actor_user_id: args.actor_user_id,
    action: "member.remove",
    target: args.target_user_id,
  });
  return { ok: true };
}

export async function listMembers(team_id: string): Promise<TeamMemberRow[]> {
  const pool = getKnowledgeFactoryDbPool();
  const r = await pool.query(
    `SELECT team_id::text, user_id, role, joined_at::text, invited_by
       FROM nex.team_member WHERE team_id = $1 ORDER BY joined_at ASC`,
    [team_id],
  );
  return r.rows as unknown as TeamMemberRow[];
}

// ═══════════════════════════════════════════════════════════════════
// Audit
// ═══════════════════════════════════════════════════════════════════

export async function recordAuditEvent(args: {
  team_id: string | null;
  actor_user_id: string | null;
  action: string;
  target?: string | null;
  meta?: Record<string, unknown>;
  ip_hash_16?: string | null;
}): Promise<void> {
  try {
    const pool = getKnowledgeFactoryDbPool();
    await pool.query(
      `INSERT INTO nex.audit_event (team_id, actor_user_id, action, target, meta, ip_hash_16)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [args.team_id, args.actor_user_id, args.action.slice(0, 80),
       args.target ?? null, args.meta ? JSON.stringify(args.meta) : null,
       args.ip_hash_16 ?? null],
    );
  } catch { /* audit is best-effort · never blocks the request */ }
}

export async function listAuditEvents(team_id: string, limit = 200): Promise<AuditEventRow[]> {
  const pool = getKnowledgeFactoryDbPool();
  const r = await pool.query(
    `SELECT audit_event_id::text, team_id::text, actor_user_id, action, target,
            meta, created_at::text
       FROM nex.audit_event
      WHERE team_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [team_id, Math.max(1, Math.min(10_000, limit))],
  );
  return r.rows as unknown as AuditEventRow[];
}

/**
 * Iterates every audit event for a team in ascending time order.
 * Streams in batches so we don't hold the entire result set in memory.
 */
export async function* iterAuditEventsAsc(team_id: string, batch = 1000): AsyncGenerator<AuditEventRow, void, void> {
  const pool = getKnowledgeFactoryDbPool();
  let last = "1970-01-01T00:00:00Z";
  for (;;) {
    const r = await pool.query(
      `SELECT audit_event_id::text, team_id::text, actor_user_id, action, target,
              meta, created_at::text
         FROM nex.audit_event
        WHERE team_id = $1 AND created_at > $2::timestamptz
        ORDER BY created_at ASC
        LIMIT $3`,
      [team_id, last, batch],
    );
    if (r.rowCount === 0) return;
    for (const row of r.rows as unknown as AuditEventRow[]) {
      yield row;
      last = row.created_at;
    }
    if ((r.rowCount ?? 0) < batch) return;
  }
}
