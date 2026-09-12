// src/components/nexapp/NexWorkspaceBusinessHome.tsx · Philip 2026-09-05
//
// NEX BUSINESS SECTION · M0 · Business Home cockpit
//
// Authorization: "AUTHORIZE M0 + P0.1 · NEX BUSINESS HOME + PRODUCTS →
// PRODUCT CREATOR" (Philip 2026-09-05). This workspace is the owner-facing
// entry point for NEX Business.
//
// Composes with (all locked doctrines · pinned in MEMORY.md):
//   · doctrine_nex_one_universal_chat (Conversations → same NEX Chat)
//   · doctrine_nex_one_contacts_list_business_as_section (Business Contacts → existing Contacts)
//   · doctrine_nex_business_marketing_employee (Business surface grouping)
//   · doctrine_nex_marketing_local_national_international_modes (conversational campaign entry)
//   · doctrine_nex_marketing_owner_experience_language (calm employee tone · never fake AI)
//   · doctrine_nex_owner_controlled_reply (inbound replies land in Business Chat)
//   · doctrine_nex_product_service_creation_experience (Products entry)
//   · doctrine_nex_universal_business_product_taxonomy (taxonomy referenced · not consumed in M0)
//   · doctrine_nex_customer_identity_email_location_marketing_eligibility (Customers → future CI slice)
//   · doctrine_nex_japan_first_class_market (Japan first-class · surfaced subtly)
//   · doctrine_nex_pwa_offline_first (works with local/demo state · never blanks offline)
//   · doctrine_nex_owner_currency_customer_display (owner currency respected · not consumed here)
//
// EXPLICIT boundaries (per authorization):
//   · No taxonomy runtime consumption (nex_taxonomy queries · deferred)
//   · No Marketing Employee execution (Marketing card → visual placeholder only)
//   · No Business Brain implementation
//   · No Customer Identity implementation
//   · No DB / .env / workforce / C12 / scheduler / legacy changes
//   · No real messages sent · no fake results · no invented counters
//   · Products / Product Creator / Contacts / Chat rendered surfaces UNCHANGED
//
// Uses the same T/G design tokens + inside-out layout discipline as
// NexWorkspaceProducts / NexWorkspaceProductCreator / ContactsPanel.

"use client";

import React, { useCallback, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Building2, ShoppingBag, Megaphone, Users,
  Contact, MessagesSquare, ScrollText, Sparkles, Check, Clock, ChevronRight,
} from "lucide-react";

import {
  DEMO_COMPANY, MARKETING_SUGGESTIONS, MarketingIntent,
  sectionsForHome, COPY,
  type BusinessScreen, type BusinessSection2, type BusinessSectionEmphasis,
} from "@/lib/nexapp/mockBusinessHome";

// ── Design tokens · match other v6 chassis workspaces ─────────────────

const T = {
  bg:         "#050506",
  surface:    "rgba(20, 20, 24, 0.72)",
  surfaceHi:  "rgba(28, 28, 34, 0.88)",
  surfaceLo:  "rgba(14, 14, 18, 0.85)",
  border:     "rgba(255, 255, 255, 0.06)",
  borderMed:  "rgba(255, 255, 255, 0.10)",
  borderHi:   "rgba(255, 255, 255, 0.16)",
  textPri:    "rgba(245, 245, 246, 0.98)",
  textSec:    "rgba(178, 178, 184, 0.88)",
  textDim:    "rgba(130, 130, 138, 0.75)",
  textMute:   "rgba(100, 100, 108, 0.65)",
  orange:     "#f97316",
  orangeSoft: "rgba(249, 115, 22, 0.10)",
  orangeMid:  "rgba(249, 115, 22, 0.35)",
  orangeSolid:"#f97316",
  green:      "#22c55e",
  greenSoft:  "rgba(34, 197, 94, 0.10)",
  greenMid:   "rgba(34, 197, 94, 0.35)",
  amber:      "#f59e0b",
  amberSoft:  "rgba(245, 158, 11, 0.10)",
  amberMid:   "rgba(245, 158, 11, 0.35)",
};

const G = {
  hPad:       16,
  headerH:    82,
  radius:     14,
  radiusS:    10,
  radiusXS:   8,
  sectionGap: 14,
};

