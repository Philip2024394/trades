"use client";

// PlantHireGetDirectionsCard — "How to get to us" section for the plant
// hire delivery-zones page. Renders the depot address and a "Get
// directions from my location" button that opens Google Maps in a new
// tab with driving directions pre-filled. If the browser blocks
// geolocation we fall back to opening the depot on Google Maps and let
// the user enter their origin manually.

import { useState } from "react";

export function PlantHireGetDirectionsCard({
  yardAddress,
  depotPostcode,
  lat,
  lng,
  merchantName
}: {
  yardAddress: string;
  depotPostcode: string;
  lat: number | null;
  lng: number | null;
  merchantName: string;
}) {
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const hasCoords = typeof lat === "number" && typeof lng === "number";
  const destination = hasCoords
    ? `${lat},${lng}`
    : depotPostcode || yardAddress || merchantName;
  const destinationQ = encodeURIComponent(destination);

  const staticLink = hasCoords
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : `https://www.google.com/maps?q=${destinationQ}`;

  function onGetDirections() {
    setLoading(true);
    setNote(null);
    if (!navigator.geolocation) {
      // No geolocation API — open Google Maps directions with empty
      // origin so the user can type it in.
      const url = `https://www.google.com/maps/dir/?api=1&destination=${destinationQ}&travelmode=driving`;
      window.open(url, "_blank", "noopener,noreferrer");
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const origin = `${pos.coords.latitude},${pos.coords.longitude}`;
        const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destinationQ}&travelmode=driving`;
        window.open(url, "_blank", "noopener,noreferrer");
        setLoading(false);
      },
      () => {
        // Denied / failed — open Google Maps with just the destination
        // so the user can add their starting point.
        const url = `https://www.google.com/maps/dir/?api=1&destination=${destinationQ}&travelmode=driving`;
        window.open(url, "_blank", "noopener,noreferrer");
        setNote(
          "Location blocked — enter your postcode on the Google Maps page that just opened."
        );
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }

  return (
    <div className="mt-10">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
        How to get to us
      </p>
      <h3 className="mt-1 text-2xl font-extrabold text-neutral-900 sm:text-3xl">
        Depot directions
      </h3>

      <div className="mt-5">
        {/* Address + directions button */}
        <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
              Depot address
            </p>
            <p className="mt-1 whitespace-pre-line font-mono text-[13px] text-neutral-900">
              {yardAddress || depotPostcode || merchantName}
            </p>
          </div>

          <button
            type="button"
            onClick={onGetDirections}
            disabled={loading}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-extrabold uppercase tracking-widest text-black transition hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
            style={{ background: "#FFB300" }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="10" r="3" />
              <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" />
            </svg>
            {loading ? "Locating…" : "Get directions from my location"}
          </button>

          <a
            href={staticLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-800 transition hover:border-[#FFB300]"
          >
            Open depot on Google Maps →
          </a>

          {note && (
            <p className="rounded-md bg-amber-50 px-2 py-1.5 text-[11px] font-bold text-amber-900">
              {note}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
