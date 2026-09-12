// NEX Category Mode · Philip 2026-09-01.
//
// Full-surface CHAT ↔ CATEGORY ↔ CATEGORY_DETAIL mode.
//
// Slot set (Philip 2026-09-01 · "all right side buttons ... listed"):
//   Every right-side rail button appears here — 5 rooms + 4 MORE
//   capabilities in one 3×3 grid. Rooms open their sub-section detail
//   view; capabilities enter their Capability Surface directly (same
//   handlers the rail already uses).
//
// Visual language (Philip 2026-09-01 · "like the page buttons and layout
// ui - STUDIO / Build, publish, manage" + "all cyan"):
//   · CapabilityHeader-style header · uppercase cyan eyebrow + title
//   · 3-column × 3-row grid (matches capability-studio.tsx exactly)
//   · Tile style copied from capability-studio.tsx button verbatim:
//       aspectRatio 1/1 · borderRadius 50% · maxWidth 92 · bg white 3.5%
//       border 1px cyan (0.28α) · icon 22px cyan (0.92α) · label 10px
//       boxShadow 0 4px 14px rgba(0,0,0,0.35)
//   · NO scrim / shade behind — chat surface stays visible underneath
//   · Composer stays fully interactive

"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Compass, MessageSquare, Activity, Wallet as WalletIcon, CircleUser,
  Package, Wrench, Palette, Users,
  Bike, Car, PackageCheck,
} from "lucide-react";
import { ROOMS, type Room, type RoomId, type RoomSection, type UserRole } from "@/lib/nexapp-shell/rooms";
import { CapabilityHeader } from "./CapabilityHeader";
import { TouchButton } from "./primitives/TouchButton";

export type CategoryChatMode = "chat" | "category" | "category-detail";

interface Props {
  mode: CategoryChatMode;
  activeCategoryId: RoomId | null;
  /** Called when a ROOM tile is tapped · parent transitions to
   *  "category-detail" and stores the id · sub-sections show next. */
  onSelectCategory: (id: RoomId) => void;
  /** Called when a MORE CAPABILITY tile is tapped · parent calls
   *  enterCapability(id) directly (no detail step for capabilities). */
  onSelectCapability: (id: string) => void;
  /** Called when a sub-section (in detail mode) is tapped OR when a
   *  direct-nav category tile is tapped (Bike Ride / Car Taxi / Parcel
   *  Delivery etc). `room` is `null` for direct-nav tiles that don't
   *  belong to a room's sub-section list. */
  onSelectSection: (section: RoomSection, room: Room | null) => void;
  /** Back arrow · category-detail → category, or category → chat. */
  onBack: () => void;
  /** Optional role filter for sub-sections in detail view. */
  visibleRoles?: UserRole[];
}

// ─── 9 tiles · every right-rail button ─────────────────────────────
// 5 ROOMS (idle rail · white/gray on live rail) — tap opens sub-section
// detail view via onSelectCategory.
// 4 MORE (kebab panel · cyan-when-active on live rail) — tap enters
// the capability surface directly via onSelectCapability.
type Slot =
  | { kind: "room";       id: RoomId; label: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }> }
  | { kind: "capability"; id: string; label: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }> }
  | { kind: "direct";     id: string; label: string; workspace: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }> };

const SLOTS: readonly Slot[] = [
  // Row 1 · primary rooms
  { kind: "room",       id: "discover", label: "Discover", Icon: Compass       },
  { kind: "room",       id: "messages", label: "Messages", Icon: MessageSquare },
  { kind: "room",       id: "activity", label: "Activity", Icon: Activity      },
  // Row 2 · rooms continued + Studio
  { kind: "room",       id: "wallet",   label: "Wallet",   Icon: WalletIcon    },
  { kind: "room",       id: "me",       label: "Me",       Icon: CircleUser    },
  { kind: "capability", id: "studio",   label: "Studio",   Icon: Package       },
  // Row 3 · MORE capabilities
  { kind: "capability", id: "tools",    label: "Tools",    Icon: Wrench        },
  { kind: "capability", id: "creator",  label: "Creator",  Icon: Palette       },
  { kind: "capability", id: "network",  label: "Network",  Icon: Users         },
  // Row 4 · mobility verticals · direct-nav to the mobility directory
  // (Philip 2026-09-01). All three land on discover-mobility for now;
  // sub-vertical filters will attach in a follow-up.
  { kind: "direct", id: "ride-bike",     label: "Bike Ride",       workspace: "discover-mobility", Icon: Bike         },
  { kind: "direct", id: "ride-car",      label: "Car Taxi",        workspace: "discover-mobility", Icon: Car          },
  { kind: "direct", id: "ride-parcel",   label: "Parcel Delivery", workspace: "discover-mobility", Icon: PackageCheck },
] as const;

// Cyan · matches capability-studio.tsx exactly.
const ICON_COLOR   = "rgba(74,201,255,0.92)";
const BORDER_COLOR = "rgba(74,201,255,0.28)";

