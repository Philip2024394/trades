"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";

export function InviteTradeForm({
  siteId,
  engagementId,
  hiredDisplayName
}: {
  siteId: string;
  engagementId: string;
  hiredDisplayName: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{
    tone: "success" | "info" | "error";
    text: string;
  } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setMsg(null);
    setSubmitting(true);
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch(
        `/api/home/sites/${siteId}/engagements/${engagementId}/invite`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: String(f.get("email") ?? "").trim().toLowerCase()
          })
        }
      );
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        alreadyOnPlatform?: boolean;
        alreadyPending?: boolean;
      };
      if (!res.ok || !data.ok) {
        setMsg({
          tone: "error",
          text:
            data.error === "invalid_email"
              ? "Enter a valid email."
              : data.error === "trade_already_linked"
                ? "This engagement is already linked to a trade."
                : "Could not send the invitation."
        });
        setSubmitting(false);
        return;
      }
      if (data.alreadyOnPlatform) {
        setMsg({
          tone: "success",
          text: `${hiredDisplayName} is already on thenetworkers.app — engagement linked directly.`
        });
      } else if (data.alreadyPending) {
        setMsg({ tone: "info", text: "Invitation already pending." });
      } else {
        setMsg({
          tone: "success",
          text: "Invitation sent. When they open their Notebook, this engagement links automatically."
        });
      }
      router.refresh();
    } catch {
      setMsg({ tone: "error", text: "Network error — try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
      <input
        name="email"
        type="email"
        required
        placeholder={`${hiredDisplayName.split(" ")[0].toLowerCase()}@example.co.uk`}
        maxLength={200}
        className="min-h-[44px] flex-1 rounded-full border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 text-[14px] text-[#1B1A17] placeholder:text-[#1B1A17]/45 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
      />
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-full bg-amber-400 px-5 text-[13px] font-bold text-neutral-900 hover:bg-amber-300 disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Sending
          </>
        ) : (
          <>
            <Send className="h-3.5 w-3.5" aria-hidden />
            Send invitation
          </>
        )}
      </button>
      {msg ? (
        <p
          className={`sm:col-span-2 text-[12px] ${
            msg.tone === "success"
              ? "text-emerald-300"
              : msg.tone === "info"
                ? "text-amber-200"
                : "text-red-300"
          }`}
        >
          {msg.text}
        </p>
      ) : null}
    </form>
  );
}
