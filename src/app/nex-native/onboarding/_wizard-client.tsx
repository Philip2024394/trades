"use client";

// src/app/nex-native/onboarding/_wizard-client.tsx
//
// NEX Seller Central · multi-step onboarding wizard · sealed 2026-10-01.
// -----------------------------------------------------------------------------
// 3-step flow:
//
//   1 · Shop URL · <SlugInput> with live availability + .nex preview
//   2 · Logo    · file picker + preview (optional · can skip)
//   3 · Lane + Category + Subcategory · lane cards filter the vertical
//                                        dropdown; vertical filters the
//                                        profession dropdown
//
// Final submit posts to createBusinessAction via a native HTML form,
// carrying all wizard state as hidden fields. The server action
// validates everything server-side (slug uniqueness, tier policy,
// reserved prefixes) so the client is a UX accelerator, not a trust
// boundary.

import * as React from "react";
import Link from "next/link";
import { createBusinessAction, uploadOnboardingLogoAction } from "../_actions";
import { SlugInput } from "./_slug-input";
import {
  LANE_ORDER,
  LANES,
  defaultVerticalSlugForLane,
  type SellerLane,
} from "@/lib/nex-native/seller-lanes";

const NEX = {
  bg: "#020914",
  panel: "rgba(6, 15, 28, 0.72)",
  border: "rgba(139, 169, 209, 0.14)",
  borderStrong: "rgba(139, 169, 209, 0.24)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#009FEF",
  cyanSoft: "rgba(0,159,239,0.5)",
  cyanBorder: "rgba(0,159,239,0.35)",
  orange: "#FF7200",
  green: "#8FFF6E",
  red: "#FF5A5A",
};
const SERIF =
  "'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

interface VerticalRow {
  id: string;
  slug: string;
  label: string;
}
interface ProfessionRow {
  id: string;
  vertical_id: string;
  slug: string;
  label: string;
}

interface Props {
  viewerTier: "gratis" | "bisnis";
  verticals: VerticalRow[];
  professions: ProfessionRow[];
  preselectLane: SellerLane | null;
  existingShopSlug: string | null;
  banner: { code: string; message: string } | null;
}

