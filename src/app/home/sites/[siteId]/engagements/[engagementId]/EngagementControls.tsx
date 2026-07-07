"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, CheckCircle2, X, ClipboardCheck } from "lucide-react";

const NEXT_ALLOWED: Record<string, { value: string; label: string }[]> = {
  pending: [
    { value: "accepted", label: "Accept" },
    { value: "cancelled", label: "Cancel" }
  ],
  accepted: [
    { value: "in_progress", label: "Mark started" },
    { value: "disputed", label: "Raise dispute" },
    { value: "cancelled", label: "Cancel" }
  ],
  in_progress: [
    { value: "completed", label: "Mark completed" },
    { value: "disputed", label: "Raise dispute" }
  ],
  completed: [
    { value: "in_progress", label: "Reopen" }
  ],
  disputed: [
    { value: "accepted", label: "Resolve → accepted" },
    { value: "in_progress", label: "Resolve → in progress" },
    { value: "cancelled", label: "Close as cancelled" }
  ]
};

export function EngagementControls({
  siteId,
  engagementId,
  currentStatus,
  agreedPricePence,
  priorPaidPence,
  canSignOff,
  canTransition
}: {
  siteId: string;
  engagementId: string;
  currentStatus: string;
  agreedPricePence: number | null;
  priorPaidPence: number;
  canSignOff: boolean;
  canTransition: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signOffOpen, setSignOffOpen] = useState(false);

  const transitions = NEXT_ALLOWED[currentStatus] ?? [];
  const canSignOffFromHere = ["accepted", "in_progress", "completed"].includes(
    currentStatus
  );
  const balancePence =
    agreedPricePence != null
      ? Math.max(0, agreedPricePence - priorPaidPence)
      : null;

  async function transition(newStatus: string) {
    if (busy) return;
    setError(null);
    setBusy(newStatus);
    try {
      const res = await fetch(
        `/api/home/sites/${siteId}/engagements/${engagementId}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: newStatus })
        }
      );
      const data = (await res.json()) as { ok: boolean; error?: string; detail?: string };
      if (!res.ok || !data.ok) {
        setError(data.detail ?? data.error ?? "Could not update status.");
        setBusy(null);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(null);
    }
  }

  async function submitSignOff(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy("signoff");
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch(
        `/api/home/sites/${siteId}/engagements/${engagementId}/signoff`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            method: String(f.get("method") ?? "bank_transfer"),
            reference: String(f.get("reference") ?? "") || null,
            note: String(f.get("note") ?? "") || null
          })
        }
      );
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.detail ?? data.error ?? "Could not sign off.");
        setBusy(null);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(null);
    }
  }

  if (currentStatus === "signed_off") {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
        <div className="flex items-start gap-3">
          <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
          <div>
            <p className="text-[14px] font-bold text-[#1B1A17]">Signed off.</p>
            <p className="mt-1 text-[13px] text-[#1B1A17]/60">
              This engagement is closed. The final payment is on record and
              cannot be moved back.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (currentStatus === "cancelled") {
    return (
      <div className="rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-4 text-[13px] text-[#1B1A17]/60">
        This engagement was cancelled.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {canTransition && transitions.length > 0 ? (
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#1B1A17]/55">
            Move to
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {transitions.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => transition(t.value)}
                disabled={busy !== null}
                className={`inline-flex min-h-[42px] items-center gap-2 rounded-full border px-4 text-[13px] font-bold transition ${
                  t.value === "cancelled" || t.value === "disputed"
                    ? "border-red-400/40 bg-red-500/5 text-red-200 hover:bg-red-500/15"
                    : "border-[#1B1A17]/15 bg-[#1B1A17]/4 text-[#1B1A17] hover:bg-[#1B1A17]/5"
                } disabled:opacity-60`}
              >
                {busy === t.value ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : t.value === "cancelled" ? (
                  <X className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                )}
                {t.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {canSignOff && canSignOffFromHere ? (
        <div>
          {!signOffOpen ? (
            <button
              type="button"
              onClick={() => setSignOffOpen(true)}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-amber-400 px-5 text-[14px] font-bold text-neutral-900 hover:bg-amber-300"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Sign off &amp; record final payment
            </button>
          ) : (
            <form
              onSubmit={submitSignOff}
              className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-5"
            >
              <p className="text-[13px] font-bold text-[#1B1A17]">
                Sign off {balancePence != null ? "and record final payment" : "engagement"}
              </p>
              {balancePence != null ? (
                <p className="mt-1 text-[13px] text-[#1B1A17]/70">
                  Balance owed:{" "}
                  <b className="text-amber-300">
                    £{(balancePence / 100).toLocaleString("en-GB")}
                  </b>
                  {priorPaidPence > 0 ? (
                    <>
                      {" · already paid £"}
                      {(priorPaidPence / 100).toLocaleString("en-GB")}
                    </>
                  ) : null}
                </p>
              ) : (
                <p className="mt-1 text-[13px] text-[#1B1A17]/60">
                  No agreed price on this engagement — sign-off marks
                  completion without creating a payment.
                </p>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="method"
                    className="text-[11px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
                  >
                    Method
                  </label>
                  <select
                    id="method"
                    name="method"
                    defaultValue="bank_transfer"
                    className="mt-1 w-full appearance-none rounded-lg border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-3 py-2 text-[13px] text-[#1B1A17] focus:border-amber-400 focus:outline-none"
                  >
                    <option value="bank_transfer" className="text-black">
                      Bank transfer
                    </option>
                    <option value="cash" className="text-black">Cash</option>
                    <option value="card" className="text-black">Card</option>
                    <option value="cheque" className="text-black">Cheque</option>
                    <option value="other" className="text-black">Other</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="reference"
                    className="text-[11px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
                  >
                    Reference
                  </label>
                  <input
                    id="reference"
                    name="reference"
                    placeholder="e.g. Final — Elm Grove Kitchen"
                    maxLength={200}
                    className="mt-1 w-full rounded-lg border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-3 py-2 text-[13px] text-[#1B1A17] placeholder:text-[#1B1A17]/45 focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label
                  htmlFor="note"
                  className="text-[11px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
                >
                  Note (optional)
                </label>
                <input
                  id="note"
                  name="note"
                  placeholder="Anything worth recording."
                  maxLength={400}
                  className="mt-1 w-full rounded-lg border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-3 py-2 text-[13px] text-[#1B1A17] placeholder:text-[#1B1A17]/45 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={busy !== null}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-amber-400 px-5 text-[13px] font-bold text-neutral-900 hover:bg-amber-300 disabled:opacity-60"
                >
                  {busy === "signoff" ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      Signing off…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      Confirm sign-off
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSignOffOpen(false)}
                  className="text-[13px] font-semibold text-[#1B1A17]/55 hover:text-[#1B1A17]"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}

      {error ? <p className="text-[13px] text-red-300">{error}</p> : null}
    </div>
  );
}