// ── Props ──────────────────────────────────────────────────────────────

export type BusinessHomeSwapTarget =
  | "products" | "messages-contacts" | "messages-friends";

export interface NexWorkspaceBusinessHomeProps {
  onBack?: () => void;
  /**
   * Called when a section card requests a workspace swap
   * (Products / Contacts / Chat). NexAppShell wires this to
   * setArtifact(target).
   */
  onSwapWorkspace?: (target: BusinessHomeSwapTarget) => void;
  /**
   * M1-A (Philip 2026-09-05): called when the "Tell NEX about your
   * business" primary card is tapped. NexAppShell wires this to
   * setArtifact("business-onboarding"). Deferred to a prop rather than
   * hard-coding the artifact name so the workspace doesn't reach into
   * the shell's artifact vocabulary.
   */
  onOpenOnboarding?: () => void;
}

// ── Component ──────────────────────────────────────────────────────────

export function NexWorkspaceBusinessHome({
  onBack, onSwapWorkspace, onOpenOnboarding,
}: NexWorkspaceBusinessHomeProps) {
  const [screen, setScreen] = useState<BusinessScreen>("home");
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);

  const sections = useMemo(() => sectionsForHome(), []);

  const uiStub = useCallback((msg: string) => {
    console.log(`[NexWorkspaceBusinessHome] ${msg} · UI stub · no backend`);
  }, []);

  const handleSection = useCallback((s: BusinessSection2) => {
    if (s.destination.kind === "swap") {
      const target = s.destination.artifact as BusinessHomeSwapTarget;
      uiStub(`swap to workspace: ${target}`);
      onSwapWorkspace?.(target);
      return;
    }
    if (s.destination.kind === "screen") {
      uiStub(`open internal screen: ${s.destination.name}`);
      setScreen(s.destination.name);
      return;
    }
    uiStub(`section ${s.id} is future · no action`);
  }, [onSwapWorkspace, uiStub]);

  const goHome = useCallback(() => setScreen("home"), []);

  return (
    <section
      aria-label="NEX Business Home workspace"
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxWidth: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        boxSizing: "border-box",
        color: T.textPri,
        background: T.bg,
        overflow: "hidden",
      }}
    >
      <Header
        title={screen === "home" ? "My Business" : titleForScreen(screen)}
        subtitle={screen === "home" ? "Set up your company so NEX knows how to help" : subtitleForScreen(screen)}
        onBack={() => {
          if (screen === "home") { onBack?.(); return; }
          if (screen === "campaign-review") { setScreen("marketing"); return; }
          setScreen("home");
        }}
        backLabel={screen === "home" ? "Back" : "Business"}
      />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          overflowY: "auto",
          overflowX: "hidden",
          padding: `12px ${G.hPad}px 24px`,
          boxSizing: "border-box",
          width: "100%",
          maxWidth: "100%",
          display: "flex",
          flexDirection: "column",
          gap: G.sectionGap,
        }}
      >
        {screen === "home" && (
          <HomeScreen
            sections={sections}
            onSection={handleSection}
            onPrimaryPrompt={() => {
              uiStub("primary prompt tapped · opening conversational onboarding (M1-A)");
              if (onOpenOnboarding) {
                onOpenOnboarding();
              } else {
                // Fallback for callers that haven't wired the onboarding prop
                // (preserves prior behaviour · shows the company placeholder).
                setScreen("company");
              }
            }}
          />
        )}

        {screen === "company"   && <CompanyScreen  onDone={goHome} />}
        {screen === "marketing" && (
          <MarketingScreen
            onSuggestion={(id) => { setSelectedSuggestionId(id); setScreen("campaign-review"); uiStub(`suggestion tapped: ${id}`); }}
            onCustomTypeAttempt={() => uiStub("custom marketing input · Marketing Employee not activated")}
          />
        )}
        {screen === "campaign-review" && (
          <CampaignReviewScreen
            suggestionId={selectedSuggestionId}
            onBack={() => setScreen("marketing")}
            onSaveDraft={() => uiStub("save campaign draft (local) · nothing sent · Marketing Employee not activated")}
          />
        )}
        {screen === "customers" && <CustomersEmptyScreen onBack={goHome} />}
        {screen === "quotes"    && <QuotesEmptyScreen    onBack={goHome} />}
      </div>
    </section>
  );
}

