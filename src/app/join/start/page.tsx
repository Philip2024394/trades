// Step 1 — Business name + primary trade + location.
"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Info } from "lucide-react";
import { useDraft, TRADE_OPTIONS } from "../draftStore";
import { WizardShell, fieldClass, labelClass } from "../WizardShell";

const INVITE_STORAGE_KEY = "xratedtrade:join-invite-token";

export default function StepStartPage() {
  return (
    <Suspense fallback={<div />}>
      <StepStart />
    </Suspense>
  );
}

function StepStart() {
  const router = useRouter();
  const params = useSearchParams();
  const { draft, patch, hydrated } = useDraft();

  const [inviteContext, setInviteContext] = useState<{
    inviterName: string;
    displayName: string;
    email: string;
  } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    const inviteToken = params.get("invite");
    if (!inviteToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/join/invite-lookup?token=${encodeURIComponent(inviteToken)}`,
          { cache: "no-store" }
        );
        const data = (await res.json()) as {
          ok: boolean;
          error?: string;
          invite?: {
            displayName: string;
            email: string;
            trade: string;
            note: string | null;
            inviterName: string;
          };
        };
        if (cancelled) return;
        if (!res.ok || !data.ok || !data.invite) {
          setInviteError(
            data.error === "invite_expired"
              ? "This invitation has expired — you can still join without it."
              : data.error === "not_found"
                ? "This invitation link isn't recognised."
                : "Couldn't load your invitation — you can still join."
          );
          return;
        }
        // Persist the token so submit can attach it later.
        try {
          window.sessionStorage.setItem(INVITE_STORAGE_KEY, inviteToken);
        } catch {
          /* ignore */
        }
        setInviteContext({
          inviterName: data.invite.inviterName,
          displayName: data.invite.displayName,
          email: data.invite.email
        });
        patch({
          displayName: data.invite.displayName,
          primaryTrade: data.invite.trade,
          email: data.invite.email
        });
      } catch {
        if (!cancelled) setInviteError("Couldn't load your invitation — you can still join.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    patch({
      displayName: String(f.get("displayName") ?? "").trim(),
      primaryTrade: String(f.get("primaryTrade") ?? ""),
      city: String(f.get("city") ?? "").trim(),
      postcode: String(f.get("postcode") ?? "").trim().toUpperCase()
    });
    router.push("/join/contact");
  }

  return (
    <WizardShell
      step="start"
      backHref="/join"
      title={
        inviteContext
          ? `${inviteContext.inviterName} added you to their Notebook.`
          : "Open your Notebook."
      }
      subtitle={
        inviteContext
          ? "We've prefilled a few things from their invitation. Confirm your details to open your free Notebook."
          : "Your business name, what you do, and where you work. Two minutes to the record."
      }
    >
      {inviteError ? (
        <div className="mb-6 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-[13px] text-amber-100">
          <Info className="mr-1.5 inline h-3.5 w-3.5 align-text-bottom" aria-hidden />
          {inviteError}
        </div>
      ) : null}

      <form onSubmit={submit} className="space-y-6">
        <div>
          <label htmlFor="displayName" className={labelClass}>
            Business name
          </label>
          <input
            id="displayName"
            name="displayName"
            required
            defaultValue={hydrated ? draft.displayName : ""}
            placeholder="e.g. Smith Roofing Ltd"
            className={`${fieldClass} mt-2`}
            maxLength={120}
          />
          <p className="mt-1 text-[13px] text-[#1B1A17]/45">
            This is how customers will find you.
          </p>
        </div>

        <div>
          <label htmlFor="primaryTrade" className={labelClass}>
            Primary trade
          </label>
          <select
            id="primaryTrade"
            name="primaryTrade"
            required
            defaultValue={hydrated ? draft.primaryTrade : ""}
            className={`${fieldClass} mt-2 appearance-none`}
          >
            <option value="" disabled className="text-black">
              Choose your main trade…
            </option>
            {TRADE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value} className="text-black">
                {t.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[13px] text-[#1B1A17]/45">
            You can add more later — this is what customers see first.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="city" className={labelClass}>
              Town / city
            </label>
            <input
              id="city"
              name="city"
              required
              defaultValue={hydrated ? draft.city : ""}
              placeholder="e.g. Manchester"
              className={`${fieldClass} mt-2`}
              maxLength={80}
            />
          </div>
          <div>
            <label htmlFor="postcode" className={labelClass}>
              Postcode
            </label>
            <input
              id="postcode"
              name="postcode"
              required
              defaultValue={hydrated ? draft.postcode : ""}
              placeholder="M1 2AB"
              className={`${fieldClass} mt-2 uppercase`}
              autoComplete="postal-code"
              maxLength={8}
            />
          </div>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-amber-400 px-6 text-[15px] font-bold text-neutral-900 transition hover:bg-amber-300 sm:w-auto"
          >
            Continue
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </form>
    </WizardShell>
  );
}
