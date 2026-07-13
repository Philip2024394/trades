// Buyer actions on a Trade Center Guaranteed order:
//   - Confirm delivery (releases funds after N-day auto-release timer,
//     buyer can also release immediately)
//   - Raise dispute (holds funds pending arbitration)
//
// Fixture-mode: state changes persist in local component state so the
// escrow timeline re-renders instantly. In production this calls the
// escrow provider's release / dispute endpoints.

"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, ShieldCheck, X } from "lucide-react";
import type { EscrowDetails } from "../types";

type Props = {
  escrow: EscrowDetails;
  onConfirmDelivery: () => void;
  onReleaseNow: () => void;
  onRaiseDispute: (reason: string, statement: string) => void;
};

export function OrderActions({ escrow, onConfirmDelivery, onReleaseNow, onRaiseDispute }: Props) {
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [statement, setStatement] = useState("");

  // No actions once funds are released or refunded
  if (escrow.status === "released" || escrow.status === "refunded") {
    return null;
  }

  return (
    <section
      className="rounded-2xl border bg-white p-5 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
        Your actions
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {escrow.status === "funds-held" && (
          <>
            <button
              type="button"
              onClick={onConfirmDelivery}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-6 text-[13px] font-black uppercase tracking-wider text-white shadow-sm"
              style={{ backgroundColor: "#166534" }}
            >
              <CheckCircle2 size={14} strokeWidth={2.5}/>
              Confirm delivery
            </button>
            <p className="text-[11px] leading-snug text-neutral-600">
              Confirms goods arrived as described. Funds enter a 14-day release timer — you
              can still raise a dispute during that period if a problem shows up.
            </p>
          </>
        )}

        {escrow.status === "release-scheduled" && (
          <>
            <button
              type="button"
              onClick={onReleaseNow}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-6 text-[13px] font-black uppercase tracking-wider text-white shadow-sm"
              style={{ backgroundColor: "#166534" }}
            >
              <ShieldCheck size={14} strokeWidth={2.5}/>
              Release now
            </button>
            <p className="text-[11px] leading-snug text-neutral-600">
              Skip the auto-release timer and pay the merchant now.
            </p>
          </>
        )}

        {escrow.status !== "disputed" && (
          <button
            type="button"
            onClick={() => setDisputeOpen((o) => !o)}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border bg-white px-6 text-[11.5px] font-black uppercase tracking-wider text-red-700 shadow-sm"
            style={{ borderColor: "#DC262640" }}
          >
            <AlertTriangle size={13} strokeWidth={2.5}/>
            Raise a dispute
          </button>
        )}
      </div>

      {/* Dispute drawer */}
      {disputeOpen && (
        <div className="mt-4 rounded-lg border bg-red-50 p-4" style={{ borderColor: "#DC262640" }}>
          <div className="flex items-center justify-between">
            <div className="text-[12px] font-black text-red-800">Open a dispute</div>
            <button
              type="button"
              onClick={() => setDisputeOpen(false)}
              className="text-neutral-500 hover:text-neutral-800"
              aria-label="Close dispute form"
            >
              <X size={16}/>
            </button>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-red-800">
            Funds stay held while Trade Center arbitrates. Include a short reason and any
            evidence you can share.
          </p>

          <label className="mt-3 flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
              Reason
            </span>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[44px] rounded-md border bg-white px-3 text-[13px]"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <option value="">Choose one…</option>
              <option value="did-not-arrive">Did not arrive</option>
              <option value="damaged-in-transit">Damaged in transit</option>
              <option value="wrong-item">Wrong item</option>
              <option value="not-as-described">Not as described</option>
              <option value="quality-below-spec">Quality below spec</option>
              <option value="partial-delivery">Partial delivery — items missing</option>
            </select>
          </label>

          <label className="mt-2 flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
              What happened
            </span>
            <textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              rows={3}
              className="rounded-md border bg-white p-3 text-[13px]"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
              placeholder="Describe the problem in a sentence or two."
            />
          </label>

          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setDisputeOpen(false)}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border bg-white px-5 text-[11.5px] font-black uppercase tracking-wider text-neutral-700 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!reason || !statement.trim()}
              onClick={() => {
                onRaiseDispute(reason, statement.trim());
                setDisputeOpen(false);
                setReason("");
                setStatement("");
              }}
              className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-full bg-red-700 px-6 text-[12px] font-black uppercase tracking-wider text-white shadow-sm disabled:opacity-50"
            >
              <AlertTriangle size={13}/>
              Open dispute
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