function titleForScreen(s: BusinessScreen): string {
  switch (s) {
    case "company":         return "My Company";
    case "marketing":       return "Marketing";
    case "campaign-review": return "Campaign preview";
    case "customers":       return "Customers";
    case "quotes":          return "Quotes";
    case "home":
    default: return "My Business";
  }
}

function subtitleForScreen(s: BusinessScreen): string {
  switch (s) {
    case "company":         return "Tell NEX about your business";
    case "marketing":       return "Your NEX Marketing Employee";
    case "campaign-review": return "Preview only · nothing sent";
    case "customers":       return "Coming with Customer Identity";
    case "quotes":          return "Coming next";
    case "home":
    default: return "Set up your company so NEX knows how to help";
  }
}

// ── Header ────────────────────────────────────────────────────────────

function Header({
  title, subtitle, onBack, backLabel,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  backLabel: string;
}) {
  return (
    <header
      style={{
        flex: `0 0 ${G.headerH}px`,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: `0 ${G.hPad}px`,
        borderBottom: `1px solid ${T.border}`,
        boxSizing: "border-box",
        minWidth: 0,
      }}
    >
      <button
        type="button"
        aria-label={backLabel}
        onClick={onBack}
        style={{
          appearance: "none",
          background: "transparent",
          border: "none",
          padding: 0,
          width: 40,
          height: 40,
          borderRadius: 10,
          color: T.orange,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <ArrowLeft size={22} strokeWidth={2} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: -0.01,
            lineHeight: 1.15,
            color: T.textPri,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: T.textDim,
            lineHeight: 1.2,
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {subtitle}
        </div>
      </div>
    </header>
  );
}

// ── Home screen (grid of section cards) ───────────────────────────────

function HomeScreen({
  sections, onSection, onPrimaryPrompt,
}: {
  sections: ReadonlyArray<BusinessSection2>;
  onSection: (s: BusinessSection2) => void;
  onPrimaryPrompt: () => void;
}) {
  // Group by emphasis so we can render primaries larger + futures muted
  const primaries = sections.filter((s) => s.emphasis === "primary");
  const connected = sections.filter((s) => s.emphasis === "connected");
  const futures   = sections.filter((s) => s.emphasis === "future");

  return (
    <>
      {/* Primary conversational card · "Tell NEX about your business" */}
      <button
        type="button"
        onClick={onPrimaryPrompt}
        style={{
          appearance: "none",
          display: "flex",
          alignItems: "center",
          gap: 14,
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          padding: "16px 18px",
          background: T.orangeSoft,
          border: `1px solid ${T.orangeMid}`,
          borderRadius: G.radius,
          color: T.textPri,
          cursor: "pointer",
          textAlign: "left",
          boxSizing: "border-box",
        }}
      >
        <span
          aria-hidden
          style={{
            flexShrink: 0,
            width: 38,
            height: 38,
            borderRadius: 999,
            background: T.orangeMid,
            color: "#0b0b0d",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Sparkles size={18} strokeWidth={2} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: -0.005,
              lineHeight: 1.25,
              color: T.textPri,
            }}
          >
            Tell NEX about your business
          </span>
          <span
            style={{
              display: "block",
              marginTop: 3,
              fontSize: 12,
              color: T.textDim,
              lineHeight: 1.35,
            }}
          >
            Onboarding starts a short conversation.
          </span>
        </span>
        <ChevronRight size={16} strokeWidth={2} style={{ color: T.orange, flexShrink: 0 }} />
      </button>

      {/* Primary section pair · My Company + Products · full-width equal tiles */}
      <SectionGroupTitle>Get started</SectionGroupTitle>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
        {primaries.map((s) => <PrimaryTile key={s.id} section={s} onTap={() => onSection(s)} />)}
      </div>

      {/* Connected section pair · Business Contacts + Conversations */}
      <SectionGroupTitle>Connected to NEX</SectionGroupTitle>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
        {connected.map((s) => <ConnectedTile key={s.id} section={s} onTap={() => onSection(s)} />)}
      </div>

      {/* Future section list · Marketing / Customers / Quotes · muted */}
      <SectionGroupTitle>Coming next</SectionGroupTitle>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
        }}
      >
        {futures.map((s) => <FutureRow key={s.id} section={s} onTap={() => onSection(s)} />)}
      </div>

      <div
        style={{
          marginTop: 4,
          padding: "10px 12px",
          fontSize: 11,
          color: T.textMute,
          textAlign: "center",
          letterSpacing: 0.2,
          lineHeight: 1.5,
        }}
      >
        NEX will tell you when there is a useful next step.
      </div>
    </>
  );
}

function SectionGroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 6,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 1.6,
        color: T.textMute,
        textTransform: "uppercase" as const,
        lineHeight: 1,
      }}
    >
      {children}
    </div>
  );
}

// ── Card variants ─────────────────────────────────────────────────────

function PrimaryTile({
  section, onTap,
}: {
  section: BusinessSection2;
  onTap: () => void;
}) {
  const Icon = iconFor(section.id);
  return (
    <button
      type="button"
      onClick={onTap}
      style={{
        appearance: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 10,
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        minHeight: 116,
        padding: 14,
        background: T.surface,
        border: `1px solid ${T.borderMed}`,
        borderRadius: G.radius,
        color: T.textPri,
        cursor: "pointer",
        textAlign: "left",
        boxSizing: "border-box",
        transition: "border-color 120ms ease, background 120ms ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.orangeMid; e.currentTarget.style.background = T.surfaceHi; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.borderMed;  e.currentTarget.style.background = T.surface;   }}
    >
      <span
        aria-hidden
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: T.orangeSoft,
          border: `1px solid ${T.orangeMid}`,
          color: T.orange,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={17} strokeWidth={2} />
      </span>
      <span style={{ display: "block", fontSize: 14, fontWeight: 700, letterSpacing: -0.005, lineHeight: 1.2 }}>
        {section.label}
      </span>
      <span style={{ display: "block", fontSize: 11.5, color: T.textDim, lineHeight: 1.35, marginTop: "auto" }}>
        {section.hint}
      </span>
    </button>
  );
}

function ConnectedTile({
  section, onTap,
}: {
  section: BusinessSection2;
  onTap: () => void;
}) {
  const Icon = iconFor(section.id);
  return (
    <button
      type="button"
      onClick={onTap}
      style={{
        appearance: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 8,
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        minHeight: 96,
        padding: 12,
        background: T.surfaceLo,
        border: `1px solid ${T.borderMed}`,
        borderRadius: G.radius,
        color: T.textPri,
        cursor: "pointer",
        textAlign: "left",
        boxSizing: "border-box",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.greenMid; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.borderMed; }}
    >
      <span
        aria-hidden
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          background: T.greenSoft,
          border: `1px solid ${T.greenMid}`,
          color: T.green,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={14} strokeWidth={2} />
      </span>
      <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, letterSpacing: -0.005, lineHeight: 1.2 }}>
        {section.label}
      </span>
      <span style={{ display: "block", fontSize: 11, color: T.textDim, lineHeight: 1.35, marginTop: "auto" }}>
        {section.hint}
      </span>
    </button>
  );
}

function FutureRow({
  section, onTap,
}: {
  section: BusinessSection2;
  onTap: () => void;
}) {
  const Icon = iconFor(section.id);
  return (
    <button
      type="button"
      onClick={onTap}
      style={{
        appearance: "none",
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        padding: "12px 14px",
        background: T.surfaceLo,
        border: `1px dashed ${T.borderMed}`,
        borderRadius: G.radiusS,
        color: T.textSec,
        cursor: "pointer",
        textAlign: "left",
        boxSizing: "border-box",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.amberMid; e.currentTarget.style.color = T.textPri; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.borderMed; e.currentTarget.style.color = T.textSec; }}
    >
      <span
        aria-hidden
        style={{
          width: 26,
          height: 26,
          borderRadius: 999,
          background: T.amberSoft,
          border: `1px solid ${T.amberMid}`,
          color: T.amber,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Clock size={13} strokeWidth={2} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textPri, lineHeight: 1.2 }}>
          {section.label}
        </span>
        <span style={{ display: "block", fontSize: 11, color: T.textDim, lineHeight: 1.35, marginTop: 2 }}>
          {section.hint}
        </span>
      </span>
      <ChevronRight size={14} strokeWidth={2} style={{ color: T.textMute, flexShrink: 0 }} />
    </button>
  );
}

