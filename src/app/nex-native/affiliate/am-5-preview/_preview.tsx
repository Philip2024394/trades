"use client";

// src/app/admin/nex/affiliate/am-5-preview/_preview.tsx
//
// AM-5 Rev 4 · Admin Mock Preview · UX client component.
//
// ONE client component renders every mock surface for the AM-5 architecture:
//   · marketplace list (5 mock sellers · 4 enabled + 1 property-excluded)
//   · seller detail view (identity + catalogue + markets + current terms + version history)
//   · /manage/affiliate editor preview (full seller editor with enable/disable + publish)
//
// Scope wall · this file:
//   · uses ONLY fixtures from ./_fixtures
//   · never calls a server action
//   · never writes to localStorage, cookies, or any persistent store
//   · never touches a production component
//   · All mutations live in React state and reset when the preview tab is closed

import * as React from "react";
import {
  MOCK_SELLERS,
  MOCK_STANDARD_DEFAULTS,
  categoryLabel,
  currentVersion,
  publicationSourceLabel,
  qualifyingEventLabel,
  returnsRuleLabel,
  type MockAffiliateSeller,
  type MockAffiliateTermsVersion,
  type MockBusinessCategory,
  type MockQualifyingEvent,
  type MockReturnsRule,
} from "./_fixtures";

// Brand tokens · mirror /create-account exactly · sealed NEX brand
const NEX = {
  bg: "#020914",
  panel: "#03101D",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  fieldBg: "#04101F",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.18)",
  orange: "#FF7200",
  success: "#22C55E",
  destructive: "#F97066",
  mockBadge: "#A855F7",
};

const FONT = "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

type ViewId = "list" | "detail" | "editor";

export function AdminAm5PreviewClient() {
  const [view, setView] = React.useState<ViewId>("list");
  const [activeSellerId, setActiveSellerId] = React.useState<string>(MOCK_SELLERS[0]!.id);
  // Editor mock state · fresh copy of the first enabled seller's current version
  const defaultEditorSeller = MOCK_SELLERS.find((s) => s.programme_state === "enabled")!;
  const [editorSellerId, setEditorSellerId] = React.useState<string>(defaultEditorSeller.id);

  const activeSeller = MOCK_SELLERS.find((s) => s.id === activeSellerId) ?? MOCK_SELLERS[0]!;
  const editorSeller = MOCK_SELLERS.find((s) => s.id === editorSellerId) ?? defaultEditorSeller;

  return (
    <>
      <GlobalStyle />
      <main
        data-nex-am5-preview-root
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily: FONT,
          padding: "16px 20px 48px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <RadialGlow />

        <div style={{ position: "relative", maxWidth: 480, margin: "0 auto" }}>
          <MockBanner />
          <AdminHeader />
          <ViewSwitcher view={view} onChange={setView} />

          {view === "list" && (
            <ListView
              sellers={MOCK_SELLERS}
              onOpen={(id) => {
                setActiveSellerId(id);
                setView("detail");
              }}
            />
          )}
          {view === "detail" && (
            <DetailView
              seller={activeSeller}
              onBackToList={() => setView("list")}
              onOpenEditor={() => {
                setEditorSellerId(activeSeller.id);
                setView("editor");
              }}
            />
          )}
          {view === "editor" && (
            <EditorView
              seller={editorSeller}
              onSellerChange={setEditorSellerId}
            />
          )}

          <FooterNote />
        </div>
      </main>
    </>
  );
}

// =============================================================================
// Shared chrome
// =============================================================================

function GlobalStyle() {
  return (
    <style>{`
      html, body { background: ${NEX.bg} !important; }
      html, body { scrollbar-width: none; -ms-overflow-style: none; overflow-x: hidden; }
      html::-webkit-scrollbar, body::-webkit-scrollbar { width: 0; height: 0; display: none; }
      [data-nex-am5-preview-root] * { box-sizing: border-box; }
      button:focus-visible, a:focus-visible, label:focus-within {
        outline: 2px solid ${NEX.cyan};
        outline-offset: 2px;
        border-radius: 8px;
      }
    `}</style>
  );
}