export function SellerCentralWizard({
  viewerTier,
  verticals,
  professions,
  preselectLane,
  existingShopSlug,
  banner,
}: Props): React.JSX.Element {
  const [step, setStep] = React.useState<1 | 2 | 3>(1);

  // --- Wizard state (lives in client memory until final submit) ---
  const [slug, setSlug] = React.useState("");
  const [slugAvailable, setSlugAvailable] = React.useState(false);
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [logoUploading, setLogoUploading] = React.useState(false);
  const [logoError, setLogoError] = React.useState<string | null>(null);
  const [lane, setLane] = React.useState<SellerLane | null>(preselectLane);

  // Sealed 2026-10-01 · wizard gates Next on the SlugInput's callback
  // (available = true) rather than polling the hidden input DOM value
  // which was fragile and could miss the ✓ transition.
  const handleSlugStatus = React.useCallback(
    (next: { normalized: string; available: boolean }) => {
      setSlug(next.normalized);
      setSlugAvailable(next.available);
    },
    [],
  );

  const canAdvanceFromStep1 = slug.length > 0 && slugAvailable;
  const canAdvanceFromStep2 = true; // logo is optional
  // Sealed 2026-10-01 · Category + Subcategory dropdowns retired from
  // onboarding · the Lane alone is enough for a sensible baseline
  // (defaultVerticalSlugForLane) · fine category + profession infer
  // from product listings in a later bridge via LLM classification.
  const canSubmit = !!lane;

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
        paddingBottom: 80,
      }}
    >
      {/* Top chrome · NEX wordmark left · Home icon right · sealed
          2026-10-01 · matches the chat shell's muted-until-touched
          scarcity rule so the chrome recedes until the user reaches
          for it. */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          padding:
            "calc(env(safe-area-inset-top, 0) + 12px) 18px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(2,9,20,0.78)",
          backdropFilter: "blur(14px) saturate(1.2)",
          WebkitBackdropFilter: "blur(14px) saturate(1.2)",
          borderBottom: `1px solid ${NEX.border}`,
        }}
      >
        <Link
          href="/nex-native/home"
          aria-label="NEX Seller Central"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 2,
            textDecoration: "none",
            fontFamily: SANS,
            lineHeight: 1,
          }}
        >
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            <span style={{ color: "#F2F5F8" }}>NE</span>
            <span style={{ color: NEX.orange }}>X</span>
          </span>
          <span
            style={{
              fontSize: 9,
              letterSpacing: "0.26em",
              textTransform: "uppercase",
              color: NEX.textMute,
              fontWeight: 600,
            }}
          >
            Seller Central
          </span>
        </Link>
        <Link
          href="/nex-native/home"
          aria-label="Home"
          title="Home"
          style={{
            width: 36,
            height: 36,
            display: "grid",
            placeItems: "center",
            borderRadius: "50%",
            background: "transparent",
            color: "rgba(255,255,255,0.55)",
            textDecoration: "none",
            transition: "color 160ms ease",
          }}
        >
          <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M3 11l9-8 9 8" />
            <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
          </svg>
        </Link>
      </header>

      <main
        style={{
          maxWidth: 560,
          margin: "0 auto",
          // Sealed 2026-10-01 · bottom padding is conditional · steps
          // 1 and 2 have the fixed Next footer and need 120px of
          // clearance so content never hides beneath it · step 3
          // has NO fixed footer (Launch lives inside the main) so
          // the extra 120px becomes wasted space that pushes the
          // Launch button below the fold on short viewports. 40px
          // on step 3 lets the Launch button sit reachable.
          padding:
            step < 3
              ? "48px 20px calc(env(safe-area-inset-bottom, 0) + 120px)"
              : "48px 20px calc(env(safe-area-inset-bottom, 0) + 40px)",
        }}
      >
        {banner && (
          <div
            style={{
              marginBottom: 18,
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(255,90,90,0.08)",
              border: "1px solid rgba(255,90,90,0.4)",
              fontSize: 12,
              lineHeight: 1.5,
              color: NEX.text,
            }}
          >
            <b style={{ color: NEX.red }}>{banner.code}:</b> {banner.message}
          </div>
        )}

        <StepIndicator current={step} total={3} />

        {step === 1 && (
          <StepShell
            eyebrow="Welcome to NEX Seller Central"
            title="The world is waiting."
            body="Let's pick a shop name — the moment it's live, you can share it on social media and send it in any NEX chat."
          >
            <SlugInput
              tier={viewerTier}
              onStatusChange={handleSlugStatus}
            />
          </StepShell>
        )}

        {step === 2 && (
          <StepShell
            eyebrow="Step 2 · Logo"
            title="A face for your shop."
            body="Brands deserve a logo. Shops deserve a face. Let's give yours the attitude it deserves."
          >
            <LogoUploader
              currentUrl={logoUrl}
              uploading={logoUploading}
              error={logoError}
              onPick={async (file) => {
                setLogoError(null);
                setLogoUploading(true);
                try {
                  const fd = new FormData();
                  fd.append("logo", file);
                  const res = await uploadOnboardingLogoAction(fd);
                  if (res.ok) {
                    setLogoUrl(res.url);
                  } else {
                    setLogoError(res.error);
                  }
                } catch (e) {
                  setLogoError(e instanceof Error ? e.message : "upload_failed");
                } finally {
                  setLogoUploading(false);
                }
              }}
              onRemove={() => setLogoUrl(null)}
            />
          </StepShell>
        )}

        {step === 3 && (
          <StepShell
            eyebrow="Step 3 · What are you?"
            title="Business Type"
            body="Select the closest to your business type."
          >
            <LanePicker value={lane} onChange={setLane} />

            {/* Hidden form that carries the full wizard state to
                createBusinessAction on final submit. Lane → default
                vertical slug (defaultVerticalSlugForLane) gives the
                new business a sensible starting category · fine
                category + profession infer from product listings in
                a later bridge. */}
            <form action={createBusinessAction} style={{ marginTop: 24 }}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="logo_url" value={logoUrl ?? ""} />
              <input
                type="hidden"
                name="business_category"
                value={lane ? defaultVerticalSlugForLane(lane) : ""}
              />
              <button
                type="submit"
                disabled={!canSubmit}
                style={{
                  ...primaryButtonStyle,
                  opacity: canSubmit ? 1 : 0.5,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  width: "100%",
                }}
              >
                Launch my shop →
              </button>
            </form>
          </StepShell>
        )}

      </main>

      {/* Fixed footer · Next button pinned to the bottom of the
          viewport · steps 1 & 2 only (step 3's Launch CTA lives
          inside the step form itself since it submits data). Full-
          width-with-gutter, blurred backdrop so chat content behind
          it stays visible as the user scrolls. Back navigation
          retired per founder direction 2026-10-01 — the wizard is
          always forward motion. */}
      {step < 3 && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 20,
            padding:
              "14px 18px calc(env(safe-area-inset-bottom, 0) + 14px)",
            background: "rgba(2,9,20,0.78)",
            backdropFilter: "blur(14px) saturate(1.2)",
            WebkitBackdropFilter: "blur(14px) saturate(1.2)",
            borderTop: `1px solid ${NEX.border}`,
          }}
        >
          <div
            style={{
              maxWidth: 560,
              margin: "0 auto",
            }}
          >
            <button
              type="button"
              onClick={() =>
                setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s))
              }
              disabled={
                step === 1 ? !canAdvanceFromStep1 : !canAdvanceFromStep2
              }
              style={{
                ...primaryButtonStyle,
                width: "100%",
                opacity:
                  (step === 1 && canAdvanceFromStep1) ||
                  (step === 2 && canAdvanceFromStep2)
                    ? 1
                    : 0.5,
                cursor:
                  (step === 1 && canAdvanceFromStep1) ||
                  (step === 2 && canAdvanceFromStep2)
                    ? "pointer"
                    : "not-allowed",
              }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step indicator · "Step N of 3" with pill track
// ---------------------------------------------------------------------------
function StepIndicator({
  current,
  total,
}: {
  current: number;
  total: number;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 24,
      }}
    >
      {Array.from({ length: total }).map((_, i) => {
        const n = i + 1;
        const active = n <= current;
        return (
          <div
            key={n}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: active ? NEX.cyan : "rgba(139,169,209,0.18)",
              transition: "background 220ms ease",
            }}
          />
        );
      })}
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: NEX.textDim,
          fontWeight: 700,
          marginLeft: 6,
          whiteSpace: "nowrap",
        }}
      >
        {current} / {total}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StepShell · common eyebrow + title + body + content layout
