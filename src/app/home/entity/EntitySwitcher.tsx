"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, UserRound, Check, Loader2 } from "lucide-react";

const TIER_LABEL: Record<string, string> = {
  individual: "Personal",
  small_business: "Small business",
  contractor: "Contractor",
  enterprise: "Enterprise",
  public_sector: "Public sector"
};

export function EntitySwitcher({
  memberships
}: {
  memberships: {
    entityId: string;
    displayName: string;
    tier: string;
    role: string;
    isActive: boolean;
  }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function switchTo(entityId: string) {
    if (busy) return;
    setBusy(entityId);
    try {
      const res = await fetch("/api/home/entity/switch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entity_id: entityId })
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (memberships.length <= 1) {
    return (
      <div className="rounded-2xl border border-dashed border-[#1B1A17]/15 p-5 text-center text-[13px] text-[#1B1A17]/55">
        You&apos;re only a member of your personal entity right now. Create a
        business entity below to add another context.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {memberships.map((m) => (
        <li key={m.entityId}>
          <button
            type="button"
            onClick={() => switchTo(m.entityId)}
            disabled={m.isActive || busy !== null}
            className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition ${
              m.isActive
                ? "border-amber-400/50 bg-amber-400/10"
                : "border-[#1B1A17]/12 bg-[#1B1A17]/4 hover:border-[#1B1A17]/20 hover:bg-[#1B1A17]/5"
            } disabled:cursor-default`}
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                m.tier === "individual"
                  ? "bg-[#1B1A17]/5 text-[#1B1A17]/70"
                  : "bg-amber-400/15 text-amber-300"
              }`}
            >
              {m.tier === "individual" ? (
                <UserRound className="h-4 w-4" aria-hidden />
              ) : (
                <Building2 className="h-4 w-4" aria-hidden />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-bold text-[#1B1A17]">
                {m.displayName}
              </div>
              <div className="mt-0.5 text-[11px] uppercase tracking-wider text-[#1B1A17]/55">
                {TIER_LABEL[m.tier] ?? m.tier} · {m.role}
              </div>
            </div>
            {m.isActive ? (
              <Check className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
            ) : busy === m.entityId ? (
              <Loader2
                className="h-4 w-4 shrink-0 animate-spin text-[#1B1A17]/55"
                aria-hidden
              />
            ) : (
              <span className="text-[12px] font-semibold text-amber-300">
                Switch →
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
