// POST /api/apps/ai-visualiser/render
//
// Flow:
//   1. Look up homeowner + merchant + leaf.
//   2. Check merchant credits (or overage cap).
//   3. Check homeowner rate limits (12/day, 30/week).
//   4. Compute cache key from photo_phash + prompt_hash. If cache hit,
//      return the existing render — no credit consumed.
//   5. Load the merchant's taxonomy leaf + intersect with choices.
//   6. Build the prompt server-side (no free text ever).
//   7. Call provider. Save render row. Decrement credits.
//   8. Update lead (hottest_render_id, render_count, bom_summary).
//   9. If first render: fire merchant email with a thumbnail.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveActiveProvider } from "@/lib/ai-visualiser/providers/resolve";
import {
  buildRenderPrompt,
  summariseChoices,
  type PromptChoices
} from "@/lib/ai-visualiser/promptBuilder";
import {
  canonicalPromptHash,
  computePhash
} from "@/lib/ai-visualiser/perceptualHash";
import { sendMerchantLeadEmail } from "@/lib/ai-visualiser/notifyMerchant";
import { findOrCreateProject, appendSpecification } from "@/lib/os/projects";
import { recordTimelineEvent } from "@/lib/os/timeline";
import { publish } from "@/lib/os/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_CAP = 12;
const WEEK_CAP = 30;

type RenderPayload = {
  homeownerId?: unknown;
  sourcePhotoUrl?: unknown;
  leafSlug?: unknown;
  choices?: unknown;
};

type ChoiceKey = { key?: unknown };

function normaliseChoices(raw: unknown): {
  ok: true;
  value: {
    style?: string;
    material?: string;
    colour?: string;
    hardware: string[];
  };
} | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "choices object required" };
  }
  const c = raw as {
    style?: unknown;
    material?: unknown;
    colour?: unknown;
    hardware?: unknown;
  };
  const style = typeof c.style === "string" ? c.style : undefined;
  const material = typeof c.material === "string" ? c.material : undefined;
  const colour = typeof c.colour === "string" ? c.colour : undefined;
  const hardware = Array.isArray(c.hardware)
    ? c.hardware.filter((h): h is string => typeof h === "string")
    : [];
  if (!style || !material || !colour) {
    return { ok: false, error: "style, material and colour are required" };
  }
  return { ok: true, value: { style, material, colour, hardware } };
}

type LeafOption = { key: string; label: string; hex?: string };

function findOption(opts: LeafOption[], key: string | undefined): LeafOption | undefined {
  if (!key) return undefined;
  return opts.find((o) => o.key === key);
}

