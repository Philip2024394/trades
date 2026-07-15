// POST /api/support/tickets — public report / support / DMCA endpoint
//
// One endpoint for every ticket-creating surface:
//  • /support/ticket general form
//  • /legal/takedown DMCA form
//  • Flag button on Site Interest cards / canteen posts / images
//
// Accepts multipart/form-data with fields + optional attachments.
// Rate-limited by IP. Auto-hides content on CSAM/sexual reports via
// supportTickets.insertTicket().

import { NextResponse } from "next/server";
import {
  insertTicket,
  isTicketRateLimited,
  TICKET_MAX_ATTACHMENTS,
  uploadTicketAttachment,
  validateTicketInput,
  type TicketKind,
  type TicketTargetKind
} from "@/lib/supportTickets";
import { getMerchantIdentity } from "@/lib/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  return null;
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return NextResponse.json({ ok: false, error: "invalid-content-type" }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-multipart" }, { status: 400 });
  }

  const kind             = String(form.get("kind") ?? "").trim();
  const reporterName     = String(form.get("reporterName") ?? "").trim();
  const reporterEmail    = String(form.get("reporterEmail") ?? "").trim();
  const reporterPhone    = String(form.get("reporterPhone") ?? "").trim() || null;
  const subject          = String(form.get("subject") ?? "").trim();
  const description      = String(form.get("description") ?? "").trim();
  const targetKind       = String(form.get("targetKind") ?? "").trim() || null;
  const targetId         = String(form.get("targetId") ?? "").trim() || null;
  const targetUrl        = String(form.get("targetUrl") ?? "").trim() || null;
  const claimedOwnership = String(form.get("claimedOwnership") ?? "").trim() || null;
  const swornStatement   = form.get("swornStatement") === "true";
  const consented        = form.get("consented") === "true";

  const validationError = validateTicketInput({
    kind,
    reporterName,
    reporterEmail,
    reporterPhone: reporterPhone ?? undefined,
    subject,
    description,
    targetKind: targetKind ?? undefined,
    targetId: targetId ?? undefined,
    targetUrl: targetUrl ?? undefined,
    claimedOwnership: claimedOwnership ?? undefined,
    swornStatement,
    consented
  });
  if (validationError) {
    return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
  }

  const ip = clientIp(req);
  if (await isTicketRateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: "rate-limited", message: "Too many reports from your IP in the last hour. Please try again later or email support directly." },
      { status: 429 }
    );
  }

  // Optional merchant identity — attach reporter_slug when the caller
  // is signed in so admin can see WHO reported (accountability + fraud
  // attribution). Guests get null.
  const identity = await getMerchantIdentity();
  const reporterSlug = identity?.slug ?? null;

  // Upload attachments (silently drop failures — a bad file
  // shouldn't fail the whole ticket).
  const rawFiles = form.getAll("attachments").filter((f): f is File => f instanceof File);
  const attachmentUrls: string[] = [];
  for (const file of rawFiles.slice(0, TICKET_MAX_ATTACHMENTS)) {
    if (file.size === 0) continue;
    const url = await uploadTicketAttachment({ file, reporterName });
    if (url) attachmentUrls.push(url);
  }

  const ticket = await insertTicket({
    kind: kind as TicketKind,
    reporterName,
    reporterEmail,
    reporterPhone,
    reporterSlug,
    reporterIp: ip,
    reporterUserAgent: req.headers.get("user-agent"),
    subject,
    description,
    targetKind: (targetKind as TicketTargetKind | null),
    targetId,
    targetUrl,
    claimedOwnership,
    swornStatement,
    attachmentUrls
  });

  if (!ticket) {
    return NextResponse.json({ ok: false, error: "db-insert-failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    ticketId: ticket.id,
    severity: ticket.severity,
    slaDeadlineAt: ticket.slaDeadlineAt
  });
}
