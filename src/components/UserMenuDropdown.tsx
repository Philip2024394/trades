"use client";

// UserMenuDropdown — Facebook-style avatar + chevron in the header.
// Click → dropdown with the user's primary home link + secondary
// links + log out. Anonymous state shows Sign in / Sign up.
//
// Positioned relative to the parent (drop it into a header's flex
// row). The dropdown itself is `absolute right-0` so it hangs off
// the avatar; parent should be `relative` OR the dropdown falls
// back to viewport-anchored `fixed` via a mount check.
//
// Server-rendered identity is passed as the `ctx` prop from a server
// component (via resolveUserMenuContext) so no client fetch flash.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut } from "lucide-react";
import type { UserMenuContext } from "@/lib/userMenuContext";

const BRAND_YELLOW = "#FFB300";

export function UserMenuDropdown({ ctx }: { ctx: UserMenuContext }) {
  const [open, setOpen] = useState(false);
  const rootRef         = useRef<HTMLDivElement>(null);

  // Close on outside click + Esc
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown",   onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown",   onKey);
    };
  }, [open]);

  // Anonymous variant — Sign in / Sign up pills, no dropdown state
  if (ctx.kind === "anon") {
    return (
      <div className="flex items-center gap-1.5">
        <Link
          href="/sign-in"
          className="inline-flex h-8 items-center rounded-full border border-neutral-300 bg-white px-3 text-[11px] font-black uppercase tracking-wider text-neutral-800 hover:bg-neutral-50"
        >
          Sign in
        </Link>
        <Link
          href="/trade-off/signup"
          className="inline-flex h-8 items-center rounded-full px-3 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-sm"
          style={{ backgroundColor: BRAND_YELLOW }}
        >
          Sign up
        </Link>
      </div>
    );
  }

  // Signed-in — avatar + chevron button, dropdown on click
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white p-1 pr-2 shadow-sm transition hover:bg-neutral-50"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar ctx={ctx}/>
        <ChevronDown
          size={12}
          strokeWidth={2.5}
          className={"text-neutral-500 transition " + (open ? "rotate-180" : "")}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border-2 bg-white shadow-2xl"
          style={{ borderColor: "rgba(0,0,0,0.08)" }}
        >
          {/* Identity strip */}
          <div className="flex items-center gap-2.5 border-b p-3" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
            <Avatar ctx={ctx} size="lg"/>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-black text-neutral-900">{ctx.displayName}</p>
              <p className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
                {ctx.kind === "homeowner" ? "Project Owner" : "Trade / Supplier"}
              </p>
            </div>
          </div>

          {/* Primary home link */}
          <Link
            href={ctx.homeHref}
            onClick={() => setOpen(false)}
            className="flex items-center justify-between border-b px-3 py-2.5 text-[12px] font-black transition hover:brightness-95"
            style={{ backgroundColor: BRAND_YELLOW, borderColor: "rgba(0,0,0,0.06)", color: "#0A0A0A" }}
          >
            <span>{ctx.homeLabel}</span>
            <span className="text-[10.5px] font-black uppercase tracking-wider">
              Home →
            </span>
          </Link>

          {/* Secondary links */}
          <ul className="divide-y" style={{ borderColor: "rgba(0,0,0,0.05)" }}>
            {ctx.links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex items-baseline justify-between px-3 py-2.5 text-[12.5px] transition hover:bg-neutral-50"
                >
                  <span className="font-black text-neutral-900">{l.label}</span>
                  {l.hint && (
                    <span className="ml-2 truncate text-[10.5px] text-neutral-500">{l.hint}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          {/* Log out */}
          <form action={ctx.logoutAction} method="POST" className="border-t" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
            <button
              type="submit"
              className="flex w-full items-center justify-between px-3 py-2.5 text-[12.5px] font-black text-neutral-800 transition hover:bg-neutral-50"
            >
              <span className="inline-flex items-center gap-2">
                <LogOut size={13} strokeWidth={2.5}/>
                Log out
              </span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function Avatar({ ctx, size = "sm" }: { ctx: Extract<UserMenuContext, { kind: "homeowner" | "merchant" }>; size?: "sm" | "lg" }) {
  const dim = size === "lg" ? "h-9 w-9 text-[14px]" : "h-7 w-7 text-[12px]";
  // 2px brand-yellow ring + subtle yellow drop shadow — makes the
  // profile chip pop against both cream and dark headers.
  const ringStyle: React.CSSProperties = {
    boxShadow: `0 0 0 2px ${BRAND_YELLOW}, 0 1px 3px rgba(255,179,0,0.35)`
  };
  if (ctx.avatarUrl) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={ctx.avatarUrl}
        alt={ctx.displayName}
        className={"rounded-full object-cover " + dim}
        style={ringStyle}
      />
    );
  }
  return (
    <span
      className={"inline-flex items-center justify-center rounded-full font-black text-neutral-900 " + dim}
      style={{ backgroundColor: BRAND_YELLOW, ...ringStyle }}
    >
      {ctx.initial}
    </span>
  );
}
