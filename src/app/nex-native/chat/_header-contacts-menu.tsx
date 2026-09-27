"use client";

// src/app/nex-native/chat/_header-contacts-menu.tsx
//
// 3-dot vertical button on the top-right of the chat header · tap
// opens a right-anchored drawer listing the user's chat contacts
// (accepted friends). The current chat is highlighted with a "HERE"
// chip so users can navigate between peer chats without leaving the
// chat surface.
//
// Sealed 2026-09-27. Contact list is server-loaded by the peer chat
// page and passed as `contacts` prop.

import * as React from "react";
import Link from "next/link";

const NEX = {
  panel: "#03101D",
  cyan: "#009FEF",
  cyanSoft: "rgba(0,159,239,0.5)",
  cyanFaint: "rgba(0,159,239,0.14)",
  cyanBorder: "rgba(0,159,239,0.35)",
  orange: "#FF7800",
  green: "#16D66B",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyanDeep: "#063B67",
};

export interface HeaderContact {
  id: string;
  name: string;
  profession: string | null;
  avatarUrl: string | null;
  href: string;
  isCurrent: boolean;
}

export function HeaderContactsMenu({
  contacts,
}: {
  contacts: HeaderContact[];
}) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <style>{`
        @keyframes nex-contacts-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes nex-contacts-slide {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
      <div
        style={{
          position: "absolute",
          right: 12,
          top: "calc(env(safe-area-inset-top, 0) + 12px)",
          display: "flex",
          alignItems: "center",
          gap: 4,
          zIndex: 5,
        }}
      >
        <Link
          href="/nex-native/chat"
          aria-label="Back to chats list"
          title="All chats"
          style={{
            width: 40,
            height: 40,
            background: "transparent",
            border: "none",
            color: NEX.text,
            padding: 0,
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            textDecoration: "none",
          }}
        >
          <HomeIcon />
        </Link>
        <button
          type="button"
          aria-label="Show chat contacts"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          style={{
            width: 40,
            height: 40,
            background: "transparent",
            border: "none",
            color: NEX.text,
            padding: 0,
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
          }}
        >
          <DotsIcon />
        </button>
      </div>

      {open && (
        <>
          <div
            role="button"
            aria-label="Close contacts"
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(2,9,20,0.65)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              zIndex: 200,
              animation: "nex-contacts-fade 220ms ease-out both",
            }}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Chat contacts"
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(320px, 88vw)",
              background: NEX.panel,
              borderLeft: `1px solid ${NEX.cyanSoft}`,
              zIndex: 201,
              padding:
                "calc(env(safe-area-inset-top, 0) + 20px) 14px calc(env(safe-area-inset-bottom, 0) + 20px)",
              overflowY: "auto",
              animation:
                "nex-contacts-slide 260ms cubic-bezier(.2,.7,.2,1) both",
              display: "flex",
              flexDirection: "column",
              boxShadow: "-24px 0 60px rgba(0,0,0,0.55)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 18,
                padding: "0 4px",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: NEX.cyan,
                  fontWeight: 600,
                }}
              >
                NEX · Your chats
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.42)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: NEX.text,
                  cursor: "pointer",
                  padding: 0,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <CloseIcon />
              </button>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                flex: 1,
              }}
            >
              {contacts.length === 0 ? (
                <div
                  style={{
                    padding: "24px 12px",
                    textAlign: "center",
                    color: NEX.textDim,
                    fontSize: 13,
                    lineHeight: 1.55,
                  }}
                >
                  No chats yet. Add a friend to start.
                </div>
              ) : (
                contacts.map((c) => (
                  <Link
                    key={c.id}
                    href={c.href}
                    onClick={() => setOpen(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      borderRadius: 12,
                      background: c.isCurrent
                        ? NEX.cyanFaint
                        : "transparent",
                      border: c.isCurrent
                        ? `1px solid ${NEX.cyanSoft}`
                        : "1px solid transparent",
                      color: NEX.text,
                      textDecoration: "none",
                      transition: "background 160ms ease",
                    }}
                  >
                    <div
                      aria-hidden
                      style={{
                        flexShrink: 0,
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: NEX.cyanDeep,
                        border: c.isCurrent
                          ? `2px solid ${NEX.cyan}`
                          : "1px solid rgba(255,255,255,0.08)",
                        overflow: "hidden",
                      }}
                    >
                      {c.avatarUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={c.avatarUrl}
                          alt=""
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "grid",
                            placeItems: "center",
                            color: NEX.cyan,
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        >
                          {initials(c.name)}
                        </div>
                      )}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {c.name}
                      </div>
                      {c.profession && (
                        <div
                          style={{
                            marginTop: 1,
                            fontSize: 11,
                            color: NEX.textDim,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {c.profession}
                        </div>
                      )}
                    </div>
                    {c.isCurrent && (
                      <span
                        aria-label="Currently in this chat"
                        style={{
                          flexShrink: 0,
                          fontSize: 9,
                          letterSpacing: "0.14em",
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 999,
                          background: "rgba(0,159,239,0.24)",
                          color: NEX.cyan,
                        }}
                      >
                        HERE
                      </span>
                    )}
                  </Link>
                ))
              )}
            </div>

            <Link
              href="/nex-native/chat"
              onClick={() => setOpen(false)}
              style={{
                marginTop: 16,
                padding: "12px",
                borderRadius: 12,
                background: "rgba(0,159,239,0.10)",
                border: `1px solid ${NEX.cyanBorder}`,
                color: NEX.cyan,
                textDecoration: "none",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textAlign: "center",
                textTransform: "uppercase",
              }}
            >
              All chats →
            </Link>
          </aside>
        </>
      )}
    </>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

function DotsIcon() {
  return (
    <svg width={26} height={26} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 12l9-9 9 9" />
      <path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