export async function POST(req: NextRequest) {
  let body: RenderPayload;
  try {
    body = (await req.json()) as RenderPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const homeownerId =
    typeof body.homeownerId === "string" ? body.homeownerId.trim() : "";
  const sourcePhotoUrl =
    typeof body.sourcePhotoUrl === "string" ? body.sourcePhotoUrl.trim() : "";
  const leafSlug =
    typeof body.leafSlug === "string" ? body.leafSlug.trim() : "";

  if (!homeownerId || !sourcePhotoUrl || !leafSlug) {
    return NextResponse.json(
      { ok: false, error: "homeownerId, sourcePhotoUrl and leafSlug are required." },
      { status: 400 }
    );
  }

  const normalised = normaliseChoices(body.choices);
  if (!normalised.ok) {
    return NextResponse.json({ ok: false, error: normalised.error }, { status: 400 });
  }
  const choiceKeys = normalised.value;

  // Load homeowner + merchant + leaf in parallel
  const [homeownerRes, leafRes] = await Promise.all([
    supabaseAdmin
      .from("app_ai_visualiser_homeowners")
      .select(
        "id, merchant_id, full_name, email, whatsapp_e164, home_phone, postcode, renders_today, renders_this_week, day_window_started_at, week_window_started_at, party_id, property_id"
      )
      .eq("id", homeownerId)
      .maybeSingle(),
    supabaseAdmin
      .from("ai_visualiser_taxonomy_leaves")
      .select(
        "slug, display_name, render_style_options, render_material_options, render_colour_options, render_hardware_options"
      )
      .eq("slug", leafSlug)
      .maybeSingle()
  ]);

  if (homeownerRes.error || !homeownerRes.data) {
    return NextResponse.json(
      { ok: false, error: "Homeowner not found." },
      { status: 404 }
    );
  }
  const homeowner = homeownerRes.data;
  if (leafRes.error || !leafRes.data) {
    return NextResponse.json(
      { ok: false, error: "Leaf not found." },
      { status: 404 }
    );
  }
  const leaf = leafRes.data;

  // Merchant must have this leaf in scope
  const { data: scopeRow } = await supabaseAdmin
    .from("app_ai_visualiser_catalogue_scope")
    .select("merchant_id")
    .eq("merchant_id", homeowner.merchant_id)
    .eq("leaf_slug", leafSlug)
    .eq("is_enabled", true)
    .maybeSingle();
  if (!scopeRow) {
    return NextResponse.json(
      { ok: false, error: "Leaf not in merchant scope." },
      { status: 403 }
    );
  }

  // Resolve options for the choice keys
  const styleOpts = leaf.render_style_options as LeafOption[];
  const materialOpts = leaf.render_material_options as LeafOption[];
  const colourOpts = leaf.render_colour_options as LeafOption[];
  const hardwareOpts = leaf.render_hardware_options as LeafOption[];

  const style = findOption(styleOpts, choiceKeys.style);
  const material = findOption(materialOpts, choiceKeys.material);
  const colour = findOption(colourOpts, choiceKeys.colour);
  const hardware = choiceKeys.hardware
    .map((k) => findOption(hardwareOpts, k))
    .filter((h): h is LeafOption => Boolean(h));
  if (!style || !material || !colour) {
    return NextResponse.json(
      { ok: false, error: "One or more choices are not offered by this merchant." },
      { status: 400 }
    );
  }

  const promptChoices: PromptChoices = { style, material, colour, hardware };
  const prompt = buildRenderPrompt({
    leafDisplayName: leaf.display_name,
    choices: promptChoices
  });
  const promptJson = {
    leafSlug,
    style: style.key,
    material: material.key,
    colour: colour.key,
    hardware: hardware.map((h) => h.key)
  };
  const promptHash = canonicalPromptHash(promptJson);

  // Rate limits
  const now = new Date();
  const dayStart = new Date(homeowner.day_window_started_at);
  const weekStart = new Date(homeowner.week_window_started_at);
  const dayCount = now.getTime() - dayStart.getTime() > 86_400_000 ? 0 : homeowner.renders_today;
  const weekCount = now.getTime() - weekStart.getTime() > 604_800_000 ? 0 : homeowner.renders_this_week;
  if (dayCount >= DAY_CAP) {
    return NextResponse.json(
      { ok: false, error: `Daily limit reached (${DAY_CAP}/day). Come back tomorrow.` },
      { status: 429 }
    );
  }
  if (weekCount >= WEEK_CAP) {
    return NextResponse.json(
      { ok: false, error: `Weekly limit reached (${WEEK_CAP}/week).` },
      { status: 429 }
    );
  }

  // Compute pHash of source
  let sourcePhash: string;
  try {
    sourcePhash = await computePhash(sourcePhotoUrl);
  } catch (err) {
    console.error("[ai-visualiser] phash failed", err);
    return NextResponse.json(
      { ok: false, error: "Could not read the uploaded image." },
      { status: 400 }
    );
  }

  const cacheKey = `${sourcePhash}:${promptHash}`;

  // ---------------------------------------------------------------
  // OS Foundation: find-or-create Project + Specification for this
  // render. If the homeowner isn't linked to a property (legacy row
  // pre-property-graph), we skip and record renders without project
  // linkage — the /home hub will bind them later.
  // ---------------------------------------------------------------
  let projectId: string | null = null;
  let specificationId: string | null = null;
  if (homeowner.property_id) {
    try {
      const project = await findOrCreateProject({
        propertyId: homeowner.property_id,
        primaryPartyId: homeowner.party_id,
        primaryBusinessListingId: homeowner.merchant_id,
        title: `${leaf.display_name} — ${homeowner.postcode}`,
        leafSlug
      });
      projectId = project.id;
      const spec = await appendSpecification({
        projectId: project.id,
        leafSlug,
        choices: {
          style: choiceKeys.style,
          material: choiceKeys.material,
          colour: choiceKeys.colour,
          hardware: choiceKeys.hardware
        },
        authoredByPartyId: homeowner.party_id
      });
      specificationId = spec.id;
    } catch (err) {
      console.error("[ai-visualiser] project/spec link failed", err);
    }
  }

  // Cache lookup — reuse an existing complete render for the same
  // (photo, prompt) tuple. Does not consume credits.
  const { data: cached } = await supabaseAdmin
    .from("app_ai_visualiser_renders")
    .select("id, render_url, render_url_hd, stego_watermark, render_provider")
    .eq("cache_key", cacheKey)
    .eq("status", "complete")
    .limit(1)
    .maybeSingle();

  const { data: creditsRow } = await supabaseAdmin
    .from("app_ai_visualiser_credits")
    .select("monthly_quota, renders_used_this_period, overage_rate_pence, overage_pence, is_active, period_ends_at")
    .eq("merchant_id", homeowner.merchant_id)
    .maybeSingle();

  const creditsOk = Boolean(creditsRow?.is_active);
  if (!creditsOk && !cached) {
    return NextResponse.json(
      { ok: false, error: "AI Visualiser is not active for this merchant." },
      { status: 402 }
    );
  }

  // We insert the render row up-front in 'pending' so cache-hits and
  // fresh renders share the same downstream update path.
  const insertBase = {
    merchant_id: homeowner.merchant_id,
    homeowner_id: homeowner.id,
    leaf_slug: leafSlug,
    source_photo_url: sourcePhotoUrl,
    source_photo_phash: sourcePhash,
    prompt_json: promptJson,
    prompt_hash: promptHash,
    project_id: projectId,
    specification_id: specificationId
  };

  if (cached) {
    const { data: reused, error: reuseErr } = await supabaseAdmin
      .from("app_ai_visualiser_renders")
      .insert({
        ...insertBase,
        status: "complete",
        render_url: cached.render_url,
        render_url_hd: cached.render_url_hd,
        stego_watermark: cached.stego_watermark,
        render_provider: cached.render_provider,
        was_cache_hit: true,
        credit_consumed: false,
        ai_cost_pence: 0,
        completed_at: new Date().toISOString()
      })
      .select("id, render_url")
      .single();
    if (reuseErr || !reused) {
      return NextResponse.json(
        { ok: false, error: "Could not record cache hit." },
        { status: 500 }
      );
    }
    await bumpRateLimit(homeowner);
    await updateLead({
      merchantId: homeowner.merchant_id,
      homeownerId: homeowner.id,
      renderId: reused.id,
      bom: promptJson
    });
    return NextResponse.json({
      ok: true,
      renderId: reused.id,
      renderUrl: reused.render_url,
      cached: true
    });
  }

  // Fresh render — consume a credit (or accumulate overage) before we
  // spend money with the provider.
  const nextUsed = (creditsRow?.renders_used_this_period ?? 0) + 1;
  const overOver = Math.max(0, nextUsed - (creditsRow?.monthly_quota ?? 0));
  const addOverage =
    overOver > 0 ? (creditsRow?.overage_rate_pence ?? 30) : 0;

  await supabaseAdmin
    .from("app_ai_visualiser_credits")
    .update({
      renders_used_this_period: nextUsed,
      overage_pence: (creditsRow?.overage_pence ?? 0) + addOverage
    })
    .eq("merchant_id", homeowner.merchant_id);

  // Insert pending render row so we can update it after the provider call
  const { data: pending, error: pendingErr } = await supabaseAdmin
    .from("app_ai_visualiser_renders")
    .insert({
      ...insertBase,
      status: "pending",
      credit_consumed: true
    })
    .select("id")
    .single();
  if (pendingErr || !pending) {
    return NextResponse.json(
      { ok: false, error: "Could not queue render." },
      { status: 500 }
    );
  }

  const { provider, isLive, costPerRenderPence } =
    await resolveActiveProvider();

  if (!isLive) {
    await supabaseAdmin
      .from("app_ai_visualiser_renders")
      .update({
        status: "blocked",
        block_reason: "provider-not-configured",
        credit_consumed: false
      })
      .eq("id", pending.id);
    // Refund the credit
    await supabaseAdmin
      .from("app_ai_visualiser_credits")
      .update({
        renders_used_this_period: creditsRow?.renders_used_this_period ?? 0,
        overage_pence: creditsRow?.overage_pence ?? 0
      })
      .eq("merchant_id", homeowner.merchant_id);
    return NextResponse.json(
      { ok: false, error: "AI provider not configured. Please try again later." },
      { status: 503 }
    );
  }

  try {
    const result = await provider.generate({
      sourceImageUrl: sourcePhotoUrl,
      prompt,
      aspectRatio: "1:1",
      strength: 0.55
    });

    // Stego watermark tag — invisible + traceable
    const stego = `av:${homeowner.id.slice(0, 8)}:${pending.id.slice(0, 8)}`;

    await supabaseAdmin
      .from("app_ai_visualiser_renders")
      .update({
        status: "complete",
        render_url: result.imageUrl,
        stego_watermark: stego,
        render_provider: provider.id,
        provider_request_id: result.providerRequestId,
        ai_cost_pence: result.costPence || costPerRenderPence,
        completed_at: new Date().toISOString()
      })
      .eq("id", pending.id);

    await bumpRateLimit(homeowner);
    await updateLead({
      merchantId: homeowner.merchant_id,
      homeownerId: homeowner.id,
      renderId: pending.id,
      bom: promptJson,
      projectId
    });

    // Home Timeline event — every render is a chapter on the property
    if (homeowner.property_id) {
      void recordTimelineEvent({
        propertyId: homeowner.property_id,
        projectId,
        actorPartyId: homeowner.party_id,
        actorBusinessListingId: homeowner.merchant_id,
        verb: "render.completed",
        subjectType: "render",
        subjectId: pending.id,
        headline: `${leaf.display_name} design generated`,
        payload: {
          summary: summariseChoices(promptChoices),
          merchant_id: homeowner.merchant_id,
          render_url: result.imageUrl
        }
      });
    }

    // Publish render.completed — CRM + Business Hub subscribers do the rest.
    await publish({
      eventType: "render.completed",
      publisherApp: "ai-visualiser",
      dedupKey: `render:${pending.id}`,
      actorPartyId: homeowner.party_id,
      actorBusinessId: homeowner.merchant_id,
      propertyId: homeowner.property_id,
      projectId,
      subjectType: "render",
      subjectId: pending.id,
      payload: {
        summary: summariseChoices(promptChoices),
        leaf_display_name: leaf.display_name,
        render_url: result.imageUrl
      }
    });

    // Fire merchant email on first render (dashboard already exists)
    const { count: renderCount } = await supabaseAdmin
      .from("app_ai_visualiser_renders")
      .select("id", { count: "exact", head: true })
      .eq("homeowner_id", homeowner.id)
      .eq("status", "complete");

    if (renderCount === 1) {
      const { data: merchant } = await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("email, display_name, trading_name")
        .eq("id", homeowner.merchant_id)
        .maybeSingle();
      if (merchant?.email) {
        void sendMerchantLeadEmail({
          merchantEmail: merchant.email,
          merchantDisplayName:
            merchant.trading_name || merchant.display_name || "there",
          homeowner: {
            fullName: homeowner.full_name,
            email: homeowner.email,
            whatsappE164: homeowner.whatsapp_e164,
            homePhone: homeowner.home_phone,
            postcode: homeowner.postcode
          },
          leafDisplayName: leaf.display_name,
          designSummary: summariseChoices(promptChoices),
          renderThumbUrl: result.imageUrl,
          dashboardLink: `${process.env.NEXT_PUBLIC_APP_URL || "https://xratedtrade.com"}/dashboard/leads/${homeowner.id}`,
          isFirstContact: false
        });
      }
    }

    return NextResponse.json({
      ok: true,
      renderId: pending.id,
      renderUrl: result.imageUrl,
      cached: false
    });
  } catch (err) {
    console.error("[ai-visualiser] render failed", err);
    await supabaseAdmin
      .from("app_ai_visualiser_renders")
      .update({
        status: "failed",
        block_reason: String(err).slice(0, 240)
      })
      .eq("id", pending.id);
    // Refund the credit on failure
    await supabaseAdmin
      .from("app_ai_visualiser_credits")
      .update({
        renders_used_this_period: creditsRow?.renders_used_this_period ?? 0,
        overage_pence: creditsRow?.overage_pence ?? 0
      })
      .eq("merchant_id", homeowner.merchant_id);
    return NextResponse.json(
      { ok: false, error: "Render failed. No credit consumed." },
      { status: 502 }
    );
  }
}

async function bumpRateLimit(homeowner: {
  id: string;
  renders_today: number;
  renders_this_week: number;
  day_window_started_at: string;
  week_window_started_at: string;
}) {
  const now = new Date();
  const dayStart = new Date(homeowner.day_window_started_at);
  const weekStart = new Date(homeowner.week_window_started_at);
  const dayExpired = now.getTime() - dayStart.getTime() > 86_400_000;
  const weekExpired = now.getTime() - weekStart.getTime() > 604_800_000;
  await supabaseAdmin
    .from("app_ai_visualiser_homeowners")
    .update({
      renders_today: dayExpired ? 1 : homeowner.renders_today + 1,
      renders_this_week: weekExpired ? 1 : homeowner.renders_this_week + 1,
      day_window_started_at: dayExpired ? now.toISOString() : homeowner.day_window_started_at,
      week_window_started_at: weekExpired ? now.toISOString() : homeowner.week_window_started_at
    })
    .eq("id", homeowner.id);
}

async function updateLead({
  merchantId,
  homeownerId,
  renderId,
  bom,
  projectId
}: {
  merchantId: string;
  homeownerId: string;
  renderId: string;
  bom: Record<string, unknown>;
  projectId?: string | null;
}) {
  const { data: existing } = await supabaseAdmin
    .from("app_ai_visualiser_leads")
    .select("render_count, first_render_at")
    .eq("homeowner_id", homeownerId)
    .maybeSingle();

  await supabaseAdmin
    .from("app_ai_visualiser_leads")
    .upsert(
      {
        merchant_id: merchantId,
        homeowner_id: homeownerId,
        hottest_render_id: renderId,
        render_count: (existing?.render_count ?? 0) + 1,
        first_render_at: existing?.first_render_at ?? new Date().toISOString(),
        last_render_at: new Date().toISOString(),
        bom_summary: bom,
        project_id: projectId ?? null
      },
      { onConflict: "homeowner_id" }
    );
}
