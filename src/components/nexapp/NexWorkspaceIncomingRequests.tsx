// src/components/nexapp/NexWorkspaceIncomingRequests.tsx · Philip 2026-08-29
//
// Activity → Incoming Requests workspace · lives INSIDE the /nexapp
// persistent shell. Migrated from /nex-provider-inbox standalone page
// (Phase 2 · PR-2).
//
// Functional parity — same 3-second polling, same accept/decline flow,
// same race handling (409 → "Another provider accepted first"), same
// EST · nearby distance fallback when coords are absent. Only the outer
// page-shell wrapper is removed; the frame provides the container.
//
// Doctrine anchors:
//   · project_nex_five_button_ia_doctrine_2026_08_29 (Activity room)
//   · project_nex_mobility_doctrine_2026_08_29 (Provider not Driver, never
//     expose 15-second window, EST · nearby fallback, calm race copy)

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

type IncomingRequest = {
  offer_id: string;
  request_id: string;
  service_kind: "bike" | "parcel" | "food";
  destination_text: string;
  origin_text: string | null;
  destination_lat: number | null;
  destination_lng: number | null;
  origin_lat: number | null;
  origin_lng: number | null;
  offered_price_idr: number;
  sent_at: string;
  seen_at: string | null;
  expires_at: string;
};
type InboxResponse = {
  ok: boolean;
  provider: {
    provider_id: string;
    name: string;
    is_available: boolean;
    status: string;
  } | null;
  requests: IncomingRequest[];
  hint?: string;
};

const POLL_MS = 3000;

