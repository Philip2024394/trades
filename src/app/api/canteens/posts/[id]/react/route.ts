// POST /api/canteens/posts/[id]/react
//
// Toggle a reaction on a canteen post. Anonymous cookie identifies the
// voter — same idempotence model as helpful thumbs on reviews.
//
// Reactions denormalized to canteen_posts.reactions jsonb:
//   { like: 12, agree: 3, question: 2, "voters": ["<cookie-hash>", ...] }
//
// The voters array is capped to prevent unbounded jsonb growth.
// Overflow past REACTION_VOTER_CAP relies on the cookie-per-browser
// dedup and accepts small drift. For a load-bearing metric we'd move
// to a votes table; reactions are display-only sort signal.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const REACTION_COOKIE = "network_post_reactor";
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365; // 1 year
const REACTION_VOTER_CAP = 500;

type ReactionKind = "like" | "agree" | "question";
const VALID_KINDS: ReactionKind[] = ["like", "agree", "question"];

type ReactPayload = {
  kind: ReactionKind;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Reactions = { [K in ReactionKind]?: number } & { voters?: Array<{ voter: string; kinds: ReactionKind[] }> };

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: "missing-id" }, { status: 400 });

  let payload: ReactPayload;
  try {
    payload = (await req.json()) as ReactPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }
  if (!VALID_KINDS.includes(payload.kind)) {
    return NextResponse.json({ ok: false, error: "invalid-kind" }, { status: 400 });
  }

  const jar = await cookies();
  let voterId = jar.get(REACTION_COOKIE)?.value ?? null;
  const isNewCookie = !voterId;
  if (!voterId) voterId = crypto.randomUUID();

  const read = await supabaseAdmin
    .from("hammerex_canteen_posts")
    .select("reactions")
    .eq("id", id)
    .maybeSingle();
  if (read.error) {
    return NextResponse.json({ ok: false, error: "db-lookup-failed" }, { status: 500 });
  }
  if (!read.data) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }

  const current = (read.data.reactions ?? {}) as Reactions;
  const voters = current.voters ?? [];
  const existingIdx = voters.findIndex((v) => v.voter === voterId);
  const alreadyForKind = existingIdx >= 0 && voters[existingIdx].kinds.includes(payload.kind);

  // Toggle: remove if already voted for this kind, add otherwise.
  let nextVoters: Reactions["voters"];
  let delta = 0;
  if (alreadyForKind) {
    // Remove this kind from the voter's list.
    const kinds = voters[existingIdx].kinds.filter((k) => k !== payload.kind);
    nextVoters = [...voters];
    if (kinds.length === 0) nextVoters.splice(existingIdx, 1);
    else nextVoters[existingIdx] = { voter: voterId, kinds };
    delta = -1;
  } else if (existingIdx >= 0) {
    nextVoters = [...voters];
    nextVoters[existingIdx] = { voter: voterId, kinds: [...voters[existingIdx].kinds, payload.kind] };
    delta = 1;
  } else {
    if (voters.length >= REACTION_VOTER_CAP) {
      // Cap breach: silently accept the vote but don't persist the
      // voter — display drift is fine; unbounded jsonb isn't.
      delta = 1;
      nextVoters = voters;
    } else {
      nextVoters = [...voters, { voter: voterId, kinds: [payload.kind] }];
      delta = 1;
    }
  }

  const nextCount = Math.max(0, (current[payload.kind] ?? 0) + delta);
  const next: Reactions = { ...current, [payload.kind]: nextCount, voters: nextVoters };

  const update = await supabaseAdmin
    .from("hammerex_canteen_posts")
    .update({ reactions: next })
    .eq("id", id);
  if (update.error) {
    return NextResponse.json(
      { ok: false, error: "db-update-failed", detail: update.error.message },
      { status: 500 }
    );
  }

  const res = NextResponse.json({
    ok: true,
    kind: payload.kind,
    count: nextCount,
    reacted: !alreadyForKind
  });
  if (isNewCookie) {
    res.cookies.set({
      name: REACTION_COOKIE,
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
