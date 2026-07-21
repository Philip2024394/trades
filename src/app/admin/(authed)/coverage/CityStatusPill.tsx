"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { CityLaunchStatus } from "@/lib/cityLaunch/engine";

const STATUS_COLOUR: Record<CityLaunchStatus, string> = {
  PREPARE:  "#6B7280",
  RECRUIT:  "#F59E0B",
  ACTIVATE: "#FFB300",
  GROW:     "#166534",
  DOMINATE: "#0A0A0A",
  PAUSED:   "#B91C1C"
};

const OPTIONS: CityLaunchStatus[] = ["PREPARE", "RECRUIT", "ACTIVATE", "GROW", "DOMINATE", "PAUSED"];

export function CityStatusPill({ citySlug, status }: { citySlug: string; status: CityLaunchStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onChange(next: CityLaunchStatus) {
    if (next === status) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/coverage", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ citySlug, status: next })
      });
      if (!res.ok) { setError("Failed"); return; }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-1">
      <select
        value={status}
        onChange={(e) => onChange(e.target.value as CityLaunchStatus)}
        disabled={pending}
        className="rounded-full border-2 border-neutral-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white outline-none"
        style={{ backgroundColor: STATUS_COLOUR[status] }}
      >
        {OPTIONS.map(o => (
          <option key={o} value={o} className="bg-white text-neutral-900">{o}</option>
        ))}
      </select>
      {pending && <Loader2 size={11} className="animate-spin text-neutral-400"/>}
      {error && <span className="text-[10px] font-bold text-red-700">{error}</span>}
    </span>
  );
}
