// GET /api/store/me
//
// Small membership-state endpoint the client polls to know whether
// to show the "Manage" pill / member panels. Reads si-member cookie
// → checks isActiveMember → returns { active, email }.

import { NextResponse } from "next/server";
import { memberEmailFromRequest, isActiveMember } from "@/lib/storeMemberSession";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const email  = memberEmailFromRequest(req);
  const active = email ? await isActiveMember(email) : false;
  return NextResponse.json({ active, email: active ? email : null });
}
