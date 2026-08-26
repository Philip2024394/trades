// src/app/nex-market/city/[city]/page.tsx
//
// Dynamic per-city NEX Market directory (2026-08-24).
//
// Namespaced under `/nex-market/city/[city]` to avoid conflict with the
// existing `/nex-market/product/[slug]` and `/nex-market/seller/[slug]`
// routes at the same tree level. One template · every city driven by data.
//
// Doctrine (Philip 2026-08-24):
//   · Do NOT create 100 separate React pages for 100 cities
//   · One reusable city template · city is data
//   · Never fake activity · unknown slugs → 404
//   · Never present discovered sellers as active sellers (honest funnel)

import Link from "next/link";
import { notFound } from "next/navigation";
import { listSellersByCityCanonical } from "@/lib/nex-shop/queries";
import { cityFromSlug } from "@/lib/nex/city-registry";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }) {
  const { city: slug } = await params;
  const entry = cityFromSlug(slug);
  return { title: entry ? `NEX Market · ${entry.canonical}` : "NEX Market" };
}

export default async function NexMarketCityPage(
  { params }: { params: Promise<{ city: string }> },
): Promise<React.JSX.Element> {
  const { city: slug } = await params;
  const entry = cityFromSlug(slug);
  if (!entry) notFound();

  const sellers = await listSellersByCityCanonical(entry.canonical);
  const activeCount     = sellers.filter((s) => s.status === "active").length;
  const registeredCount = sellers.filter((s) => s.status === "registered" || s.status === "verified").length;
  const claimedCount    = sellers.filter((s) => s.status === "claimed").length;
  const discoveredCount = sellers.filter((s) => s.status === "discovered").length;

  return (
    <main style={{ maxWidth: 1240, margin: "0 auto", padding: "36px 24px" }}>
      {/* City-specific hero · smaller than the main /nex-market landing per Philip's
          "smaller banners" instruction · uses real DB counts · no fake stats. */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "#c2410c", fontWeight: 700 }}>
          NEX Market · {entry.province}
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: "6px 0 4px 0", letterSpacing: "-0.01em" }}>
          {entry.canonical}
        </h1>
        <p style={{ color: "#666", fontSize: 14, marginBottom: 14 }}>
          {sellers.length} local business{sellers.length === 1 ? "" : "es"} discovered by NEX in {entry.canonical}.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <FunnelPill label="Discovered" n={discoveredCount} tone="neutral" />
          <FunnelPill label="Claimed"    n={claimedCount}    tone="amber" />
          <FunnelPill label="Registered" n={registeredCount} tone="blue" />
          <FunnelPill label="Active"     n={activeCount}     tone="green" />
        </div>
      </section>

      <section style={{ marginBottom: 24, fontSize: 12, color: "#8a8776" }}>
        <Link href="/nex-market" style={{ color: "#c2410c", textDecoration: "none" }}>← All NEX Market</Link>
        <span style={{ padding: "0 8px" }}>·</span>
        <Link href={`/accommodation/${entry.slug}`} style={{ color: "#8a8776", textDecoration: "none" }}>
          NEX Accommodation · {entry.canonical} →
        </Link>
      </section>

      {sellers.length === 0 ? (
        <div style={{
          padding: "32px 20px", background: "#fff",
          border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12, textAlign: "center", color: "#666",
        }}>
          <div style={{ fontSize: 32 }}>🏪</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 8, color: "#1a1a1a" }}>
            No sellers discovered yet in {entry.canonical}.
          </div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            The Market Walker rotates through {entry.canonical} as part of its Indonesia-wide sweep.
            Listings appear here as they are discovered.
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {sellers.map((s) => (
            <article key={s.sellerId} style={{
              background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12,
              padding: 16, display: "flex", flexDirection: "column", gap: 8,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.2 }}>
                  {s.displayName}
                </div>
                <StatusChip status={s.status} />
              </div>
              <div style={{ fontSize: 12, color: "#666" }}>
                📍 {s.city ?? entry.canonical}
                {s.productCount > 0 && (
                  <> · <strong>{s.productCount}</strong> product{s.productCount === 1 ? "" : "s"}</>
                )}
              </div>
              {s.bio && (
                <div style={{ fontSize: 12, color: "#888", lineHeight: 1.4 }}>
                  {s.bio.length > 120 ? s.bio.slice(0, 117) + "…" : s.bio}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

function FunnelPill({ label, n, tone }: { label: string; n: number; tone: "neutral" | "amber" | "blue" | "green" }) {
  const map = {
    neutral: { bg: "rgba(0,0,0,0.04)",       fg: "#444" },
    amber:   { bg: "rgba(245,158,11,0.10)",  fg: "#92400e" },
    blue:    { bg: "rgba(37,99,235,0.10)",   fg: "#1e40af" },
    green:   { bg: "rgba(16,185,129,0.10)",  fg: "#047857" },
  }[tone];
  return (
    <span style={{
      padding: "5px 12px", borderRadius: 999,
      background: map.bg, color: map.fg,
      fontSize: 12, fontWeight: 700,
    }}>
      {label} <strong>{n}</strong>
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  const tone = status === "active" ? "green" : status === "registered" || status === "verified" ? "blue" : status === "claimed" ? "amber" : "neutral";
  const map = {
    neutral: { bg: "rgba(0,0,0,0.04)",       fg: "#666" },
    amber:   { bg: "rgba(245,158,11,0.15)",  fg: "#92400e" },
    blue:    { bg: "rgba(37,99,235,0.15)",   fg: "#1e40af" },
    green:   { bg: "rgba(16,185,129,0.15)",  fg: "#047857" },
  }[tone];
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 999,
      background: map.bg, color: map.fg,
      fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase",
    }}>{status}</span>
  );
}
