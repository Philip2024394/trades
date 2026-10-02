"use client";

// src/app/nex-native/business-setup/_wizard.tsx
//
// NEX Business NEX Activation · the wizard.
// Phase 2 · Rev 6 FROZEN (2026-10-02) · world-class mobile-first.
//
// Mounts the full activation flow:
//   step 0 · Welcome (one-shot per account per device)
//   step 1 · Which world is your Business NEX in?  (5 categories + "more than one")
//   step 2 · Which best describes it?              (scoped subtype grid)
//   step 3 · Anything else your Business NEX does? (optional secondary profiles)
//   step 4 · Here's what NEX prepared              (recommendation preview + "Your choice")
//   step 5 · Save your Business NEX                (confirmation)
//
// Load-bearing rules enforced here:
//   · Classification is not permission (Available anytime is a doorway).
//   · Recommendations never become hidden permissions (Option B diff on save).
//   · Owner CTA preference is captured but feasibility-checked by the engine.
//   · Draft state in localStorage; welcome-seen flag per account.

import * as React from "react";
import Image from "next/image";
import {
  BUSINESS_CATEGORIES,
  BUSINESS_CATEGORY_BLURB,
  BUSINESS_CATEGORY_LABEL,
} from "@/lib/nex-native/business/categories";
import {
  BUSINESS_SUBTYPE_LABEL,
  subtypesByCategory,
} from "@/lib/nex-native/business/subtypes";
import {
  AVAILABLE_CAPABILITIES,
  CAPABILITY_GROUP,
  CAPABILITY_LABEL,
  getRecommendedCapabilities,
} from "@/lib/nex-native/business/capabilities";
import {
  AVAILABLE_CONTENT_TYPES,
  CONTENT_TYPE_LABEL,
  getRecommendedContentTypes,
} from "@/lib/nex-native/business/content";
import {
  CURRENT_DRAFT_VERSION,
  clearAllActivationState,
  loadDraft,
  loadWelcomeSeen,
  makeEmptyDraft,
  saveDraft,
  setWelcomeSeen,
  type WizardDraft,
} from "@/lib/nex-native/business/_wizard-state";
import type {
  BusinessCategory,
  BusinessProfile,
  BusinessSubtype,
  CapabilityKey,
  ContentTypeKey,
  CtaIntent,
} from "@/lib/nex-native/business/types";
import { saveBusinessActivationAction } from "./_actions";
import { NEX, FONT_STACK, computeChipState } from "./_shared";
import { YourChoiceChip } from "./_your-choice-chip";

// =============================================================================
// Props from the server orchestrator
// =============================================================================

export interface WizardServerProps {
  accountId: string;
  /** The owner's existing profile · null for a free user activating for
   *  the first time. If present, the wizard mounts in "reconfigure" mode
   *  pre-filled from DB state. */
  existingProfile: BusinessProfile | null;
  /** Existing owner overrides · used by Step 4 to pre-fill the saved
   *  side of each chip's three-state model. Empty record if none. */
  existingCapabilityOverrides: Partial<Record<CapabilityKey, boolean>>;
  existingContentOverrides: Partial<Record<ContentTypeKey, boolean>>;
  existingCtaPreference: CtaIntent | null;
}

// =============================================================================
// Entry
// =============================================================================

export function BusinessSetupWizard(props: WizardServerProps) {
  const [celebrating, setCelebrating] = React.useState(false);
  React.useEffect(() => {
    if (new URLSearchParams(window.location.search).get("celebrate") === "1") {
      setCelebrating(true);
    }
  }, []);
  const [draft, setDraft] = React.useState<WizardDraft>(() => {
    // Hydrate from localStorage draft first; fall back to DB state if the
    // business is already activated; else empty draft on step 0 or 1.
    const stored = loadDraft(props.accountId);
    if (stored) return stored;
    const empty = makeEmptyDraft();
    if (props.existingProfile) {
      empty.profile = props.existingProfile;
      empty.current_step = 5; // reconfigure lands on confirmation
      empty.cta_preference = props.existingCtaPreference;
    } else {
      empty.current_step = loadWelcomeSeen(props.accountId) ? 1 : 0;
    }
    return empty;
  });

  // Persist draft on every change (localStorage write is cheap).
  React.useEffect(() => {
    saveDraft(props.accountId, draft);
  }, [props.accountId, draft]);

  const update = React.useCallback(
    (partial: Partial<WizardDraft>) => {
      setDraft((prev) => ({ ...prev, ...partial }));
    },
    [],
  );

  const goTo = React.useCallback(
    (step: WizardDraft["current_step"]) => {
      setDraft((prev) => ({ ...prev, current_step: step }));
    },
    [],
  );

  const subtypes: readonly BusinessSubtype[] = draft.profile
    ? [draft.profile.primary.subtype, ...draft.profile.secondary.map((s) => s.subtype)]
    : [];

  return (
    <>
      <GlobalStyle />
      <main
        data-nex-wizard-root
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily: FONT_STACK,
          padding: "16px 20px 48px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <GlowBackdrop />
        <div style={{ position: "relative", maxWidth: 420, margin: "0 auto" }}>
          <WizardHeader
            step={draft.current_step}
            onBack={draft.current_step > 1 ? () => goTo(prevStep(draft.current_step)) : undefined}
          />

          {draft.current_step === 0 && (
            <WelcomeStep
              onContinue={() => {
                setWelcomeSeen(props.accountId);
                goTo(1);
              }}
            />
          )}

          {draft.current_step === 1 && (
            <Step1Category
              draft={draft}
              onPick={(category) => {
                // Preserve subtype only if same category; else wipe to null.
                const sameCategory =
                  draft.profile?.primary &&
                  (draft.profile.primary.category === category);
                update({
                  profile: sameCategory
                    ? draft.profile
                    : null,
                });
                goTo(sameCategory ? 2 : 1.5 as unknown as 1);
                // Actually, when category changes, immediately open step 2 with the new category.
                goTo(2);
                // Hold the chosen category in a temporary profile shell:
                setDraft((prev) => ({
                  ...prev,
                  profile: sameCategory
                    ? prev.profile
                    : { primary: { category, subtype: null as unknown as BusinessSubtype }, secondary: [] },
                  current_step: 2,
                }));
              }}
            />
          )}

          {draft.current_step === 2 && draft.profile && (
            <Step2Subtype
              category={draft.profile.primary.category}
              currentSubtype={draft.profile.primary.subtype}
              onPick={(subtype) => {
                setDraft((prev) => ({
                  ...prev,
                  profile: prev.profile
                    ? {
                        ...prev.profile,
                        primary: { category: prev.profile.primary.category, subtype },
                      }
                    : null,
                  current_step: 3,
                }));
              }}
            />
          )}

          {draft.current_step === 3 && draft.profile && draft.profile.primary.subtype && (
            <Step3Secondary
              profile={draft.profile}
              onChange={(p) => update({ profile: p })}
              onNext={() => goTo(4)}
            />
          )}

          {draft.current_step === 4 && draft.profile && draft.profile.primary.subtype && (
            <Step4Preview
              draft={draft}
              subtypes={subtypes}
              existingCapabilityOverrides={props.existingCapabilityOverrides}
              existingContentOverrides={props.existingContentOverrides}
              onToggleCapability={(key, next) => {
                setDraft((prev) => {
                  const toggles = { ...prev.capability_wizard_toggle };
                  // Record as explicit wizard change
                  toggles[key] = next;
                  return { ...prev, capability_wizard_toggle: toggles };
                });
              }}
              onToggleContent={(key, next) => {
                setDraft((prev) => {
                  const toggles = { ...prev.content_wizard_toggle };
                  toggles[key] = next;
                  return { ...prev, content_wizard_toggle: toggles };
                });
              }}
              onNext={() => goTo(5)}
            />
          )}

          {draft.current_step === 5 && draft.profile && draft.profile.primary.subtype && !celebrating && (
            <Step5Confirm
              draft={draft}
              subtypes={subtypes}
              onSaved={() => {
                clearAllActivationState(props.accountId);
                setCelebrating(true);
              }}
              onEdit={() => goTo(4)}
            />
          )}

          {celebrating && <Step6Celebration />}
        </div>
      </main>
    </>
  );
}

