// MobileNavDrawer — right-side drawer for mobile navigation.
//
// Reused across every merchant surface that has a mobile hamburger.

"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { ELEVATION } from "../tokens";

export type MobileNavLink = {
  href: string;
  label: string;
  onClick?: () => void;
};

export type MobileNavDrawerProps = {
  open: boolean;
  onClose: () => void;
  brandLabel: string;
  links: readonly MobileNavLink[];
  /** Optional footer content — usually CTA buttons. */
  footer?: ReactNode;
};

export function MobileNavDrawer({
  open,
  onClose,
  brandLabel,
  links,
  footer
}: MobileNavDrawerProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog">
      <div
        className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`absolute right-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-white ${ELEVATION[4]}`}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <span className="text-[15px] font-bold text-neutral-900">
            {brandLabel}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="flex flex-col gap-1 text-[15px]">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => {
                    link.onClick?.();
                    onClose();
                  }}
                  className="flex min-h-[44px] items-center rounded-lg px-3 text-neutral-900 hover:bg-neutral-50"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {footer ? (
          <div className="border-t border-neutral-200 p-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
