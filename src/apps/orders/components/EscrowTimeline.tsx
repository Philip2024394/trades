// Escrow status timeline — visual state machine for Trade Center Guaranteed
// orders. Buyer sees exactly where their money is at every stage:
// held → delivery confirmed → auto-release timer → released.
// Dispute forks off at any point before release.
//
// Constitution Rule #6 reinforced in the footer note: Trade Center does
// not hold funds. Every escrow leg is provided by the regulated partner
// named on the timeline.

import {
  CheckCircle2,
  Clock,
  Truck,
  ShieldCheck,
  AlertTriangle,
  Wallet,
  Info
} from "lucide-react";
import type { EscrowDetails, EscrowStatus } from "../types";

type Props = {
  escrow: EscrowDetails;
  merchantName: string;
};

type Step = {
  key: string;
  label: string;
  detail?: string;
  Icon: typeof CheckCircle2;
  state: "done" | "current" | "future" | "warning";
  timestamp?: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

function buildSteps(escrow: EscrowDetails, merchantName: string): Step[] {
  const s = escrow.status;
  const funded: Step["state"] =
    s === "funds-held" || s === "release-scheduled" ? "done" : s === "not-guaranteed" ? "future" : "done";
  const delivered: Step["state"] =
    s === "release-scheduled" || s === "released" ? "done" : s === "funds-held" ? "current" : s === "disputed" ? "done" : "future";
  const released: Step["state"] =
    s === "released" ? "done" : s === "release-scheduled" ? "current" : s === "refunded" ? "future" : "future";

  const timeline: Step[] = [
    {
      key: "funded",
      label: "Funds held",
      detail:
        escrow.provider === "shieldpay-escrow"
          ? `Held by Shieldpay (FCA-regulated escrow)`
          : `Held by Stripe (regulated safeguarding account)`,
      Icon: Wallet,
      state: funded,
      timestamp: escrow.fundsHeldAtIso ? formatDate(escrow.fundsHeldAtIso) : undefined
    },
    {
      key: "delivered",
      label: "Delivery confirmed",
      detail:
        delivered === "current"
          ? "Waiting for you to confirm delivery"
          : delivered === "done"
            ? `You confirmed delivery`
            : "Not yet",
      Icon: Truck,
      state: delivered,
      timestamp: escrow.deliveryConfirmedAtIso ? formatDate(escrow.deliveryConfirmedAtIso) : undefined
    },
    {
      key: "released",
      label:
        s === "released" ? "Released to merchant" :
        s === "refunded" ? "Refunded to you" :
        escrow.autoReleaseAtIso ? `Auto-release in ${daysUntil(escrow.autoReleaseAtIso)} days` : "Release",
      detail:
        s === "released"
          ? `Paid to ${merchantName}`
          : s === "refunded"
            ? "Full refund processed"
            : s === "release-scheduled"
              ? "You can release now, or wait — funds release automatically after the timer expires."
              : "Waiting on delivery confirmation",
      Icon: s === "refunded" ? Wallet : ShieldCheck,
      state: released,
      timestamp: escrow.releasedAtIso
        ? formatDate(escrow.releasedAtIso)
        : escrow.autoReleaseAtIso
          ? formatDate(escrow.autoReleaseAtIso)
          : undefined
    }
  ];

  // Fork: dispute
  if (s === "disputed" && escrow.dispute) {
    timeline.splice(2, 1, {
      key: "disputed",
      label: "Dispute under review",
      detail: `${escrow.dispute.raisedByRole === "buyer" ? "You raised" : "Merchant raised"}: ${escrow.dispute.reason}`,
      Icon: AlertTriangle,
      state: "warning",
      timestamp: formatDate(escrow.dispute.raisedAtIso)
    });
  }

  return timeline;
}

function stateVisual(state: Step["state"]): { fg: string; bg: string; ring: string } {
  switch (state) {
    case "done":    return { fg: "#FFFFFF", bg: "#166534", ring: "#166534" };
    case "current": return { fg: "#0A0A0A", bg: "#FFB300", ring: "#FFB300" };
    case "warning": return { fg: "#FFFFFF", bg: "#DC2626", ring: "#DC2626" };
    case "future":  return { fg: "#525252", bg: "#F5F0E4", ring: "rgba(139,69,19,0.20)" };
  }
}

export function EscrowTimeline({ escrow, merchantName }: Props) {
  const steps = buildSteps(escrow, merchantName);

  return (
    <section
      className="rounded-2xl border bg-white p-5 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <div className="flex items-center gap-2">
        <ShieldCheck size={14} style={{ color: "#166534" }} strokeWidth={2.5}/>
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[#166534]">
          Trade Center Guaranteed
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[14px] font-black text-neutral-900">
          £{escrow.fundsHeldGbp.toLocaleString()} held by{" "}
          {escrow.provider === "shieldpay-escrow" ? "Shieldpay" : "Stripe"}
        </div>
        <StatusBadge status={escrow.status}/>
      </div>

      <ol className="mt-5 flex flex-col gap-4">
        {steps.map((step, i) => {
          const v = stateVisual(step.state);
          return (
            <li key={step.key} className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-white"
                  style={{ backgroundColor: v.bg, color: v.fg, boxShadow: `0 0 0 2px ${v.ring}` }}
                >
                  <step.Icon size={14} strokeWidth={2.5}/>
                </div>
                {i < steps.length - 1 && (
                  <div
                    className="w-0.5 flex-1"
                    style={{
                      backgroundColor: step.state === "done" ? "#166534" : "rgba(139,69,19,0.15)",
                      minHeight: "24px"
                    }}
                    aria-hidden
                  />
                )}
              </div>
              <div className="min-w-0 flex-1 pb-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-[13px] font-black text-neutral-900">{step.label}</div>
                  {step.timestamp && (
                    <div className="text-[10.5px] text-neutral-500">{step.timestamp}</div>
                  )}
                </div>
                {step.detail && (
                  <div className="mt-0.5 text-[11.5px] leading-snug text-neutral-600">
                    {step.detail}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex items-start gap-2 rounded-md bg-neutral-50 p-3">
        <Info size={13} className="mt-0.5 flex-shrink-0 text-neutral-500"/>
        <p className="text-[10.5px] leading-snug text-neutral-500">
          Trade Center does not hold your funds at any point. They sit with the regulated
          partner named above until you confirm delivery or an arbitration outcome is reached.
          Trade Center is the arbitrator on disputes only.
        </p>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: EscrowStatus }) {
  const map: Record<EscrowStatus, { label: string; bg: string; fg: string }> = {
    "not-guaranteed":    { label: "Not guaranteed",    bg: "#F5F0E4", fg: "#525252" },
    "funds-held":        { label: "Funds held",        bg: "#FEF3C7", fg: "#B45309" },
    "release-scheduled": { label: "Release scheduled", bg: "#DBEAFE", fg: "#1E40AF" },
    "released":          { label: "Released",          bg: "#DCFCE7", fg: "#166534" },
    "disputed":          { label: "Dispute open",      bg: "#FEE2E2", fg: "#B91C1C" },
    "refunded":          { label: "Refunded",          bg: "#DCFCE7", fg: "#166534" }
  };
  const v = map[status];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
      style={{ backgroundColor: v.bg, color: v.fg }}
    >
      {status === "release-scheduled" && <Clock size={9} strokeWidth={2.5}/>}
      {status === "disputed" && <AlertTriangle size={9} strokeWidth={2.5}/>}
      {status === "released" && <CheckCircle2 size={9} strokeWidth={2.5}/>}
      {v.label}
    </span>
  );
}
