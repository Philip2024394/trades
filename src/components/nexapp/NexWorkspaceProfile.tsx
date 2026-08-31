// src/components/nexapp/NexWorkspaceProfile.tsx · Philip 2026-08-29
//
// Me → Profile workspace · replaces the "coming soon" NexWorkspaceIdle
// stub. Shows a normal NEX user's identity + attached role summaries.
//
// Read-only in this pass. Edits happen in the source workspaces:
//   · Provider details       → Me → My roles → Become a provider
//   · Wallet balance / top-up → Wallet → Balance
//
// Role additivity (per five-button IA doctrine): the base identity block
// always renders. Provider block appears only when a provider profile is
// attached to this device. Wallet block renders when there's an on-file
// balance. Missing pieces render as gentle "not yet" states, not errors.

"use client";

import React, { useCallback, useEffect, useState } from "react";

interface ProviderProfile {
  provider_id: string;
  full_name: string | null;
  whatsapp_e164: string | null;
  photo_url: string | null;
  bike_slug: string | null;
  bike_year: number | null;
  bike_color_hex: string | null;
  plate: string | null;
  city: string | null;
  secondary_language: string | null;
  provides_raincoat: boolean | null;
  price_per_service_idr: number | null;
  is_available: boolean;
  status: string;
  rating_avg: number | null;
  rating_count: number | null;
  registered_at: string | null;
}
interface WalletSnapshot {
  balance_idr: number;
  updated_at: string | null;
}
interface AllowanceSnapshot {
  allowance: number;
  used_this_month: number;
  remaining_this_month: number;
}

