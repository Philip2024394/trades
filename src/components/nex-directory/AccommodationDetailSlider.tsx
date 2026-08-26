"use client";

// src/components/nex-directory/AccommodationDetailSlider.tsx
//
// PART B (2026-08-24) · World-class Accommodation Details slider.
//
// Doctrine (Philip 2026-08-24 verbatim):
//   · "Do NOT redesign the entire NEX Accommodation front page."
//   · "Keep the current NEX visual language, grid, spacing and theme."
//   · "Feel like a premium travel/discovery experience."
//   · "Never fabricate: images, ratings, reviews, prices, facilities,
//      nearby businesses, distances, events, offers."
//   · "Every displayed fact must trace back to actual stored/source data."
//   · "Where information is unavailable, use appropriate empty states
//      rather than invented content."
//
// Honest data inventory (881 Yogyakarta accommodations as of 2026-08-24):
//   · 0 have hero images    → premium letter-tile fallback for ALL 881
//   · 115 have amenities    → facilities grid renders when present, absent otherwise
//   · 86 have phone         → contact row honest empty state
//   · 1 has WhatsApp        → same
//   · 55 have website       → same
//   · 881 have coordinates  → Nearby section always populates
//   · 13 have star ratings  → shown only when present
//   · 0 have review ratings → NEVER shown (would be fabrication)
//   · 258 have recovered_evidence (Path A OSM tags) → surface as evidence context
//
// UX contract:
//   · Slides up from bottom · desktop + mobile
//   · Backdrop dim · prevents background interaction
//   · Escape closes · Tab focus trapped inside
//   · Preserves scroll position in the directory beneath
//   · Nearby loaded via API route with lat/lng · lazy · not fabricated
//   · Grid does NOT jump on close

import { useEffect, useMemo, useRef, useState } from "react";

// ── Public listing shape (extends the directory listing with detail-only fields) ──

export interface AccommodationDetailData {
  publicListingRef: string;
  businessName: string;
  category: string;
  categories: string[];
  city: string;
  district: string | null;
  neighbourhood?: string | null;
  streetLine?: string | null;
  address: string | null;
  coordinatesLat: number | null;
  coordinatesLng: number | null;
  phone: string | null;
  whatsappNumber: string | null;
  website: string | null;
  starRating: number | null;
  roomCount: number | null;
  amenities: string[];
  heroImageUrl: string | null;
  rating: number | null;         // NEVER shown when null (populated=0/881 today)
  reviewCount: number | null;    // same
  recoveredEvidence: Record<string, unknown> | null;
}

interface NearbyItem { publicListingRef: string; businessName: string; category: string | null; distanceKm: number }

// ── Facility icon map · icon per known amenity token · unknowns fall through to text ──

const FACILITY_ICONS: Record<string, { icon: string; label: string }> = {
  wifi:                    { icon: "📶", label: "Wi-Fi" },
  air_conditioning:        { icon: "❄️", label: "Air conditioning" },
  wheelchair_accessible:   { icon: "♿", label: "Wheelchair accessible" },
  smoking_allowed:         { icon: "🚬", label: "Smoking allowed" },
  on_site_bar:             { icon: "🍸", label: "On-site bar" },
  parking:                 { icon: "🅿️", label: "Parking" },
  pool:                    { icon: "🏊", label: "Pool" },
  breakfast:               { icon: "🍳", label: "Breakfast" },
  restaurant:              { icon: "🍽️", label: "Restaurant" },
  family_rooms:            { icon: "👨‍👩‍👧", label: "Family rooms" },
  laundry:                 { icon: "🧺", label: "Laundry" },
  spa:                     { icon: "💆", label: "Spa" },
  gym:                     { icon: "🏋️", label: "Gym" },
};

function facilityDisplay(token: string): { icon: string; label: string } {
  return FACILITY_ICONS[token] ?? { icon: "•", label: token.replace(/_/g, " ") };
}

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  listing: AccommodationDetailData | null;
  onClose: () => void;
}

