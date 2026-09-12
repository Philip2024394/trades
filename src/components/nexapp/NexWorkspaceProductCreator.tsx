// src/components/nexapp/NexWorkspaceProductCreator.tsx · Philip 2026-09-05
//
// NEX PRODUCT CREATOR · P0 · UI-only implementation
//
// Authorization: "AUTHORIZE PRODUCT CREATOR UI IMPLEMENTATION" (Philip
// 2026-09-05). Scope: UI + local mock state. NO DB · NO .env · NO workforce
// · NO C12 · NO backend. Mock data via `mockProductCreator.ts`. Draft
// persists to localStorage only.
//
// Composes with (design decisions LOCKED · pinned in MEMORY.md):
//   · doctrine_nex_product_service_creation_experience_2026_09_05 (parent)
//   · doctrine_nex_universal_business_product_taxonomy (Category UX)
//   · doctrine_nex_product_international_markets_country_pricing (visibility)
//   · doctrine_nex_product_international_commercial_pricing_extension (Advanced link)
//   · doctrine_nex_owner_currency_customer_display (owner-original authoritative)
//   · doctrine_nex_marketing_local_national_international_modes (Promotion link)
//   · doctrine_nex_pwa_offline_first (draft persistence · sync state)
//   · Location Intelligence (future · location field is free-text for P0)
//   · Voice orb hide rule (Philip 2026-09-05 for Products workspaces)
//
// Visual reference: Product Upload screenshot supplied 2026-09-05
//   (941×1672 · inner display ≈820×1392 · dark titanium · restrained orange
//   · green positive states · thin borders · dense but calm).
//
// Inside-out layout discipline (same rules as NexWorkspaceProducts):
//   · box-sizing: border-box everywhere
//   · width: 100% · maxWidth: 100% · minWidth: 0
//   · No 100vw · no fixed desktop widths · no viewport hacks
//   · overflow-x NEVER used to hide layout mistakes
//   · scroll region is the only vertical scroller · horizontal scroll is
//     ONLY permitted for the (future) photo strip inside its region
//
// Progressive complexity (per parent doctrine):
//   · Restaurant owner sees: Name · Category · Photo · Price · Stock · Location
//   · Exporter unlocks: Advanced Commercial Pricing · Variants · Market
//     Visibility · Promotions · Category Attributes (all opt-in disclosures)
//
// Future integration markers (clearly labeled · no fake UI):
//   · Type dispatch (Product/Service) collapsed for P0 — Product only
//   · Real image upload · Real category taxonomy · Commercial pricing UI ·
//     Market visibility UI · Promotions UI · Preview screen · Sync engine
//
// Every future integration is architecturally COMPATIBLE — this component
// does not paint into a corner.

"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Camera, ChevronDown, X, Check, MapPin,
  ShieldCheck, Barcode as BarcodeIcon, Move,
} from "lucide-react";

import {
  ProductDraft, ProductCondition, ShippingOption, ProcessingTime,
  CONDITION_OPTIONS, DEFAULT_BRANDS, DEFAULT_UNITS, DEFAULT_CURRENCIES,
  SHIPPING_OPTIONS, PROCESSING_OPTIONS,
  MOCK_CATEGORY_TREE, searchCategories, CategorySearchHit,
  createEmptyDraft, createSampleDraft, loadDraft, saveDraft, formatOwnerPrice, LIMITS,
} from "@/lib/nexapp/mockProductCreator";

// ── Design tokens · match NexWorkspaceProducts for chassis consistency ─

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
};

// ── Geometry · matches NexWorkspaceProducts baseline · reference-derived ──

const G = {
  hPad:         16,   // horizontal padding of workspace children
  headerH:      82,   // header height (matches Products)
  progressH:    72,   // stage indicator height
  actionH:      64,   // bottom action bar height
  radius:       14,   // card radius
  radiusS:      10,   // input radius
  radiusXS:     8,    // photo tile radius
  inputH:       44,   // form field height
  compactH:     36,   // dropdown / small button
  photoH:       84,   // photo tile height (reference: ~72-88px)
  sectionGap:   18,   // between sections
  fieldGap:     10,   // between fields within a row
  sectionPadY:  16,   // vertical padding inside sections
};

// ── Types ──────────────────────────────────────────────────────────────

type CreationStep = "details" | "photos" | "pricing" | "preview";

const STEP_META: ReadonlyArray<{ key: CreationStep; label: string }> = [
  { key: "details", label: "Details" },
  { key: "photos",  label: "Photos"  },
  { key: "pricing", label: "Pricing" },
  { key: "preview", label: "Preview" },
];

// ── Props ──────────────────────────────────────────────────────────────

export interface NexWorkspaceProductCreatorProps {
  onBack?: () => void;
}

// ── Component ──────────────────────────────────────────────────────────

