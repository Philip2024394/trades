"use client";

// WhatsAppProtectionModal — the safety notice shown before opening a
// merchant's WhatsApp thread. Never blocks the customer — they can
// always Continue. Just a reminder about safe payment practice.
//
// Copy is the exact text Philip specified in the Phase 7 architecture
// change (2026-07-27).

import { Shield } from "lucide-react";

type Props = {
  whatsappUrl: string;
  merchantName: string;
  onClose: () => void;
};

export function WhatsAppProtectionModal({
  whatsappUrl,
  merchantName,
  onClose,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="whatsapp-notice-title"
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 flex-none place-items-center rounded-full bg-orange-100">
            <Shield className="h-4 w-4 text-orange-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div
              id="whatsapp-notice-title"
              className="text-sm font-semibold text-black"
            >
              You're about to contact {merchantName} directly
            </div>
            <p className="mt-2 text-xs leading-relaxed text-black/70">
              NEX recommends using trusted payment methods such as
              Stripe, PayPal or a reputable escrow service when
              purchasing from businesses you do not already know.
              Payment arrangements are made directly between you and
              the merchant.
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-black/10 py-2 text-xs font-medium text-black/70 hover:bg-black/5"
          >
            Cancel
          </button>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="flex-1 rounded-full bg-[#25D366] py-2 text-center text-xs font-medium text-white hover:opacity-90"
          >
            Continue to WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
