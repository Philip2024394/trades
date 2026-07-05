// LayoutShell — the reusable page frame.
//
// Every layout recipe wraps this: sticky top nav + main content
// slot + optional mobile sticky bottom action bar + optional footer.

"use client";

import type { ComponentType, ReactNode } from "react";
import { StickyBottomActionBar } from "../nav/StickyBottomActionBar";
import { StickyTopNav } from "../nav/StickyTopNav";
import type { MobileNavLink } from "../nav/MobileNavDrawer";

export type LayoutShellProps = {
  /** Brand label + icon rendered on the top-left of the nav. */
  brand: {
    name: string;
    icon?: ComponentType<{ className?: string }>;
    href?: string;
  };
  /** Nav links — both desktop links AND mobile drawer entries. */
  navLinks?: readonly MobileNavLink[];
  /** Desktop-visible CTA in the top nav (usually the primary action). */
  desktopCta?: ReactNode;
  /** Drawer footer — usually primary + secondary CTA for mobile. */
  drawerFooter?: ReactNode;
  /** Optional sticky bottom action bar (mobile only). */
  bottomBarLeft?: ReactNode;
  bottomBarRight?: ReactNode;
  /** Optional footer content. */
  footer?: ReactNode;
  /** Optional above-nav banner (Golden Path callout, emergency
   *  strip, cookie banner). */
  topBanner?: ReactNode;
  children: ReactNode;
};

export function LayoutShell({
  brand,
  navLinks,
  desktopCta,
  drawerFooter,
  bottomBarLeft,
  bottomBarRight,
  footer,
  topBanner,
  children
}: LayoutShellProps) {
  const hasBottomBar = Boolean(bottomBarLeft || bottomBarRight);
  return (
    <div className="min-h-screen bg-neutral-50">
      {topBanner ? topBanner : null}
      <StickyTopNav
        brandLabel={brand.name}
        brandIcon={brand.icon}
        brandHref={brand.href}
        links={navLinks ?? []}
        desktopCta={desktopCta}
        drawerFooter={drawerFooter}
      />
      <main>{children}</main>
      {footer ? footer : null}
      {hasBottomBar ? (
        <StickyBottomActionBar
          left={bottomBarLeft}
          right={bottomBarRight ?? <span />}
        />
      ) : null}
    </div>
  );
}