export function NexWorkspaceProductCreator({ onBack }: NexWorkspaceProductCreatorProps) {
  const [draft, setDraft] = useState<ProductDraft>(() => createEmptyDraft());
  const [activeStep, setActiveStep] = useState<CreationStep>("details");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoaded = useRef(false);

  // Load persisted draft on mount · fall back to sample so P0 review has content
  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    const existing = loadDraft();
    if (existing) {
      setDraft(existing);
      console.log("[NexWorkspaceProductCreator] restored draft from localStorage");
    } else {
      // Seed with sample for review · owner can Cancel to start fresh
      setDraft(createSampleDraft());
      console.log("[NexWorkspaceProductCreator] no draft found · seeded sample");
    }
  }, []);

  // Autosave 500ms after any change · draft state is source of truth
  useEffect(() => {
    if (!hasLoaded.current) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      saveDraft(draft);
      setSavedAt(new Date());
    }, 500);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [draft]);

  const uiStub = useCallback((label: string) => {
    console.log(`[NexWorkspaceProductCreator] ${label} · UI stub · no backend`);
  }, []);

  const patch = useCallback((next: Partial<ProductDraft>) => {
    setDraft((prev) => ({ ...prev, ...next }));
  }, []);

  const handleSaveDraft = useCallback(() => {
    saveDraft(draft);
    setSavedAt(new Date());
    uiStub("Save Draft tapped · persisted to localStorage");
  }, [draft, uiStub]);

  const handleNext = useCallback(() => {
    const idx = STEP_META.findIndex((s) => s.key === activeStep);
    const next = STEP_META[idx + 1];
    if (next) {
      setActiveStep(next.key);
      uiStub(`advanced to step: ${next.key}`);
    } else {
      uiStub("Publish tapped · P0 has no backend · would enter READY_FOR_REVIEW");
    }
  }, [activeStep, uiStub]);

  const handleCancel = useCallback(() => {
    uiStub("Cancel tapped · returning to Products list");
    onBack?.();
  }, [onBack, uiStub]);

  const nextLabel = useMemo(() => {
    const idx = STEP_META.findIndex((s) => s.key === activeStep);
    const next = STEP_META[idx + 1];
    if (!next) return "Publish";
    if (next.key === "photos")  return "Next: Add Photos";
    if (next.key === "pricing") return "Next: Pricing";
    if (next.key === "preview") return "Next: Preview";
    return "Next";
  }, [activeStep]);

  return (
    <section
      aria-label="NEX Product Creator workspace"
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
      {/* ─── Header · ~82px ─────────────────────────────────────────── */}
      <Header
        onBack={onBack}
        onSaveDraft={handleSaveDraft}
        savedAt={savedAt}
      />

      {/* ─── Progress indicator · ~72px ──────────────────────────────── */}
      <ProgressIndicator
        activeStep={activeStep}
        onStepTap={(s) => { setActiveStep(s); uiStub(`step tapped: ${s}`); }}
      />

      {/* ─── Scroll region · the ONLY vertical scroller ──────────────── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          overflowY: "auto",
          overflowX: "hidden",
          padding: `10px ${G.hPad}px ${G.sectionGap}px`,
          boxSizing: "border-box",
          width: "100%",
          maxWidth: "100%",
          display: "flex",
          flexDirection: "column",
          gap: G.sectionGap,
        }}
      >
        <PhotosSection draft={draft} onUiStub={uiStub} />

        <ProductInformationSection
          draft={draft}
          patch={patch}
          onUiStub={uiStub}
        />

        <PricingStockSection
          draft={draft}
          patch={patch}
          onUiStub={uiStub}
        />

        <DeliveryLocationSection
          draft={draft}
          patch={patch}
          onUiStub={uiStub}
        />

        <CashOnDeliveryToggle
          on={draft.cashOnDelivery}
          onToggle={() => {
            patch({ cashOnDelivery: !draft.cashOnDelivery });
            uiStub(`COD toggled · now ${!draft.cashOnDelivery ? "on" : "off"}`);
          }}
        />

        {/* Advanced / future integration disclosures · calm one-liners.
            NEVER fake AI buttons · NEVER simulate features that don't exist. */}
        <AdvancedDisclosure
          label="Category-specific attributes"
          hint="Auto-populated from category taxonomy · lands with taxonomy T3."
          onUiStub={uiStub}
        />
        <AdvancedDisclosure
          label="Variants (size · colour · pack)"
          hint="Multiple commercial variants of one product · design ready."
          onUiStub={uiStub}
        />
        <AdvancedDisclosure
          label="Advanced commercial pricing"
          hint="Incoterms · MOQ · destinations · validity · for international operators."
          onUiStub={uiStub}
        />
        <AdvancedDisclosure
          label="Market visibility"
          hint="International · selected countries · exclusions. Visibility ≠ pricing."
          onUiStub={uiStub}
        />
        <AdvancedDisclosure
          label="Promotion"
          hint="Percentage / fixed / override · validity window · connects to Marketing."
          onUiStub={uiStub}
        />
      </div>

      {/* ─── Bottom action bar · ~64px · sticky inside workspace ───── */}
      <ActionBar
        onCancel={handleCancel}
        onNext={handleNext}
        nextLabel={nextLabel}
      />
    </section>
  );
}

// ── Header ─────────────────────────────────────────────────────────────

