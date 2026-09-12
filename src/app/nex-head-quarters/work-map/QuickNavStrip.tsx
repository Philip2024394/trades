// src/app/nex-head-quarters/work-map/QuickNavStrip.tsx
//
// Quick-nav strip at the top of the Work Map · lets the founder jump
// directly to the main HQ + Labs + Comms + Governance views without
// hunting the sidebar. Return path is guaranteed via:
//   - HQShell sidebar Work Map link (green pulsing)
//   - HQ header pulsing Work Map button
//   - Floating Work Map FAB (fixed position top-right)
//   - Reception hero card
//
// Route context: /nex-head-quarters/work-map
// Owning capability: CAP-091 (NEX HQ)

import Link from "next/link";
import {
  Home,
  Activity,
  Cpu,
  Users,
  Boxes,
  BookOpen,
  HardDrive,
  Database,
  Footprints,
  Heart,
  Radio,
  ClipboardList,
  UtensilsCrossed,
  Building2,
  Bus,
  ShoppingBag,
  ImagePlus,
  FlaskConical,
  Lightbulb,
  MessagesSquare,
  MessageCircle,
  Phone,
  Zap,
  ShieldCheck,
  FileCheck,
  FileWarning,
  Wallet,
  Newspaper,
  LayoutDashboard,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  external?: boolean;
}

interface NavGroup {
  title: string;
  colour: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Ops",
    colour: "#065f46",
    items: [
      { label: "Reception", href: "/nex-head-quarters", icon: Home },
      { label: "Live Graph", href: "/nexapp/hq", icon: Activity, external: true },
      { label: "Vitals", href: "/nex-head-quarters/vitals", icon: Cpu },
      { label: "Workers", href: "/nex-head-quarters/workers", icon: Users },
      { label: "Operations Centre", href: "/nex-head-quarters/operations-centre", icon: LayoutDashboard },
    ],
  },
  {
    title: "Data",
    colour: "#1e40af",
    items: [
      { label: "Knowledge", href: "/nex-head-quarters/knowledge-control-centre", icon: BookOpen },
      { label: "NEX Storage", href: "/nex-head-quarters/nex-storage", icon: HardDrive },
      { label: "Data Platform", href: "/nex-head-quarters/data-platform-centre", icon: Database },
      { label: "Directory", href: "/nex-head-quarters/directory", icon: Boxes },
      { label: "Journal", href: "/nex-head-quarters/journal", icon: FileCheck },
    ],
  },
  {
    title: "Acquisition",
    colour: "#7c2d12",
    items: [
      { label: "Walker", href: "/nex-head-quarters/walker", icon: Footprints },
      { label: "Walker Health", href: "/nex-head-quarters/walker-health", icon: Heart },
      { label: "Discovery", href: "/nex-head-quarters/discovery", icon: Radio },
      { label: "Workforce", href: "/nex-head-quarters/workforce", icon: ClipboardList },
      { label: "Factory", href: "/nex-head-quarters/factory", icon: FlaskConical },
    ],
  },
  {
    title: "Verticals",
    colour: "#7e22ce",
    items: [
      { label: "Food Ops", href: "/nex-head-quarters/food-ops", icon: UtensilsCrossed },
      { label: "Accommodation", href: "/nex-head-quarters/accommodation-agent", icon: Building2 },
      { label: "Transport", href: "/nex-head-quarters/transport-data", icon: Bus },
      { label: "Commerce", href: "/nex-head-quarters/commerce", icon: ShoppingBag },
      { label: "Image Intake", href: "/nex-head-quarters/image-intake", icon: ImagePlus },
    ],
  },
  {
    title: "Labs & Comms",
    colour: "#0369a1",
    items: [
      { label: "Labs", href: "/nexapp/lab", icon: FlaskConical, external: true },
      { label: "Ideas", href: "/nexapp/lab#innovation", icon: Lightbulb, external: true },
      { label: "Comms/Social", href: "/nex-head-quarters/comms-social-hq", icon: MessagesSquare },
      { label: "Conversations", href: "/nex-head-quarters/conversations", icon: MessageCircle },
      { label: "Live Chat", href: "/nex-head-quarters/live-chat-completion", icon: Zap },
      { label: "Calling", href: "/nex-head-quarters/calling", icon: Phone },
      { label: "Media", href: "/nex-head-quarters/media", icon: Newspaper },
    ],
  },
  {
    title: "Governance",
    colour: "#b91c1c",
    items: [
      { label: "Audit", href: "/nex-head-quarters/audit", icon: ShieldCheck },
      { label: "Claim Review", href: "/nex-head-quarters/claim-review", icon: FileCheck },
      { label: "Draft Review", href: "/nex-head-quarters/draft-review", icon: FileCheck },
      { label: "CLE Review", href: "/nex-head-quarters/cle-review", icon: FileCheck },
      { label: "Review Queue", href: "/nex-head-quarters/review", icon: FileCheck },
      { label: "Wallet Anomalies", href: "/nex-head-quarters/wallet-anomalies", icon: FileWarning },
      { label: "Wallet", href: "/nex-head-quarters/wallet-anomalies", icon: Wallet },
    ],
  },
];

function NavPill({ item, colour }: { item: NavItem; colour: string }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-white shadow-sm hover:shadow transition-shadow whitespace-nowrap"
      style={{ backgroundColor: colour }}
      title={`${item.label} → ${item.href}${item.external ? " (leaves HQ shell)" : ""}`}
    >
      <Icon size={12} strokeWidth={2.4} />
      {item.label}
      {item.external && <span className="opacity-70 text-[10px] ml-0.5">↗</span>}
    </Link>
  );
}

export default function QuickNavStrip() {
  return (
    <section
      aria-label="Quick navigation to HQ · Labs · Comms · Governance"
      className="border border-neutral-300 rounded-lg p-3 bg-white shadow-sm"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="text-xs uppercase tracking-wider text-neutral-500 font-bold">
            Quick nav
          </div>
          <div className="text-sm text-neutral-700">
            Jump to any HQ view · return via the sidebar Work Map link (always visible) or the header button.
          </div>
        </div>
        <div className="text-[10px] text-neutral-500 whitespace-nowrap">
          <span className="text-neutral-400">↗ = leaves HQ shell (own header)</span>
        </div>
      </div>
      <div className="space-y-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="flex items-start gap-2 flex-wrap">
            <div
              className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded"
              style={{ backgroundColor: group.colour, color: "#ffffff", minWidth: 110 }}
            >
              {group.title}
            </div>
            <div className="flex flex-wrap gap-1.5 flex-1">
              {group.items.map((item) => (
                <NavPill key={item.href + item.label} item={item} colour={group.colour} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
