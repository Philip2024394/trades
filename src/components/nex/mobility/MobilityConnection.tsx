// src/components/nex/mobility/MobilityConnection.tsx · Philip 2026-08-29
//
// NEX Mobility Connection · one continuous experience, 10 states.
// Not "ten screens". Not "ride status". Not "booking flow".
//
// Doctrine anchors (project_nex_mobility_doctrine_2026_08_29.md):
//   Lock  1 · NEX is a software network, not a ride-hail operator
//   Lock  2 · terminology (Provider not Driver · Request not Book)
//   Lock 12 · motion only communicates real state change
//   Lock 13 · bike colour is system identity attribute
//   Lock 14 · provider is a NEX entity, typography leads
//   Lock 15 · NEX connection line · YOU · NEX NETWORK · ANDI (typographic)
//   Lock 16 · LIVE/EST inline typography, never a badge
//   Lock 17 · state machine, not screens
//   Lock 18 · search feels instantaneous
//   Lock 19 · user can put phone down when provider is nearby
//   Lock 20 · CHAT · USER left · PROVIDER right (not NEX orange)
//   Lock 22 · connection line typographic, fades away forever
//   Lock 25 · REAL DATA GATE enforced by useRealVsEstimated
//   Lock 26 · animation never delays a real state transition
//   Lock 27 · PRICE first-class · six-line provider card
//   Lock 28 · REQUEST BROADCAST · first-to-accept wins
//   Lock 32 · price repeated on connection confirmation
//   Lock 33 · V1 eligibility active+city+is_available
//   Lock 35 · "Andi accepted." not "reached Andi"

"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useRealVsEstimated,
  formatLiveOrEstLine,
  formatDistance,
  type MobilityLiveMode,
} from "@/lib/nex/mobility/useRealVsEstimated";

// ── Types (mirror server contract) ─────────────────────────────────────
export type MobilityState =
  | "DESTINATION"
  | "NETWORK_CHECK"
  | "PROVIDERS"
  | "REQUEST_BROADCAST"
  | "CONNECTED"
  | "APPROACHING"
  | "NEARBY"
  | "SERVICE"
  | "COMPLETED"
  | "CANCELLED"
  | "TIMED_OUT"
  | "PROVIDER_LOST_SIGNAL";

export interface ProviderCandidate {
  provider_id: string;
  name: string;
  plate: string;
  secondary_language: string | null;
  provides_raincoat: boolean;
  bike_slug: string;
  bike_brand: string;
  bike_model: string;
  bike_cc: number;
  bike_category: string;
  bike_year: number;
  bike_color_hex: string;
  price_idr: number;
  rating_avg: number | null;
  rating_count: number;
  distance_m: number | null;   // v1: null · client shows EST
  eta_seconds: number | null;  // v1: null · client shows EST
  is_live: boolean;
}

export interface MobilityConnectionProps {
  /** User's device or NEX identity. */
  learnerRef: string;
  /** User's city for eligibility filter. */
  city: string;
  /** Optional: switch to "demo-live" to simulate a live GPS stream for demo purposes. */
  liveMode?: MobilityLiveMode;
}

// ── Colour tokens · white surface, black frosted card doctrine ─────────
const C = {
  bg:         "#ffffff",
  ink:        "#0a0e18",
  inkSoft:    "#4b5563",
  inkMuted:   "#6b7280",
  border:     "#e5e7eb",
  cardBg:     "rgba(10,10,12,0.86)",
  cardBorder: "rgba(148,163,184,0.22)",
  cardInk:    "rgba(245,245,245,0.94)",
  cardInkSoft:"rgba(245,245,245,0.65)",
  accent:     "#f97316",   // NEX orange · used on user side of chat
  provider:   "#22c55e",   // provider side · deliberately NOT NEX orange (lock 20)
  danger:     "#dc2626",
};

