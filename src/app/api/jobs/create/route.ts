// POST /api/jobs/create
//
// Trade-agnostic Job creation. Accepts:
//   {
//     job_type: 'concrete',            // template slug
//     preset:   'driveway-car',        // preset within template
//     title?:   'Smith Driveway',      // optional; auto-generated if omitted
//     dimensions: { length_m, width_m, thickness_mm },
//     qualifiers: { ...template-defined answers },
//     linked_video_id?: uuid,          // if created from a video page
//     parent_job_id?:   uuid,          // child job (Kitchen inside House Reno)
//     country_code?:    'GB',          // defaults to Vercel edge geo → GB
//     region_slug?:     'ENG',
//     postcode?:        string
//   }
//
// Returns the created Job with id + share_token so the caller can
// navigate to /job/[id]. Also fires the materials calculator + KB
// context lookup + writes initial events. Non-blocking: KB
// enrichment and journal generation happen async.
//
// Actor detection:
//   · Homeowner cookie → adds row as role=owner
//   · Merchant cookie  → adds row as role=main_contractor
//   · No auth          → adds row as anonymous with cookie-set share
//                        token so they can return via /job/[token]

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { calculateConcrete } from "@/lib/jobCalculators/concrete";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";
export const maxDuration = 30;

type CreateBody = {
  job_type:         string;
  preset?:          string;
  title?:           string;
  dimensions?:      { length_m?: number; width_m?: number; thickness_mm?: number };
  qualifiers?:      Record<string, unknown>;
  linked_video_id?: string;
  parent_job_id?:   string;
  country_code?:    string;
  region_slug?:     string;
  postcode?:        string;
};

