"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, CheckCircle2 } from "lucide-react";

const ROLE_OPTIONS = [
  { v: "foreman", l: "Foreman", h: "Runs a site, hires trades, operational visibility" },
  { v: "finance", l: "Finance", h: "Full financial visibility across the entity" },
  { v: "estimator", l: "Estimator / QS", h: "Quotes, materials, budgets" },
  { v: "viewer", l: "Viewer", h: "Read-only — great for advisors or investors" },
  { v: "trade", l: "Trade", h: "External trade linked as a member" }
];

export function InviteMemberForm() {
  const router = useRouter();
  const [role, setRole] = useState("foreman");
  const [canSeeFinancials, setCanSeeFinancials] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<
    | { tone: "success" | "info" | "error"; text: string }
    | null
  >(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setMsg(null);
    setSubmitting(true);
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/home/entity/members/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: String(f.get("email") ?? "").trim().toLowerCase(),
          display_name: String(f.get("display_name") ?? "").trim(),
          role,
          can_see_financials: canSeeFinancials,
          note: String(f.get("note") ?? "").trim() || null
        })
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        alreadyMember?: boolean;
        alreadyPending?: boolean;
      };
      if (!res.ok || !data.ok) {
        setMsg({
          tone: "error",
          text:
            data.error === "not_owner"
              ? "Only owners can invite members."
              : data.error === "invalid_email"
                ? "Enter a valid email."
                : data.error === "cannot_invite_to_personal_entity"
                  ? "Personal entities can't have members."
                  : "Could not send the invitation."
        });
        setSubmitting(false);
        return;
      }
      if (data.alreadyMember) {
        setMsg({ tone: "info", text: "That person is already a member." });
      } else if (data.alreadyPending) {
        setMsg({ tone: "info", text: "That invitation is already pending." });
      } else {
        setMsg({ tone: "success", text: "Invitation sent." });
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
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="display_name"
            className="text-[12px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
          >
            Their name
          </label>
          <input
            id="display_name"
            name="display_name"
            placeholder="e.g. Mike Foreman"
            maxLength={120}
            className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[14px] text-[#1B1A17] placeholder:text-[#1B1A17]/45 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          />
        </div>
        <div>
          <label
            htmlFor="email"
            className="text-[12px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
          >
            Their email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="mike@company.co.uk"
            maxLength={200}
            className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[14px] text-[#1B1A17] placeholder:text-[#1B1A17]/45 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          />
        </div>
      </div>

      <div>
        <span className="text-[12px] font-semibold uppercase tracking-wider text-[#1B1A17]/60">
          Role
        </span>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {ROLE_OPTIONS.map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setRole(opt.v)}
              className={`flex items-start gap-3 rounded-xl border p-3 text-left ${
                role === opt.v
                  ? "border-amber-400 bg-amber-400/10"
                  : "border-[#1B1A17]/12 bg-[#1B1A17]/4 hover:border-[#1B1A17]/20"
              }`}
            >
              <span
                aria-hidden
                className={`mt-0.5 inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                  role === opt.v
                    ? "border-amber-400 bg-amber-400"
                    : "border-white/30"
                }`}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold text-[#1B1A17]">
                  {opt.l}
                </span>
                <span className="block text-[12px] text-[#1B1A17]/55">
                  {opt.h}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="inline-flex cursor-pointer items-center gap-3 rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-3">
          <input
            type="checkbox"
            checked={canSeeFinancials}
            onChange={(e) => setCanSeeFinancials(e.target.checked)}
            className="h-4 w-4 accent-amber-400"
          />
          <span>
            <span className="block text-[13px] font-bold text-[#1B1A17]">
              Grant financial visibility
            </span>
            <span className="block text-[12px] text-[#1B1A17]/55">
              Foreman defaults to operational-only. Turn on to let them see
              money in/out.
            </span>
          </span>
        </label>
      </div>

      <div>
        <label
          htmlFor="note"
          className="text-[12px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
        >
          Personal note (optional)
        </label>
        <textarea
          id="note"
          name="note"
          rows={2}
          maxLength={600}
          placeholder="Hi Mike, joining our Notebook so we can track sites together."
          className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[13px] text-[#1B1A17] placeholder:text-[#1B1A17]/45 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
        />
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-amber-400 px-6 text-[14px] font-bold text-neutral-900 hover:bg-amber-300 disabled:opacity-60"
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