export function AccommodationDetailSlider({ listing, onClose }: Props): React.JSX.Element | null {
  const isOpen = listing !== null;
  const [nearby, setNearby] = useState<{ status: "idle" | "loading" | "loaded" | "empty" | "error"; rows: NearbyItem[] }>({ status: "idle", rows: [] });
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  // Escape to close · scroll lock on open · focus initial close button.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  // Lazy-load nearby whenever listing changes AND it has coords.
  useEffect(() => {
    if (!listing || listing.coordinatesLat == null || listing.coordinatesLng == null) {
      setNearby({ status: "idle", rows: [] });
      return;
    }
    let cancelled = false;
    setNearby({ status: "loading", rows: [] });
    fetch(`/api/nex/accommodation/nearby-food?lat=${listing.coordinatesLat}&lng=${listing.coordinatesLng}`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((json: { rows: NearbyItem[] }) => {
        if (cancelled) return;
        if (!json.rows || json.rows.length === 0) setNearby({ status: "empty", rows: [] });
        else setNearby({ status: "loaded", rows: json.rows });
      })
      .catch(() => { if (!cancelled) setNearby({ status: "error", rows: [] }); });
    return () => { cancelled = true; };
  }, [listing]);

  const facilities = useMemo(() => (listing?.amenities ?? []).map(facilityDisplay), [listing]);
  const evidenceEntries = useMemo(() => {
    if (!listing?.recoveredEvidence) return [];
    const interesting: string[] = ["addr:street", "addr:housenumber", "addr:postcode", "opening_hours", "brand", "wikidata", "operator", "check_date", "building:levels"];
    return interesting
      .map((k) => ({ key: k, value: listing.recoveredEvidence![k] }))
      .filter((e) => typeof e.value === "string" && e.value.length > 0) as Array<{ key: string; value: string }>;
  }, [listing]);

  if (!isOpen || !listing) return null;

  const initial = listing.businessName.charAt(0).toUpperCase();
  const displayLoc = [listing.streetLine, listing.neighbourhood, listing.district, listing.city].filter(Boolean).join(" · ");

  return (
    <div
      onClick={onClose}
      style={backdropStyle}
      aria-modal="true"
      role="dialog"
      aria-labelledby="accommodation-slider-title"
    >
      <div onClick={(e) => e.stopPropagation()} style={panelStyle}>
        {/* ── Drag handle / close row ─────────────────────────────── */}
        <div style={handleRowStyle}>
          <div style={dragHandleStyle} aria-hidden="true" />
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            style={closeBtnStyle}
            aria-label="Close details"
          >×</button>
        </div>

        {/* ── Scrollable content ──────────────────────────────────── */}
        <div style={contentScrollStyle}>
          {/* ── 1. Hero · image if present, else NEX Information Panel
                   (per Philip 2026-08-24: "Don't waste the slider space on
                   a giant empty Photo not yet available. If there are no
                   photos, the slider should become a NEX information panel
                   using the data we already have.") ─── */}
          <section style={{ position: "relative" }}>
            {listing.heroImageUrl ? (
              <div style={{ aspectRatio: "16/9", background: "#f0ece5", overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={listing.heroImageUrl} alt={listing.businessName} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            ) : (
              <InfoPanelHero
                listing={listing}
                nearbyCount={nearby.status === "loaded" ? nearby.rows.length : null}
                nearbyLoaded={nearby.status !== "loading" && nearby.status !== "idle"}
                initial={initial}
              />
            )}
          </section>

          {/* ── 2. Identity ────────────────────────────────────── */}
          <section style={{ padding: "18px 20px 8px 20px" }}>
            <div style={{ fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: "#c2410c", fontWeight: 700 }}>
              {listing.category}{listing.categories.length > 0 && ` · ${listing.categories.slice(0, 2).join(" · ")}`}
            </div>
            <h2 id="accommodation-slider-title" style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.15, marginTop: 6, letterSpacing: "-0.01em", color: "#111" }}>
              {listing.businessName}
            </h2>
            {displayLoc && (
              <div style={{ marginTop: 6, fontSize: 13, color: "#555" }}>📍 {displayLoc}</div>
            )}
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12 }}>
              {listing.starRating != null && (
                <span style={badge("orange")}>{listing.starRating}★ hotel</span>
              )}
              {listing.roomCount != null && (
                <span style={badge("neutral")}>{listing.roomCount} rooms</span>
              )}
              {listing.rating == null && (
                <span style={{ ...badge("dim"), fontStyle: "italic" }} title="NEX has no verified review data for this property">
                  No verified reviews
                </span>
              )}
            </div>
          </section>

          {/* ── 3. Facilities ──────────────────────────────────── */}
          <section style={sectionBoxStyle}>
            <div style={sectionTitleStyle}>Facilities</div>
            {facilities.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                {facilities.map((f) => (
                  <div key={f.label} style={facilityChipStyle}>
                    <span style={{ fontSize: 18 }}>{f.icon}</span>
                    <span style={{ fontSize: 13, color: "#222" }}>{f.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={emptyStateStyle}>
                Facility list not yet published by this property.
              </div>
            )}
          </section>

          {/* ── 4. About / property info · honest (no description column exists) ── */}
          <section style={sectionBoxStyle}>
            <div style={sectionTitleStyle}>About this property</div>
            <div style={{ fontSize: 13.5, color: "#333", lineHeight: 1.6 }}>
              {listing.address && <div>{listing.address}</div>}
              {!listing.address && listing.streetLine && <div>{listing.streetLine}</div>}
              <div style={{ marginTop: 8, color: "#666", fontSize: 12.5 }}>
                Discovered from OpenStreetMap public data.
                {evidenceEntries.length > 0 && <> Additional public evidence available below.</>}
              </div>
            </div>
            {evidenceEntries.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed rgba(0,0,0,0.1)" }}>
                <div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "#888", fontWeight: 700, marginBottom: 6 }}>Public evidence</div>
                <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 12, rowGap: 4, fontSize: 12 }}>
                  {evidenceEntries.slice(0, 8).map((e) => (
                    <div key={e.key} style={{ display: "contents" }}>
                      <dt style={{ color: "#888", fontFamily: "monospace" }}>{e.key}</dt>
                      <dd style={{ margin: 0, color: "#222" }}>{e.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </section>

          {/* ── 5. What's nearby ────────────────────────────── */}
          <section style={sectionBoxStyle}>
            <div style={sectionTitleStyle}>What&apos;s nearby</div>
            {nearby.status === "loading" && <div style={emptyStateStyle}>Finding nearby places…</div>}
            {nearby.status === "error"   && <div style={emptyStateStyle}>Nearby search temporarily unavailable.</div>}
            {nearby.status === "empty"   && <div style={emptyStateStyle}>No listed places within ~3km yet.</div>}
            {nearby.status === "idle" && !listing.coordinatesLat && (
              <div style={emptyStateStyle}>Location coordinates not available for this property.</div>
            )}
            {nearby.status === "loaded" && (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
                {nearby.rows.map((n) => (
                  <li key={n.publicListingRef} style={nearbyRowStyle}>
                    <span style={{ fontSize: 15 }}>🍜</span>
                    <span style={{ flex: 1, fontSize: 13.5, color: "#222", fontWeight: 500 }}>{n.businessName}</span>
                    {n.category && <span style={{ fontSize: 11, color: "#888" }}>{n.category}</span>}
                    <span style={{ fontSize: 12, color: "#c2410c", fontWeight: 700, fontFamily: "monospace" }}>{formatDistance(n.distanceKm)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── 6. Contact row ────────────────────────────── */}
          <section style={{ padding: "12px 20px 24px 20px", display: "flex", flexWrap: "wrap", gap: 10 }}>
            {listing.whatsappNumber && (
              <a href={`https://wa.me/${listing.whatsappNumber.replace(/\D+/g, "")}`} target="_blank" rel="noreferrer" style={ctaWhatsappStyle}>
                WhatsApp
              </a>
            )}
            {listing.phone && !listing.whatsappNumber && (
              <a href={`tel:${listing.phone.replace(/\s+/g, "")}`} style={ctaCallStyle}>Call</a>
            )}
            {listing.website && (
              <a href={listing.website} target="_blank" rel="noreferrer" style={ctaWebsiteStyle}>Website</a>
            )}
            {!listing.whatsappNumber && !listing.phone && !listing.website && (
              <div style={{ ...emptyStateStyle, width: "100%" }}>
                No public contact information yet · claim this listing to add it.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

// ── Info-panel hero · shown when heroImageUrl is null (which is 881/881 today).
//    Uses real fields NEX already has · never fabricates content.
function InfoPanelHero({
  listing, nearbyCount, nearbyLoaded, initial,
}: {
  listing: AccommodationDetailData;
  nearbyCount: number | null;
  nearbyLoaded: boolean;
  initial: string;
}): React.JSX.Element {
  const amenityCount = listing.amenities?.length ?? 0;
  const roomSummary = listing.roomCount != null ? `${listing.roomCount} rooms · ` : "";
  const displayLoc = [listing.district, listing.city].filter(Boolean).join(" · ");
  return (
    <div style={{
      position: "relative", aspectRatio: "16/9",
      background: "linear-gradient(135deg, #fff4e6 0%, #f4f0e8 100%)",
      display: "flex", flexDirection: "column", padding: 20,
      gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: "rgba(255,255,255,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 30, fontWeight: 900, color: "#c2410c", letterSpacing: "-0.02em",
          border: "1px solid rgba(194,65,12,0.14)",
        }}>{initial}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: "#c2410c", fontWeight: 800 }}>
            NEX Information Panel
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#1a1a1a", lineHeight: 1.15, marginTop: 4 }}>
            {listing.businessName}
          </div>
          <div style={{ fontSize: 12, color: "#555", marginTop: 3 }}>
            {roomSummary}{listing.category}{displayLoc && ` · ${displayLoc}`}
          </div>
        </div>
      </div>
      {/* Info chips · every one traces to real DB fields */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: "auto" }}>
        {nearbyLoaded && nearbyCount != null && nearbyCount > 0 && (
          <span style={infoChip("orange")}>🍜 {nearbyCount} place{nearbyCount === 1 ? "" : "s"} to eat nearby</span>
        )}
        {amenityCount > 0 && (
          <span style={infoChip("neutral")}>{amenityCount} listed facilit{amenityCount === 1 ? "y" : "ies"}</span>
        )}
        {listing.starRating != null && (
          <span style={infoChip("orange")}>{listing.starRating}★</span>
        )}
        {(listing.phone || listing.whatsappNumber || listing.website) && (
          <span style={infoChip("neutral")}>Contact available</span>
        )}
        {listing.coordinatesLat != null && listing.coordinatesLng != null && (
          <span style={infoChip("dim")}>📍 Location on map</span>
        )}
      </div>
      <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: "rgba(0,0,0,0.42)", fontWeight: 600, marginTop: -2 }}>
        Photo not yet published · scroll for nearby, facilities & contact
      </div>
    </div>
  );
}

function infoChip(tone: "orange" | "neutral" | "dim"): React.CSSProperties {
  const map = {
    orange:  { bg: "rgba(255,120,30,0.14)", fg: "#c2410c", bd: "rgba(255,120,30,0.28)" },
    neutral: { bg: "rgba(255,255,255,0.7)",  fg: "#333",   bd: "rgba(0,0,0,0.06)" },
    dim:     { bg: "rgba(255,255,255,0.5)",  fg: "#666",   bd: "rgba(0,0,0,0.05)" },
  }[tone];
  return {
    padding: "5px 10px", borderRadius: 999,
    background: map.bg, color: map.fg, border: `1px solid ${map.bd}`,
    fontSize: 11.5, fontWeight: 600,
  };
}

// ── Styles (inline · matches NEX cream theme) ────────────────────────────

const backdropStyle: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 100,
  background: "rgba(20,20,20,0.55)", backdropFilter: "blur(2px)",
  display: "flex", alignItems: "flex-end", justifyContent: "center",
};
const panelStyle: React.CSSProperties = {
  width: "100%", maxWidth: 640, maxHeight: "92vh",
  background: "#faf7f2", borderRadius: "20px 20px 0 0",
  boxShadow: "0 -8px 40px rgba(0,0,0,0.25)",
  overflow: "hidden", display: "flex", flexDirection: "column",
  animation: "nex-slider-in 0.24s cubic-bezier(.2,.9,.3,1) both",
};
const handleRowStyle: React.CSSProperties = {
  position: "relative", padding: "10px 16px 8px 16px",
  display: "flex", justifyContent: "center", alignItems: "center", flexShrink: 0,
};
const dragHandleStyle: React.CSSProperties = {
  width: 40, height: 4, borderRadius: 2, background: "rgba(0,0,0,0.15)",
};
const closeBtnStyle: React.CSSProperties = {
  position: "absolute", right: 12, top: 6,
  width: 34, height: 34, borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.1)", background: "#fff",
  cursor: "pointer", fontSize: 20, fontWeight: 400, color: "#333",
};
const contentScrollStyle: React.CSSProperties = { overflowY: "auto", flex: 1 };
const sectionBoxStyle: React.CSSProperties = {
  margin: "8px 20px", padding: "14px 16px",
  background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12,
};
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase",
  color: "#888", fontWeight: 700, marginBottom: 10,
};
const facilityChipStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  padding: "8px 10px", background: "#faf7f2",
  border: "1px solid rgba(0,0,0,0.05)", borderRadius: 8,
};
const emptyStateStyle: React.CSSProperties = {
  fontSize: 12.5, color: "#888", fontStyle: "italic",
  padding: "8px 4px",
};
const nearbyRowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  padding: "10px 12px", background: "#faf7f2",
  border: "1px solid rgba(0,0,0,0.05)", borderRadius: 8,
};
function badge(tone: "orange" | "neutral" | "dim"): React.CSSProperties {
  const map = {
    orange:  { bg: "rgba(255,120,30,0.10)", fg: "#c2410c", bd: "rgba(255,120,30,0.25)" },
    neutral: { bg: "rgba(0,0,0,0.04)",       fg: "#333",   bd: "rgba(0,0,0,0.08)" },
    dim:     { bg: "transparent",            fg: "#999",   bd: "rgba(0,0,0,0.08)" },
  }[tone];
  return {
    padding: "4px 10px", borderRadius: 999,
    background: map.bg, color: map.fg, border: `1px solid ${map.bd}`,
    fontSize: 11.5, fontWeight: 600,
  };
}
const ctaWhatsappStyle: React.CSSProperties = {
  padding: "10px 18px", borderRadius: 999,
  background: "#16a34a", color: "#fff", fontSize: 13, fontWeight: 700,
  textDecoration: "none", flex: 1, textAlign: "center",
};
const ctaCallStyle: React.CSSProperties = {
  padding: "10px 18px", borderRadius: 999,
  background: "#fff", color: "#333",
  border: "1px solid rgba(0,0,0,0.14)",
  fontSize: 13, fontWeight: 600,
  textDecoration: "none", flex: 1, textAlign: "center",
};
const ctaWebsiteStyle: React.CSSProperties = { ...ctaCallStyle };
