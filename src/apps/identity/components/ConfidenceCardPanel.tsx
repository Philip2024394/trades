// R05 Confidence Card — the trade-side result panel.
//
// Rendered after the customer signs the consent screen. Every signal
// shows the SOURCE (Companies House / Registry Trust / Creditsafe /
// Experian / trade reference / Trade Center native) — Constitution
// Rule #6 surfaced. Trade Center is never the source.

import {
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Info,
  Building2,
  Gavel,
  BarChart3,
  Handshake,
  Landmark
} from "lucide-react";
import type {
  ConfidenceCard,
  ConfidenceSignal,
  SignalSource,
  SignalStatus
} from "../data/confidenceCard";

type Props = {
  card: ConfidenceCard;
};

function sourceIcon(source: SignalSource) {
  switch (source) {
    case "companies-house":    return Building2;
    case "registry-trust-ccj": return Gavel;
    case "creditsafe":         return BarChart3;
    case "experian":           return BarChart3;
    case "trade-reference":    return Handshake;
    case "trade-center-native":return Landmark;
  }
}

function statusVisuals(status: SignalStatus) {
  switch (status) {
    case "green": return { bg: "#F0FDF4", border: "#166534", chipBg: "#166534", chipFg: "#FFFFFF", Icon: ShieldCheck,   label: "Positive"  };
    case "amber": return { bg: "#FFFBEB", border: "#F59E0B", chipBg: "#F59E0B", chipFg: "#0A0A0A", Icon: ShieldQuestion, label: "Attention" };
    case "red":   return { bg: "#FEF2F2", border: "#DC2626", chipBg: "#DC2626", chipFg: "#FFFFFF", Icon: ShieldAlert,   label: "Concern"   };
    case "info":  return { bg: "#F1F5F9", border: "#64748B", chipBg: "#64748B", chipFg: "#FFFFFF", Icon: Info,          label: "Info"      };
  }
}

function formatCost(v: number): string {
  return `£${v.toFixed(2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function ConfidenceCardPanel({ card }: Props) {
  const total = card.signals.reduce((sum, s) => sum + (s.costGbp ?? 0), 0);
  const greens = card.signals.filter((s) => s.status === "green").length;

  return (
    <div className="flex flex-col gap-4">
      {/* Header + summary */}
      <div
        className="rounded-xl border bg-white p-4 shadow-sm"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
              Confidence Card · R05
            </div>
            <div className="mt-1 text-[16px] font-black text-neutral-900">
              {card.subjectName}
            </div>
            <div className="text-[11.5px] text-neutral-600">
              Consented {formatDate(card.consentSignedAtIso)} · expires {formatDate(card.consentExpiresAtIso)}
            </div>
          </div>
          <div className="flex-shrink-0 rounded-lg px-3 py-2 text-center" style={{ backgroundColor: "#F0FDF4" }}>
            <div className="text-[10px] font-black uppercase tracking-wider text-[#166534]">
              Positive signals
            </div>
            <div className="text-[18px] font-black text-neutral-900">
              {greens}/{card.signals.length}
            </div>
          </div>
        </div>
      </div>

      {/* Signals */}
      <ul className="grid gap-3 md:grid-cols-2">
        {card.signals.map((s) => (
          <SignalRow key={s.id} signal={s}/>
        ))}
      </ul>

      {/* Suggested staged payment */}
      <div
        className="rounded-xl border p-4"
        style={{ borderColor: "rgba(22,101,52,0.35)", backgroundColor: "#F0FDF4" }}
      >
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[#166534]">
          Suggested staged-payment profile
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2 text-center">
          <StageChip label="Deposit"    pct={card.suggestedStagedPayment.depositPct}/>
          <StageChip label="First Fix"  pct={card.suggestedStagedPayment.firstFixPct}/>
          <StageChip label="Second Fix" pct={card.suggestedStagedPayment.secondFixPct}/>
          <StageChip label="Completion" pct={card.suggestedStagedPayment.completionPct}/>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-neutral-700">
          {card.suggestedStagedPayment.rationale}
        </p>
      </div>

      {/* Provenance + cost */}
      <div className="rounded-xl border bg-neutral-50 p-3 text-[10.5px] leading-snug text-neutral-600" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
        <div className="flex items-start gap-2">
          <Info size={13} className="mt-0.5 flex-shrink-0 text-neutral-500"/>
          <div>
            Every signal above is fetched fresh from the source shown and is not stored by
            Trade Center. Pass-through cost for this Confidence Card: {formatCost(total)}.
            Trade Center is <span className="font-bold">information only</span> — not credit advice,
            not a credit reference agency, not a lender.
          </div>
        </div>
      </div>
    </div>
  );
}

function SignalRow({ signal }: { signal: ConfidenceSignal }) {
  const v = statusVisuals(signal.status);
  const Src = sourceIcon(signal.source);
  return (
    <li
      className="rounded-lg border-l-4 bg-white p-3 shadow-sm"
      style={{ borderColor: v.border, backgroundColor: v.bg }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <Src size={14} className="mt-0.5 flex-shrink-0 text-neutral-600"/>
          <div className="min-w-0">
            <div className="text-[9.5px] font-black uppercase tracking-wider text-neutral-500">
              {signal.sourceLabel}
            </div>
            <div className="mt-0.5 text-[12px] font-black leading-tight text-neutral-900">
              {signal.headline}
            </div>
            {signal.detail && (
              <div className="mt-1 text-[11px] leading-snug text-neutral-600">
                {signal.detail}
              </div>
            )}
          </div>
        </div>
        <span
          className="inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
          style={{ backgroundColor: v.chipBg, color: v.chipFg }}
        >
          <v.Icon size={9} strokeWidth={2.5}/>
          {v.label}
        </span>
      </div>
    </li>
  );
}

function StageChip({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="rounded-md bg-white p-2 shadow-sm">
      <div className="text-[16px] font-black text-neutral-900">{pct}%</div>
      <div className="mt-0.5 text-[9px] font-black uppercase tracking-wider text-neutral-500">
        {label}
      </div>
    </div>
  );
}