export async function POST(req: Request) {
  let body: CreateBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 }); }

  if (!body.job_type || typeof body.job_type !== "string") {
    return NextResponse.json({ ok: false, error: "job_type-required" }, { status: 400 });
  }

  // Load the job template
  const { data: template } = await supabaseAdmin
    .from("hammerex_job_templates")
    .select("slug, display_name, calculator_ref, default_merchant_categories, default_trade_categories")
    .eq("slug", body.job_type)
    .maybeSingle();
  if (!template) {
    return NextResponse.json({ ok: false, error: "unknown-job-type", available: ["concrete"] }, { status: 400 });
  }

  // Resolve actor
  const merchantSlug = await getMerchantSlug();
  const homeowner    = merchantSlug ? null : await getHomeownerFromCookie();
  const actorKind: "trade" | "homeowner" | "anonymous" =
    merchantSlug ? "trade" : homeowner ? "homeowner" : "anonymous";
  const actorId = merchantSlug ?? homeowner?.id ?? null;

  // Country detection via Vercel edge headers
  const hdrs        = await headers();
  const detectedCountry = hdrs.get("x-vercel-ip-country") ?? "GB";
  const detectedRegion  = hdrs.get("x-vercel-ip-country-region") ?? null;

  // Run the calculator for this job_type
  let calculated: any = {};
  let materialCategories: string[] = template.default_merchant_categories ?? [];
  let tradeCategories:    string[] = template.default_trade_categories    ?? [];
  let citedKbEntryIds:    string[] = [];
  let difficulty: string | null = null;
  let diyFriendly: boolean | null = null;
  let buildingControl: boolean | null = null;
  let durationHours: number | null = null;
  let calculatorWarnings: string[] = [];

  if (template.calculator_ref === "concrete" && body.dimensions) {
    const d = body.dimensions;
    if (typeof d.length_m === "number" && typeof d.width_m === "number" && typeof d.thickness_mm === "number") {
      const result = calculateConcrete(
        { length_m: d.length_m, width_m: d.width_m, thickness_mm: d.thickness_mm },
        (body.qualifiers ?? {}) as any
      );
      if (!result.ok) {
        return NextResponse.json({
          ok: false,
          error: "calculator-refused-spec",
          message: result.error,
          recommendations: (result as any).recommendations ?? []
        }, { status: 422 });
      }
      calculated = result;
      materialCategories = result.merchant_categories;
      tradeCategories    = result.trade_categories;
      difficulty         = result.difficulty;
      diyFriendly        = result.diy_friendly;
      buildingControl    = result.building_control_required;
      durationHours      = result.estimated_duration_hours;
      calculatorWarnings = result.warnings;
    }
  }

  // Title fallback
  const title = (body.title && body.title.trim().length > 0)
    ? body.title.trim().slice(0, 200)
    : autoTitle(template.display_name, body.preset);

  // Insert the job (share_token auto-generated by trigger)
  const insertPayload = {
    parent_job_id:              body.parent_job_id ?? null,
    job_type_slug:              body.job_type,
    preset_slug:                body.preset ?? null,
    title,
    country_code:               body.country_code ?? detectedCountry,
    region_slug:                body.region_slug  ?? detectedRegion,
    postcode:                   body.postcode ?? null,
    dimensions_json:            body.dimensions   ?? {},
    qualifiers_json:            body.qualifiers   ?? {},
    calculated_json:            calculated,
    linked_video_ids:           body.linked_video_id ? [body.linked_video_id] : [],
    cited_kb_entry_ids:         citedKbEntryIds,
    difficulty,
    diy_friendly:               diyFriendly,
    building_control_required:  buildingControl,
    estimated_duration_hours:   durationHours,
    status:                     "planning"
  };

  const { data: jobRow, error: insertErr } = await supabaseAdmin
    .from("hammerex_jobs")
    .insert(insertPayload)
    .select("id, share_token, title")
    .single();

  if (insertErr || !jobRow) {
    return NextResponse.json({ ok: false, error: "job-create-failed", detail: insertErr?.message }, { status: 500 });
  }

  // Add creator as actor
  await supabaseAdmin.from("hammerex_job_actors").insert({
    job_id:      jobRow.id,
    actor_kind:  actorKind === "anonymous" ? "anonymous" : (actorKind === "trade" ? "trade" : "homeowner"),
    actor_id:    actorId,
    role:        actorKind === "trade" ? "main_contractor" : "owner",
    permissions: ["view_all","edit_all","invite_actors"],
    accepted_at: new Date().toISOString()
  });

  // Write initial events (fire-and-forget for the second)
  await supabaseAdmin.from("hammerex_job_events").insert({
    job_id: jobRow.id,
    event_kind: "created",
    actor_kind: actorKind,
    actor_id:   actorId,
    metadata_json: { job_type: body.job_type, preset: body.preset ?? null, title },
    renderable_summary: `Job created: ${jobRow.title} (${template.display_name})`
  });
  if (calculated && (calculated as any).ok) {
    supabaseAdmin.from("hammerex_job_events").insert({
      job_id: jobRow.id,
      event_kind: "materials_calculated",
      actor_kind: "admin",   // system-generated
      metadata_json: {
        volume_m3:     (calculated as any).volume_m3,
        strength_class:(calculated as any).strength_class,
        materials:     (calculated as any).materials.length
      },
      renderable_summary: `Materials calculated: ${(calculated as any).volume_m3} m³ of ${(calculated as any).strength_class}, ${(calculated as any).materials.length} items on shopping list`
    }).then(() => undefined);
  }

  // Initial health row
  supabaseAdmin.from("hammerex_job_health").upsert({
    job_id:  jobRow.id,
    level:   "green",
    score:   100,
    signals_json: { calculator_complete: true, quotes_received: false, materials_ordered: false },
    next_actions: ["Request 3 quotes from nearby trades", "Order materials", "Check weather for pour week"],
    summary: "Ready to plan. No blockers yet."
  }).then(() => undefined);

  return NextResponse.json({
    ok:            true,
    job_id:        jobRow.id,
    share_token:   jobRow.share_token,
    title:         jobRow.title,
    warnings:      calculatorWarnings,
    calculated,
    merchant_categories: materialCategories,
    trade_categories:    tradeCategories
  });
}

function autoTitle(templateDisplay: string, preset?: string): string {
  if (preset) {
    return preset.split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
  }
  return templateDisplay + " Job";
}
