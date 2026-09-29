"use client";

// src/app/nex-native/_capabilities-menu.tsx
//
// Wave P2 · NEX-native Capabilities Menu.
// ---------------------------------------
// Reuses the visual language of the /nexapp NexKeypad INSERT tile grid,
// but shows only tiles that have a real destination in the pilot today
// (per the tile authority map at
// docs/nex-p2-tile-authority-map-2026-09-24.md).
//
// Founder rule locked in this wave: no fake buttons. Only GREEN tiles
// ship. RED tiles are honestly absent · not disabled placeholders,
// simply not present until their wave lands them with real destinations.
//
// Rendered as a small "Menu" button in the shell chrome that opens a
// drawer of the current GREEN tiles. Tapping a tile navigates to its
// /nex-native destination via next/navigation.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Megaphone, MessageSquare, Package, Palette, Search, ShoppingBag, Users, X } from "lucide-react";
import { NEX_COMMERCE_ENABLED } from "@/lib/nex-native/launch-flags";

// Inline SVG for the Email tile · avoids lucide-react barrel-import churn
// (see Slice 13a runtime crash · same pattern as LiveIcon).
function EmailIcon({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" ry="2" />
      <polyline points="3,7 12,13 21,7" />
    </svg>
  );
}

// Wave D · Site builder tile · inline SVG
function SiteIcon({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <circle cx="6" cy="6.5" r="0.6" fill={color} />
      <circle cx="8.5" cy="6.5" r="0.6" fill={color} />
      <circle cx="11" cy="6.5" r="0.6" fill={color} />
    </svg>
  );
}

// Inline SVG for the Live tile · deliberately avoids adding a new
// lucide-react named import which triggers a Turbopack barrel-chunk
// registry rebuild that can leave stale browser chunks pointing at
// missing module factories (2026-09-24 · seen on Slice 13a ship).
function LiveIcon({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="2" />
      <path d="M4.93 19.07a10 10 0 0 1 0-14.14" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M7.76 16.24a6 6 0 0 1 0-8.48" />
      <path d="M16.24 7.76a6 6 0 0 1 0 8.48" />
    </svg>
  );
}

interface Tile {
  key: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string;
  href: string;
  hint: string;
  /** Bridge 55 · Phase 1 launch gate · tiles marked commerceOnly
   *  are hidden when NEX_COMMERCE_ENABLED is false. */
  commerceOnly?: boolean;
}

// GREEN tiles only · destinations that are proven end-to-end by Reality
// Checks on /nex-native/*. Adding a tile here requires a real destination
// AND a runtime-tested owner-checked backing service. Sub-capabilities of
// Products/Services (Orders, Analytics, Business profile) get their own
// tiles because they map to distinct routes buyers or sellers actually use.
const GREEN_TILES: Tile[] = [
  {
    key: "chats",
    label: "Chats",
    Icon: MessageSquare,
    color: "#f97316",
    href: "/nex-native/conversations",
    hint: "Your NEX conversations",
  },
  {
    key: "shop",
    label: "Products",
    Icon: ShoppingBag,
    color: "#ec4899",
    href: "/nex-native/manage",
    hint: "Manage your business · products · profile · payment",
    commerceOnly: true,
  },
  {
    key: "my-orders",
    label: "My orders",
    Icon: Package,
    color: "#2563eb",
    href: "/nex-native/orders",
    hint: "Orders you placed as a buyer",
    commerceOnly: true,
  },
  {
    key: "analytics",
    label: "Analytics",
    Icon: BarChart3,
    color: "#059669",
    href: "/nex-native/manage/analytics",
    hint: "Revenue · orders · top products (merchants)",
    commerceOnly: true,
  },
  {
    key: "theme",
    label: "Theme",
    Icon: Palette,
    color: "#a855f7",
    href: "/nex-native/settings/theme",
    hint: "Pick a chat theme · saved to your account",
  },
  {
    key: "discovery",
    label: "Discovery",
    Icon: Search,
    color: "#0891b2",
    href: "/nex-native/search",
    hint: "Search live products + businesses across NEX",
    commerceOnly: true,
  },
  {
    key: "friends",
    label: "Friends",
    Icon: Users,
    color: "#16a34a",
    href: "/nex-native/friends",
    hint: "Add friends by NEX handle · manage invites",
  },
  {
    key: "contacts",
    label: "Contacts",
    Icon: Users,
    color: "#0f766e",
    href: "/nex-native/contacts",
    hint: "Friends + business contacts · theme-share toggle per card",
  },
  {
    key: "banners",
    label: "Banners",
    Icon: Megaphone,
    color: "#f43f5e",
    href: "/nex-native/manage/banners",
    hint: "Create + publish social banners for your business",
    commerceOnly: true,
  },
  {
    key: "live",
    label: "Live",
    Icon: LiveIcon,
    color: "#dc2626",
    href: "/nex-native/live",
    hint: "Phase 1 · business announcements · geo-filter phase 2",
    commerceOnly: true,
  },
  {
    key: "email",
    label: "Email",
    Icon: EmailIcon,
    color: "#7c3aed",
    href: "/nex-native/manage/email",
    hint: "Merchant email lists + subscribers · Wave C phase 1",
    commerceOnly: true,
  },
  {
    key: "site",
    label: "Build",
    Icon: SiteIcon,
    color: "#0891b2",
    href: "/nex-native/manage/site",
    hint: "Prompt-driven 1-page site · chat CTA routes into NEX · Wave D",
    commerceOnly: true,
  },
];

export function NexNativeCapabilitiesMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Open capabilities menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="fixed right-4 top-4 z-40 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-neutral-900/80 text-white shadow-md backdrop-blur hover:bg-neutral-900"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="5" r="2" />
          <circle cx="12" cy="5" r="2" />
          <circle cx="19" cy="5" r="2" />
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
          <circle cx="5" cy="19" r="2" />
          <circle cx="12" cy="19" r="2" />
          <circle cx="19" cy="19" r="2" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Capabilities"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-neutral-950 p-4 pb-8 shadow-xl sm:rounded-2xl sm:pb-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-100">Capabilities</h2>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-full text-neutral-300 hover:bg-neutral-800 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {GREEN_TILES.filter(
                (t) => NEX_COMMERCE_ENABLED || !t.commerceOnly,
              ).map(({ key, label, Icon, color, href, hint }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push(href);
                  }}
                  className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-xl bg-neutral-900 p-3 text-center hover:bg-neutral-800"
                  aria-label={`${label} · ${hint}`}
                  title={hint}
                >
                  <span
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${color}22` }}
                    aria-hidden
                  >
                    <Icon size={20} color={color} />
                  </span>
                  <span className="text-[11px] font-medium text-neutral-100">{label}</span>
                </button>
              ))}
            </div>

            <p className="mt-4 text-[10px] text-neutral-500">
              Only currently-available capabilities are shown · more arrive in later pilot waves.
              Live is in phase 1 (business announcements) · geo-filter is phase 2.
              Email Marketing · Affiliates · Build App/Website are on the roadmap but not shipped yet.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
