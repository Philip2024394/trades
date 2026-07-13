// Full 8-layer Verified Trade Identity detail panel.
//
// Used on:
//   - /tc/identity      — trade's own management dashboard
//   - /tc/apply/[m]      — pre-fill preview on the account application
//   - /tc/trade-center/... — inside R05 Confidence Card (customer-side)
//
// Every row shows: layer name · status · WHO verified it (partner /
// public register). Constitution Rule #6 lives here — Trade Center never
// verifies anything itself, it's always the pipe.

import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  Clock,
  BadgeCheck,
  Building2,
  Hammer,
  MapPin,
  Umbrella,
  GraduationCap,
  Star,
  Calendar
} from "lucide-react";
import type {
  IdentityLayer,
  IdentityLayerKey,
  VerifiedTradeIdentity
} from "../data/tradeIdentities";

type Props = {
  trade: VerifiedTradeIdentity;
  /** Compact = no icons per row, tighter spacing. Used inside cards. */
  compact?: boolean;
};

const LAYER_ORDER: IdentityLayerKey[] = [
  "identity",
  "business",
  "skills",
  "address",
  "insurance",
  "qualifications",
  "reviews",
  "yearsTrading"
];

function iconForLayer(key: IdentityLayerKey) {
  switch (key) {
    case "identity":       return BadgeCheck;
    case "business":       return Building2;
    case "skills":         return Hammer;
    case "address":        return MapPin;
    case "insurance":      return Umbrella;
    case "qualifications": return GraduationCap;
    case "reviews":        return Star;
    case "yearsTrading":   return Calendar;
  }
}

function statusChip(layer: IdentityLayer) {
  const map = {
    verified: { bg: "#166534", fg: "#FFFFFF", Icon: ShieldCheck, label: "Verified" },
    pending:  { bg: "#F59E0B", fg: "#0A0A0A", Icon: Clock,       label: "Pending"  },
    expired:  { bg: "#DC2626", fg: "#FFFFFF", Icon: ShieldAlert, label: "Expired"  },
    missing:  { bg: "#E5E7EB", fg: "#374151", Icon: Shield,      label: "Not Set"  }
  } as const;
  const { bg, fg, Icon, label } = map[layer.status];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
      style={{ backgroundColor: bg, color: fg }}
    >
      <Icon size={9} strokeWidth={2.5}/>
      {label}
    </span>
  );
}

function formatDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  return new Date(iso).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric"
  });
}

export function VerifiedTradeIdentityPanel({ trade, compact }: Props) {
  return (
    <div
      className="rounded-xl border bg-white p-4 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Verified Trade Identity · R07
          </div>
          <div className="mt-1 text-[15px] font-black text-neutral-900">
            {trade.displayName}
          </div>
          <div className="text-[11.5px] text-neutral-600">
            {trade.legalName} · {trade.tradeType}
          </div>
        </div>
        <div
          className="flex-shrink-0 rounded-lg px-3 py-2 text-center"
          style={{ backgroundColor: "#FEF3C7" }}
        >
          <div className="text-[10px] font-black uppercase tracking-wider text-neutral-700">
            Completeness
          </div>
          <div className="text-[18px] font-black text-neutral-900">
            {trade.compositeCompleteness}
          </div>
        </div>
      </div>

      {/* 8-layer grid */}
      <ul className={`mt-3 grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
        {LAYER_ORDER.map((key) => {
          const layer = trade.layers[key];
          const Icon = iconForLayer(key);
          return (
            <li
              key={key}
              className="flex items-start gap-2 rounded-md border p-2"
              style={{ borderColor: "rgba(139,69,19,0.10)" }}
            >
              <Icon size={14} className="mt-0.5 flex-shrink-0 text-neutral-500"/>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <div className="text-[11.5px] font-black text-neutral-800">
                    {layer.label}
                  </div>
                  {statusChip(layer)}
                </div>
                {layer.detail && (
                  <div className="mt-0.5 text-[10.5px] leading-tight text-neutral-600">
                    {layer.detail}
                  </div>
                )}
                {layer.verifiedBy && (
                  <div className="mt-0.5 text-[9.5px] font-bold uppercase tracking-wider text-neutral-500">
                    Verified by {layer.verifiedBy}
                  </div>
                )}
                {layer.expiresAtIso && (
                  <div className="mt-0.5 text-[9.5px] text-neutral-500">
                    {layer.status === "expired" ? "Expired " : "Renews "}
                    {formatDate(layer.expiresAtIso)}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Provenance note — Constitution Rule #6 surfaced */}
      <p className="mt-3 rounded-md bg-neutral-50 p-2 text-[9.5px] leading-snug text-neutral-500">
        Trade Center does not verify these credentials directly. Every layer above is
        confirmed by the regulated body, public register, or partner listed. Trade Center
        is the surface, not the certifier.
      </p>
    </div>
  );
}
