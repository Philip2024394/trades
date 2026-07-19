"use client";

// HowItWorksLauncher — the client-side controller for the guide.
// Renders three surfaces from a single place:
//   1. The "How it works" button (variant='button')
//   2. A tiny "?" chip (variant='chip') that opens directly onto a
//      specific feature card via deep-link
//   3. The guide itself when isOpen === true (mounted inline in the
//      feed column)
//
// State is owned here so the button, section chips, and inline guide
// can all coordinate without prop drilling.

import { useState, useCallback } from "react";
import { HelpCircle, BookOpen } from "lucide-react";
import { HowItWorksGuide } from "./HowItWorksGuide";

const BRAND_YELLOW = "#FFB300";

type Props = {
  variant?:  "button" | "chip";
  /** For chip variant: which feature to open on the guide when tapped. */
  featureId?: string;
  /** Where the guide renders. `inline` mounts a full guide surface where
   *  the launcher sits. `portal` skips rendering the guide — caller is
   *  responsible for rendering <HowItWorksGuide/> elsewhere. */
  mountMode?: "inline" | "portal";
  /** Fired when the guide should open. Useful when mountMode='portal'
   *  so the parent can swap its own content for the guide. */
  onOpen?:    (featureId?: string) => void;
};

export function HowItWorksLauncher({
  variant   = "button",
  featureId,
  mountMode = "inline",
  onOpen
}: Props) {
  const [open, setOpen]           = useState(false);
  const [focusId, setFocusId]     = useState<string | null>(null);

  const handleOpen = useCallback((id?: string) => {
    setFocusId(id ?? null);
    if (mountMode === "portal") {
      onOpen?.(id);
      return;
    }
    setOpen(true);
  }, [mountMode, onOpen]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setFocusId(null);
  }, []);

  // Chip variant — small inline (?) button
  if (variant === "chip") {
    return (
      <button
        type="button"
        onClick={() => handleOpen(featureId)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-neutral-500 transition hover:border-neutral-900 hover:text-neutral-900"
        style={{ borderColor: "rgba(0,0,0,0.12)" }}
        aria-label={featureId ? `Explain "${featureId}"` : "How it works"}
        title={featureId ? "How this section works" : "How it works"}
      >
        <HelpCircle size={11} strokeWidth={2.5}/>
      </button>
    );
  }

  // Button variant — primary "How it works" CTA
  return (
    <>
      <button
        type="button"
        onClick={() => handleOpen()}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 bg-white px-4 text-[12px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition hover:brightness-95"
        style={{ borderColor: BRAND_YELLOW, boxShadow: `0 4px 14px ${BRAND_YELLOW}33` }}
      >
        <BookOpen size={13} strokeWidth={2.5} style={{ color: BRAND_YELLOW }}/>
        How it works
      </button>

      {mountMode === "inline" && open && (
        <div className="mt-4 animate-[fadeIn_0.2s_ease-out]">
          <HowItWorksGuide onClose={handleClose} focusId={focusId}/>
        </div>
      )}
    </>
  );
}
