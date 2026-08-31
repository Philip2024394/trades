// src/components/nexapp/NexWorkspaceWallet.tsx · Philip 2026-08-29
//
// Wallet workspace · lives INSIDE the /nexapp persistent shell.
// Migrated from /nex-provider-wallet standalone page (Phase 2 · PR-1).
//
// Top-up is wired to Midtrans Snap embedded modal (no redirect out of
// the shell). Client calls /topup/initiate → loads snap.js on demand
// → snap.pay(token) → polls /topup/status until terminal state. Snap
// callbacks are hints only; the webhook is the authoritative credit
// path. server_key never reaches the browser (only client_key + env).
//
// Doctrine anchors:
//   · project_nex_five_button_ia_doctrine_2026_08_29 (rooms → Wallet → Balance)
//   · project_nex_persistent_app_shell_doctrine_2026_08_29 (no standalone page,
//     no redirect out of the shell → Snap embedded modal preferred)

"use client";

import React, { useCallback, useEffect, useState } from "react";

const TOPUP_TIERS = [
  { amount: 20000,  label: "Minimum" },
  { amount: 50000,  label: "Standard" },
  { amount: 100000, label: "Plus" },
  { amount: 250000, label: "Pro" },
  { amount: 500000, label: "Large" },
];

function fmtIdr(n: number | null | undefined): string {
  if (n == null) return "—";
  return "Rp " + n.toLocaleString("id-ID");
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

// Midtrans Snap.js loader · single-flight, safe to call from multiple renders.
// The server never ships the server_key — only client_key + env come down.
type SnapPayResult = Record<string, unknown>;
type SnapCallbacks = {
  onSuccess?: (r: SnapPayResult) => void;
  onPending?: (r: SnapPayResult) => void;
  onError?:   (r: SnapPayResult) => void;
  onClose?:   () => void;
};
type SnapWindow = Window & { snap?: { pay: (token: string, cb: SnapCallbacks) => void } };
let snapLoadPromise: Promise<void> | null = null;
function ensureSnapLoaded(env: "sandbox" | "production", clientKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const w = window as SnapWindow;
  if (w.snap?.pay) return Promise.resolve();
  if (snapLoadPromise) return snapLoadPromise;
  const src = env === "production"
    ? "https://app.midtrans.com/snap/snap.js"
    : "https://app.sandbox.midtrans.com/snap/snap.js";
  snapLoadPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src; s.async = true;
    s.setAttribute("data-client-key", clientKey);
    s.setAttribute("data-nex-snap", "1");
    s.onload = () => resolve();
    s.onerror = () => { snapLoadPromise = null; reject(new Error("snap.js load failed")); };
    document.head.appendChild(s);
  });
  return snapLoadPromise;
}

type WalletResponse = {
  ok: boolean;
  profile: { provider_id: string; name: string; price_per_service_idr: number | null; is_available: boolean; status: string } | null;
  wallet: { balance_idr: number; updated_at: string | null } | null;
  monthly_allowance: { allowance: number; used_this_month: number; remaining_this_month: number };
  current_fee_when_applicable_idr: number | null;
  transactions: Array<{
    transaction_id: string;
    kind: "topup"|"network_fee"|"refund"|"adjustment";
    amount_idr: number;
    balance_after_idr: number;
    related_request_id: string | null;
    note: string | null;
    created_at: string;
  }>;
};

const C = {
  ink: "rgba(245,245,245,0.94)", inkSoft: "rgba(203,213,225,0.85)", inkMuted: "rgba(148,163,184,0.75)",
  border: "rgba(255,255,255,0.08)",
  cardBg: "rgba(10,10,12,0.86)", cardBorder: "rgba(148,163,184,0.22)",
  accent: "#f97316", ok: "rgba(134,239,172,0.95)", warn: "rgba(252,165,165,0.95)",
};