function Header({
  onBack, onSaveDraft, savedAt,
}: {
  onBack?: () => void;
  onSaveDraft: () => void;
  savedAt: Date | null;
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
        aria-label="Back"
        onClick={() => onBack?.()}
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
          Upload New Product
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
          {savedAt
            ? `Saved · ${formatClock(savedAt)}`
            : "Share your product with friends or customers"}
        </div>
      </div>

      <button
        type="button"
        aria-label="Save draft"
        onClick={onSaveDraft}
        style={{
          appearance: "none",
          height: G.compactH,
          padding: "0 12px",
          borderRadius: 10,
          background: T.surface,
          border: `1px solid ${T.borderMed}`,
          color: T.textSec,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: 0.15,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          flexShrink: 0,
        }}
      >
        Save Draft
      </button>
    </header>
  );
}

function formatClock(d: Date): string {
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

// ── Progress indicator ─────────────────────────────────────────────────

function ProgressIndicator({
  activeStep, onStepTap,
}: {
  activeStep: CreationStep;
  onStepTap: (s: CreationStep) => void;
}) {
  const activeIdx = STEP_META.findIndex((s) => s.key === activeStep);
  return (
    <nav
      aria-label="Product creation progress"
      style={{
        flex: `0 0 ${G.progressH}px`,
        display: "flex",
        alignItems: "center",
        padding: `0 ${G.hPad}px`,
        boxSizing: "border-box",
        minWidth: 0,
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
        }}
      >
        {STEP_META.map((s, i) => {
          const isActive = i === activeIdx;
          const isDone   = i < activeIdx;
          return (
            <React.Fragment key={s.key}>
              <button
                type="button"
                onClick={() => onStepTap(s.key)}
                aria-current={isActive ? "step" : undefined}
                style={{
                  appearance: "none",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  minWidth: 0,
                  flexShrink: 0,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    background: isActive ? T.orangeSolid : "transparent",
                    border: `1.5px solid ${isActive ? T.orangeSolid : isDone ? T.orangeMid : T.borderMed}`,
                    color: isActive ? "#0b0b0d" : isDone ? T.orange : T.textDim,
                    fontSize: 11,
                    fontWeight: 800,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    letterSpacing: 0,
                  }}
                >
                  {isDone ? <Check size={13} strokeWidth={3} /> : i + 1}
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    letterSpacing: 0.4,
                    color: isActive ? T.orange : T.textDim,
                    textTransform: "capitalize" as const,
                    lineHeight: 1,
                  }}
                >
                  {s.label}
                </span>
              </button>
              {i < STEP_META.length - 1 && (
                <span
                  aria-hidden
                  style={{
                    flex: 1,
                    height: 1,
                    minWidth: 12,
                    background: i < activeIdx ? T.orangeMid : T.borderMed,
                    margin: "0 8px",
                    marginBottom: 18, // align with circles (labels below)
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
}

// ── Photos section ─────────────────────────────────────────────────────

function PhotosSection({
  draft, onUiStub,
}: {
  draft: ProductDraft;
  onUiStub: (label: string) => void;
}) {
  const filled = draft.photos.filter((p) => p.url !== null);
  const remaining = Math.max(0, 8 - filled.length);
  return (
    <Section
      title="Product Photos"
      subtitle={`Add up to 8 photos. First photo will be the cover.`}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          overflowY: "hidden",
          scrollbarWidth: "none",
          paddingBottom: 4,
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
        {/* Add Photo tile (always first) · dashed orange border */}
        <PhotoTile
          kind="add"
          onClick={() => onUiStub("Add Photo tapped · real upload lands with P8 sync engine")}
        />

        {filled.map((p) => (
          <PhotoTile
            key={p.id}
            kind="filled"
            isCover={p.isCover}
            onRemove={() => onUiStub(`remove photo · id=${p.id} · UI stub`)}
          />
        ))}

        {remaining > 0 && (
          <PhotoTile
            kind="remaining"
            count={remaining}
            onClick={() => onUiStub(`+${remaining} tile tapped · would open camera / library`)}
          />
        )}
      </div>

      <div
        style={{
          marginTop: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          color: T.textDim,
          fontSize: 11,
          letterSpacing: 0.15,
        }}
      >
        <Move size={11} strokeWidth={2} />
        <span>Drag to reorder photos</span>
      </div>
    </Section>
  );
}

function PhotoTile({
  kind, isCover, count, onClick, onRemove,
}: {
  kind: "add" | "filled" | "remaining";
  isCover?: boolean;
  count?: number;
  onClick?: () => void;
  onRemove?: () => void;
}) {
  const size = G.photoH;

  if (kind === "add") {
    return (
      <button
        type="button"
        aria-label="Add photo"
        onClick={onClick}
        style={{
          appearance: "none",
          flexShrink: 0,
          width: size,
          height: size,
          borderRadius: G.radiusXS,
          background: T.orangeSoft,
          border: `1.5px dashed ${T.orangeMid}`,
          color: T.orange,
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          boxSizing: "border-box",
        }}
      >
        <Camera size={18} strokeWidth={2} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.3 }}>Add Photo</span>
      </button>
    );
  }

  if (kind === "remaining") {
    return (
      <button
        type="button"
        aria-label={`Add ${count ?? 0} more photos`}
        onClick={onClick}
        style={{
          appearance: "none",
          flexShrink: 0,
          width: size,
          height: size,
          borderRadius: G.radiusXS,
          background: "transparent",
          border: `1.5px dashed ${T.orangeMid}`,
          color: T.orange,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: 0.2,
          boxSizing: "border-box",
        }}
      >
        +{count ?? 0}
      </button>
    );
  }

  // filled
  return (
    <div
      style={{
        position: "relative",
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: G.radiusXS,
        background: "linear-gradient(140deg, #16171b 0%, #1f2126 55%, #2a2c33 100%)",
        border: `1px solid ${isCover ? T.orangeMid : T.borderMed}`,
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Mock shoe silhouette · P0 · no real upload */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 26,
          opacity: 0.68,
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))",
        }}
      >
        👟
      </span>
      <button
        type="button"
        aria-label="Remove photo"
        onClick={onRemove}
        style={{
          appearance: "none",
          position: "absolute",
          top: 4,
          right: 4,
          width: 18,
          height: 18,
          borderRadius: 999,
          border: "none",
          background: "rgba(0, 0, 0, 0.7)",
          color: T.textPri,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <X size={11} strokeWidth={2.4} />
      </button>
      {isCover && (
        <span
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "2px 4px",
            background: T.orangeSolid,
            color: "#0b0b0d",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.4,
            textAlign: "center",
            textTransform: "uppercase" as const,
          }}
        >
          Cover
        </span>
      )}
    </div>
  );
}

// ── Product information section ────────────────────────────────────────

function ProductInformationSection({
  draft, patch, onUiStub,
}: {
  draft: ProductDraft;
  patch: (n: Partial<ProductDraft>) => void;
  onUiStub: (label: string) => void;
}) {
  return (
    <Section title="Product Information">
      <FormField label="Product Name" required charCount={draft.name.length} charMax={LIMITS.name}>
        <TextInput
          value={draft.name}
          maxLength={LIMITS.name}
          onChange={(v) => patch({ name: v })}
          placeholder="e.g. Street Runner Pro"
          aria-label="Product name"
        />
      </FormField>

      <FormField label="Category" required>
        <CategoryPicker
          currentSlug={draft.categorySlug}
          currentLabel={draft.categoryLabel}
          onPick={(hit) => {
            patch({
              categorySlug: hit.slug,
              categoryLabel: hit.label,
              categoryBreadcrumb: hit.breadcrumb,
            });
            onUiStub(`category picked: ${hit.slug}`);
          }}
          onClear={() => {
            patch({ categorySlug: null, categoryLabel: null, categoryBreadcrumb: null });
            onUiStub("category cleared");
          }}
        />
        {draft.categoryBreadcrumb && (
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              color: T.textDim,
              lineHeight: 1.35,
              letterSpacing: 0.1,
            }}
          >
            {draft.categoryBreadcrumb}
          </div>
        )}
      </FormField>

      <TwoColRow>
        <FormField label="Condition" required>
          <DropdownSelect<ProductCondition>
            value={draft.condition}
            options={CONDITION_OPTIONS}
            onChange={(v) => { patch({ condition: v }); onUiStub(`condition: ${v}`); }}
            renderValue={(v, label) => (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                {v === "new" && (
                  <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: T.green }} />
                )}
                <span>{label}</span>
              </span>
            )}
          />
        </FormField>
        <FormField label="Brand">
          <BrandPicker
            value={draft.brand}
            onChange={(v) => { patch({ brand: v }); onUiStub(`brand: ${v || "(cleared)"}`); }}
          />
        </FormField>
      </TwoColRow>

      <FormField
        label="Short Description"
        required
        charCount={draft.shortDescription.length}
        charMax={LIMITS.shortDescription}
      >
        <TextArea
          value={draft.shortDescription}
          maxLength={LIMITS.shortDescription}
          rows={2}
          onChange={(v) => patch({ shortDescription: v })}
          placeholder="One clear line customers see in search & cards."
          aria-label="Short description"
        />
      </FormField>

      <FormField
        label="Full Description"
        charCount={draft.fullDescription.length}
        charMax={LIMITS.fullDescription}
      >
        <TextArea
          value={draft.fullDescription}
          maxLength={LIMITS.fullDescription}
          rows={4}
          onChange={(v) => patch({ fullDescription: v })}
          placeholder="Materials · fit · usage · anything a customer should know."
          aria-label="Full description"
        />
      </FormField>
    </Section>
  );
}

