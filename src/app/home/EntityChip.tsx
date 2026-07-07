"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  UserRound,
  ChevronDown,
  Check,
  Plus,
  Loader2,
  Settings2,
  HardHat,
  LayoutDashboard
} from "lucide-react";

type Membership = {
  entityId: string;
  displayName: string;
  tier: string;
  role: string;
  isActive: boolean;
};

const TIER_ABBR: Record<string, string> = {
  individual: "Personal",
  small_business: "Small biz",
  contractor: "Contractor",
  enterprise: "Enterprise",
  public_sector: "Public sector"
};

export function EntityChip() {
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);

  const [memberships, setMemberships] = useState<Membership[] | null>(null);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/home/entity/list", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok: boolean;
          memberships?: Membership[];
        };
        if (cancelled) return;
        if (data.ok && data.memberships) setMemberships(data.memberships);
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Hide chip on the sign-in surface.
  if (pathname?.startsWith("/home/sign-in")) return null;
  if (!memberships) return null;

  const active = memberships.find((m) => m.isActive) ?? memberships[0];
  if (!active) return null;

  async function switchTo(entityId: string) {
    if (switching || entityId === active.entityId) {
      setOpen(false);
      return;
    }
    setSwitching(entityId);
    try {
      const res = await fetch("/api/home/entity/switch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entity_id: entityId })
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    } finally {
      setSwitching(null);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-[#1B1A17]/15 bg-[#1B1A17]/4 px-3 py-1.5 text-[12px] font-semibold text-[#1B1A17]/95 hover:bg-[#1B1A17]/5"
      >
        <span
          aria-hidden
          className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${
            active.tier === "individual"
              ? "bg-[#1B1A17]/5 text-[#1B1A17]/70"
              : "bg-amber-400/25 text-amber-200"
          }`}
        >
          {active.tier === "individual" ? (
            <UserRound className="h-3 w-3" aria-hidden />
          ) : (
            <Building2 className="h-3 w-3" aria-hidden />
          )}
        </span>
        <span className="max-w-[130px] truncate">{active.displayName}</span>
        <ChevronDown className="h-3 w-3 text-[#1B1A17]/55" aria-hidden />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[280px] overflow-hidden rounded-2xl border border-[#1B1A17]/12 bg-neutral-900/98 shadow-2xl backdrop-blur">
          <div className="border-b border-[#1B1A17]/12 p-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#1B1A17]/45">
              Acting as
            </p>
            <p className="mt-1 text-[13px] font-bold text-[#1B1A17]">
              {active.displayName}
            </p>
            <p className="mt-0.5 text-[11px] uppercase tracking-wider text-amber-300">
              {TIER_ABBR[active.tier] ?? active.tier} · {active.role}
            </p>
          </div>

          {memberships.length > 1 ? (
            <div className="max-h-[240px] overflow-y-auto py-1">
              {memberships.map((m) => (
                <button
                  key={m.entityId}
                  type="button"
                  onClick={() => switchTo(m.entityId)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition hover:bg-[#1B1A17]/4"
                >
                  <span
                    aria-hidden
                    className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
                      m.tier === "individual"
                        ? "bg-[#1B1A17]/5 text-[#1B1A17]/70"
                        : "bg-amber-400/15 text-amber-300"
                    }`}
                  >
                    {m.tier === "individual" ? (
                      <UserRound className="h-3 w-3" aria-hidden />
                    ) : (
                      <Building2 className="h-3 w-3" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-[#1B1A17]">
                      {m.displayName}
                    </span>
                    <span className="mt-0.5 block text-[10px] uppercase tracking-wider text-[#1B1A17]/55">
                      {TIER_ABBR[m.tier] ?? m.tier} · {m.role}
                    </span>
                  </span>
                  {m.isActive ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden />
                  ) : switching === m.entityId ? (
                    <Loader2
                      className="h-3.5 w-3.5 shrink-0 animate-spin text-[#1B1A17]/55"
                      aria-hidden
                    />
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          <div className="border-t border-[#1B1A17]/12 p-2">
            {active.tier !== "individual" ? (
              <>
                <Link
                  href="/home/oversight"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-[#1B1A17]/80 hover:bg-[#1B1A17]/4"
                >
                  <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
                  Oversight dashboard
                </Link>
                <Link
                  href="/home/sites"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-[#1B1A17]/80 hover:bg-[#1B1A17]/4"
                >
                  <HardHat className="h-3.5 w-3.5" aria-hidden />
                  Sites &amp; engagements
                </Link>
              </>
            ) : null}
            <Link
              href="/home/entity/create"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-amber-300 hover:bg-[#1B1A17]/4"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Create a business entity
            </Link>
            <Link
              href="/home/entity"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-[#1B1A17]/80 hover:bg-[#1B1A17]/4"
            >
              <Settings2 className="h-3.5 w-3.5" aria-hidden />
              Manage members &amp; roles
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