// ── Canvas paint-swap · shared with DriverBikeCard/etc ─────────────────
function hexToRgb(hex: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}
function rgbToHsl(r: number, g: number, b: number) {
  const rN = r/255, gN = g/255, bN = b/255;
  const max = Math.max(rN,gN,bN), min = Math.min(rN,gN,bN);
  const l = (max+min)/2; let h=0, s=0;
  if (max !== min) {
    const d = max-min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    switch (max) {
      case rN: h = (gN-bN)/d + (gN<bN?6:0); break;
      case gN: h = (bN-rN)/d + 2; break;
      case bN: h = (rN-gN)/d + 4; break;
    }
    h /= 6;
  }
  return { h, s, l };
}
function hslToRgb(h: number, s: number, l: number) {
  let r=0,g=0,b=0;
  if (s===0) r=g=b=l;
  else {
    const q = l < 0.5 ? l*(1+s) : l+s-l*s;
    const p = 2*l - q;
    const hue = (t: number) => { if (t<0) t+=1; if (t>1) t-=1;
      if (t<1/6) return p+(q-p)*6*t; if (t<1/2) return q;
      if (t<2/3) return p+(q-p)*(2/3-t)*6; return p;
    };
    r = hue(h+1/3); g = hue(h); b = hue(h-1/3);
  }
  return { r: Math.round(r*255), g: Math.round(g*255), b: Math.round(b*255) };
}
function tintBike(img: HTMLImageElement, targetHex: string): string {
  const t = hexToRgb(targetHex); if (!t) return img.src;
  const th = rgbToHsl(t.r, t.g, t.b);
  const w = img.naturalWidth, h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d"); if (!ctx) return img.src;
  ctx.drawImage(img, 0, 0, w, h);
  const im = ctx.getImageData(0,0,w,h); const d = im.data;
  for (let i=0; i<d.length; i+=4) {
    const a = d[i+3]; if (a === 0) continue;
    const hsl = rgbToHsl(d[i], d[i+1], d[i+2]);
    if (hsl.l < 0.15 || hsl.l > 0.88 || hsl.s < 0.16) continue;
    const newS = Math.min(1, th.s * 0.75 + hsl.s * 0.25);
    const rgb = hslToRgb(th.h, newS, hsl.l);
    d[i]=rgb.r; d[i+1]=rgb.g; d[i+2]=rgb.b;
  }
  ctx.putImageData(im, 0, 0);
  return canvas.toDataURL("image/png");
}

// Human-readable IDR (Rp 18.000)
function fmtIdr(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}

