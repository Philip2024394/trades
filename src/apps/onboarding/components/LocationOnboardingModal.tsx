// First-visit location onboarding modal.
//
// Two paths (both mandatory — no skip):
//   1. "Set Location" (primary) → uses the mobile device's location via
//      navigator.geolocation. Instant on any modern phone.
//   2. "Set Site Location" (secondary) → user pastes a Google Maps URL
//      for a specific job site. We parse @lat,lng from the URL when
//      possible.
//
// Location is saved to LOCATION_KEY (shared with LeftMenuRail).

"use client";

import { useEffect, useState } from "react";
import { MapPin, Loader2, Link as LinkIcon } from "lucide-react";

const LOCATION_KEY = "tc.notebook.location";
const ONBOARDING_KEY = "tc.location-onboarding-shown";

const UK_POSTCODE_TOKEN = /^([A-Z]{1,2}\d[A-Z\d]?)/i;

function splitLocationForProfile(raw: string): { homePostcode?: string; homeCity?: string } {
  const trimmed = raw.replace(/^📱\s*/, "").trim();
  // If the label is "lat, lng" from GPS we don't have a postcode — send
  // it as city so the trade at least has a marker, and let them enrich
  // it later in Settings.
  if (/^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return { homeCity: trimmed };
  }
  const match = trimmed.match(UK_POSTCODE_TOKEN);
  if (match) {
    return { homePostcode: match[1].toUpperCase() };
  }
  return { homeCity: trimmed };
}

type Mode = "buttons" | "locating" | "site-url";

export function LocationOnboardingModal() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("buttons");
  const [siteUrl, setSiteUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(ONBOARDING_KEY);
    const saved = window.localStorage.getItem(LOCATION_KEY);
    if (!seen && !saved) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  function saveAndClose(location: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LOCATION_KEY, location);
    window.localStorage.setItem(ONBOARDING_KEY, "1");
    // Persist to the trade profile so it survives across devices +
    // populates merchant nearest-match. UK postcode heuristic: pull the
    // first outward-code token (e.g. "M20") when the input looks like a
    // postcode; otherwise send the whole label as home_city.
    fetch("/api/auth/trade/profile", {
      method:  "PATCH",
      headers: { "content-type": "application/json" },
      body:    JSON.stringify(splitLocationForProfile(location))
    }).catch(() => {
      /* signed-out user in demo-mode; localStorage still works */
    });
    setOpen(false);
  }

  function useDeviceLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Your browser doesn't support device location. Try the Site Location option instead.");
      return;
    }
    setMode("locating");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const label = `📱 ${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`;
        saveAndClose(label);
      },
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Tap \"Enter Location\" below to type your postcode instead."
            : "Couldn't get your device location. Tap \"Enter Location\" below to type your postcode instead.";
        setError(msg);
        setMode("buttons");
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  }

  function saveSiteUrl() {
    const value = siteUrl.trim();
    if (!value) return;
    // If it's a Google Maps URL with @lat,lng, extract coords for
    // distance calculations. Otherwise save the plain text as-is
    // (postcode / address / town). Production geocodes silently.
    const match = value.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) {
      saveAndClose(`🗺 ${parseFloat(match[1]).toFixed(3)}, ${parseFloat(match[2]).toFixed(3)}`);
    } else if (/^https?:\/\//i.test(value)) {
      // URL without coords — trim to a short label
      const shortened = value.length > 40 ? value.slice(0, 40) + "…" : value;
      saveAndClose(shortened);
    } else {
      // Plain text — postcode, town or address
      saveAndClose(value);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Set your location"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header illustration — round yellow circle with MapPin */}
        <div
          className="flex flex-col items-center px-6 pb-2 pt-8"
          style={{
            background:
              "radial-gradient(ellipse at top, rgba(255,179,0,0.20) 0%, rgba(255,179,0,0) 60%)"
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2011,%202026,%2007_18_06%20PM.png"
            alt=""
            className="h-56 w-auto max-w-full object-contain sm:h-64"
            aria-hidden
          />
        </div>

        {/* Text */}
        <div className="px-6 pb-2 pt-4 text-center">
          <h2 className="text-[22px] font-black leading-tight text-neutral-900">
            Set location
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-neutral-600">
            We&apos;ll find supplies on your doorstep.
          </p>
        </div>

        {/* Buttons / states */}
        <div className="p-6">
          {mode === "buttons" && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={useDeviceLocation}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full px-6 text-[13px] font-black uppercase tracking-wider shadow-sm"
                style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
              >
                <MapPin size={14}/>
                Set Location Now
              </button>
              <button
                type="button"
                onClick={() => { setError(null); setMode("site-url"); }}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border bg-white px-6 text-[12.5px] font-black uppercase tracking-wider text-neutral-800 shadow-sm"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                <LinkIcon size={13}/>
                Enter Location
              </button>
              <div className="mt-1 grid grid-cols-2 gap-2 text-[9.5px] text-neutral-500">
                <span className="text-center leading-snug">Uses your device&apos;s GPS</span>
                <span className="text-center leading-snug">Postcode, address or Maps URL</span>
              </div>
              {error && (
                <div className="mt-2 rounded-md bg-red-50 p-2 text-[10.5px] text-red-700">
                  {error}
                </div>
              )}
            </div>
          )}

          {mode === "locating" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <Loader2 size={26} className="animate-spin text-neutral-600"/>
              <div className="text-[12px] font-black text-neutral-900">
                Getting your device location…
              </div>
              <div className="text-[10px] text-neutral-500">
                Allow location permission when prompted.
              </div>
              <button
                type="button"
                onClick={() => setMode("buttons")}
                className="mt-2 text-[10.5px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
              >
                ← Back
              </button>
            </div>
          )}

          {mode === "site-url" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveSiteUrl();
              }}
              className="flex flex-col gap-2"
            >
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
                  Your location
                </span>
                <input
                  type="text"
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  placeholder="M20 · Withington · 47 Elm St · Google Maps URL"
                  className="min-h-[48px] rounded-full border bg-white px-4 text-[13px] text-neutral-900 outline-none placeholder:text-neutral-400"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                  autoFocus
                />
                <span className="text-[9.5px] leading-snug text-neutral-500">
                  Postcode, town, address or a Google Maps URL — whatever&apos;s easiest.
                </span>
              </label>
              <button
                type="submit"
                disabled={!siteUrl.trim()}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full px-6 text-[13px] font-black uppercase tracking-wider shadow-sm disabled:opacity-40"
                style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
              >
                <MapPin size={14}/>
                Save location
              </button>
              <button
                type="button"
                onClick={() => setMode("buttons")}
                className="mt-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
              >
                ← Back
              </button>
            </form>
          )}

          <p className="mt-4 text-center text-[9.5px] leading-snug text-neutral-500">
            Location is required — Trade Counter, Notebook, and Site Projects all work by
            distance to your address.
          </p>

          {/* [DEV BUTTON] — remove on "remove dev buttons" */}
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => saveAndClose("Manchester M20 (dev)")}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[9.5px] font-black uppercase tracking-wider shadow-sm"
              style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
              title="Dev-only bypass — skips location"
            >
              Dev · Pass
            </button>
          </div>
          {/* [/DEV BUTTON] */}
        </div>
      </div>
    </div>
  );
}
