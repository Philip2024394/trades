// POST /api/nex/provider/register · Philip 2026-08-29
// GET  /api/nex/provider/register?learner_ref=... · returns own profile if any
//
// CANONICAL provider registration path (mobility doctrine v5, Provider ≠ Driver).
// Writes directly to nex.provider_profile — never through the deprecated
// nex.driver_profile compat view, which is lossy on is_available and
// price_per_service_idr.
//
// Doctrine anchors:
//   · Data safety (Philip 2026-08-28): server-side Postgres only
//   · Identity: learner_ref = nex_id:{n} or device:{uuid}
//   · Indonesia PDP UU 27/2022: provider supplies real name + WhatsApp
//     + bike details for user safety and platform accountability
//   · Status starts 'pending_review' · admin approval to activate
//   · Provider sets their own price (locks 26/32) and availability (lock 40)

import { NextRequest, NextResponse } from "next/server";
import pg from "pg";
import { getPostgresUrl } from "@/lib/nex/config/pg";

const { Pool } = pg;
let pool: pg.Pool | null = null;
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getPostgresUrl(),
      max: 3,
    });
  }
  return pool;
}

function validateLearnerRef(ref: unknown): string | null {
  if (typeof ref !== "string") return null;
  const trimmed = ref.trim();
  if (!/^(nex_id:\d+|device:[a-zA-Z0-9-]{16,})$/.test(trimmed)) return null;
  return trimmed;
}

function validateHexColor(hex: unknown): string | null {
  if (typeof hex !== "string") return null;
  const trimmed = hex.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(trimmed)) return null;
  return trimmed;
}

function validateWhatsApp(w: unknown): string | null {
  if (typeof w !== "string") return null;
  const trimmed = w.trim().replace(/\s|-/g, "");
  if (!/^\+62\d{8,13}$/.test(trimmed)) return null;
  return trimmed;
}

function validatePrice(p: unknown): number | null {
  if (p == null || p === "") return null;
  const n = Number(p);
  if (!Number.isFinite(n)) return null;
  if (n < 1000 || n > 5_000_000) return null;
  return Math.round(n);
}

export async function GET(req: NextRequest) {
  const learner = validateLearnerRef(req.nextUrl.searchParams.get("learner_ref"));
  if (!learner) return NextResponse.json({ ok: false, error: "invalid learner_ref" }, { status: 400 });

  const client = await getPool().connect();
  try {
    const { rows } = await client.query(
      `SELECT provider_id, full_name, whatsapp_e164, photo_url,
              bike_slug, bike_year, bike_color_hex, plate, city,
              secondary_language, provides_raincoat,
              price_per_service_idr, is_available,
              status, rating_avg, rating_count, registered_at
       FROM nex.provider_profile
       WHERE learner_ref = $1
       LIMIT 1`,
      [learner],
    );
    return NextResponse.json({ ok: true, profile: rows[0] ?? null });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  try { payload = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 }); }

  const learner       = validateLearnerRef(payload.learner_ref);
  const fullName      = typeof payload.full_name === "string" ? payload.full_name.trim() : "";
  const whatsapp      = validateWhatsApp(payload.whatsapp_e164);
  const photoUrl      = typeof payload.photo_url === "string" ? payload.photo_url.trim() : null;
  const bikeSlug      = typeof payload.bike_slug === "string" ? payload.bike_slug.trim() : "";
  const bikeYear      = Number(payload.bike_year);
  const bikeColorHex  = validateHexColor(payload.bike_color_hex);
  const plate         = typeof payload.plate === "string" ? payload.plate.trim().toUpperCase() : "";
  const city          = typeof payload.city === "string" ? payload.city.trim() : "";
  const secondaryLang = typeof payload.secondary_language === "string"
                          ? (payload.secondary_language.trim() || null)
                          : null;
  const providesRain  = Boolean(payload.provides_raincoat);
  const priceIdr      = validatePrice(payload.price_per_service_idr);
  const isAvailable   = payload.is_available == null ? false : Boolean(payload.is_available);

  const errors: string[] = [];
  if (!learner)                                    errors.push("learner_ref invalid (expect nex_id:{n} or device:{uuid})");
  if (fullName.length < 2 || fullName.length > 80) errors.push("full_name 2-80 chars");
  if (!whatsapp)                                   errors.push("whatsapp_e164 invalid (expect +62...)");
  if (!bikeSlug)                                   errors.push("bike_slug required");
  if (!Number.isFinite(bikeYear) || bikeYear < 1980 || bikeYear > 2030)
                                                   errors.push("bike_year 1980-2030");
  if (!bikeColorHex)                               errors.push("bike_color_hex invalid (expect #RRGGBB)");
  if (!plate)                                      errors.push("plate required");
  if (!city)                                       errors.push("city required");
  if (payload.price_per_service_idr != null && priceIdr == null)
                                                   errors.push("price_per_service_idr must be 1000-5000000 IDR");
  if (errors.length > 0) return NextResponse.json({ ok: false, errors }, { status: 400 });

  const client = await getPool().connect();
  try {
    const bikeExists = await client.query(
      `SELECT 1 FROM nex.bike_model WHERE slug = $1 AND is_active = true LIMIT 1`,
      [bikeSlug],
    );
    if (bikeExists.rowCount === 0) {
      return NextResponse.json({ ok: false, error: `bike_slug "${bikeSlug}" not found` }, { status: 404 });
    }

    // UPSERT on learner_ref · canonical write path · provider_profile directly
    const { rows } = await client.query(
      `INSERT INTO nex.provider_profile
         (learner_ref, full_name, whatsapp_e164, photo_url,
          bike_slug, bike_year, bike_color_hex, plate, city,
          secondary_language, provides_raincoat,
          price_per_service_idr, is_available)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (learner_ref) DO UPDATE SET
         full_name             = EXCLUDED.full_name,
         whatsapp_e164         = EXCLUDED.whatsapp_e164,
         photo_url             = EXCLUDED.photo_url,
         bike_slug             = EXCLUDED.bike_slug,
         bike_year             = EXCLUDED.bike_year,
         bike_color_hex        = EXCLUDED.bike_color_hex,
         plate                 = EXCLUDED.plate,
         city                  = EXCLUDED.city,
         secondary_language    = EXCLUDED.secondary_language,
         provides_raincoat     = EXCLUDED.provides_raincoat,
         price_per_service_idr = COALESCE(EXCLUDED.price_per_service_idr,
                                          nex.provider_profile.price_per_service_idr),
         is_available          = EXCLUDED.is_available,
         updated_at            = now()
       RETURNING provider_id, status, registered_at, (xmax = 0) AS is_new`,
      [learner, fullName, whatsapp, photoUrl, bikeSlug, bikeYear, bikeColorHex,
       plate, city, secondaryLang, providesRain, priceIdr, isAvailable],
    );

    // Ensure a wallet row exists · lock 42 (broadcast eligibility gate)
    await client.query(
      `INSERT INTO nex.provider_wallet (provider_id, balance_idr)
       VALUES ($1, 0)
       ON CONFLICT (provider_id) DO NOTHING`,
      [rows[0].provider_id],
    );

    return NextResponse.json({ ok: true, ...rows[0] });
  } finally {
    client.release();
  }
}
