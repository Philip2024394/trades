// NEX Mutations · GET /api/b/[slug]/owner/nex/audit (Philip 2026-08-14).
// Owner-only. Returns the mutation audit log for this business.

import { NextResponse } from "next/server";
import { readSession, assertPermission, permissionErrorResponse } from "@/lib/nex/business-context";
import { ensureSeeded, getBusiness } from "@/lib/nex/business-context";
import { auditEntriesForBusiness } from "@/lib/nex/mutations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  ensureSeeded();
  const { slug } = await params;
  const session = readSession(req, { slug, scope: "owner" });
  const perm = assertPermission(session, { requiredRole: "owner", businessSlug: slug });
  if (!perm.ok) return permissionErrorResponse(perm);

  const biz = getBusiness(slug);
  if (!biz) return NextResponse.json({ ok: false, error: "unknown-business" }, { status: 404 });

  const entries = auditEntriesForBusiness(slug);
  return NextResponse.json({
    ok: true,
    business: { slug, displayName: biz.blueprint.identity.displayName, currentRevision: biz.blueprint.meta.revision },
    total: entries.length,
    entries
  });
}
