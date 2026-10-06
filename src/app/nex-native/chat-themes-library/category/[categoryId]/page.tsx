// src/app/nex-native/chat-themes-library/category/[categoryId]/page.tsx
//
// Category Showcase Route · Step 1B (sealed 2026-10-06).
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

const NEX = {
  bg: "#020914",
  cyan: "#00AFFF",
  orange: "#FF7800",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
};

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

  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
      `}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.text,
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
              color: NEX.textMute,
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
                color: NEX.textDim,
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
                background: "rgba(16,30,52,0.6)",
                border: "1px solid rgba(139,169,209,0.18)",
                textAlign: "center",
                color: NEX.textDim,
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