// ── Component ──────────────────────────────────────────────────────────
export function MobilityConnection({ learnerRef, city, liveMode = "off" }: MobilityConnectionProps) {
  const [state, setState] = useState<MobilityState>("DESTINATION");
  const [destination, setDestination] = useState<string>("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderCandidate[]>([]);
  const [selected, setSelected] = useState<ProviderCandidate | null>(null);
  const [priceAgreed, setPriceAgreed] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [broadcastExpiresAt, setBroadcastExpiresAt] = useState<number | null>(null);

  const live = useRealVsEstimated({ requestId, mode: liveMode });

  // ── State transitions ───────────────────────────────────────────
  const goCheck = useCallback(async () => {
    if (!destination.trim()) { setError("Destination required"); return; }
    setError(null); setBusy(true);
    setState("NETWORK_CHECK");
    try {
      const resp = await fetch("/api/nex/service-request/broadcast", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          learner_ref: learnerRef, city,
          service_kind: "bike",
          destination_text: destination.trim(),
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        setError(data.error ?? "network check failed");
        setState("DESTINATION");
        setBusy(false);
        return;
      }
      if (data.eligible_count === 0) {
        setError(data.message ?? "No providers available");
        setState("DESTINATION");
        setBusy(false);
        return;
      }
      setRequestId(data.request_id);
      setProviders(data.providers ?? []);
      setBroadcastExpiresAt(data.broadcast_expires_at ? new Date(data.broadcast_expires_at).getTime() : null);
      setState("PROVIDERS");
    } finally {
      setBusy(false);
    }
  }, [destination, learnerRef, city]);

  const goRequest = useCallback(async (provider: ProviderCandidate) => {
    if (!requestId) return;
    setSelected(provider);
    setState("REQUEST_BROADCAST");
    // In v1 the broadcast has already happened server-side (during NETWORK_CHECK).
    // Selecting a provider is effectively "make this the winner" — for the demo
    // we call accept-on-behalf-of. In production this is the moment we WAIT for
    // any of the eligible providers to accept in their app. First to accept wins.
    setBusy(true);
    try {
      const resp = await fetch(`/api/nex/service-request/${requestId}/accept`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider_id: provider.provider_id, action: "accept" }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        setError(data.message ?? data.error ?? "accept failed");
        setState("PROVIDERS");
        return;
      }
      setPriceAgreed(data.price_agreed_idr ?? provider.price_idr);
      // Enter CONNECTED beat · brief hold · tap-to-skip · lock 26
      setState("CONNECTED");
    } finally {
      setBusy(false);
    }
  }, [requestId]);

  const advanceFromConnected = useCallback(() => {
    setState("APPROACHING");
  }, []);
  const goNearby = useCallback(() => setState("NEARBY"), []);
  const goService = useCallback(() => setState("SERVICE"), []);
  const goCompleted = useCallback(async () => {
    if (!requestId) { setState("COMPLETED"); return; }
    // Complete server-side · fee deduction happens in one transaction per lock 37-42.
    // Customer NEVER sees fee mechanics (lock 45) · we just advance state on success.
    try {
      await fetch(`/api/nex/service-request/${requestId}/complete`, { method: "POST" });
    } catch { /* fail-soft · advance UI anyway · deduction retry is a server concern */ }
    setState("COMPLETED");
  }, [requestId]);

  const cancel = useCallback(() => {
    if (!confirm("Cancel this request? " + (selected ? `${selected.name} will be notified.` : ""))) return;
    setState("CANCELLED");
    setSelected(null);
    setRequestId(null);
  }, [selected]);

  const reset = useCallback(() => {
    setState("DESTINATION");
    setDestination("");
    setRequestId(null);
    setProviders([]);
    setSelected(null);
    setPriceAgreed(null);
    setError(null);
    setBroadcastExpiresAt(null);
  }, []);

  // Auto-advance the brief CONNECTED beat (2s · tap-to-skip)
  useEffect(() => {
    if (state !== "CONNECTED") return;
    const t = setTimeout(() => setState("APPROACHING"), 2200);
    return () => clearTimeout(t);
  }, [state]);

  // Timeout the broadcast window · surface calm retry
  useEffect(() => {
    if (state !== "REQUEST_BROADCAST" || !broadcastExpiresAt) return;
    const remaining = broadcastExpiresAt - Date.now();
    if (remaining <= 0) { setState("TIMED_OUT"); return; }
    const t = setTimeout(() => { if (state === "REQUEST_BROADCAST") setState("TIMED_OUT"); }, remaining);
    return () => clearTimeout(t);
  }, [state, broadcastExpiresAt]);

  // ── Render surface (white bg · black frosted card is the sole non-typographic element) ──
  return (
    <div style={{
      width: "100%", maxWidth: 460, margin: "0 auto",
      padding: "20px 16px",
      color: C.ink,
      fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, Segoe UI, Roboto, sans-serif",
    }}>
      <style>{`
        @keyframes nex-pulse-one   { 0%,100%{opacity:.35} 50%{opacity:1} }
        @keyframes nex-fade-in     { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes nex-bike-still  { 0%,100%{transform:none} }
        @keyframes nex-bike-lift   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)} }
        @keyframes nex-connect-in  { 0%{opacity:0;letter-spacing:0} 40%{opacity:1;letter-spacing:2px} 100%{opacity:1;letter-spacing:1.4px} }
        @keyframes nex-check-reveal{ from{opacity:0;transform:scale(0.6)} to{opacity:1;transform:scale(1)} }
      `}</style>

      {state === "DESTINATION" && (
        <DestinationView
          destination={destination}
          setDestination={setDestination}
          onContinue={goCheck}
          busy={busy}
          error={error}
        />
      )}

      {state === "NETWORK_CHECK" && <NetworkCheckView />}

      {state === "PROVIDERS" && (
        <ProvidersView
          providers={providers}
          onRequest={goRequest}
          onBack={reset}
          busy={busy}
          liveMode={liveMode}
        />
      )}

      {state === "REQUEST_BROADCAST" && (
        <RequestBroadcastView
          selected={selected}
          onCancel={reset}
        />
      )}

      {state === "CONNECTED" && (
        <ConnectedBeatView selected={selected} priceAgreed={priceAgreed ?? selected?.price_idr ?? 0} onTap={advanceFromConnected} />
      )}

      {(state === "APPROACHING" || state === "NEARBY") && selected && (
        <ApproachingView
          state={state}
          provider={selected}
          priceAgreed={priceAgreed ?? selected.price_idr}
          live={live}
          onCancel={cancel}
          onDeclareNearby={goNearby}
          onDeclareService={goService}
        />
      )}

      {state === "SERVICE" && selected && (
        <ServiceView provider={selected} onComplete={goCompleted} />
      )}

      {state === "COMPLETED" && selected && (
        <CompletedView
          provider={selected}
          priceAgreed={priceAgreed ?? selected.price_idr}
          onNewRequest={reset}
        />
      )}

      {state === "CANCELLED" && (
        <CancelledView onNewRequest={reset} />
      )}

      {state === "TIMED_OUT" && (
        <TimedOutView onRetry={reset} />
      )}
    </div>
  );
}

