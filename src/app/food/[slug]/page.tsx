// /food/[slug] · customer-facing business profile page.
//
// The missing arrow between /food discovery and a real customer→owner
// conversation. Purpose: close Checkpoint 5 (customer enquiry) by giving
// a customer somewhere to land after tapping a card, and one clear action
// — Message on WhatsApp — that fires a real WhatsApp deep-link against
// the owner_verified (or seed-source) WhatsApp number.
//
// Doctrine anchors:
//   · project_nex_food_flywheel_over_scraping_2026_08_21 (arrow 5-6:
//     customers can discover/contact them · customer enquiries create value)
//   · project_nex_food_discovery_yogyakarta_v1_2026_08_21 (profile shape:
//     HERO → IDENTITY → INFORMATION → NEX ACTION AREA · warm/appetising)
//   · project_nex_should_know_not_ask_2026_08_21 (no fields to fill · just
//     "Message on WhatsApp" as primary action)
//
// SSR only · off-white palette matches /food · Bahasa Indonesia primary.

import { notFound } from "next/navigation";
import Link from "next/link";
import { getFoodDbPool } from "@/lib/nex-food/db";
import { slugToRef } from "@/lib/nex-food/claim-codes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CATEGORY_LABELS: Record<string, { id: string; en: string; emoji: string }> = {
  "restaurant":        { id: "Restoran",              en: "Restaurant",       emoji: "🍽️" },
  "coffee-cafe":       { id: "Kafe & Kopi",           en: "Coffee & Cafés",   emoji: "☕" },
  "fast-food":         { id: "Makanan Cepat Saji",    en: "Fast Food",        emoji: "🍔" },
  "ice-cream-dessert": { id: "Es Krim & Dessert",     en: "Ice Cream & Dessert", emoji: "🍨" },
};

interface BusinessRow {
  public_listing_ref: string;
  business_name: string;
  category: string;
  address: string | null;
  district: string | null;
  city: string;
  coordinates_lat: number | null;
  coordinates_lng: number | null;
  phone: string | null;
  whatsapp_number: string | null;
  website: string | null;
  opening_information: unknown;
  claim_status: string;
  owner_status: string;
  hero_image_url: string | null;
  hero_image_approved: boolean;
  rating: number | null;
  review_count: number | null;
  source: string;
  source_licence_terms: string | null;
}

async function loadBusiness(ref: string): Promise<BusinessRow | null> {
  const pool = getFoodDbPool();
  const q = await pool.query<BusinessRow>(
    `SELECT public_listing_ref, business_name, category, address, district, city,
            coordinates_lat, coordinates_lng, phone, whatsapp_number, website,
            opening_information, claim_status, owner_status,
            hero_image_url, hero_image_approved, rating, review_count,
            source, source_licence_terms
     FROM nex.food_business
     WHERE public_listing_ref = $1
     LIMIT 1`,
    [ref]
  );
  return q.rows[0] ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^\d{4}-[A-HJ-KM-NP-TV-Z0-9]{5}$/.test(slug)) return { title: "NEX Food" };
  const b = await loadBusiness(slugToRef(slug));
  if (!b) return { title: "NEX Food" };
  return {
    title: `${b.business_name} · NEX Food Yogyakarta`,
    description: b.address
      ? `${b.business_name} · ${b.address} · Yogyakarta`
      : `${b.business_name} di NEX Food Yogyakarta`,
  };
}

function normaliseWhatsAppForLink(raw: string): string {
  return raw.replace(/\D/g, "");
}

