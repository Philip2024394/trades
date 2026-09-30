// src/app/nex-native/cover/preview/[layoutId]/page.tsx
//
// Dynamic layout preview · Founder-set 2026-09-30 · Bridge 98.
// -----------------------------------------------------------------------------
// Renders a single sealed cover template inside the PhoneFrame. A small
// header pill above the frame tells the founder which template number
// they're on (01-10), its name, the current theme, and links back to
// the numbered gallery.

import Link from "next/link";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";
import { CoverThemeSkin } from "../../theme-skin";
import { CoverLayoutSwitch } from "../../layout-switch";
import {
  COVER_LAYOUT_IDS,
  COVER_LAYOUT_LABELS,
  isValidCoverLayoutId,
} from "../../layout-ids";
import { MARIA_MOCK } from "../../mock-data";
import { PhoneFrame } from "../_phone-frame";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_THEME = "pink-dream";

const HEADER_STYLE: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 50,
  padding: "12px 16px",
  background:
    "linear-gradient(180deg, rgba(2,7,14,0.94), rgba(2,7,14,0.72))",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  borderBottom: "1px solid rgba(0,175,255,0.22)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  color: "#F2F5F8",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

export default async function CoverLayoutPreview({
  params,
  searchParams,
}: {
  params: Promise<{ layoutId: string }>;
  searchParams?: Promise<{ theme?: string }>;
}) {
  const { layoutId } = await params;
  const sp = (await searchParams) ?? {};

  if (!isValidCoverLayoutId(layoutId)) {
    return (
      <pre
        style={{
          padding: 24,
          color: "#F2F5F8",
          background: "#020914",
          fontFamily: "ui-monospace, monospace",
          minHeight: "100dvh",
          margin: 0,
          whiteSpace: "pre-wrap",
        }}
      >
        Unknown cover layout id: [{String(layoutId)}]{"\n"}
        Valid: {COVER_LAYOUT_IDS.join(", ")}
      </pre>
    );
  }

  const themeId = sp.theme ?? DEFAULT_THEME;
  const theme = await chatThemeService.getThemeById(themeId);
  if (!theme || !theme.is_active) {
    return (
      <pre
        style={{
          padding: 24,
          color: "#F2F5F8",
          background: "#020914",
          fontFamily: "ui-monospace, monospace",
          minHeight: "100dvh",
          margin: 0,
        }}
      >
        Theme not found or inactive: {themeId}
      </pre>
    );
  }

  const themes = await chatThemeService.listActiveThemes().catch(() => []);
  const templateNumber =
    String(COVER_LAYOUT_IDS.indexOf(layoutId) + 1).padStart(2, "0");
  const templateName = COVER_LAYOUT_LABELS[layoutId];

  return (
    <>
      {/* Design header · founder always knows which template + theme
          they're working on, and can jump back to the gallery. */}
      <header style={HEADER_STYLE}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            minWidth: 0,
          }}
        >
          <Link
            href="/nex-native/cover/preview"
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              background: "transparent",
              border: "1px solid rgba(0,175,255,0.35)",
              color: "#00AFFF",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            ‹ All templates
          </Link>
          <div
            style={{
              display: "inline-flex",
              alignItems: "baseline",
              gap: 10,
              minWidth: 0,
            }}
          >
            <span
              aria-hidden
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "#00AFFF",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {templateNumber}
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "-0.005em",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {templateName}
            </span>
          </div>
        </div>
        {/* Theme picker · switches which theme paints the preview. */}
        {themes.length > 1 && (
          <form
            method="get"
            style={{ display: "inline-flex", gap: 6, flexShrink: 0 }}
          >
            <select
              name="theme"
              defaultValue={themeId}
              style={{
                padding: "5px 8px",
                borderRadius: 6,
                background: "#03101D",
                border: "1px solid rgba(0,175,255,0.35)",
                color: "#F2F5F8",
                fontSize: 11,
                fontFamily: "inherit",
              }}
            >
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.display_name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              style={{
                padding: "5px 10px",
                borderRadius: 6,
                border: "none",
                background: "#00AFFF",
                color: "#02070E",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.06em",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              APPLY
            </button>
          </form>
        )}
      </header>

      <PhoneFrame>
        <CoverThemeSkin
          accentHex={theme.accent_hex}
          bubbleRimHex={theme.bubble_rim_hex}
          composerRimHex={theme.composer_rim_hex}
          wallpaperUrl={theme.hero_image_url}
          wallpaperConfig={theme.wallpaper_config}
          themeId={theme.id}
          layoutId={layoutId}
        >
          <CoverLayoutSwitch
            layoutId={layoutId}
            content={MARIA_MOCK}
            themeId={theme.id}
          />
        </CoverThemeSkin>
      </PhoneFrame>
    </>
  );
}
