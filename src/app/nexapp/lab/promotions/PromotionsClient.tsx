"use client";

// Founder ADR-0304 · Promotions queue UI.
//
// Signing model: this UI has ZERO access to the HMAC secret. Approval
// requires either:
//   1. An admin cookie session (auto-uses `founder_cookie` user_id) AND
//      a running server able to sign server-side (via /sign helper)
//   2. Manual paste of a pre-computed signature (for CI / scripted use)
//
// This screen offers the manual path with a `Signing steps` cheat-sheet
// so the founder can compute the signature offline (bash one-liner) and
// paste it in. Zero secret transmitted over the wire from the browser.

import Link from "next/link";
import { useEffect, useState } from "react";

interface Promotion {
  promotion_id: string;
  brief_id: string;
  room_slug: string;
  target_schema: string;
  proposed_at_iso: string;
  approved_at_iso: string | null;
  approved_by_user_id: string | null;
  signature_hmac_sha256: string | null;
  rows_promoted: number;
  status: "pending" | "succeeded" | "failed" | "rolled_back";
  error_reason: string | null;
}

export function PromotionsClient() {
  const [rows, setRows] = useState<Promotion[]>([]);
  const [statusFilter, setStatusFilter] = useState<Promotion["status"] | "all">("all");
  const [token, setToken] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("nex_lab_promotion_token") ?? "";
  });
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("nex_lab_promotion_token", token);
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const q = statusFilter === "all" ? "" : `?status=${statusFilter}`;
        const r = await fetch(`/api/nex/lab/promotions${q}`, {
          cache: "no-store",
          headers: { "X-Lab-Promotion-Token": token },
        });
        if (!r.ok) {
          if (r.status === 401) throw new Error("unauthorised · paste token to proceed");
          throw new Error(`http_${r.status}`);
        }
        const j = await r.json();
        if (!cancelled) { setRows(j.promotions ?? []); setErr(null); }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "err");
      } finally { if (!cancelled) setTick((n) => n + 1); }
    };
    void load();
    const iv = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [statusFilter, token]);

  return (
    <div style={page}>
      <header style={header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/nexapp/lab" style={{ color: "#94a3b8", textDecoration: "none", fontSize: 12 }}>← Lab</Link>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: err ? "#ef4444" : "#22c55e" }} />
          <div style={{ fontSize: 14, fontWeight: 700 }}>NEX Lab · Promotions Queue</div>
          <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>tick {tick}</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {(["all", "pending", "succeeded", "failed"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: "4px 10px", background: statusFilter === s ? "#052e16" : "#0f1418",
              color: statusFilter === s ? "#4ade80" : "#94a3b8",
              border: "1px solid " + (statusFilter === s ? "#22c55e" : "#1e293b"),
              borderRadius: 4, fontSize: 11, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em",
            }}>{s}</button>
          ))}
        </div>
      </header>
      <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        <TokenPanel token={token} setToken={setToken} />
        {err && <div style={errorBar}>error · {err}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((r) => <PromotionCard key={r.promotion_id} p={r} token={token} onDone={() => setTick((n) => n + 1)} />)}
          {rows.length === 0 && !err && <div style={{ color: "#64748b" }}>no promotions in this filter</div>}
        </div>
      </div>
    </div>
  );
}

