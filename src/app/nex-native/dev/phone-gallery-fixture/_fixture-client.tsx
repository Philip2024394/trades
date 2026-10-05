"use client";

// Client wrapper for the Phase 1 dev fixture. Owns the no-op onOpen
// handler so the Server Component gate above can render a Client
// Component tree. The handler is deliberately a no-op · the fixture
// exists for responsive/a11y verification only, not preview-flow
// verification.

import * as React from "react";
import type { BrowserThemeRow } from "../../chat-themes-library/_theme-browser-client";
import { PhoneGrid } from "../../chat-themes-library/_phone-tile";

export function PhoneGalleryFixtureBody({
  themes,
  currentThemeId,
  canUsePremium,
}: {
  themes: BrowserThemeRow[];
  currentThemeId: string;
  canUsePremium: boolean;
}): React.JSX.Element {
  const openedRef = React.useRef<string | null>(null);
  const handleOpen = React.useCallback((id: string) => {
    openedRef.current = id;
    // Surface the last-opened id in a data attribute so Playwright can
    // assert that keyboard activation / click dispatched correctly
    // without needing the real preview modal in scope.
    document.body.dataset.nexFixtureLastOpen = id;
  }, []);
  return (
    <PhoneGrid
      themes={themes}
      currentThemeId={currentThemeId}
      canUsePremium={canUsePremium}
      onOpen={handleOpen}
    />
  );
}
