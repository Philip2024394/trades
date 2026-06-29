"use client";

// YardMapPreview — zero-API-call static SVG map.
//
// Draws a compass-card style preview with the yard pin at centre,
// optional customer pin at scaled (dx, dy) offset, free-radius
// solid yellow circle, and any number of stroked rings at the
// banded distances. Scale legend in the bottom-right reflects the
// km radius the canvas covers.
//
// All maths are local — Haversine for the customer/yard offset,
// equirectangular projection good enough at city scale. No tiles,
// no Mapbox, no internet round-trip.

type Band = { max_km: number; price_pence: number };

const SIZE = 300; // px viewBox
const PAD = 12;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function YardMapPreview({
  yardLat,
  yardLng,
  customerLat,
  customerLng,
  freeRadiusKm,
  bands,
  appliedBandKm,
  yardLabel = "Yard",
  customerLabel = "You",
  height = 200
}: {
  yardLat: number;
  yardLng: number;
  customerLat?: number | null;
  customerLng?: number | null;
  freeRadiusKm?: number | null;
  bands?: Band[];
  appliedBandKm?: number | null;
  yardLabel?: string;
  customerLabel?: string;
  height?: number;
}) {
  const hasCustomer =
    typeof customerLat === "number" && typeof customerLng === "number";

  // Choose canvas radius so the largest visible feature comfortably
  // fits: max of (largest band, free radius, 1.4 × customer distance).
  let visibleKm = 10;
  if (typeof freeRadiusKm === "number") {
    visibleKm = Math.max(visibleKm, freeRadiusKm * 1.3);
  }
  if (Array.isArray(bands) && bands.length > 0) {
    const maxBand = bands[bands.length - 1].max_km;
    visibleKm = Math.max(visibleKm, maxBand);
  }
  if (hasCustomer) {
    const d = haversineKm(yardLat, yardLng, customerLat as number, customerLng as number);
    visibleKm = Math.max(visibleKm, d * 1.4);
  }
  if (visibleKm < 5) visibleKm = 5;

  // Pixel radius available inside the SVG (square viewBox SIZE).
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const innerRadius = SIZE / 2 - PAD;
  const pxPerKm = innerRadius / visibleKm;

  // Equirectangular offset for the customer.
  let custX = cx;
  let custY = cy;
  if (hasCustomer) {
    const dEastKm =
      ((customerLng as number) - yardLng) *
      111.32 *
      Math.cos((yardLat * Math.PI) / 180);
    const dNorthKm = ((customerLat as number) - yardLat) * 110.574;
    custX = cx + dEastKm * pxPerKm;
    // SVG y grows downward; north is up, so flip sign.
    custY = cy - dNorthKm * pxPerKm;
  }

  return (
    <svg
      role="img"
      aria-label="Yard delivery zones map preview"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width="100%"
      style={{ display: "block", height }}
    >
      {/* Background */}
      <rect width={SIZE} height={SIZE} fill="#F5F5F5" />

      {/* Subtle grid */}
      <g opacity="0.4">
        {Array.from({ length: 5 }).map((_, i) => (
          <line
            key={`vx-${i}`}
            x1={(SIZE / 4) * i}
            y1="0"
            x2={(SIZE / 4) * i}
            y2={SIZE}
            stroke="#D4D4D4"
            strokeWidth="0.5"
          />
        ))}
        {Array.from({ length: 5 }).map((_, i) => (
          <line
            key={`hz-${i}`}
            x1="0"
            y1={(SIZE / 4) * i}
            x2={SIZE}
            y2={(SIZE / 4) * i}
            stroke="#D4D4D4"
            strokeWidth="0.5"
          />
        ))}
      </g>

      {/* Three-zone visual model — Stage-1 palette:
          Zone 1 (inner) = GREEN  (#10B981) — reads as "local / free"
          Zone 2 (mid)   = YELLOW (#FFB300) — brand standard
          Zone 3 (outer) = RED    (#EF4444) — reads as "the far edge"
          Universally legible without needing a key. */}
      {(() => {
        const ZONE_COLORS = ["#10B981", "#FFB300", "#EF4444"] as const;
        const rings: Array<{ km: number; isZone1Free: boolean }> = [];
        if (typeof freeRadiusKm === "number" && freeRadiusKm > 0) {
          rings.push({ km: freeRadiusKm, isZone1Free: true });
        }
        if (Array.isArray(bands)) {
          for (const b of bands) {
            if (typeof b.max_km === "number" && b.max_km > 0) {
              rings.push({ km: b.max_km, isZone1Free: false });
            }
          }
        }
        const zones = rings.slice(0, 3);
        return zones.map((z, idx) => {
          const color = ZONE_COLORS[idx] ?? "#FFB300";
          const isApplied =
            typeof appliedBandKm === "number" && Math.abs(appliedBandKm - z.km) < 0.01;
          const isZone1 = idx === 0;
          return (
            <circle
              key={`zone-${idx}-${z.km}`}
              cx={cx}
              cy={cy}
              r={z.km * pxPerKm}
              fill={isZone1 ? color : "none"}
              fillOpacity={isZone1 ? 0.22 : 0}
              stroke={color}
              strokeWidth={isApplied ? 2.5 : 2}
              strokeOpacity={isApplied ? 1 : 0.9}
              strokeDasharray={isApplied || isZone1 ? "none" : "5 4"}
            />
          );
        });
      })()}

      {/* Zone labels — small "Zone 1/2/3" tag at the top of each ring */}
      {(() => {
        const rings: Array<{ km: number }> = [];
        if (typeof freeRadiusKm === "number" && freeRadiusKm > 0) {
          rings.push({ km: freeRadiusKm });
        }
        if (Array.isArray(bands)) {
          for (const b of bands) {
            if (typeof b.max_km === "number" && b.max_km > 0) {
              rings.push({ km: b.max_km });
            }
          }
        }
        return rings.slice(0, 3).map((z, idx) => (
          <text
            key={`zone-label-${idx}`}
            x={cx}
            y={cy - z.km * pxPerKm + 4}
            textAnchor="middle"
            fontSize="9"
            fontWeight="700"
            fill="#0A0A0A"
            paintOrder="stroke"
            stroke="#FFFFFF"
            strokeWidth="3"
          >
            Zone {idx + 1}
          </text>
        ));
      })()}

      {/* Compass rose top-left */}
      <g transform="translate(20, 20)" aria-hidden="true">
        <circle cx="0" cy="0" r="10" fill="#FFFFFF" stroke="#737373" strokeWidth="1" />
        <text x="0" y="-3" textAnchor="middle" fontSize="9" fontWeight="700" fill="#0A0A0A">
          N
        </text>
        <line x1="0" y1="2" x2="0" y2="7" stroke="#0A0A0A" strokeWidth="1.2" />
      </g>

      {/* Scale legend bottom-right */}
      <g transform={`translate(${SIZE - 80}, ${SIZE - 18})`} aria-hidden="true">
        <line x1="0" y1="0" x2="60" y2="0" stroke="#0A0A0A" strokeWidth="1.5" />
        <line x1="0" y1="-4" x2="0" y2="4" stroke="#0A0A0A" strokeWidth="1.5" />
        <line x1="60" y1="-4" x2="60" y2="4" stroke="#0A0A0A" strokeWidth="1.5" />
        <text x="30" y="-6" textAnchor="middle" fontSize="9" fontWeight="700" fill="#0A0A0A">
          {(60 / pxPerKm).toFixed(1)} km
        </text>
      </g>

      {/* Customer pin (drawn first, under yard so yard stays visible if overlap) */}
      {hasCustomer && (
        <g>
          <circle cx={custX} cy={custY} r="6" fill="#0A0A0A" stroke="#FFFFFF" strokeWidth="2" />
          <text
            x={custX}
            y={custY - 10}
            textAnchor="middle"
            fontSize="10"
            fontWeight="700"
            fill="#0A0A0A"
            paintOrder="stroke"
            stroke="#FFFFFF"
            strokeWidth="3"
          >
            {customerLabel}
          </text>
        </g>
      )}

      {/* Yard pin — yellow */}
      <g>
        <circle cx={cx} cy={cy} r="7" fill="#FFB300" stroke="#0A0A0A" strokeWidth="2" />
        <text
          x={cx}
          y={cy - 12}
          textAnchor="middle"
          fontSize="10"
          fontWeight="700"
          fill="#0A0A0A"
          paintOrder="stroke"
          stroke="#FFFFFF"
          strokeWidth="3"
        >
          {yardLabel}
        </text>
      </g>
    </svg>
  );
}