function ensureDeviceId(): string {
  if (typeof window === "undefined") return "device:preview-ssr";
  let id = localStorage.getItem("nex_device_id");
  if (!id || !id.startsWith("device:")) {
    id = "device:" + (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2));
    localStorage.setItem("nex_device_id", id);
  }
  return id;
}
function fmtIdr(n: number): string { return "Rp " + n.toLocaleString("id-ID"); }
function haversineMeters(
  a: { lat: number; lng: number } | null,
  b: { lat: number; lng: number } | null,
): number | null {
  if (!a || !b) return null;
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
const SERVICE_LABEL: Record<IncomingRequest["service_kind"], string> = {
  bike: "Bike", parcel: "Parcel", food: "Food",
};

export function NexWorkspaceIncomingRequests() {
  const [learner, setLearner] = useState("");
  const [data, setData] = useState<InboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyOffer, setBusyOffer] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ tone: "ok" | "info" | "err"; msg: string } | null>(null);
  const flashTimer = useRef<number | null>(null);

  const load = useCallback(async (ref: string) => {
    try {
      const r = await fetch(`/api/nex/provider/inbox?learner_ref=${encodeURIComponent(ref)}`,
        { cache: "no-store" });
      const j = (await r.json()) as InboxResponse;
      setData(j);
    } catch {
      // Network hiccup · keep last-good state · poll will retry
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = ensureDeviceId();
    setLearner(id);
    load(id);
    const t = window.setInterval(() => load(id), POLL_MS);
    return () => {
      window.clearInterval(t);
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    };
  }, [load]);

  function showFlash(tone: "ok" | "info" | "err", msg: string, ms = 4000) {
    setFlash({ tone, msg });
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), ms);
  }

  async function respond(req: IncomingRequest, action: "accept" | "decline") {
    if (!data?.provider) return;
    setBusyOffer(req.offer_id);
    try {
      const r = await fetch(`/api/nex/service-request/${req.request_id}/accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider_id: data.provider.provider_id, action }),
      });
      const j = await r.json();
      if (action === "decline") {
        showFlash("info", "Declined. NEX will offer this to another provider.");
      } else if (r.ok && j.ok && j.action === "accepted") {
        showFlash("ok",
          `Connected · ${fmtIdr(j.price_agreed_idr ?? req.offered_price_idr)} · ${req.destination_text}`);
      } else if (r.status === 409) {
        showFlash("info", "Another provider accepted first.");
      } else if (r.status === 410) {
        showFlash("info", "The request window closed.");
      } else {
        showFlash("err", j.error ?? "Could not send response.");
      }
      await load(learner);
    } catch (err) {
      showFlash("err", err instanceof Error ? err.message : String(err));
    } finally {
      setBusyOffer(null);
    }
  }

  const provider = data?.provider ?? null;
  const requests = data?.requests ?? [];

  return (
    <div style={{
      color: "rgba(245,245,245,0.94)",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      padding: "12px 14px 24px",
      height: "100%", overflowY: "auto",
    }}>
      <div style={{
        fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase",
        color: "rgba(249,115,22,0.92)", fontWeight: 800, marginBottom: 4,
      }}>NEX Provider · Requests</div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>
        {provider?.name ? `Hi ${provider.name}` : "Provider inbox"}
      </h1>
      <p style={{ fontSize: 11, color: "rgba(148,163,184,0.85)", marginTop: 6, marginBottom: 14, lineHeight: 1.45 }}>
        Accept the requests that fit — first provider to accept wins.
      </p>

      {loading && <SkeletonRow />}

      {!loading && !provider && (
        <Card>
          <div style={{ fontSize: 12, color: "rgba(245,245,245,0.85)", lineHeight: 1.5 }}>
            No provider profile on this device. Go to <b>Me → My roles → Become a provider</b> first.
          </div>
        </Card>
      )}

      {!loading && provider && !provider.is_available && (
        <Card tone="warn">
          <div style={{
            fontSize: 9, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase",
            color: "rgba(252,211,77,0.98)", marginBottom: 4,
          }}>You&apos;re offline</div>
          <div style={{ fontSize: 12, color: "rgba(245,245,245,0.85)", lineHeight: 1.5 }}>
            Requests only reach available providers. Toggle <b>I&apos;m available</b> on your provider profile (Me → My roles → Become a provider) to start receiving requests.
          </div>
        </Card>
      )}

      {!loading && provider && provider.is_available && requests.length === 0 && (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{
              width: 8, height: 8, borderRadius: 999,
              background: "rgba(34,197,94,0.95)",
              boxShadow: "0 0 12px rgba(34,197,94,0.6)",
              animation: "nex-pulse 1.8s ease-in-out infinite",
            }} />
            <div style={{
              fontSize: 9, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase",
              color: "rgba(134,239,172,0.95)",
            }}>You&apos;re on</div>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: "rgba(245,245,245,0.85)" }}>
            NEX will send matching requests here as they come in.
          </div>
          <style>{`@keyframes nex-pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }`}</style>
        </Card>
      )}

      {!loading && provider && requests.map((req) => (
        <RequestCard
          key={req.offer_id}
          req={req}
          busy={busyOffer === req.offer_id}
          onAccept={() => respond(req, "accept")}
          onDecline={() => respond(req, "decline")}
        />
      ))}

      {flash && (
        <div style={{
          marginTop: 12, padding: "10px 12px",
          borderRadius: 10, fontSize: 12, lineHeight: 1.4, fontWeight: 600,
          background:
            flash.tone === "ok"  ? "rgba(21,128,61,0.28)"
          : flash.tone === "err" ? "rgba(153,27,27,0.28)"
          :                        "rgba(30,41,59,0.6)",
          color:
            flash.tone === "ok"  ? "rgba(220,252,231,0.98)"
          : flash.tone === "err" ? "rgba(254,226,226,0.98)"
          :                        "rgba(226,232,240,0.98)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}>{flash.msg}</div>
      )}
    </div>
  );
}

function Card({ children, tone }: { children: React.ReactNode; tone?: "warn" }) {
  return (
    <div style={{
      marginBottom: 12, padding: "14px 16px", borderRadius: 14,
      background: tone === "warn" ? "rgba(120,53,15,0.32)" : "rgba(15,20,30,0.6)",
      border: tone === "warn" ? "1px solid rgba(252,211,77,0.4)" : "1px solid rgba(255,255,255,0.06)",
    }}>{children}</div>
  );
}
function SkeletonRow() {
  return (
    <div style={{
      marginBottom: 12, padding: "14px 16px", borderRadius: 14,
      background: "rgba(15,20,30,0.55)", border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{ height: 8, width: 90, background: "rgba(255,255,255,0.06)", borderRadius: 4 }} />
      <div style={{ height: 18, width: 160, background: "rgba(255,255,255,0.07)", borderRadius: 5, marginTop: 10 }} />
    </div>
  );
}
function RequestCard({
  req, busy, onAccept, onDecline,
}: {
  req: IncomingRequest; busy: boolean;
  onAccept: () => void; onDecline: () => void;
}) {
  const distance = haversineMeters(
    req.origin_lat != null && req.origin_lng != null
      ? { lat: req.origin_lat, lng: req.origin_lng } : null,
    req.destination_lat != null && req.destination_lng != null
      ? { lat: req.destination_lat, lng: req.destination_lng } : null,
  );
  const distanceLine =
    distance != null
      ? `${(distance / 1000).toFixed(distance < 10000 ? 1 : 0)} km`
      : "EST · nearby"; // doctrine: never fabricate

  return (
    <div style={{
      position: "relative", marginBottom: 12, padding: "16px 18px 14px",
      borderRadius: 16,
      background: "rgba(10,10,12,0.86)",
      backdropFilter: "blur(28px) saturate(140%)",
      border: "1px solid rgba(148,163,184,0.22)",
      boxShadow: "0 12px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)",
    }}>
      <div style={{
        fontSize: 9, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase",
        color: "rgba(249,115,22,0.95)", marginBottom: 4,
      }}>
        New {SERVICE_LABEL[req.service_kind]} Request
      </div>
      <div style={{
        fontSize: 20, fontWeight: 700, letterSpacing: -0.3,
        color: "rgba(245,245,245,0.98)", lineHeight: 1.15,
      }}>{req.destination_text}</div>
      {req.origin_text && (
        <div style={{ fontSize: 11, color: "rgba(148,163,184,0.85)", marginTop: 4 }}>
          from {req.origin_text}
        </div>
      )}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 10, marginTop: 10,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: "rgba(148,163,184,0.9)",
          padding: "3px 9px", borderRadius: 999,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}>{distanceLine}</div>
        <div style={{
          fontSize: 20, fontWeight: 800, letterSpacing: -0.4,
          color: "rgba(134,239,172,0.98)", fontFeatureSettings: "'tnum'",
        }}>{fmtIdr(req.offered_price_idr)}</div>
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8, marginTop: 14,
      }}>
        <button onClick={onDecline} disabled={busy}
          style={{
            minHeight: 46, background: "transparent",
            color: "rgba(203,213,225,0.9)", border: "1px solid rgba(148,163,184,0.35)",
            borderRadius: 10,
            fontSize: 13, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase",
            cursor: busy ? "wait" : "pointer", fontFamily: "inherit",
          }}>Decline</button>
        <button onClick={onAccept} disabled={busy}
          style={{
            minHeight: 46,
            background: busy ? "rgba(21,128,61,0.6)"
              : "linear-gradient(180deg, rgba(34,197,94,0.98), rgba(21,128,61,0.98))",
            color: "white", border: "1px solid rgba(34,197,94,0.85)", borderRadius: 10,
            fontSize: 14, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase",
            cursor: busy ? "wait" : "pointer",
            boxShadow: busy ? "none" : "0 6px 20px rgba(34,197,94,0.35)",
            fontFamily: "inherit",
          }}>{busy ? "Sending…" : "Accept"}</button>
      </div>
    </div>
  );
}
