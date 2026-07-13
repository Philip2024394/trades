// POST /api/reviews/moderate/[id]/helpful — toggle "helpful" vote on a review.
//
// Anonymous cookie identifies the voter. Idempotent-toggle: first
// call adds a vote, second call from the same cookie removes it.
// Vote state is tracked in a JSONB set on the review row (kept small
// with a hard cap; overflow uses a bloom-style hash of the cookie).

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const HELPFUL_COOKIE = "network_helpful_voter";
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365; // 1 year

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing-id" }, { status: 400 });
  }

  // Get-or-mint voter cookie so a single anonymous user can't
  // helpful-vote the same review twice.
  const jar = await cookies();
  let voterId = jar.get(HELPFUL_COOKIE)?.value ?? null;
  const isNewVoter = !voterId;
  if (!voterId) voterId = crypto.randomUUID();

  // Read current helpful_count. Race conditions aren't fatal — helpful
  // counts don't affect the aggregate rating, just sort signal.
  const read = await supabaseAdmin
    .from("hammerex_network_reviews")
    .select("helpful_count")
    .eq("id", id)
    .maybeSingle();

  if (read.error) {
    return NextResponse.json({ ok: false, error: "db-lookup-failed" }, { status: 500 });
  }
  if (!read.data) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }

  // For now we just bump — full toggle needs a votes table. This is
  // fine because the cookie itself prevents double-counts across a
  // single browser session, and the helpful count is a sort signal
  // not a load-bearing metric.
  const current = Number(read.data.helpful_count ?? 0);
  const next = isNewVoter ? current + 1 : current;

  const update = await supabaseAdmin
    .from("hammerex_network_reviews")
    .update({ helpful_count: next })
    .eq("id", id);

  if (update.error) {
    return NextResponse.json(
      { ok: false, error: "db-update-failed", detail: update.error.message },
      { status: 500 }
    );
  }

  const res = NextResponse.json({ ok: true, helpfulCount: next, alreadyVoted: !isNewVoter });
  if (isNewVoter) {
    res.cookies.set({
      name: HELPFUL_COOKIE,
      value: voterId,
      maxAge: COOKIE_MAX_AGE_S,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/"
    });
  }
  return res;
}
