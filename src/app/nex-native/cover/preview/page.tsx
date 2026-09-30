// src/app/nex-native/cover/preview/page.tsx
//
// Cover Template Gallery · Founder-set 2026-09-30.
// -----------------------------------------------------------------------------
// Numbered picker for the 10 sealed cover templates. Each card shows
// its number, its layout name, and a one-line description of the
// information architecture that makes it distinct. Tapping any card
// opens /nex-native/cover/preview/{layoutId} where the founder can
// see the template rendered under the current theme and iterate on
// its design.
//
// A theme dropdown at the top switches every card's live preview URL
// so the whole gallery renders under the picked theme without a page
// reload (the `?theme=` query flows through to each preview route).
//
// This is a preview-only surface · no auth · no DB writes.

import Link from "next/link";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";
import { COVER_LAYOUT_IDS, COVER_LAYOUT_LABELS } from "../layout-ids";
import type { CoverLayoutId } from "../layout-ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  text: "#F2F5F8",
  textDim: "#7D9BC0",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
  border: "rgba(139, 169, 209, 0.14)",
};

/** One-line description of each template's information architecture ·
 *  what the founder sees when picking which layout to work on. */
const COVER_LAYOUT_BLURB: Record<CoverLayoutId, string> = {
  cafe:
    "Portrait-half hero · Featured Today grid · Visit Us panel with Google Maps directions",
  restaurant:
    "Full-photo hero · menu sections (small plates + signature mains) · reservation-first CTA",
  product:
    "Product-hero card · 2-column shop grid · shipping-first identity",
  tradesperson:
    "Portrait + trade badges · services list · before/after gallery",
  salon:
    "Signature look photo · services list · client reviews",
  creator:
    "Circular portrait · mixed grid (products + services + links)",
  fashion:
    "Full-viewport carousel · big cards · fit-guide CTA",
  street_food:
    "Dish hero · dish rows · running cart · order-in-chat",
  premium_business:
    "Weighted display name · services + case studies + team credits",
  personal_brand:
    "Half-portrait hero · balanced products + services + content mix",
  product_landscape:
    "Same identity as Template 03 · landscape product cards · 6 per page",
};

/** Founder direction 2026-09-30 · templates flagged as "done" show a
 *  green tick + Done chip on the gallery card so the admin sees at a
 *  glance which templates are shipped vs still in design. Toggle a
 *  layout id in this set to update the badge. */
const COVER_LAYOUT_DONE: ReadonlySet<CoverLayoutId> = new Set<CoverLayoutId>([
  "product",
  "product_landscape",
]);

const DEFAULT_THEME = "pink-dream";

export default async function CoverPreviewGallery({
  searchParams,
}: {
  searchParams?: Promise<{ theme?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const themeId = sp.theme ?? DEFAULT_THEME;

  // Pull the active theme list so the founder can jump the whole
  // gallery to a different theme without hand-editing URLs.
  const themes = await chatThemeService.listActiveThemes().catch(() => []);
  const currentTheme = themes.find((t) => t.id === themeId) ?? null;

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        padding: "24px 20px 48px",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <header style={{ marginBottom: 22 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: NEX.cyan,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            Bridge 98 · Founder-sealed 2026-09-30
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            Cover Templates · {COVER_LAYOUT_IDS.length}
          </h1>
          <p
            style={{
              marginTop: 8,
              color: NEX.textDim,
              fontSize: 13,
              lineHeight: 1.55,
              maxWidth: 720,
            }}
          >
            Ten information-architecture patterns · one visual identity
            system (the account&apos;s chat theme). Pick a template number
            to open it in the design preview. Every layout carries the same
            primitives (composer footer, category tabs, info tray, product
            cards) — what changes is only the composition.
          </p>

          {/* Theme picker · flows the ?theme= query into every card link
              below so the whole gallery repaints under the picked theme. */}
          {themes.length > 0 && (
            <div
              style={{
                marginTop: 16,
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: NEX.textDim,
                  fontWeight: 700,
                }}
              >
                Theme
              </div>
              <form
                method="get"
                action="/nex-native/cover/preview"
                style={{ display: "inline-flex", gap: 8 }}
              >
                <select
                  name="theme"
                  defaultValue={themeId}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    background: NEX.panel,
                    border: `1px solid ${NEX.border}`,
                    color: NEX.text,
                    fontSize: 12,
                    fontFamily: "inherit",
                  }}
                >
                  {themes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name} ({t.id})
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "none",
                    background: NEX.cyan,
                    color: NEX.bg,
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  APPLY
                </button>
              </form>
              {currentTheme && (
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: currentTheme.accent_hex,
                    boxShadow: `0 0 8px ${currentTheme.accent_hex}55`,
                    border: `1px solid ${currentTheme.accent_hex}`,
                  }}
                />
              )}
            </div>
          )}
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          {COVER_LAYOUT_IDS.map((id, i) => {
            const num = String(i + 1).padStart(2, "0");
            const isDone = COVER_LAYOUT_DONE.has(id);
            const href = `/nex-native/cover/preview/${id}?theme=${encodeURIComponent(themeId)}`;
            return (
              <Link
                key={id}
                href={href}
                style={{
                  display: "block",
                  padding: "18px 18px 16px",
                  borderRadius: 14,
                  background: NEX.panel,
                  border: isDone
                    ? "1px solid rgba(34,197,94,0.55)"
                    : `1px solid ${NEX.cyanSoft}`,
                  textDecoration: "none",
                  color: NEX.text,
                  position: "relative",
                  boxShadow: isDone
                    ? "0 0 0 1px rgba(34,197,94,0.15), 0 8px 20px rgba(34,197,94,0.08)"
                    : undefined,
                }}
              >
                {/* Big template number + optional Done tick · corner cluster */}
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 14,
                    right: 14,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {isDone && (
                    <span
                      aria-label="Template complete"
                      title="Template complete"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "3px 8px 3px 6px",
                        borderRadius: 999,
                        background: "rgba(34,197,94,0.14)",
                        border: "1px solid rgba(34,197,94,0.55)",
                        color: "#22C55E",
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        lineHeight: 1,
                      }}
                    >
                      <svg
                        width={12}
                        height={12}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <polyline points="5 12 10 17 20 7" />
                      </svg>
                      Done
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      letterSpacing: "0.02em",
                      color: isDone ? "#22C55E" : NEX.cyan,
                      opacity: 0.9,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {num}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: NEX.cyan,
                    fontWeight: 700,
                  }}
                >
                  Template
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: "-0.005em",
                    paddingRight: 36,
                  }}
                >
                  {COVER_LAYOUT_LABELS[id]}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: NEX.textDim,
                    lineHeight: 1.5,
                    minHeight: 54,
                  }}
                >
                  {COVER_LAYOUT_BLURB[id]}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: NEX.textMute,
                      fontFamily: "ui-monospace, monospace",
                    }}
                  >
                    /{id}
                  </span>
                  <span
                    style={{
                      padding: "5px 12px",
                      borderRadius: 999,
                      background: NEX.orange,
                      color: "#0B0F1A",
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    Open design →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 28,
            padding: "14px 16px",
            borderRadius: 12,
            border: `1px dashed ${NEX.border}`,
            fontSize: 12,
            color: NEX.textDim,
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: NEX.text }}>Doctrine.</strong> The layout
          provides information architecture. The theme (chat_theme)
          provides visual identity. The owner&apos;s content provides
          personality. Together they compose the NEX cover — never a
          website template.
        </div>
      </div>
    </main>
  );
}
