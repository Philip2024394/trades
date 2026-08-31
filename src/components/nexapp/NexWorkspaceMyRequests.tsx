// src/components/nexapp/NexWorkspaceMyRequests.tsx · Philip 2026-08-29
//
// Activity → My requests workspace · lives INSIDE the /nexapp shell.
// Customer-side symmetry with the provider inbox — this is what a normal
// NEX user sees for the requests THEY have sent (as opposed to the ones
// providers RECEIVE).
//
// State-aware rendering per doctrine:
//   REQUEST_BROADCAST  · "Reaching nearby providers…" (never a countdown)
//   CONNECTED / APPROACHING / NEARBY / SERVICE · "Connected with <name>"
//   COMPLETED          · "Completed · <price> · <provider>"
//   CANCELLED_*        · "Cancelled"
//   TIMED_OUT          · "No provider has accepted yet"
//
// Polls every 4 seconds so a broadcast-state row transitions to
// connected/completed without manual refresh.

"use client";

import React, { useCallback, useEffect, useState } from "react";

type ServiceKind = "bike" | "parcel" | "food";
type RequestState =
  | "DESTINATION" | "NETWORK_CHECK" | "PROVIDERS"
  | "REQUEST_BROADCAST"
  | "CONNECTED" | "APPROACHING" | "NEARBY" | "SERVICE"
  | "COMPLETED"
  | "CANCELLED_BY_USER" | "DECLINED_BY_PROVIDER"
  | "TIMED_OUT" | "PROVIDER_LOST_SIGNAL";

interface CustomerRequest {
  request_id: string;
  service_kind: ServiceKind;
  state: RequestState;
  destination_text: string;
  origin_text: string | null;
  requested_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  broadcast_expires_at: string | null;
  price_agreed_idr: number | null;
  provider: {
    provider_id: string;
    name: string;
    plate: string | null;
    bike_slug: string | null;
    bike_color_hex: string | null;
    bike_brand: string | null;
    bike_model: string | null;
    bike_cc: number | null;
    bike_category: string | null;
    secondary_language: string | null;
    provides_raincoat: boolean | null;
    rating_avg: number | null;
  } | null;
}
interface Response {
  ok: boolean;
  requests: CustomerRequest[];
}

const POLL_MS = 4000;

function ensureDeviceId(): string {
  if (typeof window === "undefined") return "device:preview-ssr";
  let id = localStorage.getItem("nex_device_id");
  if (!id || !id.startsWith("device:")) {
    id = "device:" + (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2));
    localStorage.setItem("nex_device_id", id);
  }
  return id;
}
function fmtIdr(n: number | null): string { return n == null ? "—" : "Rp " + n.toLocaleString("id-ID"); }
function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

const SERVICE_LABEL: Record<ServiceKind, string> = { bike: "Bike", parcel: "Parcel", food: "Food" };

// Doctrine-compliant, calm state summary. Never a countdown, never
// "assigning driver," never fabricated progress.
function stateSummary(r: CustomerRequest): { label: string; tone: "info" | "live" | "ok" | "muted"; body: string } {
  switch (r.state) {
    case "REQUEST_BROADCAST":
      return {
        label: "Reaching providers",
        tone: "live",
        body: "Your request is reaching nearby providers.",
      };
    case "CONNECTED":
    case "APPROACHING":
    case "NEARBY":
    case "SERVICE":
      return {
        label: "Connected",
        tone: "ok",
        body: r.provider
          ? `Connected with ${r.provider.name}${r.provider.plate ? ` · ${r.provider.plate}` : ""}.`
          : "Connected.",
      };
    case "COMPLETED":
      return {
        label: "Completed",
        tone: "muted",
        body: r.provider
          ? `Completed with ${r.provider.name} · ${fmtIdr(r.price_agreed_idr)}.`
          : `Completed · ${fmtIdr(r.price_agreed_idr)}.`,
      };
    case "CANCELLED_BY_USER":
      return { label: "Cancelled", tone: "muted", body: "You cancelled this request." };
    case "DECLINED_BY_PROVIDER":
      return { label: "Declined", tone: "muted", body: "Provider declined. NEX offered it to the next eligible provider." };
    case "TIMED_OUT":
      return { label: "No providers", tone: "muted", body: "No provider has accepted yet. Try nearby providers again?" };
    case "PROVIDER_LOST_SIGNAL":
      return { label: "Signal lost", tone: "info", body: "The provider went offline mid-service." };
    default:
      return { label: r.state, tone: "muted", body: "" };
  }
}

const TONE: Record<"info" | "live" | "ok" | "muted", { bg: string; border: string; ink: string }> = {
  info:  { bg: "rgba(59,130,246,0.14)",  border: "rgba(59,130,246,0.35)",  ink: "rgba(147,197,253,0.95)" },
  live:  { bg: "rgba(249,115,22,0.14)",  border: "rgba(249,115,22,0.4)",   ink: "rgba(254,215,170,0.98)" },
  ok:    { bg: "rgba(34,197,94,0.14)",   border: "rgba(34,197,94,0.4)",    ink: "rgba(134,239,172,0.98)" },
  muted: { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)", ink: "rgba(203,213,225,0.75)" },
};

