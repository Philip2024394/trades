// POST /api/nex/founder/email-harvest/send-batch
//
// Founder Batch Outbound · real end-to-end send path.
//
// Doctrine:
//  - Founder-auth gated (same pattern as every other founder route).
//  - Reads recipients from nex.discovery_business_evidence (real DB rows only).
//  - Filters against nex.founder_email_suppression.
//  - Persists nex.founder_email_batch + nex.founder_email_recipient BEFORE
//    invoking SMTP · every attempt is auditable regardless of send result.
//  - Uses sendBatch from smtp-sender.ts · never fabricates delivery.
//  - Returns per-recipient status straight from the SMTP response.

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getPool } from "@/lib/nex/db";
import { resolveFounderAuth } from "@/lib/nex/marketing/founder";
import { sendBatch, resolveSmtpConfig, type Recipient } from "@/lib/nex/founder-outbound/smtp-sender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Body {
  subject: string;
  body_text: string;
  body_html?: string | null;
  filter?: {
    countries?: string[];             // ISO-2 filter · empty = all
    sources?: string[];               // source_slug filter · empty = all
    min_confidence?: number;          // e.g. 0.75 · null = all
    include_email_addresses?: string[]; // explicit list · overrides filter
    exclude_email_addresses?: string[];
    limit?: number;                   // safety cap · default 500
  } | null;
  dry_run?: boolean;                  // preview only · no persist · no send
}