// ── Pricing & Stock section ────────────────────────────────────────────

function PricingStockSection({
  draft, patch, onUiStub,
}: {
  draft: ProductDraft;
  patch: (n: Partial<ProductDraft>) => void;
  onUiStub: (label: string) => void;
}) {
  const currency = DEFAULT_CURRENCIES.find((c) => c.value === draft.currency);
  const symbol = currency?.symbol ?? draft.currency;

  return (
    <Section title="Pricing & Stock">
      <ThreeColRow>
        <FormField label="Price" required>
          <PrefixedInput
            prefix={symbol}
            value={draft.price}
            inputMode="decimal"
            onChange={(v) => patch({ price: v.replace(/[^\d.]/g, "") })}
            placeholder="0"
            aria-label="Price"
          />
        </FormField>
        <FormField label="Stock" required>
          <TextInput
            value={draft.stock}
            inputMode="numeric"
            onChange={(v) => patch({ stock: v.replace(/[^\d]/g, "") })}
            placeholder="0"
            aria-label="Stock quantity"
          />
        </FormField>
        <FormField label="Unit">
          <DropdownSelect<string>
            value={draft.unit}
            options={DEFAULT_UNITS}
            onChange={(v) => { patch({ unit: v }); onUiStub(`unit: ${v}`); }}
          />
        </FormField>
      </ThreeColRow>

      <TwoColRow>
        <FormField label="SKU" hint="Optional">
          <TextInput
            value={draft.sku}
            maxLength={LIMITS.sku}
            onChange={(v) => patch({ sku: v })}
            placeholder="e.g. SRP-BLK-42"
            aria-label="SKU"
          />
        </FormField>
        <FormField label="Barcode" hint="Optional">
          <PrefixedInput
            prefix=""
            suffix={<BarcodeIcon size={14} strokeWidth={2} />}
            value={draft.barcode}
            maxLength={LIMITS.barcode}
            onChange={(v) => patch({ barcode: v })}
            placeholder="GTIN / EAN / UPC"
            aria-label="Barcode"
          />
        </FormField>
      </TwoColRow>

      <div style={{ marginTop: 4 }}>
        <button
          type="button"
          onClick={() => onUiStub("Advanced commercial pricing tapped · Incoterms/MOQ/destinations · lands with Commercial Pricing implementation slice")}
          style={{
            appearance: "none",
            background: "transparent",
            border: "none",
            color: T.orange,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.2,
            cursor: "pointer",
            padding: 0,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          Advanced commercial pricing
          <ArrowRight size={13} strokeWidth={2.2} />
        </button>
        {" "}
        {draft.price && (
          <span style={{ marginLeft: 10, fontSize: 12, color: T.textDim }}>
            Owner sees {formatOwnerPrice(draft.price, draft.currency)} · authoritative per currency doctrine
          </span>
        )}
      </div>
    </Section>
  );
}

// ── Delivery & Location section ────────────────────────────────────────

function DeliveryLocationSection({
  draft, patch, onUiStub,
}: {
  draft: ProductDraft;
  patch: (n: Partial<ProductDraft>) => void;
  onUiStub: (label: string) => void;
}) {
  return (
    <Section title="Delivery & Location">
      <ThreeColRow>
        <FormField label="Location">
          <PrefixedInput
            prefix={<MapPin size={14} strokeWidth={2} />}
            value={draft.location}
            onChange={(v) => patch({ location: v })}
            placeholder="e.g. Yogyakarta, Indonesia"
            aria-label="Location"
          />
        </FormField>
        <FormField label="Shipping">
          <DropdownSelect<ShippingOption>
            value={draft.shipping}
            options={SHIPPING_OPTIONS}
            onChange={(v) => { patch({ shipping: v }); onUiStub(`shipping: ${v}`); }}
          />
        </FormField>
        <FormField label="Processing Time">
          <DropdownSelect<ProcessingTime>
            value={draft.processingTime}
            options={PROCESSING_OPTIONS}
            onChange={(v) => { patch({ processingTime: v }); onUiStub(`processing: ${v}`); }}
          />
        </FormField>
      </ThreeColRow>
    </Section>
  );
}

// ── Cash on Delivery toggle ────────────────────────────────────────────

function CashOnDeliveryToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: `${G.sectionPadY - 2}px 14px`,
        background: on ? T.greenSoft : T.surface,
        border: `1px solid ${on ? T.greenMid : T.borderMed}`,
        borderRadius: G.radius,
        boxSizing: "border-box",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 34,
          height: 34,
          borderRadius: 10,
          background: on ? T.greenSoft : T.surfaceHi,
          border: `1px solid ${on ? T.greenMid : T.borderMed}`,
          color: on ? T.green : T.textDim,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ShieldCheck size={16} strokeWidth={2} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.textPri, lineHeight: 1.2 }}>
          Cash on Delivery (COD)
        </div>
        <div
          style={{
            fontSize: 11,
            color: T.textDim,
            marginTop: 3,
            lineHeight: 1.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          Allows buyers to pay when they receive the product.
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Toggle cash on delivery"
        onClick={onToggle}
        style={{
          appearance: "none",
          flexShrink: 0,
          width: 44,
          height: 26,
          borderRadius: 999,
          border: `1px solid ${on ? T.greenMid : T.borderMed}`,
          background: on ? T.green : T.surfaceHi,
          position: "relative",
          cursor: "pointer",
          transition: "background 120ms ease, border-color 120ms ease",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 2,
            left: on ? 20 : 2,
            width: 20,
            height: 20,
            borderRadius: 999,
            background: on ? "#0b0b0d" : T.textDim,
            transition: "left 140ms ease, background 140ms ease",
          }}
        />
      </button>
    </div>
  );
}

