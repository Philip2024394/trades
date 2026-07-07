// POST /api/quote/[token]/reject — homeowner rejects; optional reason.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { recordTimelineEvent } from "@/lib/os/timeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { reason?: unknown };
  const reason =
    typeof body.reason === "string" && body.reason.trim().length > 0
      ? body.reason.trim().slice(0, 500)
      : null;

  const { data: quote } = await supabaseAdmin
    .from("app_quote_workspace_quotes")
    .select("id, project_id, property_id, status, homeowner_party_id")
    .eq("share_token", token)
    .maybeSingle();
  if (!quote) {
    return NextResponse.json({ ok: false, error: "Quote not found." }, { status: 404 });
  }
  if (quote.status === "rejected") {
    return NextResponse.json({ ok: true, alreadyRejected: true });
  }
  if (!["sent", "viewed", "draft"].includes(quote.status)) {
    return NextResponse.json(
      { ok: false, error: "Cannot reject in current state." },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("app_quote_workspace_quotes")
    .update({
      status: "rejected",
      rejected_at: now,
      rejected_reason: reason
    })
    .eq("id", quote.id);
  await supabaseAdmin.from("app_quote_workspace_quote_events").insert({
    quote_id: quote.id,
    verb: "rejected" as const,
    actor_kind: "homeowner" as const,
    actor_party_id: quote.homeowner_party_id,
    payload: reason ? { reason } : {}
  });
  await recordTimelineEvent({
    propertyId: quote.property_id,
    projectId: quote.project_id,
    actorPartyId: quote.homeowner_party_id,
    verb: "quote.rejected",
    subjectType: "quote",
    subjectId: quote.id,
    headline: "Quote declined",
    payload: reason ? { reason } : {}
  });
  return NextResponse.json({ ok: true });
}
