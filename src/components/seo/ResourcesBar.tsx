// ResourcesBar — cross-links every Phase 2 SEO pillar as compact
// chips. Dropped into every hub page so any visitor to any pillar
// discovers the other six. Concentrates internal link equity across
// the whole data-authority ecosystem.
//
// The `active` prop suppresses the chip for the page you're currently
// on (no self-linking).

import Link from "next/link";
import {
  TrendingUp, ShieldCheck, HelpCircle, Sparkles, GraduationCap,
  BookOpen, BookMarked, MapPin, Compass, ArrowUpRight, type LucideIcon
} from "lucide-react";

type PillarKey =
  | "price-index"
  | "grants"
  | "answers"
  | "check-quote"
  | "careers"
  | "vault"
  | "what-is"
  | "regions"
  | "toolbox";

type Pillar = {
  key:    PillarKey;
  href:   string;
  label:  string;
  Icon:   LucideIcon;
};

const PILLARS: Pillar[] = [
  { key: "toolbox",     href: "/toolbox",     label: "The Toolbox",          Icon: Compass },
  { key: "price-index", href: "/price-index", label: "UK Trade Price Index", Icon: TrendingUp },
  { key: "grants",      href: "/grants",      label: "Grants Tracker",       Icon: ShieldCheck },
  { key: "answers",     href: "/answers",     label: "Q&A Hub",              Icon: HelpCircle },
  { key: "check-quote", href: "/check-quote", label: "Quote Checker",        Icon: Sparkles },
  { key: "careers",     href: "/careers",     label: "Career Guides",        Icon: GraduationCap },
  { key: "vault",       href: "/vault",       label: "The Vault",            Icon: BookOpen },
  { key: "what-is",     href: "/what-is",     label: "Trade Encyclopaedia",  Icon: BookMarked },
  { key: "regions",     href: "/regions",     label: "UK Regions",           Icon: MapPin }
];

type Props = {
  /** The current pillar — its chip is rendered as a static "you are here" label. */
  active: PillarKey;
  className?: string;
};

export function ResourcesBar({ active, className }: Props) {
  return (
    <section
      aria-label="More resources on The Networkers"
      className={`rounded-2xl border-2 bg-white p-4 shadow-sm md:p-5 ${className ?? ""}`}
      style={{ borderColor: "rgba(139,69,19,0.10)" }}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
        More from The Toolbox
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {PILLARS.map((p) => {
          const isActive = p.key === active;
          if (isActive) {
            return (
              <li key={p.key}>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10.5px] font-black uppercase tracking-wider text-white"
                  style={{ backgroundColor: "#0A0A0A" }}
                  aria-current="page"
                >
                  <p.Icon size={11} strokeWidth={2.6}/>
                  {p.label} · you're here
                </span>
              </li>
            );
          }
          return (
            <li key={p.key}>
              <Link
                href={p.href}
                className="inline-flex items-center gap-1 rounded-full border-2 bg-white px-3 py-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-800 hover:-translate-y-0.5 transition"
                style={{ borderColor: "rgba(139,69,19,0.20)" }}
              >
                <p.Icon size={11} strokeWidth={2.6}/>
                {p.label}
                <ArrowUpRight size={10} strokeWidth={2.6}/>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
