// src/lib/nexapp/useVirtualKeyboard.ts
//
// NEX Input Dock · Phase 2 (2026-08-23) · Visual Viewport API hook.
//
// Tracks the on-screen software keyboard height without hardcoding any values,
// so the NEX composer pill can rise cleanly to sit just above the keyboard
// on iOS Safari, Android Chrome, and any other browser that implements the
// Visual Viewport API. Gracefully returns 0 in unsupported environments (SSR,
// older browsers) so callers keep working with an "always-idle" fallback.
//
// Doctrine: project_nex_input_dock_interaction_model_2026_08_23 · "No hardcoded
// keyboard height — use Visual Viewport / keyboard inset handling."

"use client";

import { useEffect, useState } from "react";

export interface VirtualKeyboardState {
  /** Approximate on-screen keyboard height in CSS pixels · 0 when closed. */
  keyboardHeight: number;
  /** Threshold-gated flag · true when keyboard is meaningfully open (>20 px).
   *  The threshold avoids treating tiny viewport shifts (browser chrome
   *  show/hide, address-bar collapse, etc.) as keyboard events. */
  isKeyboardOpen: boolean;
}

const OPEN_THRESHOLD_PX = 20;

export function useVirtualKeyboard(): VirtualKeyboardState {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) {
      // SSR or unsupported browser · leave keyboardHeight at 0. The composer
      // will stay in idle state forever, which is the safe fallback.
      return;
    }

    const vv = window.visualViewport;

    const update = () => {
      // Layout viewport (window.innerHeight) minus visual viewport (vv.height)
      // minus any vertical offset (vv.offsetTop · used when the visual viewport
      // is pushed up by the keyboard on some Android configurations) gives the
      // keyboard's occluded height. Clamped to >= 0 for safety.
      const diff = window.innerHeight - vv.height - vv.offsetTop;
      setKeyboardHeight(Math.max(0, diff));
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return {
    keyboardHeight,
    isKeyboardOpen: keyboardHeight > OPEN_THRESHOLD_PX,
  };
}