function prevStep(step: WizardDraft["current_step"]): WizardDraft["current_step"] {
  if (step === 2) return 1;
  if (step === 3) return 2;
  if (step === 4) return 3;
  if (step === 5) return 4;
  return 1;
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
      [data-nex-wizard-root] * { box-sizing: border-box; }
      [data-nex-tile]:focus-visible { outline: 2px solid ${NEX.cyan}; outline-offset: 2px; }
      @keyframes nex-fade-up {
        0%   { opacity: 0; transform: translateY(6px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      [data-nex-wizard-step] {
        animation: nex-fade-up 220ms ease-out;
      }
      @media (prefers-reduced-motion: reduce) {
        [data-nex-wizard-step] { animation: none; }
      }
    `}</style>
  );
}

function GlowBackdrop() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(60% 40% at 50% 0%, rgba(0,175,255,0.10), transparent 72%)",
        pointerEvents: "none",
      }}
    />
  );
}

function WizardHeader({
  step,
  onBack,
}: {
  step: WizardDraft["current_step"];
  onBack?: () => void;
}) {
  const totalSteps = 5;
  const stepNumber = step === 0 ? null : Math.min(step, totalSteps);
  return (
    <header
      style={{
        paddingTop: "max(env(safe-area-inset-top, 0px), 8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: `1px solid ${NEX.cyanSoft}`,
              background: "transparent",
              color: NEX.cyan,
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ‹
          </button>
        ) : (
          <div style={{ width: 36, height: 36 }} />
        )}
        <div
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: 2,
            fontSize: 20,
            lineHeight: 1,
            letterSpacing: "0.08em",
            fontWeight: 600,
          }}
        >
          <span style={{ color: NEX.textPrimary }}>NE</span>
          <span style={{ color: NEX.orange }}>X</span>
        </div>
      </div>
      {stepNumber && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "4px 11px",
            borderRadius: 999,
            background: "rgba(0,175,255,0.08)",
            border: `1px solid ${NEX.cyanSoft}`,
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: NEX.cyan,
          }}
        >
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {String(stepNumber).padStart(2, "0")} / {String(totalSteps).padStart(2, "0")}
          </span>
          <span aria-hidden style={{ width: 3, height: 3, borderRadius: "50%", background: NEX.cyanSoft }} />
          <span>Business NEX</span>
        </div>
      )}
    </header>
  );
}

function GuidingPrinciple() {
  return (
    <p
      style={{
        marginTop: 16,
        textAlign: "center",
        fontSize: 11,
        color: NEX.textSecondary,
        lineHeight: 1.55,
        padding: "0 10px",
      }}
    >
      Onboarding is configuration, not classification. You can turn anything on at any time.
    </p>
  );
}

// =============================================================================
// Step 0 · Welcome
// =============================================================================

function WelcomeStep({ onContinue }: { onContinue: () => void }) {
  return (
    <section data-nex-wizard-step style={{ marginTop: 28, textAlign: "center" }}>
      <Image
        src="/nex-native/join-nex-business.png"
        alt="Join NEX Business"
        width={160}
        height={160}
        priority
        unoptimized
        style={{
          display: "block",
          margin: "0 auto",
          width: 160,
          height: "auto",
        }}
      />
      <div
        style={{
          marginTop: 16,
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "3px 10px",
          borderRadius: 999,
          background: `${NEX.orange}18`,
          border: `1px solid ${NEX.orange}66`,
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontWeight: 700,
          color: NEX.orange,
        }}
      >
        Activation
      </div>
      <h1
        style={{
          margin: "12px 0 0",
          fontSize: 26,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          lineHeight: 1.2,
        }}
      >
        Join <span style={{ color: NEX.cyan }}>NEX Business</span>
      </h1>
      <p
        style={{
          margin: "12px auto 0",
          maxWidth: 340,
          fontSize: 13,
          lineHeight: 1.55,
          color: NEX.textSecondary,
        }}
      >
        The world is waiting — fastest growing business network.
      </p>

      <ul
        style={{
          margin: "22px auto 0",
          padding: 0,
          listStyle: "none",
          display: "grid",
          gap: 10,
          maxWidth: 360,
          textAlign: "left",
        }}
      >
        <WelcomePoint>
          <strong style={{ display: "block", fontWeight: 700, fontSize: 13.5, lineHeight: 1.2 }}>Your Business. Your World.</strong>
          <span style={{ display: "block", lineHeight: 1.25 }}>Any business, any idea, any direction.</span>
          <span style={{ display: "block", lineHeight: 1.25 }}>Café, villa, trade, service, shop — build your NEX around what you do.</span>
          <span style={{ display: "block", lineHeight: 1.25 }}>Or around whatever comes next.</span>
        </WelcomePoint>
        <WelcomePoint>
          <strong style={{ display: "block", fontWeight: 700, fontSize: 13.5, lineHeight: 1.2 }}>Change Your Mind. Never Start Over.</strong>
          <span style={{ display: "block", lineHeight: 1.25 }}>Switch business types whenever you like.</span>
          <span style={{ display: "block", lineHeight: 1.25 }}>Everything you create stays yours.</span>
          <span style={{ display: "block", lineHeight: 1.25 }}>Nothing gets deleted when your plans change.</span>
        </WelcomePoint>
        <WelcomePoint>
          <strong style={{ display: "block", fontWeight: 700, fontSize: 13.5, lineHeight: 1.2 }}>Your Data. Your Friends. Untouched.</strong>
          <span style={{ display: "block", lineHeight: 1.25 }}>Your chats, connections and memories stay where they belong.</span>
          <span style={{ display: "block", lineHeight: 1.25 }}>Your business grows alongside — never on top.</span>
          <span style={{ display: "block", lineHeight: 1.25 }}>Personal world, untouched.</span>
        </WelcomePoint>
      </ul>

      <button
        type="button"
        onClick={onContinue}
        style={{
          marginTop: 26,
          width: "100%",
          minHeight: 52,
          background: "transparent",
          color: NEX.orange,
          border: `1px solid ${NEX.orange}`,
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.20em",
          textTransform: "uppercase",
          cursor: "pointer",
          fontFamily: FONT_STACK,
        }}
      >
        Let&apos;s go →
      </button>
    </section>
  );
}

function WelcomePoint({ children }: { children: React.ReactNode }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 10,
        background: NEX.fieldBg,
        border: `1px solid ${NEX.cyanSoft}`,
        fontSize: 12.5,
        color: NEX.textPrimary,
        lineHeight: 1.5,
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          marginTop: 2,
          color: NEX.cyan,
          fontWeight: 800,
          fontSize: 14,
          lineHeight: 1,
        }}
      >
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

// =============================================================================
// Step 1 · Category
// =============================================================================

function Step1Category({
  draft,
  onPick,
}: {
  draft: WizardDraft;
  onPick: (category: BusinessCategory) => void;
}) {
  const currentCategory = draft.profile?.primary.category ?? null;
  return (
    <section data-nex-wizard-step style={{ marginTop: 20 }}>
      <h1
        style={{
          margin: 0,
          fontSize: 24,
          fontWeight: 500,
          letterSpacing: "-0.005em",
          lineHeight: 1.25,
          textAlign: "center",
        }}
      >
        Which world is your <span style={{ color: NEX.cyan }}>Business NEX</span> in?
      </h1>
      <GuidingPrinciple />

      <div style={{ marginTop: 20, display: "grid", gap: 10 }}>
        {BUSINESS_CATEGORIES.map((cat) => (
          <CategoryTile
            key={cat}
            category={cat}
            isSelected={currentCategory === cat}
            onPick={() => onPick(cat)}
          />
        ))}
      </div>
    </section>
  );
}

function CategoryTile({
  category,
  isSelected,
  onPick,
}: {
  category: BusinessCategory;
  isSelected: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      data-nex-tile
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        minHeight: 72,
        padding: "14px 16px",
        background: NEX.panel,
        border: `1px solid ${isSelected ? NEX.cyan : NEX.cyanSoft}`,
        boxShadow: isSelected
          ? `0 0 0 1px ${NEX.cyan}, 0 10px 24px rgba(0,175,255,0.14)`
          : "0 10px 24px rgba(0,0,0,0.3)",
        borderRadius: 12,
        textAlign: "left",
        cursor: "pointer",
        color: NEX.textPrimary,
        fontFamily: FONT_STACK,
      }}
    >
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 44,
          height: 44,
          borderRadius: 10,
          background: NEX.cyanFaint,
          border: `1px solid ${NEX.cyanSoft}`,
          display: "grid",
          placeItems: "center",
          fontSize: 22,
          lineHeight: 1,
        }}
      >
        {CATEGORY_GLYPH[category]}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.16em",
            color: NEX.cyan,
            textTransform: "uppercase",
            marginBottom: 2,
          }}
        >
          Category
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: NEX.textPrimary }}>
          {BUSINESS_CATEGORY_LABEL[category]}
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 11.5,
            color: NEX.textSecondary,
            lineHeight: 1.4,
          }}
        >
          {BUSINESS_CATEGORY_BLURB[category]}
        </div>
      </div>
      <div aria-hidden style={{ flexShrink: 0, color: NEX.orange, fontSize: 20 }}>
        →
      </div>
    </button>
  );
}

const CATEGORY_GLYPH: Record<BusinessCategory, string> = {
  food:          "🍲",
  accommodation: "🏨",
  property:      "🏘",
  products:      "📦",
  services:      "🧰",
};

// =============================================================================
// Step 2 · Subtype
// =============================================================================

function Step2Subtype({
  category,
  currentSubtype,
  onPick,
}: {
  category: BusinessCategory;
  currentSubtype: BusinessSubtype | null;
  onPick: (s: BusinessSubtype) => void;
}) {
  const subtypes = subtypesByCategory(category);
  return (
    <section data-nex-wizard-step style={{ marginTop: 20 }}>
      <h1
        style={{
          margin: 0,
          fontSize: 24,
          fontWeight: 500,
          letterSpacing: "-0.005em",
          lineHeight: 1.25,
          textAlign: "center",
        }}
      >
        Which best describes your{" "}
        <span style={{ color: NEX.cyan }}>{BUSINESS_CATEGORY_LABEL[category]}</span>?
      </h1>
      <p
        style={{
          marginTop: 10,
          fontSize: 12.5,
          color: NEX.textSecondary,
          textAlign: "center",
          lineHeight: 1.55,
          padding: "0 10px",
        }}
      >
        This picks what we start you with. You can turn anything on later.
      </p>

      <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
        {subtypes.map((st) => (
          <SubtypeCard
            key={st}
            subtype={st}
            isSelected={currentSubtype === st}
            onPick={() => onPick(st)}
          />
        ))}
      </div>
    </section>
  );
}

function SubtypeCard({
  subtype,
  isSelected,
  onPick,
}: {
  subtype: BusinessSubtype;
  isSelected: boolean;
  onPick: () => void;
}) {
  const recCaps = getRecommendedCapabilities([subtype]).slice(0, 4);
  const recContent = getRecommendedContentTypes([subtype]).slice(0, 3);
  const labels = [
    ...recContent.map((c) => CONTENT_TYPE_LABEL[c]),
    ...recCaps.map((c) => CAPABILITY_LABEL[c]),
  ];
  const sentence =
    labels.length === 0
      ? ""
      : labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;

  return (
    <button
      type="button"
      onClick={onPick}
      data-nex-tile
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        width: "100%",
        padding: "14px 16px",
        background: NEX.panel,
        border: `1px solid ${isSelected ? NEX.cyan : NEX.cyanSoft}`,
        boxShadow: isSelected
          ? `0 0 0 1px ${NEX.cyan}, 0 10px 24px rgba(0,175,255,0.14)`
          : "0 10px 24px rgba(0,0,0,0.3)",
        borderRadius: 12,
        cursor: "pointer",
        textAlign: "left",
        color: NEX.textPrimary,
        fontFamily: FONT_STACK,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: NEX.textPrimary, lineHeight: 1.2 }}>
          {BUSINESS_SUBTYPE_LABEL[subtype]}
        </div>
        <div style={{ marginTop: 4, fontSize: 11.5, color: NEX.textSecondary, lineHeight: 1.4 }}>
          {sentence}.
        </div>
      </div>
      <div aria-hidden style={{ color: NEX.orange, fontSize: 20, flexShrink: 0 }}>
        →
      </div>
    </button>
  );
}

// =============================================================================
// Step 3 · Secondary profiles
// =============================================================================

function Step3Secondary({
  profile,
  onChange,
  onNext,
}: {
  profile: BusinessProfile;
  onChange: (p: BusinessProfile) => void;
  onNext: () => void;
}) {
  const [addMode, setAddMode] = React.useState<null | { category: BusinessCategory | null }>(null);

  const addSecondary = (category: BusinessCategory, subtype: BusinessSubtype) => {
    onChange({
      ...profile,
      secondary: [...profile.secondary, { category, subtype }],
    });
    setAddMode(null);
  };
  const removeSecondary = (idx: number) => {
    onChange({
      ...profile,
      secondary: profile.secondary.filter((_, i) => i !== idx),
    });
  };

  return (
    <section data-nex-wizard-step style={{ marginTop: 20 }}>
      <h1
        style={{
          margin: 0,
          fontSize: 24,
          fontWeight: 500,
          letterSpacing: "-0.005em",
          lineHeight: 1.25,
          textAlign: "center",
        }}
      >
        Anything <span style={{ color: NEX.cyan }}>else</span> your Business NEX does?
      </h1>
      <p
        style={{
          marginTop: 10,
          fontSize: 12.5,
          color: NEX.textSecondary,
          textAlign: "center",
          lineHeight: 1.55,
          padding: "0 10px",
        }}
      >
        Optional. Add anything that genuinely runs alongside your main business.
      </p>

      <div style={{ marginTop: 20, display: "grid", gap: 10 }}>
        {profile.secondary.map((s, idx) => (
          <div
            key={`${s.subtype}-${idx}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "12px 14px",
              background: NEX.panel,
              border: `1px solid ${NEX.cyanSoft}`,
              borderRadius: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: NEX.cyan,
                  fontWeight: 700,
                  marginBottom: 2,
                }}
              >
                Also · {BUSINESS_CATEGORY_LABEL[s.category]}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: NEX.textPrimary }}>
                {BUSINESS_SUBTYPE_LABEL[s.subtype]}
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeSecondary(idx)}
              aria-label={`Remove ${BUSINESS_SUBTYPE_LABEL[s.subtype]}`}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: `1px solid ${NEX.destructive}66`,
                background: "transparent",
                color: NEX.destructive,
                cursor: "pointer",
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        ))}

        {addMode === null && (
          <button
            type="button"
            onClick={() => setAddMode({ category: null })}
            style={{
              padding: 14,
              background: "transparent",
              border: `1px dashed ${NEX.cyanSoft}`,
              borderRadius: 12,
              color: NEX.cyan,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.04em",
              cursor: "pointer",
              fontFamily: FONT_STACK,
            }}
          >
            + Add another
          </button>
        )}

        {addMode !== null && (
          <AddSecondaryPicker
            onCancel={() => setAddMode(null)}
            onPick={(c, s) => addSecondary(c, s)}
          />
        )}

        <PreservationCopy visible={profile.secondary.length > 0} />
      </div>

      <button
        type="button"
        onClick={onNext}
        style={{
          marginTop: 22,
          width: "100%",
          minHeight: 52,
          background: "transparent",
          color: NEX.orange,
          border: `1px solid ${NEX.orange}`,
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.20em",
          textTransform: "uppercase",
          cursor: "pointer",
          fontFamily: FONT_STACK,
        }}
      >
        Continue →
      </button>
    </section>
  );
}

