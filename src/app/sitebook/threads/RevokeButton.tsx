"use client";

// Client-side "Close conversation" button for /sitebook/threads.
// Confirms before revoking (destructive-ish action — trade loses reply
// access) then POSTs to /api/homeowner/threads/[id]/revoke and refreshes.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export function RevokeButton({
  threadId,
  tradeName
}: {
  threadId:  string;
  tradeName: string;
}) {
  const router          = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    const ok = window.confirm(
      `Close this WhatsApp thread with ${tradeName}?\n\nThey won't be able to reply through their SiteBook link anymore. You'll both still have each other's WhatsApp numbers. You can start a new thread from a new post.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/homeowner/threads/${threadId}/revoke`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (data.ok) router.refresh();
      else         window.alert("Couldn't close that thread. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex h-8 items-center gap-1 rounded-full border-2 px-3 text-[10px] font-black uppercase tracking-wider disabled:opacity-50"
      style={{ borderColor: "#DC2626", color: "#DC2626" }}
    >
      <X size={10} strokeWidth={2.5}/>
      {busy ? "Closing…" : "Close"}
    </button>
  );
}