// ── Advanced disclosure card ──────────────────────────────────────────

function AdvancedDisclosure({
  label, hint, onUiStub,
}: {
  label: string;
  hint: string;
  onUiStub: (m: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onUiStub(`Advanced disclosure tapped: "${label}"`)}
      style={{
        appearance: "none",
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        padding: "12px 14px",
        background: T.surfaceLo,
        border: `1px dashed ${T.borderMed}`,
        borderRadius: G.radiusS,
        color: T.textSec,
        cursor: "pointer",
        textAlign: "left",
        transition: "background 120ms ease, border-color 120ms ease, color 120ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = T.orangeMid;
        e.currentTarget.style.color = T.textPri;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = T.borderMed;
        e.currentTarget.style.color = T.textSec;
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: 12.5,
            fontWeight: 700,
            letterSpacing: 0.05,
            color: T.textPri,
            lineHeight: 1.2,
          }}
        >
          {label}
        </span>
        <span
          style={{
            display: "block",
            marginTop: 3,
            fontSize: 11,
            color: T.textDim,
            lineHeight: 1.35,
          }}
        >
          {hint}
        </span>
      </span>
      <span style={{ color: T.orange, flexShrink: 0, display: "inline-flex", alignItems: "center" }}>
        <ArrowRight size={14} strokeWidth={2.2} />
      </span>
    </button>
  );
}

