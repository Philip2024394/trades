"use client";

// Xrated Trades — Contact FAQ accordion.
// Client island so the page can stay a server component. Each row keeps
// its own open/close state in a Set; multiple rows can be open at once
// so visitors can scan answers side-by-side without auto-collapse
// gymnastics. The first row is visually elevated with a yellow tint +
// "Most asked" badge — that's the question we field most often.
// The whole row (text + chevron + empty space) is a single button so
// the tap target reads as a clear "press to drop down" affordance, and
// the body slides open with a max-height transition rather than
// snapping in.

import { useRef, useState } from "react";
import { XRATED_BRAND } from "@/lib/xratedTrades";

type Faq = { q: string; a: string };

const FAQS: ReadonlyArray<Faq> = [
  {
    q: "Can I add my own domain name?",
    a: "Yes — we keep this flexible. Two options: (a) point your domain at your thenetworkers.app app, we host the app, you stay in control of the domain — the easiest way to keep your app running smoothly during launch traffic and traffic spikes; (b) we host both the domain and the app together as one package. Either works. Both keep you free to move at any time."
  },
  {
    q: "Can I have changes or added features built into my app?",
    a: "Yes. Our team can alter the app for the exact purpose of your online presence. Smaller changes are free — adjustments to layout, copy, colours, ordering. Bigger feature work is quoted on scope. Pricing is fair, results are high quality. Get in touch via the form below and tell us what you've got in mind."
  },
  {
    q: "Can I have group apps for a team under one URL?",
    a: "Yes — multi-app teams are something we set up regularly. We can also build you a back-end admin panel so you can monitor every app under the team and the traffic each one's getting. Talk to us about how you'd like the structure to work."
  },
  {
    q: "Does thenetworkers.app have its own payment gateway?",
    a: "No. We use Stripe — they handle the money, we handle the app. That means we never see your customer's card details, never store them, never touch them. If you've got a payment issue, get in touch — we'll work out what happened and use it to improve the system for every tradesperson."
  },
  {
    q: "Can I promote thenetworkers.app apps as a reseller?",
    a: "It depends on the direction you'd take it. After a good conversation, if there's real energy that aligns with what we're building for the trades, a reseller programme is possible. Drop us a message via the form below with what you have in mind — we listen first, decide after."
  },
  {
    q: "What does it cost to get my app live?",
    a: "Nothing to get started. Every signup gets a 14-day premium trial with full features — no card needed. After day 14 you either subscribe (£14.99/month or £139.99/year) to keep premium, or your app auto-reverts to the free-for-life tier. The free tier keeps your profile online, your reviews live and your customers reaching you."
  },
  {
    q: "What if I want to cancel?",
    a: "Open your dashboard, click 'Manage subscription' — that opens the Stripe Customer Portal where you cancel in one tap, at period end. Your app keeps running on the same thenetworkers.app URL — we just switch it to the free-for-life tier, add a \"Free\" badge, and hide the paid-only widgets. Your profile stays online, your reviews stay live, your customers can still reach you. Your slug stays yours forever. Re-upgrade any time to remove the badge and unlock the widgets again."
  },
  {
    q: "Do you take a commission on jobs I win?",
    a: "No. thenetworkers.app is a flat-fee subscription, not a marketplace. The money your customers pay you is between you and them — we don't see it, don't touch it, don't take a percentage. We make our money from the subscription, not from your invoices."
  },
  {
    q: "What support do I get?",
    a: "Our team replies in accordance with the messages received — expect a reply within 24 hours. We work UK hours (Monday-Friday, 9am-6pm). Weekend messages get picked up Monday morning."
  },
  {
    q: "Can my reviews come from any source?",
    a: "Reviews come from real customers, directly on your profile. We don't accept fake or paid reviews — they break Stripe's terms of service and would put your account at risk. The best move: send your existing customers a link to the review form, they leave a review in 30 seconds. Real reviews convert; manufactured ones don't and we won't host them."
  }
];

function FaqRow({
  faq,
  index,
  isFirst,
  isOpen,
  onToggle
}: {
  faq: Faq;
  index: number;
  isFirst: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  // Measure body height to drive the max-height transition. Falls back
  // to a generous ceiling if the ref hasn't measured yet.
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const measured = bodyRef.current?.scrollHeight ?? 600;

  const baseClass = "rounded-lg border";
  const restClass = isFirst
    ? "bg-[#FFB300]/15 border-neutral-200"
    : "bg-white border-neutral-200";

  const leftBorderStyle =
    isFirst || isOpen
      ? {
          borderLeftWidth: "2px",
          borderLeftColor: XRATED_BRAND.accent
        }
      : undefined;

  return (
    <li className={`${baseClass} ${restClass}`} style={leftBorderStyle}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={`faq-panel-${index}`}
        id={`faq-trigger-${index}`}
        onClick={onToggle}
        className="flex w-full min-h-[44px] cursor-pointer items-start justify-between gap-3 rounded-lg px-4 py-3 text-left transition hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
      >
        <span className="flex flex-1 flex-col gap-1">
          {isFirst && (
            <span
              className="inline-flex w-fit items-center rounded px-2 py-0.5 text-[13px] font-extrabold uppercase tracking-wider text-black"
              style={{ background: XRATED_BRAND.accent }}
            >
              Most asked
            </span>
          )}
          <span className="text-[14px] font-bold leading-snug text-neutral-900">
            {faq.q}
          </span>
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="mt-1 h-4 w-4 shrink-0 text-neutral-500 transition-transform duration-200"
          style={{
            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)"
          }}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="7 4 13 10 7 16" />
        </svg>
      </button>
      <div
        id={`faq-panel-${index}`}
        role="region"
        aria-labelledby={`faq-trigger-${index}`}
        className="overflow-hidden transition-[max-height] duration-300 ease-out"
        style={{ maxHeight: isOpen ? `${measured}px` : "0px" }}
      >
        <div
          ref={bodyRef}
          className="px-4 pb-4 pt-1 text-[13px] leading-relaxed text-neutral-700"
        >
          {faq.a}
        </div>
      </div>
    </li>
  );
}

export function FaqAccordion() {
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set());

  const toggle = (i: number) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  };

  return (
    <ul className="mt-5 flex flex-col gap-2">
      {FAQS.map((faq, i) => (
        <FaqRow
          key={faq.q}
          faq={faq}
          index={i}
          isFirst={i === 0}
          isOpen={open.has(i)}
          onToggle={() => toggle(i)}
        />
      ))}
    </ul>
  );
}
