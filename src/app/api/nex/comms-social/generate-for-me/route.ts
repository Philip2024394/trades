// POST /api/nex/comms-social/generate-for-me
//
// Session-based content generation for the First-Post Wizard.
// Auth-gated · picks the merchant's starter template automatically
// so the merchant never sees template_id.
//
// Body:
//   { platform: string,
//     business_description: string,    // saved to business_profile source
//     template_slug?: string           // defaults to "nex-starter-introduction"
//   }
//
// Returns: { ok, draft: { caption, hashtags, cta, grounding_state, ... } }

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/nex/brains/_auth";
import { resolveTenantForUser } from "@/lib/nex/comms-social/identity/resolve";
import { withTenantClient } from "@/lib/nex/comms-social/db";
import { upsertContentSource } from "@/lib/nex/comms-social/content/sources";
import { listTemplates } from "@/lib/nex/comms-social/content/templates";
import { generateAndGround } from "@/lib/nex/comms-social/content/pipeline";
import { ensureStarterTemplate, STARTER_TEMPLATE_SLUG } from "@/lib/nex/comms-social/identity/starter-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  const tenant = await resolveTenantForUser(auth.user.supabase_user_id);
  if (!tenant) {
    return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 409 });
  }

  let body: { platform?: string; business_description?: string; template_slug?: string };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const description = (body.business_description ?? "").trim();
  if (!body.platform || description.length < 20) {
    return NextResponse.json(
      { ok: false, error: "platform + business_description (>=20 chars) required" },
      { status: 400 },
    );
  }

  const wantedSlug = body.template_slug ?? STARTER_TEMPLATE_SLUG;

  // Everything below scoped to the resolved tenant.
  const prep = await withTenantClient(tenant.tenant_id, async (c) => {
    // 1 · Upsert the merchant's business_profile source with the line
    //     they just typed.
    await upsertContentSource({
      client:    c,
      tenant_id: tenant.tenant_id,
      kind:      "business_profile",
      slug:      "primary",
      content:   { description },
      rights_status: "owned",
      contains_identifiable_persons: false,
      attested_by: `user:${auth.user.supabase_user_id}`,
    });
    // 2 · Make sure the starter template exists (idempotent).
    await ensureStarterTemplate(c, tenant.tenant_id);
    // 3 · Pick the requested template (or fall back to the starter).
    const templates = await listTemplates(c, tenant.tenant_id);
    const chosen = templates.find((t) => t.slug === wantedSlug && t.status === "active")
                ?? templates.find((t) => t.status === "active")
                ?? null;
    return { template_id: chosen?.template_id ?? null };
  });

  if (!prep?.template_id) {
    return NextResponse.json(
      { ok: false, error: "no_active_template_found" },
      { status: 500 },
    );
  }

  // Generate outside withTenantClient because generateAndGround manages
  // its own connections (mirrors the existing /generate route).
  try {
    const r = await generateAndGround({
      tenant_id:   tenant.tenant_id,
      template_id: prep.template_id,
      platform:    body.platform,
      created_by:  `user:${auth.user.supabase_user_id}`,
    });
    return NextResponse.json({ ok: true, draft: r.draft });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
