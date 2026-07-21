// POST /api/report — public content-report endpoint.
//
// Any signed-in user can flag any subject. Server-side heuristic
// (basic dedupe: one flag per (reporter, subject) per 24h) prevents
// spam-flagging. Otherwise trust the queue — the admin sees every flag.
//
// Body: {
//   subjectKind: "yard_post" | "sitebook_photo" | "review" | "chat_message",
//   subjectId: string,
//   subjectDisplay?: string,
//   subjectUrl?: string,
//   flagKind: "spam" | "offensive" | "off_topic" | "personal_info" | "copyright" | "low_quality" | "other",
//   flagNote?: string
// }

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { flagContent, type FlagKind, type ModerationSubjectKind } from "@/lib/moderation/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_SUBJECTS = new Set<ModerationSubjectKind>([
  "yard_post", "sitebook_photo", "review", "chat_message"
]);
const ALLOWED_FLAGS = new Set<FlagKind>([
  "spam", "offensive", "off_topic", "personal_info", "copyright", "low_quality", "other"
]);

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as {
    subjectKind?:    ModerationSubjectKind;
    subjectId?:      string;
    subjectDisplay?: string;
    subjectUrl?:     string;
    flagKind?:       FlagKind;
    flagNote?:       string;
  } | null;
  if (!body?.subjectKind || !body.subjectId || !body.flagKind) {
    return NextResponse.json({ error: "subjectKind + subjectId + flagKind required" }, { status: 400 });
  }
  if (!ALLOWED_SUBJECTS.has(body.subjectKind) || !ALLOWED_FLAGS.has(body.flagKind)) {
    return NextResponse.json({ error: "invalid subject or flag" }, { status: 400 });
  }

  const c = await cookies();
  const homeownerId = c.get("tn_homeowner_sid")?.value ?? null;
  const merchantId  = c.get("tn_merchant_sid")?.value  ?? null;
  const reporterKind = homeownerId ? "homeowner" : merchantId ? "merchant" : "anonymous";
  const reporterId   = homeownerId ?? merchantId ?? "anon";

  // Basic dedupe — one flag per (reporter, subject) per 24h
  if (reporterKind !== "anonymous") {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const dup = await supabaseAdmin
      .from("hammerex_moderation_flags")
      .select("id")
      .eq("subject_kind", body.subjectKind)
      .eq("subject_id",   body.subjectId)
      .eq("reporter_kind", reporterKind)
      .eq("reporter_id",   reporterId)
      .gte("created_at",   since)
      .maybeSingle();
    if (dup.data) {
      return NextResponse.json({ ok: true, dedupe: true });
    }
  }

  await flagContent({
    subjectKind:    body.subjectKind,
    subjectId:      body.subjectId,
    subjectDisplay: body.subjectDisplay,
    subjectUrl:     body.subjectUrl,
    flagKind:       body.flagKind,
    flagSource:     "user_report",
    flagNote:       body.flagNote,
    reporterKind,
    reporterId
  });

  return NextResponse.json({ ok: true });
}
