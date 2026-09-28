"use client";

// src/app/nex-native/manage/shop/_location-editor.tsx
//
// Bridge 25d · Seller pickup-location editor.
// -------------------------------------------
// Two visible inputs (lat + lng) plus a big "📍 Use my current
// location" button that fires navigator.geolocation and drops the
// values into the inputs. Submitting POSTs to
// updateBusinessLocationAction which persists to nex_business.
//
// The buyer /cart bike-delivery estimator reads these coordinates
// to compute a Gojek / Grab / Maxim-style fare.

import { useState } from "react";

const NEX = {
  border: "rgba(139, 169, 209, 0.14)",
  borderStrong: "rgba(139, 169, 209, 0.24)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.5)",
  orange: "#FF7200",
  green: "#16D66B",
  red: "#FF3355",
};
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export function SellerLocationEditor({
  initialLat,
  initialLng,
}: {
  initialLat: number | null;
  initialLng: number | null;
}) {
  const [lat, setLat] = useState<string>(
    initialLat != null ? String(initialLat) : "",
  );
  const [lng, setLng] = useState<string>(
    initialLng != null ? String(initialLng) : "",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  function captureLocation() {
    setError(null);
    setFlash(null);
    if (!("geolocation" in navigator)) {
      setError("Your browser doesn't support geolocation");
      return;
    }
    setPending(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setPending(false);
        setFlash(
          `Captured ±${Math.round(pos.coords.accuracy)}m accuracy · press Save`,
        );
      },
      (err) => {
        setPending(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied · enable it in your browser settings and retry"
            : "Couldn't get your location · try again or type the coordinates manually",
        );
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 12_000 },
    );
  }

  function clearBoth() {
    setLat("");
    setLng("");
    setFlash(null);
    setError(null);
  }

  const hasBoth = lat.trim().length > 0 && lng.trim().length > 0;
  const gmapsHref =
    hasBoth &&
    Number.isFinite(Number.parseFloat(lat)) &&
    Number.isFinite(Number.parseFloat(lng))
      ? `https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`
      : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <button
        type="button"
        onClick={captureLocation}
        disabled={pending}
        style={{
          padding: "12px 16px",
          borderRadius: 14,
          background: pending
            ? "rgba(139,169,209,0.12)"
            : "linear-gradient(180deg, #FF9033 0%, #FF7800 100%)",
          border: `1px solid ${
            pending ? NEX.borderStrong : "rgba(255,120,0,0.6)"
          }`,
          color: pending ? NEX.textDim : "#0B0F1A",
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          cursor: pending ? "not-allowed" : "pointer",
          fontFamily: SANS,
          boxShadow: pending
            ? "none"
            : "0 10px 24px rgba(255,120,0,0.35), inset 0 1px 0 rgba(255,255,255,0.28)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <span aria-hidden>📍</span>
        {pending ? "Locating…" : "Use my current location"}
      </button>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={fieldLabel}>Latitude</span>
          <input
            type="text"
            name="location_lat"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            inputMode="decimal"
            placeholder="-7.795580"
            style={inputStyle}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={fieldLabel}>Longitude</span>
          <input
            type="text"
            name="location_lng"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            inputMode="decimal"
            placeholder="110.369490"
            style={inputStyle}
          />
        </label>
      </div>

      {flash && (
        <div
          role="status"
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            background: "rgba(22,214,107,0.10)",
            border: "1px solid rgba(22,214,107,0.35)",
            color: "#B8F1CC",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {flash}
        </div>
      )}
      {error && (
        <div
          role="alert"
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            background: "rgba(255,51,85,0.10)",
            border: "1px solid rgba(255,51,85,0.35)",
            color: "#FFB4C0",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {gmapsHref && (
          <a
            href={gmapsHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 11,
              color: NEX.cyan,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            Verify on Google Maps ↗
          </a>
        )}
        {hasBoth && (
          <button
            type="button"
            onClick={clearBoth}
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              background: "transparent",
              border: "1px solid rgba(255,51,85,0.30)",
              color: NEX.red,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: SANS,
            }}
          >
            Clear location
          </button>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  background: "rgba(0,0,0,0.35)",
  border: `1px solid ${NEX.border}`,
  color: NEX.text,
  fontSize: 13,
  fontFamily: SANS,
  outline: "none",
};

const fieldLabel: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: NEX.textMute,
  fontWeight: 700,
};
