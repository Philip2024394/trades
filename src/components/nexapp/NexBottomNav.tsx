// NEX home · bottom navigation + central identity button.
//
// The central button is the visual heartbeat of the app per spec §12.
// Three states drive its animation:
//   · idle      : almost static · tiny ambient glow · waveform resting
//   · thinking  : gentle animated waveform + ring pulse
//   · speaking  : more energetic waveform + ring expand/contract
//
// The transitions between states are eased via CSS animation-name /
// animation-duration swaps · smooth, never abrupt.

"use client";

import { NEX } from "@/lib/nexapp/tokens";
import { NexIdentityButton } from "./NexIdentityButton";
import type { NexState } from "./NexAppHome";

export function NexBottomNav({
  nexState,
  onIdentityTap,
}: {
  nexState: NexState;
  onIdentityTap?: () => void;
}) {
  return (
    <nav style={navWrapStyle}>
      <div style={navPillStyle}>
        <NavItem label="Home" active icon={<HomeIcon />} />
        <NavItem label="Discover" icon={<CompassIcon />} />

        {/* Center identity button · protrudes above the pill. */}
        <div style={{ position: "relative", width: NEX.identitySize + 20 }}>
          <div style={identitySlotStyle}>
            <NexIdentityButton nexState={nexState} onTap={onIdentityTap} />
          </div>
        </div>

        <NavItem label="Chats" icon={<ChatIcon />} />
        <NavItem label="Profile" icon={<ProfileIcon />} />
      </div>
    </nav>
  );
}

function NavItem({ label, active, icon }: { label: string; active?: boolean; icon: React.ReactNode }) {
  const color = active ? NEX.orange : NEX.textMuted;
  return (
    <button
      style={{
        background: "transparent",
        border: "none",
        color,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        cursor: "pointer",
        padding: "4px 6px",
        flex: 1,
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: 0.2,
      }}
      aria-label={label}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color }}>
        {icon}
      </div>
      <span>{label}</span>
    </button>
  );
}

// ─── Nav icons · thin line, matches NEX aesthetic. ────────────

const IP = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function HomeIcon() {
  return (
    <svg {...IP} fill="currentColor" stroke="none">
      <path d="M12 3 4 10v10a1 1 0 0 0 1 1h4v-6h6v6h4a1 1 0 0 0 1-1V10z" />
    </svg>
  );
}
function CompassIcon() {
  return (
    <svg {...IP}>
      <circle cx="12" cy="12" r="9" />
      <polygon points="16.5,7.5 10.5,10.5 7.5,16.5 13.5,13.5" />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg {...IP}>
      <path d="M4 5h16v11H8l-4 4z" />
    </svg>
  );
}
function ProfileIcon() {
  return (
    <svg {...IP}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}

const navWrapStyle: React.CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  padding: "0 14px calc(env(safe-area-inset-bottom, 0px) + 10px)",
  zIndex: 20,
  pointerEvents: "none",  // allow taps to reach only the pill
};

const navPillStyle: React.CSSProperties = {
  pointerEvents: "auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-around",
  gap: 4,
  padding: "10px 14px",
  height: NEX.navHeight - 20,
  background: "rgba(13, 13, 13, 0.85)",
  backdropFilter: "blur(18px) saturate(1.2)",
  WebkitBackdropFilter: "blur(18px) saturate(1.2)",
  border: `1px solid ${NEX.borderMuted}`,
  borderRadius: 999,
  boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02) inset`,
};

const identitySlotStyle: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  // Voice orb embedding · NEX UI refinement 2026-08-23 (Philip screenshot reviews).
  // Iteration 1 (from bottom:2 → -8): sunk 10 px so orb no longer looked like a
  //   large button floating above the pill.
  // Iteration 2 (from -8 → -16): still visually detached · sink 8 px more.
  // Iteration 3 (from -16 → -22): Philip screenshot review after composer change ·
  //   drop 6 px further so the orb reads even more embedded/emerging from the pill.
  bottom: -22,
  transform: "translateX(-50%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 2,
};
