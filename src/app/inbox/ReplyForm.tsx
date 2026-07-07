// Reply form — client component. Records the reply against the
// project + fires an email back to the homeowner.
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Send, Loader2, CheckCircle2 } from "lucide-react";

type Status = "idle" | "sending" | "sent" | "error";

export function ReplyForm({ projectId }: { projectId: string }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending" || !message.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/inbox/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, token, message: message.trim() })
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1.5 text-[13px] font-semibold text-emerald-300">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Reply sent — the homeowner will get it by email.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-5">
      <label
        htmlFor={`reply-${projectId}`}
        className="text-[11px] font-extrabold uppercase tracking-wider text-[#1B1A17]/55"
      >
        Reply to this brief
      </label>
      <textarea
        id={`reply-${projectId}`}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Introduce yourself, your availability, an initial ballpark…"
        rows={3}
        className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[14px] text-[#1B1A17] placeholder:text-[#1B1A17]/45 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
        maxLength={2000}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        {status === "error" ? (
          <span className="text-[13px] text-red-300">
            Could not send. Try again.
          </span>
        ) : (
          <span className="text-[13px] text-[#1B1A17]/45">
            Reply lives on the Notebook alongside the brief.
          </span>
        )}
        <button
          type="submit"
          disabled={status === "sending" || !message.trim()}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-amber-400 px-5 text-[13px] font-bold text-neutral-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === "sending" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
          Send reply
        </button>
      </div>
    </form>
  );
}
