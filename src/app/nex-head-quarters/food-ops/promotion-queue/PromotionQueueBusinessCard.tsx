"use client";

// Task #88 Phase 3 · Promotion queue business card (2026-08-22)
//
// One card per discovered business. Renders evidence rows with per-row
// Approve / Replace / Reject buttons + business-level Promote-to-Directory
// button. All actions POST to server routes:
//   · /api/nex-food/admin/promotion/decide        · per-evidence adjudication
//   · /api/nex-food/admin/promote-to-directory    · business-level flip to listed (existing primitive Philip asked to consolidate)
//
// Every action triggers router.refresh() so counters update immediately
// (Philip's proof metric: 806/1,217 → 807/1,218 the moment admin approves).
//
// Aggregator warning (linktr.ee etc.) surfaced per evidence row via
// checkAggregator() — the "Why am I seeing this?" panel Philip requested.
//
// No Approve All button (Philip explicit · human workflow first).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { checkAggregator } from "@/lib/nex-food/evidence-aggregator-check";

export type EvidenceQueueRow = {
  evidenceId:   string;
  fieldName:    string;
  value:        string | null;
  source:       string;
  sourceType:   string;
  sourceUrl:    string | null;
  confidence:   number;
  agentName:    string;
  discoveredAt: string;
};

export type BusinessQueueRow = {
  businessRef:  string;
  businessName: string;
  category:     string | null;
  city:         string | null;
  district:     string | null;
  claimStatus:  string;
  ownerStatus:  string;
  qualityScore: number | null;
  promotionState: string | null;
  currentValues: {
    whatsapp_number:     string | null;
    phone:               string | null;
    website:             string | null;
    public_social_links: Record<string, string>;
  };
  evidence:              EvidenceQueueRow[];
  pendingEvidenceCount:  number;
};

