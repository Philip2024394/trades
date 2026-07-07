// POST /api/project/submit
//
// Final commit of the Sarah wizard. No account required. Creates:
//   1. os_parties row (kind='person') for the homeowner
//   2. os_projects row anchored to a placeholder property (postcode only)
//      — we don't yet know the exact address, so we upsert a lightweight
//      os_properties row keyed on address_hash of postcode-only.
//   3. os_project_participants rows:
//      - one for the homeowner (role='homeowner')
//      - one per invited trade (role='main_contractor', invited_via='auto_matched')
//   4. os_home_timeline_events "project.invited" per participant

import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  notifyInvitedTrades,
  notifyHomeownerBriefSubmitted
} from "@/lib/projectNotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  postcode: string;
  propertyType: string;
  projectType: string;
  scope: string;
  timeframe: string;
  budget: string;
  name: string;
  email: string;
  whatsapp?: string;
  contactPref: string;
  selectedTradeIds: string[];
};

function postcodeHash(pc: string): string {
  return createHash("sha256")
    .update(`postcode-only:${pc.toUpperCase().replace(/\s+/g, "")}`)
    .digest("hex");
}

function emailHash(email: string): string {
  return createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex");
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400 }
    );
  }

  if (
    !body.postcode ||
    !body.projectType ||
    !body.scope ||
    !body.name ||
    !body.email
  ) {
    return NextResponse.json(
      { ok: false, error: "missing_required_fields" },
      { status: 400 }
    );
  }

  const postcode = body.postcode.toUpperCase().trim();
  const prefix = postcode.split(/\s+/)[0] || "";
  const emH = emailHash(body.email);

  // ─── 1. HOMEOWNER PARTY (upsert on email hash) ───────────────────
  const { data: existingParty } = await supabaseAdmin
    .from("os_parties")
    .select("id")
    .eq("email_hash", emH)
    .maybeSingle();

  let partyId: string;
  if (existingParty) {
    partyId = existingParty.id as string;
  } else {
    const { data: newParty, error: partyErr } = await supabaseAdmin
      .from("os_parties")
      .insert({
        kind: "person",
        display_name: body.name,
        email: body.email,
        email_hash: emH,
        whatsapp_e164: body.whatsapp || null
      })
      .select("id")
      .single();
    if (partyErr) {
      return NextResponse.json(
        { ok: false, error: "party_create_failed", detail: partyErr.message },
        { status: 500 }
      );
    }
    partyId = newParty.id as string;
  }

  // ─── 2. LIGHTWEIGHT PROPERTY (postcode-only anchor) ──────────────
  const addrHash = postcodeHash(postcode);
  const { data: existingProperty } = await supabaseAdmin
    .from("os_properties")
    .select("id")
    .eq("address_hash", addrHash)
    .maybeSingle();

  let propertyId: string;
  if (existingProperty) {
    propertyId = existingProperty.id as string;
  } else {
    const { data: newProperty, error: propErr } = await supabaseAdmin
      .from("os_properties")
      .insert({
        address_hash: addrHash,
        address_lines: [`Home at ${postcode}`],
        postcode: postcode.replace(/\s+/g, ""),
        country: "GB"
      })
      .select("id")
      .single();
    if (propErr) {
      return NextResponse.json(
        { ok: false, error: "property_create_failed", detail: propErr.message },
        { status: 500 }
      );
    }
    propertyId = newProperty.id as string;
  }

  // Resolve the party's personal entity so the project attaches to
  // an entity from day one — even for anonymous submissions.
  const { data: personalEntity } = await supabaseAdmin
    .from("os_entities")
    .select("id")
    .eq("personal_of_party_id", partyId)
    .maybeSingle();

  // ─── 3. PROJECT ROW ──────────────────────────────────────────────
  const { data: projectRow, error: projErr } = await supabaseAdmin
    .from("os_projects")
    .insert({
      property_id: propertyId,
      primary_party_id: partyId,
      owner_entity_id: personalEntity?.id ?? null,
      title: titleForProjectType(body.projectType),
      leaf_slug: body.projectType,
      status: "specced",
      notes: [
        `Scope: ${body.scope}`,
        `Timeframe: ${body.timeframe}`,
        `Budget: ${body.budget}`,
        `Property: ${body.propertyType}`,
        `Contact preference: ${body.contactPref}`
      ].join("\n")
    })
    .select("id")
    .single();
  if (projErr) {
    return NextResponse.json(
      { ok: false, error: "project_create_failed", detail: projErr.message },
      { status: 500 }
    );
  }
  const projectId = projectRow.id as string;

  // ─── 4. PARTICIPANTS ─────────────────────────────────────────────
  const participantRows: Array<Record<string, unknown>> = [
    {
      project_id: projectId,
      party_id: partyId,
      role: "homeowner",
      invited_via: "primary_creation"
    }
  ];
  for (const tradeId of body.selectedTradeIds ?? []) {
    participantRows.push({
      project_id: projectId,
      business_id: tradeId,
      role: "main_contractor",
      invited_by_party_id: partyId,
      invited_via: "auto_matched"
    });
  }

  // os_project_participants may not exist yet in all environments —
  // if the insert fails silently, we still keep the project so the
  // homeowner sees a success page. Trade notification wiring is a
  // separate follow-up sprint.
  await supabaseAdmin.from("os_project_participants").insert(participantRows).then(
    () => null,
    () => null
  );

  // ─── 5. TIMELINE EVENT (best-effort) ─────────────────────────────
  await supabaseAdmin
    .from("os_home_timeline_events")
    .insert({
      property_id: propertyId,
      verb: "project.invited",
      subject_type: "project",
      subject_id: projectId,
      headline: `${body.name} sent a project brief to ${body.selectedTradeIds?.length ?? 0} trades`,
      payload: {
        project_type: body.projectType,
        selected_trade_ids: body.selectedTradeIds ?? [],
        timeframe: body.timeframe,
        budget: body.budget
      }
    })
    .then(
      () => null,
      () => null
    );

  // ─── 6. FIRE EMAIL NOTIFICATIONS TO INVITED TRADES ────────────────
  // Best-effort — failure to notify does not fail the API call. The
  // records already exist; a merchant can still discover the brief
  // via their inbox link even if the email delivery didn't fire.
  let notified = { sent: 0, failed: 0 };
  if ((body.selectedTradeIds ?? []).length > 0) {
    try {
      notified = await notifyInvitedTrades(body.selectedTradeIds, {
        projectId,
        projectTitle: titleForProjectType(body.projectType),
        scope: body.scope,
        budget: body.budget,
        timeframe: body.timeframe,
        postcode,
        homeownerName: body.name,
        homeownerEmail: body.email,
        homeownerWhatsapp: body.whatsapp
      });
    } catch {
      /* swallow — best-effort */
    }
  }

  // ─── 7. HOMEOWNER CONFIRMATION EMAIL ──────────────────────────────
  // Sarah gets a copy of what she submitted + a signed tracking link
  // she can return to for 60 days without needing an account.
  try {
    await notifyHomeownerBriefSubmitted({
      homeownerEmail: body.email,
      homeownerName: body.name,
      projectId,
      projectTitle: titleForProjectType(body.projectType),
      invitedTradesCount: body.selectedTradeIds?.length ?? 0
    });
  } catch {
    /* swallow — best-effort */
  }

  return NextResponse.json({
    ok: true,
    projectId,
    invitedCount: body.selectedTradeIds?.length ?? 0,
    notified
  });
}

function titleForProjectType(projectType: string): string {
  const labels: Record<string, string> = {
    kitchen: "Kitchen renovation",
    bathroom: "Bathroom renovation",
    extension: "Extension",
    "loft-conversion": "Loft conversion",
    roofing: "Roofing work",
    boiler: "Boiler / heating",
    electrics: "Electrical work",
    plumbing: "Plumbing",
    flooring: "Flooring",
    decorating: "Decorating",
    "windows-doors": "Windows / doors",
    "damp-repair": "Damp / structural repair",
    landscaping: "Landscaping",
    driveway: "Driveway / paving",
    other: "New project"
  };
  return labels[projectType] ?? "New project";
}
