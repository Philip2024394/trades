"use client";

// PlatformBottomNav — global bottom nav on platform surfaces per
// spec. Slots: Home · Chats · [NEX centre button] · Tools · Profile.
// Centre button is the AI entry (NEX orange) — replaces the generic
// "+" pattern on the Brain surface bottom nav.
//
// Palette: black footer body with warm neutral glyphs, orange stays
// as the active + centre accent so the bar reads as premium against
// the cream platform above.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, MessageCircle, Wrench, User, Sparkles } from "lucide-react";

const FOOTER_BG      = "#0A0A0F";
const FOOTER_BORDER  = "rgba(255,255,255,0.06)";
const GLYPH_IDLE     = "#8E8E9E";
const GLYPH_ACTIVE   = "var(--nex-accent-500)";

export function PlatformBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const isHome     = pathname === "/nex-app";
  const isChats    = pathname?.startsWith("/nex-app/messages");
  const isTools    = pathname?.startsWith("/nex-app/tools");
  const isProfile  = pathname?.startsWith("/nex-app/profile");

  return (
    <nav
      className="sticky bottom-0 z-40 flex items-end justify-around px-4 pt-2 pb-3"
      style={{
        background: FOOTER_BG,
        borderRadius: "24px 24px 0 0",
        borderTop: `1px solid ${FOOTER_BORDER}`,
        boxShadow: "0 -8px 24px -12px rgba(0,0,0,0.35)"
      }}
      aria-label="Primary"
    >
      <NavItem icon={Home}          label="Home"    active={!!isHome}    href="/nex-app" />
      <NavItem icon={MessageCircle} label="Chats"   active={!!isChats}   href="/nex-app/messages" notificationDot />

      {/* Centre NEX button — orange, elevated, opens the AI chat entry */}
      <button
        type="button"
        onClick={() => router.push("/nex-app/brains/staircase")}
        aria-label="Open NEX AI"
        className="flex flex-col items-center gap-0.5 transition-transform active:scale-95"
        style={{ transform: "translateY(-6px)" }}
      >
        <span
          className="grid h-11 w-11 place-items-center rounded-full"
          style={{
            background: "linear-gradient(135deg, var(--nex-accent-500) 0%, var(--nex-accent-600) 100%)",
            color: "var(--nex-neutral-0)",
            boxShadow: "0 8px 20px -6px rgba(245,158,11,0.55), 0 2px 6px rgba(0,0,0,0.35)"
          }}
        >
          <Sparkles size={20} strokeWidth={2.25} />
        </span>
        <span className="text-[10px] font-black" style={{ color: "var(--nex-accent-500)" }}>
          NEX
        </span>
      </button>

      <NavItem icon={Wrench} label="Tools"   active={!!isTools}   href="/nex-app/tools" />
      <NavItem icon={User}   label="Profile" active={!!isProfile} href="/nex-app/profile" />
    </nav>
  );
}

function NavItem({
  icon: Icon, label, active, href, notificationDot = false
}: {
  icon: typeof Home;
  label: string;
  active: boolean;
  href: string;
  notificationDot?: boolean;
}) {
  const color = active ? GLYPH_ACTIVE : GLYPH_IDLE;
  return (
    <Link
      href={href}
      className="relative flex flex-col items-center gap-1 py-1 transition-colors"
      aria-label={label}
      aria-current={active ? "page" : undefined}
    >
      <div className="relative">
        <Icon size={22} strokeWidth={1.75} style={{ color }} />
        {notificationDot && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full"
            style={{ background: "var(--nex-accent-500)", border: `1.5px solid ${FOOTER_BG}` }}
          />
        )}
      </div>
      <span className="text-[11px] font-medium" style={{ color }}>
        {label}
      </span>
      {active && (
        <span
          aria-hidden
          className="h-1 w-1 rounded-full"
          style={{ background: "var(--nex-accent-500)" }}
        />
      )}
    </Link>
  );
}
