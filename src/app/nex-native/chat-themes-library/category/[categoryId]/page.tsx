// src/app/nex-native/chat-themes-library/category/[categoryId]/page.tsx
//
// Category Showcase Route · Step 1B (sealed 2026-10-06).
// Universal Theme Colour Rule applied 2026-10-06 (Step 2 follow-up).
//
// Shows every World belonging to a given category. Reuses the
// existing `ThemeBrowserClient` so the world-level presentation /
// preview / handoff behaviour is byte-identical to the current
// Library · this route is navigation + filtering, not a second
// renderer.
//
// URL shape:
//
//   /nex-native/chat-themes-library/category/[categoryId]
//
// Behaviour:
//
//   · categoryId is a registered id → render the category's name /
//     tagline / icon header + the filtered ThemeBrowserClient
//   · categoryId is not registered → notFound() (404)
//   · category has zero worlds → render the header + an empty-state
//     message instead of the grid
//
// Architectural guards (regression-tested):
//
//   · Zero per-category UI branches · the route's rendering is a
//     pure function of the ThemeCategory + filtered worlds array ·
//     the guard regex in `_category-grid.test.ts` enforces that no
//     surface compares a category id against a specific string
//     literal.
//   · Preserves the universal theme handoff `themePreviewHref(id)`
//     because the filtered worlds flow into the SAME
//     ThemeBrowserClient that already uses it
//   · Does NOT reintroduce any iframe grid or allowlist pattern
//   · Does NOT touch _standard-experience.tsx, Theme Engine, Theme
//     Brain, DB schema, or any Step 2 / Step 3 territory
//   · UNIVERSAL THEME COLOUR RULE (sealed 2026-10-06): every wrapper
//     surface here (page bg · back-link · header · tagline · empty-
//     state card) derives from `category.colours`. There is NO
//     generic NEX palette in this file. Ocean room reads blue; Café
//     room reads warm brown; Explore reads NEX-default (coherent
//     with its uncategorised bucket role). Guarded by
//     `_category-page-colours.test.ts`.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCategory } from "@/lib/nex-native/theme-category/registry";
import {
  loadLibraryData,
} from "../../_load-library-data";
import { ThemeBrowserClient } from "../../_theme-browser-client";
import { updateChatThemeAction } from "../../../_actions";
import { NexPageHeader } from "../../../_page-header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CategoryShowcasePage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;
  const category = getCategory(categoryId);
  if (!category) notFound();

  const data = await loadLibraryData();
  if (data.kind === "unauthenticated") redirect("/nex-native/sign-in");

  // Pure filter · no per-category logic · the showcase renders
  // whatever worlds the merged collection currently assigns to this
  // category_id. Zero-member categories render an empty-state copy.
  const worlds = data.browserThemes.filter((t) => t.category_id === category.id);

  // Universal Theme Colour Rule · the entire wrapper atmosphere is
  // derived from the registered category palette · every room feels
  // like its own world, never like generic NEX chrome. The category
  // registry's `Required<ColourSystem>` typing guarantees every slot
  // is present so no `??` fallback (which would silently re-introduce
  // the generic palette the rule forbids) is needed.
  const palette = category.colours;
  const bg = palette.deep;
  const text = palette.highlight;
  const accent = palette.primary;
  const dim = palette.secondary;

  return (
    <>
      <style>{`
        html, body { background: ${bg} !important; }
      `}</style>
      <main
        data-nex-category-page
        data-nex-category-id={category.id}
        style={{
          minHeight: "100dvh",
          background: bg,
          color: text,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "20px 16px 40px",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <NexPageHeader dataScope="settings-theme" />

          <Link
            href="/nex-native/chat-themes-library"
            prefetch={false}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 10,
              fontSize: 11,
              color: dim,
              textDecoration: "none",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            ← All categories
          </Link>

          <h1
            data-nex-category-header
            data-nex-category-id={category.id}
            style={{
              margin: "14px 0 6px",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: text,
            }}
          >
            {category.icon && (
              <span aria-hidden style={{ fontSize: 28, lineHeight: 1 }}>
                {category.icon}
              </span>
            )}
            {category.name}
          </h1>
          {category.tagline && (
            <p
              style={{
                margin: "0 0 18px",
                fontSize: 13,
                color: dim,
                lineHeight: 1.55,
              }}
            >
              {category.tagline}
            </p>
          )}

          {worlds.length === 0 ? (
            <div
              data-nex-category-empty
              style={{
                marginTop: 20,
                padding: "28px 20px",
                borderRadius: 14,
                // Empty-state card uses a tinted-dark fill derived
                // from the theme accent · never generic NEX blue.
                background: bg,
                border: `1px solid ${accent}`,
                textAlign: "center",
                color: dim,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              No worlds in this category yet.
            </div>
          ) : (
            <ThemeBrowserClient
              themes={worlds}
              currentThemeId={data.currentThemeId}
              canUsePremium={data.canUsePremium}
              activateAction={updateChatThemeAction}
              viewerAvatarUrl={data.viewerAvatarUrl}
              usePhoneTiles={data.usePhoneTiles}
              useImmersivePreview={data.useImmersivePreview}
            />
          )}
        </div>
      </main>
    </>
  );
}