function AddSecondaryPicker({
  onCancel,
  onPick,
}: {
  onCancel: () => void;
  onPick: (c: BusinessCategory, s: BusinessSubtype) => void;
}) {
  const [category, setCategory] = React.useState<BusinessCategory | null>(null);
  return (
    <div
      style={{
        padding: 14,
        background: NEX.panel,
        border: `1px solid ${NEX.cyanSoft}`,
        borderRadius: 12,
      }}
    >
      {!category ? (
        <>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: NEX.cyan,
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            Pick a category
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {BUSINESS_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                style={{
                  padding: "10px 12px",
                  background: NEX.fieldBg,
                  border: `1px solid ${NEX.cyanSoft}`,
                  borderRadius: 10,
                  color: NEX.textPrimary,
                  fontSize: 13,
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: FONT_STACK,
                }}
              >
                {CATEGORY_GLYPH[cat]}  {BUSINESS_CATEGORY_LABEL[cat]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onCancel}
            style={{
              marginTop: 10,
              padding: "6px 12px",
              background: "transparent",
              border: `1px solid ${NEX.cyanSoft}`,
              borderRadius: 999,
              color: NEX.textSecondary,
              fontSize: 11,
              cursor: "pointer",
              fontFamily: FONT_STACK,
            }}
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: NEX.cyan,
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            Pick a subtype in {BUSINESS_CATEGORY_LABEL[category]}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {subtypesByCategory(category).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => onPick(category, st)}
                style={{
                  padding: "10px 12px",
                  background: NEX.fieldBg,
                  border: `1px solid ${NEX.cyanSoft}`,
                  borderRadius: 10,
                  color: NEX.textPrimary,
                  fontSize: 13,
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: FONT_STACK,
                }}
              >
                {BUSINESS_SUBTYPE_LABEL[st]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setCategory(null)}
            style={{
              marginTop: 10,
              padding: "6px 12px",
              background: "transparent",
              border: `1px solid ${NEX.cyanSoft}`,
              borderRadius: 999,
              color: NEX.textSecondary,
              fontSize: 11,
              cursor: "pointer",
              fontFamily: FONT_STACK,
            }}
          >
            ‹ Back
          </button>
        </>
      )}
    </div>
  );
}

function PreservationCopy({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        background: "rgba(0, 175, 255, 0.06)",
        border: `1px dashed ${NEX.cyanSoft}`,
        fontSize: 11,
        color: NEX.textSecondary,
        lineHeight: 1.5,
      }}
    >
      Removing a secondary profile only changes what NEX recommends. It never deletes or hides your existing content.
    </div>
  );
}

