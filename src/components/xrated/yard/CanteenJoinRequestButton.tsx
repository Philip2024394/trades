"use client";

// CanteenJoinRequestButton — sits on the canteen hero, beside the
// Business Card CTA. Visible only to signed-in trades who are:
//   • NOT the host
//   • NOT already a member
//   • NOT already have a pending request (button shows "Requested" state)
//
// One-tap flow with optional message. No modal spam — the message
// input is a slide-in row that appears after first tap.

import { useState } from "react";
import { UserPlus, Loader2, Check } from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK } from "@/lib/brand/tokens";

type State = "idle" | "composing" | "sending" | "sent" | "error";

export function CanteenJoinRequestButton({
  canteenSlug,
  canteenName,
  visible
}: {
  canteenSlug: string;
  canteenName: string;
  visible:     boolean;
}) {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const [error, setError]     = useState<string | null>(null);
  if (!visible) return null;

  async function send() {
    setState("sending"); setError(null);
    try {
      const res = await fetch(`/api/canteens/${encodeURIComponent(canteenSlug)}/join-request`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: message.trim() || undefined })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setState("sent");
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  if (state === "sent") {
    return (
      <span
        className="inline-flex h-10 items-center gap-1.5 rounded-md px-4 text-[12px] font-black uppercase tracking-wider shadow-sm"
        style={{ backgroundColor: "rgba(22,101,52,0.10)", color: "#166534" }}
      >
        <Check size={13} strokeWidth={2.8}/>
        Request sent
      </span>
    );
  }

  if (state === "idle") {
    return (
      <button
        type="button"
        onClick={() => setState("composing")}
        className="inline-flex h-10 items-center gap-1.5 rounded-md px-4 text-[12px] font-black uppercase tracking-wider shadow-sm transition active:scale-[0.97]"
        style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
      >
        <UserPlus size={13} strokeWidth={2.6}/>
        Request to Join
      </button>
    );
  }

  // composing | sending | error
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={`Say hi to ${canteenName.split(" ")[0]}… (optional)`}
          maxLength={500}
          autoFocus
          disabled={state === "sending"}
          className="h-10 w-48 rounded-md border bg-white/95 px-2.5 text-[12px] outline-none focus:border-neutral-500"
          style={{ borderColor: "rgba(0,0,0,0.15)" }}
        />
        <button
          type="button"
          onClick={send}
          disabled={state === "sending"}
          className="inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-[12px] font-black uppercase tracking-wider shadow-sm transition active:scale-[0.97] disabled:opacity-60"
          style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
        >
          {state === "sending" ? <Loader2 size={13} className="animate-spin"/> : <UserPlus size={13} strokeWidth={2.6}/>}
          Send
        </button>
      </div>
      {error && <p className="text-[10.5px] font-bold text-red-800">{error === "rate-limited" ? "You've hit today's request limit — try again tomorrow." : error}</p>}
    </div>
  );
}
