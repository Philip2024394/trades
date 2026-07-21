"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldOff, ShieldCheck, Loader2 } from "lucide-react";

export function MerchantSuspendButton({
  slug, isSuspended
}: {
  slug: string; isSuspended: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [showReason, setShowReason] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function fire(action: "suspend" | "unsuspend") {
    setError(null);
    if (action === "suspend" && !showReason) { setShowReason(true); return; }
    startTransition(async () => {
      const res  = await fetch(`/api/admin/merchants/${slug}/suspend`, {
        method:  action === "suspend" ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    action === "suspend" ? JSON.stringify({ reason }) : undefined
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Action failed"); return; }
      setShowReason(false); setReason("");
      router.refresh();
    });
  }

  if (isSuspended) {
    return (
      <button
        type="button"
        onClick={() => fire("unsuspend")}
        disabled={pending}
        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-green-700 px-3 text-[11px] font-black uppercase tracking-wider text-white shadow-sm hover:brightness-110 disabled:opacity-50"
      >
        {pending ? <Loader2 size={12} className="animate-spin"/> : <ShieldCheck size={12}/>}
        Unsuspend
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {showReason && (
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required)"
          className="h-8 w-56 rounded-md border border-red-200 bg-red-50 px-2 text-[11.5px] outline-none focus:border-red-400"
          autoFocus
        />
      )}
      <button
        type="button"
        onClick={() => fire("suspend")}
        disabled={pending || (showReason && !reason.trim())}
        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-red-700 px-3 text-[11px] font-black uppercase tracking-wider text-white shadow-sm hover:brightness-110 disabled:opacity-50"
      >
        {pending ? <Loader2 size={12} className="animate-spin"/> : <ShieldOff size={12}/>}
        {showReason ? "Confirm suspend" : "Suspend"}
      </button>
      {error && <p className="text-[10.5px] font-bold text-red-800">{error}</p>}
    </div>
  );
}
