// /tc/settings/recovery — manage backup sign-in channels.
//
// A trade can pin up to 3 channels (WhatsApp / SMS / Email) so if they
// lose their SIM they can still get in. Adding a channel requires
// proving it via OTP — same code flow as sign-in but the outcome is a
// verified backup, not a new session.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Smartphone, Mail, ShieldCheck, Trash2, Plus, Loader2 } from "lucide-react";
import { PagePersonaBadge } from "@/apps/hub/components/PagePersonaBadge";
import { HowItWorksButton } from "@/apps/hub/components/HowItWorksButton";

type Channel = "whatsapp" | "sms" | "email";

type RecoveryChannel = {
  id: string;
  channel: Channel;
  destination: string;
  verified_at: string | null;
  is_primary: boolean;
  created_at: string;
};

const CHANNEL_META: Record<Channel, { label: string; Icon: typeof MessageCircle }> = {
  whatsapp: { label: "WhatsApp", Icon: MessageCircle },
  sms:      { label: "SMS",      Icon: Smartphone },
  email:    { label: "Email",    Icon: Mail }
};

export default function RecoveryChannelsPage() {
  const [channels, setChannels] = useState<RecoveryChannel[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add-channel form state
  const [newChannel, setNewChannel] = useState<Channel>("email");
  const [newDest, setNewDest] = useState("");
  const [addStep, setAddStep] = useState<"idle" | "sending" | "code" | "verifying">("idle");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/trade/recovery/channels", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      setChannels(json.channels ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function startAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newDest.trim()) return;
    setError(null);
    setAddStep("sending");
    try {
      // 1. Register the channel row (unverified) so the verify step
      //    can flip verified_at true against the trade's id.
      const addRes = await fetch("/api/auth/trade/recovery/channels", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({ channel: newChannel, destination: newDest })
      });
      if (!addRes.ok) {
        const json = await addRes.json().catch(() => ({}));
        throw new Error(json.error ?? String(addRes.status));
      }

      // 2. Send an OTP through the standard endpoint.
      const otpRes = await fetch("/api/auth/trade/otp/send", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({ channel: newChannel, destination: newDest })
      });
      const otpJson = await otpRes.json();
      if (!otpRes.ok) throw new Error(otpJson.error ?? String(otpRes.status));
      setDevCode(otpJson.devCode ?? null);
      setAddStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "add_failed");
      setAddStep("idle");
    }
  }

  async function verifyAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return;
    setAddStep("verifying");
    setError(null);
    try {
      const res = await fetch("/api/auth/trade/otp/verify", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({ channel: newChannel, destination: newDest, code })
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? String(res.status));
      }
      // Reset form + reload list
      setNewDest("");
      setCode("");
      setDevCode(null);
      setAddStep("idle");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "verify_failed");
      setAddStep("code");
    }
  }

  async function removeChannel(id: string) {
    if (!confirm("Remove this backup channel? You won't be able to sign in through it any more.")) return;
    try {
      const res = await fetch(`/api/auth/trade/recovery/channels?id=${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? String(res.status));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "remove_failed");
    }
  }

  return (
    <div className="min-h-screen bg-[#FBF6EC]">
      <PagePersonaBadge persona="trade" label="Recovery · Trade"/>
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-4">
        <Link
          href="/tc/hub"
          className="inline-flex min-h-[36px] items-center gap-1 rounded-full border bg-white px-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-700 shadow-sm hover:bg-neutral-50"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <ArrowLeft size={12}/>
          Hub
        </Link>
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
            TC · Settings · Recovery
          </div>
          <HowItWorksButton topic="settings-recovery"/>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pb-16">
        <div>
          <h1 className="flex items-center gap-1.5 text-[22px] font-black leading-tight text-neutral-900 md:text-[26px]">
            <ShieldCheck size={20}/>
            Backup sign-in channels
          </h1>
          <p className="mt-1 max-w-lg text-[12.5px] leading-snug text-neutral-500">
            If you lose your SIM or change email, you'll still get in through a verified backup.
            Up to 3 channels total. Trade Center never shares your backups with merchants.
          </p>
        </div>

        {/* Current channels */}
        <section
          className="rounded-2xl border bg-white shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.12)" }}
        >
          {loading && (
            <div className="flex items-center gap-2 p-5 text-[12px] text-neutral-500">
              <Loader2 size={14} className="animate-spin"/>
              Loading channels…
            </div>
          )}
          {!loading && channels && channels.length === 0 && (
            <div className="p-5 text-[12px] text-neutral-500">
              No backup channels yet. Add one below.
            </div>
          )}
          {!loading && channels && channels.length > 0 && (
            <ul className="divide-y" style={{ borderColor: "rgba(139,69,19,0.08)" }}>
              {channels.map((c) => {
                const meta = CHANNEL_META[c.channel];
                const verified = Boolean(c.verified_at);
                return (
                  <li key={c.id} className="flex items-center gap-3 p-4">
                    <div
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: verified ? "#0A0A0A" : "#F5F0E4",
                        color: verified ? "#FFB300" : "#525252"
                      }}
                    >
                      <meta.Icon size={16}/>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-[13px] font-black text-neutral-900">
                          {meta.label}
                        </div>
                        {c.is_primary && (
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
                            style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
                          >
                            Primary
                          </span>
                        )}
                        {!verified && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                            unverified
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-neutral-500">
                        {c.destination}
                      </div>
                    </div>
                    {!c.is_primary && (
                      <button
                        type="button"
                        onClick={() => removeChannel(c.id)}
                        aria-label={`Remove ${meta.label}`}
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={14}/>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Add new */}
        <section
          className="rounded-2xl border bg-white p-4 shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.12)" }}
        >
          <div>
            <h2 className="flex items-center gap-1.5 text-[14px] font-black text-neutral-900">
              <Plus size={14}/>
              Add a backup channel
            </h2>
            <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
              We'll send a 6-digit code to verify it belongs to you.
            </p>
          </div>

          {addStep === "idle" || addStep === "sending" ? (
            <form onSubmit={startAdd} className="mt-3 flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-1 rounded-full border bg-neutral-50 p-1" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
                {(Object.keys(CHANNEL_META) as Channel[]).map((ch) => {
                  const active = newChannel === ch;
                  const meta = CHANNEL_META[ch];
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setNewChannel(ch)}
                      aria-pressed={active}
                      className="inline-flex min-h-[36px] items-center justify-center gap-1 rounded-full text-[10.5px] font-black uppercase tracking-wider"
                      style={{
                        backgroundColor: active ? "#0A0A0A" : "transparent",
                        color: active ? "#FFB300" : "#525252"
                      }}
                    >
                      <meta.Icon size={11}/>
                      {meta.label}
                    </button>
                  );
                })}
              </div>

              <input
                type={newChannel === "email" ? "email" : "tel"}
                inputMode={newChannel === "email" ? "email" : "tel"}
                value={newDest}
                onChange={(e) => setNewDest(e.target.value)}
                placeholder={newChannel === "email" ? "backup@example.com" : "07…"}
                className="min-h-[44px] rounded-md border bg-white px-3 text-[13px] text-neutral-900 outline-none placeholder:text-neutral-400"
                style={{ borderColor: "rgba(139,69,19,0.18)" }}
              />

              {error && (
                <div className="rounded-md bg-red-50 p-2 text-[10.5px] text-red-700">
                  {friendlyError(error)}
                </div>
              )}

              <button
                type="submit"
                disabled={!newDest.trim() || addStep === "sending"}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 text-[11.5px] font-black uppercase tracking-wider shadow-sm disabled:opacity-40"
                style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
              >
                {addStep === "sending" ? "Sending…" : "Send verification code"}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyAdd} className="mt-3 flex flex-col gap-3">
              <div className="rounded-md bg-neutral-50 p-3 text-[11px] leading-snug text-neutral-600">
                Code sent to <strong className="text-neutral-900">{newDest}</strong>.
                {devCode && (
                  <div className="mt-1 text-[10.5px] text-neutral-500">
                    Dev code: <strong className="font-mono text-neutral-900">{devCode}</strong>
                  </div>
                )}
              </div>

              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                placeholder="000000"
                className="min-h-[48px] rounded-md border bg-white px-4 text-center font-mono text-[20px] font-black tracking-[0.4em] text-neutral-900 outline-none placeholder:text-neutral-300"
                style={{ borderColor: "rgba(139,69,19,0.18)" }}
                autoFocus
              />

              {error && (
                <div className="rounded-md bg-red-50 p-2 text-[10.5px] text-red-700">
                  {friendlyError(error)}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={code.length !== 6 || addStep === "verifying"}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full px-5 text-[11.5px] font-black uppercase tracking-wider shadow-sm disabled:opacity-40"
                  style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
                >
                  {addStep === "verifying" ? "Verifying…" : "Verify + add"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddStep("idle");
                    setCode("");
                    setDevCode(null);
                  }}
                  className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}

function friendlyError(err: string): string {
  switch (err) {
    case "too_many_channels":         return "You've hit the 3-channel cap. Remove one first.";
    case "cannot_remove_last_channel": return "That's your only channel — you'd be locked out. Add another first.";
    case "invalid_code":              return "That code doesn't match. Try again.";
    case "code_expired_or_missing":   return "Code expired. Send a new one.";
    case "cooldown":                  return "Slow down — a code was just sent.";
    default:                          return `Something went wrong (${err}). Try again.`;
  }
}