export function NexCategoryMode({
  mode,
  activeCategoryId,
  onSelectCategory,
  onSelectCapability,
  onSelectSection,
  onBack,
  visibleRoles,
}: Props) {
  const [mountEl, setMountEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (mode === "chat") return;
    if (typeof document === "undefined") return;
    setMountEl(document.querySelector<HTMLElement>(".nex-console-viewport"));
  }, [mode]);
  useEffect(() => {
    if (mode === "chat") return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onBack(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, onBack]);

  if (mode === "chat") return null;
  if (!mountEl) return null;

  const activeRoom: Room | null =
    activeCategoryId ? (ROOMS.find((r) => r.id === activeCategoryId) ?? null) : null;

  const detailSections: RoomSection[] = activeRoom
    ? activeRoom.sections.filter((s) => {
        if (!s.visibility || s.visibility.length === 0) return true;
        if (!visibleRoles || visibleRoles.length === 0) return false;
        return s.visibility.some((role) => visibleRoles.includes(role));
      })
    : [];

  return createPortal(
    <div
      role="dialog"
      aria-label={mode === "category" ? "NEX worlds" : `${activeRoom?.label ?? "Category"} options`}
      style={{
        position: "absolute",
        top:    "7.27%",
        left:   "8.32%",
        right:  "8.09%",
        bottom: "10.90%",
        zIndex: 15,
        pointerEvents: "none",
        color: "rgba(245,245,245,0.95)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {mode === "category" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            pointerEvents: "auto",
            animation: "nex-cat-fade-in 260ms cubic-bezier(0.2, 0.7, 0.2, 1) forwards",
          }}
        >
          <CapabilityHeader eyebrow="NEX" title="Discover, connect, explore" />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 16,
              padding: "0 20px 20px",
              justifyItems: "center",
              alignContent: "start",
            }}
          >
            {SLOTS.map((slot) => {
              const Icon = slot.Icon;
              return (
                <TouchButton
                  key={slot.id}
                  aria-label={slot.label}
                  onTap={() => {
                    if (slot.kind === "room") onSelectCategory(slot.id);
                    else if (slot.kind === "capability") onSelectCapability(slot.id);
                    else onSelectSection(
                      // Direct-nav tile (Bike Ride / Car Taxi / Parcel Delivery)
                      // · synthetic RoomSection so the shell's existing
                      // onSelectSection handler navigates via coerceWorkspace.
                      { id: slot.id, label: slot.label, workspace: slot.workspace },
                      null,
                    );
                  }}
                  style={{
                    appearance: "none",
                    width: "100%",
                    maxWidth: 92,
                    aspectRatio: "1 / 1",
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.035)",
                    border: `1px solid ${BORDER_COLOR}`,
                    color: "rgba(245,245,245,0.9)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: 6,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                  }}
                >
                  <Icon size={22} strokeWidth={1.8} color={ICON_COLOR} />
                  <span
                    style={{
                      fontSize: 10,
                      letterSpacing: 0.3,
                      textAlign: "center",
                      lineHeight: 1.15,
                      padding: "0 2px",
                    }}
                  >
                    {slot.label}
                  </span>
                </TouchButton>
              );
            })}
          </div>
        </div>
      )}

      {mode === "category-detail" && activeRoom && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            pointerEvents: "auto",
            animation: "nex-cat-fade-in 240ms cubic-bezier(0.2, 0.7, 0.2, 1) forwards",
          }}
        >
          <CapabilityHeader backLabel="NEX" onBack={onBack} title={activeRoom.label} />

          <div
            className="nex-no-scrollbar"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 16,
              padding: "0 20px 20px",
              justifyItems: "center",
              alignContent: "start",
              overflowY: "auto",
              flex: 1,
              minHeight: 0,
            }}
          >
            {detailSections.length === 0 && (
              <div style={{ gridColumn: "1 / -1", marginTop: 24, textAlign: "center", fontSize: 12, color: "rgba(245,245,245,0.55)" }}>
                No sections available for your current roles.
              </div>
            )}
            {detailSections.map((section) => {
              const comingSoon = section.workspace === "coming-soon";
              return (
                <TouchButton
                  key={section.id}
                  aria-label={section.label}
                  onTap={() => onSelectSection(section, activeRoom)}
                  disabled={comingSoon}
                  title={comingSoon ? `${section.label} · coming soon` : section.label}
                  style={{
                    appearance: "none",
                    width: "100%",
                    maxWidth: 92,
                    aspectRatio: "1 / 1",
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.035)",
                    border: `1px solid ${comingSoon ? "rgba(255,255,255,0.14)" : BORDER_COLOR}`,
                    color: comingSoon ? "rgba(245,245,245,0.5)" : "rgba(245,245,245,0.9)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: 6,
                    fontFamily: "inherit",
                    cursor: comingSoon ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 10.5,
                      letterSpacing: 0.3,
                      textAlign: "center",
                      lineHeight: 1.15,
                      padding: "0 2px",
                      color: comingSoon ? "rgba(245,245,245,0.5)" : ICON_COLOR,
                      fontWeight: 500,
                    }}
                  >
                    {section.label}
                  </span>
                </TouchButton>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        @keyframes nex-cat-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
    </div>,
    mountEl,
  );
}
