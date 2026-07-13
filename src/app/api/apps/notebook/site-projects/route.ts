// GET  /api/apps/notebook/site-projects  — list the trade's site projects
// POST /api/apps/notebook/site-projects  — create a new site project

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getTradeSession } from "@/apps/notebook/server/tradeSession";
import { publish } from "@/lib/os/events/bus";

export const dynamic = "force-dynamic";

const TABLE = "app_notebook_site_projects";

export async function GET() {
  const { tradeId } = await getTradeSession();
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("*")
    .eq("trade_id", tradeId)
    .eq("archived", false)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data ?? [] });
}

export async function POST(req: Request) {
  const { tradeId } = await getTradeSession();
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const siteName = String(payload.siteName ?? "").trim();
  const addressLabel = String(payload.addressLabel ?? "").trim();
  if (!siteName) return NextResponse.json({ error: "missing_siteName" }, { status: 400 });
  if (!addressLabel) return NextResponse.json({ error: "missing_addressLabel" }, { status: 400 });

  const mode = String(payload.addressMode ?? "manual");
  if (!["postcode", "manual", "what3words"].includes(mode)) {
    return NextResponse.json({ error: "invalid_addressMode" }, { status: 400 });
  }

  const row = {
    trade_id:         tradeId,
    site_name:        siteName,
    customer_name:    payload.customerName ? String(payload.customerName) : null,
    address_mode:     mode,
    address_label:    addressLabel,
    address_lat:      payload.addressLat !== undefined ? Number(payload.addressLat) : null,
    address_lng:      payload.addressLng !== undefined ? Number(payload.addressLng) : null,
    address_postcode: payload.addressPostcode ? String(payload.addressPostcode) : null,
    directions:       payload.directions ? String(payload.directions) : null
  };

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .insert(row)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await publish({
    eventType:       "notebook.site_project.created",
    publisherApp:    "notebook",
    dedupKey:        `notebook-project-${data.id}`,
    actorBusinessId: tradeId,
    subjectType:     "notebook_site_project",
    subjectId:       data.id,
    payload: {
      projectId:    data.id,
      siteName:     data.site_name,
      addressLabel: data.address_label,
      addressMode:  data.address_mode
    }
  }).catch(() => null);

  return NextResponse.json({ project: data });
}
