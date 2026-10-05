"use client";

// Phase 2 end-to-end flow fixture · mounts the REAL ThemeBrowserClient
// with both Phase 1 (NEX_THEMES_PHONE_TILES) and Phase 2
// (NEX_THEMES_IMMERSIVE_PREVIEW) switched on, backed by hard-coded
// themes and a stub activation action. Lets Playwright walk the full
// user journey — gallery discovery → tile tap → immersive preview →
// activation → close → URL round-trip — without requiring an
// authenticated session on the real route.

import * as React from "react";
import { ThemeBrowserClient } from "../../chat-themes-library/_theme-browser-client";
import type { BrowserThemeRow } from "../../chat-themes-library/_theme-browser-client";

export function ThemesFlowFixtureBody({
  themes,
  currentThemeId,
  canUsePremium,
}: {
  themes: BrowserThemeRow[];
  currentThemeId: string;
  canUsePremium: boolean;
}): React.JSX.Element {
  const activateAction = React.useCallback(async (fd: FormData) => {
    const id = String(fd.get("chat_theme") ?? "");
    document.body.dataset.nexFlowActivated = id;
  }, []);

  return (
    <ThemeBrowserClient
      themes={themes}
      currentThemeId={currentThemeId}
      canUsePremium={canUsePremium}
      activateAction={activateAction}
      viewerAvatarUrl={null}
      usePhoneTiles={true}
      useImmersivePreview={true}
    />
  );
}
