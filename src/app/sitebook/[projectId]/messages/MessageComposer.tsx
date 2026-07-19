"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const BRAND_GREEN = "#166534";

export function MessageComposer({ projectId, homeownerName }: { projectId: string; homeownerName: string }) {
  const router = useRouter();
  const [body, setBody]     = useState("");
  const [status, setStatus] = useState<"idle" | "sending">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setStatus("sending");
    await fetch(`/api/homeowner/projects/${projectId}/messages`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ body: body.trim() })
    });
    setBody("");
    setStatus("idle");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 rounded-2xl border-2 bg-white p-4" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <p className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500">Post as {homeownerName}</p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Add an update, ask a question, share a decision…"
        className="mt-2 w-full rounded-md border border-neutral-300 px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400"
      />
      <div className="mt-2 flex justify-end">
        <button
          type="submit"
          disabled={status === "sending" || !body.trim()}
          className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-white shadow-sm disabled:opacity-60"
          style={{ backgroundColor: BRAND_GREEN }}
        >
          {status === "sending" ? "Sending…" : "Post message →"}
        </button>
      </div>
    </form>
  );
}