// ── Action bar (sticky bottom inside workspace) ───────────────────────

function ActionBar({
  onCancel, onNext, nextLabel,
}: {
  onCancel: () => void;
  onNext: () => void;
  nextLabel: string;
}) {
  return (
    <footer
      style={{
        flex: `0 0 ${G.actionH}px`,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: `0 ${G.hPad}px`,
        borderTop: `1px solid ${T.border}`,
        background: T.surfaceLo,
        boxSizing: "border-box",
        minWidth: 0,
      }}
    >
      <button
        type="button"
        onClick={onCancel}
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
          minWidth: 0,
        }}
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onNext}
        style={{
          appearance: "none",
          flex: 2,
          height: 44,
          borderRadius: 12,
          background: T.orangeSolid,
          border: `1px solid ${T.orangeSolid}`,
          color: "#0b0b0d",
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: 0.2,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          boxSizing: "border-box",
          minWidth: 0,
        }}
      >
        {nextLabel}
        <ArrowRight size={15} strokeWidth={2.4} />
      </button>
    </footer>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────

function Section({
  title, subtitle, children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h3
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: T.textPri,
            margin: 0,
            letterSpacing: -0.005,
            lineHeight: 1.2,
          }}
        >
          {title}
        </h3>
        {subtitle && (
          <div
            style={{
              fontSize: 11.5,
              color: T.textDim,
              marginTop: 4,
              lineHeight: 1.3,
              letterSpacing: 0.1,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
        {children}
      </div>
    </section>
  );
}

// ── Form primitives ───────────────────────────────────────────────────

function FormField({
  label, required, hint, charCount, charMax, children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  charCount?: number;
  charMax?: number;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0, width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, minWidth: 0 }}>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: T.textSec,
            letterSpacing: 0.2,
            lineHeight: 1.1,
          }}
        >
          {label}
          {required && <span style={{ color: T.orange, marginLeft: 3 }}>*</span>}
          {hint && !required && <span style={{ color: T.textMute, marginLeft: 5, fontSize: 10.5 }}>({hint})</span>}
        </span>
        {typeof charCount === "number" && typeof charMax === "number" && (
          <span
            style={{
              fontSize: 10,
              color: charCount >= charMax ? T.orange : T.textMute,
              letterSpacing: 0.2,
              fontVariantNumeric: "tabular-nums",
              flexShrink: 0,
            }}
          >
            {charCount} / {charMax}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function TwoColRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: G.fieldGap,
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}

function ThreeColRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: G.fieldGap,
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}

function TextInput({
  value, onChange, placeholder, maxLength, inputMode,
  ...ariaProps
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
  "aria-label"?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      inputMode={inputMode}
      aria-label={ariaProps["aria-label"]}
      style={{
        appearance: "none",
        WebkitAppearance: "none",
        MozAppearance: "none",
        height: G.inputH,
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        padding: "0 12px",
        borderRadius: G.radiusS,
        background: T.surfaceLo,
        border: `1px solid ${T.borderMed}`,
        color: T.textPri,
        fontSize: 13.5,
        letterSpacing: 0,
        outline: "none",
        boxSizing: "border-box",
      } as React.CSSProperties}
      onFocus={(e) => { e.currentTarget.style.borderColor = T.orangeMid; }}
      onBlur={(e)  => { e.currentTarget.style.borderColor = T.borderMed; }}
    />
  );
}

