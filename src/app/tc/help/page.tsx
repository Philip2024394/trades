// /tc/help — Trade Center help + guides.
//
// Sections addressed via URL anchors so the BlockedFeatureToast + the
// header burger's "Help & guides" link land the reader on the right
// question. Content is intentionally short — this is a launchpad, not
// a knowledge base.

import Link from "next/link";
import { ArrowLeft, HardHat, Home, ShieldCheck, MessageCircle, ShoppingCart, ScrollText, Info } from "lucide-react";
import { TradeCenterHeader } from "@/apps/tradecenter/components/TradeCenterHeader";

export const dynamic = "force-dynamic";

export default function HelpPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <TradeCenterHeader activeCategorySlug={null}/>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 md:px-6 md:py-10">
        <Link
          href="/tc/trade-center"
          className="inline-flex min-h-[44px] items-center gap-2 self-start text-[11.5px] font-bold text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft size={13}/>
          Back to Trade Center
        </Link>

        <header>
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Trade Center · Help
          </div>
          <h1 className="mt-1 text-[26px] font-black leading-tight text-neutral-900 md:text-[32px]">
            Help &amp; guides
          </h1>
          <p className="mt-2 text-[13px] leading-snug text-neutral-500">
            Short answers to what people ask most. Jump to a section or scroll through.
          </p>
        </header>

        {/* Anchor nav */}
        <nav
          className="rounded-2xl border bg-white p-4 shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
          aria-label="Help topics"
        >
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <AnchorLink href="#trade-vs-diy" icon={<HardHat size={14}/>} label="Trade vs DIY accounts"/>
            <AnchorLink href="#trade-features" icon={<Info size={14}/>} label="Trade-only features"/>
            <AnchorLink href="#buying" icon={<ShoppingCart size={14}/>} label="How buying works"/>
            <AnchorLink href="#safe-trade" icon={<ShieldCheck size={14}/>} label="Safe Trade + customer protection"/>
            <AnchorLink href="#whatsapp" icon={<MessageCircle size={14}/>} label="WhatsApp orders"/>
            <AnchorLink href="#quotes" icon={<ScrollText size={14}/>} label="Requesting a quote"/>
          </ul>
        </nav>

        {/* Sections */}
        <Section
          id="trade-vs-diy"
          title="Trade vs DIY accounts"
          icon={<HardHat size={16}/>}
        >
          <p>
            Trade Center has two account types. Both are free. You pick which fits at sign-up and it stays that way — the surfaces you see are different because your job is different.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <RoleBox
              icon={<HardHat size={18} strokeWidth={2}/>}
              title="Trade"
              subtitle="Professional tradesperson"
              body="Trade prices when verified. Yard for trade-only conversations. Trade Counter classifieds. Merchant tools if you sell."
              accent="#FFB300"
            />
            <RoleBox
              icon={<Home size={18} strokeWidth={2}/>}
              title="DIY"
              subtitle="Homeowner or home projects"
              body="Retail prices from every merchant. Notebook as your project shopping list. Multi-merchant cart. Delivery to your door."
              accent="#3B82F6"
            />
          </div>
          <p className="text-[11.5px] text-neutral-500">
            You can&apos;t switch account types. If you signed up as one but need the other, contact support to migrate.
          </p>
        </Section>

        <Section
          id="trade-features"
          title="Trade-only features"
          icon={<Info size={16}/>}
        >
          <p>
            Some features are only available to verified trades. This isn&apos;t about gatekeeping — it&apos;s about keeping each surface useful for the people who need it.
          </p>
          <ul className="ml-4 flex list-disc flex-col gap-1.5 text-[12.5px] leading-relaxed text-neutral-700">
            <li><strong className="text-neutral-900">Trade prices</strong> — merchant-set trade-only pricing, visible after Verified Trade Identity.</li>
            <li><strong className="text-neutral-900">Yard</strong> — trade-to-trade conversations. Trades want to talk about their work with other trades, not the general public.</li>
            <li><strong className="text-neutral-900">Trade Counter</strong> — peer-to-peer classifieds: sell, swap, give away offcuts, second-hand tools, spare materials.</li>
            <li><strong className="text-neutral-900">Verified Trade Identity</strong> — the multi-layer verification that unlocks trade prices and Yard posting.</li>
            <li><strong className="text-neutral-900">Studio + merchant tools</strong> — for trades who also sell.</li>
            <li><strong className="text-neutral-900">Trade Rate Card + Site Projects</strong> — how you price your labour + which builds you&apos;re on.</li>
          </ul>
          <p className="text-[11.5px] text-neutral-500">
            DIY viewers can browse products, request quotes, place orders, save merchants, and track projects in Notebook — everything a self-builder or home renovator needs.
          </p>
        </Section>

        <Section
          id="buying"
          title="How buying works"
          icon={<ShoppingCart size={16}/>}
        >
          <p>
            Add items to your cart from any merchant. Items are grouped by merchant at checkout so each order goes to the right seller with their own delivery and payment.
          </p>
          <p>
            Every merchant sets their own delivery — flat rate, free over a threshold, or free for everyone. You&apos;ll see the exact figure per merchant in your cart.
          </p>
        </Section>

        <Section
          id="safe-trade"
          title="Safe Trade + customer protection"
          icon={<ShieldCheck size={16}/>}
        >
          <p>
            When you pay through <strong className="text-neutral-900">Safe Trade</strong> (Stripe, PayPal, or escrow), your money is protected. If the merchant doesn&apos;t deliver, you get your money back.
          </p>
          <p>
            We always recommend Safe Trade over off-platform payment, especially for larger orders.
          </p>
        </Section>

        <Section
          id="whatsapp"
          title="WhatsApp orders"
          icon={<MessageCircle size={16}/>}
        >
          <p>
            Some merchants haven&apos;t wired a payment gateway yet, or you may prefer to sort payment directly with them. WhatsApp handoff lets you send your cart to the merchant as a formatted message.
          </p>
          <p>
            <strong className="text-neutral-900">Trade-off:</strong> WhatsApp orders happen off-platform, which means no money-back guarantee if something goes wrong. Fine for small orders with merchants you already know — riskier for larger ones or first-time buys.
          </p>
        </Section>

        <Section
          id="quotes"
          title="Requesting a quote"
          icon={<ScrollText size={16}/>}
        >
          <p>
            Add items you need to Notebook, then send a quote request to nearby merchants. They reply with a structured quote — price per line, availability, delivery date, valid-until.
          </p>
          <p>
            Every quote is a record in Trade Center. You can see who quoted what for which project, accept the one you like, and decline the rest. Quotes never leave the platform.
          </p>
        </Section>

        <div
          className="rounded-2xl border bg-white p-4 text-center shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <div className="text-[13px] font-black text-neutral-900">Something else?</div>
          <p className="mt-1 text-[11.5px] text-neutral-500">
            Message us in-app and someone will get back to you within a business day.
          </p>
          <Link
            href="/tc/messages"
            className="mt-3 inline-flex items-center gap-1 rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-wider text-white"
            style={{ backgroundColor: "#166534" }}
          >
            Message support
          </Link>
        </div>
      </main>
    </div>
  );
}

function AnchorLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <li>
      <a
        href={href}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-bold text-neutral-800 transition hover:bg-neutral-50"
      >
        <span className="text-neutral-500">{icon}</span>
        {label}
      </a>
    </li>
  );
}

function Section({
  id,
  title,
  icon,
  children
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-20 rounded-2xl border bg-white p-5 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <h2 className="flex items-center gap-2 text-[16px] font-black text-neutral-900">
        <span className="text-neutral-500">{icon}</span>
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-3 text-[12.5px] leading-relaxed text-neutral-700">
        {children}
      </div>
    </section>
  );
}

function RoleBox({
  icon,
  title,
  subtitle,
  body,
  accent
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  body: string;
  accent: string;
}) {
  return (
    <div
      className="flex flex-col gap-2 rounded-xl border bg-neutral-50 p-3"
      style={{ borderColor: "rgba(139,69,19,0.10)" }}
    >
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full"
        style={{ backgroundColor: accent, color: "#0A0A0A" }}
      >
        {icon}
      </div>
      <div>
        <div className="text-[13px] font-black text-neutral-900">{title}</div>
        <div className="mt-0.5 text-[10.5px] uppercase tracking-wider text-neutral-500">{subtitle}</div>
      </div>
      <p className="text-[11.5px] leading-snug text-neutral-600">{body}</p>
    </div>
  );
}
