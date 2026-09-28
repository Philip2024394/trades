"use client";

// src/app/nex-native/themes/pink-dream/_bottom-tabs.tsx
//
// Bridge 24ab · Bottom tab bar for the Pink Dream preview.
// --------------------------------------------------------
// Replaces the retired right-side floating rail with a standard
// native-messenger bottom bar: Chats · Discover · Cart · Profile.
// Cart carries a pink badge with the count (mocked at 3 in the
// preview · live app reads NEX_CART_STORAGE_KEY).
//
// Sits above the composer in the flex column so it stays glued to
// the bottom edge with safe-area inset support.

import Link from "next/link";
import type * as React from "react";

const PINK = "#FF3F9F";
const SANS =
  "'Manrope', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

interface Tab {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  active?: boolean;
  badge?: number;
}

export function PinkDreamBottomTabs({
  activeKey = "chats",
  cartCount = 3,
}: {
  activeKey?: string;
  cartCount?: number;
}) {
  const tabs: Tab[] = [
    {
      key: "chats",
      label: "Chats",
      href: "/nex-native/chat",
      icon: <ChatsIcon />,
    },
    {
      key: "discover",
      label: "Discover",
      href: "/nex-native/search",
      icon: <DiscoverIcon />,
    },
    {
      key: "cart",
      label: "Cart",
      href: "/nex-native/cart",
      icon: <CartIcon />,
      badge: cartCount,
    },
    {
      key: "profile",
      label: "Profile",
      href: "/nex-native/settings",
      icon: <ProfileIcon />,
    },
  ];

  return (
    <nav
      aria-label="Primary"
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 0,
        padding: `8px 4px calc(env(safe-area-inset-bottom, 0) + 6px)`,
        background: "rgba(12, 7, 18, 0.72)",
        borderTop: "1px solid rgba(255, 139, 197, 0.24)",
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        boxShadow: "0 -6px 24px rgba(0, 0, 0, 0.35)",
        zIndex: 6,
      }}
    >
      {tabs.map((t) => {
        const isActive = t.key === activeKey;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-label={
              t.badge
                ? `${t.label} · ${t.badge} unread`
                : t.label
            }
            aria-current={isActive ? "page" : undefined}
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              padding: "6px 4px",
              color: isActive ? PINK : "rgba(255, 245, 250, 0.72)",
              textDecoration: "none",
              fontFamily: SANS,
              minHeight: 44,
            }}
          >
            <span
              aria-hidden
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 26,
                height: 26,
              }}
            >
              {t.icon}
              {t.badge && t.badge > 0 && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -8,
                    minWidth: 16,
                    height: 16,
                    padding: "0 4px",
                    borderRadius: 999,
                    background:
                      "linear-gradient(180deg, #FF77BC, #FF3F9F)",
                    color: "#0B0F1A",
                    fontSize: 9,
                    fontWeight: 800,
                    lineHeight: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1.5px solid rgba(12, 7, 18, 0.85)",
                    boxShadow: "0 3px 8px rgba(255, 63, 159, 0.55)",
                    fontFamily: SANS,
                  }}
                >
                  {t.badge > 99 ? "99+" : t.badge}
                </span>
              )}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: isActive ? 800 : 600,
                letterSpacing: "0.04em",
              }}
            >
              {t.label}
            </span>
            {isActive && (
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 22,
                  height: 3,
                  borderRadius: 0,
                  background: PINK,
                  boxShadow: `0 0 8px ${PINK}`,
                }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/* Icons · outline strokes */
function ChatsIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H9l-5 4V6z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function DiscoverIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <line
        x1="21"
        y1="21"
        x2="16"
        y2="16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
function CartIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="21" r="1.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="21" r="1.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3 3h2l2.7 12.3a2 2 0 002 1.7h7.6a2 2 0 002-1.6L21 8H6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ProfileIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4 21c1.5-4.5 5-6.5 8-6.5s6.5 2 8 6.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
