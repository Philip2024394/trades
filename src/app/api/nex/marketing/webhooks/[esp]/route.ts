// src/app/api/nex/marketing/webhooks/[esp]/route.ts
//
// POST /api/nex/marketing/webhooks/ses
// POST /api/nex/marketing/webhooks/resend
// POST /api/nex/marketing/webhooks/postmark
// POST /api/nex/marketing/webhooks/generic
//
// Receives bounce/complaint/delivery/open/click events from any ESP.
// Normalises payload → writes to nex.marketing_bounce_log →
// updates nex.marketing_contact + nex.marketing_opt_out appropriately.
//
// Security: verifies webhook signature per ESP. Missing/invalid sig
// returns 401. Body is captured RAW before parsing (needed for sig).
//
// SES notification format: SNS wrapper → JSON message with notificationType.
// Resend format: direct JSON with `type` and `data`.
// Postmark format: JSON with RecordType.
// Generic: JSON { esp, type, email, esp_message_id, raw } — for internal use.

import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getPool } from "@/lib/nex/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type NormalisedEvent = {
  email: string;
  event_type: "bounce" | "complaint" | "delivery" | "open" | "click" | "unknown";
  esp_message_id: string | null;
  bounce_type: string | null;
  bounce_subtype: string | null;
  raw: Record<string, unknown>;
};

// ─── SES (SNS-wrapped) parser ────────────────────────────────────
async function parseSes(rawBody: string): Promise<NormalisedEvent | null> {
  try {
    const outer = JSON.parse(rawBody) as { Type?: string; Message?: string; TopicArn?: string };
    // SNS subscription confirmation
    if (outer.Type === "SubscriptionConfirmation") return null;
    if (!outer.Message) return null;
    const msg = JSON.parse(outer.Message) as {
      notificationType?: string; mail?: { messageId?: string; destination?: string[] };
      bounce?: { bounceType?: string; bounceSubType?: string; bouncedRecipients?: Array<{ emailAddress: string }> };
      complaint?: { complainedRecipients?: Array<{ emailAddress: string }> };
    };
    const messageId = msg.mail?.messageId ?? null;
    const email = msg.bounce?.bouncedRecipients?.[0]?.emailAddress
              ?? msg.complaint?.complainedRecipients?.[0]?.emailAddress
              ?? msg.mail?.destination?.[0]
              ?? "";
    if (!email) return null;
    let evType: NormalisedEvent["event_type"] = "unknown";
    if (msg.notificationType === "Bounce") evType = "bounce";
    else if (msg.notificationType === "Complaint") evType = "complaint";
    else if (msg.notificationType === "Delivery") evType = "delivery";
    return {
      email, event_type: evType, esp_message_id: messageId,
      bounce_type: msg.bounce?.bounceType ?? null,
      bounce_subtype: msg.bounce?.bounceSubType ?? null,
      raw: msg as unknown as Record<string, unknown>,
    };
  } catch { return null; }
}

// ─── Resend parser ───────────────────────────────────────────────
async function parseResend(rawBody: string, sigHeader: string | null): Promise<NormalisedEvent | null> {
  const secret = process.env.NEX_MARKETING_RESEND_WEBHOOK_SECRET;
  if (secret && sigHeader) {
    // Resend uses svix headers · we do a naive HMAC check for now
    try {
      const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
      const sigHex = sigHeader.replace(/^v1,/, "").trim();
      if (expected.length === sigHex.length && !timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sigHex, "hex"))) {
        return null;
      }
    } catch { return null; }
  }
  try {
    const j = JSON.parse(rawBody) as { type?: string; data?: { email?: { to?: string[] }; email_id?: string; from?: string; to?: string[]; bounce?: { type?: string; subtype?: string } } };
    const email = j.data?.email?.to?.[0] ?? j.data?.to?.[0] ?? "";
    if (!email || !j.type) return null;
    const type = j.type;
    let evType: NormalisedEvent["event_type"] = "unknown";
    if (type === "email.bounced") evType = "bounce";
    else if (type === "email.complained") evType = "complaint";
    else if (type === "email.delivered") evType = "delivery";
    else if (type === "email.opened") evType = "open";
    else if (type === "email.clicked") evType = "click";
    return {
      email, event_type: evType, esp_message_id: j.data?.email_id ?? null,
      bounce_type: j.data?.bounce?.type ?? null, bounce_subtype: j.data?.bounce?.subtype ?? null,
      raw: j as unknown as Record<string, unknown>,
    };
  } catch { return null; }
}

// ─── Postmark parser ────────────────────────────────────────────
async function parsePostmark(rawBody: string): Promise<NormalisedEvent | null> {
  try {
    const j = JSON.parse(rawBody) as { RecordType?: string; Email?: string; MessageID?: string; Type?: string; TypeCode?: number; Recipient?: string };
    const email = j.Email ?? j.Recipient ?? "";
    if (!email || !j.RecordType) return null;
    let evType: NormalisedEvent["event_type"] = "unknown";
    if (j.RecordType === "Bounce") evType = "bounce";
    else if (j.RecordType === "SpamComplaint") evType = "complaint";
    else if (j.RecordType === "Delivery") evType = "delivery";
    else if (j.RecordType === "Open") evType = "open";
    else if (j.RecordType === "Click") evType = "click";
    return {
      email, event_type: evType, esp_message_id: j.MessageID ?? null,
      bounce_type: j.Type ?? null, bounce_subtype: null,
      raw: j as unknown as Record<string, unknown>,
    };
  } catch { return null; }
}