function iconFor(id: string) {
  switch (id) {
    case "my-company":         return Building2;
    case "products":           return ShoppingBag;
    case "marketing":          return Megaphone;
    case "customers":          return Users;
    case "business-contacts":  return Contact;
    case "conversations":      return MessagesSquare;
    case "quotes":             return ScrollText;
    default:                   return Building2;
  }
}

// ── My Company screen · placeholder for future M1 onboarding ─────────

function CompanyScreen({ onDone }: { onDone: () => void }) {
  return (
    <Placeholder
      icon={Building2}
      title="Tell NEX about your business"
      body="M1 will start a short conversation with NEX: what your business does, where you operate, what markets matter to you, and what you want NEX to help with. NEX will remember it. Nothing else has to be filled in."
      calloutTitle="What's in the demo already"
      calloutRows={[
        { k: "Demo company", v: DEMO_COMPANY.legalName },
        { k: "Industry", v: DEMO_COMPANY.industryLabel },
        { k: "Home", v: `${DEMO_COMPANY.homeCity}, ${DEMO_COMPANY.homeCountryLabel}` },
        { k: "Target markets", v: DEMO_COMPANY.targetMarkets.map((m) => `${m.flag} ${m.label}${m.firstClass ? " · first-class" : ""}`).join(" · ") },
      ]}
      backLabel="Back to Business"
      onBack={onDone}
      coming="Onboarding lands with the M1 slice."
    />
  );
}

// ── Marketing screen · conversational preview only ────────────────────

