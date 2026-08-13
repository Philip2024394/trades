// POST /api/nex/collector/[category]/save
// (moved from /api/admin/collector 2026-08-13 per Philip's "one NEX HQ" directive)
//
// Worker Collector save endpoint. Writes to the Supabase directory_seeds
// table (Philip 2026-08-13 · Option B migration). Uses SQL-backed duplicate
// detection via findDuplicateCandidates. Enforces directory_state defaults
// and never auto-promotes.
//
// Guards:
//   · isAdminAuthed() from @/lib/adminAuth (reuses existing session)
//   · category must be enabled in TRADE_CATEGORY_REGISTRY
//   · duplicates block save unless client sends { force_create: true }
//
// Never fabricates data. Empty strings become null.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { isAdminAuthed } from "@/lib/adminAuth";
import { getTradeCategory } from "@/lib/nex/centre-publishing/tradeCategoryRegistry";
import { findDuplicateCandidates, insertDirectorySeed } from "@/lib/nex/centre-publishing/directorySeedsDb";
import type { DirectorySeed, EmailStatus } from "@/lib/nex/centre-publishing/directorySeedLoader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CapabilityAnswer = "yes" | "no" | "unknown";

type FormPayload = {
  form: {
    business_name: string;
    trading_name:  string;
    website:       string;
    description:   string;
    address_line_1: string;
    town:          string;
    county:        string;
    postcode:      string;
    service_area:  string;
    telephone:     string;
    email:         string;
    email_source_url: string;
    email_status:  "" | EmailStatus;
    google_rating:      string;
    google_review_count: string;
    google_maps_url:    string;
    discovery_source:   string;
    worker_notes:       string;
    refacing_qualification: "" | "A+" | "A" | "B" | "C" | "excluded";
    evidence_url:       string;
    evidence_type:      string;
    evidence_category:  string;
    evidence_summary:   string;
  };
  capabilities: Record<string, CapabilityAnswer>;
  force_create?: boolean;
};

// ─── helpers ──────────────────────────────────────────────────
function nullify(s: string): string | null { return s.trim().length === 0 ? null : s.trim(); }
function num(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
function slugify(name: string, town: string): string {
  const base = `${name}-${town}`.toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || randomUUID().slice(0, 8);
}

/** Resolve email_status from the form. Enforces "verified" requires an email present
 *  and "not_found" requires no email. Yellow state (needs_manual_verification) can
 *  hold either present-but-unconfirmed OR observed-but-not-extractable. */
function resolveEmailStatus(email: string | null, requested: FormPayload["form"]["email_status"]): EmailStatus {
  const hasEmail = Boolean(email && email.trim());
  if (requested === "verified") {
    return hasEmail ? "verified" : "needs_manual_verification"; // silently downgrade — you can't verify what isn't there
  }
  if (requested === "not_found") {
    return hasEmail ? "needs_manual_verification" : "not_found"; // silently upgrade — email present means not "not_found"
  }
  if (requested === "needs_manual_verification") return "needs_manual_verification";
  // No explicit request: derive from email presence
  return hasEmail ? "needs_manual_verification" : "not_found";
}

// ─── handler ──────────────────────────────────────────────────
export async function POST(req: NextRequest, ctx: { params: Promise<{ category: string }> }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }
  const { category } = await ctx.params;
  const config = getTradeCategory(category);
  if (!config || !config.enabled) {
    return NextResponse.json({ ok: false, error: `category_not_enabled: ${category}` }, { status: 400 });
  }

  let body: FormPayload;
  try { body = (await req.json()) as FormPayload; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const f = body.form;
  if (!f?.business_name || f.business_name.trim().length < 2) {
    return NextResponse.json({ ok: false, error: "business_name_required" }, { status: 400 });
  }

  // ─── duplicate check ──────────────────────────────────
  if (!body.force_create) {
    const duplicates = await findDuplicateCandidates({
      business_name: f.business_name,
      website:       f.website,
      telephone:     f.telephone,
      email:         f.email,
      postcode:      f.postcode,
      town:          f.town,
    });
    if (duplicates.length > 0) {
      return NextResponse.json({ ok: true, created: false, duplicates: duplicates.slice(0, 5) });
    }
  }

  // ─── build seed record ────────────────────────────────
  const nowIso = new Date().toISOString();
  const todayDate = nowIso.slice(0, 10);
  const town = f.town.trim() || "uk";
  const slug = slugify(f.business_name, town);
  const email = nullify(f.email);
  const emailStatus = resolveEmailStatus(email, f.email_status);

  const seed: Partial<DirectorySeed> = {
    id:              randomUUID(),
    slug,
    business_name:   f.business_name.trim(),
    category:        config.displayName,
    primary_trade:   config.primaryTradeSlug,
    tags:            [],
    enrichment_status: "partial",
    last_verified_at: nowIso,

    address_line_1:  nullify(f.address_line_1),
    address_line_2:  null,
    town:            nullify(f.town),
    county:          nullify(f.county),
    postcode:        nullify(f.postcode),
    country:         "United Kingdom",

    telephone:       nullify(f.telephone),
    website:         nullify(f.website),
    email,

    opening_hours:   null,
    description:     nullify(f.description),
    services:        [],

    google_rating:       num(f.google_rating),
    google_review_count: num(f.google_review_count) ?? undefined,
    google_maps_url:     nullify(f.google_maps_url),

    latitude:  null,
    longitude: null,

    status:     "listed",
    claimed:    false,
    verified:   false,
    visibility: "public",

    photos:      [],
    cover_image: null,

    source:      "refacing_discovery",
    imported_at: nowIso,

    // Refacing/collector-specific
    capabilities:           body.capabilities ?? {},
    refacing_qualification: (f.refacing_qualification || undefined) as DirectorySeed["refacing_qualification"],
    refacing_evidence:      f.evidence_url.trim()
      ? [{
          url:        f.evidence_url.trim(),
          type:       f.evidence_type || "company_website",
          category:   f.evidence_category || "other",
          summary:    f.evidence_summary || "(no summary supplied)",
          checked_at: todayDate,
        }]
      : [],
    email_source:     email ? "company_website" : null,
    email_verified:   emailStatus === "verified",
    email_checked_at: email ? todayDate : null,
    lifecycle_status: "unclaimed",
    directory_state:  "listed",
    email_status:     emailStatus,
  };

  // ─── insert into Supabase ─────────────────────────────
  const result = await insertDirectorySeed(seed);
  if (!result.ok) {
    if (result.error.startsWith("duplicate:")) {
      return NextResponse.json({
        ok: true,
        created: false,
        duplicates: [{
          match_type: "strong",
          id: seed.id!,
          slug,
          business_name: f.business_name,
          town: nullify(f.town),
          signal: `database unique constraint violated (${result.error})`,
        }],
      });
    }
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    created: true,
    listing_id: result.id,
    slug: result.slug,
    directory_url: config.publicDirectoryUrl,
  });
}
