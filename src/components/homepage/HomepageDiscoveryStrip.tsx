// HomepageDiscoveryStrip — sits below the existing AudienceGateBright
// on the site homepage. Surfaces the Phase 2/3 SEO ecosystem so
// direct + returning visitors find the resource pillars without
// having to type each URL. Does not compete with the hero — quiet
// visual weight, off-white section, understated typography.

import Link from "next/link";
import {
  ArrowUpRight, Compass, TrendingUp, ShieldCheck, HelpCircle,
  Sparkles, GraduationCap, BookOpen, BookMarked, MapPin, AlertTriangle,
  Scale, Camera, Video
} from "lucide-react";

type Pillar = {
  href:        string;
  label:       string;
  description: string;
  Icon:        typeof TrendingUp;
};

const PILLARS: Pillar[] = [
  { href: "/toolbox",       label: "The Toolbox",           description: "Every tool + guide at hand's reach",             Icon: Compass },
  { href: "/price-index",   label: "UK Trade Price Index",  description: "Day rates + regional pricing · monthly",         Icon: TrendingUp },
  { href: "/grants",        label: "Grants Tracker",        description: "8 live UK schemes · boiler, insulation",         Icon: ShieldCheck },
  { href: "/check-quote",   label: "Quote Checker",         description: "Fair / high / low verdict — instant",            Icon: Sparkles },
  { href: "/answers",       label: "Q&A Hub",               description: "30 straight answers to UK trade questions",      Icon: HelpCircle },
  { href: "/vault",         label: "The Vault",             description: "16 long-form UK trade guides",                   Icon: BookOpen },
  { href: "/what-is",       label: "Trade Encyclopaedia",   description: "What each UK trade actually does",               Icon: BookMarked },
  { href: "/careers",       label: "Career Guides",         description: "Become a UK plumber, electrician, more",         Icon: GraduationCap },
  { href: "/regions",       label: "UK Regions",            description: "11 UK regions · pricing + grants",               Icon: MapPin },
  { href: "/vs",            label: "Compare platforms",     description: "The Networkers vs Checkatrade, MyBuilder, more", Icon: Scale },
  { href: "/case-studies",  label: "Case Studies",          description: "Real UK trade projects · submit yours",          Icon: Camera },
  { href: "/emergency",     label: "Trade Emergency",       description: "Gas leak, burst pipe, power failure",            Icon: AlertTriangle },
  { href: "/videos",        label: "Networkers TV",         description: "Built by the trade, trusted by homeowners",      Icon: Video }
];

export function HomepageDiscoveryStrip() {
  return (
    <section
      aria-label="The Networkers resources — tools, guides, and directory"
      className="border-t bg-[#FBF6EC] py-12 md:py-16"
      style={{ borderColor: "rgba(139,69,19,0.10)" }}
    >
      <div className="mx-auto max-w-[1400px] px-4 md:px-6">
        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
            Free · Evidence-first · Reviewed monthly
          </p>
          <h2 className="mt-1 text-[24px] font-black leading-tight text-neutral-900 md:text-[36px]">
            The Toolbox — everything at hand's reach
          </h2>
          <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-neutral-600 md:text-[15px]">
            Browse the resource ecosystem — UK Trade Price Index, live Grants Tracker, Q&A hub, editorial guides, career + trade encyclopaedia, quote sanity checker, and more. Every fact sourced. No fabrication.
          </p>
        </header>

        <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {PILLARS.map((p) => (
            <li key={p.href}>
              <Link
                href={p.href}
                className="group flex h-full flex-col rounded-2xl border-2 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                style={{ borderColor: "rgba(139,69,19,0.10)" }}
              >
                <div className="flex items-center gap-2">
                  <p.Icon size={14} strokeWidth={2.6} className="text-neutral-900"/>
                  <span className="text-[13px] font-black text-neutral-900">{p.label}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-[11.5px] text-neutral-600">{p.description}</p>
                <p className="mt-auto inline-flex items-center gap-0.5 pt-3 text-[10px] font-black uppercase tracking-wider text-neutral-500 group-hover:text-neutral-900">
                  Open <ArrowUpRight size={10} strokeWidth={2.6}/>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
