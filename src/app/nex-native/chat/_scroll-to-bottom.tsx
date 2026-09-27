"use client";

// src/app/nex-native/chat/_scroll-to-bottom.tsx
//
// Auto-scrolls the message-list scroll container to the bottom when
// mounted AND whenever the message count changes. The change trigger
// matters because Next.js App Router does soft navigation on Server
// Action redirects · the client component stays mounted, so a
// mount-only effect won't fire after a send. Passing the current
// message count as a dependency solves that.

import * as React from "react";

export function ScrollToBottomOnMount({
  signal,
}: {
  /** Any value that changes when new content arrives (typically
   *  messages.length). Effect re-runs on every change. */
  signal?: number | string;
}) {
  React.useEffect(() => {
    const el = document.querySelector<HTMLElement>(
      "[data-nex-message-scroll]",
    );
    if (!el) return;
    // Two-frame delay lets the layout settle (images loading, backdrop
    // filters applying) before we jump.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    });
  }, [signal]);
  return null;
}