// =============================================================================
// Step 4 · Recommendation preview + Your-choice chips
// =============================================================================

function Step4Preview({
  draft,
  subtypes,
  existingCapabilityOverrides,
  existingContentOverrides,
  onToggleCapability,
  onToggleContent,
  onNext,
}: {
  draft: WizardDraft;
  subtypes: readonly BusinessSubtype[];
  existingCapabilityOverrides: Partial<Record<CapabilityKey, boolean>>;
  existingContentOverrides: Partial<Record<ContentTypeKey, boolean>>;
  onToggleCapability: (k: CapabilityKey, next: boolean) => void;
  onToggleContent: (k: ContentTypeKey, next: boolean) => void;
  onNext: () => void;
}) {
  const recCapabilities = React.useMemo(
    () => new Set(getRecommendedCapabilities(subtypes)),
    [subtypes],
  );
  const recContent = React.useMemo(
    () => new Set(getRecommendedContentTypes(subtypes)),
    [subtypes],
  );

  const changedCount = React.useMemo(() => {
    let n = 0;
    for (const [k, v] of Object.entries(draft.capability_wizard_toggle)) {
      const isRec = recCapabilities.has(k as CapabilityKey);
      if ((v && !isRec) || (!v && isRec)) n++;
    }
    for (const [k, v] of Object.entries(draft.content_wizard_toggle)) {
      const isRec = recContent.has(k as ContentTypeKey);
      if ((v && !isRec) || (!v && isRec)) n++;
    }
    return n;
  }, [draft, recCapabilities, recContent]);

  const [showAvailable, setShowAvailable] = React.useState(false);

  // "Prepared for you" is the union of (recommended) ∪ (any key the wizard
  // has touched this session) ∪ (any key with a saved override). This
  // keeps changed/removed items visible in the main section so the owner
  // sees their activity.
  const preparedContentKeys = React.useMemo(() => {
    const s = new Set<ContentTypeKey>(recContent);
    Object.keys(draft.content_wizard_toggle).forEach((k) => s.add(k as ContentTypeKey));
    Object.keys(existingContentOverrides).forEach((k) => s.add(k as ContentTypeKey));
    return Array.from(s);
  }, [recContent, draft.content_wizard_toggle, existingContentOverrides]);

  const preparedCapabilityKeys = React.useMemo(() => {
    const s = new Set<CapabilityKey>(recCapabilities);
    Object.keys(draft.capability_wizard_toggle).forEach((k) => s.add(k as CapabilityKey));
    Object.keys(existingCapabilityOverrides).forEach((k) => s.add(k as CapabilityKey));
    return Array.from(s);
  }, [recCapabilities, draft.capability_wizard_toggle, existingCapabilityOverrides]);

  const availableContentNotPrepared = AVAILABLE_CONTENT_TYPES.filter(
    (k) => !preparedContentKeys.includes(k),
  );
  const availableCapabilitiesNotPrepared = AVAILABLE_CAPABILITIES.filter(
    (k) => !preparedCapabilityKeys.includes(k),
  );

  return (
    <section data-nex-wizard-step style={{ marginTop: 20 }}>
      <h1
        style={{
          margin: 0,
          fontSize: 24,
          fontWeight: 500,
          letterSpacing: "-0.005em",
          lineHeight: 1.25,
          textAlign: "center",
        }}
      >
        Here&apos;s what <span style={{ color: NEX.cyan }}>NEX prepared</span>
      </h1>
      <p
        style={{
          marginTop: 10,
          fontSize: 12.5,
          color: NEX.textSecondary,
          textAlign: "center",
          lineHeight: 1.55,
          padding: "0 10px",
        }}
      >
        Everything NEX can do is available to every Business NEX. These are just what we start you with.
      </p>

      {changedCount > 0 && (
        <div
          style={{
            marginTop: 14,
            padding: "8px 12px",
            background: `${NEX.cyan}10`,
            border: `1px solid ${NEX.cyanSoft}`,
            borderRadius: 999,
            fontSize: 11,
            color: NEX.cyan,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textAlign: "center",
          }}
        >
          You changed <strong>{changedCount}</strong> {changedCount === 1 ? "thing" : "things"} · everything else is NEX&apos;s recommendation
        </div>
      )}

      {/* Section A · Prepared for you */}
      <PreviewSection title="Prepared for you · Content">
        <ToggleList>
          {preparedContentKeys.map((k) => (
            <ToggleRow
              key={k}
              label={CONTENT_TYPE_LABEL[k]}
              recommended={recContent.has(k)}
              savedOverride={existingContentOverrides[k]}
              wizardToggle={draft.content_wizard_toggle[k]}
              onToggle={(next) => onToggleContent(k, next)}
            />
          ))}
        </ToggleList>
      </PreviewSection>

      <PreviewSection title="Prepared for you · Things your business can do">
        {groupCapabilities(preparedCapabilityKeys).map(({ group, keys }) => (
          <div key={group} style={{ marginBottom: 10 }}>
            <div
              style={{
                fontSize: 9,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: NEX.textMute,
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              {group}
            </div>
            <ToggleList>
              {keys.map((k) => (
                <ToggleRow
                  key={k}
                  label={CAPABILITY_LABEL[k]}
                  recommended={recCapabilities.has(k)}
                  savedOverride={existingCapabilityOverrides[k]}
                  wizardToggle={draft.capability_wizard_toggle[k]}
                  onToggle={(next) => onToggleCapability(k, next)}
                />
              ))}
            </ToggleList>
          </div>
        ))}
      </PreviewSection>

      {/* Section B · Available anytime · the universal catalog door */}
      <div style={{ marginTop: 22 }}>
        <button
          type="button"
          onClick={() => setShowAvailable((v) => !v)}
          aria-expanded={showAvailable}
          style={{
            width: "100%",
            padding: "14px 16px",
            background: NEX.panel,
            border: `1px solid ${NEX.cyanSoft}`,
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            cursor: "pointer",
            fontFamily: FONT_STACK,
          }}
        >
          <div style={{ textAlign: "left", minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: NEX.orange,
                fontWeight: 700,
              }}
            >
              Available anytime
            </div>
            <div style={{ marginTop: 2, fontSize: 13, color: NEX.textPrimary }}>
              Everything NEX can do · turn on anything
            </div>
          </div>
          <span aria-hidden style={{ color: NEX.orange, fontSize: 18 }}>
            {showAvailable ? "–" : "+"}
          </span>
        </button>

        {showAvailable && (
          <div
            style={{
              marginTop: 10,
              padding: 14,
              background: NEX.panelSoft,
              border: `1px solid ${NEX.cyanSoft}`,
              borderRadius: 12,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: NEX.textSecondary,
                lineHeight: 1.5,
                marginBottom: 12,
              }}
            >
              These aren&apos;t off-limits for your business — they&apos;re just not what we start you with.
              Turn anything on and it joins your setup.
            </div>

            {availableContentNotPrepared.length > 0 && (
              <>
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: NEX.textMute,
                    fontWeight: 700,
                    marginBottom: 6,
                  }}
                >
                  Content
                </div>
                <ToggleList>
                  {availableContentNotPrepared.map((k) => (
                    <ToggleRow
                      key={k}
                      label={CONTENT_TYPE_LABEL[k]}
                      recommended={false}
                      savedOverride={existingContentOverrides[k]}
                      wizardToggle={draft.content_wizard_toggle[k]}
                      onToggle={(next) => onToggleContent(k, next)}
                    />
                  ))}
                </ToggleList>
              </>
            )}

            {availableCapabilitiesNotPrepared.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: NEX.textMute,
                    fontWeight: 700,
                    marginBottom: 6,
                  }}
                >
                  Capabilities
                </div>
                <ToggleList>
                  {availableCapabilitiesNotPrepared.map((k) => (
                    <ToggleRow
                      key={k}
                      label={CAPABILITY_LABEL[k]}
                      recommended={false}
                      savedOverride={existingCapabilityOverrides[k]}
                      wizardToggle={draft.capability_wizard_toggle[k]}
                      onToggle={(next) => onToggleCapability(k, next)}
                    />
                  ))}
                </ToggleList>
              </div>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onNext}
        style={{
          marginTop: 22,
          width: "100%",
          minHeight: 52,
          background: "transparent",
          color: NEX.orange,
          border: `1px solid ${NEX.orange}`,
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.20em",
          textTransform: "uppercase",
          cursor: "pointer",
          fontFamily: FONT_STACK,
        }}
      >
        Review and save →
      </button>
    </section>
  );
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 18,
        padding: 14,
        background: NEX.panel,
        border: `1px solid ${NEX.cyanSoft}`,
        borderRadius: 12,
      }}
    >
      <div
        style={{
          fontSize: 10,
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

function ToggleList({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gap: 8 }}>{children}</div>;
}

function ToggleRow({
  label,
  recommended,
  savedOverride,
  wizardToggle,
  onToggle,
}: {
  label: string;
  recommended: boolean;
  savedOverride: boolean | undefined;
  wizardToggle: boolean | undefined;
  onToggle: (next: boolean) => void;
}) {
  const effective = wizardToggle !== undefined ? wizardToggle : savedOverride !== undefined ? savedOverride : recommended;
  const chip = computeChipState({ recommended, saved_override: savedOverride, wizard_toggle: wizardToggle });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: NEX.fieldBg,
        border: `1px solid ${NEX.cyanSoft}`,
        borderRadius: 10,
      }}
    >
      <button
        type="button"
        onClick={() => onToggle(!effective)}
        role="switch"
        aria-checked={effective}
        aria-label={`Toggle ${label}`}
        style={{
          flexShrink: 0,
          width: 36,
          height: 22,
          borderRadius: 999,
          background: effective ? NEX.cyan : "rgba(255,255,255,0.08)",
          border: `1px solid ${effective ? NEX.cyan : NEX.cyanSoft}`,
          position: "relative",
          cursor: "pointer",
          padding: 0,
          transition: "background 160ms ease, border-color 160ms ease",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 2,
            left: effective ? 16 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: effective ? NEX.bg : "#fff",
            transition: "left 160ms ease",
          }}
        />
      </button>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            color: effective ? NEX.textPrimary : NEX.textSecondary,
            lineHeight: 1.3,
          }}
        >
          {label}
        </div>
      </div>
      <YourChoiceChip state={chip} />
    </div>
  );
}