function RadialGlow() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(60% 40% at 50% 0%, rgba(168, 85, 247, 0.10), transparent 72%)",
        pointerEvents: "none",
      }}
    />
  );
}

function MockBanner() {
  return (
    <div
      role="status"
      aria-label="Admin mock preview"
      style={{
        marginTop: "max(env(safe-area-inset-top, 0px), 4px)",
        padding: "10px 14px",
        background: `${NEX.mockBadge}18`,
        border: `1px solid ${NEX.mockBadge}66`,
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: NEX.mockBadge,
          color: "#fff",
          display: "grid",
          placeItems: "center",
          fontSize: 13,
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        !
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: NEX.mockBadge,
          }}
        >
          AM-5 Rev 4 · Mock Preview
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 11.5,
            color: NEX.textSecondary,
            lineHeight: 1.4,
          }}
        >
          No production affiliate terms are being changed. All data on this screen is fixtures.
        </div>
      </div>
    </div>
  );
}

function AdminHeader() {
  return (
    <header style={{ marginTop: 18, textAlign: "center" }}>
      <h1
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "-0.005em",
          lineHeight: 1.25,
        }}
      >
        Affiliate Marketplace · Admin Preview
      </h1>
      <p
        style={{
          margin: "6px auto 0",
          maxWidth: 360,
          fontSize: 12.5,
          color: NEX.textSecondary,
          lineHeight: 1.5,
        }}
      >
        Fixture-only walkthrough of the sealed AM-5 Rev 4 experience.
      </p>
    </header>
  );
}