// ---------------------------------------------------------------------------
function StepShell({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: NEX.cyan,
          fontWeight: 700,
          marginBottom: 10,
        }}
      >
        {eyebrow}
      </div>
      <h1
        style={{
          margin: "0 0 10px",
          fontFamily: SERIF,
          fontSize: 32,
          lineHeight: 1.1,
          letterSpacing: "-0.012em",
          fontWeight: 500,
        }}
      >
        {title}
      </h1>
      <p
        style={{
          margin: "0 0 22px",
          fontSize: 13,
          lineHeight: 1.6,
          color: NEX.textDim,
        }}
      >
        {body}
      </p>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LogoUploader · file picker + preview + replace / remove
// ---------------------------------------------------------------------------
function LogoUploader({
  currentUrl,
  uploading,
  error,
  onPick,
  onRemove,
}: {
  currentUrl: string | null;
  uploading: boolean;
  error: string | null;
  onPick: (file: File) => void;
  onRemove: () => void;
}): React.JSX.Element {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const openPicker = () => inputRef.current?.click();

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          if (inputRef.current) inputRef.current.value = "";
        }}
        style={{ display: "none" }}
      />
      <div
        onClick={!uploading && !currentUrl ? openPicker : undefined}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: 18,
          borderRadius: 16,
          background: "rgba(0,159,239,0.06)",
          border: `1px dashed ${NEX.cyanSoft}`,
          cursor: uploading || currentUrl ? "default" : "pointer",
          transition: "background 160ms ease",
          // Sealed 2026-10-01 · HARD ceiling (height, not minHeight)
          // + overflow:hidden so NOTHING inside can push the row
          // taller. Previously the Replace+Remove column pushed the
          // middle text to wrap, which grew the row. Now locked.
          height: 132,
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        {/* Round preview with acid-green rim · when EMPTY, an
            expanding ping ring + a drop-shadow glow signal "this
            is your identity · tap here." Once a logo is set the
            ping stops and the preview sits calmly inside the
            green ring. Same visual language as the chat header
            presence indicator so sellers recognise what this
            circle MEANS in-app. */}
        <style>{`
          @keyframes nex-logo-ping {
            0%   { transform: scale(1);    opacity: 0.55; }
            70%  { transform: scale(1.42); opacity: 0; }
            100% { transform: scale(1.42); opacity: 0; }
          }
        `}</style>
        <div
          style={{
            flexShrink: 0,
            position: "relative",
            width: 96,
            height: 96,
          }}
        >
          {!currentUrl && !uploading && (
            <span
              aria-hidden
              style={{
                position: "absolute",
                inset: -3,
                borderRadius: "50%",
                border: `2px solid ${NEX.green}`,
                animation:
                  "nex-logo-ping 1600ms cubic-bezier(0.4, 0, 0.2, 1) infinite",
                pointerEvents: "none",
                willChange: "transform, opacity",
              }}
            />
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: currentUrl
                ? `url(${currentUrl}) center/cover no-repeat`
                : "rgba(0,0,0,0.4)",
              border: `2px solid ${NEX.green}`,
              boxShadow: currentUrl
                ? `0 4px 14px rgba(0,0,0,0.6)`
                : `0 0 0 4px rgba(143,255,110,0.14), 0 4px 14px rgba(0,0,0,0.6)`,
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
            }}
          >
            {!currentUrl && (
              <svg
                width={30}
                height={30}
                viewBox="0 0 24 24"
                fill="none"
                stroke={NEX.green}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="9" cy="10" r="2" />
                <path d="M21 15l-5-5-9 9" />
              </svg>
            )}
          </div>
        </div>
        {/* Right column · title + subtitle stacked tidily above the
            Remove button so the three elements read as one aligned
            group instead of being spread around the row. All items
            left-aligned, Remove sits at the end of the stack. */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: NEX.text,
              lineHeight: 1.25,
            }}
          >
            {uploading
              ? "Uploading…"
              : currentUrl
                ? "Logo set"
                : "Tap to upload a square logo"}
          </div>
          <div
            style={{
              fontSize: 11,
              color: NEX.textDim,
              lineHeight: 1.4,
            }}
          >
            PNG · JPG · WebP
          </div>
          {currentUrl && !uploading && (
            <button
              type="button"
              aria-label="Remove logo"
              title="Remove logo"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              style={{
                marginTop: 6,
                alignSelf: "flex-start",
                padding: "4px 12px",
                borderRadius: 999,
                background:
                  "linear-gradient(180deg, #B91C1C 0%, #7F1414 100%)",
                border: "1px solid rgba(255,90,90,0.5)",
                color: "#FFEDED",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                fontFamily: "inherit",
              }}
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {error && (
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: NEX.red,
            lineHeight: 1.4,
          }}
        >
          Upload failed · {error}
        </div>
      )}
      <div
        style={{
          marginTop: 12,
          fontSize: 12,
          color: NEX.textDim,
          lineHeight: 1.5,
          fontStyle: "italic",
          textAlign: "center",
        }}
      >
        A high-quality logo or face image speaks a thousand words.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LanePicker · 3 big cards (Products / Services / Maker)