function groupCapabilities(keys: readonly CapabilityKey[]): { group: string; keys: CapabilityKey[] }[] {
  const byGroup = new Map<string, CapabilityKey[]>();
  for (const k of keys) {
    const g = CAPABILITY_GROUP[k];
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(k);
  }
  return Array.from(byGroup, ([group, keys]) => ({ group, keys }));
}

// =============================================================================
// Step 5 · Confirm
// =============================================================================

function Step5Confirm({
  draft,
  subtypes,
  onSaved,
  onEdit,
}: {
  draft: WizardDraft;
  subtypes: readonly BusinessSubtype[];
  onSaved: () => void;
  onEdit: () => void;
}) {
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const recCapabilities = React.useMemo(
    () => new Set(getRecommendedCapabilities(subtypes)),
    [subtypes],
  );
  const recContent = React.useMemo(
    () => new Set(getRecommendedContentTypes(subtypes)),
    [subtypes],
  );

  const capOverridesToWrite: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(draft.capability_wizard_toggle)) {
    const isRec = recCapabilities.has(k as CapabilityKey);
    if ((v && !isRec) || (!v && isRec)) capOverridesToWrite[k] = v;
  }
  const contentOverridesToWrite: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(draft.content_wizard_toggle)) {
    const isRec = recContent.has(k as ContentTypeKey);
    if ((v && !isRec) || (!v && isRec)) contentOverridesToWrite[k] = v;
  }

  async function handleSave() {
    if (!draft.profile) return;
    setSaving(true);
    setError(null);
    const res = await saveBusinessActivationAction({
      profile: draft.profile,
      capability_wizard_toggle: draft.capability_wizard_toggle,
      content_wizard_toggle: draft.content_wizard_toggle,
      cta_preference: draft.cta_preference,
    });
    if (res.ok) {
      onSaved();
    } else {
      setSaving(false);
      setError(res.error?.message ?? "Save failed.");
    }
  }

  if (!draft.profile) return null;

  const totalOverrides =
    Object.keys(capOverridesToWrite).length + Object.keys(contentOverridesToWrite).length;

  return (
    <section data-nex-wizard-step style={{ marginTop: 20 }}>
      <h1
        style={{
          margin: 0,
          fontSize: 24,
          fontWeight: 500,
          letterSpacing: "-0.005em",
          lineHeight: 1.25,
          textAlign: "center",
        }}
      >
        Activate your <span style={{ color: NEX.cyan }}>Business NEX</span>
      </h1>

      {/* Who you are */}
      <SummaryPanel title="Who you are">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 9,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: NEX.cyan,
                fontWeight: 700,
              }}
            >
              Primary
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>
              {BUSINESS_CATEGORY_LABEL[draft.profile.primary.category]} ·{" "}
              {BUSINESS_SUBTYPE_LABEL[draft.profile.primary.subtype]}
            </div>
          </div>
          <button
            type="button"
            onClick={onEdit}
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              background: "transparent",
              border: `1px solid ${NEX.cyanSoft}`,
              color: NEX.cyan,
              fontSize: 10,
              cursor: "pointer",
              fontFamily: FONT_STACK,
            }}
          >
            Edit
          </button>
        </div>
        {draft.profile.secondary.length > 0 && (
          <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
            {draft.profile.secondary.map((s, i) => (
              <div
                key={`${s.subtype}-${i}`}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  background: "rgba(0,175,255,0.06)",
                  border: `1px solid ${NEX.cyanSoft}`,
                  fontSize: 12,
                  color: NEX.textPrimary,
                }}
              >
                Also · {BUSINESS_CATEGORY_LABEL[s.category]} · {BUSINESS_SUBTYPE_LABEL[s.subtype]}
              </div>
            ))}
          </div>
        )}
      </SummaryPanel>

      {/* What will be saved */}
      <SummaryPanel title="What will be saved">
        <div style={{ fontSize: 12.5, color: NEX.textSecondary, lineHeight: 1.55 }}>
          Your profile ({draft.profile.secondary.length + 1} entry{draft.profile.secondary.length > 0 ? "s" : ""}).
          {totalOverrides === 0 ? (
            <>
              {" "}No overrides — you accepted all our recommendations. If we update them, your NEX will
              update automatically.
            </>
          ) : (
            <>
              {" "}{totalOverrides} explicit choice{totalOverrides === 1 ? "" : "s"} saved as{" "}
              <span style={{ color: NEX.textPrimary }}>your overrides</span>.
            </>
          )}
        </div>
        {totalOverrides > 0 && (
          <div style={{ marginTop: 10, display: "grid", gap: 4 }}>
            {Object.entries(contentOverridesToWrite).map(([k, v]) => (
              <SavedChoiceRow
                key={`c-${k}`}
                label={CONTENT_TYPE_LABEL[k as ContentTypeKey]}
                on={v}
              />
            ))}
            {Object.entries(capOverridesToWrite).map(([k, v]) => (
              <SavedChoiceRow
                key={`cap-${k}`}
                label={CAPABILITY_LABEL[k as CapabilityKey]}
                on={v}
              />
            ))}
          </div>
        )}
      </SummaryPanel>

      {/* What stays safe */}
      <SummaryPanel title="What stays safe">
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "grid",
            gap: 6,
            fontSize: 12,
            color: NEX.textSecondary,
            lineHeight: 1.5,
          }}
        >
          <SafePoint>Changing your profile later never deletes your content.</SafePoint>
          <SafePoint>Removing a secondary profile never auto-hides your content.</SafePoint>
          <SafePoint>NEX may update recommendations over time; your explicit choices always win.</SafePoint>
        </ul>
      </SummaryPanel>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 14,
            padding: "10px 14px",
            borderRadius: 10,
            border: `1px solid ${NEX.destructive}`,
            background: `${NEX.destructive}18`,
            color: NEX.textPrimary,
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        style={{
          marginTop: 18,
          width: "100%",
          minHeight: 52,
          background: saving ? "transparent" : NEX.orange,
          color: saving ? NEX.orange : "#0B0F1A",
          border: `1px solid ${NEX.orange}`,
          borderRadius: 8,
          fontSize: 13,
          fontWeight: saving ? 600 : 800,
          letterSpacing: "0.20em",
          textTransform: "uppercase",
          cursor: saving ? "wait" : "pointer",
          fontFamily: FONT_STACK,
          transition: "background 160ms ease",
        }}
      >
        {saving ? "Activating…" : "Activate my Business NEX"}
      </button>

      <button
        type="button"
        onClick={onEdit}
        style={{
          marginTop: 10,
          width: "100%",
          padding: "10px",
          background: "transparent",
          border: "none",
          color: NEX.textSecondary,
          fontSize: 12,
          cursor: "pointer",
          fontFamily: FONT_STACK,
          textDecoration: "underline",
          textUnderlineOffset: 3,
        }}
      >
        Keep editing
      </button>
    </section>
  );
}