function MarketingScreen({
  onSuggestion, onCustomTypeAttempt,
}: {
  onSuggestion: (id: string) => void;
  onCustomTypeAttempt: () => void;
}) {
  return (
    <>
      <div
        style={{
          padding: "18px 18px 16px",
          background: T.surface,
          border: `1px solid ${T.borderMed}`,
          borderRadius: G.radius,
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.6,
            color: T.textMute,
            textTransform: "uppercase" as const,
            lineHeight: 1,
          }}
        >
          Your NEX Marketing Employee
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 17,
            fontWeight: 700,
            color: T.textPri,
            lineHeight: 1.35,
            letterSpacing: -0.005,
          }}
        >
          &ldquo;What would you like me to do?&rdquo;
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: T.textDim, lineHeight: 1.4 }}>
          {COPY.marketing.hintUnder}
        </div>
      </div>

      {/* Suggestion chips */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
        {MARKETING_SUGGESTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSuggestion(s.id)}
            style={{
              appearance: "none",
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              maxWidth: "100%",
              minWidth: 0,
              padding: "12px 14px",
              background: T.surfaceLo,
              border: `1px solid ${T.borderMed}`,
              borderRadius: G.radiusS,
              color: T.textPri,
              cursor: "pointer",
              textAlign: "left",
              fontSize: 13,
              lineHeight: 1.4,
              boxSizing: "border-box",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.orangeMid; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.borderMed; }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>{s.text}</span>
            <ChevronRight size={14} strokeWidth={2} style={{ color: T.orange, flexShrink: 0 }} />
          </button>
        ))}
      </div>

      {/* Typed input (disabled · Marketing Employee not activated) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          padding: "0 12px",
          height: 44,
          background: T.surfaceLo,
          border: `1px dashed ${T.borderMed}`,
          borderRadius: G.radiusS,
          boxSizing: "border-box",
        }}
      >
        <input
          type="text"
          placeholder={COPY.marketing.inputPlaceholder}
          onFocus={onCustomTypeAttempt}
          disabled
          style={{
            flex: 1,
            minWidth: 0,
            height: "100%",
            background: "transparent",
            border: "none",
            color: T.textPri,
            fontSize: 13,
            outline: "none",
            padding: 0,
            opacity: 0.55,
          }}
        />
        <span style={{ fontSize: 10.5, color: T.amber, letterSpacing: 0.3, flexShrink: 0 }}>Preview only</span>
      </div>

      <div
        style={{
          padding: "10px 12px",
          fontSize: 11,
          color: T.textDim,
          lineHeight: 1.5,
          textAlign: "center",
        }}
      >
        {COPY.marketing.footnote}
      </div>
    </>
  );
}

// ── Campaign review screen · pure preview · never executes ────────────

function CampaignReviewScreen({
  suggestionId, onBack, onSaveDraft,
}: {
  suggestionId: string | null;
  onBack: () => void;
  onSaveDraft: () => void;
}) {
  const suggestion = MARKETING_SUGGESTIONS.find((s) => s.id === suggestionId);
  if (!suggestion) {
    return (
      <Placeholder
        icon={Sparkles}
        title="No campaign selected"
        body="Pick a suggestion in Marketing to preview it here."
        backLabel="Back to Marketing"
        onBack={onBack}
      />
    );
  }
  const p = suggestion.parsed;
  return (
    <>
      {/* Callout banner · honesty */}
      <div
        style={{
          padding: "12px 14px",
          background: T.amberSoft,
          border: `1px solid ${T.amberMid}`,
          borderRadius: G.radiusS,
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        <Clock size={15} strokeWidth={2} style={{ color: T.amber, flexShrink: 0, marginTop: 2 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.amber, lineHeight: 1.2 }}>Preview only</div>
          <div style={{ marginTop: 4, fontSize: 11.5, color: T.textSec, lineHeight: 1.5 }}>
            {COPY.campaignReview.calloutBanner}
          </div>
        </div>
      </div>

      {/* Owner request */}
      <div
        style={{
          padding: "16px 18px",
          background: T.surface,
          border: `1px solid ${T.borderMed}`,
          borderRadius: G.radius,
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, color: T.textMute, textTransform: "uppercase" as const, lineHeight: 1 }}>
          Your request
        </div>
        <div style={{ marginTop: 8, fontSize: 15, color: T.textPri, lineHeight: 1.4, fontWeight: 500 }}>
          &ldquo;{p.ownerRequest}&rdquo;
        </div>
      </div>

      {/* Structured breakdown */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <SectionGroupTitle>NEX understands</SectionGroupTitle>
        <ReviewRow k="Product"      v={p.productHint} />
        <ReviewRow k="Market"       v={p.marketLabel} highlight={p.marketCountryCode === "JP" ? "first-class" : undefined} />
        <ReviewRow k="Audience"     v={p.audienceLabel} />
        <ReviewRow k="Campaign"     v={campaignTypeLabel(p.campaignType)} />
        <ReviewRow k="Quantity"     v={p.quantityHint ? `${p.quantityHint} introductions` : "(NEX chooses)"} />
        <ReviewRow k="Channels"     v={p.channelsHint.length ? p.channelsHint.join(" · ") : "(reporting only)"} />
      </div>

      {/* What happens next */}
      <div
        style={{
          padding: "16px 18px",
          background: T.surfaceLo,
          border: `1px solid ${T.borderMed}`,
          borderRadius: G.radius,
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: T.textPri, lineHeight: 1.2 }}>
          {COPY.campaignReview.nextTitle}
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: T.textDim, lineHeight: 1.55 }}>
          {COPY.campaignReview.nextText}
        </div>
      </div>

      {/* Action row */}
      <div
        style={{
          display: "flex",
          gap: 10,
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            appearance: "none",
            flex: 1,
            height: 44,
            borderRadius: 12,
            background: "transparent",
            border: `1px solid ${T.borderMed}`,
            color: T.textSec,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 0.2,
            cursor: "pointer",
            boxSizing: "border-box",
          }}
        >
          {COPY.campaignReview.cancelLabel}
        </button>
        <button
          type="button"
          onClick={onSaveDraft}
          style={{
            appearance: "none",
            flex: 2,
            height: 44,
            borderRadius: 12,
            background: T.orangeSoft,
            border: `1px solid ${T.orangeMid}`,
            color: T.orange,
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: 0.2,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            boxSizing: "border-box",
          }}
        >
          {COPY.campaignReview.saveDraftLabel}
          <Check size={15} strokeWidth={2.4} />
        </button>
      </div>
    </>
  );
}