function TokenPanel({ token, setToken }: { token: string; setToken: (s: string) => void }) {
  const [showEditor, setShowEditor] = useState(!token);
  const masked = token ? token.slice(0, 4) + "…" + token.slice(-4) : "not set";
  return (
    <div style={{ padding: "10px 14px", background: "#0f1418", border: "1px solid #1e293b", borderRadius: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Lab promotion token · loaded from NEX_LAB_PROMOTION_TOKEN env
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>{masked}</span>
          <button onClick={() => setShowEditor((s) => !s)} style={smallBtn}>{showEditor ? "hide" : "edit"}</button>
        </div>
      </div>
      {showEditor && (
        <div style={{ marginTop: 8 }}>
          <input value={token} onChange={(e) => setToken(e.target.value)}
                 placeholder="paste the NEX_LAB_PROMOTION_TOKEN value"
                 style={{ width: "100%", padding: "6px 8px", background: "#0a0d10", color: "#e2e8f0",
                          border: "1px solid #1e293b", borderRadius: 4, fontFamily: "monospace", fontSize: 12 }} />
        </div>
      )}
    </div>
  );
}

function PromotionCard({ p, token, onDone }: { p: Promotion; token: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [signature, setSignature] = useState("");
  const [approvedIso, setApprovedIso] = useState<string>(() => new Date().toISOString());
  const [rollbackSig, setRollbackSig] = useState("");
  const [rollbackTs, setRollbackTs] = useState<string>(() => new Date().toISOString());
  const [showRollback, setShowRollback] = useState(false);
  const isPending = p.status === "pending";
  const canRollback = p.status === "succeeded";

  async function approve() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/nex/lab/promotions/${p.promotion_id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Lab-Promotion-Token": token },
        body: JSON.stringify({ signature_hmac: signature, approved_at_iso: approvedIso }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `http_${r.status}`);
      setMsg(`✓ promoted · ${j.promotion?.rows_promoted ?? 0} rows`);
      onDone();
    } catch (e) { setMsg(`✗ ${e instanceof Error ? e.message : "err"}`); }
    finally { setBusy(false); }
  }

  async function rollback() {
    if (!confirm(`Rollback promotion ${p.brief_id}? This runs saved rollback_sql · reversible only by re-promoting.`)) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/nex/lab/promotions/${p.promotion_id}/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Lab-Promotion-Token": token },
        body: JSON.stringify({ signature_hmac: rollbackSig, rolled_back_at_iso: rollbackTs }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `http_${r.status}`);
      setMsg(`✓ rolled back · ${j.result?.rows_removed ?? 0} rows removed`);
      onDone();
    } catch (e) { setMsg(`✗ ${e instanceof Error ? e.message : "err"}`); }
    finally { setBusy(false); }
  }

  const tone = p.status === "succeeded" ? "#4ade80"
             : p.status === "failed"    ? "#f87171"
             : p.status === "pending"   ? "#fbbf24"
             : "#94a3b8";

  const signHint =
    `# Bash one-liner to compute signature (never send secret to browser):\n` +
    `TS='${approvedIso}'\n` +
    `SECRET=$NEX_LAB_PROMOTION_SECRET   # from .env.local\n` +
    `PAYLOAD="${p.brief_id}|${p.room_slug}|$TS|token_holder"\n` +
    `SIG=$(printf %s "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')\n` +
    `echo $SIG`;

  return (
    <div style={{ padding: "12px 14px", background: "#0f1418", border: "1px solid #1e293b", borderRadius: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4 }}>
            <span style={{ padding: "1px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                           background: p.status === "succeeded" ? "#052e16" : p.status === "failed" ? "#450a0a" : p.status === "pending" ? "#422006" : "#0f172a",
                           color: tone, textTransform: "uppercase", letterSpacing: "0.06em" }}>{p.status}</span>
            <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>{p.brief_id}</div>
            <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>→ {p.target_schema}</div>
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
            <span>room <span style={{ color: "#e2e8f0" }}>{p.room_slug}</span></span>
            <span>proposed <span style={{ color: "#e2e8f0" }}>{new Date(p.proposed_at_iso).toLocaleString()}</span></span>
            {p.rows_promoted > 0 && <span>rows <span style={{ color: "#4ade80" }}>{p.rows_promoted}</span></span>}
            {p.approved_by_user_id && <span>by <span style={{ color: "#e2e8f0" }}>{p.approved_by_user_id}</span></span>}
          </div>
          {p.error_reason && (
            <div style={{ marginTop: 6, fontSize: 11, color: "#f87171" }}>error · {p.error_reason}</div>
          )}
          {p.signature_hmac_sha256 && (
            <div style={{ marginTop: 6, fontSize: 10, color: "#475569", fontFamily: "monospace" }}>
              sig {p.signature_hmac_sha256.slice(0, 32)}…
            </div>
          )}
        </div>
        <div style={{ minWidth: 200, textAlign: "right" }}>
          <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>{p.promotion_id.slice(0, 8)}</div>
        </div>
      </div>
      {canRollback && (
        <div style={{ marginTop: 10 }}>
          <button onClick={() => setShowRollback((s) => !s)} style={{
            padding: "4px 12px", background: showRollback ? "#450a0a" : "#0f1418",
            color: showRollback ? "#f87171" : "#94a3b8",
            border: "1px solid " + (showRollback ? "#7f1d1d" : "#1e293b"),
            borderRadius: 4, fontSize: 11, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            {showRollback ? "hide rollback" : "↩ rollback this promotion"}
          </button>
          {showRollback && (
            <div style={{ marginTop: 8, padding: 10, background: "#0a0d10", borderRadius: 6, border: "1px solid #7f1d1d" }}>
              <div style={{ fontSize: 11, color: "#f87171", marginBottom: 6 }}>
                ⚠ Rollback removes {p.rows_promoted} rows from production. Requires HMAC signature over payload:
              </div>
              <pre style={{ fontSize: 10, fontFamily: "monospace", color: "#4ade80", background: "#080b0d", padding: 8, borderRadius: 4, whiteSpace: "pre-wrap", overflow: "auto" }}>{
`# Bash one-liner for rollback signature:
TS='${rollbackTs}'
SECRET=$NEX_LAB_PROMOTION_SECRET
PAYLOAD="${p.brief_id}|${p.room_slug}|ROLLBACK|$TS|token_holder"
SIG=$(printf %s "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')
echo $SIG`}</pre>
              <div style={{ display: "flex", gap: 8, marginBottom: 6, marginTop: 6 }}>
                <input value={rollbackTs} onChange={(e) => setRollbackTs(e.target.value)}
                       style={{ flex: "0 0 220px", padding: "5px 8px", background: "#080b0d", color: "#e2e8f0",
                                border: "1px solid #1e293b", borderRadius: 4, fontFamily: "monospace", fontSize: 11 }} />
                <button onClick={() => setRollbackTs(new Date().toISOString())} style={smallBtn}>now</button>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={rollbackSig} onChange={(e) => setRollbackSig(e.target.value)}
                       placeholder="64-char hex rollback signature"
                       style={{ flex: 1, padding: "5px 8px", background: "#080b0d", color: "#e2e8f0",
                                border: "1px solid #1e293b", borderRadius: 4, fontFamily: "monospace", fontSize: 11 }} />
                <button onClick={rollback} disabled={busy || rollbackSig.length < 32}
                        style={{ padding: "5px 14px", background: rollbackSig.length >= 32 ? "#dc2626" : "#1e293b",
                                 color: rollbackSig.length >= 32 ? "#fff" : "#64748b", border: "none",
                                 borderRadius: 4, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>
                  {busy ? "..." : "ROLLBACK"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {isPending && (
        <div style={{ marginTop: 10, padding: 10, background: "#0a0d10", borderRadius: 6, border: "1px solid #1e293b" }}>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>Approve · paste HMAC-SHA256 signature</div>
          <details style={{ marginBottom: 8 }}>
            <summary style={{ fontSize: 11, color: "#64748b", cursor: "pointer" }}>show sign command</summary>
            <pre style={{ marginTop: 6, fontSize: 10, fontFamily: "monospace", color: "#4ade80", background: "#080b0d", padding: 8, borderRadius: 4, overflow: "auto", whiteSpace: "pre-wrap" }}>{signHint}</pre>
          </details>
          <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            <input value={approvedIso} onChange={(e) => setApprovedIso(e.target.value)}
                   style={{ flex: "0 0 220px", padding: "5px 8px", background: "#080b0d", color: "#e2e8f0",
                            border: "1px solid #1e293b", borderRadius: 4, fontFamily: "monospace", fontSize: 11 }} />
            <button onClick={() => setApprovedIso(new Date().toISOString())} style={smallBtn}>now</button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={signature} onChange={(e) => setSignature(e.target.value)}
                   placeholder="64-char hex signature"
                   style={{ flex: 1, padding: "5px 8px", background: "#080b0d", color: "#e2e8f0",
                            border: "1px solid #1e293b", borderRadius: 4, fontFamily: "monospace", fontSize: 11 }} />
            <button onClick={approve} disabled={busy || signature.length < 32}
                    style={{ padding: "5px 14px", background: signature.length >= 32 ? "#22c55e" : "#1e293b",
                             color: signature.length >= 32 ? "#0a0d10" : "#64748b", border: "none",
                             borderRadius: 4, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>
              {busy ? "..." : "APPROVE"}
            </button>
          </div>
          {msg && <div style={{ marginTop: 8, fontSize: 12, color: msg.startsWith("✓") ? "#4ade80" : "#f87171" }}>{msg}</div>}
        </div>
      )}
    </div>
  );
}

const page: React.CSSProperties = { minHeight: "100vh", background: "#0a0d10", color: "#e2e8f0", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" };
const header: React.CSSProperties = { padding: "10px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e293b", background: "#080b0d", position: "sticky", top: 0, zIndex: 10 };
const errorBar: React.CSSProperties = { padding: "8px 12px", background: "#450a0a", color: "#f87171", borderRadius: 6, fontSize: 12 };
const smallBtn: React.CSSProperties = { padding: "3px 8px", background: "#0a0d10", color: "#94a3b8", border: "1px solid #1e293b", borderRadius: 4, fontSize: 10, cursor: "pointer" };
