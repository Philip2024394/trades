// BottomSheet — mobile-first bottom sheet for pickers, details, and
// quick actions. Slides up from the bottom on mobile; on desktop it
// centers as a modal.

"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { ELEVATION } from "../tokens";

export type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Sticky action row at the foot of the sheet. */
  footer?: ReactNode;
};

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer
}: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog">
      <div
        className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Mobile: bottom sheet */}
      <div
        className={`absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl bg-white md:hidden ${ELEVATION[4]}`}
      >
        <SheetShell title={title} onClose={onClose} footer={footer}>
          {children}
        </SheetShell>
      </div>
      {/* Desktop: centered modal */}
      <div
        className={`absolute left-1/2 top-1/2 hidden w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white md:flex md:max-h-[80vh] md:flex-col ${ELEVATION[5]}`}
      >
        <SheetShell title={title} onClose={onClose} footer={footer}>
          {children}
        </SheetShell>
      </div>
    </div>
  );
}

function SheetShell({
  title,
  onClose,
  children,
  footer
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <>
      <div className="mx-auto my-2 h-1 w-10 shrink-0 rounded-full bg-neutral-300 md:hidden" />
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <h3 className="text-[15px] font-semibold text-neutral-900">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
      {footer ? (
        <div className="border-t border-neutral-200 bg-white p-3">{footer}</div>
      ) : null}
    </>
  );
}
