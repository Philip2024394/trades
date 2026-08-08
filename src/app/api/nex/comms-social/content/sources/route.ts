// POST /api/nex/comms-social/content/sources · upsert a source
// GET  /api/nex/comms-social/content/sources?tenant_id=&eligible=true|false&kind=
import { NextResponse } from "next/server";
import { withTenantClient } from "@/lib/nex/comms-social/db";
import { listAllSources, listEligibleSources, upsertContentSource } from "@/lib/nex/comms-social/content/sources";
import type { ContentSourceKind, RightsStatus } from "@/lib/nex/comms-social/content/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: {
    tenant_id?: string; kind?: ContentSourceKind; slug?: string;
    content?: Record<string, unknown>; rights_status?: RightsStatus;
    contains_identifiable_persons?: boolean; person_release_evidence_url?: string;
    attested_by?: string; attestation_ip?: string; expires_at?: string; active?: boolean;
  };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  if (!body.tenant_id || !body.kind || !body.content) {
    return NextResponse.json({ ok: false, error: "tenant_id + kind + content required" }, { status: 400 });
  }
  const r = await withTenantClient(body.tenant_id, async (c) =>
    await upsertContentSource({
      client: c, tenant_id: body.tenant_id!, kind: body.kind!, slug: body.slug,
      content: body.content!, rights_status: body.rights_status,
      contains_identifiable_persons: body.contains_identifiable_persons,
      person_release_evidence_url: body.person_release_evidence_url,
      attested_by: body.attested_by, attestation_ip: body.attestation_ip,
      expires_at: body.expires_at, active: body.active,
    }));
  return NextResponse.json({ ok: true, source: r });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenant_id = url.searchParams.get("tenant_id");
  if (!tenant_id) return NextResponse.json({ ok: false, error: "tenant_id required" }, { status: 400 });
  const eligibleOnly = url.searchParams.get("eligible") === "true";
  const kind = url.searchParams.get("kind") as ContentSourceKind | null;
  const sources = await withTenantClient(tenant_id, async (c) =>
    eligibleOnly ? await listEligibleSources(c, tenant_id, kind ?? undefined)
                 : await listAllSources(c, tenant_id));
  return NextResponse.json({ ok: true, sources: sources ?? [] });
}