// ---------------------------------------------------------------------------
function LanePicker({
  value,
  onChange,
}: {
  value: SellerLane | null;
  onChange: (next: SellerLane) => void;
}): React.JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label="Seller lane"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {LANE_ORDER.map((key) => {
        const meta = LANES[key];
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 16px",
              // Sealed 2026-10-01 · lock all three lane cards to the
              // same height regardless of caption length so the stack
              // reads as a uniform row set. minHeight = icon (48) +
              // vertical padding (28) + a hair of slack.
              minHeight: 84,
              boxSizing: "border-box",
              borderRadius: 14,
              background: active
                ? "linear-gradient(180deg, rgba(0,159,239,0.28) 0%, rgba(0,159,239,0.14) 100%), rgba(3,16,29,0.82)"
                : "linear-gradient(180deg, rgba(0,159,239,0.14) 0%, rgba(0,159,239,0.06) 100%)",
              border: active
                ? `1px solid ${NEX.cyan}`
                : `1px solid ${NEX.cyanSoft}`,
              color: NEX.text,
              cursor: "pointer",
              textAlign: "left",
              fontFamily: "inherit",
              transition:
                "background 160ms ease, border-color 160ms ease, transform 120ms ease",
            }}
          >
            <div
              style={{
                flexShrink: 0,
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "rgba(0,0,0,0.4)",
                border: `1px solid ${NEX.cyanBorder}`,
                display: "grid",
                placeItems: "center",
                color: NEX.cyan,
              }}
            >
              {key === "products" && <ProductsIcon />}
              {key === "services" && <ServicesIcon />}
              {key === "maker" && <MakerIcon />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: NEX.text,
                  letterSpacing: "0.01em",
                }}
              >
                {meta.label}
              </div>
              <div
                style={{
                  marginTop: 3,
                  fontSize: 13,
                  fontWeight: 600,
                  lineHeight: 1.4,
                  color: "#B4BAC3",
                  textShadow:
                    "0 0 2px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.5)",
                  // Reserve exactly 2 lines of vertical space on every
                  // card · 1-line captions get invisible slack, 2-line
                  // captions fit, longer captions get clipped. Combined
                  // with the card's minHeight: 84 this guarantees all
                  // three cards render at the same height.
                  minHeight: "2.8em",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {meta.caption}
              </div>
            </div>
            {active && (
              <div
                aria-hidden
                style={{
                  flexShrink: 0,
                  color: NEX.cyan,
                  fontSize: 20,
                  lineHeight: 1,
                }}
              >
                ✓
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

const primaryButtonStyle: React.CSSProperties = {
  padding: "12px 24px",
  borderRadius: 999,
  background: `linear-gradient(180deg, ${NEX.cyan} 0%, #0073b8 100%)`,
  border: "none",
  color: "#FFF",
  fontSize: 13,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(0,159,239,0.3)",
  fontFamily: "inherit",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "12px 24px",
  borderRadius: 999,
  background: "transparent",
  border: `1px solid ${NEX.borderStrong}`,
  color: NEX.text,
  fontSize: 13,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

// ---------------------------------------------------------------------------
// Lane icons
// ---------------------------------------------------------------------------
function ProductsIcon(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 7h14l-1.5 12a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8L5 7Z"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path
        d="M9 7V5a3 3 0 0 1 6 0v2"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}

function ServicesIcon(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2 L15 8 L22 9 L17 14 L18 21 L12 17 L6 21 L7 14 L2 9 L9 8 Z"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MakerIcon(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 21h18"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <path
        d="M6 21 V11 L12 7 L18 11 V21"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path
        d="M9 21 V15 H15 V21"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}