function ensureDeviceId(): string {
  if (typeof window === "undefined") return "device:preview-ssr";
  let id = localStorage.getItem("nex_device_id");
  if (!id || !id.startsWith("device:")) {
    id = "device:" + (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2));
    localStorage.setItem("nex_device_id", id);
  }
  return id;
}
function fmtIdr(n: number | null | undefined): string {
  if (n == null) return "—";
  return "Rp " + n.toLocaleString("id-ID");
}
function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export function NexWorkspaceProfile() {
  const [learner, setLearner] = useState<string>("");
  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);
  const [allowance, setAllowance] = useState<AllowanceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (ref: string) => {
    setLoading(true);
    try {
      // Provider profile (returns null profile if this device hasn't registered)
      const pRes = await fetch(`/api/nex/provider/register?learner_ref=${encodeURIComponent(ref)}`);
      const pJson = await pRes.json();
      setProvider(pJson.profile ?? null);

      // Wallet (returns nulls when there's no provider row)
      const wRes = await fetch(`/api/nex/provider/wallet?learner_ref=${encodeURIComponent(ref)}`);
      const wJson = await wRes.json();
      setWallet(wJson.wallet ?? null);
      setAllowance(wJson.monthly_allowance ?? null);
    } catch {
      // Silent · UI degrades gracefully to unloaded state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = ensureDeviceId();
    setLearner(id);
    load(id);
  }, [load]);

  const hasProvider = !!provider;
  // Active roles derived from what's attached to this device. Later this
  // will also read business/creator attachments. For now: provider only.
  const activeRoles: string[] = hasProvider ? ["provider"] : [];

  return (
    <div style={{
      color: "rgba(245,245,245,0.94)",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      padding: "12px 14px 24px",
      height: "100%", overflowY: "auto",
    }}>
      <div style={{
        fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase",
        color: "rgba(249,115,22,0.9)", fontWeight: 800, marginBottom: 4,
      }}>Me · Profile</div>

      {/* Identity block · always visible */}
      <div style={{
        marginTop: 4, padding: "16px 18px",
        background: "rgba(10,10,12,0.86)",
        border: "1px solid rgba(148,163,184,0.22)",
        borderRadius: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 999,
            background: "linear-gradient(135deg, #f97316, #a855f7)",
            display: "grid", placeItems: "center",
            fontSize: 20, fontWeight: 800, color: "white",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            flexShrink: 0,
          }}>
            {provider?.full_name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: "rgba(245,245,245,0.97)", letterSpacing: -0.2 }}>
              {provider?.full_name ?? "Anonymous NEX user"}
            </div>
            <div style={{ fontSize: 10, color: "rgba(148,163,184,0.75)", marginTop: 3, letterSpacing: 0.2 }}>
              Device identity · {learner ? learner.slice(0, 22) + "…" : "generating…"}
            </div>
          </div>
        </div>

        {/* Roles chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
          <RoleChip label="User" active tone="user" />
          <RoleChip label="Provider" active={activeRoles.includes("provider")} tone="provider" />
          <RoleChip label="Business" active={false} tone="business" />
          <RoleChip label="Creator" active={false} tone="creator" />
        </div>
        <div style={{ fontSize: 10, color: "rgba(148,163,184,0.7)", marginTop: 8, lineHeight: 1.5 }}>
          Change roles in <b style={{ color: "rgba(245,245,245,0.85)" }}>Me → My roles</b>.
        </div>
      </div>

      {/* Provider block · if attached */}
      {hasProvider && provider && (
        <>
          <SectionTitle>Provider profile</SectionTitle>
          <Card>
            <KeyVal k="Name" v={provider.full_name} />
            <KeyVal k="City" v={provider.city} />
            {provider.bike_color_hex && (
              <KeyValRow k="Bike colour" v={
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: 999,
                    background: provider.bike_color_hex,
                    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)",
                  }} />
                  <span style={{ fontSize: 11, color: "rgba(148,163,184,0.85)", fontFamily: "monospace" }}>
                    {provider.bike_color_hex}
                  </span>
                </div>
              } />
            )}
            <KeyVal k="Plate" v={provider.plate} mono />
            <KeyVal k="Price per service" v={fmtIdr(provider.price_per_service_idr)} />
            <KeyValRow k="Availability" v={
              <span style={{
                fontSize: 10, fontWeight: 800, letterSpacing: 0.6, padding: "2px 8px",
                borderRadius: 999,
                background: provider.is_available ? "rgba(34,197,94,0.14)" : "rgba(148,163,184,0.14)",
                color: provider.is_available ? "rgba(134,239,172,0.95)" : "rgba(203,213,225,0.85)",
                border: `1px solid ${provider.is_available ? "rgba(34,197,94,0.4)" : "rgba(148,163,184,0.35)"}`,
              }}>{provider.is_available ? "AVAILABLE" : "OFFLINE"}</span>
            } />
            <KeyVal k="Status" v={provider.status} />
            <KeyValRow k="Rating" v={
              provider.rating_avg != null
                ? <span>★ {Number(provider.rating_avg).toFixed(1)} · {provider.rating_count ?? 0} reviews</span>
                : <span style={{ color: "rgba(148,163,184,0.65)" }}>No ratings yet</span>
            } />
            <KeyVal k="Registered" v={fmtWhen(provider.registered_at)} />
          </Card>
        </>
      )}

      {/* Wallet quick-glance · if there is one */}
      {hasProvider && wallet && (
        <>
          <SectionTitle>Wallet</SectionTitle>
          <Card>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 9, letterSpacing: 1.4, textTransform: "uppercase",
                  color: "rgba(148,163,184,0.85)", fontWeight: 700 }}>
                  Balance
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.4,
                  color: "rgba(245,245,245,0.97)", fontVariantNumeric: "tabular-nums", marginTop: 3 }}>
                  {fmtIdr(wallet.balance_idr)}
                </div>
              </div>
              {allowance && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9, letterSpacing: 1.4, textTransform: "uppercase",
                    color: "rgba(148,163,184,0.85)", fontWeight: 700 }}>
                    Free this month
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 3,
                    color: allowance.remaining_this_month > 0
                      ? "rgba(134,239,172,0.98)"
                      : "rgba(252,165,165,0.95)" }}>
                    {allowance.remaining_this_month} / {allowance.allowance}
                  </div>
                </div>
              )}
            </div>
            <div style={{ fontSize: 10, color: "rgba(148,163,184,0.75)", marginTop: 8, lineHeight: 1.5 }}>
              Top up or see history in <b style={{ color: "rgba(245,245,245,0.85)" }}>Wallet → Balance</b>.
            </div>
          </Card>
        </>
      )}

      {/* No provider · gentle CTA */}
      {!loading && !hasProvider && (
        <>
          <SectionTitle>Get started</SectionTitle>
          <Card>
            <div style={{ fontSize: 12, color: "rgba(203,213,225,0.85)", lineHeight: 1.55, marginBottom: 8 }}>
              You&apos;re browsing NEX anonymously via your device. To offer bike / parcel / food-run services, register a provider profile.
            </div>
            <div style={{ fontSize: 11, color: "rgba(148,163,184,0.8)" }}>
              Open <b style={{ color: "rgba(245,245,245,0.85)" }}>Me → My roles → Become a provider</b>.
            </div>
          </Card>
        </>
      )}

      {loading && (
        <div style={{ marginTop: 12, fontSize: 11, color: "rgba(148,163,184,0.7)", textAlign: "center" }}>
          Loading profile…
        </div>
      )}

      <div style={{ fontSize: 9, color: "rgba(148,163,184,0.5)", textAlign: "center", marginTop: 16 }}>
        Anonymous device identity · never released outside NEX
      </div>
    </div>
  );
}