// ── Sub-views · each state = one small pure view ───────────────────────

function DestinationView({ destination, setDestination, onContinue, busy, error }: {
  destination: string; setDestination: (v: string) => void;
  onContinue: () => void; busy: boolean; error: string | null;
}) {
  return (
    <div style={{ paddingTop: 20 }}>
      <div style={{ fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", color: C.accent, fontWeight: 800, marginBottom: 6 }}>
        NEX Mobility
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: -0.4, lineHeight: 1.15 }}>
        Where would you like to go?
      </h1>
      <label style={{ display: "block", marginTop: 24 }}>
        <input
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onContinue(); }}
          placeholder="Destination"
          style={{
            width: "100%", padding: "16px 14px", fontSize: 17,
            borderRadius: 12, border: `1px solid ${C.border}`,
            background: "#f9fafb", color: C.ink, minHeight: 52,
            outline: "none",
          }}
        />
        <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 8 }}>
          ↳ from Your location
        </div>
      </label>
      {error && <div style={{ marginTop: 12, fontSize: 13, color: C.danger }}>{error}</div>}
      <button
        onClick={onContinue}
        disabled={busy || destination.trim().length === 0}
        style={{
          marginTop: 20, width: "100%", minHeight: 52,
          padding: "14px 16px", fontSize: 16, fontWeight: 700,
          border: "none", borderRadius: 12,
          background: destination.trim() ? C.accent : "#e5e7eb",
          color: destination.trim() ? "#fff" : "#9ca3af",
          cursor: destination.trim() ? "pointer" : "not-allowed",
        }}
      >Continue</button>
    </div>
  );
}

function NetworkCheckView() {
  // Lock 18 · instantaneous · nothing cinematic · one pulse
  return (
    <div style={{ paddingTop: 40, textAlign: "center" }}>
      <div style={{ fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", color: C.accent, fontWeight: 800, marginBottom: 6 }}>
        NEX Network
      </div>
      <div style={{ fontSize: 17, color: C.ink, fontWeight: 500 }}>
        Checking nearby providers
        <span style={{ display: "inline-block", marginLeft: 6, fontSize: 22, lineHeight: 1, transform: "translateY(3px)", color: C.accent, animation: "nex-pulse-one 1.2s ease-in-out infinite" }}>●</span>
      </div>
    </div>
  );
}

function ProvidersView({ providers, onRequest, onBack, busy, liveMode }: {
  providers: ProviderCandidate[];
  onRequest: (p: ProviderCandidate) => void;
  onBack: () => void; busy: boolean;
  liveMode: MobilityLiveMode;
}) {
  return (
    <div style={{ paddingTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", color: C.accent, fontWeight: 800 }}>
            NEX NETWORK
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.ink, marginTop: 2 }}>
            {providers.length} available {providers.length === 1 ? "provider" : "providers"}
          </div>
        </div>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.inkMuted, fontSize: 13, cursor: "pointer" }}>← back</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
        {providers.map((p) => (
          <ProviderCard key={p.provider_id} p={p} onRequest={() => onRequest(p)} busy={busy} liveMode={liveMode} />
        ))}
      </div>
    </div>
  );
}