export function PromotionQueueBusinessCard({ business }: { business: BusinessQueueRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null); // evidenceId or 'promote' or 'business:approve'
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function decide(evidenceId: string, decision: "approve" | "reject" | "replace", reason?: string) {
    setBusy(evidenceId);
    setError(null); setSuccess(null);
    try {
      const r = await fetch("/api/nex-food/admin/promotion/decide", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({ evidenceId, decision, reason }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setError(j.error ?? `HTTP ${r.status}`);
      } else {
        setSuccess(`${decision.toUpperCase()}: ${j.field} = ${j.promotedValue ?? "(rejected)"}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function promoteBusiness() {
    setBusy("promote");
    setError(null); setSuccess(null);
    try {
      const r = await fetch("/api/nex-food/admin/promote-to-directory", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({
          publicListingRef: business.businessRef,
          actor:            "admin:promotion-queue",
          notes:            "Promoted via /nex-head-quarters/food-ops/promotion-queue",
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) setError(j.error ?? `HTTP ${r.status}`);
      else {
        setSuccess(`PROMOTED: ${business.businessRef} → ${j.newClaimStatus}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={cardStyle}>
      {/* ── Business header ── */}
      <div style={cardHeaderStyle}>
        <div>
          <div style={businessNameStyle}>{business.businessName || "(no name)"}</div>
          <div style={businessMetaStyle}>
            <span style={monoStyle}>{business.businessRef}</span>
            <span style={dotStyle}>·</span>
            <span>{business.category ?? "no category"}</span>
            {business.district && <><span style={dotStyle}>·</span><span>{business.district}</span></>}
            <span style={dotStyle}>·</span>
            <span style={{ color: business.qualityScore != null && business.qualityScore >= 70 ? "#047857" : "#a16207" }}>
              score {business.qualityScore ?? "—"}/100 · {stateLabel(business.promotionState)}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={statusPillStyle(business.claimStatus)}>{business.claimStatus.toUpperCase()}</span>
          <button
            type="button"
            onClick={promoteBusiness}
            disabled={busy !== null || business.claimStatus !== "discovered"}
            style={{
              ...promoteButtonStyle,
              opacity: (busy !== null || business.claimStatus !== "discovered") ? 0.5 : 1,
              cursor:  (busy !== null || business.claimStatus !== "discovered") ? "not-allowed" : "pointer",
            }}
            title={business.claimStatus === "discovered" ? "Flip claim_status to 'listed' · row becomes visible on /food" : "Already promoted"}
          >
            🏪 Promote to Directory
          </button>
        </div>
      </div>

      {/* ── Current known values (context so admin sees what's already there) ── */}
      <div style={currentValuesStyle}>
        <span style={currentLabelStyle}>Current food_business values:</span>
        <span>{business.currentValues.website          ? `website=${trim(business.currentValues.website, 40)}` : "website=∅"}</span>
        <span>{business.currentValues.phone            ? `phone=${business.currentValues.phone}`                : "phone=∅"}</span>
        <span>{business.currentValues.whatsapp_number  ? `whatsapp=${business.currentValues.whatsapp_number}`   : "whatsapp=∅"}</span>
        {Object.entries(business.currentValues.public_social_links).map(([k, v]) => (
          <span key={k}>{`social:${k}=${trim(v, 30)}`}</span>
        ))}
      </div>

      {/* ── Evidence rows ── */}
      {business.evidence.length === 0 ? (
        <div style={noEvidenceStyle}>
          No pending evidence for this business · you can still <em>Promote to Directory</em> based on Walker's OSM baseline
          (name · coord · category) if you trust the discovery alone. Enrichment will continue to run in future cycles.
        </div>
      ) : (
        <table style={evidenceTableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Field</th>
              <th style={thStyle}>Proposed value</th>
              <th style={thStyle}>Source</th>
              <th style={thStyle}>Confidence</th>
              <th style={thStyle}>When</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {business.evidence.map((e) => {
              const flag = checkAggregator(e.fieldName, e.value);
              const existing = readCurrent(business.currentValues, e.fieldName);
              return (
                <tr key={e.evidenceId} style={{ background: flag.detected ? "rgba(245,158,11,0.06)" : undefined }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 700 }}>{e.fieldName}</div>
                    {existing && <div style={{ fontSize: 10, color: "var(--nex-neutral-500)", marginTop: 2 }}>currently: <code>{trim(existing, 30)}</code></div>}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>
                    <div>{e.value ?? "—"}</div>
                    {flag.detected && (
                      <div style={aggregatorWarningStyle} title={flag.suggestion ?? undefined}>
                        ⚠️ {flag.reason}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <div>{e.source}</div>
                    <div style={{ fontSize: 10, color: "var(--nex-neutral-500)" }}>{e.sourceType} · agent:{e.agentName}</div>
                    {e.sourceUrl && (
                      <a href={e.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#c2410c", textDecoration: "underline" }}>
                        {trim(e.sourceUrl, 40)}
                      </a>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    <span style={confidenceBadge(e.confidence)}>{(e.confidence * 100).toFixed(0)}%</span>
                  </td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 10 }}>
                    {new Date(e.discoveredAt).toLocaleString("en-GB", { hour12: false })}
                  </td>
                  <td style={{ ...tdStyle }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => decide(e.evidenceId, existing ? "replace" : "approve", flag.detected ? "admin approved despite aggregator warning" : undefined)}
                        disabled={busy !== null}
                        style={{ ...actionButton, background: existing ? "#0369a1" : "#047857" }}
                        title={existing ? `Replace existing '${trim(existing, 20)}'` : "Adopt this value into food_business"}
                      >
                        {existing ? "🔄 Replace" : "✓ Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => decide(e.evidenceId, "reject", flag.detected ? flag.reason ?? "rejected" : "admin rejected")}
                        disabled={busy !== null}
                        style={{ ...actionButton, background: "#b91c1c" }}
                        title="Permanent · queue suppresses future evidence with same value"
                      >
                        ✕ Reject
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* ── Inline feedback strip ── */}
      {(error || success) && (
        <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                       color: error ? "#b91c1c" : "#047857",
                       background: error ? "rgba(220,38,38,0.08)" : "rgba(16,185,129,0.08)",
                       border: `1px solid ${error ? "rgba(220,38,38,0.3)" : "rgba(16,185,129,0.3)"}` }}>
          {error ? `⛔ ${error}` : `✓ ${success}`}
        </div>
      )}
    </div>
  );
}

function readCurrent(cv: BusinessQueueRow["currentValues"], fieldName: string): string | null {
  if (fieldName === "whatsapp_number") return cv.whatsapp_number;
  if (fieldName === "phone")           return cv.phone;
  if (fieldName === "website")         return cv.website;
  if (fieldName.startsWith("social:")) {
    const k = fieldName.slice("social:".length);
    return cv.public_social_links[k] ?? null;
  }
  return null;
}

function trim(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function stateLabel(state: string | null): string {
  if (!state) return "unscored";
  if (state === "ready_for_promotion") return "🟢 ready";
  if (state === "needs_enrichment")    return "🟡 needs enrichment";
  if (state === "poor_evidence")       return "🔴 poor evidence";
  return state;
}

// ── Styles ──────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = { background: "var(--nex-neutral-0)", border: "1px solid var(--nex-neutral-200)", borderRadius: 12, padding: "14px 16px" };
const cardHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 };
const businessNameStyle: React.CSSProperties = { fontSize: 15, fontWeight: 800 };
const businessMetaStyle: React.CSSProperties = { fontSize: 11, color: "var(--nex-neutral-500)", marginTop: 3, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 };
const monoStyle: React.CSSProperties = { fontFamily: "monospace", color: "var(--nex-neutral-700)" };
const dotStyle: React.CSSProperties = { color: "var(--nex-neutral-300)" };
const currentValuesStyle: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: "var(--nex-neutral-500)", marginBottom: 10, padding: "6px 10px", background: "var(--nex-neutral-50)", borderRadius: 6, fontFamily: "monospace" };
const currentLabelStyle: React.CSSProperties = { fontWeight: 700, fontFamily: "system-ui" };
const noEvidenceStyle: React.CSSProperties = { fontSize: 12, color: "var(--nex-neutral-500)", padding: "8px 10px", background: "var(--nex-neutral-50)", borderRadius: 6, lineHeight: 1.5 };
const evidenceTableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12 };
const thStyle: React.CSSProperties = { color: "var(--nex-neutral-500)", padding: "6px 6px 6px 0", textAlign: "left", fontSize: 9, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: 700, borderBottom: "1px solid var(--nex-neutral-200)" };
const tdStyle: React.CSSProperties = { color: "var(--nex-neutral-900)", padding: "8px 6px 8px 0", verticalAlign: "top", borderTop: "1px solid var(--nex-neutral-100)" };
const aggregatorWarningStyle: React.CSSProperties = { marginTop: 4, fontSize: 11, color: "#a16207", background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 4, padding: "3px 6px", cursor: "help" };
const actionButton: React.CSSProperties = { padding: "4px 10px", borderRadius: 6, border: "none", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: 0.4 };
const promoteButtonStyle: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "none", background: "#c2410c", color: "#fff", fontSize: 12, fontWeight: 700, letterSpacing: 0.4 };

function statusPillStyle(status: string): React.CSSProperties {
  const map: Record<string, { bg: string; color: string }> = {
    discovered: { bg: "rgba(161,98,7,0.12)",  color: "#a16207" },
    listed:     { bg: "rgba(16,185,129,0.10)", color: "#047857" },
    invited:    { bg: "rgba(2,132,199,0.12)",  color: "#0369a1" },
    claimed:    { bg: "rgba(147,51,234,0.10)", color: "#7e22ce" },
    paying:     { bg: "rgba(220,38,38,0.10)",  color: "#b91c1c" },
  };
  const s = map[status] ?? map.discovered;
  return { background: s.bg, color: s.color, padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 0.6 };
}

function confidenceBadge(c: number): React.CSSProperties {
  const bg = c >= 0.85 ? "rgba(16,185,129,0.12)" : c >= 0.65 ? "rgba(245,158,11,0.12)" : "rgba(220,38,38,0.10)";
  const color = c >= 0.85 ? "#047857" : c >= 0.65 ? "#a16207" : "#b91c1c";
  return { background: bg, color, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 };
}
