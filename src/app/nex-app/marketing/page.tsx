// src/app/nex-app/marketing/page.tsx
//
// NEX Managed Email Marketing · Stage 4 · Member landing page
// Founder-authorised programme (three-lane operating doctrine · ADR-0003a).
//
// Canonical NEX visual language · mobile-first · 48px+ touch targets.
// Reads real member packages/campaigns via /api/nex/member/marketing/*.
// Never renders contact addresses.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Capacity = {
  purchased: number;
  reserved: number;
  consumed: number;
  remaining: number;
  is_consumable: boolean;
};

type PackageSummary = {
  package_id: string;
  package_type: string;
  display_name: string | null;
  status: string;
  capacity: Capacity;
  expires_at: string | null;
  activated_at: string | null;
};

type CampaignSummary = {
  campaign_id: string;
  display_name: string;
  status: string;
  target_count: number;
  send_count: number;
  fail_count: number;
  opened_count: number;
  clicked_count: number;
  bounced_count: number;
  created_at: string;
};

export default function MemberMarketingLanding() {
  const [packages, setPackages] = useState<PackageSummary[] | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pkgRes, campRes] = await Promise.all([
          fetch("/api/nex/member/marketing/packages", { cache: "no-store" }),
          fetch("/api/nex/member/marketing/campaigns", { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (pkgRes.status === 401 || campRes.status === 401) {
          setError("not_authenticated");
          setLoading(false);
          return;
        }
        const pkgJson = await pkgRes.json();
        const campJson = await campRes.json();
        setPackages(pkgJson.packages ?? []);
        setCampaigns(campJson.campaigns ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="nex-app-root" style={{
      minHeight: "100vh",
      background: "var(--nex-cream, #FBF5E9)",
      color: "var(--nex-neutral-900, #1a1a1a)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      padding: "24px 16px",
    }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <header style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 10,
            letterSpacing: "0.18em",
            color: "var(--nex-accent-600, #EA580C)",
            fontWeight: 700,
          }}>
            NEX · MARKETING
          </div>
          <h1 style={{
            fontSize: 24,
            fontWeight: 800,
            margin: "4px 0 0",
            color: "var(--nex-neutral-900, #1a1a1a)",
            letterSpacing: "-0.01em",
          }}>
            Managed email campaigns
          </h1>
          <p style={{
            fontSize: 14,
            color: "var(--nex-neutral-600, #666)",
            margin: "8px 0 0",
            lineHeight: 1.5,
          }}>
            Buy managed sending capacity · authorise your sender identities · pick country + category · NEX operates the campaign on your behalf. Contact addresses stay with NEX.
          </p>
        </header>

        {loading && <div style={loadingStyle}>Loading your marketing…</div>}
        {error === "not_authenticated" && (
          <div style={emptyCardStyle}>
            <div style={emptyTitleStyle}>Sign in required</div>
            <div style={emptyBodyStyle}>You need to be signed in as a member to view marketing.</div>
          </div>
        )}
        {error && error !== "not_authenticated" && (
          <div style={errorCardStyle}>
            <div style={emptyTitleStyle}>Something went wrong</div>
            <div style={emptyBodyStyle}>{error}</div>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* ─── Packages ─── */}
            <section style={sectionStyle}>
              <h2 style={sectionHeadingStyle}>Your packages</h2>
              {packages && packages.length === 0 && (
                <div style={emptyCardStyle}>
                  <div style={emptyTitleStyle}>No packages yet</div>
                  <div style={emptyBodyStyle}>
                    A package is <strong>managed campaign capacity</strong>, not a contact list. When you buy a package, NEX runs the campaign on your behalf.
                  </div>
                </div>
              )}
              {packages?.map(pkg => (
                <div key={pkg.package_id} style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div>
                      <div style={cardTitleStyle}>{pkg.display_name ?? pkg.package_type}</div>
                      <div style={{ fontSize: 12, color: "var(--nex-neutral-500, #888)", marginTop: 2 }}>
                        {pkg.package_type} · <StatusChip status={pkg.status} />
                      </div>
                    </div>
                    <div style={capacityBadgeStyle(pkg.capacity.is_consumable)}>
                      {pkg.capacity.remaining} / {pkg.capacity.purchased}
                    </div>
                  </div>
                  <div style={progressWrapStyle}>
                    <div style={progressTrackStyle}>
                      <div style={{
                        ...progressBarStyle,
                        width: `${(pkg.capacity.consumed / Math.max(1, pkg.capacity.purchased)) * 100}%`,
                        background: "var(--nex-accent-500, #F97316)",
                      }} />
                      <div style={{
                        ...progressBarStyle,
                        width: `${(pkg.capacity.reserved / Math.max(1, pkg.capacity.purchased)) * 100}%`,
                        background: "var(--nex-accent-200, #FED7AA)",
                        left: `${(pkg.capacity.consumed / Math.max(1, pkg.capacity.purchased)) * 100}%`,
                      }} />
                    </div>
                    <div style={progressLabelsStyle}>
                      <span>Consumed <strong>{pkg.capacity.consumed}</strong></span>
                      <span>Reserved <strong>{pkg.capacity.reserved}</strong></span>
                      <span>Remaining <strong>{pkg.capacity.remaining}</strong></span>
                    </div>
                  </div>
                </div>
              ))}
            </section>

            {/* ─── Campaigns ─── */}
            <section style={sectionStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h2 style={{ ...sectionHeadingStyle, marginBottom: 0 }}>Your campaigns</h2>
                <Link href="/nex-app/marketing/campaigns/new" style={primaryButtonStyle}>
                  + New campaign
                </Link>
              </div>
              {campaigns && campaigns.length === 0 && (
                <div style={emptyCardStyle}>
                  <div style={emptyTitleStyle}>No campaigns yet</div>
                  <div style={emptyBodyStyle}>
                    Create your first campaign · pick country and category · NEX resolves the eligible audience internally.
                  </div>
                </div>
              )}
              {campaigns?.map(c => (
                <Link href={`/nex-app/marketing/campaigns/${c.campaign_id}`} key={c.campaign_id} style={cardLinkStyle}>
                  <div style={cardStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={cardTitleStyle}>{c.display_name}</div>
                        <div style={{ fontSize: 12, color: "var(--nex-neutral-500, #888)", marginTop: 2 }}>
                          <StatusChip status={c.status} />
                          <span style={{ marginLeft: 8 }}>{new Date(c.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 12 }}>
                      <Stat label="Target" value={c.target_count} />
                      <Stat label="Sent" value={c.send_count} />
                      <Stat label="Observed opens" value={c.opened_count} />
                      <Stat label="Clicks" value={c.clicked_count} />
                    </div>
                  </div>
                </Link>
              ))}
            </section>

            {/* ─── Contact boundary reminder ─── */}
            <div style={reminderStyle}>
              <strong style={{ color: "var(--nex-neutral-900, #1a1a1a)" }}>Contact-list boundary:</strong> NEX runs the campaign on your behalf using your authorised sender. Contact addresses are never sold, exported, or downloaded — you receive campaign analytics only.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────
function StatusChip({ status }: { status: string }) {
  const meta: Record<string, { bg: string; fg: string; label: string }> = {
    available:        { bg: "#F1F5F9", fg: "#334155", label: "Available" },
    active:           { bg: "#DCFCE7", fg: "#166534", label: "Active" },
    paused:           { bg: "#FEF3C7", fg: "#92400E", label: "Paused" },
    exhausted:        { bg: "#FEE2E2", fg: "#991B1B", label: "Exhausted" },
    expired:          { bg: "#E5E7EB", fg: "#4B5563", label: "Expired" },
    cancelled:        { bg: "#E5E7EB", fg: "#4B5563", label: "Cancelled" },
    draft:            { bg: "#F1F5F9", fg: "#334155", label: "Draft" },
    pending_approval: { bg: "#FEF3C7", fg: "#92400E", label: "Review" },
    approved:         { bg: "#DBEAFE", fg: "#1E40AF", label: "Scheduled" },
    sending:          { bg: "#FED7AA", fg: "#9A3412", label: "Sending" },
    sent:             { bg: "#DCFCE7", fg: "#166534", label: "Sent" },
    failed:           { bg: "#FEE2E2", fg: "#991B1B", label: "Failed" },
  };
  const m = meta[status] ?? { bg: "#F1F5F9", fg: "#334155", label: status };
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 999,
      background: m.bg,
      color: m.fg,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.02em",
      textTransform: "uppercase",
    }}>{m.label}</span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--nex-neutral-500, #888)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "var(--nex-neutral-900, #1a1a1a)", marginTop: 2 }}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────
const sectionStyle: React.CSSProperties = { marginBottom: 32 };
const sectionHeadingStyle: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--nex-neutral-500, #888)",
  fontWeight: 700,
  marginBottom: 12,
};
const cardStyle: React.CSSProperties = {
  background: "var(--nex-cream-elev, #FFFFFF)",
  border: "1px solid var(--nex-neutral-200, #E5E7EB)",
  borderRadius: 12,
  padding: 16,
  marginBottom: 12,
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
};
const cardLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  color: "inherit",
  display: "block",
};
const cardTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: "var(--nex-neutral-900, #1a1a1a)",
};
const emptyCardStyle: React.CSSProperties = {
  ...cardStyle,
  textAlign: "center",
  padding: 24,
};
const emptyTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: "var(--nex-neutral-700, #444)",
  marginBottom: 4,
};
const emptyBodyStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--nex-neutral-500, #888)",
  lineHeight: 1.5,
};
const errorCardStyle: React.CSSProperties = {
  ...emptyCardStyle,
  borderColor: "#FCA5A5",
  background: "#FEF2F2",
};
const loadingStyle: React.CSSProperties = {
  ...emptyCardStyle,
  color: "var(--nex-neutral-500, #888)",
};
const primaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "10px 16px",
  minHeight: 44,
  borderRadius: 10,
  background: "var(--nex-accent-500, #F97316)",
  color: "#fff",
  fontSize: 14,
  fontWeight: 700,
  textDecoration: "none",
  letterSpacing: "0.01em",
  boxShadow: "0 2px 6px rgba(249, 115, 22, 0.3)",
};
const capacityBadgeStyle = (consumable: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 10px",
  borderRadius: 999,
  background: consumable ? "#DCFCE7" : "#FEE2E2",
  color: consumable ? "#166534" : "#991B1B",
  fontSize: 12,
  fontWeight: 700,
});
const progressWrapStyle: React.CSSProperties = { marginTop: 12 };
const progressTrackStyle: React.CSSProperties = {
  position: "relative",
  height: 8,
  borderRadius: 4,
  background: "var(--nex-neutral-100, #F5F5F5)",
  overflow: "hidden",
};
const progressBarStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  height: "100%",
  borderRadius: 4,
  left: 0,
};
const progressLabelsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: 6,
  fontSize: 11,
  color: "var(--nex-neutral-500, #888)",
};
const reminderStyle: React.CSSProperties = {
  padding: 12,
  background: "var(--nex-cream-elev, #FFFFFF)",
  border: "1px solid var(--nex-neutral-200, #E5E7EB)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--nex-neutral-600, #666)",
  lineHeight: 1.6,
  marginTop: 8,
};