// Six-line format per lock 27 · WHO · BIKE · COLOUR · DISTANCE · ETA · PRICE
function ProviderCard({ p, onRequest, busy, liveMode }: {
  p: ProviderCandidate; onRequest: () => void; busy: boolean; liveMode: MobilityLiveMode;
}) {
  const colourName = colourNameFromHex(p.bike_color_hex);
  const bikeLine = `${p.bike_brand} ${p.bike_model} · `;
  const attrs: string[] = [];
  if (p.rating_avg != null) attrs.push(`★ ${p.rating_avg.toFixed(1)}`);
  if (p.secondary_language) attrs.push(p.secondary_language);
  if (p.provides_raincoat) attrs.push("Raincoat");

  // v1 default: distance/ETA null → EST fallback line
  const liveOrEst = liveMode !== "off" && p.is_live
    ? formatLiveOrEstLine({
        isLive: true, isDemoLive: liveMode === "demo-live",
        distance_m: p.distance_m, bearing_deg: null, eta_seconds: p.eta_seconds,
        moving: false, last_reading_at: Date.now(),
      })
    : "EST · nearby";

  return (
    <div style={{
      background: C.cardBg, backdropFilter: "blur(28px)",
      border: `1px solid ${C.cardBorder}`, borderRadius: 18,
      padding: "14px 16px",
      color: C.cardInk,
      display: "grid", gridTemplateColumns: "1fr 92px", gap: 12,
      alignItems: "center",
    }}>
      {/* Left · typography */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: 0.3 }}>{p.name.toUpperCase()}</div>
        <div style={{ fontSize: 13, marginTop: 4, color: C.cardInk }}>
          {bikeLine}
          <span style={{ fontWeight: 700 }}>{colourName}</span>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, background: p.bike_color_hex, marginLeft: 6, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)" }} />
        </div>
        {attrs.length > 0 && (
          <div style={{ fontSize: 12, color: C.cardInkSoft, marginTop: 3 }}>{attrs.join(" · ")}</div>
        )}
        <div style={{ fontSize: 11, color: C.cardInkSoft, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
          {liveOrEst}
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, marginTop: 6, letterSpacing: 0.3, fontVariantNumeric: "tabular-nums" }}>
          {fmtIdr(p.price_idr)}
        </div>
      </div>

      {/* Right · bike as recognition object · tinted */}
      <TintedBike bikeSlug={p.bike_slug} paintHex={p.bike_color_hex} height={72} />

      {/* Action · full-width below · lock 14 (one primary action per state) */}
      <button
        onClick={onRequest}
        disabled={busy}
        style={{
          gridColumn: "1 / -1",
          marginTop: 8, minHeight: 44,
          background: C.accent, color: "#fff",
          border: "none", borderRadius: 10,
          fontSize: 13, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase",
          cursor: busy ? "wait" : "pointer",
        }}
      >Request this provider</button>

      {/* Legal quiet-copy · foot line · lock 11 */}
      <div style={{ gridColumn: "1 / -1", fontSize: 10, color: C.cardInkSoft, opacity: 0.7, textAlign: "center", marginTop: 2 }}>
        Provider · {p.name} · Independent provider
      </div>
    </div>
  );
}