function TextArea({
  value, onChange, placeholder, maxLength, rows,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  "aria-label"?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      rows={rows ?? 3}
      style={{
        appearance: "none",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        padding: "10px 12px",
        borderRadius: G.radiusS,
        background: T.surfaceLo,
        border: `1px solid ${T.borderMed}`,
        color: T.textPri,
        fontSize: 13.5,
        lineHeight: 1.4,
        outline: "none",
        resize: "vertical" as const,
        fontFamily: "inherit",
        boxSizing: "border-box",
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = T.orangeMid; }}
      onBlur={(e)  => { e.currentTarget.style.borderColor = T.borderMed; }}
    />
  );
}

function PrefixedInput({
  prefix, suffix, value, onChange, placeholder, maxLength, inputMode,
}: {
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
  "aria-label"?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: G.inputH,
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        padding: "0 12px",
        borderRadius: G.radiusS,
        background: T.surfaceLo,
        border: `1px solid ${T.borderMed}`,
        boxSizing: "border-box",
      }}
    >
      {prefix && <span style={{ color: T.textDim, flexShrink: 0, display: "inline-flex", alignItems: "center" }}>{prefix}</span>}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        style={{
          flex: 1,
          minWidth: 0,
          height: "100%",
          background: "transparent",
          border: "none",
          color: T.textPri,
          fontSize: 13.5,
          outline: "none",
          padding: 0,
          appearance: "none",
          WebkitAppearance: "none",
        } as React.CSSProperties}
      />
      {suffix && <span style={{ color: T.textDim, flexShrink: 0, display: "inline-flex", alignItems: "center" }}>{suffix}</span>}
    </div>
  );
}

// ── Dropdown select · lightweight custom (matches reference visual) ───

