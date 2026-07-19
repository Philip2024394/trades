"use client";

// Template 1 Chalk — the platform default canteen layout.
//
// Composes:
//   1. ChalkHeroMobile (this folder, currently a re-export of
//      CanteenHeroWow) rendered at mobile widths.
//   2. ChalkHeroDesktop (this folder, currently a re-export of
//      CanteenHeader) rendered at desktop widths.
//   3. CanteenPageShell (shared, suppressHero=true) — body only:
//      feed, sidebar, products, modals.
//
// Both hero components are logically owned by Template 1 now (the
// re-exports mean touching them only affects Template 1's renders).
// In the next session the physical files get moved into this folder
// and the originals in src/components/xrated/yard/ deleted — real
// separation, not just symbolic.
//
// Template 2 is completely unaffected by anything in this file
// because it composes its own hero (IronHero) instead.

import type { ComponentProps } from "react";
import { useSearchParams } from "next/navigation";
import { CanteenPageShell, CanteenHeroStats } from "@/app/trade-off/yard/canteens/[slug]/CanteenPageShell";
import { ChalkHeroMobile } from "./ChalkHeroMobile";
import { ChalkHeroDesktop } from "./ChalkHeroDesktop";

export type Template1Props = ComponentProps<typeof CanteenPageShell>;

export function Template1Chalk(props: Template1Props) {
  const { canteen, admin, palette, totalProducts, heroVeilOpacity, darkMode } = props;
  // Detect the mobile-app iframe preview surface. The templates picker
  // renders the canteen inside a phone mockup via `?embed=1`. Anything
  // that is CANTEEN-PAGE-ONLY (like the Members/Products stats bar)
  // must be suppressed when embedded so the mobile app view stays
  // pure — mobile-app UI, not a mini canteen page. Philip 2026-07-17.
  const searchParams = useSearchParams();
  const isEmbedded = searchParams?.get("embed") === "1";
  // Shared props for both mobile + desktop stats bar mounts. Kept
  // here in Template.tsx (not the shell) so the stats bar is a
  // sibling of each hero — guarantees the -translate-y overlay
  // works regardless of ancestor layout.
  const heroStatsProps = {
    memberCount:      canteen.memberCount,
    reviews:          admin?.reviews ?? null,
    productsCount:    totalProducts,
    hostHasProducts:  totalProducts > 0,
    hostWhatsapp:     admin?.whatsapp ?? null,
    hostSlug:         canteen.hostSlug,
    hostDisplayName:  canteen.hostDisplayName,
    tradeLabel:       canteen.tradeLabel,
    canteenSlug:      canteen.slug,
    canteenName:      canteen.name
  };

  // Sync the hero's palette with the shell's dark-mode toggle. When
  // ?theme_mode=dark is on, the shell flips its page bg to near-black
  // — the hero cream veils must match or you get a black page above
  // a cream hero (Philip 2026-07-16: "when dark mode active both
  // page bg AND hero overlay turn black together"). We flip only bg
  // + text; accent/heroLastWord stay so the palette identity survives.
  const effectivePalette = darkMode && palette
    ? {
        ...palette,
        bg:         "#0A0A0A",
        text:       "#F5F0E4",
        mutedText:  "#B8B0A0",
        dark:       true
      }
    : palette;

  return (
    <>
      {/* Mobile hero + overlaid stats bar. Wrapper is `relative` so
          the stats bar can be positioned absolute at the bottom edge
          of the hero — guaranteed overlay, no dependency on outer
          margins or sibling shadows. */}
      <div className="relative lg:hidden">
        <ChalkHeroMobile
          canteen={canteen}
          hostWhatsapp={admin?.whatsapp ?? null}
          hostReviews={admin?.reviews ?? null}
          hostAvatarUrl={admin?.avatarUrl ?? null}
          addressLine={admin?.showroom?.addressLine ?? null}
          postcode={admin?.showroom?.postcode ?? null}
          city={admin?.city ?? null}
          palette={effectivePalette}
          veilOpacity={heroVeilOpacity}
        />
        {!isEmbedded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 translate-y-1/2">
            <div className="pointer-events-auto">
              <CanteenHeroStats {...heroStatsProps}/>
            </div>
          </div>
        )}
      </div>

      {/* Desktop hero + overlaid stats bar. Same absolute-overlay
          pattern as mobile so behaviour is identical across
          breakpoints. */}
      <div className="relative hidden lg:block">
        <ChalkHeroDesktop
          canteen={canteen}
          hostWhatsapp={admin?.whatsapp ?? null}
          hostReviews={admin?.reviews ?? null}
          hostAvatarUrl={admin?.avatarUrl ?? null}
          hostHasProducts={totalProducts > 0}
          onInvite={() => { /* wired via shell in a follow-up */ }}
          onPost={() => { /* wired via shell in a follow-up */ }}
          onJoin={async () => {}}
          onLeave={async () => {}}
          paletteDark={effectivePalette?.dark ?? false}
        />
        {!isEmbedded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 translate-y-1/2">
            <div className="pointer-events-auto">
              <CanteenHeroStats {...heroStatsProps}/>
            </div>
          </div>
        )}
      </div>

      {/* Spacer — only needed when the stats bar is overlaid (i.e. NOT
          embedded). Skipped in the mobile app preview so it doesn't
          push the body down needlessly. */}
      {!isEmbedded && <div className="h-11 lg:h-14"/>}

      {/* Shell body — hero suppressed so Template 1 is the only hero
          source on screen. Feed, sidebar, products, modals all still
          render from the shared shell. */}
      <CanteenPageShell {...props} suppressHero />
    </>
  );
}