export async function POST(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });

  let body: Body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const subject = (body.subject ?? "").trim();
  const body_text = (body.body_text ?? "").trim();
  const body_html = body.body_html?.trim() || null;
  const dry_run = body.dry_run === true;
  if (subject.length < 3) return NextResponse.json({ ok: false, error: "subject_too_short" }, { status: 400 });
  if (body_text.length < 10) return NextResponse.json({ ok: false, error: "body_too_short" }, { status: 400 });

  const filter = body.filter ?? {};
  const limit = Math.max(1, Math.min(500, Number(filter.limit ?? 500)));

  const client = await pool.connect();
  try {
    const serverNow = (await client.query(`SELECT now() AS n`)).rows[0].n.toISOString();
    const smtpResolution = resolveSmtpConfig();

    // ─── Resolve recipient set from real DB rows ───
    const wheres: string[] = [`e.discovered_email IS NOT NULL`];
    const params: any[] = [];
    if (filter.countries?.length) {
      params.push(filter.countries.map((c) => c.toUpperCase()));
      wheres.push(`e.iso_alpha_2 = ANY($${params.length}::text[])`);
    }
    if (filter.sources?.length) {
      params.push(filter.sources);
      wheres.push(`e.discovered_via_source = ANY($${params.length}::text[])`);
    }
    if (typeof filter.min_confidence === "number") {
      params.push(filter.min_confidence);
      wheres.push(`e.email_extraction_confidence >= $${params.length}`);
    }
    if (filter.include_email_addresses?.length) {
      params.push(filter.include_email_addresses.map((s) => s.toLowerCase()));
      wheres.push(`LOWER(e.discovered_email) = ANY($${params.length}::text[])`);
    }
    if (filter.exclude_email_addresses?.length) {
      params.push(filter.exclude_email_addresses.map((s) => s.toLowerCase()));
      wheres.push(`LOWER(e.discovered_email) <> ALL($${params.length}::text[])`);
    }

    // Distinct on email_address · keep row with highest confidence
    const candidateQuery = `
      SELECT DISTINCT ON (LOWER(e.discovered_email))
        e.evidence_id,
        LOWER(e.discovered_email) AS email_address,
        e.discovered_email AS original_email,
        e.business_name,
        e.iso_alpha_2 AS country_iso,
        e.email_extraction_confidence
      FROM nex.discovery_business_evidence e
      WHERE ${wheres.join(" AND ")}
      ORDER BY LOWER(e.discovered_email), e.email_extraction_confidence DESC NULLS LAST
      LIMIT ${limit}
    `;
    const candidates = await client.query(candidateQuery, params);

    // ─── Suppression filter · tolerant when audit schema not yet applied ───
    const emails = candidates.rows.map((r) => r.email_address);
    let suppressed: string[] = [];
    let suppression_available = true;
    if (emails.length > 0) {
      try {
        const sup = await client.query(
          `SELECT email_address FROM nex.founder_email_suppression WHERE email_address = ANY($1::text[])`,
          [emails],
        );
        suppressed = sup.rows.map((r) => r.email_address);
      } catch (e) {
        if (/does not exist/i.test((e as Error).message)) {
          suppression_available = false;
        } else throw e;
      }
    }
    const suppressedSet = new Set(suppressed);
    const acceptable = candidates.rows.filter((r) => !suppressedSet.has(r.email_address));

    if (dry_run) {
      return NextResponse.json({
        ok: true,
        server_now: serverNow,
        dry_run: true,
        smtp_configured: smtpResolution.configured,
        smtp_reason: smtpResolution.configured ? null : smtpResolution.reason,
        audit_schema_applied: suppression_available,
        subject_preview: subject,
        body_text_preview: body_text,
        body_html_preview: body_html,
        would_send_count: acceptable.length,
        candidates_count: candidates.rowCount,
        suppressed_count: suppressed.length,
        would_send: acceptable.slice(0, 25).map((r) => ({
          email_address: r.email_address,
          business_name: r.business_name,
          country_iso: r.country_iso,
          confidence: r.email_extraction_confidence,
        })),
      });
    }

    if (acceptable.length === 0) {
      return NextResponse.json({ ok: false, error: "no_recipients_after_filters", suppressed_count: suppressed.length });
    }

    // ─── Persist batch row (BEFORE SMTP · always auditable) ───
    const from_address = process.env.NEX_FOUNDER_SMTP_FROM ?? "unset";
    const from_name = process.env.NEX_FOUNDER_SMTP_FROM_NAME ?? null;
    const reply_to = process.env.NEX_FOUNDER_SMTP_REPLY_TO ?? null;
    const batchInsert = await client.query(
      `INSERT INTO nex.founder_email_batch
         (created_by, subject, body_text, body_html, from_address, from_name, reply_to, recipient_count, status, sent_started_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
       RETURNING batch_id, created_at::text`,
      [auth.actor, subject, body_text, body_html, from_address, from_name, reply_to, acceptable.length,
        smtpResolution.configured ? "sending" : "smtp_not_configured"],
    );
    const batchId: string = batchInsert.rows[0].batch_id;

    // Persist recipient rows + generate unsubscribe tokens
    const recipientsToSend: Recipient[] = [];
    for (const r of acceptable) {
      const unsub_token = randomBytes(24).toString("hex");
      const rec = await client.query(
        `INSERT INTO nex.founder_email_recipient
           (batch_id, email_address, business_name, country_iso, evidence_id, status, unsubscribe_token)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING recipient_id`,
        [batchId, r.email_address, r.business_name, r.country_iso, r.evidence_id,
          smtpResolution.configured ? "queued" : "smtp_not_configured", unsub_token],
      );
      recipientsToSend.push({
        recipient_id: rec.rows[0].recipient_id,
        email_address: r.email_address,
        unsubscribe_token: unsub_token,
      });
    }

    // Persist suppressed recipients honestly
    for (const r of candidates.rows.filter((r) => suppressedSet.has(r.email_address))) {
      await client.query(
        `INSERT INTO nex.founder_email_recipient
           (batch_id, email_address, business_name, country_iso, evidence_id, status)
         VALUES ($1,$2,$3,$4,$5,'suppressed')
         ON CONFLICT (batch_id, email_address) DO NOTHING`,
        [batchId, r.email_address, r.business_name, r.country_iso, r.evidence_id],
      );
    }

    // ─── Determine unsubscribe base URL from request origin ───
    const origin = new URL(req.url).origin;
    const unsubscribe_base_url = `${origin}/api/nex/unsubscribe`;

    // ─── Real send ───
    const outcome = await sendBatch({
      subject,
      body_text,
      body_html,
      unsubscribe_base_url,
      recipients: recipientsToSend,
    });

    // ─── Persist per-recipient results ───
    let sent_count = 0, failed_count = 0, not_configured_count = 0;
    for (const result of outcome.results) {
      await client.query(
        `UPDATE nex.founder_email_recipient
            SET status=$1, sent_at=$2, error_reason=$3, smtp_message_id=$4
          WHERE recipient_id=$5`,
        [result.status, result.sent_at, result.error_reason, result.smtp_message_id, result.recipient_id],
      );
      if (result.status === "sent") sent_count++;
      else if (result.status === "failed") failed_count++;
      else if (result.status === "smtp_not_configured") not_configured_count++;
    }

    // Update batch summary
    const finalStatus = !outcome.configured ? "smtp_not_configured"
      : failed_count === 0 ? "sent"
      : sent_count === 0 ? "failed"
      : "partial_sent";
    await client.query(
      `UPDATE nex.founder_email_batch
          SET status=$1, sent_completed_at=now(), smtp_host=$2, error_reason=$3
        WHERE batch_id=$4`,
      [finalStatus, outcome.smtp_host, outcome.reason ?? null, batchId],
    );

    return NextResponse.json({
      ok: true,
      batch_id: batchId,
      server_now: serverNow,
      smtp_configured: outcome.configured,
      smtp_host: outcome.smtp_host,
      smtp_reason: outcome.reason ?? null,
      status: finalStatus,
      sent_count,
      failed_count,
      not_configured_count,
      suppressed_count: suppressed.length,
      recipient_count: acceptable.length,
      results: outcome.results,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not exist/i.test(msg)) {
      return NextResponse.json({ ok: false, error: "schema_not_applied", detail: msg }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  } finally { client.release(); }
}