function ReviewRow({
  k, v, highlight,
}: {
  k: string;
  v: string;
  highlight?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        background: T.surfaceLo,
        border: `1px solid ${T.border}`,
        borderRadius: G.radiusS,
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      <div style={{ flex: "0 0 92px", fontSize: 11, fontWeight: 700, color: T.textMute, letterSpacing: 0.4, textTransform: "uppercase" as const }}>
        {k}
      </div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: T.textPri, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis" }}>
        {v}
      </div>
      {highlight && (
        <span
          style={{
            flexShrink: 0,
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 999,
            color: T.orange,
            background: T.orangeSoft,
            border: `1px solid ${T.orangeMid}`,
            letterSpacing: 0.4,
            textTransform: "uppercase" as const,
          }}
        >
          {highlight}
        </span>
      )}
    </div>
  );
}

function campaignTypeLabel(k: "LOCAL" | "NATIONAL" | "INTERNATIONAL_B2B"): string {
  switch (k) {
    case "LOCAL":              return "Local · people nearby";
    case "NATIONAL":           return "National · people across country";
    case "INTERNATIONAL_B2B":  return "International · qualified B2B buyers";
  }
}

// ── Customer / Quote empty screens ────────────────────────────────────

function CustomersEmptyScreen({ onBack }: { onBack: () => void }) {
  return (
    <Placeholder
      icon={Users}
      title={COPY.customersEmpty.title}
      body={COPY.customersEmpty.body}
      backLabel="Back to Business"
      onBack={onBack}
      coming={COPY.customersEmpty.coming}
    />
  );
}

function QuotesEmptyScreen({ onBack }: { onBack: () => void }) {
  return (
    <Placeholder
      icon={ScrollText}
      title={COPY.quotesEmpty.title}
      body={COPY.quotesEmpty.body}
      backLabel="Back to Business"
      onBack={onBack}
      coming={COPY.quotesEmpty.coming}
    />
  );
}

function Placeholder({
  icon: Icon, title, body, backLabel, onBack, coming, calloutTitle, calloutRows,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  title: string;
  body: string;
  backLabel: string;
  onBack: () => void;
  coming?: string;
  calloutTitle?: string;
  calloutRows?: Array<{ k: string; v: string }>;
}) {
  return (
    <>
      <div
        style={{
          padding: "20px 20px 18px",
          background: T.surface,
          border: `1px solid ${T.borderMed}`,
          borderRadius: G.radius,
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: T.orangeSoft,
            border: `1px solid ${T.orangeMid}`,
            color: T.orange,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={20} strokeWidth={2} />
        </span>
        <div style={{ fontSize: 17, fontWeight: 700, color: T.textPri, lineHeight: 1.3, letterSpacing: -0.005 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: T.textSec, lineHeight: 1.55 }}>
          {body}
        </div>
        {coming && (
          <div
            style={{
              fontSize: 11,
              color: T.amber,
              background: T.amberSoft,
              border: `1px solid ${T.amberMid}`,
              padding: "6px 10px",
              borderRadius: G.radiusS,
              alignSelf: "flex-start",
              letterSpacing: 0.2,
              fontWeight: 600,
            }}
          >
            {coming}
          </div>
        )}
      </div>

      {calloutTitle && calloutRows && (
        <div
          style={{
            padding: "14px 16px",
            background: T.surfaceLo,
            border: `1px solid ${T.borderMed}`,
            borderRadius: G.radius,
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, color: T.textMute, textTransform: "uppercase" as const, lineHeight: 1 }}>
            {calloutTitle}
          </div>
          {calloutRows.map((r) => (
            <div key={r.k} style={{ display: "flex", gap: 12, alignItems: "flex-start", minWidth: 0 }}>
              <div style={{ flex: "0 0 96px", fontSize: 11, color: T.textMute, fontWeight: 600, letterSpacing: 0.3 }}>{r.k}</div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: T.textPri, lineHeight: 1.4 }}>{r.v}</div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onBack}
        style={{
          appearance: "none",
          alignSelf: "flex-start",
          padding: "10px 14px",
          borderRadius: 10,
          background: "transparent",
          border: `1px solid ${T.borderMed}`,
          color: T.textSec,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: 0.2,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          boxSizing: "border-box",
        }}
      >
        <ArrowLeft size={14} strokeWidth={2} />
        {backLabel}
      </button>
    </>
  );
}