export function NexWorkspaceMyRequests() {
  const [learner, setLearner] = useState("");
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (ref: string) => {
    try {
      const r = await fetch(`/api/nex/customer/requests?learner_ref=${encodeURIComponent(ref)}`, { cache: "no-store" });
      const j = (await r.json()) as Response;
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
    return () => window.clearInterval(t);
  }, [load]);

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
      }}>Activity · My requests</div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>
        Your NEX requests
      </h1>
      <p style={{ fontSize: 11, color: "rgba(148,163,184,0.85)", marginTop: 6, marginBottom: 14, lineHeight: 1.45 }}>
        Live requests appear here as they progress. Older ones stay for your reference.
      </p>

      {loading && (
        <div style={{
          padding: "14px 16px", borderRadius: 12,
          background: "rgba(15,20,30,0.55)", border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ height: 8, width: 90, background: "rgba(255,255,255,0.06)", borderRadius: 4 }} />
          <div style={{ height: 18, width: 160, background: "rgba(255,255,255,0.07)", borderRadius: 5, marginTop: 10 }} />
        </div>
      )}

      {!loading && requests.length === 0 && (
        <div style={{
          padding: "18px 16px", borderRadius: 12, textAlign: "center",
          background: "rgba(15,20,30,0.55)", border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ fontSize: 13, color: "rgba(245,245,245,0.85)", lineHeight: 1.5 }}>
            No requests yet.
          </div>
          <div style={{ fontSize: 11, color: "rgba(148,163,184,0.75)", marginTop: 6, lineHeight: 1.5 }}>
            Ask NEX for a bike, food run, or parcel — you&apos;ll see the request here as providers respond.
          </div>
        </div>
      )}

      {!loading && requests.map((r) => {
        const s = stateSummary(r);
        const tone = TONE[s.tone];
        return (
          <div key={r.request_id} style={{
            marginBottom: 10, padding: "14px 16px", borderRadius: 14,
            background: "rgba(10,10,12,0.86)",
            border: "1px solid rgba(148,163,184,0.22)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: 1.3, textTransform: "uppercase",
                padding: "3px 8px", borderRadius: 999,
                background: tone.bg, border: `1px solid ${tone.border}`, color: tone.ink,
              }}>{s.label}</span>
              <span style={{ fontSize: 10, color: "rgba(148,163,184,0.6)", letterSpacing: 0.3 }}>
                {SERVICE_LABEL[r.service_kind]}
              </span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(245,245,245,0.98)", letterSpacing: -0.2, lineHeight: 1.2 }}>
              {r.destination_text}
            </div>
            {r.origin_text && (
              <div style={{ fontSize: 11, color: "rgba(148,163,184,0.85)", marginTop: 3 }}>
                from {r.origin_text}
              </div>
            )}
            <div style={{ fontSize: 12, color: "rgba(203,213,225,0.85)", marginTop: 8, lineHeight: 1.5 }}>
              {s.body}
            </div>
            {r.provider && (r.state === "CONNECTED" || r.state === "APPROACHING" || r.state === "NEARBY" || r.state === "SERVICE") && (
              <div style={{
                marginTop: 10, padding: "8px 10px", borderRadius: 10,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                display: "flex", gap: 10, alignItems: "center",
              }}>
                {r.provider.bike_color_hex && (
                  <div style={{
                    width: 22, height: 22, borderRadius: 999,
                    background: r.provider.bike_color_hex,
                    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25), 0 2px 6px rgba(0,0,0,0.35)",
                    flexShrink: 0,
                  }} title={`Bike colour ${r.provider.bike_color_hex}`} />
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(245,245,245,0.95)" }}>
                    {r.provider.name}
                    {r.provider.rating_avg != null && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: "rgba(148,163,184,0.85)" }}>
                        ★ {r.provider.rating_avg.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(148,163,184,0.8)", marginTop: 1 }}>
                    {r.provider.bike_brand} {r.provider.bike_model}
                    {r.provider.plate && ` · ${r.provider.plate}`}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "rgba(134,239,172,0.95)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                  {fmtIdr(r.price_agreed_idr)}
                </div>
              </div>
            )}
            <div style={{ fontSize: 9, color: "rgba(148,163,184,0.55)", marginTop: 8, letterSpacing: 0.3 }}>
              Requested {fmtWhen(r.requested_at)}
              {r.completed_at && ` · Completed ${fmtWhen(r.completed_at)}`}
              {r.cancelled_at && ` · Cancelled ${fmtWhen(r.cancelled_at)}`}
            </div>
          </div>
        );
      })}

      <div style={{ fontSize: 9, color: "rgba(148,163,184,0.5)", textAlign: "center", marginTop: 12 }}>
        Device identity · {learner ? learner.slice(0, 20) + "…" : "generating…"}
      </div>
    </div>
  );
}
