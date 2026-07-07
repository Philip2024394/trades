// POST /api/foreman/waitlist
//
// Public. Adds a builder / foreman to the design-partner waitlist.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: {
    email?: string;
    company_name?: string | null;
    team_size?: string;
    primary_use_case?: string;
    note?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("os_foreman_waitlist").insert({
    email,
    company_name: body.company_name ?? null,
    team_size: body.team_size ?? null,
    primary_use_case: body.primary_use_case ?? null,
    note: body.note ?? null
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "insert_failed", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