function ViewSwitcher({ view, onChange }: { view: ViewId; onChange: (v: ViewId) => void }) {
  const items: { id: ViewId; label: string }[] = [
    { id: "list", label: "Marketplace" },
    { id: "detail", label: "Seller detail" },
    { id: "editor", label: "/manage/affiliate" },
  ];
  return (
    <div
      role="tablist"
      aria-label="Preview views"
      style={{
        marginTop: 18,
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 6,
      }}
    >
      {items.map((item) => {
        const active = view === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            style={{
              padding: "10px 8px",
              background: active ? NEX.panel : "transparent",
              border: `1px solid ${active ? NEX.cyan : NEX.cyanSoft}`,
              borderRadius: 10,
              color: active ? NEX.textPrimary : NEX.textSecondary,
              fontSize: 11.5,
              fontWeight: 600,
              letterSpacing: "0.02em",
              cursor: "pointer",
              fontFamily: FONT,
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function FooterNote() {
  return (
    <p
      style={{
        marginTop: 28,
        padding: "10px 12px",
        borderRadius: 8,
        background: `${NEX.mockBadge}10`,
        border: `1px solid ${NEX.mockBadge}44`,
        fontSize: 10.5,
        color: NEX.textSecondary,
        lineHeight: 1.5,
        textAlign: "center",
      }}
    >
      AM-5 Rev 4 remains sealed · Real AM-5-A through AM-5-F remain unauthorized · This build is mock/admin preview only.
    </p>
  );
}

// =============================================================================
// List view · marketplace cards for all five sellers
// =============================================================================

function ListView({
  sellers,
  onOpen,
}: {
  sellers: readonly MockAffiliateSeller[];
  onOpen: (sellerId: string) => void;
}) {
  return (
    <section data-nex-am5-view="list" style={{ marginTop: 20, display: "grid", gap: 14 }}>
      {sellers.map((s) => (
        <SellerCard key={s.id} seller={s} onOpen={() => onOpen(s.id)} />
      ))}
    </section>
  );
}

function SellerCard({
  seller,
  onOpen,
}: {
  seller: MockAffiliateSeller;
  onOpen: () => void;
}) {
  const current = currentVersion(seller);
  const excluded = seller.programme_state === "excluded";

  return (
    <article
      style={{
        padding: 16,
        background: NEX.panel,
        border: `1px solid ${excluded ? "rgba(249, 112, 102, 0.4)" : NEX.cyanSoft}`,
        borderRadius: 12,
        boxShadow: "0 10px 24px rgba(0, 0, 0, 0.3)",
        opacity: excluded ? 0.75 : 1,
      }}
    >
      {/* ① Identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          aria-hidden
          style={{
            flexShrink: 0,
            width: 46,
            height: 46,
            borderRadius: 10,
            background: NEX.cyanFaint,
            border: `1px solid ${NEX.cyanSoft}`,
            display: "grid",
            placeItems: "center",
            fontSize: 22,
          }}
        >
          {seller.logo_emoji}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: NEX.textPrimary, letterSpacing: "0.005em" }}>
            {seller.display_name}
          </div>
          <div style={{ fontSize: 11, color: NEX.textSecondary, marginTop: 2 }}>
            {categoryLabel(seller.category)} · {seller.location_label}
          </div>
        </div>
        {seller.verified && (
          <span
            aria-label="Verified business"
            style={{
              padding: "3px 8px",
              borderRadius: 999,
              background: `${NEX.success}1a`,
              border: `1px solid ${NEX.success}66`,
              color: NEX.success,
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            ✓ Verified
          </span>
        )}
      </div>

      {/* ② Description */}
      <p
        style={{
          marginTop: 12,
          fontSize: 12.5,
          color: NEX.textSecondary,
          lineHeight: 1.5,
        }}
      >
        {seller.description}
      </p>

      {/* ③ What they offer */}
      <div style={{ marginTop: 12 }}>
        <div
          style={{
            fontSize: 9,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          What they sell · {seller.catalogue_count} {seller.catalogue_term} live
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {seller.thumbnail_glyphs.map((g, i) => (
            <div
              key={i}
              aria-hidden
              style={{
                flex: 1,
                aspectRatio: "1",
                background: NEX.fieldBg,
                border: `1px solid ${NEX.cyanSoft}`,
                borderRadius: 8,
                display: "grid",
                placeItems: "center",
                fontSize: 20,
              }}
            >
              {g}
            </div>
          ))}
        </div>
      </div>

      {/* ④ Markets */}
      <div style={{ marginTop: 12 }}>
        <div
          style={{
            fontSize: 9,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 700,
            marginBottom: 4,
          }}
        >
          {seller.category === "food" || seller.category === "services"
            ? "Service area"
            : seller.category === "accommodation"
              ? "Guests accepted"
              : "Markets"}
        </div>
        <div style={{ fontSize: 12, color: NEX.textPrimary }}>{seller.markets_label}</div>
      </div>

      {/* ⑤+⑥ Commission + Settlement (one line, prominent) */}
      {!excluded && current && (
        <div
          style={{
            marginTop: 14,
            padding: "10px 12px",
            background: `linear-gradient(90deg, ${NEX.cyan}18, ${NEX.cyan}08)`,
            border: `1px solid ${NEX.cyanSoft}`,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 13, color: NEX.textPrimary, fontWeight: 600 }}>
            <strong style={{ color: NEX.cyan, fontSize: 15 }}>{current.commission_pct}%</strong>
            {" "}commission
          </span>
          <span style={{ color: NEX.textSecondary, fontSize: 11 }}>·</span>
          <span style={{ fontSize: 12, color: NEX.textPrimary }}>
            {current.settlement_frequency === "weekly" ? "Weekly" : "Monthly"} settlement
          </span>
        </div>
      )}

      {/* Excluded state for property */}
      {excluded && (
        <div
          style={{
            marginTop: 14,
            padding: "10px 12px",
            background: `${NEX.destructive}10`,
            border: `1px solid ${NEX.destructive}44`,
            borderRadius: 10,
            fontSize: 11.5,
            color: NEX.textSecondary,
            lineHeight: 1.5,
          }}
        >
          Property is excluded from the affiliate programme in v1 · AM-6 will reconsider once a qualifying paid event is defined.
        </div>
      )}

      {/* ⑦ Promote */}
      <div
        style={{
          marginTop: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={onOpen}
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            background: "transparent",
            border: `1px solid ${NEX.cyanSoft}`,
            color: NEX.cyan,
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: FONT,
          }}
        >
          View seller →
        </button>
        <button
          type="button"
          onClick={onOpen}
          disabled={excluded}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            background: "transparent",
            border: `1px solid ${excluded ? NEX.textMute : NEX.orange}`,
            color: excluded ? NEX.textMute : NEX.orange,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            cursor: excluded ? "not-allowed" : "pointer",
            fontFamily: FONT,
          }}
        >
          {excluded ? "Not available" : seller.mock_promotion.is_promoting ? "Promoting ✓" : "Promote this seller"}
        </button>
      </div>
    </article>
  );
}

// =============================================================================
// Detail view
// =============================================================================

function DetailView({
  seller,
  onBackToList,
  onOpenEditor,
}: {
  seller: MockAffiliateSeller;
  onBackToList: () => void;
  onOpenEditor: () => void;
}) {
  const current = currentVersion(seller);
  const promoting = seller.mock_promotion.is_promoting;
  const promotionVersion = seller.mock_promotion.terms_version_at_start;
  const promotionVersionData =
    promoting && promotionVersion !== null
      ? seller.versions.find((v) => v.version === promotionVersion) ?? null
      : null;
  const sellerUpdatedSinceJoined =
    promoting && current !== null && promotionVersion !== null && current.version !== promotionVersion;

  return (
    <section data-nex-am5-view="detail" style={{ marginTop: 20 }}>
      <button
        type="button"
        onClick={onBackToList}
        style={{
          padding: "6px 12px",
          borderRadius: 999,
          background: "transparent",
          border: `1px solid ${NEX.cyanSoft}`,
          color: NEX.cyan,
          fontSize: 11,
          cursor: "pointer",
          fontFamily: FONT,
        }}
      >
        ‹ Back to marketplace
      </button>

      {/* Identity header */}
      <div
        style={{
          marginTop: 14,
          padding: 16,
          background: NEX.panel,
          border: `1px solid ${NEX.cyanSoft}`,
          borderRadius: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            aria-hidden
            style={{
              flexShrink: 0,
              width: 52,
              height: 52,
              borderRadius: 12,
              background: NEX.cyanFaint,
              border: `1px solid ${NEX.cyanSoft}`,
              display: "grid",
              placeItems: "center",
              fontSize: 26,
            }}
          >
            {seller.logo_emoji}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: NEX.textPrimary }}>
              {seller.display_name}
            </div>
            <div style={{ fontSize: 11.5, color: NEX.textSecondary, marginTop: 2 }}>
              {categoryLabel(seller.category)} · {seller.location_label}
            </div>
          </div>
        </div>
        {current && (
          <div
            style={{
              marginTop: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 999,
              background: `${NEX.cyan}22`,
              border: `1px solid ${NEX.cyan}`,
              color: NEX.cyan,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {current.commission_pct}% affiliate commission
          </div>
        )}
      </div>

      {/* Description */}
      <SectionCard title="Description">
        <p style={{ margin: 0, fontSize: 12.5, color: NEX.textPrimary, lineHeight: 1.6 }}>
          {seller.description}
        </p>
      </SectionCard>

      {/* Catalogue */}
      <SectionCard title={`What you can promote · ${seller.catalogue_count} ${seller.catalogue_term} live`}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {seller.thumbnail_glyphs.concat(seller.thumbnail_glyphs).slice(0, 8).map((g, i) => (
            <div
              key={i}
              aria-hidden
              style={{
                width: 60,
                height: 60,
                background: NEX.fieldBg,
                border: `1px solid ${NEX.cyanSoft}`,
                borderRadius: 8,
                display: "grid",
                placeItems: "center",
                fontSize: 22,
              }}
            >
              {g}
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Markets */}
      <SectionCard
        title={
          seller.category === "food" || seller.category === "services"
            ? "Service area"
            : seller.category === "accommodation"
              ? "Guests accepted"
              : "Markets"
        }
      >
        <div style={{ fontSize: 13, color: NEX.textPrimary }}>{seller.markets_label}</div>
      </SectionCard>

      {/* Current affiliate terms */}
      {current && (
        <SectionCard title={`Affiliate terms · Version ${current.version}`}>
          <TermsTable version={current} />
        </SectionCard>
      )}

      {/* "Updated since you joined" affordance */}
      {sellerUpdatedSinceJoined && promotionVersionData && current && (
        <div
          style={{
            marginTop: 12,
            padding: "12px 14px",
            borderRadius: 10,
            background: `${NEX.orange}18`,
            border: `1px solid ${NEX.orange}66`,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: NEX.orange,
              marginBottom: 6,
            }}
          >
            Seller updated terms since you joined
          </div>
          <div style={{ fontSize: 12, color: NEX.textPrimary, lineHeight: 1.5 }}>
            Your promotion was started under <strong>Version {promotionVersionData.version}</strong>. The seller is now
            on <strong>Version {current.version}</strong>. Your accepted terms (v{promotionVersionData.version}) remain
            in force for your promotion.
          </div>
        </div>
      )}

      {/* Version history */}
      {seller.versions.length > 0 && (
        <SectionCard title="Terms version history">
          <VersionHistory versions={seller.versions} />
        </SectionCard>
      )}

      {/* Trust signals · factual only */}
      <SectionCard title="Trust">
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
          <TrustRow ok={seller.verified}>Business verified</TrustRow>
          <TrustRow ok={seller.catalogue_count > 0}>Catalogue live · {seller.catalogue_count} items</TrustRow>
          <TrustRow ok={seller.versions.length > 0}>Affiliate terms published</TrustRow>
          <TrustRow ok={true}>Markets declared</TrustRow>
        </ul>
      </SectionCard>

      {/* Primary CTA */}
      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          disabled={seller.programme_state === "excluded"}
          style={{
            width: "100%",
            minHeight: 52,
            background: "transparent",
            color: seller.programme_state === "excluded" ? NEX.textMute : NEX.orange,
            border: `1px solid ${seller.programme_state === "excluded" ? NEX.textMute : NEX.orange}`,
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            cursor: seller.programme_state === "excluded" ? "not-allowed" : "pointer",
            fontFamily: FONT,
          }}
        >
          {promoting ? "Promoting ✓ · tap to cancel (mock)" : "Promote this seller (mock)"}
        </button>
      </div>

      {/* Shortcut to editor */}
      <button
        type="button"
        onClick={onOpenEditor}
        style={{
          marginTop: 10,
          width: "100%",
          padding: 10,
          background: "transparent",
          border: "none",
          color: NEX.textSecondary,
          fontSize: 11,
          cursor: "pointer",
          fontFamily: FONT,
          textDecoration: "underline",
          textUnderlineOffset: 3,
        }}
      >
        Open seller editor mock →
      </button>
    </section>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 14,
        padding: 14,
        background: NEX.panel,
        border: `1px solid ${NEX.cyanSoft}`,
        borderRadius: 12,
      }}
    >
      <div
        style={{
          fontSize: 9,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: NEX.cyan,
          fontWeight: 700,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function TrustRow({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 10px",
        borderRadius: 8,
        background: NEX.fieldBg,
        border: `1px solid ${NEX.cyanSoft}`,
        fontSize: 12,
        color: NEX.textPrimary,
      }}
    >
      <span
        aria-hidden
        style={{
          color: ok ? NEX.success : NEX.textMute,
          fontWeight: 800,
          fontSize: 13,
        }}
      >
        {ok ? "✓" : "·"}
      </span>
      <span>{children}</span>
    </li>
  );
}

function TermsTable({ version }: { version: MockAffiliateTermsVersion }) {
  const rows: [string, string][] = [
    ["Commission", `${version.commission_pct}%`],
    ["Settlement", version.settlement_frequency === "weekly" ? "Weekly" : "Monthly"],
    ["Qualifying event", qualifyingEventLabel(version.qualifying_event)],
    ["Returns", returnsRuleLabel(version.returns_rule)],
    ...(version.returns_notes ? [["Returns notes", version.returns_notes] as [string, string]] : []),
    ["Payment", "Direct from seller"],
    ...(version.minimum_payout_amount
      ? [["Minimum payout", `${formatAmount(version.minimum_payout_amount, version.minimum_payout_currency)}`] as [string, string]]
      : []),
    ["Attribution", "NEX records referral + qualifying sale evidence used for settlement"],
    ["Published by", version.published_by_label],
    ["Source", publicationSourceLabel(version.publication_source)],
    ["Published at", formatDate(version.published_at)],
  ];
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <tbody>
        {rows.map(([k, v], i) => (
          <tr key={i} style={{ borderBottom: i < rows.length - 1 ? `1px solid ${NEX.cyanSoft}` : "none" }}>
            <td style={{ padding: "8px 8px 8px 0", color: NEX.textSecondary, width: "40%" }}>{k}</td>
            <td style={{ padding: "8px 0", color: NEX.textPrimary }}>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function VersionHistory({ versions }: { versions: readonly MockAffiliateTermsVersion[] }) {
  const sorted = [...versions].sort((a, b) => b.version - a.version);
  return (
    <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
      {sorted.map((v) => (
        <li
          key={v.version}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: NEX.fieldBg,
            border: `1px solid ${NEX.cyanSoft}`,
            fontSize: 11.5,
            lineHeight: 1.5,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <strong style={{ color: NEX.cyan, fontWeight: 800 }}>Version {v.version}</strong>
            <span
              style={{
                padding: "2px 7px",
                borderRadius: 999,
                background:
                  v.publication_source === "nex_standard_seed"
                    ? `${NEX.textMute}22`
                    : `${NEX.success}22`,
                border: `1px solid ${v.publication_source === "nex_standard_seed" ? NEX.textMute : NEX.success}44`,
                color: v.publication_source === "nex_standard_seed" ? NEX.textMute : NEX.success,
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {publicationSourceLabel(v.publication_source)}
            </span>
            <span style={{ marginLeft: "auto", color: NEX.textSecondary, fontSize: 10 }}>
              {formatDate(v.published_at)}
            </span>
          </div>
          <div style={{ color: NEX.textPrimary }}>
            {v.commission_pct}% ·{" "}
            {v.settlement_frequency === "weekly" ? "Weekly" : "Monthly"} ·{" "}
            {qualifyingEventLabel(v.qualifying_event)} · {returnsRuleLabel(v.returns_rule)}
          </div>
        </li>
      ))}
    </ol>
  );
}

// =============================================================================
// Editor view · /manage/affiliate preview
// =============================================================================

function EditorView({
  seller,
  onSellerChange,
}: {
  seller: MockAffiliateSeller;
  onSellerChange: (sellerId: string) => void;
}) {
  const current = currentVersion(seller);
  const [enabled, setEnabled] = React.useState<boolean>(seller.programme_state === "enabled");
  const [draftCommission, setDraftCommission] = React.useState<number>(current?.commission_pct ?? 10);
  const [draftSettlement, setDraftSettlement] = React.useState<"weekly" | "monthly">(
    current?.settlement_frequency ?? "weekly",
  );
  const [draftReturns, setDraftReturns] = React.useState<MockReturnsRule>(
    current?.returns_rule ?? "no_reversal",
  );
  const [draftReturnsNotes, setDraftReturnsNotes] = React.useState<string>(current?.returns_notes ?? "");
  const [draftMinPayout, setDraftMinPayout] = React.useState<string>(
    current?.minimum_payout_amount ? String(current.minimum_payout_amount) : "",
  );
  const [draftMinCurrency, setDraftMinCurrency] = React.useState<string>(
    current?.minimum_payout_currency ?? "",
  );
  const [previewPublished, setPreviewPublished] = React.useState<boolean>(false);

  // Reset draft when seller changes
  React.useEffect(() => {
    const cv = currentVersion(seller);
    setEnabled(seller.programme_state === "enabled");
    setDraftCommission(cv?.commission_pct ?? 10);
    setDraftSettlement(cv?.settlement_frequency ?? "weekly");
    setDraftReturns(cv?.returns_rule ?? "no_reversal");
    setDraftReturnsNotes(cv?.returns_notes ?? "");
    setDraftMinPayout(cv?.minimum_payout_amount ? String(cv.minimum_payout_amount) : "");
    setDraftMinCurrency(cv?.minimum_payout_currency ?? "");
    setPreviewPublished(false);
  }, [seller]);

  const excluded = seller.category === "property";
  const defaults = MOCK_STANDARD_DEFAULTS;
  const sampleQualifyingEvent: MockQualifyingEvent =
    excluded ? "paid_order_shipped" : defaults.by_category[seller.category].qualifying_event;

  return (
    <section data-nex-am5-view="editor" style={{ marginTop: 20 }}>
      {/* Seller picker */}
      <div
        style={{
          padding: 12,
          background: NEX.panel,
          border: `1px solid ${NEX.cyanSoft}`,
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <label
          style={{
            fontSize: 9,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 700,
          }}
        >
          Mock seller
        </label>
        <select
          value={seller.id}
          onChange={(e) => onSellerChange(e.target.value)}
          style={{
            padding: "8px 10px",
            background: NEX.fieldBg,
            border: `1px solid ${NEX.cyanSoft}`,
            borderRadius: 8,
            color: NEX.textPrimary,
            fontSize: 12.5,
            fontFamily: FONT,
          }}
        >
          {MOCK_SELLERS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.display_name} · {categoryLabel(s.category)}
            </option>
          ))}
        </select>
      </div>

      {excluded && (
        <div
          style={{
            marginTop: 12,
            padding: "12px 14px",
            borderRadius: 10,
            background: `${NEX.destructive}10`,
            border: `1px solid ${NEX.destructive}44`,
            fontSize: 12,
            color: NEX.textPrimary,
            lineHeight: 1.5,
          }}
        >
          Affiliate programme is not available for Property businesses in v1. AM-6 will reconsider once a qualifying paid event is defined.
        </div>
      )}

      {/* Programme toggle */}
      <SectionCard title="Affiliate programme">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 13, color: NEX.textPrimary }}>
            {enabled ? "Enabled" : "Disabled"}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => !excluded && setEnabled(!enabled)}
            disabled={excluded}
            style={{
              width: 42,
              height: 24,
              borderRadius: 999,
              background: enabled ? NEX.cyan : "rgba(255,255,255,0.08)",
              border: `1px solid ${enabled ? NEX.cyan : NEX.cyanSoft}`,
              position: "relative",
              cursor: excluded ? "not-allowed" : "pointer",
              padding: 0,
              opacity: excluded ? 0.5 : 1,
            }}
          >
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: 2,
                left: enabled ? 20 : 2,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: enabled ? NEX.bg : "#fff",
                transition: "left 160ms ease",
              }}
            />
          </button>
        </div>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 11,
            color: NEX.textSecondary,
            lineHeight: 1.5,
          }}
        >
          {enabled && seller.versions.length > 0
            ? `Programme enabled · currently on Version ${currentVersion(seller)!.version} · existing terms history preserved.`
            : enabled
              ? `Enabling now would seed Version 1 with NEX standard defaults (${defaults.commission_pct}% · ${defaults.settlement_frequency}).`
              : seller.versions.length > 0
                ? `Programme disabled · terms history preserved · re-enabling will not create a new seed version.`
                : `Programme never enabled · no terms history exists yet.`}
        </p>
      </SectionCard>

      {/* Commission + settlement form */}
      <SectionCard title="Commercial terms (draft)">
        <FormRow label="Commission %">
          <input
            type="number"
            min={0}
            max={50}
            value={draftCommission}
            onChange={(e) => setDraftCommission(parseInt(e.target.value || "0", 10) || 0)}
            disabled={excluded || !enabled}
            style={inputStyle(excluded || !enabled)}
          />
        </FormRow>
        <FormRow label="Settlement">
          <div style={{ display: "flex", gap: 8 }}>
            {(["weekly", "monthly"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => !excluded && enabled && setDraftSettlement(f)}
                disabled={excluded || !enabled}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: draftSettlement === f ? NEX.cyan : "transparent",
                  color: draftSettlement === f ? NEX.bg : NEX.textPrimary,
                  border: `1px solid ${draftSettlement === f ? NEX.cyan : NEX.cyanSoft}`,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: excluded || !enabled ? "not-allowed" : "pointer",
                  fontFamily: FONT,
                  textTransform: "capitalize",
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </FormRow>
        <FormRow label="Qualifying event">
          <div
            style={{
              padding: "8px 10px",
              background: NEX.fieldBg,
              border: `1px solid ${NEX.cyanSoft}`,
              borderRadius: 8,
              color: NEX.textPrimary,
              fontSize: 12.5,
            }}
          >
            {qualifyingEventLabel(sampleQualifyingEvent)} · set by business type
          </div>
        </FormRow>
        <FormRow label="Returns rule">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
            {(["reverse_on_return", "no_reversal", "partial_reversal", "seller_discretion"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => !excluded && enabled && setDraftReturns(r)}
                disabled={excluded || !enabled}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: draftReturns === r ? NEX.cyan : "transparent",
                  color: draftReturns === r ? NEX.bg : NEX.textPrimary,
                  border: `1px solid ${draftReturns === r ? NEX.cyan : NEX.cyanSoft}`,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: excluded || !enabled ? "not-allowed" : "pointer",
                  fontFamily: FONT,
                  textAlign: "left",
                }}
              >
                {returnsRuleLabel(r)}
              </button>
            ))}
          </div>
        </FormRow>
        <FormRow label="Returns notes (optional · max 240 chars)">
          <textarea
            value={draftReturnsNotes}
            onChange={(e) => setDraftReturnsNotes(e.target.value.slice(0, 240))}
            disabled={excluded || !enabled}
            maxLength={240}
            rows={3}
            placeholder="e.g. Commission reversed on returns within 30 days of dispatch."
            style={{ ...inputStyle(excluded || !enabled), fontFamily: FONT, resize: "vertical", minHeight: 60 }}
          />
          <div style={{ fontSize: 10, color: NEX.textSecondary, textAlign: "right", marginTop: 2 }}>
            {draftReturnsNotes.length} / 240
          </div>
        </FormRow>
        <FormRow label="Minimum payout (optional)">
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="text"
              inputMode="numeric"
              value={draftMinPayout}
              onChange={(e) => setDraftMinPayout(e.target.value.replace(/\D/g, "").slice(0, 10))}
              disabled={excluded || !enabled}
              placeholder="amount"
              style={{ ...inputStyle(excluded || !enabled), flex: 1 }}
            />
            <input
              type="text"
              value={draftMinCurrency}
              onChange={(e) => setDraftMinCurrency(e.target.value.toUpperCase().slice(0, 3))}
              disabled={excluded || !enabled}
              placeholder="CCY"
              style={{ ...inputStyle(excluded || !enabled), width: 80 }}
            />
          </div>
        </FormRow>
      </SectionCard>

      {/* Preview publish */}
      <button
        type="button"
        onClick={() => !excluded && enabled && setPreviewPublished(true)}
        disabled={excluded || !enabled}
        style={{
          marginTop: 16,
          width: "100%",
          minHeight: 52,
          background: previewPublished ? "transparent" : excluded || !enabled ? "transparent" : NEX.orange,
          color: previewPublished ? NEX.success : excluded || !enabled ? NEX.textMute : "#0B0F1A",
          border: `1px solid ${previewPublished ? NEX.success : excluded || !enabled ? NEX.textMute : NEX.orange}`,
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          cursor: excluded || !enabled ? "not-allowed" : "pointer",
          fontFamily: FONT,
        }}
      >
        {previewPublished ? "Preview published ✓ (mock state only)" : "Preview publish"}
      </button>
      <p
        style={{
          marginTop: 10,
          fontSize: 11,
          color: NEX.textSecondary,
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        No production write · no server action called · no new terms version created in the database.
      </p>

      {/* Current + history reference */}
      {seller.versions.length > 0 && (
        <SectionCard title={`Published terms history for ${seller.display_name}`}>
          <VersionHistory versions={seller.versions} />
        </SectionCard>
      )}
    </section>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label
      style={{
        display: "block",
        marginBottom: 12,
      }}
    >
      <span
        style={{
          display: "block",
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: NEX.cyan,
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function inputStyle(disabled: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    background: NEX.fieldBg,
    color: disabled ? NEX.textMute : NEX.textPrimary,
    border: `1px solid ${NEX.cyanSoft}`,
    borderRadius: 8,
    fontSize: 13,
    fontFamily: FONT,
    opacity: disabled ? 0.6 : 1,
  };
}

// =============================================================================
// Formatters
// =============================================================================

function formatAmount(amount: number, currency: string | null): string {
  if (currency === "IDR") return `Rp ${amount.toLocaleString("id-ID")}`;
  if (currency === "GBP") return `£${amount.toLocaleString("en-GB")}`;
  if (currency === "USD") return `$${amount.toLocaleString("en-US")}`;
  return currency ? `${amount.toLocaleString()} ${currency}` : amount.toLocaleString();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
