"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, CheckCircle2 } from "lucide-react";
import { TRADE_OPTIONS } from "@/app/join/draftStore";

export function InviteForm() {
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
    const body = {
      displayName: String(f.get("displayName") ?? "").trim(),
      email: String(f.get("email") ?? "").trim().toLowerCase(),
      trade: String(f.get("trade") ?? ""),
      note: String(f.get("note") ?? "").trim() || null
    };

    try {
      const res = await fetch("/api/home/trades/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        alreadyOnPlatform?: boolean;
        alreadyPending?: boolean;
        displayName?: string;
      };
      if (!res.ok || !data.ok) {
        setMsg({
          tone: "error",
          text:
            data.error === "not_authenticated"
              ? "Please sign in first."
              : data.error === "invalid_email"
                ? "That doesn't look like a valid email."
                : data.error === "missing_required_fields"
                  ? "Fill in name, email, and trade."
                  : "Could not send the invitation."
        });
        return;
      }
      if (data.alreadyOnPlatform) {
        setMsg({
          tone: "info",
          text: `${data.displayName ?? "That trade"} is already on thenetworkers.app — we'll add them to your Circle in the next step.`
        });
      } else if (data.alreadyPending) {
        setMsg({
          tone: "info",
          text: "You already invited that trade — waiting on them to accept."
        });
      } else {
        setMsg({
          tone: "success",
          text: "Invitation sent. We'll notify you when they open their Notebook."
        });
        (e.currentTarget as HTMLFormElement).reset();
        router.refresh();
      }
    } catch {
      setMsg({ tone: "error", text: "Network error — try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="displayName"
            className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
          >
            Their business name
          </label>
          <input
            id="displayName"
            name="displayName"
            required
            placeholder="e.g. Mike's Carpentry"
            maxLength={120}
            className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[15px] text-[#1B1A17] placeholder:text-[#1B1A17]/45 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          />
        </div>
        <div>
          <label
            htmlFor="email"
            className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
          >
            Their email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="mike@example.com"
            maxLength={200}
            className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[15px] text-[#1B1A17] placeholder:text-[#1B1A17]/45 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="trade"
          className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
        >
          What do they do?
        </label>
        <select
          id="trade"
          name="trade"
          required
          defaultValue=""
          className="mt-2 w-full appearance-none rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[15px] text-[#1B1A17] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
        >
          <option value="" disabled>
            Choose their trade…
          </option>
          {TRADE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value} className="text-black">
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="note"
          className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
        >
          Personal note (optional)
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          placeholder="Hi Mike, I'd love to keep our records together — this is a free Notebook for your business too."
          maxLength={600}
          className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[14px] text-[#1B1A17] placeholder:text-[#1B1A17]/45 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
        />
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-amber-400 px-6 text-[14px] font-bold text-neutral-900 hover:bg-amber-300 disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Sending…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden />
              Send invitation
            </>
          )}
        </button>
      </div>

      {msg ? (
        <div
          className={`flex items-start gap-2 rounded-xl border p-3 text-[13px] ${
            msg.tone === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
              : msg.tone === "info"
                ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
                : "border-red-500/30 bg-red-500/10 text-red-100"
          }`}
        >
          {msg.tone === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          ) : null}
          <p>{msg.text}</p>
        </div>
      ) : null}
    </form>
  );
}
