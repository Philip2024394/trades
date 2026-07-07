"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Check } from "lucide-react";

type Member = {
  id: string;
  party_id: string;
  display_name: string;
  email: string;
  role: string;
  can_see_financials: boolean;
  status: string;
  joined_at: string;
};

const ASSIGNABLE_ROLES = [
  "owner",
  "finance",
  "foreman",
  "estimator",
  "viewer",
  "trade"
];

export function MembersTable({
  isOwner,
  currentPartyId,
  members
}: {
  isOwner: boolean;
  currentPartyId: string;
  members: Member[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function patch(memberId: string, body: Record<string, unknown>) {
    if (busy) return;
    setBusy(memberId);
    try {
      await fetch(`/api/home/entity/members/${memberId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function remove(memberId: string) {
    if (busy) return;
    if (!window.confirm("Remove this member? They lose access immediately.")) return;
    setBusy(memberId);
    try {
      await fetch(`/api/home/entity/members/${memberId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (members.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#1B1A17]/15 p-6 text-center text-[13px] text-[#1B1A17]/55">
        No active members yet.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {members.map((m) => {
        const isSelf = m.party_id === currentPartyId;
        return (
          <li
            key={m.id}
            className="rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-4"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-[16px] font-black text-amber-300">
                {m.display_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold text-[#1B1A17]">
                  {m.display_name}
                  {isSelf ? (
                    <span className="ml-2 rounded-full bg-[#1B1A17]/5 px-2 py-0.5 text-[10px] font-bold uppercase text-[#1B1A17]/60">
                      you
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 text-[12px] text-[#1B1A17]/55">
                  {m.email}
                </div>
                <div className="mt-1 text-[11px] text-[#1B1A17]/45">
                  Joined {new Date(m.joined_at).toLocaleDateString("en-GB")}
                </div>
              </div>
              {busy === m.id ? (
                <Loader2
                  className="h-4 w-4 shrink-0 animate-spin text-[#1B1A17]/55"
                  aria-hidden
                />
              ) : null}
            </div>

            {isOwner && !isSelf ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#1B1A17]/55">
                    Role
                  </label>
                  <select
                    value={m.role}
                    onChange={(e) => patch(m.id, { role: e.target.value })}
                    disabled={busy !== null}
                    className="mt-1 w-full appearance-none rounded-lg border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-3 py-2 text-[13px] text-[#1B1A17] focus:border-amber-400 focus:outline-none"
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r} className="text-black">
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#1B1A17]/55">
                    Financial visibility
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      patch(m.id, {
                        can_see_financials: !m.can_see_financials
                      })
                    }
                    disabled={busy !== null}
                    className={`mt-1 inline-flex min-h-[36px] w-full items-center justify-center gap-2 rounded-lg border px-3 text-[12px] font-bold ${
                      m.can_see_financials
                        ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                        : "border-[#1B1A17]/15 bg-[#1B1A17]/4 text-[#1B1A17]/60"
                    }`}
                  >
                    {m.can_see_financials ? (
                      <>
                        <Check className="h-3 w-3" aria-hidden />
                        £ visible
                      </>
                    ) : (
                      "Toggle £ visibility"
                    )}
                  </button>
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={() => remove(m.id)}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-red-300 hover:text-red-200"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden />
                    Remove member
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2 text-[12px] uppercase tracking-wider">
                <span className="text-amber-300">{m.role}</span>
                {m.can_see_financials ? (
                  <span className="text-emerald-300">· £ visible</span>
                ) : null}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
