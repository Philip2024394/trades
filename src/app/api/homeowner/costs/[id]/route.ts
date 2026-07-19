// PATCH /api/homeowner/costs/[id] — update a cost row.
// DELETE /api/homeowner/costs/[id] — remove a cost (and its payments via cascade).

import { NextResponse } from "next/server";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { updateCost, deleteCost, type CostKind, type CostStatus } from "@/lib/homeowners/costs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => null) as {
    tradeName?:       string | null;
    tradeListingId?:  string | null;
    kind?:            CostKind;
    description?:     string | null;
    agreedPence?:     number;
    dueAt?:           string | null;
    status?:          CostStatus;
  } | null;
  if (!body) return NextResponse.json({ ok: false, error: "empty-body" }, { status: 400 });
  const res = await updateCost({
    homeownerId: homeowner.id,
    id,
    patch: {
      trade_name:       body.tradeName        ?? undefined,
      trade_listing_id: body.tradeListingId   ?? undefined,
      kind:             body.kind             ?? undefined,
      description:      body.description      ?? undefined,
      agreed_pence:     body.agreedPence      ?? undefined,
      due_at:           body.dueAt            ?? undefined,
      status:           body.status           ?? undefined
    }
  });
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 404 });
  return NextResponse.json({ ok: true, cost: res.cost });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });
  const { id } = await params;
  const ok = await deleteCost({ homeownerId: homeowner.id, id });
  if (!ok) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
