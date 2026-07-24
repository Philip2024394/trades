"use client";

// ConnectDialog — Discover / Dating Mode introduction.
// This is the DISCOVER connection context — a simple, friendly,
// personal introduction. It is NOT the networking / marketplace /
// community connector — those live in their own surfaces with their
// own dialogs. Do not re-add reason categories (Business, Buying
// Products, Advice, Local Community, Other) here — see memory
// `feedback_discover_connect_no_categories.md`.
//
// Flow: profile tapped → "Connect with X?" → optional short message
// → "ASK NEX TO INTRODUCE" → NEX sends the standard friendly intro
// (plus the user's optional line if provided) → recipient can
// Accept · Decline · Ignore.
//
// V1: Send logs to console + shows a sent state. V2 wires to the
// discovery invitation service which creates a pending request +
// notifies the recipient. On accept, Messenger opens (no AI in the
// conversation — the AI cost stops at the intro).

import { useState } from "react";
import { X, Sparkles } from "lucide-react";
import type { DiscoverProfile } from "@/lib/nex/discover/_types";

const MAX_MESSAGE = 140;

export function ConnectDialog({
  profile, onClose
}: {
  profile: DiscoverProfile | null;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");
  const [sent, setSent]       = useState(false);
  const open = profile !== null;

  function handleSend() {
    if (!profile) return;
    // V1: log + show success. V2: POST /api/nex/discover/connect
    // eslint-disable-next-line no-console
    console.info("[discover] send connect", {
      to: profile.id,
      optional_message: message.trim() || null
    });
    setSent(true);
    window.setTimeout(() => {
      setSent(false);
      onClose();
      setMessage("");
    }, 1800);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 z-[70] transition-opacity"
        style={{
          background: "rgba(15, 17, 21, 0.5)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transitionDuration: "var(--nex-motion-medium)"
        }}
      />

      {/* Modal */}
      <section
        role="dialog"
        aria-modal={open}
        aria-label="Ask NEX to Connect"
        className="fixed inset-x-0 top-1/2 z-[80] mx-auto -translate-y-1/2 px-5"
        style={{
          maxWidth: 448,
          opacity: open ? 1 : 0,
          transform: open ? "translateY(-50%) scale(1)" : "translateY(-50%) scale(0.96)",
          transitionProperty: "opacity, transform",
          transitionDuration: "var(--nex-motion-medium)",
          transitionTimingFunction: "var(--nex-ease-signature)",
          pointerEvents: open ? "auto" : "none"
        }}
      >
        {profile && (
          <div
            className="rounded-2xl px-5 py-5"
            style={{
              background: "var(--nex-neutral-0)",
              boxShadow: "var(--nex-shadow-xl)",
              border: "1px solid var(--nex-neutral-200)"
            }}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest"
                     style={{ color: "var(--nex-accent-500)" }}>
                  Ask NEX to Connect
                </div>
                <h3 className="mt-1 text-[16px] font-black leading-tight"
                    style={{ color: "var(--nex-neutral-900)" }}>
                  Connect with {profile.first_name}?
                </h3>
                <p className="mt-1 text-[12px] leading-[1.5]"
                   style={{ color: "var(--nex-neutral-500)" }}>
                  NEX will introduce you both. {profile.first_name} can accept, decline or ignore.
                </p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close"
                      className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full"
                      style={{ background: "var(--nex-neutral-100)", color: "var(--nex-neutral-700)" }}>
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            {/* Optional short message */}
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <div className="text-[10px] font-bold uppercase tracking-widest"
                     style={{ color: "var(--nex-neutral-500)" }}>
                  Add a short message (optional)
                </div>
                <div className="text-[10px] tabular-nums"
                     style={{ color: "var(--nex-neutral-400)" }}>
                  {message.length}/{MAX_MESSAGE}
                </div>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
                placeholder={`Hi ${profile.first_name}, NEX thought we might connect.`}
                rows={2}
                className="w-full resize-none rounded-xl px-3.5 py-2.5 text-[13px] outline-none focus:outline-2 focus:outline-[color:var(--nex-accent-500)]"
                style={{
                  background: "var(--nex-neutral-50)",
                  border: "1px solid var(--nex-neutral-200)",
                  color: "var(--nex-neutral-900)"
                }}
              />
            </div>

            {/* Preview */}
            <div className="mt-4 rounded-xl px-3 py-3"
                 style={{ background: "var(--nex-accent-50)", border: "1px solid var(--nex-accent-100)" }}>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-widest"
                   style={{ color: "var(--nex-accent-700)" }}>
                NEX will send
              </div>
              <p className="text-[12px] leading-[1.55]"
                 style={{ color: "var(--nex-neutral-900)" }}>
                Hello {profile.first_name} 👋 <br />
                Someone discovered your profile and would like to connect. Would you like to start a conversation?
              </p>
              {message.trim() && (
                <p className="mt-2 border-t pt-2 text-[12px] italic leading-[1.55]"
                   style={{
                     color: "var(--nex-neutral-700)",
                     borderColor: "var(--nex-accent-100)"
                   }}>
                  &ldquo;{message.trim()}&rdquo;
                </p>
              )}
            </div>

            {/* Send */}
            <button
              type="button"
              onClick={handleSend}
              disabled={sent}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3 text-[12px] font-black uppercase tracking-[0.16em] transition-transform active:scale-[0.99] disabled:opacity-60"
              style={{
                background: sent
                  ? "linear-gradient(135deg, var(--nex-success-500) 0%, var(--nex-success-700) 100%)"
                  : "linear-gradient(135deg, var(--nex-accent-500) 0%, var(--nex-accent-600) 100%)",
                color: "var(--nex-neutral-0)",
                boxShadow: "var(--nex-shadow-sm)"
              }}
            >
              <Sparkles size={16} strokeWidth={2.25} />
              {sent ? "Sent — waiting on a reply" : "Ask NEX to Introduce"}
            </button>
          </div>
        )}
      </section>
    </>
  );
}
