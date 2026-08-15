// NEX Business Context · BRANDED CUSTOMER SHELL (Philip 2026-08-14).
//
// The customer sees the BUSINESS BRAND. NEX is subtly attributed at the
// bottom · "Powered by NEX™". No side drawer. No admin navigation.
//
// Reusable · driven entirely by CustomerBusinessIdentity.

"use client";

import { useState, useRef, useEffect } from "react";
import type { CustomerBusinessIdentity } from "@/lib/nex/business-context/types";

type Msg = { author: "customer" | "business"; text: string; at?: string };

// Phase 18 · PWA install prompt event (Chromium-only · iOS uses different flow)
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function BrandedCustomerShell({
  business,
  initialConversationId,
  initialMessages
}: {
  business: CustomerBusinessIdentity;
  initialConversationId?: string;
  initialMessages?: Msg[];
}) {
  const [messages, setMessages] = useState<Msg[]>(
    initialMessages ?? [
      { author: "business", text: `Hi — this is ${business.displayName}. How can we help?` }
    ]
  );
  const [convId, setConvId] = useState<string | undefined>(initialConversationId);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Phase 18 · install prompt state · appears AFTER the first substantive
  // business response (never on page load · never advert-style).
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installPromptDismissed, setInstallPromptDismissed] = useState(false);
  const [showInstallCta, setShowInstallCta] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Register service worker + capture beforeinstallprompt event
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Detect iOS / standalone install so we can adapt the UX
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
    setIsStandalone(window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(`/api/b/${business.slug}/sw.js`, { scope: `/b/${business.slug}/` })
        .catch(() => { /* Fail silently · SW registration failures never break the chat */ });
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [business.slug]);

  async function requestInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    if (choice.outcome === "dismissed") setInstallPromptDismissed(true);
    setShowInstallCta(false);
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    setMessages((m) => [...m, { author: "customer", text }]);

    try {
      const res = await fetch(`/api/b/${business.slug}/customer/message`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, conversationId: convId })
      }).then((r) => r.json());
      if (res.ok) {
        setConvId(res.conversationId);
        if (res.reply) {
          setMessages((m) => [...m, { author: "business", text: res.reply.text, at: res.reply.at }]);
          // Phase 18 · install-prompt trigger · after the first SUBSTANTIVE
          // business reply. "Substantive" = came from the server, not the
          // greeting bubble injected on mount. We check by counting server-
          // returned business messages so far · this is #1.
          if (!isStandalone && !installPromptDismissed) {
            setShowInstallCta(true);
          }
        }
      } else {
        setMessages((m) => [...m, { author: "business", text: "Sorry — I couldn't send that just now." }]);
      }
    } catch {
      setMessages((m) => [...m, { author: "business", text: "Sorry — I couldn't send that just now." }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: business.brand.background,
      color: business.brand.foreground,
      fontFamily: business.brand.bodyFamily,
      display: "flex",
      flexDirection: "column"
    }}>
      {/* Branded header — this is the BUSINESS's identity, not NEX's */}
      <header style={{ borderBottom: `1px solid ${adjustAlpha(business.brand.foreground, 0.08)}`, padding: "18px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: business.brand.primary,
            color: business.brand.onPrimary,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: business.brand.headingFamily, fontWeight: 700, fontSize: 20
          }}>
            {business.displayName.charAt(0)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: business.brand.headingFamily, fontSize: 20, fontWeight: 600, lineHeight: 1 }}>
              {business.displayName}
            </div>
            {business.tagline && (
              <div style={{ fontSize: 13, opacity: 0.7, marginTop: 3 }}>{business.tagline}</div>
            )}
          </div>
        </div>
      </header>

      {/* Chat surface */}
      <div style={{ flex: 1, maxWidth: 900, width: "100%", margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div ref={scrollRef} style={{
          flex: 1,
          minHeight: "50vh",
          background: "#fff",
          border: `1px solid ${adjustAlpha(business.brand.foreground, 0.08)}`,
          borderRadius: 12,
          padding: 16,
          overflowY: "auto"
        }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              display: "flex",
              justifyContent: m.author === "customer" ? "flex-end" : "flex-start",
              marginBottom: 10
            }}>
              <div style={{
                background: m.author === "customer" ? business.brand.primary : "#f3f2ef",
                color: m.author === "customer" ? business.brand.onPrimary : business.brand.foreground,
                padding: "10px 14px",
                borderRadius: 12,
                maxWidth: "78%",
                fontSize: 15,
                lineHeight: 1.4,
                whiteSpace: "pre-wrap"
              }}>
                {m.text}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder={`Message ${business.displayName}...`}
            disabled={sending}
            style={{ flex: 1, padding: "12px 14px", fontSize: 15, border: `1px solid ${adjustAlpha(business.brand.foreground, 0.15)}`, borderRadius: 10, outline: "none" }}
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            style={{ padding: "12px 20px", fontSize: 15, fontWeight: 600, background: business.brand.primary, color: business.brand.onPrimary, border: "none", borderRadius: 10, cursor: "pointer" }}
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
      </div>

      {/* Phase 18 · natural install CTA · appears AFTER first substantive
          business response, never on load · dismissable · never advert-style */}
      {showInstallCta && !isStandalone && (
        <div data-testid="nex-install-cta"
          style={{
            position: "sticky", bottom: 0,
            maxWidth: 900, width: "100%", margin: "0 auto",
            background: business.brand.primary,
            color: business.brand.onPrimary,
            padding: "12px 16px",
            borderRadius: 12,
            display: "flex", alignItems: "center", gap: 12,
            fontSize: 14,
            boxShadow: "0 4px 14px rgba(0,0,0,0.08)"
          }}>
          <div style={{ flex: 1, lineHeight: 1.35 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Add {business.displayName} to your home screen</div>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
              {isIOS
                ? `Tap Share, then "Add to Home Screen" to chat with ${business.displayName} anytime.`
                : `Chat with ${business.displayName} anytime, like an app.`}
            </div>
          </div>
          {installEvent && !isIOS && (
            <button data-testid="nex-install-add" onClick={requestInstall}
              style={{ padding: "8px 14px", background: "#fff", color: business.brand.primary, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Add
            </button>
          )}
          <button data-testid="nex-install-dismiss"
            onClick={() => { setShowInstallCta(false); setInstallPromptDismissed(true); }}
            style={{ padding: "8px 10px", background: "transparent", color: business.brand.onPrimary, border: "1px solid rgba(255,255,255,0.4)", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
            Not now
          </button>
        </div>
      )}

      {/* Subtle NEX attribution — the ONLY NEX branding shown to the customer */}
      <footer style={{ padding: "16px 24px", textAlign: "center", fontSize: 12, opacity: 0.5 }}>
        Powered by NEX™
      </footer>
    </div>
  );
}

function adjustAlpha(hex: string, alpha: number): string {
  // Very simple hex → rgba (ignore short-form + defaults)
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(0,0,0,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
