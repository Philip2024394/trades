"use client";

// Beacon composer — "need this now".
//
// Renders as a red-accent card at the top of the feed (above the
// regular inline composer) so trades who need something urgently
// have a one-tap surface distinct from casual chat posting.
//
// Flow:
//   • Trade taps "Need this now"
//   • Composer expands: photo, short description, 30/60 min timer,
//     radius (default 10 km)
//   • Client asks the browser for geolocation. Fallback: trade types
//     a postcode or town so we still have a lat/lng-free record.
//   • Submits to /api/trade-off/yard/compose with kind='beacon'
//
// Beacons cost nothing on the free tier — they're the platform's
// hero mechanic. Rate-limiting comes later if abused.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Radio,
  Camera,
  MapPin,
  Clock,
  Send,
  Loader2,
  X,
  Info,
  Mic
} from "lucide-react";
import { YardBeaconPriceHint } from "./YardBeaconPriceHint";

// Minimal SpeechRecognition typing (browser-only, ambient in prod TS
// libs but not always present in Node types).
type SRType = {
  new (): SR;
};
interface SR extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult:
    | ((e: {
        results: {
          length: number;
          [i: number]: {
            isFinal: boolean;
            [j: number]: { transcript: string };
          };
        };
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
function getSpeechCtor(): SRType | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SRType;
    webkitSpeechRecognition?: SRType;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const BEACON_RED = "#8B0F0F";
const BEACON_YELLOW = "#FFB300";

type Auth = { slug: string; token: string };

export function YardBeaconComposer() {
  const router = useRouter();
  const [auth, setAuth] = useState<Auth | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [minutes, setMinutes] = useState<30 | 60>(30);
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [geoStatus, setGeoStatus] = useState<
    "idle" | "loading" | "granted" | "denied"
  >("idle");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceOn, setVoiceOn] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<SR | null>(null);

  useEffect(() => {
    setVoiceSupported(!!getSpeechCtor());
  }, []);

  function toggleVoice() {
    if (voiceOn) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setVoiceOn(false);
      return;
    }
    const Ctor = getSpeechCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-GB";
    rec.onresult = (e) => {
      let chunk = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) chunk += r[0].transcript;
      }
      if (chunk) {
        setBody((prev) => (prev ? `${prev} ${chunk}`.trim() : chunk.trim()));
      }
    };
    rec.onend = () => setVoiceOn(false);
    rec.onerror = () => setVoiceOn(false);
    try {
      rec.start();
      recognitionRef.current = rec;
      setVoiceOn(true);
    } catch {
      setVoiceOn(false);
    }
  }

  useEffect(
    () => () => {
      recognitionRef.current?.stop();
    },
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const s = sp.get("slug");
    const t = sp.get("token");
    if (s && t) setAuth({ slug: s, token: t });
    setCheckedAuth(true);
  }, []);

  function requestGeolocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("denied");
      return;
    }
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setGeoStatus("granted");
      },
      () => setGeoStatus("denied"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 }
    );
  }

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    e.currentTarget.value = "";
    if (!files || files.length === 0 || !auth) return;
    setUploadingImage(true);
    try {
      for (let i = 0; i < Math.min(files.length, 3 - images.length); i++) {
        const fd = new FormData();
        fd.append("file", files[i]);
        fd.append("slug", auth.slug);
        fd.append("edit_token", auth.token);
        const res = await fetch("/api/trade-off/upload-photo", {
          method: "POST",
          body: fd
        });
        if (res.ok) {
          const data = (await res.json()) as { url?: string };
          if (data.url) setImages((prev) => [...prev, data.url!]);
        }
      }
    } finally {
      setUploadingImage(false);
    }
  }

  async function submit() {
    if (!auth || posting) return;
    const trimmed = body.trim();
    if (!trimmed) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch("/api/trade-off/yard/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: auth.slug,
          edit_token: auth.token,
          kind: "beacon",
          title: trimmed.length > 90 ? trimmed.slice(0, 87) + "…" : trimmed,
          body: trimmed,
          image_urls: images,
          beacon_duration_minutes: minutes,
          beacon_lat: lat,
          beacon_lng: lng,
          beacon_radius_km: radiusKm
        })
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError("Beacon failed to post. Try again.");
        return;
      }
      setBody("");
      setImages([]);
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPosting(false);
    }
  }

  if (!checkedAuth || !auth) return null;

  return (
    <div className="mx-auto mb-3 w-full max-w-2xl">
      {!open && (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            if (geoStatus === "idle") requestGeolocation();
          }}
          className="flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 shadow-sm transition hover:shadow-md"
          style={{
            borderColor: BEACON_RED,
            background: "linear-gradient(90deg, #FEF2F2 0%, #FEFAF5 100%)"
          }}
        >
          <span
            aria-hidden
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow"
            style={{ background: BEACON_RED }}
          >
            <Radio className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1 text-left">
            <p className="text-[13px] font-black text-neutral-900">
              Need this now — Beacon
            </p>
            <p className="text-[11px] text-neutral-600">
              Photograph or type it. Nearby trades + merchants reply within 30
              minutes.
            </p>
          </div>
          <span
            className="hidden shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-900 shadow sm:inline-flex"
            style={{ background: BEACON_YELLOW }}
          >
            Start
          </span>
        </button>
      )}

      {open && (
        <div
          className="overflow-hidden rounded-2xl border-2 bg-white shadow-md"
          style={{ borderColor: BEACON_RED }}
        >
          <header
            className="flex items-center justify-between px-4 py-2.5 text-white"
            style={{ background: BEACON_RED }}
          >
            <div className="inline-flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.18em]">
              <Radio className="h-4 w-4" aria-hidden />
              Need this now
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              disabled={posting}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </header>

          <div className="p-4">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="e.g. Six-inch angle iron, four lengths, Manchester M3. Collection OK by 10am."
              autoFocus
              rows={3}
              maxLength={800}
              className="w-full resize-none rounded-xl border border-neutral-200 bg-white p-3 text-[13.5px] leading-[1.5] text-neutral-900 placeholder:text-neutral-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            />

            {/* Live market range from published merchant prices */}
            <YardBeaconPriceHint query={body} />

            {images.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {images.map((url, i) => (
                  <div
                    key={`${url}-${i}`}
                    className="relative h-14 w-14 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setImages((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      aria-label="Remove"
                      className="absolute right-0.5 top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white shadow"
                    >
                      <X className="h-2.5 w-2.5" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Controls */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 text-[11px] font-bold text-neutral-700 hover:border-amber-400 hover:text-amber-700">
                {uploadingImage ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : (
                  <Camera className="h-3 w-3" aria-hidden />
                )}
                Photo
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImagePick}
                  disabled={uploadingImage || images.length >= 3}
                />
              </label>

              {voiceSupported && (
                <button
                  type="button"
                  onClick={toggleVoice}
                  aria-label={voiceOn ? "Stop voice" : "Speak your beacon"}
                  className={`inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-[11px] font-black transition ${
                    voiceOn
                      ? "border-red-500 bg-red-500 text-white shadow-md"
                      : "border-neutral-200 bg-white text-neutral-700 hover:border-amber-400 hover:text-amber-700"
                  }`}
                >
                  <Mic
                    className={`h-3 w-3 ${voiceOn ? "animate-pulse" : ""}`}
                    aria-hidden
                  />
                  {voiceOn ? "Listening" : "Voice"}
                </button>
              )}

              <button
                type="button"
                onClick={() => setMinutes(minutes === 30 ? 60 : 30)}
                className="inline-flex h-8 items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 text-[11px] font-bold text-neutral-700 hover:border-amber-400"
              >
                <Clock className="h-3 w-3" aria-hidden />
                {minutes} min
              </button>

              <button
                type="button"
                onClick={() => {
                  const next = radiusKm === 10 ? 25 : radiusKm === 25 ? 50 : 10;
                  setRadiusKm(next);
                }}
                className="inline-flex h-8 items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 text-[11px] font-bold text-neutral-700 hover:border-amber-400"
              >
                <MapPin className="h-3 w-3" aria-hidden />
                {radiusKm} km
              </button>

              {geoStatus === "granted" ? (
                <span className="inline-flex h-8 items-center gap-1 rounded-full bg-emerald-50 px-2.5 text-[10px] font-bold text-emerald-700">
                  Location set
                </span>
              ) : geoStatus === "loading" ? (
                <span className="inline-flex h-8 items-center gap-1 rounded-full bg-neutral-100 px-2.5 text-[10px] font-bold text-neutral-500">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  Finding location
                </span>
              ) : geoStatus === "denied" ? (
                <button
                  type="button"
                  onClick={requestGeolocation}
                  className="inline-flex h-8 items-center gap-1 rounded-full bg-amber-50 px-2.5 text-[10px] font-bold text-amber-700 hover:bg-amber-100"
                >
                  Location off · Enable
                </button>
              ) : (
                <button
                  type="button"
                  onClick={requestGeolocation}
                  className="inline-flex h-8 items-center gap-1 rounded-full bg-neutral-100 px-2.5 text-[10px] font-bold text-neutral-600 hover:bg-neutral-200"
                >
                  Get location
                </button>
              )}

              <span className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={submit}
                  disabled={posting || !body.trim()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full px-4 text-[12px] font-black text-white shadow-sm transition active:scale-[0.97] disabled:opacity-50"
                  style={{ background: BEACON_RED }}
                >
                  {posting ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  ) : (
                    <Send className="h-3 w-3" aria-hidden />
                  )}
                  Fire Beacon
                </button>
              </span>
            </div>

            {geoStatus === "denied" && (
              <p className="mt-2 flex items-start gap-1 text-[10.5px] text-neutral-500">
                <Info className="h-3 w-3 shrink-0" aria-hidden />
                Without location we can&apos;t match nearby trades. Type your
                postcode into the message for now.
              </p>
            )}
            {error && (
              <p className="mt-2 text-[11.5px] font-semibold text-red-700">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
