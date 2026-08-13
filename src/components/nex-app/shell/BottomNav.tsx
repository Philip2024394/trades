"use client";

// BottomNav — permanent 5-item OS-destinations nav per Design Language
// v1.1 §6.7 + Master Trade Template v1.1 §1.3.
//
// Slots: Home · Projects · [+ FAB] · Messages · Profile.
// Center slot is an elevated orange FAB that opens a fresh chat thread.
// Never website pages — always operating-system areas.

import { Home, FolderOpen, Wrench, User, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useConversationState } from "../state/ConversationStateProvider";

type NavItem = { id: string; label: string; icon: typeof Home; active: boolean; onClick: () => void };

export function BottomNav() {
  const { state, transitionTo } = useConversationState();
  const router = useRouter();

  const items: NavItem[] = [
    {
      id:      "home",
      label:   "Home",
      icon:    Home,
      active:  state === "discover",
      onClick: () => transitionTo("discover")
    },
    {
      id:      "projects",
      label:   "Projects",
      icon:    FolderOpen,
      active:  state === "project",
      onClick: () => transitionTo("project")
    },
    {
      id:      "tools",
      label:   "Tools",
      icon:    Wrench,
      active:  state === "configure",
      onClick: () => transitionTo("configure")
    },
    {
      id:      "profile",
      label:   "Profile",
      icon:    User,
      active:  false,
      onClick: () => transitionTo("discover")   // profile spec deferred; falls back to home for now
    }
  ];

  return (
    <nav
      className="sticky bottom-0 z-40 flex items-end justify-around px-4 pt-3 pb-6"
      style={{
        background: "var(--nex-neutral-0)",
        borderRadius: "24px 24px 0 0",
        boxShadow: "var(--nex-shadow-md)"
      }}
      aria-label="Primary"
    >
      {items.slice(0, 2).map((item) => <BottomNavItem key={item.id} item={item} />)}

      {/* Center + FAB · Philip 2026-08-03 · routes to the CLEAN general
          Nex Chat surface (/nex-app/chat) · NOT the trade-flavoured
          slide-up ChatSurface. Consistent with the "Nex Chat" tile
          on the landing so the two entry points open the same clean
          assistant. */}
      <button
        type="button"
        onClick={() => router.push("/nex-app/chat")}
        aria-label="Start a new conversation with Nex"
        className="grid h-14 w-14 place-items-center rounded-full transition-transform active:scale-95"
        style={{
          background: "var(--nex-accent-500)",
          color: "var(--nex-neutral-0)",
          boxShadow: "var(--nex-shadow-lg)",
          transform: "translateY(-14px)"
        }}
      >
        <Plus size={26} strokeWidth={2.25} />
      </button>

      {items.slice(2).map((item) => <BottomNavItem key={item.id} item={item} />)}
    </nav>
  );
}

function BottomNavItem({ item }: { item: NavItem }) {
  const { icon: Icon, label, active, onClick } = item;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 py-1 transition-colors"
      aria-label={label}
      aria-current={active ? "page" : undefined}
    >
      <Icon
        size={22}
        strokeWidth={1.75}
        style={{ color: active ? "var(--nex-accent-500)" : "var(--nex-neutral-500)" }}
      />
      <span
        className="text-[11px] font-medium"
        style={{ color: active ? "var(--nex-accent-500)" : "var(--nex-neutral-500)" }}
      >
        {label}
      </span>
      {active && (
        <span
          aria-hidden
          className="h-1 w-1 rounded-full"
          style={{ background: "var(--nex-accent-500)" }}
        />
      )}
    </button>
  );
}
