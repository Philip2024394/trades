"use client";

// SiteBookMobileShell — client wrapper that swaps the desktop 3-column
// (or 2-column) layout for a mobile-native shell:
//   • Rails are hidden on mobile (md:hidden trick on desktop children)
//   • Feed area gets padded-bottom so the last card isn't hidden by
//     the fixed bottom nav
//   • Bottom nav manages the pull-up sheets for Trades / Photos
//   • + Post scrolls to the composer
//
// Usage: server page renders the layout children; wraps everything in
// this shell + passes the same rail contents (they're rendered in the
// sheets on mobile, in the aside on desktop).

import { useRef, useState } from "react";
import { SiteBookMobileNav, type MobileSheetKey } from "./SiteBookMobileNav";

export function SiteBookMobileShell({
  desktopLayout,
  mobileFeed,
  mobileTradesContent,
  mobilePhotosContent
}: {
  /** Full desktop layout (3-col / 2-col). Hidden on mobile via
   *  the class="hidden md:block" wrapper we apply below. */
  desktopLayout:       React.ReactNode;
  /** Mobile-only single-column feed (feed cards + composer). */
  mobileFeed:          React.ReactNode;
  /** Content for the Trades pull-up sheet. Usually SiteBookInboxPanel. */
  mobileTradesContent: React.ReactNode;
  /** Content for the Photos pull-up sheet. Usually SiteBookGalleryCard. */
  mobilePhotosContent: React.ReactNode;
}) {
  const [openSheet, setOpenSheet] = useState<MobileSheetKey>(null);
  const composerAnchorRef         = useRef<HTMLDivElement | null>(null);

  function focusComposer() {
    if (composerAnchorRef.current) {
      composerAnchorRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      // Focus the first input inside the composer anchor
      setTimeout(() => {
        const first = composerAnchorRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
        first?.focus();
      }, 350);
    }
  }

  return (
    <>
      {/* Desktop — full 3/2-column layout */}
      <div className="hidden md:block">
        {desktopLayout}
      </div>

      {/* Mobile — single column with composer anchor + padded bottom */}
      <div className="md:hidden">
        <div ref={composerAnchorRef}>
          {mobileFeed}
        </div>
        {/* Space so last card clears the fixed 56px bottom nav */}
        <div style={{ height: "calc(80px + env(safe-area-inset-bottom))" }} aria-hidden/>
      </div>

      {/* Bottom nav — only visible on mobile */}
      <SiteBookMobileNav
        openSheet={openSheet}
        onSheetChange={setOpenSheet}
        onComposeFocus={focusComposer}
        tradesContent={mobileTradesContent}
        photosContent={mobilePhotosContent}
      />
    </>
  );
}
