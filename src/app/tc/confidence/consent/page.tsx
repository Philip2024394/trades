// /tc/confidence/consent — the CUSTOMER-side consent screen.
//
// This is the single screen a customer sees when a trade sends them a
// "Verify to Quote" link. Every checkbox is opt-in per source (Companies
// House / Registry Trust / Creditsafe / Experian / Trade Center native /
// nominated references). No boxes are pre-ticked. Consent is per-trade
// and time-limited (30 days).
//
// Constitution Rule #6: Trade Center never pulls anything without this
// explicit signed consent. UK GDPR Art 6(1)(a) lawful basis.

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Building2,
  Gavel,
  BarChart3,
  Handshake,
  Landmark,
  Info
} from "lucide-react";

type ConsentKey =
  | "companiesHouse"
  | "registryTrust"
  | "bureau"
  | "tradeCenterNative"
  | "references";

const CONSENT_ITEMS: Array<{
  key: ConsentKey;
  Icon: typeof Building2;
  label: string;
  detail: string;
  costGbp?: number;
  isRegulatedPartner?: boolean;
}> = [
  {
    key: "companiesHouse",
    Icon: Building2,
    label: "Companies House record (business only)",
    detail: "Company status, director history, filed accounts. Public register.",
    costGbp: 0
  },
  {
    key: "registryTrust",
    Icon: Gavel,
    label: "Registry Trust CCJ lookup",
    detail: "County Court Judgments in the last 6 years. Regulated public register.",
    costGbp: 6
  },
  {
    key: "bureau",
    Icon: BarChart3,
    label: "Business or consumer credit report (partner-provided)",
    detail: "Report is provided by Creditsafe (business) or Experian (consumer). The bureau is the data controller — Trade Center passes the request through.",
    costGbp: 4.5,
    isRegulatedPartner: true
  },
  {
    key: "tradeCenterNative",
    Icon: Landmark,
    label: "Your Trade Center payment history",
    detail: "Only data YOU generated inside Trade Center — jobs paid, timing, disputes raised."
  },
  {
    key: "references",
    Icon: Handshake,
    label: "Two trade-reference requests (nominated by you)",
    detail: "You nominate 2 previous trades below. They receive a Y/N request from Trade Center. Their reply is shared only with the requesting trade."
  }
];