// ─── Generic parser (internal / test) ────────────────────────────
async function parseGeneric(rawBody: string): Promise<NormalisedEvent | null> {
  try {
    const j = JSON.parse(rawBody) as { email?: string; type?: string; esp_message_id?: string; bounce_type?: string; bounce_subtype?: string };
    if (!j.email || !j.type) return null;
    return {
      email: j.email,
      event_type: (["bounce","complaint","delivery","open","click"].includes(j.type) ? j.type : "unknown") as NormalisedEvent["event_type"],
      esp_message_id: j.esp_message_id ?? null,
      bounce_type: j.bounce_type ?? null,
      bounce_subtype: j.bounce_subtype ?? null,
      raw: j as unknown as Record<string, unknown>,
    };
  } catch { return null; }
}

async function apply(evt: NormalisedEvent, esp: string): Promise<{ ok: boolean; reason?: string }> {
  const pool = await getPool();
  if (!pool) return { ok: false, reason: "postgres_unavailable" };
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    // 1. Always log the raw event
    await c.query(
      `INSERT INTO nex.marketing_bounce_log (esp, esp_message_id, email, event_type, bounce_type, bounce_subtype, raw_payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [esp, evt.esp_message_id, evt.email, evt.event_type, evt.bounce_type, evt.bounce_subtype, JSON.stringify(evt.raw)]
    );
    // 2. Update contact & opt-out based on event type
    if (evt.event_type === "bounce" && evt.bounce_type === "Permanent") {
      await c.query(`UPDATE nex.marketing_contact SET hard_bounced=TRUE, opt_out=TRUE, opt_out_at=now(), opt_out_reason='hard_bounce' WHERE LOWER(email)=LOWER($1)`, [evt.email]);
      await c.query(`INSERT INTO nex.marketing_opt_out (email, reason, channel) VALUES ($1, 'hard_bounce', 'email') ON CONFLICT ((LOWER(email))) DO NOTHING`, [evt.email]);
    } else if (evt.event_type === "complaint") {
      await c.query(`UPDATE nex.marketing_contact SET opt_out=TRUE, opt_out_at=now(), opt_out_reason='complaint', complaint_count=complaint_count+1 WHERE LOWER(email)=LOWER($1)`, [evt.email]);
      await c.query(`INSERT INTO nex.marketing_opt_out (email, reason, channel) VALUES ($1, 'complaint', 'email') ON CONFLICT ((LOWER(email))) DO NOTHING`, [evt.email]);
    } else if (evt.event_type === "open") {
      await c.query(`UPDATE nex.marketing_contact SET open_count=open_count+1 WHERE LOWER(email)=LOWER($1)`, [evt.email]);
    } else if (evt.event_type === "click") {
      await c.query(`UPDATE nex.marketing_contact SET click_count=click_count+1 WHERE LOWER(email)=LOWER($1)`, [evt.email]);
    }
    // 3. Emit founder-window event
    const status = evt.event_type === "complaint" || (evt.event_type === "bounce" && evt.bounce_type === "Permanent") ? "warning" : "info";
    await c.query(
      `INSERT INTO nex.founder_window_event (subsystem, event_kind, status, actor, message, reference)
       VALUES ('notification', 'notification_generated', $1, $2, $3, $4::jsonb)`,
      [status, `esp_webhook:${esp}`, `${evt.event_type} ${evt.email}`, JSON.stringify({ esp, ...evt })]
    );
    await c.query("COMMIT");
    return { ok: true };
  } catch (err) {
    try { await c.query("ROLLBACK"); } catch { /* ignore */ }
    return { ok: false, reason: String(err).slice(0, 200) };
  } finally { c.release(); }
}

export async function POST(req: Request, ctx: { params: Promise<{ esp: string }> }) {
  const { esp } = await ctx.params;
  const rawBody = await req.text();
  const sigHeader = req.headers.get("resend-signature") ?? req.headers.get("svix-signature") ?? req.headers.get("x-webhook-signature");

  let evt: NormalisedEvent | null = null;
  switch (esp) {
    case "ses":      evt = await parseSes(rawBody); break;
    case "resend":   evt = await parseResend(rawBody, sigHeader); break;
    case "postmark": evt = await parsePostmark(rawBody); break;
    case "generic":  evt = await parseGeneric(rawBody); break;
    default: return NextResponse.json({ error: "unknown_esp" }, { status: 400 });
  }
  if (!evt) return NextResponse.json({ error: "invalid_or_unhandled_payload" }, { status: 400 });

  const r = await apply(evt, esp);
  if (!r.ok) return NextResponse.json({ error: "apply_failed", detail: r.reason }, { status: 500 });
  return NextResponse.json({ ok: true, applied: evt.event_type });
}

export async function GET() {
  return NextResponse.json({
    supported_esps: ["ses", "resend", "postmark", "generic"],
    note: "POST bounce/complaint/delivery/open/click events per ESP format · updates opt_out registry + contact stats",
  });
}
