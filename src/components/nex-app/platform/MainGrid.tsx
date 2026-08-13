"use client";

// MainGrid — primary modules dashboard on the platform landing.
// Original 5-column cream-elev container with row dividers, kept as
// canonical layout. This pass renames all tiles to the "NEX <Name>"
// system, refreshes each glyph for better semantic fit, and swaps
// the icon chip to a two-tone gray+orange treatment (gray tile
// container, warm orange icon).

import { useRouter } from "next/navigation";
import {
  Sparkles, Compass, Store, ShoppingBag, FileText, CalendarDays,
  BedDouble, MonitorSmartphone, Wrench, FolderClosed,
  MessagesSquare, Users, PenLine, ImageIcon, Languages,
  Hammer, Home, TrendingUp, Palette, Layers, Calculator, SquareStack,
  GalleryHorizontalEnd,
  type LucideIcon
} from "lucide-react";

type Tile = {
  label:    string;
  subtitle: string;
  icon:     LucideIcon;
  route:    string;
};

// 19 modules, laid out 5 per row (last row has 4).
const TILES: Tile[] = [
  { label: "NEX AI",           subtitle: "Your AI assistant",     icon: Sparkles,          route: "/nex-app/brains/staircase" },
  { label: "NEX Discover",     subtitle: "Meet people nearby",    icon: Compass,           route: "/nex-app/discover" },
  { label: "NEX Business",     subtitle: "Find businesses",       icon: Store,             route: "/nex-app/centre" },
  { label: "NEX Marketplace",  subtitle: "Buy & sell",            icon: ShoppingBag,       route: "/nex-app/marketplace" },
  { label: "NEX Quotes",       subtitle: "Quotes & invoices",     icon: FileText,          route: "/nex-app/quotes" },

  { label: "NEX Bookings",     subtitle: "Jobs & appointments",   icon: CalendarDays,      route: "/nex-app/bookings" },
  { label: "NEX Accommodation",subtitle: "Hotels, villas, stays", icon: BedDouble,         route: "/nex-app/accommodation" },
  { label: "NEX Websites",     subtitle: "Build your website",    icon: MonitorSmartphone, route: "/nex-app/studios/website" },
  { label: "NEX Tools",        subtitle: "Smart calculators",     icon: Wrench,            route: "/nex-app/tools" },
  { label: "NEX Documents",    subtitle: "Files & documents",     icon: FolderClosed,      route: "/nex-app/documents" },

  { label: "NEX Messages",     subtitle: "Chats & conversations", icon: MessagesSquare,    route: "/nex-app/messages" },
  { label: "NEX Contacts",     subtitle: "People & groups",       icon: Users,             route: "/nex-app/contacts" },
  { label: "NEX Writer",       subtitle: "AI writing assistant",  icon: PenLine,           route: "/nex-app/tools/writer" },
  { label: "NEX Images",       subtitle: "Edit & create images",  icon: ImageIcon,         route: "/nex-app/tools/image" },
  { label: "NEX Translator",   subtitle: "Translate instantly",   icon: Languages,         route: "/nex-app/tools/translate" },

  { label: "NEX Construction", subtitle: "Build & renovate",      icon: Hammer,            route: "/nex-app/categories/construction" },
  { label: "NEX Home",         subtitle: "Home improvement",      icon: Home,              route: "/nex-app/categories/home" },
  { label: "NEX Growth",       subtitle: "Business & marketing",  icon: TrendingUp,        route: "/nex-app/categories/growth" },
  { label: "NEX Design",       subtitle: "Creative studio",       icon: Palette,           route: "/nex-app/categories/design" },
  { label: "NEX Materials",    subtitle: "Timber, boards & stock",icon: Layers,            route: "/nex-app/materials" },
  { label: "NEX Hardwood Calc",subtitle: "Volume, board feet",    icon: Calculator,        route: "/nex-app/hardwood-calculator" },
  { label: "NEX Staircase Calc", subtitle: "What do I need?",     icon: SquareStack,       route: "/nex-app/staircase-calculator" },
  { label: "NEX Staircase Renovations", subtitle: "See what yours could become", icon: GalleryHorizontalEnd, route: "/nex-app/staircase-renovations" }
];

export function MainGrid() {
  const router = useRouter();
  const cols = 5;
  const rows: Tile[][] = [];
  for (let i = 0; i < TILES.length; i += cols) rows.push(TILES.slice(i, i + cols));

  return (
    <section className="mx-5">
      <div
        className="rounded-2xl px-3 pt-3 pb-3"
        style={{
          background: "var(--nex-cream-elev)",
          boxShadow: "var(--nex-shadow-sm)",
          border: "1px solid var(--nex-neutral-200)"
        }}
      >
        {rows.map((rowTiles, rowIdx) => (
          <div key={rowIdx}>
            <div
              className="grid gap-x-1 py-1"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {rowTiles.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => router.push(t.route)}
                  className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl px-1 py-2 text-center transition-transform active:scale-95"
                  aria-label={t.label}
                >
                  {/* Two-tone chip: gray container + orange glyph */}
                  <span
                    className="grid h-9 w-9 place-items-center rounded-lg"
                    style={{
                      background: "linear-gradient(135deg, var(--nex-neutral-100) 0%, var(--nex-neutral-50) 100%)",
                      border: "1px solid var(--nex-neutral-200)",
                      color: "var(--nex-accent-500)",
                      boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset"
                    }}
                  >
                    <t.icon size={19} strokeWidth={1.85} />
                  </span>
                  <span
                    className="block w-full truncate text-[10.5px] font-semibold leading-tight"
                    style={{ color: "var(--nex-neutral-900)" }}
                  >
                    {t.label}
                  </span>
                  <span
                    className="block w-full truncate text-[9px] leading-tight"
                    style={{ color: "var(--nex-neutral-500)" }}
                  >
                    {t.subtitle}
                  </span>
                </button>
              ))}
            </div>
            {rowIdx < rows.length - 1 && (
              <div className="my-1 flex justify-center" aria-hidden>
                <div className="h-px w-[70%]" style={{ background: "var(--nex-neutral-200)" }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
