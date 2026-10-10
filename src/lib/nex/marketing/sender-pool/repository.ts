// src/lib/nex/marketing/sender-pool/repository.ts
//
// NEX Managed Email Marketing · Stage 2 · Postgres persistence
// Founder-authorised programme.
//
// Canonical read/write layer for the sender pool. All mutations record
// an audit event (Clauses 4/9/10 auditability + traceability).
// Concurrency-safe via row-level locks where needed.

import type { PoolClient } from "pg";
import type {
  SenderIdentity,
  SenderAuditEvent,
  SenderAuditEventKind,
  HealthState,
  Lane,
  Provider,
  AuthenticationState,
  VerificationState,
} from "./types";
import { assertValidHealthTransition, deriveHealth, type DeriveHealthInputs } from "./health";

// ─── Row → SenderIdentity mapping ──────────────────────────────────
function rowToIdentity(row: any): SenderIdentity {
  return {
    sender_id: row.sender_id,
    member_id: row.member_id,
    lane: row.lane,
    email: row.email,
    display_name: row.display_name,
    reply_to: row.reply_to,
    sending_domain: row.sending_domain,
    provider: row.provider,
    provider_account_ref: row.provider_account_ref,
    authentication_state: row.authentication_state,
    verification_state: row.verification_state,
    authentication_expires_at: row.authentication_expires_at,
    daily_capacity: row.daily_capacity,
    hourly_capacity: row.hourly_capacity,
    capacity_source: row.capacity_source,
    capacity_verified_at: row.capacity_verified_at,
    health_state: row.health_state,
    paused_reason: row.paused_reason,
    last_send_at: row.last_send_at,
    last_event_at: row.last_event_at,
    last_failure_at: row.last_failure_at,
    last_failure_reason: row.last_failure_reason,
    bounce_rate: row.bounce_rate == null ? null : Number(row.bounce_rate),
    complaint_rate: row.complaint_rate == null ? null : Number(row.complaint_rate),
    authorised_at: row.authorised_at,
    authorised_by: row.authorised_by,
    provenance: row.provenance ?? {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ─── Load senders eligible for a lane (selection input) ─────────────
export async function loadCandidatesForLane(
  client: PoolClient,
  lane: Lane,
  member_id: string | null,
): Promise<ReadonlyArray<SenderIdentity>> {
  let sql: string;
  let params: unknown[];
  if (lane === "member") {
    sql = `SELECT * FROM nex.marketing_sender_identity WHERE lane='member' AND member_id=$1`;
    params = [member_id];
  } else {
    sql = `SELECT * FROM nex.marketing_sender_identity WHERE lane=$1 AND member_id IS NULL`;
    params = [lane];
  }
  const res = await client.query(sql, params);
  return res.rows.map(rowToIdentity);
}

// ─── Load one sender by id ─────────────────────────────────────────
export async function loadSenderById(client: PoolClient, sender_id: string): Promise<SenderIdentity | null> {
  const res = await client.query(`SELECT * FROM nex.marketing_sender_identity WHERE sender_id=$1`, [sender_id]);
  if (res.rows.length === 0) return null;
  return rowToIdentity(res.rows[0]);
}

// ─── Create sender ─────────────────────────────────────────────────
export interface CreateSenderInput {
  readonly member_id: string | null;
  readonly lane: Lane;
  readonly email: string;
  readonly display_name?: string;
  readonly reply_to?: string;
  readonly sending_domain?: string;
  readonly provider: Provider;
  readonly provider_account_ref?: string;
  readonly daily_capacity?: number;
  readonly hourly_capacity?: number;
  readonly capacity_source?: string;
  readonly authorised_by: string;
  readonly provenance?: Readonly<Record<string, unknown>>;
}

export async function createSender(
  client: PoolClient,
  input: CreateSenderInput,
): Promise<SenderIdentity> {
  const res = await client.query(
    `INSERT INTO nex.marketing_sender_identity
       (member_id, lane, email, display_name, reply_to, sending_domain,
        provider, provider_account_ref,
        daily_capacity, hourly_capacity, capacity_source, capacity_verified_at,
        authorised_at, authorised_by, provenance)
     VALUES ($1, $2, LOWER($3), $4, $5, $6, $7, $8, $9, $10, $11, now(), now(), $12, $13::jsonb)
     RETURNING *`,
    [
      input.member_id,
      input.lane,
      input.email,
      input.display_name ?? null,
      input.reply_to ?? null,
      input.sending_domain ?? null,
      input.provider,
      input.provider_account_ref ?? null,
      input.daily_capacity ?? null,
      input.hourly_capacity ?? null,
      input.capacity_source ?? null,
      input.authorised_by,
      JSON.stringify(input.provenance ?? {}),
    ],
  );
  const sender = rowToIdentity(res.rows[0]);
  await appendAudit(client, sender.sender_id, "created", null, {
    lane: sender.lane, member_id: sender.member_id, email: sender.email, provider: sender.provider,
  }, input.authorised_by, {});
  return sender;
}

// ─── Update authentication state ───────────────────────────────────
export async function setAuthenticationState(
  client: PoolClient,
  sender_id: string,
  state: AuthenticationState,
  actor: string,
  detail: Record<string, unknown> = {},
): Promise<SenderIdentity> {
  const before = await loadSenderById(client, sender_id);
  if (!before) throw new Error(`sender ${sender_id} not found`);
  const res = await client.query(
    `UPDATE nex.marketing_sender_identity
        SET authentication_state=$1, updated_at=now()
      WHERE sender_id=$2 RETURNING *`,
    [state, sender_id],
  );
  const after = rowToIdentity(res.rows[0]);
  await appendAudit(client, sender_id, "authentication_changed",
    { authentication_state: before.authentication_state },
    { authentication_state: after.authentication_state },
    actor, detail);
  return after;
}

// ─── Update verification state ─────────────────────────────────────
export async function setVerificationState(
  client: PoolClient,
  sender_id: string,
  state: VerificationState,
  actor: string,
  detail: Record<string, unknown> = {},
): Promise<SenderIdentity> {
  const before = await loadSenderById(client, sender_id);
  if (!before) throw new Error(`sender ${sender_id} not found`);
  const res = await client.query(
    `UPDATE nex.marketing_sender_identity
        SET verification_state=$1, updated_at=now()
      WHERE sender_id=$2 RETURNING *`,
    [state, sender_id],
  );
  const after = rowToIdentity(res.rows[0]);
  await appendAudit(client, sender_id, "verification_completed",
    { verification_state: before.verification_state },
    { verification_state: after.verification_state },
    actor, detail);
  return after;
}

// ─── Update health state (validated) ───────────────────────────────
export async function setHealthState(
  client: PoolClient,
  sender_id: string,
  to_state: HealthState,
  actor: string,
  reason: string,
  paused_reason?: string,
): Promise<SenderIdentity> {
  const before = await loadSenderById(client, sender_id);
  if (!before) throw new Error(`sender ${sender_id} not found`);
  assertValidHealthTransition(before.health_state, to_state);
  const res = await client.query(
    `UPDATE nex.marketing_sender_identity
        SET health_state=$1, paused_reason=$2, updated_at=now()
      WHERE sender_id=$3 RETURNING *`,
    [to_state, paused_reason ?? null, sender_id],
  );
  const after = rowToIdentity(res.rows[0]);
  const event_type: SenderAuditEventKind =
    to_state === "paused" ? "paused" :
    to_state === "disabled" ? "disabled" :
    to_state === "provider_blocked" ? "blocked" :
    to_state === "reputation_protection" ? "reputation_protection_activated" :
    before.health_state === "reputation_protection" && to_state === "healthy" ? "reputation_protection_cleared" :
    before.health_state === "paused" && to_state === "healthy" ? "resumed" :
    "health_changed";
  await appendAudit(client, sender_id, event_type,
    { health_state: before.health_state },
    { health_state: after.health_state },
    actor, { reason });
  return after;
}

// ─── Update capacity ───────────────────────────────────────────────
export async function setCapacity(
  client: PoolClient,
  sender_id: string,
  input: { daily_capacity?: number | null; hourly_capacity?: number | null; capacity_source: string },
  actor: string,
): Promise<SenderIdentity> {
  const before = await loadSenderById(client, sender_id);
  if (!before) throw new Error(`sender ${sender_id} not found`);
  const res = await client.query(
    `UPDATE nex.marketing_sender_identity
        SET daily_capacity=$1, hourly_capacity=$2, capacity_source=$3, capacity_verified_at=now(), updated_at=now()
      WHERE sender_id=$4 RETURNING *`,
    [
      input.daily_capacity === undefined ? before.daily_capacity : input.daily_capacity,
      input.hourly_capacity === undefined ? before.hourly_capacity : input.hourly_capacity,
      input.capacity_source,
      sender_id,
    ],
  );
  const after = rowToIdentity(res.rows[0]);
  await appendAudit(client, sender_id, "capacity_changed",
    { daily_capacity: before.daily_capacity, hourly_capacity: before.hourly_capacity, capacity_source: before.capacity_source },
    { daily_capacity: after.daily_capacity, hourly_capacity: after.hourly_capacity, capacity_source: after.capacity_source },
    actor, {});
  return after;
}

// ─── Attribute a completed send (increments observability signals) ─
export async function attributeSend(
  client: PoolClient,
  sender_id: string,
  detail: { campaign_id?: string; contact_id?: string; provider_message_id?: string; actor: string },
): Promise<void> {
  await client.query(
    `UPDATE nex.marketing_sender_identity
        SET last_send_at=now(), last_event_at=now(), updated_at=now()
      WHERE sender_id=$1`,
    [sender_id],
  );
  await appendAudit(client, sender_id, "send_attributed", null,
    { campaign_id: detail.campaign_id, contact_id: detail.contact_id, provider_message_id: detail.provider_message_id },
    detail.actor, {});
}

// ─── Audit append ──────────────────────────────────────────────────
export async function appendAudit(
  client: PoolClient,
  sender_id: string,
  event_type: SenderAuditEventKind,
  from_state: Record<string, unknown> | null,
  to_state: Record<string, unknown> | null,
  actor: string,
  detail: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `INSERT INTO nex.marketing_sender_audit (sender_id, event_type, from_state, to_state, actor, detail)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6::jsonb)`,
    [
      sender_id,
      event_type,
      from_state ? JSON.stringify(from_state) : null,
      to_state ? JSON.stringify(to_state) : null,
      actor,
      JSON.stringify(detail),
    ],
  );
}

// ─── Load audit history for a sender ───────────────────────────────
export async function loadAuditHistory(
  client: PoolClient,
  sender_id: string,
  limit: number = 100,
): Promise<ReadonlyArray<SenderAuditEvent>> {
  const res = await client.query(
    `SELECT audit_id, sender_id, event_type, from_state, to_state, actor, detail, at_iso
       FROM nex.marketing_sender_audit
      WHERE sender_id=$1 ORDER BY at_iso DESC LIMIT $2`,
    [sender_id, limit],
  );
  return res.rows.map((r: any) => ({
    audit_id: r.audit_id,
    sender_id: r.sender_id,
    event_type: r.event_type,
    from_state: r.from_state,
    to_state: r.to_state,
    actor: r.actor,
    detail: r.detail ?? {},
    at_iso: r.at_iso,
  }));
}

// ─── Health-engine tick · derive-and-transition based on signals ───
export async function tickHealthDerivation(
  client: PoolClient,
  sender_id: string,
  usage_ratios: { hourly_used_ratio: number | null; daily_used_ratio: number | null },
  actor: string = "system:health-engine",
): Promise<SenderIdentity> {
  const sender = await loadSenderById(client, sender_id);
  if (!sender) throw new Error(`sender ${sender_id} not found`);

  const inputs: DeriveHealthInputs = {
    current_state: sender.health_state,
    authentication_state: sender.authentication_state,
    bounce_rate: sender.bounce_rate,
    complaint_rate: sender.complaint_rate,
    hourly_used_ratio: usage_ratios.hourly_used_ratio,
    daily_used_ratio: usage_ratios.daily_used_ratio,
    provider_blocked: sender.health_state === "provider_blocked",
    admin_paused: sender.health_state === "paused",
  };

  const derived = deriveHealth(inputs);
  if (derived.proposed_state === sender.health_state) return sender;

  // Only transition if valid · else log and leave alone
  try {
    assertValidHealthTransition(sender.health_state, derived.proposed_state);
    return await setHealthState(client, sender_id, derived.proposed_state, actor, derived.reason);
  } catch {
    // Illegal transition · record but don't crash
    await appendAudit(client, sender_id, "health_changed",
      { health_state: sender.health_state },
      { health_state: sender.health_state, proposed_but_refused: derived.proposed_state },
      actor, { reason: derived.reason, refused: "invalid_transition" });
    return sender;
  }
}
