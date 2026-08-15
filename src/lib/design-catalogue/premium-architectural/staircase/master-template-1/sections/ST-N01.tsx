// NEX Design Catalogue · ST-N01 · Premium Architectural Header (Philip 2026-08-14 · v2).
//
// v2 changes from v1 (Philip 2026-08-14):
//   - Header shows only brand mark + name on the left
//   - Burger icon top-right opens a full-height side drawer from the right
//   - Drawer items: Styles · Materials · Contact · About Us
//   - Drawer closes on: close-button · scrim click · Escape key
//   - Mobile-first: same treatment at every viewport (Philip's ask)
//
// The drawer state lives entirely inside this component so the whole
// header remains a self-contained ST-N01 module — no context providers,
// no external state.

"use client";

import { useEffect, useState, useCallback } from "react";
import { MT1_TOKENS as T } from "../tokens";

type NavItem = { label: string; href: string };

type Config = {
  brandName?: string;
  brandInitial?: string;
  brandStrapline?: string;
  drawerNav?: NavItem[];
};

const DEFAULTS: Required<Config> = {
  brandName: "Summit",
  brandInitial: "S",
  brandStrapline: "Staircase Solutions",
  drawerNav: [
    { label: "Styles",     href: "#styles"    },
    { label: "Materials",  href: "#materials" },
    { label: "Contact",    href: "#contact"   },
    { label: "About Us",   href: "#about"     }
  ]
};

export function STN01(props: Config = {}) {
  const c = { ...DEFAULTS, ...props };
  const [drawerOpen, setDrawerOpen] = useState(false);

  const close = useCallback(() => setDrawerOpen(false), []);

  // Close on Escape · lock scroll while drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerOpen, close]);

  return (
    <header
      data-section-id="ST-N01"
      data-master-template="1"
      data-vertical="staircase"
      data-family="premium-architectural"
      style={{
        background: T.color.surfaceCard,
        color: T.color.ink,
        fontFamily: T.font.sans,
        borderBottom: `1px solid ${T.color.hairline}`,
        position: "relative",
        zIndex: 40
      }}
    >
      <div
        style={{
          maxWidth: 1360,
          margin: "0 auto",
          paddingInline: "clamp(16px, 4vw, 40px)",
          paddingBlock: "16px",
          display: "flex",
          alignItems: "center",
          gap: 16
        }}
      >
        {/* Brand · logo mark + name + strapline */}
        <a
          href="#home"
          aria-label={`${c.brandName} — home`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            textDecoration: "none",
            color: T.color.ink,
            flexShrink: 0
          }}
        >
          <div
            aria-hidden
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: T.color.accent,
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: T.font.serif,
              fontSize: 20,
              fontWeight: 500,
              letterSpacing: "-0.02em"
            }}
          >
            {c.brandInitial}
          </div>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
            <span style={{ fontFamily: T.font.serif, fontSize: 20, fontWeight: 500, letterSpacing: "-0.01em", color: T.color.ink }}>
              {c.brandName}
            </span>
            {c.brandStrapline && (
              <span style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: T.color.inkFaint, marginTop: 5, fontWeight: 600 }}>
                {c.brandStrapline}
              </span>
            )}
          </div>
        </a>

        {/* Burger · top right · opens the drawer */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          aria-controls="mt1-drawer"
          style={{
            marginLeft: "auto",
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: `1px solid ${T.color.hairline}`,
            borderRadius: 10,
            cursor: "pointer",
            color: T.color.ink,
            transition: "background 120ms, border-color 120ms"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.color.accent; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.color.hairline; }}
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
            <path d="M4 7h16" />
            <path d="M4 12h16" />
            <path d="M4 17h16" />
          </svg>
        </button>
      </div>

      {/* Drawer · slides in from RIGHT with a scrim */}
      {/* Scrim */}
      <div
        onClick={close}
        aria-hidden={!drawerOpen}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(58, 52, 40, 0.35)",
          opacity: drawerOpen ? 1 : 0,
          pointerEvents: drawerOpen ? "auto" : "none",
          transition: "opacity 240ms ease-out",
          zIndex: 50
        }}
      />
      {/* Drawer panel */}
      <aside
        id="mt1-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100vh",
          width: "min(360px, 88vw)",
          background: T.color.surfaceCard,
          boxShadow: "-24px 0 60px -20px rgba(58, 52, 40, 0.28)",
          transform: drawerOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 320ms cubic-bezier(0.16, 1, 0.3, 1)",
          zIndex: 55,
          display: "flex",
          flexDirection: "column",
          padding: "20px 22px",
          fontFamily: T.font.sans
        }}
      >
        {/* Drawer header · mirrors main header for continuity */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              aria-hidden
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: T.color.accent,
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: T.font.serif,
                fontSize: 16,
                fontWeight: 500
              }}
            >
              {c.brandInitial}
            </div>
            <span style={{ fontFamily: T.font.serif, fontSize: 17, fontWeight: 500, color: T.color.ink }}>
              {c.brandName}
            </span>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            style={{
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: `1px solid ${T.color.hairline}`,
              borderRadius: 8,
              cursor: "pointer",
              color: T.color.ink
            }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Drawer nav */}
        <nav aria-label="Drawer menu" style={{ display: "flex", flexDirection: "column" }}>
          {c.drawerNav.map((n, i) => (
            <a
              key={n.href}
              href={n.href}
              onClick={close}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "18px 4px",
                textDecoration: "none",
                color: T.color.ink,
                fontFamily: T.font.serif,
                fontSize: 22,
                fontWeight: 400,
                letterSpacing: "-0.01em",
                borderBottom: i === c.drawerNav.length - 1 ? "none" : `1px solid ${T.color.hairline}`
              }}
            >
              <span>{n.label}</span>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={T.color.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m9 18 6-6-6-6" />
              </svg>
            </a>
          ))}
        </nav>

        {/* Drawer footer · strapline for visual anchor */}
        <div style={{ marginTop: "auto", paddingTop: 24, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: T.color.inkFaint, fontWeight: 600 }}>
          {c.brandStrapline}
        </div>
      </aside>
    </header>
  );
}
