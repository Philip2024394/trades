// /tc/settings/location — trade edits their home postcode + city.
//
// The postcode drives nearest-merchant matching + returns routing, so
// this is a first-class settings surface (not just a first-visit
// modal). Uses the same PATCH /api/auth/trade/profile endpoint used
// by complete-identity.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Loader2, ShieldCheck } from "lucide-react";
import { useCurrentTrade } from "@/lib/useCurrentTrade";
import { PagePersonaBadge } from "@/apps/hub/components/PagePersonaBadge";
import { HowItWorksButton } from "@/apps/hub/components/HowItWorksButton";

const LOCATION_KEY = "tc.notebook.location";

export default function LocationSettingsPage() {
  const { trade, loading } = useCurrentTrade();
  const [homePostcode, setHomePostcode] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!trade) return;
    setHomePostcode(trade.homePostcode ?? "");
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(LOCATION_KEY);
      if (raw && !trade.homePostcode) setHomeCity(raw);
    }
  }, [trade]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!homePostcode.trim() && !homeCity.trim()) return;
    setSaving(true);
    setError(null);
    setSavedNote(null);
    try {
      const res = await fetch("/api/auth/trade/profile", {
        method:  "PATCH",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({
          homePostcode: homePostcode.trim() || undefined,
          homeCity:     homeCity.trim() || undefined
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? String(res.status));
      // Keep the widget cache in sync too so the LeftMenuRail chip updates.
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LOCATION_KEY, homePostcode.trim() || homeCity.trim());
      }
      setSavedNote(json.migrationsPending
        ? "Saved locally. (Server migrations pending — will persist server-side once applied.)"
        : "Saved."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "save_failed");
    } finally {
      setSaving(false);
    }
  }

  function useDeviceLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Your browser doesn't support device location.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHomeCity(`${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`);
        setLocating(false);
      },
      () => {
        setError("Location permission denied. Enter your postcode manually.");
        setLocating(false);
      }
    );
  }

  return (
    <div className="min-h-screen bg-[#FBF6EC]">
      <PagePersonaBadge persona="trade" label="Location · Trade"/>
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-4">
        <Link
          href="/tc/hub"
          className="inline-flex min-h-[36px] items-center gap-1 rounded-full border bg-white px-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-700 shadow-sm hover:bg-neutral-50"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <ArrowLeft size={12}/>
          Hub
        </Link>
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
            TC · Settings · Location
          </div>
          <HowItWorksButton topic="settings-location"/>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pb-16">
        <div>
          <h1 className="flex items-center gap-1.5 text-[22px] font-black leading-tight text-neutral-900 md:text-[26px]">
            <MapPin size={20}/>
            Home base
          </h1>
          <p className="mt-1 max-w-lg text-[12.5px] leading-snug text-neutral-500">
            Trade Center uses your postcode to match the nearest verified merchants and to route
            returns. Update it if you move base — everything downstream adjusts automatically.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl border bg-white p-6 text-[12px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.12)" }}>
            <Loader2 size={14} className="animate-spin"/>
            Loading current location…
          </div>
        ) : (
          <form
            onSubmit={save}
            className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.12)" }}
          >
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
                Post code <span className="text-neutral-400 normal-case">(required for delivery + returns)</span>
              </span>
              <input
                type="text"
                value={homePostcode}
                onChange={(e) => setHomePostcode(e.target.value.toUpperCase())}
                placeholder="M20"
                className="min-h-[48px] rounded-md border bg-white px-4 text-[14px] uppercase tracking-wider text-neutral-900 outline-none placeholder:text-neutral-400"
                style={{ borderColor: "rgba(139,69,19,0.18)" }}
                autoComplete="postal-code"
                maxLength={8}
              />
              <span className="text-[10.5px] leading-snug text-neutral-500">
                Outward code is fine (first half — e.g. <strong>M20</strong>, <strong>LS11</strong>, <strong>HU3</strong>).
              </span>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
                Town / city <span className="text-neutral-400 normal-case">(optional)</span>
              </span>
              <input
                type="text"
                value={homeCity}
                onChange={(e) => setHomeCity(e.target.value)}
                placeholder="Manchester"
                className="min-h-[48px] rounded-md border bg-white px-4 text-[14px] text-neutral-900 outline-none placeholder:text-neutral-400"
                style={{ borderColor: "rgba(139,69,19,0.18)" }}
              />
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={useDeviceLocation}
                disabled={locating}
                className="inline-flex min-h-[40px] items-center gap-1 rounded-full border bg-white px-4 text-[11px] font-black uppercase tracking-wider text-neutral-800 shadow-sm disabled:opacity-40 hover:bg-neutral-50"
                style={{ borderColor: "rgba(139,69,19,0.18)" }}
              >
                {locating ? <Loader2 size={12} className="animate-spin"/> : <MapPin size={12}/>}
                Use device location
              </button>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-2 text-[10.5px] text-red-700">
                {error}
              </div>
            )}
            {savedNote && (
              <div
                className="flex items-center gap-2 rounded-md p-2 text-[11px] leading-snug"
                style={{ backgroundColor: "#F0FDF4", color: "#166534", border: "1px solid rgba(22,101,52,0.35)" }}
              >
                <ShieldCheck size={13}/>
                {savedNote}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving || (!homePostcode.trim() && !homeCity.trim())}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-full px-6 text-[12.5px] font-black uppercase tracking-wider shadow-sm disabled:opacity-40"
                style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
              >
                {saving ? "Saving…" : "Save location"}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