function RequestBroadcastView({ selected, onCancel }: {
  selected: ProviderCandidate | null; onCancel: () => void;
}) {
  return (
    <div style={{ paddingTop: 60, textAlign: "center" }}>
      <div style={{ fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", color: C.accent, fontWeight: 800, marginBottom: 8 }}>
        NEX Network
      </div>
      <div style={{ fontSize: 20, color: C.ink, fontWeight: 600, lineHeight: 1.3 }}>
        Your request is reaching{" "}
        <span style={{ display: "inline-block", position: "relative" }}>
          nearby providers
          <span style={{ display: "inline-block", marginLeft: 6, color: C.accent, animation: "nex-pulse-one 1.4s ease-in-out infinite" }}>●</span>
        </span>
      </div>
      {selected && (
        <div style={{ marginTop: 24, fontSize: 12, color: C.inkMuted }}>
          Sent to {selected.name} and other eligible providers
        </div>
      )}
      <button onClick={onCancel} style={{ marginTop: 40, background: "none", border: "none", color: C.inkMuted, fontSize: 14, cursor: "pointer", textDecoration: "underline" }}>
        Cancel request
      </button>
    </div>
  );
}

function ConnectedBeatView({ selected, priceAgreed, onTap }: {
  selected: ProviderCandidate | null; priceAgreed: number; onTap: () => void;
}) {
  if (!selected) return null;
  const colourName = colourNameFromHex(selected.bike_color_hex);
  return (
    <div onClick={onTap} style={{ paddingTop: 60, textAlign: "center", cursor: "pointer" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.ink, animation: "nex-fade-in 300ms ease-out" }}>
        {selected.name} accepted.
      </div>

      {/* Lock 22 · typographic connection line · NOT arrows · fades away forever */}
      <div style={{
        marginTop: 22, fontSize: 11, fontWeight: 700, letterSpacing: 1.4,
        color: C.inkSoft, textTransform: "uppercase",
        animation: "nex-connect-in 500ms 400ms both ease-out",
      }}>
        YOU &nbsp; · &nbsp; NEX NETWORK &nbsp; · &nbsp; {selected.name.toUpperCase()}
      </div>

      <div style={{ marginTop: 22, fontSize: 17, color: C.ink, animation: "nex-fade-in 300ms 900ms both ease-out" }}>
        You&apos;re connected.
      </div>

      {/* Repeat price at connection · lock 32 */}
      <div style={{
        marginTop: 34, animation: "nex-fade-in 300ms 1100ms both ease-out",
        fontSize: 14, color: C.inkSoft, lineHeight: 1.7,
      }}>
        <div>{selected.bike_brand} {selected.bike_model} · <span style={{ fontWeight: 700, color: C.ink }}>{colourName}</span></div>
        <div style={{ fontWeight: 700, color: C.ink, fontSize: 18, fontVariantNumeric: "tabular-nums", marginTop: 4 }}>{fmtIdr(priceAgreed)}</div>
        <div style={{ fontSize: 11, color: C.inkMuted, marginTop: 6 }}>Independent provider · NEX Network</div>
      </div>

      <div style={{ marginTop: 30, fontSize: 11, color: C.inkMuted, opacity: 0.65 }}>
        tap to continue
      </div>
    </div>
  );
}

function ApproachingView({ state, provider, priceAgreed, live, onCancel, onDeclareNearby, onDeclareService }: {
  state: "APPROACHING" | "NEARBY";
  provider: ProviderCandidate;
  priceAgreed: number;
  live: ReturnType<typeof useRealVsEstimated>;
  onCancel: () => void;
  onDeclareNearby: () => void;
  onDeclareService: () => void;
}) {
  const colourName = colourNameFromHex(provider.bike_color_hex);
  const isNearby = state === "NEARBY";
  const heading = isNearby ? `${provider.name.toUpperCase()} IS NEARBY` : `${provider.name.toUpperCase()} IS ON THE WAY`;

  // Lock 25 · REAL DATA GATE · only render bike motion if isLive
  const bikeAnimation = live.isLive && live.moving
    ? "nex-bike-lift 3s ease-in-out infinite"
    : "nex-bike-still 3s linear infinite";

  const liveOrEstLine = formatLiveOrEstLine(live, "6-8 min");

  return (
    <div style={{ paddingTop: 30, textAlign: "center" }}>
      <div style={{ fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", color: C.accent, fontWeight: 800, marginBottom: 8 }}>
        NEX Mobility
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.ink, letterSpacing: -0.3 }}>{heading}</div>

      {/* Real-world identification · bike colour first */}
      <div style={{ marginTop: 6, fontSize: 15, color: C.ink }}>
        {isNearby ? "Look for the " : ""}
        <span style={{ fontWeight: 800 }}>{colourName}</span>
        {" "}{provider.bike_brand} {provider.bike_model}
      </div>
      <div style={{ marginTop: 4, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 14, fontWeight: 600, color: C.ink, letterSpacing: 1 }}>
        {provider.plate.toUpperCase()}
      </div>

      {/* Bike as recognition object · tinted */}
      <div style={{ marginTop: 20, display: "flex", justifyContent: "center", height: 140 }}>
        <div style={{ animation: bikeAnimation }}>
          <TintedBike bikeSlug={provider.bike_slug} paintHex={provider.bike_color_hex} height={140} />
        </div>
      </div>

      {/* LIVE / EST inline · lock 16 · never a giant badge */}
      {liveOrEstLine && (
        <div style={{
          marginTop: 12, fontSize: 12, color: C.inkSoft,
          fontVariantNumeric: "tabular-nums", letterSpacing: 0.5,
        }}>{liveOrEstLine}</div>
      )}

      {/* Directional cue · one-shot · only when real bearing exists · lock 12 */}
      {live.isLive && live.bearing_deg != null && (
        <div style={{
          marginTop: 8, fontSize: 20, color: C.accent,
          transform: `rotate(${live.bearing_deg}deg)`, display: "inline-block",
          animation: "nex-fade-in 300ms ease-out",
        }} aria-label={`bearing ${live.bearing_deg}°`}>↑</div>
      )}

      {/* Demo-live disclosure · doctrine-critical honesty */}
      {live.isDemoLive && (
        <div style={{
          marginTop: 10, fontSize: 10, color: C.inkMuted, opacity: 0.7,
          letterSpacing: 0.8, textTransform: "uppercase",
        }}>demo live · not real GPS</div>
      )}

      {/* Price + provider foot · lock 32 */}
      <div style={{ marginTop: 20, fontSize: 13, color: C.inkSoft }}>
        <span style={{ fontWeight: 700, color: C.ink, fontVariantNumeric: "tabular-nums" }}>{fmtIdr(priceAgreed)}</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 10, color: C.inkMuted, opacity: 0.75 }}>
        Provider · {provider.name} · Independent provider
      </div>

      {/* Actions · one primary · one secondary */}
      <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          onClick={() => alert("CHAT is opened here — pending State CHAT wiring")}
          style={{ minHeight: 48, padding: "12px 16px", background: C.ink, color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
        >Chat with {provider.name}</button>
        {isNearby ? (
          <button onClick={onDeclareService} style={{ minHeight: 44, background: "none", border: `1px solid ${C.border}`, color: C.ink, borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            I&apos;m on the bike (start service)
          </button>
        ) : (
          <button onClick={onDeclareNearby} style={{ minHeight: 44, background: "none", border: `1px solid ${C.border}`, color: C.ink, borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {provider.name} is nearby (demo advance)
          </button>
        )}
        <button onClick={onCancel} style={{ minHeight: 40, background: "none", border: "none", color: C.inkMuted, fontSize: 13, cursor: "pointer" }}>
          Cancel request
        </button>
      </div>
    </div>
  );
}

function ServiceView({ provider, onComplete }: {
  provider: ProviderCandidate; onComplete: () => void;
}) {
  const colourName = colourNameFromHex(provider.bike_color_hex);
  return (
    <div style={{ paddingTop: 20 }}>
      {/* Compact bar · lock: user can put phone down */}
      <div style={{
        background: C.cardBg, backdropFilter: "blur(28px)",
        border: `1px solid ${C.cardBorder}`, borderRadius: 14,
        padding: "12px 14px", color: C.cardInk, fontSize: 13,
      }}>
        <span style={{ color: C.accent, fontSize: 10, letterSpacing: 1.4, fontWeight: 800 }}>CONNECTED</span>
        &nbsp; · &nbsp; {provider.name} · <span style={{ fontWeight: 700 }}>{colourName}</span> {provider.bike_brand} {provider.bike_model} · {provider.plate.toUpperCase()}
      </div>

      <div style={{ marginTop: 20, padding: "16px 18px", background: "#f9fafb", border: `1px solid ${C.border}`, borderRadius: 12, fontSize: 13, color: C.inkSoft, lineHeight: 1.55 }}>
        <div style={{ fontWeight: 700, color: C.ink, marginBottom: 4 }}>Helmet fastened? Comfortable with the speed?</div>
        If you&apos;d like slower, just say{" "}
        <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 700, color: C.accent }}>&quot;pelan-pelan&quot;</span>
        {" "}— {provider.name} will understand.
        <div style={{ marginTop: 6 }}>
          Otherwise, please save conversation for when you stop. Your safety and {provider.name}&apos;s focus matter most.
        </div>
      </div>

      <button onClick={onComplete} style={{ marginTop: 24, width: "100%", minHeight: 48, background: C.ink, color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
        Complete service (demo)
      </button>
    </div>
  );
}

function CompletedView({ provider, priceAgreed, onNewRequest }: {
  provider: ProviderCandidate; priceAgreed: number; onNewRequest: () => void;
}) {
  const colourName = colourNameFromHex(provider.bike_color_hex);
  return (
    <div style={{ paddingTop: 50, textAlign: "center" }}>
      <div style={{
        width: 60, height: 60, borderRadius: 999,
        background: "#dcfce7", color: "#166534",
        display: "grid", placeItems: "center", margin: "0 auto",
        fontSize: 30, fontWeight: 800,
        animation: "nex-check-reveal 300ms ease-out",
      }}>✓</div>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: "18px 0 8px" }}>You&apos;ve arrived.</h1>
      <div style={{ fontSize: 14, color: C.inkSoft }}>
        {provider.name} · <span style={{ fontWeight: 700, color: C.ink }}>{colourName}</span> {provider.bike_brand} {provider.bike_model}
      </div>
      <div style={{ marginTop: 8, fontWeight: 800, fontSize: 20, color: C.ink, fontVariantNumeric: "tabular-nums" }}>
        {fmtIdr(priceAgreed)}
      </div>
      <div style={{ marginTop: 30, display: "flex", flexDirection: "column", gap: 10 }}>
        <button onClick={() => alert("RATE flow · pending wiring")} style={{ minHeight: 48, background: C.accent, color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          Rate {provider.name}
        </button>
        <button onClick={onNewRequest} style={{ minHeight: 40, background: "none", border: "none", color: C.inkMuted, fontSize: 13, cursor: "pointer" }}>
          Start a new request
        </button>
      </div>
    </div>
  );
}

function CancelledView({ onNewRequest }: { onNewRequest: () => void }) {
  return (
    <div style={{ paddingTop: 60, textAlign: "center" }}>
      <div style={{ fontSize: 18, color: C.ink, fontWeight: 600 }}>Request cancelled.</div>
      <div style={{ marginTop: 8, fontSize: 13, color: C.inkMuted }}>No one was billed.</div>
      <button onClick={onNewRequest} style={{ marginTop: 24, minHeight: 44, padding: "10px 22px", background: C.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
        Start a new request
      </button>
    </div>
  );
}

function TimedOutView({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={{ paddingTop: 60, textAlign: "center" }}>
      <div style={{ fontSize: 18, color: C.ink, fontWeight: 600 }}>
        No provider has accepted yet.
      </div>
      <div style={{ marginTop: 8, fontSize: 13, color: C.inkMuted }}>
        Try nearby providers again?
      </div>
      <button onClick={onRetry} style={{ marginTop: 24, minHeight: 44, padding: "10px 22px", background: C.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
        Try again
      </button>
    </div>
  );
}

// ── Tinted bike renderer · uses canvas paint-swap · same engine as DriverBikeCard
function TintedBike({ bikeSlug, paintHex, height }: { bikeSlug: string; paintHex: string; height: number }) {
  const baseSrc = `/nex/bikes/${bikeSlug}.png`;
  const [src, setSrc] = useState<string>(baseSrc);

  useEffect(() => {
    setSrc(baseSrc);
    const img = new Image();
    img.onload = () => {
      try { setSrc(tintBike(img, paintHex)); } catch { /* keep base */ }
    };
    img.src = baseSrc;
  }, [baseSrc, paintHex]);

  return (
    <img
      src={src}
      alt=""
      style={{
        display: "block", maxWidth: "100%",
        height, width: "auto", objectFit: "contain",
        filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))",
      }}
    />
  );
}

// ── Colour hex → nearest named colour · for the recognition line ───────
function colourNameFromHex(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return "coloured";
  const r = parseInt(m[1],16), g = parseInt(m[2],16), b = parseInt(m[3],16);
  const palette: Array<[string, number, number, number]> = [
    ["Black",   17,  24,  39],
    ["White",   241, 245, 249],
    ["Silver",  148, 163, 184],
    ["Red",     220, 38,  38],
    ["Orange",  249, 115, 22],
    ["Yellow",  234, 179, 8],
    ["Green",   34,  197, 94],
    ["Blue",    59,  130, 246],
    ["Purple",  139, 92,  246],
    ["Pink",    236, 72,  153],
    ["Brown",   120, 53,  15],
    ["Cream",   245, 245, 220],
    ["Turquoise", 94, 234, 212],
  ];
  let best = palette[0], bestDist = Infinity;
  for (const p of palette) {
    const dr = r - p[1], dg = g - p[2], db = b - p[3];
    const d = dr*dr + dg*dg + db*db;
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return best[0];
}