// =============================================================================
// Step 6 · Activated Celebration (confetti)
// =============================================================================

function Step6Celebration() {
  const CONFETTI_COUNT = 60;
  const colors = [NEX.cyan, NEX.orange, "#ffffff", "#0088CC", "#FFD166"];
  const pieces = React.useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 2.5;
        const duration = 3 + Math.random() * 2.5;
        const size = 6 + Math.random() * 7;
        const color = colors[i % colors.length];
        const rotateStart = Math.random() * 360;
        const drift = (Math.random() - 0.5) * 80;
        return { left, delay, duration, size, color, rotateStart, drift, key: i };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <section data-nex-wizard-step style={{ marginTop: 32, textAlign: "center", position: "relative" }}>
      <style>{`
        @keyframes nex-confetti-fall {
          0%   { transform: translate3d(0, -40px, 0) rotate(var(--nex-rot-start, 0deg)); opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: translate3d(var(--nex-drift, 0px), 110vh, 0) rotate(calc(var(--nex-rot-start, 0deg) + 720deg)); opacity: 1; }
        }
      `}</style>

      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          overflow: "hidden",
          zIndex: 50,
        }}
      >
        {pieces.map((p) => (
          <span
            key={p.key}
            style={{
              position: "absolute",
              top: 0,
              left: `${p.left}%`,
              width: p.size,
              height: p.size * 0.4,
              background: p.color,
              borderRadius: 2,
              animation: `nex-confetti-fall ${p.duration}s linear ${p.delay}s infinite`,
              ["--nex-rot-start" as string]: `${p.rotateStart}deg`,
              ["--nex-drift" as string]: `${p.drift}px`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      <Image
        src="/nex-native/live-on-business-nex.png"
        alt="Congratulations — you're live on Business NEX"
        width={220}
        height={220}
        priority
        unoptimized
        style={{
          position: "relative",
          display: "block",
          margin: "0 auto",
          width: 220,
          height: "auto",
        }}
      />

      <p
        style={{
          margin: "14px auto 0",
          maxWidth: 340,
          fontSize: 14,
          lineHeight: 1.5,
          color: NEX.textPrimary,
        }}
      >
        Add your first product and push it to the world.
      </p>

      <p
        style={{
          margin: "10px auto 0",
          maxWidth: 340,
          fontSize: 12.5,
          lineHeight: 1.5,
          color: NEX.textSecondary,
        }}
      >
        Six posts fill your cover beautifully — no empty tiles, no half-finished look.
      </p>

      <a
        href="/nex-native/onboarding/first-product"
        style={{
          display: "block",
          marginTop: 26,
          padding: "14px 16px",
          borderRadius: 12,
          background: `linear-gradient(135deg, ${NEX.cyan}, #0088CC)`,
          color: NEX.bg,
          fontSize: 15,
          fontWeight: 700,
          textDecoration: "none",
          boxShadow: `0 10px 24px ${NEX.cyan}55`,
          fontFamily: FONT_STACK,
        }}
      >
        Add my first product →
      </a>

      <a
        href="/nex-native/home"
        style={{
          display: "inline-block",
          marginTop: 14,
          color: NEX.textSecondary,
          fontSize: 12,
          textDecoration: "underline",
          textUnderlineOffset: 3,
          fontFamily: FONT_STACK,
        }}
      >
        Skip for now
      </a>
    </section>
  );
}

function SummaryPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 16,
        padding: 14,
        background: NEX.panel,
        border: `1px solid ${NEX.cyanSoft}`,
        borderRadius: 12,
      }}
    >
      <div
        style={{
          fontSize: 10,
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

function SavedChoiceRow({ label, on }: { label: string; on: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 8,
        background: NEX.fieldBg,
        border: `1px solid ${NEX.cyanSoft}`,
        fontSize: 12,
      }}
    >
      <span
        aria-hidden
        style={{
          color: on ? NEX.cyan : NEX.destructive,
          fontWeight: 800,
          fontSize: 12,
        }}
      >
        {on ? "✓" : "×"}
      </span>
      <span style={{ color: NEX.textPrimary }}>{label}</span>
      <span style={{ marginLeft: "auto", color: NEX.textSecondary, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        Your choice
      </span>
    </div>
  );
}

function SafePoint({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span aria-hidden style={{ color: NEX.success, marginTop: 2, fontWeight: 800 }}>✓</span>
      <span>{children}</span>
    </li>
  );
}

// Required to keep CURRENT_DRAFT_VERSION usage from being tree-shaken when
// tests import the module solely for the shell.
void CURRENT_DRAFT_VERSION;
