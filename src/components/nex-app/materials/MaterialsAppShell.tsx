"use client";
// MaterialsAppShell — shared frame for every Materials surface.
// Composes: sticky header, sub-header (back · search · filter),
// content children, sticky bottom nav.
//
// Every page passes only content — the shell owns header + nav so
// nothing drifts as pages are added.

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Bell, Menu, ArrowLeft, Search, SlidersHorizontal,
  LayoutDashboard, FolderKanban, Layers, Boxes, Cog,
  User, type LucideIcon,
} from "lucide-react";
import { MT } from "./_tokens";

type ShellProps = {
  children: ReactNode;
  /** Where the back arrow returns to. Defaults to `/nex-app`. */
  backHref?: string;
  /** Placeholder for the search input. */
  searchPlaceholder?: string;
  /** Optional handler for the search input — omit for read-only chrome. */
  onSearchChange?: (v: string) => void;
  /** Suppress the sub-header entirely (rare — used by the launcher if needed). */
  hideSubHeader?: boolean;
};

export function MaterialsAppShell({
  children,
  backHref = "/nex-app",
  searchPlaceholder = "Search materials...",
  onSearchChange,
  hideSubHeader = false,
}: ShellProps) {
  return (
    <div
      className="relative mx-auto flex min-h-screen w-full flex-col"
      style={{ background: MT.bg, color: MT.darkGrey, maxWidth: 1120, fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}
    >
      <Header />
      {!hideSubHeader && (
        <SubHeader
          backHref={backHref}
          searchPlaceholder={searchPlaceholder}
          onSearchChange={onSearchChange}
        />
      )}
      <main className="flex-1 px-4 pb-28 sm:px-6 lg:px-10">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

// ── Header ───────────────────────────────────────────────────────

function Header() {
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 sm:px-6 lg:px-10"
      style={{ background: MT.bg, borderBottom: `1px solid ${MT.borderLight}` }}
    >
      <div className="flex items-center gap-3">
        <IconBtn label="Menu" onClick={() => {}}>
          <Menu size={22} strokeWidth={2} />
        </IconBtn>
        <BrandLockup />
      </div>
      <div className="flex items-center gap-1.5">
        <IconBtn label="Notifications">
          <div className="relative">
            <Bell size={22} strokeWidth={1.9} />
            <span
              aria-hidden
              className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full px-1 text-[10px] font-bold text-white"
              style={{ background: MT.primary, lineHeight: 1 }}
            >
              3
            </span>
          </div>
        </IconBtn>
        <button
          aria-label="Account"
          className="grid h-9 w-9 place-items-center rounded-full transition-transform active:scale-95"
          style={{ background: "#DADAD4", color: "#6B6E76" }}
        >
          <User size={18} strokeWidth={1.9} />
        </button>
      </div>
    </header>
  );
}

function BrandLockup() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="grid h-9 w-9 place-items-center rounded-lg text-white"
        style={{
          background: `linear-gradient(135deg, ${MT.primary} 0%, ${MT.primaryHover} 100%)`,
          boxShadow: `0 6px 16px -6px ${MT.primary}88`,
          fontWeight: 800,
          fontSize: 16,
          letterSpacing: -0.5,
        }}
      >
        N
      </span>
      <div className="flex flex-col leading-none">
        <span className="text-[15px] font-extrabold tracking-tight" style={{ color: MT.darkGrey }}>NEX</span>
        <span className="mt-0.5 text-[9.5px] font-semibold tracking-[0.14em]" style={{ color: MT.secondaryGrey }}>STAIR PRO</span>
      </div>
    </div>
  );
}

function IconBtn({ label, children, onClick }: { label: string; children: ReactNode; onClick?: () => void }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-lg transition-transform active:scale-95"
      style={{ color: MT.darkGrey }}
    >
      {children}
    </button>
  );
}

// ── Sub-header (Back · Search · Filter) ──────────────────────────

function SubHeader({
  backHref,
  searchPlaceholder,
  onSearchChange,
}: {
  backHref: string;
  searchPlaceholder: string;
  onSearchChange?: (v: string) => void;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-10"
      style={{ background: MT.bg, borderBottom: `1px solid ${MT.borderLight}` }}
    >
      <Link
        href={backHref}
        className="flex items-center gap-1.5 rounded-lg px-1 py-1.5 transition-transform active:scale-95"
        aria-label="Back"
      >
        <ArrowLeft size={18} strokeWidth={2.25} style={{ color: MT.primary }} />
        <span className="text-[14px] font-semibold" style={{ color: MT.primary }}>Back</span>
      </Link>
      <div className="relative flex-1">
        <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: MT.secondaryGrey }}>
          <Search size={16} strokeWidth={2} />
        </span>
        <input
          type="search"
          placeholder={searchPlaceholder}
          aria-label="Search materials"
          onChange={onSearchChange ? (e) => onSearchChange(e.target.value) : undefined}
          className="w-full py-2.5 pl-10 pr-3 text-[13.5px] outline-none transition focus:ring-2"
          style={{
            background: MT.card,
            border: `1px solid ${MT.border}`,
            color: MT.darkGrey,
            borderRadius: MT.radiusMd,
          }}
        />
      </div>
      <button
        aria-label="Filter"
        className="grid h-10 w-10 place-items-center transition-transform active:scale-95"
        style={{
          background: MT.card,
          color: MT.primary,
          border: `1px solid ${MT.border}`,
          borderRadius: MT.radiusMd,
        }}
      >
        <SlidersHorizontal size={18} strokeWidth={2} />
      </button>
    </div>
  );
}

// ── Bottom nav ───────────────────────────────────────────────────

type NavItem = { label: string; icon: LucideIcon; href: string; matcher: (p: string) => boolean };

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/admin/materials",     matcher: (p) => p.startsWith("/admin/materials") },
  { label: "Projects",  icon: FolderKanban,    href: "/nex-app/materials/allocation", matcher: (p) => p === "/nex-app/materials/allocation" },
  { label: "Materials", icon: Layers,          href: "/nex-app/materials",   matcher: (p) => p === "/nex-app/materials" || (p.startsWith("/nex-app/materials/") && !p.endsWith("/allocation") && !p.endsWith("/stock")) },
  { label: "Stock",     icon: Boxes,           href: "/nex-app/materials/stock", matcher: (p) => p.endsWith("/stock") },
  { label: "Settings",  icon: Cog,             href: "#",                    matcher: () => false },
];

function BottomNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav
      className="sticky bottom-0 z-40 flex items-stretch justify-around px-2 pt-2 pb-3"
      style={{
        background: MT.card,
        borderTop: `1px solid ${MT.borderLight}`,
        boxShadow: "0 -10px 24px -14px rgba(15,17,21,0.10)",
      }}
      aria-label="Materials navigation"
    >
      {NAV_ITEMS.map((it) => {
        const active = it.matcher(pathname);
        const color = active ? MT.primary : MT.secondaryGrey;
        return (
          <Link
            key={it.label}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className="relative flex flex-1 flex-col items-center gap-1 py-1.5 transition-transform active:scale-95"
          >
            <span style={{ color }}>
              <it.icon size={22} strokeWidth={active ? 2.1 : 1.85} />
            </span>
            <span className="text-[10.5px] font-semibold leading-none" style={{ color }}>
              {it.label}
            </span>
            {active && (
              <span
                aria-hidden
                className="absolute -bottom-0.5 h-[3px] w-8 rounded-full"
                style={{ background: MT.primary }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
