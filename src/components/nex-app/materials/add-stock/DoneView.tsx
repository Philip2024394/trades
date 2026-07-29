"use client";
// DoneView — post-confirmation success screen.
// Owner sees exactly what NEX just did before choosing to open the
// pack or return to the Materials home. No auto-redirect — the moment
// of "done" is worth an explicit beat, per Philip 2026-07-28.

import Link from "next/link";
import { CheckCircle2, ArrowRight, Package, Layers, Brain, PoundSterling, Home, RotateCcw, SkipForward } from "lucide-react";
import { MT } from "../_tokens";
import type { AddStockFormValues } from "./AddStockWorkflow";
import type { NexAddStockDraft } from "@/apps/materials/_schema/memory_types";

type DoneResult = {
  memory_id: string | null;
  pack_id: string;
  boards_created: number;
  redirect_url: string;
  form_snapshot: AddStockFormValues;
  material_name: string;
  memory_action: NexAddStockDraft["memory_action"];
};

export function DoneView({ done, onReset }: { done: DoneResult; onReset: () => void }) {
  const f = done.form_snapshot;
  const volume_m3 = f.length_mm && f.width_mm && f.thickness_mm && f.quantity
    ? (f.length_mm * f.width_mm * f.thickness_mm * f.quantity) / 1_000_000_000
    : null;
  const totalCost = f.price_per_unit != null ? f.price_per_unit * f.quantity : null;
  const sym = symbol(f.price_currency);

  return (
    <div className="mt-6 flex flex-col gap-4">
      {/* Green hero — "done" moment */}
      <section
        className="flex flex-col items-center px-5 pt-7 pb-6 text-center"
        style={{
          background: "linear-gradient(180deg, #EFFAF1 0%, #FFFFFF 100%)",
          border: `1px solid #C6E5CE`,
          borderRadius: MT.radiusLg,
          boxShadow: MT.shadowSoft,
        }}
      >
        <span
          className="grid h-14 w-14 place-items-center rounded-full"
          style={{
            background: "#2E7D3D",
            color: "#FFFFFF",
            boxShadow: "0 10px 24px -8px rgba(46,125,61,0.45)",
            animation: "nex-done-pop 380ms cubic-bezier(0.16, 1, 0.3, 1) 1",
          }}
        >
          <CheckCircle2 size={30} strokeWidth={2.25} />
        </span>
        <h2 className="mt-4 text-[22px] font-extrabold tracking-tight" style={{ color: "#1B4B26", letterSpacing: -0.4 }}>
          Delivery recorded
        </h2>
        <p className="mt-1 text-[13.5px] font-semibold" style={{ color: "#2E7D3D" }}>
          {f.quantity} × {done.material_name}
        </p>
      </section>

      {/* Checklist of what NEX did */}
      <section
        className="px-5 py-4"
        style={{
          background: MT.card,
          border: `1px solid ${MT.borderLight}`,
          borderRadius: MT.radiusLg,
          boxShadow: MT.shadowSoft,
        }}
      >
        <ul className="flex flex-col gap-2.5">
          <DoneLine icon={<Package size={16} strokeWidth={2} />}>
            Pack <strong>#{shortPack(done.pack_id)}</strong> created
          </DoneLine>
          <DoneLine icon={<Layers size={16} strokeWidth={2} />}>
            <strong>{done.boards_created}</strong> board record{done.boards_created === 1 ? "" : "s"} created
          </DoneLine>
          {volume_m3 && (
            <DoneLine icon={<CheckCircle2 size={16} strokeWidth={2} />}>
              Volume calculated · <strong>{volume_m3.toFixed(3)} m³</strong>
            </DoneLine>
          )}
          <DoneLine icon={<CheckCircle2 size={16} strokeWidth={2} />}>
            Stock updated
          </DoneLine>
          {totalCost != null && (
            <DoneLine icon={<PoundSterling size={16} strokeWidth={2} />}>
              Purchase recorded · <strong>{sym}{formatMoney(totalCost)}</strong>
            </DoneLine>
          )}
          <DoneLine icon={memoryIcon(done.memory_action)}>
            {memoryLine(done.memory_action, done.material_name)}
          </DoneLine>
        </ul>
      </section>

      {/* Next-step buttons */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href={done.redirect_url}
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 text-[14px] font-bold transition-transform active:scale-95"
          style={{
            background: MT.primary,
            color: "#FFFFFF",
            borderRadius: MT.radiusMd,
            boxShadow: "0 8px 20px -8px rgba(245,130,32,0.60)",
          }}
        >
          Open Pack
          <ArrowRight size={16} strokeWidth={2.25} />
        </Link>
        <Link
          href="/nex-app/materials"
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 text-[13.5px] font-bold transition-transform active:scale-95"
          style={{ background: MT.card, color: MT.darkGrey, border: `1px solid ${MT.border}`, borderRadius: MT.radiusMd }}
        >
          <Home size={15} strokeWidth={2.25} />
          Done
        </Link>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-12 items-center justify-center gap-2 px-4 text-[13.5px] font-semibold transition-transform active:scale-95"
          style={{ background: "transparent", color: MT.secondaryGrey }}
        >
          <RotateCcw size={14} strokeWidth={2} />
          Record another
        </button>
      </div>

      <style jsx>{`
        @keyframes nex-done-pop {
          from { transform: scale(0.6); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function DoneLine({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[13.5px]" style={{ color: MT.darkGrey }}>
      <span style={{ color: "#2E7D3D", marginTop: 1 }}>{icon}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}

function memoryIcon(action: NexAddStockDraft["memory_action"]): React.ReactNode {
  if (action === "skip_memory") return <SkipForward size={16} strokeWidth={2} />;
  return <Brain size={16} strokeWidth={2} />;
}

function memoryLine(action: NexAddStockDraft["memory_action"], name: string): React.ReactNode {
  switch (action) {
    case "create_new":       return <>I&apos;ll remember <strong>{name}</strong> for next time</>;
    case "use_existing":     return <>Used what I already knew about <strong>{name}</strong></>;
    case "update_existing":  return <>Updated what I know about <strong>{name}</strong></>;
    case "skip_memory":      return <>Not saved — this was a one-off</>;
  }
}

function shortPack(id: string): string {
  return id.slice(-6).toUpperCase();
}

function symbol(currency: string): string {
  switch (currency.toUpperCase()) {
    case "GBP": return "£";
    case "USD": return "$";
    case "EUR": return "€";
    default:    return `${currency} `;
  }
}

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
