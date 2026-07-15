// /tc — Trade Center workspace layout.
//
// The workspace shell (Primary Rail + Palette + Copilot) wraps
// module-level pages so users get consistent module navigation. It's
// opted out on marketplace routes where the App has its own header +
// category rail per the marketplace mock — no double-rail on the
// left. The palette + copilot stay reachable via ⌘K + ⌘\ from any
// route through the WorkspaceShell mount on the module routes.

"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { bootstrapPlatform } from "@/platform/bootstrap";
import { WorkspaceShell } from "@/platform/shell";
// ComposerFAB intentionally not imported — the yellow round "post
// something" FAB opens the Universal Composer, which targets Yard and
// Trade Counter (both live outside /tc/*). Having a compose-social FAB
// float on Trade Center marketplace + cart + checkout + orders pages
// was a category confusion — Trade Center is about BUYING, not
// posting. The Universal Composer is still available inline on
// /tc/hub for trades who want it, and lives on /trade-off/yard where
// posting is the primary action.
// DashboardRail also intentionally not imported — the persistent
// right-edge rail is retired in favour of the header burger +
// GlobalIdentityChip covering nav. Stat tiles live on the Hub page.
// Component files kept in the codebase in case they need to be
// re-mounted somewhere specific later.
import { LeftMenuRail } from "@/apps/hub/components/LeftMenuRail";
import { CategoriesEdgeRail } from "@/apps/hub/components/CategoriesEdgeRail";
import { LocationOnboardingModal } from "@/apps/onboarding/components/LocationOnboardingModal";
import { TradeAuthGuard } from "@/apps/hub/components/TradeAuthGuard";
import { SignInPromptProvider } from "@/apps/tradecenter/components/SignInPromptModal";
import { useIsTrade } from "@/apps/hub/lib/useIsTrade";

// Register demo Apps once per client boot. Server-side bootstrap
// happens the first time any /tc route renders.
bootstrapPlatform();

export default function TradeCenterLayout({
  children
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  // Constitutional gate — DIY viewers get a stripped chrome. The
  // LeftMenuRail (Trade Counter / Site Projects sections) mounts only
  // for trades. The dashboard rail and composer FAB are unmounted for
  // everyone on /tc/* (see import comments above).
  const isTrade = useIsTrade();
  // Sign-in / sign-up / complete-identity render as clean marketing-style
  // surfaces with no workspace chrome. Skips the composer FAB, left/right
  // edge rails, and the location onboarding modal.
  const isUnauthenticatedSurface =
    pathname?.startsWith("/tc/sign-in") ||
    pathname?.startsWith("/tc/complete-identity");
  if (isUnauthenticatedSurface) {
    return <TradeAuthGuard>{children}</TradeAuthGuard>;
  }
  const isMarketplaceRoute = pathname?.startsWith("/tc/trade-center") ?? false;
  const isIdentityRoute = pathname?.startsWith("/tc/identity") ?? false;
  const isApplyRoute = pathname?.startsWith("/tc/apply") ?? false;
  const isConfidenceRoute = pathname?.startsWith("/tc/confidence") ?? false;
  const isNotebookRoute = pathname?.startsWith("/tc/notebook") ?? false;
  const isJobsRoute = pathname?.startsWith("/tc/jobs") ?? false;
  const isMerchantAdminRoute = pathname?.startsWith("/tc/merchant-admin") ?? false;
  const isMessagesRoute = pathname?.startsWith("/tc/messages") ?? false;
  const isCheckoutRoute = pathname?.startsWith("/tc/checkout") ?? false;
  const isCartRoute = pathname?.startsWith("/tc/cart") ?? false;
  const isHelpRoute = pathname?.startsWith("/tc/help") ?? false;
  const isSettingsRoute = pathname?.startsWith("/tc/settings") ?? false;
  const isOrdersRoute = pathname?.startsWith("/tc/orders") ?? false;
  const isRatesRoute = pathname?.startsWith("/tc/rates") ?? false;
  const isRoutesRoute = pathname?.startsWith("/tc/routes") ?? false;
  // isSiteRoute removed — /tc/site voice-capture surface deleted.
  const isTradeRoute = pathname?.startsWith("/tc/trade") ?? false;
  const isTradesRoute = pathname?.startsWith("/tc/trades") ?? false;
  const isHubRoute = pathname?.startsWith("/tc/hub") ?? false;
  const isJobBoardRoute = pathname?.startsWith("/tc/job-board") ?? false;
  const isPostJobRoute = pathname?.startsWith("/tc/post-job") ?? false;
  const isDealsRoute = pathname?.startsWith("/tc/deals") ?? false;
  const isFavouritesRoute = pathname?.startsWith("/tc/favourites") ?? false;
  const isTradeCounterRoute = pathname?.startsWith("/tc/trade-counter") ?? false;

  // All marketplace-adjacent flows use the marketplace-style header (no
  // workspace shell). The consent screen in particular is customer-facing
  // and must not expose Trade Center's internal workspace navigation to
  // a homeowner arriving via a shared link.
  if (
    isMarketplaceRoute ||
    isIdentityRoute ||
    isApplyRoute ||
    isConfidenceRoute ||
    isNotebookRoute ||
    isJobsRoute ||
    isMerchantAdminRoute ||
    isMessagesRoute ||
    isCheckoutRoute ||
    isCartRoute ||
    isHelpRoute ||
    isSettingsRoute ||
    isOrdersRoute ||
    isRatesRoute ||
    isRoutesRoute ||
    isTradeRoute ||
    isTradesRoute ||
    isHubRoute ||
    isJobBoardRoute ||
    isPostJobRoute ||
    isDealsRoute ||
    isFavouritesRoute ||
    isTradeCounterRoute
  ) {
    return (
      <TradeAuthGuard>
        <SignInPromptProvider>
          {children}
          {/* ComposerFAB unmounted — see import comment above. Trade
              Center pages are for buying, not composing social posts. */}
          {/* DashboardRail unmounted — the header burger + GlobalIdentityChip
              now cover all nav destinations, and stat tiles live on the Hub
              page (/tc/hub) not floating on every page. Persistent right-edge
              chrome felt Facebook-dense; benchmark is Linear/Stripe/Notion
              where the header is the persistent nav surface. */}
          {/* Trade Center browse pages get the Categories edge tab; every
              other /tc route keeps the Notebook rail (trade-only). DIY
              viewers on non-marketplace routes get no left rail — the
              header menu carries their nav. */}
          {isMarketplaceRoute
            ? <CategoriesEdgeRail/>
            : isTrade
              ? <LeftMenuRail/>
              : null}
          <LocationOnboardingModal/>
        </SignInPromptProvider>
      </TradeAuthGuard>
    );
  }

  return (
    <TradeAuthGuard>
      <SignInPromptProvider>
        <WorkspaceShell basePath="/tc">{children}</WorkspaceShell>
      </SignInPromptProvider>
    </TradeAuthGuard>
  );
}