export default function ConsentScreen() {
  const [consents, setConsents] = useState<Record<ConsentKey, boolean>>({
    companiesHouse: false,
    registryTrust: false,
    bureau: false,
    tradeCenterNative: false,
    references: false
  });
  const [ref1, setRef1] = useState("");
  const [ref2, setRef2] = useState("");
  const [signed, setSigned] = useState(false);

  const requestingTrade = "Bob Watson · Watson Plastering Ltd";
  const anyConsented = Object.values(consents).some(Boolean);

  const totalCost = useMemo(
    () =>
      CONSENT_ITEMS.reduce((sum, item) => {
        if (!consents[item.key]) return sum;
        return sum + (item.costGbp ?? 0);
      }, 0),
    [consents]
  );

  if (signed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBF6EC] px-4">
        <div className="max-w-md rounded-xl border bg-white p-6 text-center shadow-sm" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: "#166534" }}>
            <ShieldCheck size={28} strokeWidth={2.5} className="text-white"/>
          </div>
          <h1 className="mt-4 text-[18px] font-black text-neutral-900">Consent signed</h1>
          <p className="mt-2 text-[12px] leading-relaxed text-neutral-600">
            {requestingTrade} will now see your Confidence Card for the next 30 days. Trade
            Center does not store your bureau report. You can revoke consent at any time
            from your Trade Center account.
          </p>
          <Link
            href="/tc/trade-center/plastering"
            className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 text-[11.5px] font-black uppercase tracking-wider text-white shadow-sm"
            style={{ backgroundColor: "#166534" }}
          >
            Done
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 md:py-10">
        {/* Header */}
        <header className="mb-6">
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Trade Center · Verify to Quote
          </div>
          <h1 className="mt-1 text-[22px] font-black leading-tight text-neutral-900 md:text-[26px]">
            You've been asked to verify your details
          </h1>
          <p className="mt-1 text-[12.5px] leading-snug text-neutral-600">
            <span className="font-bold">{requestingTrade}</span> would like to run a quick
            verification before quoting your job. You choose what to share.
          </p>
        </header>

        {/* Consent list */}
        <div
          className="rounded-xl border bg-white p-4 shadow-sm md:p-5"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Tick what you're happy to share
          </div>
          <ul className="mt-3 flex flex-col gap-2.5">
            {CONSENT_ITEMS.map((item) => {
              const on = consents[item.key];
              return (
                <li key={item.key}>
                  <label
                    className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border p-3"
                    style={{ borderColor: on ? "#166534" : "rgba(139,69,19,0.15)", backgroundColor: on ? "#F0FDF4" : "white" }}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) =>
                        setConsents((c) => ({ ...c, [item.key]: e.target.checked }))
                      }
                      className="mt-0.5 h-4 w-4 flex-shrink-0"
                    />
                    <item.Icon size={16} className="mt-0.5 flex-shrink-0 text-neutral-600"/>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <div className="text-[12.5px] font-black leading-tight text-neutral-900">
                          {item.label}
                        </div>
                        {item.isRegulatedPartner && (
                          <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                            Regulated partner
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] leading-snug text-neutral-600">
                        {item.detail}
                      </div>
                      {item.costGbp !== undefined && item.costGbp > 0 && (
                        <div className="mt-0.5 text-[10px] font-bold text-neutral-500">
                          Cost £{item.costGbp.toFixed(2)} — paid by the requesting trade, not you.
                        </div>
                      )}
                    </div>
                  </label>

                  {/* Reference fields appear when references toggled on */}
                  {item.key === "references" && on && (
                    <div className="ml-8 mt-2 flex flex-col gap-2">
                      <input
                        type="text"
                        placeholder="Reference 1 — merchant name & email"
                        value={ref1}
                        onChange={(e) => setRef1(e.target.value)}
                        className="min-h-[44px] w-full rounded-md border bg-white px-3 text-[12.5px]"
                        style={{ borderColor: "rgba(139,69,19,0.15)" }}
                      />
                      <input
                        type="text"
                        placeholder="Reference 2 — merchant name & email"
                        value={ref2}
                        onChange={(e) => setRef2(e.target.value)}
                        className="min-h-[44px] w-full rounded-md border bg-white px-3 text-[12.5px]"
                        style={{ borderColor: "rgba(139,69,19,0.15)" }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Provenance + cost summary */}
          <div className="mt-4 flex items-start gap-2 rounded-md bg-neutral-50 p-3">
            <Info size={13} className="mt-0.5 flex-shrink-0 text-neutral-500"/>
            <p className="text-[10.5px] leading-snug text-neutral-600">
              Trade Center does not verify or score any of this data itself. Every ticked
              source is fetched fresh from the regulated body or public register named, then
              shared only with {requestingTrade} for 30 days. Trade Center does not keep
              your bureau report. Pass-through cost {`£${totalCost.toFixed(2)}`} — paid by the
              trade, not you.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link
            href="/tc"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border bg-white px-5 text-[11.5px] font-black uppercase tracking-wider text-neutral-700 shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            Cancel
          </Link>
          <button
            type="button"
            disabled={!anyConsented}
            onClick={() => setSigned(true)}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 text-[11.5px] font-black uppercase tracking-wider text-white shadow-sm disabled:opacity-50"
            style={{ backgroundColor: "#166534" }}
          >
            <ShieldCheck size={13}/>
            Sign & Share ({Object.values(consents).filter(Boolean).length})
          </button>
        </div>
      </main>
    </div>
  );
}