// ─── Bits ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 9, letterSpacing: 1.4, textTransform: "uppercase",
      color: "rgba(148,163,184,0.75)", fontWeight: 800,
      marginTop: 16, marginBottom: 6,
    }}>{children}</div>
  );
}
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: "12px 14px", borderRadius: 12,
      background: "rgba(15,20,30,0.6)", border: "1px solid rgba(255,255,255,0.06)",
      display: "flex", flexDirection: "column", gap: 6,
    }}>{children}</div>
  );
}
function KeyVal({ k, v, mono }: { k: string; v: string | number | null; mono?: boolean }) {
  return (
    <KeyValRow k={k} v={
      <span style={{
        fontSize: 12, color: v == null ? "rgba(148,163,184,0.6)" : "rgba(245,245,245,0.9)",
        fontFamily: mono ? "monospace" : "inherit",
        fontVariantNumeric: mono ? "tabular-nums" : "normal",
      }}>{v == null || v === "" ? "—" : String(v)}</span>
    } />
  );
}
function KeyValRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <span style={{ fontSize: 11, color: "rgba(148,163,184,0.75)", letterSpacing: 0.2 }}>{k}</span>
      <span style={{ textAlign: "right", flexShrink: 0 }}>{v}</span>
    </div>
  );
}
function RoleChip({ label, active, tone }: { label: string; active: boolean; tone: "user" | "provider" | "business" | "creator" }) {
  const activePalette = {
    user:     { bg: "rgba(249,115,22,0.16)", fg: "rgba(254,215,170,0.98)", border: "rgba(249,115,22,0.4)" },
    provider: { bg: "rgba(59,130,246,0.16)", fg: "rgba(147,197,253,0.95)", border: "rgba(59,130,246,0.4)" },
    business: { bg: "rgba(168,85,247,0.16)", fg: "rgba(216,180,254,0.95)", border: "rgba(168,85,247,0.4)" },
    creator:  { bg: "rgba(236,72,153,0.16)", fg: "rgba(249,168,212,0.95)", border: "rgba(236,72,153,0.4)" },
  }[tone];
  const palette = active
    ? activePalette
    : { bg: "rgba(255,255,255,0.03)", fg: "rgba(148,163,184,0.65)", border: "rgba(255,255,255,0.08)" };
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, letterSpacing: 0.6, padding: "3px 9px",
      borderRadius: 999,
      background: palette.bg, color: palette.fg,
      border: `1px solid ${palette.border}`,
      opacity: active ? 1 : 0.7,
    }}>{label}{!active && " ○"}</span>
  );
}
