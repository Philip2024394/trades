"use client";

// src/app/nex-native/themes/theme-1/_composer.tsx
//
// Bridge 27 · Theme 1 composer · exact structural clone of Pink
// Dream's composer (+ button · emoji · naked input · send) with
// blue circles instead of pink. Same nav grammar, different colour
// world per the doctrine.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const BLUE = "#009FEF";
const BLUE_SOFT = "rgba(0, 159, 239, 0.55)";
const ORANGE = "#FF7800";
const SOFT_WHITE = "#FFF5FA";
const SANS =
  "'Inter', 'Manrope', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const EMOJI_SET: string[] = [
  "😀","😁","😂","🤣","😊","🥰","😍","🤩",
  "😘","😗","☺️","🙂","🤗","😌","😉","😎",
  "🥳","😇","🤔","🫶","🙌","👏","🤝","🙏",
  "💙","💜","🖤","🩵","✨","⭐","🌟","💫",
  "🌙","☀️","🌈","🔥","🎉","🎊","🎁","📷",
];

export function Theme1Composer() {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setEmojiOpen(false);
      setPlusOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function insertEmoji(emoji: string) {
    const el = inputRef.current;
    if (!el) {
      setText((p) => p + emoji);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + emoji + el.value.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  return (
    <>
      <footer
        style={{
          position: "relative",
          padding: "12px 12px calc(env(safe-area-inset-bottom, 0) + 12px)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          boxSizing: "border-box",
          zIndex: 6,
        }}
      >
        <button
          type="button"
          aria-label="Open shop and marketing panel"
          aria-expanded={plusOpen}
          onClick={() => setPlusOpen(true)}
          style={{ ...circleButton("linear-gradient(135deg, #7EB6FF, #009FEF)"), width: 30, height: 30, boxShadow: "0 3px 10px rgba(0,159,239,0.30)" }}
        >
          <PlusIcon />
        </button>

        <div
          style={{
            flex: "1 1 0%",
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 4,
            paddingRight: 4,
          }}
        >
          <button
            type="button"
            aria-label="Insert emoji"
            aria-expanded={emojiOpen}
            onClick={() => setEmojiOpen(true)}
            style={{
              width: 34, height: 34, padding: 0, borderRadius: "50%",
              background: "transparent", border: "none",
              color: "#B4DBFF", cursor: "pointer", flex: "0 0 auto",
              display: "grid", placeItems: "center",
            }}
          >
            <SmileIcon />
          </button>
          <input
            ref={inputRef}
            type="text"
            placeholder="Message…"
            aria-label="Message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{
              flex: "1 1 0%",
              minWidth: 0,
              width: "100%",
              padding: "10px 6px",
              background: "transparent",
              border: "none",
              borderBottom: `1px solid ${BLUE_SOFT}`,
              color: SOFT_WHITE,
              fontSize: 16,
              fontFamily: SANS,
              outline: "none",
            }}
          />
        </div>

        {/* Send · orange gradient (Theme 1 composer accent) so the
           send action visually belongs to YOU · Maria's own composer
           in her chat would render this in her blue rail colour. */}
        <button
          type="button"
          aria-label="Send"
          style={{
            ...circleButton("linear-gradient(135deg, #FFB877, #FF7800)"),
            width: 42, height: 42,
            border: "1px solid rgba(255,205,150,0.85)",
            color: "#0B0F1A",
            boxShadow: "0 0 16px rgba(255,120,0,0.45)",
          }}
        >
          <SendIcon />
        </button>
      </footer>

      {emojiOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setEmojiOpen(false)}
          style={backdropStyle}
        >
          <div onClick={(e) => e.stopPropagation()} style={cardStyle()}>
            <PanelHeader title="Pick an emoji" onClose={() => setEmojiOpen(false)} />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(8, 1fr)",
                gap: 6,
                maxHeight: 260,
                overflowY: "auto",
                padding: 4,
              }}
            >
              {EMOJI_SET.map((emoji, i) => (
                <button
                  key={`${emoji}-${i}`}
                  type="button"
                  onClick={() => {
                    insertEmoji(emoji);
                    setEmojiOpen(false);
                  }}
                  style={{
                    width: "100%", aspectRatio: "1 / 1",
                    border: "none", background: "transparent",
                    color: SOFT_WHITE, fontSize: 22,
                    cursor: "pointer", padding: 0, borderRadius: 8,
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {plusOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPlusOpen(false)}
          style={backdropStyle}
        >
          <div onClick={(e) => e.stopPropagation()} style={cardStyle()}>
            <PanelHeader title="Shop & marketing" onClose={() => setPlusOpen(false)} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <PlusTile href="/nex-native/manage/shop" icon={<BagIcon />} label="My shop" onClose={() => setPlusOpen(false)} />
              <PlusTile href="/nex-native/manage/products" icon={<TagIcon />} label="Share product" onClose={() => setPlusOpen(false)} />
              <PlusTile href="/nex-native/manage/menu" icon={<MenuIcon />} label="Menu" onClose={() => setPlusOpen(false)} />
              <PlusTile href="/nex-native/manage/banners" icon={<MegaphoneIcon />} label="Marketing" onClose={() => setPlusOpen(false)} />
              <PlusTile href="/nex-native/live" icon={<LiveIcon />} label="Live post" onClose={() => setPlusOpen(false)} />
              <PlusTile href="/nex-native/manage/email" icon={<EmailIcon />} label="Email blast" onClose={() => setPlusOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PlusTile({
  href, icon, label, onClose,
}: { href: string; icon: React.ReactNode; label: string; onClose: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClose}
      style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 8, padding: "14px 8px", borderRadius: 16,
        background: "rgba(5,11,24,0.72)",
        border: `1px solid ${BLUE_SOFT}`,
        color: SOFT_WHITE, textDecoration: "none", textAlign: "center",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 42, height: 42, borderRadius: "50%",
          background: "linear-gradient(135deg, rgba(126,182,255,0.28), rgba(0,159,239,0.22))",
          display: "grid", placeItems: "center", color: SOFT_WHITE,
        }}
      >{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
    </Link>
  );
}

const backdropStyle: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 25,
  display: "grid", placeItems: "center",
  background: "rgba(5,11,24,0.55)",
  backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
  fontFamily: SANS,
};

function cardStyle(): React.CSSProperties {
  return {
    position: "relative", width: "min(360px, calc(100vw - 32px))",
    padding: "16px 16px 14px", borderRadius: 22,
    background: "linear-gradient(160deg, rgba(15,32,58,0.94), rgba(5,11,24,0.96))",
    border: `1px solid ${BLUE_SOFT}`, color: SOFT_WHITE,
    boxShadow: "0 30px 80px rgba(0,0,0,0.55), 0 0 30px rgba(0,159,239,0.18)",
  };
}
function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: BLUE, fontWeight: 700 }}>{title}</div>
      <button type="button" aria-label="Close" onClick={onClose}
        style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(0,0,0,0.42)", border: "1px solid rgba(255,255,255,0.10)", color: "#B4DBFF", display: "grid", placeItems: "center", cursor: "pointer", padding: 0 }}>
        <CloseIcon />
      </button>
    </div>
  );
}
function circleButton(background: string): React.CSSProperties {
  return {
    flex: "0 0 auto", width: 42, height: 42, borderRadius: "50%",
    background, border: `1px solid ${BLUE_SOFT}`,
    boxShadow: "0 6px 16px rgba(0,159,239,0.35)", color: SOFT_WHITE,
    display: "grid", placeItems: "center", cursor: "pointer", padding: 0,
  };
}

/* Icons · reused from Pink Dream composer · unchanged glyphs */
function PlusIcon() { return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>); }
function SmileIcon() { return (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" /><path d="M8.5 14c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="9" cy="10" r="1" fill="currentColor" /><circle cx="15" cy="10" r="1" fill="currentColor" /></svg>); }
function SendIcon() { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4 12l16-8-6 16-2.5-6.5L4 12z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>); }
function CloseIcon() { return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>); }
function BagIcon() { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M6 8h12v11a1 1 0 01-1 1H7a1 1 0 01-1-1V8zM9 8V6a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>); }
function TagIcon() { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4 12V4h8l8 8-8 8-8-8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><circle cx="8" cy="8" r="1.4" fill="currentColor" /></svg>); }
function MenuIcon() { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 5h14M5 12h14M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>); }
function MegaphoneIcon() { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M3 10v4a1 1 0 001 1h4l8 5V4L8 9H4a1 1 0 00-1 1z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>); }
function LiveIcon() { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" /><path d="M4.93 19.07a10 10 0 010-14.14M19.07 4.93a10 10 0 010 14.14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>); }
function EmailIcon() { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" /><path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>); }
