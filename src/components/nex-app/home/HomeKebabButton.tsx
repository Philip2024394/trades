"use client";

// src/components/nex-app/home/HomeKebabButton.tsx
//
// NEX Frameless Recovery · Slice 1 · Lower-right 3-dot control
// Philip 2026-09-07
//
// Frameless replacement for the phone-frame's rightKebab affordance
// (previously rendered by NexHudFrame). Behaviour is preserved via the
// existing NexKebabQuickPanel — we only build (a) a new visible 3-dot
// trigger button in the lower-right of the viewport, and (b) the
// selection-handling wire that routes to existing NEX destinations.
//
// The panel itself is the legacy component from /nexapp (NexKebabQuickPanel)
// mounted with a frameless-mode portal target (MOUNT_SELECTOR) so its
// positioning switches to safe-area-aware absolute pixels instead of
// bezel percentages.

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";
import { NexKebabQuickPanel, type KebabPanelSelection } from "@/components/nexapp/NexKebabQuickPanel";

/** Portal target selector · the new frameless home mounts a matching
 *  container with this class name so the kebab panel can portal into
 *  it. Kept as a stable const so both the button and the home shell
 *  agree without threading a ref through props. */
export const NEX_HOME_MOUNT_SELECTOR = ".nex-home-viewport";

export function HomeKebabButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleSelect = useCallback((sel: KebabPanelSelection) => {
    // Close first so the panel doesn't linger through the transition.
    setOpen(false);
    switch (sel.kind) {
      case "live":
        router.push("/nex-live");
        break;
      case "social":
        router.push("/nex-app/discover");
        break;
      case "chat":
        // Friends Chat surface not yet authorised for build · panel
        // shows friend cards inline instead. Do not fabricate a chat
        // route. Panel state has already emitted "chat" and returned
        // the user to root · nothing else to do.
        break;
      case "friend":
        // Friend-specific chat not yet authorised. Kebab panel already
        // closed itself; no route target exists honestly.
        break;
    }
  }, [router]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close quick panel" : "Open quick panel"}
        aria-expanded={open}
        data-testid="nex-home-kebab-button"
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed",
          right: 16,
          bottom: "calc(76px + env(safe-area-inset-bottom, 0px))",
          zIndex: 26,
          width: 44,
          height: 44,
          borderRadius: 999,
          border: "1px solid rgba(255, 255, 255, 0.10)",
          background: "rgba(21, 21, 21, 0.85)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.45)",
          color: "rgba(245, 245, 245, 0.9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "transform 140ms ease, background 160ms ease",
        }}
      >
        <MoreVertical size={18} strokeWidth={2} />
      </button>

      <NexKebabQuickPanel
        open={open}
        onSelect={handleSelect}
        onClose={() => setOpen(false)}
        mountSelector={NEX_HOME_MOUNT_SELECTOR}
      />
    </>
  );
}
