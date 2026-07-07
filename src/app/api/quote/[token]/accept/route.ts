// POST /api/quote/[token]/accept — homeowner accepts a quote via the public link.
//
// Constitution: this route does NOT reach into Job Diary or Reviews.
// It flips its own state, records its own timeline event, and
// publishes quote.accepted on the event bus. The Job Diary subscriber
// opens the job; the CRM subscriber advances the contact stage.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { recordTimelineEvent } from "@/lib/os/timeline";
import { updateProjectStatus } from "@/lib/os/projects";
import { publish } from "@/lib/os/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  const { data: quote } = await supabaseAdmin
    .from("app_quote_workspace_quotes")
    .select(
      "id, project_id, property_id, merchant_id, status, homeowner_party_id, homeowner_id, title, total_pence"
    )
    .eq("share_token", token)
    .maybeSingle();
  if (!quote) {
    return NextResponse.json({ ok: false, error: "Quote not found." }, { status: 404 });
  }
  if (quote.status === "accepted") {
    return NextResponse.json({ ok: true, alreadyAccepted: true });
  }
  if (quote.status !== "sent" && quote.status !== "viewed") {
    return NextResponse.json(
      { ok: false, error: "Quote cannot be accepted in its current state." },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("app_quote_workspace_quotes")
    .update({ status: "accepted", accepted_at: now })
    .eq("id", quote.id);
  await supabaseAdmin.from("app_quote_workspace_quote_events").insert({
    quote_id: quote.id,
    verb: "accepted" as const,
    actor_kind: "homeowner" as const,
    actor_party_id: quote.homeowner_party_id
  });

  await updateProjectStatus({
    projectId: quote.project_id,
    status: "accepted",
    actorPartyId: quote.homeowner_party_id
  });

  await recordTimelineEvent({
    propertyId: quote.property_id,
    projectId: quote.project_id,
    actorPartyId: quote.homeowner_party_id,
    verb: "quote.accepted",
    subjectType: "quote",
    subjectId: quote.id,
    headline: "Quote accepted"
  });

  // Publish — Job Diary + CRM subscribers do the rest.
  await publish({
    eventType: "quote.accepted",
    publisherApp: "quote-workspace",
    dedupKey: `accept:${quote.id}`,
    actorPartyId: quote.homeowner_party_id,
    actorBusinessId: quote.merchant_id,
    propertyId: quote.property_id,
    projectId: quote.project_id,
    subjectType: "quote",
    subjectId: quote.id,
    payload: {
      quote_title: quote.title,
      total_pence: quote.total_pence,
      total_gbp: `£${(quote.total_pence / 100).toFixed(2)}`
    }
  });

  return NextResponse.json({ ok: true });
}
