// trust_bar.icon_row_1 — Phase 2 retrofit on shadcn foundation.
//
// Thin trust bar between hero and services. Icon + short label per item,
// horizontal-scroll on mobile if items overflow, centered grid on
// tablet+. Uses Lucide icon set + Framer Motion Reveal for staggered
// entrance. Typography from the platform scale.

"use client";

import {
  ShieldCheck,
  BadgeCheck,
  Star,
  MapPin,
  Award,
  Wrench,
  Zap,
  Clock,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type { SectionRendererProps } from "@/lib/studio/sectionTypes";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";
import { mandatorySchemesForTrade } from "@/lib/knowledge";

type Config = {
  eyebrow: string;
  item1Icon: string;
  item1Label: string;
  item2Icon: string;
  item2Label: string;
  item3Icon: string;
  item3Label: string;
  item4Icon: string;
  item4Label: string;
  /** When true, pulls trust items from the Knowledge Graph — the
   *  package's compliance elements filtered by credentialScheme
   *  (Gas Safe / NICEIC / TrustMark / etc.). */
  useKnowledgeGraph: boolean;
  surface: "light" | "dark" | "tinted";
};

/** Credential scheme slug → display label (short, uppercase-friendly). */
const SCHEME_LABEL: Record<string, string> = {
  "gas-safe": "Gas Safe",
  niceic: "NICEIC",
  napit: "NAPIT",
  trustmark: "TrustMark",
  fmb: "FMB",
  mcs: "MCS",
  hetas: "HETAS",
  fensa: "FENSA",
  chas: "CHAS",
  ipaf: "IPAF",
  pasma: "PASMA",
  "waste-carrier": "Waste Carrier",
  "companies-house": "Companies House",
  cscs: "CSCS",
  smas: "SMAS",
  constructionline: "Constructionline",
  safecontractor: "SafeContractor"
};

/** Which Lucide icon key to pair with each scheme. */
const SCHEME_ICON: Record<string, string> = {
  "gas-safe": "shield",
  niceic: "badge",
  napit: "badge",
  trustmark: "shield",
  fmb: "award",
  mcs: "bolt",
  hetas: "shield",
  fensa: "shield",
  chas: "badge",
  ipaf: "wrench",
  pasma: "wrench",
  "waste-carrier": "clock",
  "companies-house": "badge",
  cscs: "users",
  smas: "shield",
  constructionline: "badge",
  safecontractor: "shield"
};

const ICONS: Record<string, LucideIcon> = {
  shield: ShieldCheck,
  badge: BadgeCheck,
  star: Star,
  pin: MapPin,
  award: Award,
  wrench: Wrench,
  bolt: Zap,
  clock: Clock,
  users: Users
};

const ICON_KEYS = Object.keys(ICONS);

export function IconRowSection({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const surface = config.surface ?? "tinted";
  const isDark = surface === "dark";
  const isTinted = surface === "tinted";

  const eyebrow =
    typeof config.eyebrow === "string" ? config.eyebrow : "";
  const useKnowledgeGraph = config.useKnowledgeGraph === true;

  // Resolution order:
  //   1. merchant-authored slots (item1..item4Label)
  //   2. Knowledge Graph → mandatorySchemesForTrade(primaryTrade)
  //   3. nothing → don't render
  let items: Array<{ icon: string; label: string }> = [];

  if (!useKnowledgeGraph) {
    items = [
      { icon: config.item1Icon, label: config.item1Label },
      { icon: config.item2Icon, label: config.item2Label },
      { icon: config.item3Icon, label: config.item3Label },
      { icon: config.item4Icon, label: config.item4Label }
    ]
      .map((i) => ({
        icon: typeof i.icon === "string" ? i.icon : "shield",
        label: typeof i.label === "string" ? i.label : ""
      }))
      .filter((i) => i.label.length > 0);
  }

  if (items.length === 0 && data.primaryTrade) {
    const schemes = mandatorySchemesForTrade(data.primaryTrade);
    if (schemes.length > 0) {
      items = schemes.slice(0, 4).map((s) => ({
        icon: SCHEME_ICON[s.scheme] ?? "shield",
        label: SCHEME_LABEL[s.scheme] ?? s.label
      }));
    }
  }

  if (items.length === 0) return null;

  return (
    <section
      className={cn(
        "relative w-full overflow-x-clip border-y border-border",
        isDark && "bg-foreground text-background",
        !isDark && !isTinted && "bg-background text-foreground",
        isTinted && "text-foreground"
      )}
      style={
        isTinted ? { background: `${accent}08` } : undefined
      }
      {...sectionRootAttrs(
        instanceId,
        "trust_bar.icon_row_1",
        "Trust bar · icon row"
      )}
    >
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {eyebrow && (
          <Reveal>
            <p
              className="mb-3 text-center text-eyebrow font-extrabold uppercase text-muted-foreground"
              {...treeAttrs(instanceId, "eyebrow", "Eyebrow", "text")}
            >
              {eyebrow}
            </p>
          </Reveal>
        )}
        <Reveal delay={0.05}>
          {/* Horizontal-scroll on mobile if 4 items don't fit without
              cramping; centered grid from tablet+. */}
          <ul
            className="-mx-4 flex justify-start gap-3 overflow-x-auto px-4 sm:mx-0 sm:justify-center sm:gap-6 sm:px-0"
            style={{ scrollbarWidth: "none" }}
          >
            {items.map((item, i) => {
              const Icon = ICONS[item.icon] ?? ShieldCheck;
              return (
                <li
                  key={i}
                  className="flex shrink-0 flex-col items-center gap-1.5 sm:flex-1 sm:gap-2"
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full border sm:h-11 sm:w-11"
                    style={{
                      borderColor: `${accent}55`,
                      background: `${accent}12`
                    }}
                  >
                    <Icon
                      size={18}
                      strokeWidth={2.25}
                      style={{ color: accent }}
                      aria-hidden="true"
                    />
                  </div>
                  <span
                    className="w-[72px] text-center text-caption font-extrabold uppercase leading-tight text-foreground sm:w-auto sm:max-w-[110px]"
                    {...treeAttrs(
                      instanceId,
                      `item${i + 1}Label`,
                      `Item ${i + 1} label`,
                      "text"
                    )}
                  >
                    {item.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

