"use client";

// Accept / Decline buttons for /join/[token]. Public — no auth. Token
// is the credential. On accept, we route the trade to a lightweight
// "you're in" confirmation; on decline, a soft "no worries" screen.

import { useState } from "react";
import { Check, X } from "lucide-react";

const BRAND_GREEN = "#166534";

type Phase = "idle" | "accepted" | "declined" | "error";

export function JoinActions({ token, projectCount }: { token: string; projectCount: number }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(kind: "accept" | "decline") {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const res  = await fetch(`/api/invitations/${token}/${kind}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        setError(prettyError(data.error));
        setBusy(false);
        return;
      }
      setPhase(kind === "accept" ? "accepted" : "declined");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "accepted") {
    return (
      <div className="text-center">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white shadow-sm" style={{ backgroundColor: BRAND_GREEN }}>
          <Check size={20} strokeWidth={3}/>
        </span>
        <p className="mt-3 text-[15px] font-black text-neutral-900">
          Accepted. You&rsquo;re on {projectCount === 1 ? "the project" : `all ${projectCount} projects`}.
        </p>
        <p className="mt-1 text-[12.5px] text-neutral-600">
          The homeowner sees you as a member now. You&rsquo;ll get an invite to sign in on your next visit to The Network.
        </p>
      </div>
    );
  }

  if (phase === "declined") {
    return (
      <div className="text-center">
        <p className="text-[15px] font-black text-neutral-900">Thanks for letting us know.</p>
        <p className="mt-1 text-[12.5px] text-neutral-600">
          The homeowner has been notified you&rsquo;re not available. They can invite you again later.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-neutral-500">
        Your response
      </p>
      <p className="mt-1 text-[13px] text-neutral-700">
        Accepting joins you to {projectCount === 1 ? "this project" : `all ${projectCount} projects`}. You can still leave later.
      </p>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-bold text-red-800">{error}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => post("accept")}
          disabled={busy}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-5 text-[12px] font-black uppercase tracking-wider text-white shadow-sm transition hover:brightness-95 disabled:opacity-50"
          style={{ backgroundColor: BRAND_GREEN }}
        >
          <Check size={13} strokeWidth={2.5}/>
          {busy ? "Working…" : "Accept + join"}
        </button>
        <button
          type="button"
          onClick={() => post("decline")}
          disabled={busy}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border-2 border-neutral-300 bg-white px-5 text-[12px] font-black uppercase tracking-wider text-neutral-700 disabled:opacity-50"
        >
          <X size={13} strokeWidth={2.5}/>
          Not available
        </button>
      </div>
    </div>
  );
}

function prettyError(code: string): string {
  switch (code) {
    case "not-found":          return "This invitation isn't valid.";
    case "revoked":            return "The homeowner has withdrawn this invitation.";
    case "already-responded":  return "You've already responded to this invitation.";
    default:                   return "Couldn't process your response. Try again.";
  }
}
