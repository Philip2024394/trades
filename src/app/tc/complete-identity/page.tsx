// /tc/complete-identity — first-run profile setup after sign-in.

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, ChevronDown } from "lucide-react";
import { useCurrentTrade } from "@/lib/useCurrentTrade";

const DISCIPLINES = [
  "Plasterer", "Bricklayer", "Carpenter", "Joiner", "Electrician",
  "Plumber", "Roofer", "Flooring Installer", "Landscaper", "Fencer",
  "Decorator", "Painter", "Tiler", "Kitchen Fitter", "Bathroom Fitter",
  "General Builder", "Groundworker"
];

export default function CompleteIdentityPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { trade } = useCurrentTrade();
  // viewerRole was set at signup on the profile row. DIY viewers skip
  // the trade discipline field — the whole "which trade are you"
  // concept doesn't apply to a homeowner or DIYer.
  const isDiy = trade?.viewerRole === "diy";
  const next = params?.get("next") ?? (isDiy ? "/tc/trade-center" : "/tc/notebook");
  const [displayName, setDisplayName] = useState("");
  const [tradeDiscipline, setTradeDiscipline] = useState("");
  const [homePostcode, setHomePostcode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiredFieldsFilled = isDiy
    ? displayName.trim() !== "" && homePostcode.trim() !== ""
    : displayName.trim() !== "" && tradeDiscipline !== "" && homePostcode.trim() !== "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!requiredFieldsFilled) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/trade/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName,
          // Only send tradeDiscipline for trades — DIY viewers stay null.
          ...(isDiy ? {} : { tradeDiscipline }),
          homePostcode,
          identityComplete: true
        })
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? String(res.status));
      }
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "save_failed");
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FBF6EC]">
      <header className="mx-auto flex w-full max-w-md items-center justify-center px-4 py-4">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: "#FFB300" }}
          />
          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
            Trade Center
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-16 pt-6">
        <div className="text-center">
          <h1 className="text-[24px] font-black leading-tight text-neutral-900">
            {isDiy ? "Welcome — quick setup" : "Complete your identity"}
          </h1>
          <p className="mt-1 text-[12.5px] leading-snug text-neutral-500">
            {isDiy
              ? "Two details so we can show you nearby merchants and delivery."
              : "Three details so merchants can match you to the right trade prices."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Your name" required>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Bob Watson"
              className="min-h-[48px] rounded-md border bg-white px-4 text-[14px] text-neutral-900 outline-none placeholder:text-neutral-400"
              style={{ borderColor: "rgba(139,69,19,0.18)" }}
              autoFocus
              autoComplete="name"
            />
          </Field>

          {/* DIY viewers skip the trade discipline field — the concept
              doesn't apply to a homeowner or DIYer per the constitutional
              rule (feedback_trade_features_trade_only.md). */}
          {!isDiy && (
            <Field label="Your trade" required>
              <div className="relative">
                <select
                  value={tradeDiscipline}
                  onChange={(e) => setTradeDiscipline(e.target.value)}
                  className="min-h-[48px] w-full appearance-none rounded-md border bg-white px-4 pr-10 text-[14px] text-neutral-900 outline-none"
                  style={{ borderColor: "rgba(139,69,19,0.18)" }}
                >
                  <option value="">Pick your trade…</option>
                  {DISCIPLINES.map((d) => (
                    <option key={d} value={d.toLowerCase().replace(/\s+/g, "-")}>{d}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500"/>
              </div>
            </Field>
          )}

          <Field label="Post code required for delivery and returns" required hint="First half is fine (M20). Used for nearest-merchant matching and merchant returns.">
            <input
              type="text"
              value={homePostcode}
              onChange={(e) => setHomePostcode(e.target.value.toUpperCase())}
              placeholder="M20"
              className="min-h-[48px] rounded-md border bg-white px-4 text-[14px] uppercase tracking-wider text-neutral-900 outline-none placeholder:text-neutral-400"
              style={{ borderColor: "rgba(139,69,19,0.18)" }}
              autoComplete="postal-code"
              maxLength={8}
            />
          </Field>

          {error && (
            <div className="rounded-md bg-red-50 p-2 text-[10.5px] text-red-700">
              Couldn&apos;t save: {error}. Try again.
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !requiredFieldsFilled}
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full px-6 text-[13px] font-black uppercase tracking-wider shadow-sm disabled:opacity-40"
            style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
          >
            <ShieldCheck size={14}/>
            {saving ? "Saving…" : "Continue to Trade Center"}
          </button>
        </form>
      </main>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </span>
      {children}
      {hint && <span className="text-[10.5px] leading-snug text-neutral-500">{hint}</span>}
    </label>
  );
}
