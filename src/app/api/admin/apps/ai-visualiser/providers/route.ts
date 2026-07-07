// POST /api/admin/apps/ai-visualiser/providers
//
// Admin-only endpoint. Actions:
//   • upsert  — save api key + model id for a provider row
//   • enable  — flip enabled=true (disables all others in same tx)
//   • disable — flip enabled=false
//   • test    — call the provider's cheap health check
//
// The API key never leaves the server; the client-side panel only ever
// sees `has_key: true/false` in the response.

import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { makeOpenAiProvider } from "@/lib/ai-visualiser/providers/openai";
import { makeFluxProvider } from "@/lib/ai-visualiser/providers/flux";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: unknown;
  providerId?: unknown;
  apiKey?: unknown;
  modelId?: unknown;
  displayName?: unknown;
};

async function loadRows() {
  const { data } = await supabaseAdmin
    .from("ai_visualiser_provider_config")
    .select(
      "id, provider_id, display_name, model_id, enabled, cost_per_render_pence, last_tested_at, last_test_ok, last_test_error, credentials"
    )
    .order("provider_id");
  return (data || []).map((r) => ({
    id: r.id,
    provider_id: r.provider_id,
    display_name: r.display_name,
    model_id: r.model_id,
    enabled: r.enabled,
    cost_per_render_pence: r.cost_per_render_pence,
    last_tested_at: r.last_tested_at,
    last_test_ok: r.last_test_ok,
    last_test_error: r.last_test_error,
    has_key: Boolean((r.credentials as { api_key?: string })?.api_key)
  }));
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "not-admin" }, { status: 401 });
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const action = String(body.action || "");
  const providerId = typeof body.providerId === "string" ? body.providerId.trim() : "";
  if (!providerId) {
    return NextResponse.json({ ok: false, error: "providerId required" }, { status: 400 });
  }

  const displayName =
    typeof body.displayName === "string" && body.displayName.trim().length > 0
      ? body.displayName.trim()
      : providerId;

  if (action === "upsert") {
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const modelId =
      typeof body.modelId === "string" && body.modelId.trim().length > 0
        ? body.modelId.trim()
        : null;

    const { data: existing } = await supabaseAdmin
      .from("ai_visualiser_provider_config")
      .select("id, credentials")
      .eq("provider_id", providerId)
      .maybeSingle();

    const credsMerged = {
      ...(existing?.credentials as Record<string, unknown> | null | undefined),
      ...(apiKey ? { api_key: apiKey } : {})
    };

    await supabaseAdmin
      .from("ai_visualiser_provider_config")
      .upsert(
        {
          provider_id: providerId,
          display_name: displayName,
          model_id: modelId,
          credentials: credsMerged
        },
        { onConflict: "provider_id" }
      );
    return NextResponse.json({ ok: true, rows: await loadRows() });
  }

  if (action === "enable") {
    // Disable all others first (partial unique index enforces one enabled)
    await supabaseAdmin
      .from("ai_visualiser_provider_config")
      .update({ enabled: false })
      .neq("provider_id", providerId);
    const { error } = await supabaseAdmin
      .from("ai_visualiser_provider_config")
      .update({ enabled: true })
      .eq("provider_id", providerId);
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true, rows: await loadRows() });
  }

  if (action === "disable") {
    await supabaseAdmin
      .from("ai_visualiser_provider_config")
      .update({ enabled: false })
      .eq("provider_id", providerId);
    return NextResponse.json({ ok: true, rows: await loadRows() });
  }

  if (action === "test") {
    const { data: row } = await supabaseAdmin
      .from("ai_visualiser_provider_config")
      .select("credentials")
      .eq("provider_id", providerId)
      .maybeSingle();
    const apiKey = (row?.credentials as { api_key?: string })?.api_key;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "No API key saved for this provider." },
        { status: 400 }
      );
    }
    let result: { ok: true } | { ok: false; error: string };
    if (providerId === "openai-images") {
      result = await makeOpenAiProvider({ apiKey }).test();
    } else if (providerId === "flux-1.1-pro") {
      result = await makeFluxProvider({ apiKey }).test();
    } else {
      result = { ok: false, error: `No test handler for ${providerId}` };
    }
    await supabaseAdmin
      .from("ai_visualiser_provider_config")
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_ok: result.ok,
        last_test_error: result.ok ? null : result.error
      })
      .eq("provider_id", providerId);
    return NextResponse.json(
      { ok: result.ok, error: result.ok ? undefined : result.error, rows: await loadRows() },
      { status: result.ok ? 200 : 502 }
    );
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
