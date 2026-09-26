"use client";

// src/app/nex-native/chat/_scroll-to-bottom.tsx
//
// Auto-scrolls the message-list scroll container to the bottom on
// mount so the newest message is visible when the chat surface opens
// (or reloads after a send). Tiny client component · targets the
// element via data-nex-message-scroll attribute set on the section.

import * as React from "react";

export function ScrollToBottomOnMount() {
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
  }, []);
  return null;
}
