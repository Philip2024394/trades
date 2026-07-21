"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";

export function CityLaunchComposer() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError]     = useState<string | null>(null);
  const [ok, setOk]           = useState(false);

  const [cityDisplay, setCityDisplay] = useState("");
  const [region, setRegion]           = useState("");
  const [target, setTarget]           = useState<number | "">("");
  const [status, setStatus]           = useState<"PREPARE" | "RECRUIT" | "ACTIVATE">("PREPARE");
  const [nextStep, setNextStep]       = useState("");

  function submit() {
    if (!cityDisplay.trim()) { setError("City name required"); return; }
    setError(null); setOk(false);
    const citySlug = cityDisplay.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    startTransition(async () => {
      const res  = await fetch("/api/admin/coverage", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          citySlug,
          cityDisplay:       cityDisplay.trim(),
          region:            region.trim() || undefined,
          status,
          targetTradesTotal: target === "" ? undefined : Number(target),
          nextStep:          nextStep.trim() || undefined
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Failed"); return; }
      setOk(true);
      setCityDisplay(""); setRegion(""); setTarget(""); setNextStep(""); setStatus("PREPARE");
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
      <input
        value={cityDisplay} onChange={(e) => setCityDisplay(e.target.value)}
        placeholder="City name (Manchester)"
        className="col-span-2 h-9 rounded-md border border-neutral-200 px-2 text-[12px] outline-none focus:border-neutral-500"
      />
      <input
        value={region} onChange={(e) => setRegion(e.target.value)}
        placeholder="Region (North West)"
        className="h-9 rounded-md border border-neutral-200 px-2 text-[12px] outline-none focus:border-neutral-500"
      />
      <select
        value={status} onChange={(e) => setStatus(e.target.value as never)}
        className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-[12px] outline-none focus:border-neutral-500"
      >
        <option value="PREPARE">PREPARE</option>
        <option value="RECRUIT">RECRUIT</option>
        <option value="ACTIVATE">ACTIVATE</option>
      </select>
      <input
        type="number" min={0}
        value={target} onChange={(e) => setTarget(e.target.value === "" ? "" : Number(e.target.value))}
        placeholder="Target trades"
        className="h-9 rounded-md border border-neutral-200 px-2 text-[12px] outline-none focus:border-neutral-500"
      />
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="inline-flex h-9 items-center justify-center gap-1 rounded-md bg-neutral-900 px-3 text-[11px] font-black uppercase tracking-wider text-white shadow-sm hover:brightness-125 disabled:opacity-50"
      >
        {pending ? <Loader2 size={12} className="animate-spin"/> : <Plus size={12}/>} Save
      </button>
      <input
        value={nextStep} onChange={(e) => setNextStep(e.target.value)}
        placeholder="Next step (Recruit 3 electricians)"
        className="col-span-6 h-9 rounded-md border border-neutral-200 px-2 text-[12px] outline-none focus:border-neutral-500"
      />
      {error && <p className="col-span-6 text-[11px] font-bold text-red-800">{error}</p>}
      {ok    && <p className="col-span-6 text-[11px] font-bold text-green-800">Saved.</p>}
    </div>
  );
}