export function NexWorkspaceWallet() {
  const [learner, setLearner] = useState("");
  const [data, setData] = useState<WalletResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busyAmount, setBusyAmount] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async (ref: string) => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/nex/provider/wallet?learner_ref=${encodeURIComponent(ref)}`);
      const d = await resp.json();
      setData(d);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const id = ensureDeviceId();
    setLearner(id);
    load(id);
  }, [load]);

  const topUp = useCallback(async (amount: number) => {
    setBusyAmount(amount); setMsg(null);
    try {
      // 1) Ask server to create a Midtrans Snap transaction. Server persists
      //    the intent, calls Snap with server_key, returns the snap_token
      //    plus the public client_key + env so the client can load snap.js.
      const initResp = await fetch(`/api/nex/provider/wallet/topup/initiate`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ learner_ref: learner, amount_idr: amount }),
      });
      const init = await initResp.json();
      if (!initResp.ok || !init.ok) {
        setMsg(init.hint ?? init.error ?? "top-up failed to initiate");
        return;
      }
      const { intent_id, snap_token, client_key, env } = init as {
        intent_id: string; snap_token: string; client_key: string; env: "sandbox" | "production";
      };

      // 2) Load snap.js on demand, then open the embedded modal.
      try { await ensureSnapLoaded(env, client_key); }
      catch { setMsg("Payment window failed to load. Check your connection and try again."); return; }
      const snap = (window as SnapWindow).snap;
      if (!snap?.pay) { setMsg("Payment window unavailable."); return; }

      const outcome = await new Promise<"success" | "pending" | "error" | "closed">((resolve) => {
        snap.pay(snap_token, {
          onSuccess: () => resolve("success"),
          onPending: () => resolve("pending"),
          onError:   () => resolve("error"),
          onClose:   () => resolve("closed"),
        });
      });

      // 3) Poll server for authoritative state. Snap callbacks are hints;
      //    the webhook is what actually credits the wallet.
      let authoritative: {
        state: "pending" | "credited" | "failed" | "expired";
        wallet_balance_idr: number;
      } | null = null;
      const statusUrl = `/api/nex/provider/wallet/topup/status?learner_ref=${encodeURIComponent(learner)}&intent_id=${intent_id}`;
      const terminal = new Set(["credited", "failed", "expired"]);
      for (let i = 0; i < 8; i++) {
        const r = await fetch(statusUrl);
        const d = await r.json();
        if (d.ok) {
          authoritative = d;
          if (terminal.has(d.state)) break;
        }
        await new Promise((res) => setTimeout(res, 2000));
      }

      // 4) Message the user based on authoritative state, not Snap's hint.
      if (authoritative?.state === "credited") {
        setMsg(`Top-up ${fmtIdr(amount)} · new balance ${fmtIdr(authoritative.wallet_balance_idr)}`);
        setPickerOpen(false);
      } else if (authoritative?.state === "pending") {
        setMsg(`Top-up ${fmtIdr(amount)} is pending confirmation. Your balance will update when the payment settles.`);
        setPickerOpen(false);
      } else if (authoritative?.state === "failed" || authoritative?.state === "expired") {
        setMsg(`Top-up did not complete (${authoritative.state}). No charge was made.`);
      } else if (outcome === "closed") {
        setMsg("Payment window closed. No charge was made.");
      } else {
        setMsg("Could not confirm payment status. Check the wallet in a moment.");
        setPickerOpen(false);
      }
      await load(learner);
    } finally { setBusyAmount(null); }
  }, [learner, load]);

  return (
    <div style={{
      color: C.ink,
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      padding: "12px 14px 24px",
      height: "100%", overflowY: "auto",
    }}>
      <div style={{
        fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase",
        color: C.accent, fontWeight: 800, marginBottom: 4,
      }}>NEX Wallet</div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>
        {data?.profile?.name ? `Hello, ${data.profile.name}` : "Your NEX wallet"}
      </h1>

      {loading && <div style={{ color: C.inkMuted, marginTop: 20, fontSize: 12 }}>Loading…</div>}

      {!loading && !data?.profile && (
        <div style={{
          marginTop: 18, padding: "14px 16px",
          background: "rgba(220,38,38,0.14)", border: "1px solid rgba(220,38,38,0.35)",
          borderRadius: 12, color: C.warn, fontSize: 12, lineHeight: 1.5,
        }}>
          No provider profile on this device.<br/>
          Go to <b>Me → My roles → Become a provider</b> first.
        </div>
      )}

      {!loading && data?.profile && (() => {
        const balance = data.wallet?.balance_idr ?? 0;
        const feeWhenApplicable = data.current_fee_when_applicable_idr;
        const allowanceLeft = data.monthly_allowance.remaining_this_month;
        const walletUnderfunded =
          allowanceLeft === 0 &&
          feeWhenApplicable != null &&
          balance < feeWhenApplicable;
        return (
        <>
          {/* Low-wallet warning · shown when allowance = 0 AND balance < fee */}
          {walletUnderfunded && (
            <button onClick={() => setPickerOpen(true)}
              style={{
                marginTop: 14, padding: "12px 14px", width: "100%",
                background: "rgba(120,53,15,0.32)", border: "1px solid rgba(252,211,77,0.45)",
                borderRadius: 12, textAlign: "left",
                cursor: "pointer", fontFamily: "inherit",
              }}>
              <div style={{
                fontSize: 9, letterSpacing: 1.4, textTransform: "uppercase",
                color: "rgba(252,211,77,0.98)", fontWeight: 800, marginBottom: 4,
              }}>
                Top up to keep receiving requests
              </div>
              <div style={{ fontSize: 12, color: "rgba(253,224,71,0.95)", lineHeight: 1.45 }}>
                Free requests used · wallet cannot cover the {fmtIdr(feeWhenApplicable)} fee.
                New requests will pause.
              </div>
            </button>
          )}

          {/* Balance · black frosted card */}
          <div style={{
            marginTop: 16, padding: "16px 18px",
            background: C.cardBg, backdropFilter: "blur(28px)",
            border: `1px solid ${C.cardBorder}`, borderRadius: 16,
          }}>
            <div style={{ fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase",
              color: "rgba(249,115,22,0.9)", fontWeight: 800 }}>Balance</div>
            <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4, letterSpacing: -0.5,
              fontVariantNumeric: "tabular-nums", color: C.ink }}>
              {fmtIdr(data.wallet?.balance_idr ?? 0)}
            </div>
            <button onClick={() => setPickerOpen(true)}
              style={{
                marginTop: 12, width: "100%", minHeight: 40,
                background: C.accent, color: "#fff", border: "none",
                borderRadius: 10, fontWeight: 700, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase",
                cursor: "pointer",
              }}>Top up wallet</button>
          </div>

          {/* Monthly allowance */}
          <div style={{
            marginTop: 12, padding: "14px 16px",
            background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 12,
          }}>
            <div style={{ fontSize: 9, letterSpacing: 1.4, textTransform: "uppercase",
              color: C.inkMuted, fontWeight: 800 }}>
              This month · NEX network fee
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: C.ink, lineHeight: 1.4 }}>
              <span style={{ fontWeight: 800, color: C.ok }}>
                {data.monthly_allowance.remaining_this_month} of {data.monthly_allowance.allowance}
              </span>
              {" "}NEX service requests remaining · no network fee.
            </div>
            <div style={{ marginTop: 3, fontSize: 11, color: C.inkMuted }}>
              After that: 8% per completed request
              {data.current_fee_when_applicable_idr != null && (
                <> · currently {fmtIdr(data.current_fee_when_applicable_idr)} on your Rp {data.profile.price_per_service_idr?.toLocaleString("id-ID")} price</>
              )}
            </div>
          </div>

          {/* Recent transactions */}
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase",
              color: C.inkMuted, fontWeight: 800, marginBottom: 6 }}>
              Recent wallet activity
            </div>
            {data.transactions.length === 0 && (
              <div style={{
                padding: "14px 16px", background: "rgba(255,255,255,0.04)",
                border: `1px solid ${C.border}`, borderRadius: 12,
                fontSize: 12, color: C.inkMuted, textAlign: "center",
              }}>
                No transactions yet.
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.transactions.map((t) => {
                const positive = t.amount_idr > 0;
                return (
                  <div key={t.transaction_id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                    padding: "10px 12px",
                    background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 10,
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, letterSpacing: 0.3, textTransform: "capitalize" }}>
                        {t.kind === "network_fee" ? "NEX network fee" : t.kind}
                      </div>
                      <div style={{ fontSize: 10, color: C.inkMuted, marginTop: 2 }}>
                        {new Date(t.created_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {t.note && ` · ${t.note}`}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 800,
                        color: positive ? C.ok : C.warn, fontVariantNumeric: "tabular-nums" }}>
                        {positive ? "+" : ""}{fmtIdr(t.amount_idr)}
                      </div>
                      <div style={{ fontSize: 10, color: C.inkMuted, fontVariantNumeric: "tabular-nums" }}>
                        bal {fmtIdr(t.balance_after_idr)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top-up sheet */}
          {pickerOpen && (
            <div onClick={() => setPickerOpen(false)}
              style={{
                position: "fixed", inset: 0, background: "rgba(10,14,24,0.72)",
                display: "flex", alignItems: "flex-end", justifyContent: "center",
                zIndex: 100,
              }}>
              <div onClick={(e) => e.stopPropagation()}
                style={{
                  width: "100%", maxWidth: 420,
                  background: "#0a0e18", borderRadius: "20px 20px 0 0",
                  padding: "22px 20px 26px", color: C.ink,
                  border: "1px solid rgba(148,163,184,0.22)", borderBottom: "none",
                  animation: "nex-topup-in 260ms ease-out",
                }}>
                <style>{`@keyframes nex-topup-in { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
                <div style={{ width: 40, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 999, margin: "0 auto 16px" }} />
                <div style={{ fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase",
                  color: C.inkMuted, fontWeight: 800, marginBottom: 4 }}>
                  Top up NEX wallet
                </div>
                <div style={{ fontSize: 11, color: C.inkMuted, marginBottom: 14 }}>
                  Minimum {fmtIdr(20000)} · payment via Midtrans · balance credited by NEX server after settlement.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {TOPUP_TIERS.map((t) => (
                    <button key={t.amount} onClick={() => topUp(t.amount)} disabled={busyAmount !== null}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "12px 14px", minHeight: 48,
                        background: busyAmount === t.amount ? "rgba(249,115,22,0.28)" : "rgba(255,255,255,0.05)",
                        border: `1px solid ${busyAmount === t.amount ? "rgba(249,115,22,0.55)" : "rgba(255,255,255,0.12)"}`,
                        borderRadius: 10, cursor: "pointer", fontSize: 14, fontFamily: "inherit",
                      }}>
                      <span style={{ fontWeight: 800, color: C.ink, fontVariantNumeric: "tabular-nums" }}>{fmtIdr(t.amount)}</span>
                      <span style={{ fontSize: 11, color: C.inkMuted, fontWeight: 600 }}>{t.label}</span>
                    </button>
                  ))}
                </div>
                <button onClick={() => setPickerOpen(false)}
                  style={{ marginTop: 12, width: "100%", minHeight: 40, background: "none", border: "none",
                    color: C.inkMuted, fontSize: 13, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {msg && (
            <div style={{
              marginTop: 12, padding: "8px 10px", borderRadius: 10,
              background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.35)",
              color: C.ok, fontSize: 11,
            }}>{msg}</div>
          )}

          {/* Quiet doctrine line */}
          <div style={{ marginTop: 22, fontSize: 9, color: C.inkMuted, textAlign: "center", opacity: 0.75, lineHeight: 1.55 }}>
            NEX is the software network. You set your own price.<br/>
            Customer is charged the price shown to them · never the NEX fee.
          </div>
        </>
        );
      })()}
    </div>
  );
}
