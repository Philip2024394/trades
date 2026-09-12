"use client";

// NexSectionsNav — persistent top-right button + side drawer for navigating
// between the Nex app's top-level sections (Home · Discover · Messages ·
// Contacts · Centre · Staircase Configurator · Design System).
//
// Fixed position so it appears on every /nex-app/* page. Uses the same
// slide-over pattern + shadcn tokens as the staircase drawer / design sheet.
// Highlights the current section based on the pathname so users always know
// where they are.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  Home,
  Search,
  MessageSquare,
  MessageCircle,
  Users,
  Store,
  Ruler,
  Palette,
  Share2,
  Factory,
} from "lucide-react";

type Section = {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const SECTIONS: Section[] = [
  { href: "/nex-app",                        label: "Home",                 description: "Nex Platform overview",              icon: Home },
  // Stage 3.41.c · NEX Talk · the friend-voice conversational surface
  // where World cards · action proposals · verified/unknown outcomes all
  // render inline in one stream. This is the primary conversational
  // entry point going forward · legacy /nex-appchat remains untouched.
  { href: "/nex-appchat",                   label: "NEX Talk",             description: "Talk to NEX like a friend",          icon: MessageCircle },
  { href: "/nex-app/discover",               label: "Discover",             description: "Meet new people nearby",             icon: Search },
  // Messages entry removed 2026-09-06 · /nex-app/messages deleted.
  { href: "/nex-app/contacts",               label: "Contacts",             description: "Your saved connections + groups",    icon: Users },
  { href: "/nex-app/centre",                 label: "Trade Centre",         description: "Marketplace: products · services",   icon: Store },
  { href: "/nex-market",                     label: "NEX Market · Yogyakarta", description: "Marketplace · buy from local sellers", icon: Store },
  { href: "/nex-head-quarters/comms-social", label: "Nex Marketing",        description: "Get your business seen",             icon: Share2 },
  // Phase 12.4 · Dedicated Knowledge Factory page. Physical hierarchy
  // (Inbox → Workers → Warehouse → Vault) driven by real state
  // transitions from workers-live / warehouse / timeline. Operations
  // Centre remains reachable directly for the older admin surfaces.
  { href: "/nex-head-quarters/factory",           label: "Knowledge Factory", description: "Inbox · Workers · Warehouse · Vault", icon: Factory },
  { href: "/nex-app/staircase-configurator", label: "Staircase Configurator", description: "3D configurator + Nex Designs",    icon: Ruler },
  { href: "/nex-app/design-system",          label: "Design System",        description: "Design tokens · components",         icon: Palette },
];

export function NexSectionsNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close automatically on navigation so the drawer doesn't stay open after
  // the user picks a section.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Philip 2026-08-02 · hide the sections drawer on the Staircase Library
  // page. The library is an immersive full-screen viewer with its own
  // top-left Home button; the drawer would compete visually with the
  // Home + floating Nex affordances. Early return AFTER all hooks to
  // preserve the Rules-of-Hooks order.
  if (pathname?.startsWith("/nex-app/staircase-library")) return null;
  // Philip 2026-08-03 · hide on the general chat too. The chat page has
  // its own black burger in the header (opens Play) — the shell-level
  // yellow floating button competed visually and duplicated the intent.
  // Founder BEGIN 2026-09-09 · /nex-app/chat + /nex-app/talk merged into
  // canonical /nex-appchat. One check covers both (redirects also in place).
  if (pathname?.startsWith("/nex-appchat")) return null;
  // Philip 2026-09-07 · Glass Gate · authentication-entry surface. The
  // drawer must not render for pre-auth visitors · showing a "sections"
  // menu before sign-in would leak navigation shape and break the
  // "world behind the glass" identity.
  if (pathname?.startsWith("/nex-app/enter")) return null;
  // Philip 2026-09-07 · Frameless Recovery Slice 1. The new /nex-app
  // home owns its own lower-right 3-dot HomeKebabButton (the frameless
  // replacement for the phone-frame's rightKebab affordance) · the
  // section drawer's top-right yellow menu would visually compete with
  // it and duplicate navigation intent. Check the pathname EQUALITY
  // rather than startsWith so /nex-app/discover, /nex-app/contacts,
  // /nex-app/enter, etc. keep their existing behaviour (they either
  // handle their own suppression above or continue to show the drawer).
  if (pathname === "/nex-app") return null;

  return (
    <>
      {/* Fixed top-right trigger button — visible on every /nex-app/* page.
          High z-index so it floats over page content but stays below the
          drawer overlay itself. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open sections menu"
        className="fixed top-3 right-3 sm:top-4 sm:right-4 z-30 w-11 h-11 grid place-items-center rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 transition-opacity"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Backdrop */}
      <div
        aria-hidden={!open}
        onClick={() => setOpen(false)}
        className={[
          "fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm",
          "transition-opacity duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="nex-sections-title"
        className={[
          "fixed inset-y-0 right-0 z-50 flex flex-col",
          "w-[92vw] max-w-[380px] bg-card text-foreground border-l border-border shadow-2xl",
          "transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="text-eyebrow uppercase text-muted-foreground">Nex</p>
            <h2 id="nex-sections-title" className="text-heading-md font-heading">
              Sections
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close sections menu"
            className="w-9 h-9 grid place-items-center rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <nav className="flex-1 overflow-y-auto">
          <ul>
            {SECTIONS.map((s) => {
              const active =
                pathname === s.href ||
                (s.href !== "/nex-app" && pathname?.startsWith(s.href));
              const Icon = s.icon;
              return (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    className={[
                      "flex items-start gap-3 px-5 py-4 border-b border-border transition-colors",
                      active
                        ? "bg-accent/15 text-foreground"
                        : "hover:bg-muted/50 text-foreground",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "w-10 h-10 grid place-items-center rounded-full shrink-0",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      ].join(" ")}
                    >
                      <Icon className="w-5 h-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-body-md font-medium flex items-center gap-2">
                        {s.label}
                        {active && (
                          <span className="text-caption uppercase tracking-wider text-primary">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-caption text-muted-foreground mt-0.5">
                        {s.description}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <footer className="px-5 py-4 border-t border-border">
          <p className="text-caption text-muted-foreground">
            Same drawer on every Nex page. Tap the menu icon top-right to reopen anywhere.
          </p>
        </footer>
      </aside>
    </>
  );
}
