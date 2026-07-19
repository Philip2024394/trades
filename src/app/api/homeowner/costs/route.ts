// POST /api/homeowner/costs — create a new cost entry.
//
// Body: {
//   projectId, agreedPence, tradeListingId?, tradeName?,
//   kind?, description?, postId?, invitationId?, dueAt?
// }
//
// STRICT PRIVACY: only the authed homeowner may create costs against
// their own projects. Any cross-owner attempt returns not-found (never
// exposes that another homeowner exists).

import { NextResponse } from "next/server";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { createCost, type CostKind } from "@/lib/homeowners/costs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    projectId?:       string;
    agreedPence?:     number;
    tradeListingId?:  string;
    tradeName?:       string;
    kind?:            CostKind;
    description?:     string;
    postId?:          string;
    invitationId?:    string;
    dueAt?:           string;
  } | null;
  if (!body?.projectId)                return NextResponse.json({ ok: false, error: "missing-project" }, { status: 400 });
  if (typeof body.agreedPence !== "number") return NextResponse.json({ ok: false, error: "missing-amount" }, { status: 400 });

  const res = await createCost({
    homeownerId:     homeowner.id,
    projectId:       body.projectId,
    tradeListingId:  body.tradeListingId,
    tradeName:       body.tradeName,
    kind:            body.kind,
    description:     body.description,
    agreedPence:     body.agreedPence,
    postId:          body.postId,
    invitationId:    body.invitationId,
    dueAt:           body.dueAt
  });
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, cost: res.cost });
}
