// src/components/nexapp/rooms/NexRoomDrawer.tsx · Philip 2026-08-29
//
// Rail-button drawer. Panel image + button overlay REMOVED per Philip
// 2026-08-29. Awaiting a new theme background image (to be applied when a
// right-rail button is selected). Drawer opens with a minimal scaffold:
// title on top, scrolling section cards in the middle, role status on the
// bottom. When the new theme URL arrives, drop it into `THEME_BG_URL` and
// it will render as the drawer background inside the frozen geometry.
//
// Doctrine anchors:
//   · project_nex_five_button_ia_doctrine_2026_08_29 (CONSTITUTIONAL)
//   · project_nex_persistent_app_shell_doctrine_2026_08_29
//   · project_nex_drawer_scroll_doctrine_2026_08_29
//   · project_nex_drawer_geometry_locked_2026_08_29 (position + size frozen)

"use client";

import React, { useState } from "react";
import { NexSideDrawer } from "@/components/nexapp/NexSideDrawer";
import {
  getRoom,
  visibleSections,
  defaultVisibleSectionId,
  type RoomId,
  type RoomSection,
  type UserRole,
} from "@/lib/nexapp-shell/rooms";

// Themed background per room · Philip 2026-08-29.
// The Discover interface hero is now rendered as a FULL-VIEWPORT stage
// (NexDiscoveryStage inside NexAppShell.overlaySlot) · not inside this
// drawer. The drawer keeps a translucent dark chassis so the stage
// shows through it and the section list reads as an inspection panel
// mounted over the live NEX interface.
const ROOMS_ON_TRANSPARENT_CHASSIS: ReadonlySet<RoomId> = new Set<RoomId>(["discover"]);

export interface NexRoomDrawerProps {
  activeRoom: RoomId | null;
  onClose: () => void;
  activeRoles: ReadonlySet<UserRole>;
  onNavigate?: (workspace: string) => void;
}

export function NexRoomDrawer({ activeRoom, onClose, activeRoles, onNavigate }: NexRoomDrawerProps) {
  const room = activeRoom ? getRoom(activeRoom) : null;
  const [pendingSection, setPendingSection] = useState<RoomSection | null>(null);

  React.useEffect(() => { setPendingSection(null); }, [activeRoom]);

  function handlePick(section: RoomSection) {
    if (section.workspace === "coming-soon") {
      setPendingSection(section);
      return;
    }
    setPendingSection(null);
    onNavigate?.(section.workspace);
    onClose();
  }

  const sections = room ? visibleSections(room, activeRoles) : [];
  const defaultId = room ? defaultVisibleSectionId(room, activeRoles) : null;

  return (
    <NexSideDrawer
      isOpen={activeRoom !== null}
      onClose={onClose}
      title={room?.label ?? ""}
      hideDefaultHeader
      hideDefaultScrollWrapper
      surface="metal"
    >
      {room && (() => {
        const onTransparentChassis =
          activeRoom !== null && ROOMS_ON_TRANSPARENT_CHASSIS.has(activeRoom);
        return (
        <div style={{
          position: "relative",
          width: "100%",
          height: "100%",
          // Discover · translucent chassis so the full-viewport
          // NexDiscoveryStage hero shows through the drawer. Other rooms
          // keep the opaque dark chassis until their own themes land.
          background: onTransparentChassis
            ? "linear-gradient(180deg, rgba(10,14,20,0.55) 0%, rgba(6,10,16,0.75) 100%)"
            : "linear-gradient(180deg, #1c1f24 0%, #14161a 100%)",
          backdropFilter: onTransparentChassis ? "blur(6px) saturate(1.1)" : undefined,
          WebkitBackdropFilter: onTransparentChassis ? "blur(6px) saturate(1.1)" : undefined,
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Scaffold */}
          <div style={{
            position: "relative",
            zIndex: 1,
            flex: 1,
            display: "flex", flexDirection: "column",
            minHeight: 0,
          }}>
          {/* Fixed title */}
          <div style={{
            flexShrink: 0,
            padding: "12px 14px 8px",
            textAlign: "center",
            color: "rgba(245,246,250,0.95)",
          }}>
            <div style={{
              fontSize: 12, fontWeight: 800, letterSpacing: 2,
              textTransform: "uppercase",
            }}>
              {room.label}
            </div>
            {room.intro && (
              <div style={{
                fontSize: 11, fontWeight: 500, marginTop: 3,
                color: "rgba(203,213,225,0.75)", lineHeight: 1.35,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}>
                {room.intro}
              </div>
            )}
          </div>

          {/* Scrolling section list · only scroll region in the drawer */}
          <div
            className="nex-no-scrollbar"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
              padding: "6px 12px",
              display: "flex", flexDirection: "column", gap: 6,
            }}
          >
            {sections.map((s, i) => (
              <SectionCard
                key={s.id}
                section={s}
                isDefault={s.id === defaultId}
                roleTag={
                  arrEq(s.visibility, ["provider"]) ? "P"
                  : arrEq(s.visibility, ["business"]) ? "B"
                  : arrEq(s.visibility, ["creator"])  ? "C"
                  : null
                }
                variant={onTransparentChassis ? "holo-cyan" : "default"}
                staggerIndex={i}
                onTap={() => handlePick(s)}
              />
            ))}

            {pendingSection && (
              <div
                onClick={() => setPendingSection(null)}
                style={{
                  marginTop: 4,
                  padding: "10px 14px",
                  borderRadius: 6,
                  background: "rgba(120,60,20,0.92)",
                  border: "1px solid rgba(255,180,90,0.45)",
                  color: "rgba(254,215,170,0.98)",
                  fontSize: 11, lineHeight: 1.45,
                  cursor: "pointer",
                }}
              >
                <div style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: 1.4,
                  textTransform: "uppercase",
                  color: "rgba(253,186,116,0.98)", marginBottom: 3,
                }}>
                  Coming soon
                </div>
                <div>
                  <b>{pendingSection.label}</b> will open inside NEX when it's built. Tap to dismiss.
                </div>
              </div>
            )}
          </div>

          {/* Fixed role status footer */}
          <div style={{
            flexShrink: 0,
            padding: "6px 14px 12px",
            textAlign: "center",
            fontSize: 10, fontWeight: 600, letterSpacing: 0.5,
            color: "rgba(148,163,184,0.75)",
          }}>
            {activeRoles.size === 0
              ? "no active roles"
              : `roles · ${[...activeRoles].join(" · ")}`}
          </div>
          </div>
        </div>
        );
      })()}
    </NexSideDrawer>
  );
}