function buildWaLink(number: string, businessName: string): string {
  const digits = normaliseWhatsAppForLink(number);
  const text = `Halo, saya melihat Anda di NEX Food. `;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function buildTelLink(number: string): string {
  return `tel:${number.replace(/\s/g, "")}`;
}

export default async function FoodProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^\d{4}-[A-HJ-KM-NP-TV-Z0-9]{5}$/.test(slug)) notFound();
  const ref = slugToRef(slug);
  const b = await loadBusiness(ref);
  if (!b) notFound();

  const cat = CATEGORY_LABELS[b.category] ?? { id: b.category, en: b.category, emoji: "🍽️" };
  const showHero = b.hero_image_url && b.hero_image_approved;
  const isMember = b.claim_status === "claimed" || b.claim_status === "paying";
  const hasWhatsApp = Boolean(b.whatsapp_number);
  const hasPhone = Boolean(b.phone);
  const noContact = !hasWhatsApp && !hasPhone;
  const claimableNoContact = noContact && ["discovered", "listed", "invited"].includes(b.claim_status);

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#faf7f2",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    }}>
      {/* HERO */}
      <div style={{
        position: "relative",
        width: "100%",
        aspectRatio: "5/3",
        background: showHero ? "#e5e5e5" : "linear-gradient(135deg, #fed7aa 0%, #fef3c7 50%, #f5f5f4 100%)",
        overflow: "hidden",
      }}>
        {showHero && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={b.hero_image_url!}
            alt={b.business_name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        )}
        {!showHero && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 72, opacity: 0.5,
          }} aria-hidden>{cat.emoji}</div>
        )}
        {/* Back to directory */}
        <Link href="/food" style={{
          position: "absolute", top: 12, left: 12,
          padding: "8px 12px", borderRadius: 999,
          background: "rgba(255,255,255,0.92)", color: "#1a1a1a",
          fontSize: 12, fontWeight: 600, textDecoration: "none",
          boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
        }}>← Kembali</Link>
        {/* Membership pill */}
        {isMember && (
          <span style={{
            position: "absolute", top: 12, right: 12,
            padding: "5px 10px", borderRadius: 999,
            background: "#16a34a", color: "#fff",
            fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
          }}>NEX MEMBER</span>
        )}
      </div>

      <div style={{ maxWidth: 640, margin: "-40px auto 0", padding: "0 16px 60px", position: "relative", zIndex: 1 }}>
        {/* IDENTITY card · lifted */}
        <div style={{
          background: "#fff",
          borderRadius: 16,
          padding: "20px 20px 16px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
          border: "1px solid rgba(0,0,0,0.04)",
        }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: "#f97316", fontWeight: 700, marginBottom: 8 }}>
            {cat.id.toUpperCase()} · {cat.en.toUpperCase()}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 6px", lineHeight: 1.2, color: "#1a1a1a" }}>
            {b.business_name}
          </h1>
          <div style={{ fontSize: 12.5, color: "#7a7a7a", lineHeight: 1.5 }}>
            {b.address ?? "Yogyakarta"} · {b.public_listing_ref}
          </div>
          {typeof b.rating === "number" && (
            <div style={{ marginTop: 10, fontSize: 12.5, color: "#333" }}>
              ⭐ <strong>{b.rating.toFixed(1)}</strong>
              {b.review_count != null && <span style={{ color: "#8a8a8a" }}> ({b.review_count} ulasan)</span>}
            </div>
          )}
          <OpeningHoursBlock info={b.opening_information} />
        </div>

        {/* NEX ACTION AREA · the point of this page */}
        <div style={{ marginTop: 16 }}>
          {hasWhatsApp ? (
            <a
              href={buildWaLink(b.whatsapp_number!, b.business_name)}
              target="_blank"
              rel="noopener noreferrer"
              style={primaryActionStyle("whatsapp")}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>💬</span>
              <span>Pesan lewat WhatsApp</span>
            </a>
          ) : hasPhone ? (
            <a href={buildTelLink(b.phone!)} style={primaryActionStyle("phone")}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>📞</span>
              <span>Telepon {b.business_name}</span>
            </a>
          ) : (
            <div style={noContactCardStyle}>
              <div style={{ fontSize: 12.5, color: "#7a5a3a", lineHeight: 1.55 }}>
                Bisnis ini belum menghubungkan kontak WhatsApp/telepon ke NEX Food.
              </div>
            </div>
          )}

          {/* Website · secondary action if present */}
          {b.website && (
            <a
              href={b.website.startsWith("http") ? b.website : "https://" + b.website}
              target="_blank"
              rel="noopener noreferrer"
              style={secondaryActionStyle}
            >
              <span style={{ fontSize: 16 }}>🌐</span>
              <span>Kunjungi website</span>
            </a>
          )}
        </div>

        {/* Contextual claim prompt · owner-pull entry point when no contact */}
        {claimableNoContact && (
          <div style={claimPromptStyle}>
            <div style={{ fontSize: 11, letterSpacing: 2, color: "#c2410c", fontWeight: 700, marginBottom: 6 }}>
              APAKAH INI BISNIS ANDA?
            </div>
            <div style={{ fontSize: 13, color: "#4a4a4a", lineHeight: 1.55, marginBottom: 12 }}>
              Klaim {b.business_name} di NEX Food untuk menerima pertanyaan
              pelanggan langsung di WhatsApp Anda.
            </div>
            <Link
              href={`/food/register?claimRef=${encodeURIComponent(b.public_listing_ref)}`}
              style={claimButtonStyle}
            >
              Ya, saya pemilik bisnis ini
            </Link>
          </div>
        )}

        {/* Provenance footer · quiet honesty about data source */}
        <div style={{
          marginTop: 32, paddingTop: 16,
          borderTop: "1px solid rgba(0,0,0,0.08)",
          fontSize: 10.5, color: "#8a8a8a", lineHeight: 1.5,
        }}>
          Data bisnis: {b.source}
          {b.source_licence_terms && (
            <div style={{ marginTop: 4, opacity: 0.75 }}>{b.source_licence_terms}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Opening hours can be null, an OSM-style string, or a structured jsonb.
// Render only when we can produce something confidently human-readable —
// never invent hours we don't have (data-honesty rule per Food doctrine).
function OpeningHoursBlock({ info }: { info: unknown }) {
  if (!info) return null;
  if (typeof info === "string") {
    return (
      <div style={{ marginTop: 10, fontSize: 12, color: "#5a5a5a", lineHeight: 1.5 }}>
        <span style={{ fontWeight: 600, color: "#4a4a4a" }}>Jam buka:</span> {info}
      </div>
    );
  }
  if (typeof info === "object") {
    const obj = info as Record<string, unknown>;
    const days = ["mon","tue","wed","thu","fri","sat","sun"];
    const dayLabels: Record<string,string> = { mon:"Sen", tue:"Sel", wed:"Rab", thu:"Kam", fri:"Jum", sat:"Sab", sun:"Min" };
    const rows: { label: string; hours: string }[] = [];
    for (const d of days) {
      const v = obj[d];
      if (!v) continue;
      const h = typeof v === "string" ? v : typeof v === "object" && v !== null && "open" in v ? `${(v as Record<string, string>).open}-${(v as Record<string, string>).close}` : null;
      if (h) rows.push({ label: dayLabels[d]!, hours: h });
    }
    if (rows.length === 0) return null;
    return (
      <div style={{ marginTop: 10, fontSize: 12, color: "#5a5a5a", lineHeight: 1.5 }}>
        <div style={{ fontWeight: 600, color: "#4a4a4a", marginBottom: 4 }}>Jam buka:</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {rows.map((r) => (
            <div key={r.label} style={{ display: "flex", gap: 10 }}>
              <span style={{ fontWeight: 600, color: "#7a7a7a", minWidth: 30 }}>{r.label}</span>
              <span style={{ fontFamily: "monospace", fontSize: 11.5 }}>{r.hours}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

function primaryActionStyle(kind: "whatsapp" | "phone"): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    padding: "16px 20px",
    borderRadius: 12,
    background: kind === "whatsapp" ? "#25D366" : "#f97316",
    color: "#fff",
    fontSize: 15.5,
    fontWeight: 700,
    letterSpacing: 0.3,
    textDecoration: "none",
    boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
    transition: "transform 100ms ease",
    boxSizing: "border-box",
  };
}

const secondaryActionStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  width: "100%",
  marginTop: 10,
  padding: "12px 16px",
  borderRadius: 10,
  background: "#fff",
  color: "#1a1a1a",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
  border: "1px solid rgba(0,0,0,0.10)",
  boxSizing: "border-box",
};

const noContactCardStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 10,
  background: "rgba(249, 115, 22, 0.06)",
  border: "1px solid rgba(249, 115, 22, 0.20)",
};

const claimPromptStyle: React.CSSProperties = {
  marginTop: 20,
  padding: "18px 18px",
  borderRadius: 12,
  background: "#fff",
  border: "1px dashed rgba(249, 115, 22, 0.45)",
};

const claimButtonStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 18px",
  borderRadius: 999,
  background: "#f97316",
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  textDecoration: "none",
  letterSpacing: 0.2,
};
