// Persistent identity chip — always top-right on every page, like
// Facebook's profile pic, Instagram's account icon, LinkedIn's "Me".
// Click opens a dropdown menu with View Profile · Identity · Settings.

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  User,
  PoundSterling,
  Notebook as NotebookIcon,
  Briefcase,
  MapPin,
  LogOut,
  Receipt,
  Heart,
  Store,
  HelpCircle,
  Info
} from "lucide-react";
import { currentViewerTrade, countVerifiedLayers } from "@/apps/identity/data/tradeIdentities";
import { useCurrentTrade } from "@/lib/useCurrentTrade";
import { useIsTrade } from "@/apps/hub/lib/useIsTrade";

export function GlobalIdentityChip() {
  const fixture = currentViewerTrade();
  const { trade: realTrade } = useCurrentTrade();
  const isTrade = useIsTrade();
  // Overlay the fixture with real data when we have it — keeps
  // headshotInitials + tradeType + slug for surfaces the real profile
  // hasn't populated yet.
  const identity = realTrade
    ? {
        ...fixture,
        displayName: realTrade.displayName,
        tradeType:   realTrade.tradeDiscipline ?? fixture.tradeType,
        homeCity:    realTrade.homePostcode ?? fixture.homeCity,
        headshotInitials: realTrade.displayName
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() ?? "")
          .join("") || fixture.headshotInitials
      }
    : fixture;
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/trade/signout", { method: "POST" });
    } catch {
      /* ignore — cookie cleared client-side by the redirect anyway */
    }
    setOpen(false);
    router.replace("/tc/sign-in");
  }

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const verifiedLayers = countVerifiedLayers(identity);

  return (
    <div ref={rootRef} className="relative">
      {/* Icon-only chip — 32px round avatar, click opens the full
          menu. Instagram/GitHub/Vercel pattern. Frees ~140px of header
          real estate vs the previous "avatar + name + verified" pill.
          Rich identity details live inside the dropdown menu below. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Open account menu for ${identity.displayName}`}
        title={identity.displayName}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border bg-white shadow-sm transition hover:bg-neutral-50"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full text-[10.5px] font-black"
          style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
          aria-hidden
        >
          {identity.headshotInitials}
        </span>
        {/* Small green verified dot for trades — subtle signal without
            eating header width. Full "Verified 8/8" pill stays inside
            the dropdown. */}
        {isTrade && verifiedLayers >= 4 && (
          <span
            aria-hidden
            className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-white"
            style={{ backgroundColor: "#166534" }}
            title={`Verified ${verifiedLayers}/8`}
          >
            <ShieldCheck size={7} strokeWidth={3} className="text-white"/>
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-xl border bg-white shadow-xl"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
          role="menu"
        >
          {/* Header — quick identity glance */}
          <div
            className="flex items-center gap-3 border-b p-3"
            style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#FBF6EC" }}
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-black"
              style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
              aria-hidden
            >
              {identity.headshotInitials}
            </span>
            <div className="min-w-0">
              <div className="text-[12.5px] font-black text-neutral-900">
                {identity.displayName}
              </div>
              {isTrade && (
                <div className="mt-0.5 text-[10px] text-neutral-500">
                  {identity.tradeType}
                </div>
              )}
              {/* Verified 8/8 pill — trade-only VTI signal per the
                  constitutional rule (feedback_trade_features_trade_only). */}
              {isTrade && (
                <div className="mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider" style={{ backgroundColor: "#166534", color: "#FFFFFF" }}>
                  <ShieldCheck size={9} strokeWidth={2.5}/>
                  Verified {verifiedLayers}/8
                </div>
              )}
            </div>
          </div>

          {/* View public trade profile — trade-only, DIY has no public
              profile concept. */}
          {isTrade && (
            <Link
              href={`/tc/trade/${identity.slug}`}
              className="flex items-center gap-2 border-b p-3 text-[12px] font-black text-[#166534] hover:bg-neutral-50"
              style={{ borderColor: "rgba(139,69,19,0.10)" }}
              onClick={() => setOpen(false)}
            >
              <User size={13}/>
              View public profile
            </Link>
          )}

          {/* Menu items — trade-only items filtered for DIY viewers.
              Absorbs the burger's menu (Trade Center home, Orders,
              Saved merchants, Help, About) so nothing was lost when
              the burger was removed. Structured top-down:
                1. Home shortcut
                2. Personal (Notebook/Projects, Orders, Saved)
                3. Trade-only (VTI, Rates, Jobs)
                4. Settings
                5. Help / About
                6. Sign out (in the footer row below) */}
          <ul className="flex flex-col divide-y" style={{ borderColor: "rgba(139,69,19,0.05)" }}>
            {/* Home — role-aware: trades to Hub, DIY to browse. */}
            <MenuItem
              href={isTrade ? "/tc/hub" : "/tc/trade-center"}
              Icon={Store}
              label="Trade Center home"
              onClick={() => setOpen(false)}
            />

            {/* Personal */}
            <li>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  window.dispatchEvent(new CustomEvent("tc:open-notebook"));
                }}
                className="flex min-h-[40px] w-full items-center gap-2 px-3 text-[11.5px] font-bold text-neutral-800 hover:bg-neutral-50"
              >
                <NotebookIcon size={12} className="text-neutral-500"/>
                {isTrade ? "Notebook" : "My projects"}
              </button>
            </li>
            <MenuItem href="/tc/orders" Icon={Receipt} label="Orders" onClick={() => setOpen(false)}/>
            <MenuItem href="/tc/favourites" Icon={Heart} label="Saved merchants" onClick={() => setOpen(false)}/>

            {/* Trade-only surfaces */}
            {isTrade && (
              <>
                <MenuItem href="/tc/identity" Icon={ShieldCheck}   label="Verified Identity" onClick={() => setOpen(false)}/>
                <MenuItem href="/tc/rates"    Icon={PoundSterling} label="Rate card"         onClick={() => setOpen(false)}/>
                <MenuItem href="/tc/jobs"     Icon={Briefcase}     label="Jobs"              onClick={() => setOpen(false)}/>
              </>
            )}

            {/* Settings */}
            <MenuItem href="/tc/settings/location" Icon={MapPin}      label="Home postcode"   onClick={() => setOpen(false)}/>
            <MenuItem href="/tc/settings/recovery" Icon={ShieldCheck} label="Backup channels" onClick={() => setOpen(false)}/>

            {/* Help + About */}
            <MenuItem href="/tc/help"  Icon={HelpCircle} label="Help & guides"     onClick={() => setOpen(false)}/>
            <MenuItem href="/tc/about" Icon={Info}       label="About Trade Center" onClick={() => setOpen(false)}/>
          </ul>

          {/* Sign out row */}
          <div className="border-t p-3" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[11.5px] font-bold text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
            >
              <LogOut size={12}/>
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  href,
  Icon,
  label,
  onClick
}: {
  href: string;
  Icon: typeof ShieldCheck;
  label: string;
  onClick: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        className="flex min-h-[40px] items-center gap-2 px-3 text-[11.5px] font-bold text-neutral-800 hover:bg-neutral-50"
      >
        <Icon size={12} className="text-neutral-500"/>
        {label}
      </Link>
    </li>
  );
}