type CardVariant = "default" | "holo-cyan";

function SectionCard({
  section, isDefault, roleTag, variant = "default", staggerIndex = 0, onTap,
}: {
  section: RoomSection;
  isDefault: boolean;
  roleTag: "P" | "B" | "C" | null;
  variant?: CardVariant;
  staggerIndex?: number;
  onTap: () => void;
}) {
  const isHolo = variant === "holo-cyan";
  // Stagger the entrance so cards fade + rise sequentially (60ms apart).
  const enterDelayMs = 120 + staggerIndex * 60;

  return (
    <button
      type="button"
      onClick={onTap}
      className={isHolo ? "nex-holo-card" : undefined}
      style={{
        position: "relative",
        overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 10,
        minHeight: 44,
        padding: "10px 14px",
        background: isHolo
          // Philip 2026-08-29 · substantially more opaque so cards read as
          // foreground panels against the bright cyan hero behind. Previously
          // cards blended into the hero and looked "behind the page".
          ? (isDefault
              ? "linear-gradient(180deg, rgba(12,22,36,0.82) 0%, rgba(6,14,24,0.88) 100%)"
              : "linear-gradient(180deg, rgba(10,18,30,0.78) 0%, rgba(4,10,20,0.85) 100%)")
          : (isDefault
              ? "linear-gradient(180deg, rgba(30,32,38,0.95) 0%, rgba(18,20,24,0.95) 100%)"
              : "linear-gradient(180deg, rgba(22,24,28,0.90) 0%, rgba(14,16,20,0.90) 100%)"),
        border: isHolo
          ? (isDefault
              ? "1px solid rgba(254,215,170,0.55)"
              : "1px solid rgba(249,115,22,0.30)")
          : (isDefault
              ? "1px solid rgba(249,115,22,0.55)"
              : "1px solid rgba(255,255,255,0.10)"),
        borderRadius: 8,
        boxShadow: isHolo
          ? (isDefault
              ? "0 0 14px rgba(249,115,22,0.35), inset 0 1px 0 rgba(254,215,170,0.35)"
              : "0 0 10px rgba(249,115,22,0.18), inset 0 1px 0 rgba(254,215,170,0.20)")
          : (isDefault
              ? "0 1px 3px rgba(0,0,0,0.4), 0 0 8px rgba(249,115,22,0.15)"
              : "0 1px 2px rgba(0,0,0,0.4)"),
        color: isHolo ? "rgba(220,240,255,0.98)" : "rgba(240,242,245,0.96)",
        // Frosted glass · shows the interface hero through the drawer chassis.
        backdropFilter: isHolo ? "blur(10px) saturate(1.15)" : undefined,
        WebkitBackdropFilter: isHolo ? "blur(10px) saturate(1.15)" : undefined,
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "inherit",
        // Entrance · fade + lift (both fill-mode so `from` state applies
        // before delay elapses without needing an inline opacity: 0).
        animation: `nex-holo-enter 520ms cubic-bezier(0.25,0,0.2,1) ${enterDelayMs}ms both`,
      }}
    >
      {/* Holographic scan-sweep · bright cyan diagonal band, runs left →
          right periodically. Per-card animation-delay via inline style so
          sweeps don't sync across the list. */}
      {isHolo && (
        <span
          aria-hidden
          className="nex-holo-scan"
          style={{ animationDelay: `${400 + staggerIndex * 220}ms` }}
        />
      )}

      <div style={{ minWidth: 0, flex: 1, position: "relative", zIndex: 1 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
          textShadow: isHolo ? "0 0 8px rgba(249,115,22,0.35)" : undefined,
        }}>
          {section.label}
          {roleTag && (
            <span style={{
              fontSize: 8, fontWeight: 800, letterSpacing: 0.5,
              padding: "1px 5px", borderRadius: 3,
              background: "rgba(255,255,255,0.08)",
              color: roleTag === "P" ? "rgba(147,197,253,0.95)"
                   : roleTag === "B" ? "rgba(216,180,254,0.95)"
                   :                    "rgba(249,168,212,0.95)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}>{roleTag}</span>
          )}
        </div>
        {section.hint && (
          <div style={{
            fontSize: 10,
            color: isHolo ? "rgba(254,215,170,0.75)" : "rgba(148,163,184,0.75)",
            marginTop: 1, lineHeight: 1.35,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{section.hint}</div>
        )}
      </div>
      <span aria-hidden style={{
        position: "relative", zIndex: 1,
        color: isHolo
          ? (isDefault ? "rgba(254,215,170,0.95)" : "rgba(254,215,170,0.70)")
          : (isDefault ? "rgba(249,115,22,0.85)" : "rgba(148,163,184,0.55)"),
        fontSize: 15, flexShrink: 0, lineHeight: 1,
      }}>›</span>

      {/* Global styles · styled-jsx `global` needed because the inline
          animation refs the keyframe name directly and scoped styles
          mangle keyframe/class identifiers. Rendered per card (harmless
          duplication · same rules override themselves). */}
      <style jsx global>{`
        @keyframes nex-holo-enter {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        @keyframes nex-holo-scan {
          0%   { transform: translateX(-120%) skewX(-18deg); opacity: 0; }
          10%  { opacity: 0.65; }
          90%  { opacity: 0.65; }
          100% { transform: translateX(220%)  skewX(-18deg); opacity: 0; }
        }
        .nex-holo-scan {
          position: absolute;
          top: 0; bottom: 0; left: 0;
          width: 45%;
          background: linear-gradient(90deg,
            rgba(254, 215, 170, 0) 0%,
            rgba(254, 215, 170, 0.35) 50%,
            rgba(254, 215, 170, 0) 100%);
          mix-blend-mode: screen;
          animation: nex-holo-scan 3.6s cubic-bezier(0.3, 0, 0.4, 1) infinite;
          pointer-events: none;
          z-index: 0;
        }
        .nex-holo-card:hover .nex-holo-scan {
          animation-duration: 1.6s;
        }
        @media (prefers-reduced-motion: reduce) {
          .nex-holo-scan { animation: none !important; opacity: 0.15 !important; }
          .nex-holo-card { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>
    </button>
  );
}

function arrEq(a: readonly string[] | undefined, b: readonly string[]): boolean {
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
