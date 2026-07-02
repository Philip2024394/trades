// POST /api/plant-hire/applications — persists a careers application
// submitted from /plant-hire/careers. Returns { reference } which the
// wizard drops into the WhatsApp handoff message so the merchant can
// look it up in the dashboard.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type ExperienceBlock = {
  employer?: unknown;
  role?: unknown;
  years?: unknown;
  duties?: unknown;
};

type Body = {
  listing_slug: string;
  role_slugs: string[];
  applicant_name: string;
  applicant_email?: string;
  applicant_phone: string;
  applicant_age?: number;
  applicant_postcode?: string;
  applicant_city?: string;
  right_to_work?: string;
  driving_licence_classes?: string[];
  cpc_expiry?: string;
  has_digitacho?: boolean;
  qualifications_note?: string;
  years_experience?: number;
  experience?: ExperienceBlock[];
  notice_period?: string;
  salary_expectation?: string;
  available_from?: string;
  work_pattern?: string;
  cv_url?: string;
  cover_note?: string;
};

function s(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function n(v: unknown): number | null {
  const num = Number(v);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num);
}

function buildReference(): string {
  const year = new Date().getFullYear();
  const rnd = Math.floor(10000 + Math.random() * 90000);
  return `APP-${year}-${rnd}`;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (
    !body.listing_slug ||
    !Array.isArray(body.role_slugs) ||
    body.role_slugs.length === 0 ||
    !body.applicant_name ||
    !body.applicant_phone
  ) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id")
    .eq("slug", body.listing_slug)
    .maybeSingle();
  if (!listing.data) {
    return NextResponse.json({ error: "listing_not_found" }, { status: 404 });
  }

  const reference = buildReference();
  const experience = Array.isArray(body.experience)
    ? body.experience
        .map((e) => ({
          employer: s(e.employer, 120),
          role: s(e.role, 120),
          years: n(e.years) ?? 0,
          duties: s(e.duties, 500)
        }))
        .filter((e) => e.employer || e.role)
        .slice(0, 10)
    : [];

  const licenceClasses = Array.isArray(body.driving_licence_classes)
    ? body.driving_licence_classes
        .filter((c): c is string => typeof c === "string")
        .map((c) => c.slice(0, 10))
        .slice(0, 12)
    : [];

  const roles = body.role_slugs.filter((r): r is string => typeof r === "string").slice(0, 10);

  const insert = await supabaseAdmin
    .from("hammerex_plant_hire_applications")
    .insert({
      listing_id: listing.data.id,
      reference,
      role_slugs: roles,
      applicant_name: s(body.applicant_name, 120),
      applicant_email: s(body.applicant_email, 200),
      applicant_phone: s(body.applicant_phone, 30),
      applicant_age: n(body.applicant_age),
      applicant_postcode: s(body.applicant_postcode, 12).toUpperCase(),
      applicant_city: s(body.applicant_city, 80),
      right_to_work: s(body.right_to_work, 40),
      driving_licence_classes: licenceClasses,
      cpc_expiry:
        body.cpc_expiry && /^\d{4}-\d{2}-\d{2}$/.test(body.cpc_expiry)
          ? body.cpc_expiry
          : null,
      has_digitacho: body.has_digitacho === true,
      qualifications_note: s(body.qualifications_note, 1000),
      years_experience: n(body.years_experience),
      experience,
      notice_period: s(body.notice_period, 40),
      salary_expectation: s(body.salary_expectation, 40),
      available_from:
        body.available_from && /^\d{4}-\d{2}-\d{2}$/.test(body.available_from)
          ? body.available_from
          : null,
      work_pattern: s(body.work_pattern, 40),
      cv_url: s(body.cv_url, 800),
      cover_note: s(body.cover_note, 2000),
      status: "new"
    })
    .select("id, reference")
    .single();

  if (insert.error) {
    return NextResponse.json({ error: insert.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    id: insert.data.id,
    reference: insert.data.reference
  });
}
