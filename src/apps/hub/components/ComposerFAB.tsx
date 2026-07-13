// Composer FAB — persistent "+" button on every non-hub page.
// Opens the Universal Composer in a modal so the trade can post from
// anywhere without navigating to the hub first.

"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { UniversalComposer } from "./UniversalComposer";
import { currentViewerTrade } from "@/apps/identity/data/tradeIdentities";

export function ComposerFAB() {
  const [open, setOpen] = useState(false);
  const identity = currentViewerTrade();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Post something"
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition active:scale-95 md:h-16 md:w-16"
        style={{
          backgroundColor: "#FFB300",
          color: "#0A0A0A"
        }}
      >
        <Plus size={26} strokeWidth={2.5}/>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-3 md:items-center md:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Post composer"
        >
          <button
            type="button"
            aria-label="Close composer"
            className="absolute inset-0"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-lg">
            <div className="flex justify-end pb-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-md"
                aria-label="Close"
              >
                <X size={16}/>
              </button>
            </div>
            <UniversalComposer identity={identity} compact/>
          </div>
        </div>
      )}
    </>
  );
}
