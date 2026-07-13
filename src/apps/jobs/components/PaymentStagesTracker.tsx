// Payment stages tracker — deposit / first fix / second fix / completion.
// Shows what's collected, what's invoiced, what's outstanding. Colour
// codes overdue stages in red so the trade knows to chase.

import { CheckCircle2, Clock, Send, AlertCircle, PoundSterling } from "lucide-react";
import { formatGbp } from "../lib/margin";
import type { JobPaymentStage } from "../data/jobs";

type Props = {
  stages: JobPaymentStage[];
};

function visualsForStatus(status: JobPaymentStage["status"]) {
  switch (status) {
    case "received":    return { Icon: CheckCircle2, bg: "#166534", fg: "#FFFFFF", label: "Received" };
    case "invoiced":    return { Icon: Send,         bg: "#3B82F6", fg: "#FFFFFF", label: "Invoiced" };
    case "outstanding": return { Icon: Clock,        bg: "#F5F0E4", fg: "#525252", label: "Outstanding" };
    case "overdue":     return { Icon: AlertCircle,  bg: "#DC2626", fg: "#FFFFFF", label: "Overdue" };
  }
}

export function PaymentStagesTracker({ stages }: Props) {
  const total = stages.reduce((sum, s) => sum + s.scheduledGbp, 0);
  const received = stages.filter((s) => s.status === "received").reduce((sum, s) => sum + s.scheduledGbp, 0);
  const invoiced = stages.filter((s) => s.status === "invoiced").reduce((sum, s) => sum + s.scheduledGbp, 0);
  const outstanding = stages.filter((s) => s.status === "outstanding" || s.status === "overdue").reduce((sum, s) => sum + s.scheduledGbp, 0);

  return (
    <div
      className="rounded-xl border bg-white p-4 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
          Payment schedule
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-700">
          <PoundSterling size={9}/>
          {formatGbp(total)} total
        </span>
      </div>

      {/* Summary strip */}
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <SummaryChip label="Received"    value={received}    bg="#F0FDF4" fg="#166534"/>
        <SummaryChip label="Invoiced"    value={invoiced}    bg="#DBEAFE" fg="#1E40AF"/>
        <SummaryChip label="Outstanding" value={outstanding} bg="#F5F0E4" fg="#78350F"/>
      </div>

      {/* Stage list */}
      <ul className="mt-3 flex flex-col gap-2">
        {stages.map((stage) => {
          const v = visualsForStatus(stage.status);
          return (
            <li
              key={stage.id}
              className="flex items-center justify-between gap-3 rounded-md border p-3"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-black text-neutral-900">
                  {stage.label}
                  <span className="ml-2 text-[10.5px] font-normal text-neutral-500">
                    {stage.scheduledPct}% · {formatGbp(stage.scheduledGbp)}
                  </span>
                </div>
                <div className="mt-0.5 text-[10.5px] text-neutral-500">
                  {stage.receivedIso
                    ? `Received ${new Date(stage.receivedIso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                    : stage.invoicedIso
                      ? `Invoiced ${new Date(stage.invoicedIso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                      : "Not invoiced yet"}
                </div>
              </div>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
                style={{ backgroundColor: v.bg, color: v.fg }}
              >
                <v.Icon size={10} strokeWidth={2.5}/>
                {v.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SummaryChip({ label, value, bg, fg }: { label: string; value: number; bg: string; fg: string }) {
  return (
    <div className="rounded-md p-2" style={{ backgroundColor: bg }}>
      <div className="text-[9px] font-black uppercase tracking-wider" style={{ color: fg }}>
        {label}
      </div>
      <div className="mt-0.5 text-[13px] font-black" style={{ color: fg }}>
        {formatGbp(value)}
      </div>
    </div>
  );
}
