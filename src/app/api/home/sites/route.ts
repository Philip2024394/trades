// POST /api/home/sites — create a new site under the active entity.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireHomeownerSession } from "@/lib/os/homeownerSession";
import { requireEntityRole } from "@/lib/os/entitySession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set([
  "renovation",
  "new_build",
  "commercial",
  "extension",
  "maintenance"
]);

export async function POST(request: Request) {
  let party;
  try {
    party = await requireHomeownerSession();
  } catch {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  let membership;
  try {
    membership = await requireEntityRole("foreman");
  } catch {
    return NextResponse.json(
      { ok: false, error: "insufficient_role" },
      { status: 403 }
    );
  }

  let body: {
    name?: string;
    address_line_1?: string;
    postcode?: string;
    site_type?: string;
    started_at?: string;
    estimated_completion_at?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const siteType = (body.site_type ?? "renovation").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "missing_name" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(siteType)) {
    return NextResponse.json({ ok: false, error: "invalid_site_type" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("os_sites")
    .insert({
      name,
      builder_party_id: party.id,
      owner_entity_id: membership.entity_id,
      address_line_1: body.address_line_1?.trim() || null,
      postcode: body.postcode?.trim().toUpperCase() || null,
      site_type: siteType,
      status: "active",
      started_at: body.started_at || null,
      estimated_completion_at: body.estimated_completion_at || null
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: "insert_failed", detail: error?.message },
      { status: 500 }
    );
  }

  await supabaseAdmin.from("os_entity_audit_events").insert({
    entity_id: membership.entity_id,
    actor_party_id: party.id,
    verb: "site.created",
    after_state: { name, site_type: siteType }
  });

  return NextResponse.json({ ok: true, siteId: data.id });
}
