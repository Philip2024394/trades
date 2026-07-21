// POST /api/case-studies/submit
// Case study submission from a Networkers member. No DB persistence
// yet — the editorial team receives an in-app notification via the
// existing Notification Engine. When published as a full leaf, a
// CaseStudy entry lands in /case-studies/config.ts.

import { NextResponse } from "next/server";
import { notify } from "@/lib/notifications/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUIRED_STRING = ["contact_name", "contact_email", "project_title", "project_summary"] as const;

type SubmitPayload = {
  merchant_slug?:      string;
  contact_name:        string;
  contact_email:       string;
  contact_phone?:      string;
  trade_slug?:         string;
  city?:               string;
  project_title:       string;
  project_summary:     string;
  final_cost?:         string;
  timeline_summary?:   string;
  went_well?:          string;
  went_wrong?:         string;
  photo_links?:        string;
  homeowner_consent:   boolean;
  publish_consent:     boolean;
  invoice_shareable:   boolean;
};

export async function POST(req: Request) {
  let body: SubmitPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  for (const f of REQUIRED_STRING) {
    const v = body[f];
    if (typeof v !== "string" || v.trim().length === 0) {
      return NextResponse.json({ ok: false, error: `missing:${f}` }, { status: 400 });
    }
  }
  if (!/.+@.+\..+/.test(body.contact_email)) {
    return NextResponse.json({ ok: false, error: "invalid-email" }, { status: 400 });
  }
  if (!body.homeowner_consent || !body.publish_consent || !body.invoice_shareable) {
    return NextResponse.json({ ok: false, error: "consents-required" }, { status: 400 });
  }

  // Fire notification to editorial. Fire-and-forget — if the
  // notification engine fails we still ack the submission (the caller
  // sees success) and we log the payload.
  const summary = [
    `Case study submission from ${body.contact_name} <${body.contact_email}>`,
    body.merchant_slug ? `Profile: /${body.merchant_slug}` : "",
    body.trade_slug   ? `Trade: ${body.trade_slug}`         : "",
    body.city         ? `City: ${body.city}`                 : "",
    "",
    `Title: ${body.project_title}`,
    "",
    `Summary: ${body.project_summary}`,
    "",
    body.final_cost         ? `Final cost: £${body.final_cost}`             : "",
    body.timeline_summary   ? `Timeline: ${body.timeline_summary}`           : "",
    body.went_well          ? `Went well:\n${body.went_well}`                : "",
    body.went_wrong         ? `Went wrong:\n${body.went_wrong}`              : "",
    body.photo_links        ? `Photo links:\n${body.photo_links}`            : "",
    body.contact_phone      ? `Phone: ${body.contact_phone}`                 : "",
    "",
    "Consents recorded: homeowner + publish + invoice shareable"
  ].filter(Boolean).join("\n");

  console.log("[case-studies/submit]", summary);

  await notify({
    to: {
      kind:  "admin",
      email: "case-studies@thenetworkers.app",
      display: "Case Studies Editorial"
    },
    template: "admin.action_required",
    data: {
      subject: `Case study submission — ${body.project_title}`,
      body:    summary
    },
    channels: ["email", "in_app"],
    product:  "case-studies",
    relatedTargetKind: "case_study_submission"
  }).catch((err) => console.error("[case-studies/submit] notify failed:", err));

  return NextResponse.json({ ok: true });
}
