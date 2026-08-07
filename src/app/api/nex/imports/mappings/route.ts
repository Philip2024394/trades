// GET  /api/nex/imports/mappings — list saved mapping profiles
// POST /api/nex/imports/mappings — save a new profile
//
// POST body: { label, description?, header_signature, mapping, format_hint?, created_by? }

import { NextResponse } from "next/server";
import { createMappingProfile, listMappingProfiles } from "@/lib/nex/imports/profiles";
import type { MappingProfileInput } from "@/lib/nex/imports/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const profiles = await listMappingProfiles();
  return NextResponse.json({ ok: true, profiles });
}

export async function POST(request: Request) {
  let body: Partial<MappingProfileInput>;
  try { body = await request.json() as Partial<MappingProfileInput>; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  if (!body.label || !body.header_signature || !body.mapping) {
    return NextResponse.json({ ok: false, error: "label_header_signature_and_mapping_required" }, { status: 400 });
  }

  const profile = await createMappingProfile(body as MappingProfileInput);
  if (!profile) return NextResponse.json({ ok: false, error: "create_failed" }, { status: 500 });
  return NextResponse.json({ ok: true, profile });
}