function DropdownSelect<T extends string>({
  value, options, onChange, renderValue,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
  renderValue?: (v: T, label: string) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const label = options.find((o) => o.value === value)?.label ?? String(value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div
      ref={rootRef}
      style={{ position: "relative", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          appearance: "none",
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          height: G.inputH,
          padding: "0 10px 0 12px",
          borderRadius: G.radiusS,
          background: T.surfaceLo,
          border: `1px solid ${open ? T.orangeMid : T.borderMed}`,
          color: T.textPri,
          fontSize: 13.5,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          boxSizing: "border-box",
          textAlign: "left",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>
          {renderValue ? renderValue(value, label) : label}
        </span>
        <ChevronDown size={14} strokeWidth={2} style={{ color: T.textDim, flexShrink: 0 }} />
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: `calc(100% + 4px)`,
            left: 0,
            right: 0,
            zIndex: 30,
            maxHeight: 240,
            overflowY: "auto",
            background: T.surfaceHi,
            border: `1px solid ${T.borderHi}`,
            borderRadius: G.radiusS,
            boxShadow: "0 12px 30px rgba(0, 0, 0, 0.55)",
            boxSizing: "border-box",
          }}
        >
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => { onChange(o.value); setOpen(false); }}
                style={{
                  appearance: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  width: "100%",
                  padding: "10px 12px",
                  background: selected ? T.orangeSoft : "transparent",
                  border: "none",
                  borderBottom: `1px solid ${T.border}`,
                  color: selected ? T.orange : T.textPri,
                  fontSize: 13,
                  fontWeight: selected ? 700 : 500,
                  textAlign: "left",
                  cursor: "pointer",
                  boxSizing: "border-box",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>
                  {o.label}
                </span>
                {selected && <Check size={13} strokeWidth={2.4} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Brand picker · with X-to-clear ────────────────────────────────────

function BrandPicker({
  value, onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = DEFAULT_BRANDS.find((b) => b.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div
      ref={rootRef}
      style={{ position: "relative", width: "100%", maxWidth: "100%", minWidth: 0 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          height: G.inputH,
          width: "100%",
          padding: "0 8px 0 12px",
          borderRadius: G.radiusS,
          background: T.surfaceLo,
          border: `1px solid ${open ? T.orangeMid : T.borderMed}`,
          boxSizing: "border-box",
          cursor: "pointer",
        }}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13.5,
            color: selected ? T.textPri : T.textDim,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {selected ? selected.label : "Optional"}
        </span>
        {value && (
          <button
            type="button"
            aria-label="Clear brand"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            style={{
              appearance: "none",
              background: "transparent",
              border: "none",
              padding: 4,
              cursor: "pointer",
              color: T.textDim,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <X size={12} strokeWidth={2.2} />
          </button>
        )}
        <ChevronDown size={14} strokeWidth={2} style={{ color: T.textDim, flexShrink: 0 }} />
      </div>

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: `calc(100% + 4px)`,
            left: 0,
            right: 0,
            zIndex: 30,
            maxHeight: 220,
            overflowY: "auto",
            background: T.surfaceHi,
            border: `1px solid ${T.borderHi}`,
            borderRadius: G.radiusS,
            boxShadow: "0 12px 30px rgba(0, 0, 0, 0.55)",
            boxSizing: "border-box",
          }}
        >
          {DEFAULT_BRANDS.map((b) => {
            const isSel = b.value === value;
            return (
              <button
                key={b.value}
                type="button"
                onClick={() => { onChange(b.value); setOpen(false); }}
                style={{
                  appearance: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "10px 12px",
                  background: isSel ? T.orangeSoft : "transparent",
                  border: "none",
                  borderBottom: `1px solid ${T.border}`,
                  color: isSel ? T.orange : T.textPri,
                  fontSize: 13,
                  fontWeight: isSel ? 700 : 500,
                  textAlign: "left",
                  cursor: "pointer",
                  boxSizing: "border-box",
                }}
              >
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {b.label}
                </span>
                {isSel && <Check size={13} strokeWidth={2.4} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Category picker · search + hierarchical selection ─────────────────

function CategoryPicker({
  currentSlug, currentLabel, onPick, onClear,
}: {
  currentSlug: string | null;
  currentLabel: string | null;
  onPick: (hit: CategorySearchHit) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const results: CategorySearchHit[] = useMemo(() => {
    if (!query.trim()) {
      // Show top-level categories as a starting point
      return MOCK_CATEGORY_TREE.map((n) => ({
        slug: n.slug,
        label: n.label,
        breadcrumb: n.label,
      }));
    }
    return searchCategories(query, 8);
  }, [query]);

  return (
    <div
      ref={rootRef}
      style={{ position: "relative", width: "100%", maxWidth: "100%", minWidth: 0 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: G.inputH,
          width: "100%",
          padding: "0 10px 0 12px",
          borderRadius: G.radiusS,
          background: T.surfaceLo,
          border: `1px solid ${open ? T.orangeMid : T.borderMed}`,
          boxSizing: "border-box",
          cursor: "pointer",
        }}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          aria-hidden
          style={{
            width: 18,
            height: 18,
            borderRadius: 6,
            background: currentSlug ? T.orangeSoft : T.surfaceHi,
            border: `1px solid ${currentSlug ? T.orangeMid : T.borderMed}`,
            color: currentSlug ? T.orange : T.textDim,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            flexShrink: 0,
          }}
        >
          🛍
        </span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13.5,
            color: currentLabel ? T.textPri : T.textDim,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {currentLabel ?? "Search or choose category"}
        </span>
        {currentSlug && (
          <button
            type="button"
            aria-label="Clear category"
            onClick={(e) => { e.stopPropagation(); onClear(); setQuery(""); }}
            style={{
              appearance: "none",
              background: "transparent",
              border: "none",
              padding: 4,
              cursor: "pointer",
              color: T.textDim,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <X size={12} strokeWidth={2.2} />
          </button>
        )}
        <ChevronDown size={14} strokeWidth={2} style={{ color: T.textDim, flexShrink: 0 }} />
      </div>

      {open && (
        <div
          style={{
            position: "absolute",
            top: `calc(100% + 4px)`,
            left: 0,
            right: 0,
            zIndex: 30,
            maxHeight: 320,
            display: "flex",
            flexDirection: "column",
            background: T.surfaceHi,
            border: `1px solid ${T.borderHi}`,
            borderRadius: G.radiusS,
            boxShadow: "0 12px 30px rgba(0, 0, 0, 0.55)",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              padding: 8,
              borderBottom: `1px solid ${T.border}`,
              boxSizing: "border-box",
            }}
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search category (e.g. running shoes)"
              autoFocus
              style={{
                appearance: "none",
                width: "100%",
                maxWidth: "100%",
                minWidth: 0,
                height: 36,
                padding: "0 10px",
                borderRadius: 8,
                background: T.surfaceLo,
                border: `1px solid ${T.borderMed}`,
                color: T.textPri,
                fontSize: 13,
                outline: "none",
                boxSizing: "border-box",
              } as React.CSSProperties}
            />
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {results.length === 0 ? (
              <div style={{ padding: 14, color: T.textDim, fontSize: 12, textAlign: "center" }}>
                No matches. Try a different word.
              </div>
            ) : (
              results.map((hit) => {
                const isSel = hit.slug === currentSlug;
                return (
                  <button
                    key={hit.slug}
                    type="button"
                    onClick={() => { onPick(hit); setOpen(false); setQuery(""); }}
                    style={{
                      appearance: "none",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 3,
                      width: "100%",
                      padding: "10px 12px",
                      background: isSel ? T.orangeSoft : "transparent",
                      border: "none",
                      borderBottom: `1px solid ${T.border}`,
                      color: T.textPri,
                      fontSize: 13,
                      textAlign: "left",
                      cursor: "pointer",
                      boxSizing: "border-box",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: isSel ? 700 : 600,
                        color: isSel ? T.orange : T.textPri,
                      }}
                    >
                      {hit.label}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: T.textDim,
                        letterSpacing: 0.1,
                        lineHeight: 1.3,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "100%",
                      }}
                    >
                      {hit.breadcrumb}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <div
            style={{
              padding: "8px 12px",
              borderTop: `1px solid ${T.border}`,
              fontSize: 10.5,
              color: T.textMute,
              letterSpacing: 0.15,
              boxSizing: "border-box",
            }}
          >
            Mock taxonomy · replaced by NEX Universal Taxonomy at T3
          </div>
        </div>
      )}
    </div>
  );
}
