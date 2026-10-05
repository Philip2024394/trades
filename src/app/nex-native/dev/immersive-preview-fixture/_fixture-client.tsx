"use client";

// Phase 2 dev fixture client · mounts ImmersivePreviewShell with a
// configurable theme pulled from the fixture catalogue + an in-memory
// activation action. The real activateAction would hit the server;
// here we record the call on document.body for Playwright to assert.
//
// Dev-only · gated by the server page component · do not import outside
// of the fixture.

import * as React from "react";
import type { BrowserThemeRow } from "../../chat-themes-library/_theme-browser-client";
import { ImmersivePreviewShell } from "../../chat-themes-library/_preview-shell";

export function ImmersivePreviewFixtureBody({
  themes,
  initialIndex,
  canUsePremium,
}: {
  themes: BrowserThemeRow[];
  initialIndex: number;
  canUsePremium: boolean;
}): React.JSX.Element {
  const [index, setIndex] = React.useState(initialIndex);
  const [closed, setClosed] = React.useState(false);
  const theme = themes[index];
  const prevIndex = index > 0 ? index - 1 : null;
  const nextIndex = index < themes.length - 1 ? index + 1 : null;

  // Stub activateAction · the fixture never hits the server. Record the
  // attempted theme id on document.body so Playwright can assert the
  // CTA fires correctly.
  const activateAction = React.useCallback(async (fd: FormData) => {
    const id = String(fd.get("chat_theme") ?? "");
    document.body.dataset.nexFixtureActivated = id;
  }, []);

  if (closed) {
    return (
      <div
        data-nex-immersive-fixture-closed=""
        style={{ padding: 40, color: "#F4F7FC" }}
      >
        Preview closed.
      </div>
    );
  }

  if (!theme) {
    return (
      <div style={{ padding: 40, color: "#F4F7FC" }}>No theme at index {index}.</div>
    );
  }

  return (
    <ImmersivePreviewShell
      theme={theme}
      active={theme.id === "fx-free-active"}
      locked={theme.tier === "bisnis" && !canUsePremium}
      canUsePremium={canUsePremium}
      activateAction={activateAction}
      onClose={() => {
        document.body.dataset.nexFixtureClosed = "1";
        setClosed(true);
      }}
      onPrev={
        prevIndex !== null
          ? () => {
              document.body.dataset.nexFixtureNavigated = String(prevIndex);
              setIndex(prevIndex);
            }
          : null
      }
      onNext={
        nextIndex !== null
          ? () => {
              document.body.dataset.nexFixtureNavigated = String(nextIndex);
              setIndex(nextIndex);
            }
          : null
      }
      prevLabel={prevIndex !== null ? (themes[prevIndex]?.name ?? null) : null}
      nextLabel={nextIndex !== null ? (themes[nextIndex]?.name ?? null) : null}
      openFullScreenHref={null}
    />
  );
}
