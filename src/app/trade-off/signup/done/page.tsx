"use client";

// Post-submit success moment. This page is where the new member first
// feels they joined something alive — dark hero, giant URL, Founding
// 100 status card, "share the moment" strip, "meet the tradies who
// joined with you today" social proof, and 3 next-move CTAs into the
// ecosystem (Yard, App Store, Canteens).
//
// Cream theme (#FBF6EC) matches the signup page and every other
// canteen-family surface per canonical rule.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Sparkles,
  Copy,
  MessageCircle,
  QrCode,
  ArrowRight,
  Rocket,
  ShieldCheck,
  ExternalLink,
  Zap,
  Users,
  Hammer,
  Store as StoreIcon,
  ShoppingBag,
  Check,
  BookOpen
} from "lucide-react";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { WelcomeKnifePopup } from "@/components/xrated/WelcomeKnifePopup";
import { WELCOME_KNIFE_PRODUCT } from "@/lib/xratedVoucher";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";

export const dynamic = "force-dynamic";

const CREAM = "#FBF6EC";

// Peers going live today — mock for now, wire to a real "signups
// today" query once the DB has volume. Shows the new member the
// human faces they joined with.
const PEERS_TODAY: Array<{ initial: string; name: string; trade: string; city: string }> = [
  { initial: "M", name: "Marcus Thorne", trade: "Bricklayer", city: "Bristol"    },
  { initial: "S", name: "Sarah Wilkins", trade: "Plasterer",  city: "Manchester" },
  { initial: "D", name: "Dean Whitaker", trade: "Bathroom",   city: "Leeds"      },
  { initial: "P", name: "Priya Menon",   trade: "Interior",   city: "London"     },
  { initial: "A", name: "Alex Hughes",   trade: "Kitchen",    city: "Manchester" },
  { initial: "J", name: "Jamie Blake",   trade: "Developer",  city: "Bristol"    }
];

function Inner() {
  const params = useSearchParams();
  const slug = params.get("slug") ?? "";
  const token = params.get("token") ?? "";
  const status = (params.get("status") ?? "draft").toLowerCase();
  const isEdit = params.get("edit") === "1";
  const voucher = (params.get("voucher") ?? "").trim();

  const isLive = status === "live";
  const editPath = `/trade-off/edit/${slug}?token=${token}`;
  const profilePath = `/${slug}`;
  const [editAbsolute, setEditAbsolute] = useState(editPath);
  const [profileAbsolute, setProfileAbsolute] = useState(profilePath);
  useEffect(() => {
    setEditAbsolute(`${window.location.origin}${editPath}`);
    setProfileAbsolute(`${window.location.origin}${profilePath}`);
  }, [editPath, profilePath]);

  const profileDisplay = `xratedtrade.com/${slug}`;

  const [urlCopied, setUrlCopied] = useState(false);
  const [editCopied, setEditCopied] = useState(false);

  const expiryDate = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 12);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    });
  })();

  // Mock Founder number — replace with real position from the API
  // response once the /api/trade-off/create endpoint returns it.
  const founderNumber = 57;
  const isFoundingHundred = isLive && founderNumber <= 100;

  async function copyProfile() {
    try {
      await navigator.clipboard.writeText(profileAbsolute);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2500);
    } catch {
      window.prompt("Copy this URL:", profileAbsolute);
    }
  }

  async function copyEdit() {
    try {
      await navigator.clipboard.writeText(editAbsolute);
      setEditCopied(true);
      setTimeout(() => setEditCopied(false), 2500);
    } catch {
      window.prompt("Copy this link and save it somewhere safe:", editAbsolute);
    }
  }

  const waShareUrl = `https://wa.me/?text=${encodeURIComponent(
    `Just launched my business app on The Network — ${profileAbsolute}`
  )}`;

  return (
    <main className="min-h-screen" style={{ backgroundColor: CREAM }}>
      <XratedHeader />

      {voucher && isLive && (
        <WelcomeKnifePopup
          voucherCode={voucher}
          product={WELCOME_KNIFE_PRODUCT}
          expiryLabel={expiryDate}
        />
      )}

      {/* Hero — success moment. Dark banner + gigantic URL + primary
          CTAs. Draft state uses a warmer eyebrow but same layout. */}
      <section
        className="relative overflow-hidden border-b"
        style={{ backgroundColor: BRAND_BLACK, borderColor: `${BRAND_YELLOW}33` }}
      >
        {/* Yellow star burst — decorative, low-opacity, sits behind
            the copy for a subtle celebration signal. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle at 20% 30%, ${BRAND_YELLOW}18 0%, transparent 50%), radial-gradient(circle at 80% 60%, ${BRAND_YELLOW}10 0%, transparent 50%)`
          }}
        />
        <div className="relative mx-auto max-w-4xl px-3 py-10 md:px-6 md:py-14">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.24em]"
              style={{
                backgroundColor: isLive ? `${BRAND_GREEN_DARK}44` : `${BRAND_YELLOW}22`,
                color: isLive ? "#7EE7A5" : BRAND_YELLOW
              }}
            >
              {isLive ? (
                <>
                  <Sparkles size={10} strokeWidth={2.5}/>
                  {isEdit ? "Changes saved · Your app is live" : "You joined The Network"}
                </>
              ) : (
                <>
                  <Zap size={10} strokeWidth={2.5}/>
                  Saved as draft
                </>
              )}
            </span>
          </div>
          <h1 className="mt-3 text-[28px] font-black leading-[1.05] text-white md:text-[42px]">
            {isLive ? (
              <>
                You joined The Network.<br/>
                <span style={{ color: BRAND_YELLOW }}>Free for life. Yours now.</span>
              </>
            ) : (
              <>
                Your draft is safe.<br/>
                <span style={{ color: BRAND_YELLOW }}>Finish when you're ready.</span>
              </>
            )}
          </h1>

          {isLive ? (
            <p className="mt-3 max-w-xl text-[13px] leading-snug text-neutral-300 md:text-[14px]">
              Your app is live at the URL below. Screenshot it, put it on your van, WhatsApp it to customers. This is the address every customer meets your business at.
            </p>
          ) : (
            <p className="mt-3 max-w-xl text-[13px] leading-snug text-neutral-300 md:text-[14px]">
              You're missing one or more required fields (name, trade, city, WhatsApp, email, bio, or at least one photo). Use your edit link below to finish — you'll go live the moment everything's filled in.
            </p>
          )}

          {/* URL centerpiece — only when live. Giant readable line
              with brand-yellow accent, big Copy + WhatsApp CTAs. */}
          {isLive && (
            <div
              className="mt-6 rounded-2xl border-2 p-5 shadow-lg md:p-6"
              style={{
                borderColor: BRAND_YELLOW,
                background: `linear-gradient(135deg, ${BRAND_YELLOW}18 0%, rgba(0,0,0,0.4) 60%)`,
                backdropFilter: "blur(4px)"
              }}
            >
              <div
                className="text-[10px] font-black uppercase tracking-[0.24em]"
                style={{ color: BRAND_YELLOW }}
              >
                Your business app URL
              </div>
              <p
                className="mt-2 break-all font-mono text-[20px] font-black leading-tight text-white md:text-[28px]"
              >
                {profileDisplay}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyProfile}
                  className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[12px] font-black uppercase tracking-wider text-neutral-900 shadow-md transition active:scale-[0.97]"
                  style={{ backgroundColor: BRAND_YELLOW }}
                >
                  {urlCopied ? <Check size={13} strokeWidth={2.5}/> : <Copy size={13} strokeWidth={2.5}/>}
                  {urlCopied ? "Copied" : "Copy URL"}
                </button>
                <a
                  href={waShareUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[12px] font-black uppercase tracking-wider text-white shadow-md transition active:scale-[0.97]"
                  style={{ backgroundColor: BRAND_GREEN_DARK }}
                >
                  <MessageCircle size={13} strokeWidth={2.5}/>
                  Share on WhatsApp
                </a>
                <Link
                  href={profilePath}
                  className="inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-[12px] font-black uppercase tracking-wider text-white transition hover:bg-white/10"
                  style={{ borderColor: "rgba(255,255,255,0.3)" }}
                >
                  <ExternalLink size={13} strokeWidth={2.5}/>
                  View my app
                </Link>
                <a
                  href={`/trade/${slug}/qr.png?download=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-[12px] font-black uppercase tracking-wider text-white transition hover:bg-white/10"
                  style={{ borderColor: "rgba(255,255,255,0.3)" }}
                >
                  <QrCode size={13} strokeWidth={2.5}/>
                  Download QR
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-3 pb-16 pt-6 md:px-6 md:pt-8">
        {/* Founding 100 status — only for live members who made it in. */}
        {isFoundingHundred && (
          <section
            className="mb-4 relative overflow-hidden rounded-2xl border-2 p-5 shadow-md"
            style={{
              borderColor: BRAND_YELLOW,
              background: `linear-gradient(135deg, ${BRAND_YELLOW}22 0%, #FFFFFF 60%)`
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full shadow-md"
                style={{ backgroundColor: BRAND_BLACK }}
              >
                <Sparkles size={22} color={BRAND_YELLOW} strokeWidth={2}/>
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="text-[10px] font-black uppercase tracking-[0.28em]"
                  style={{ color: BRAND_BLACK }}
                >
                  Founding 100
                </div>
                <div className="mt-0.5 text-[18px] font-black leading-tight text-neutral-900">
                  You're Founder #{founderNumber} of 100.
                </div>
                <p className="mt-1 text-[12px] leading-snug text-neutral-600">
                  Every premium App Store install is free for you forever — even if you downgrade later. Wear it on your profile.
                </p>
              </div>
              <span
                className="hidden flex-shrink-0 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-sm sm:inline-flex"
                style={{ backgroundColor: BRAND_YELLOW }}
              >
                #{founderNumber}
              </span>
            </div>
          </section>
        )}

        {/* Next moves — 3 ecosystem CTAs. Only show when the account
            went live (draft users need to publish first). */}
        {isLive && (
          <section className="mb-4">
            <div className="mb-3 flex items-center gap-1.5">
              <Rocket size={12} color={BRAND_BLACK} strokeWidth={2.5}/>
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-700">
                Do this next
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              <NextMoveCard
                icon={BookOpen}
                href={`/trade-off/notebook/${slug}`}
                title="Open your Notebook"
                body="Your private feed of leads, reviews, canteen mentions, product views. Only you see it."
                cta="Open Notebook"
                featured
              />
              <NextMoveCard
                icon={Hammer}
                href="/trade-off/yard"
                title="Post to The Yard"
                body="Tell every trade in the UK you're free this week. Auto-vanishes after 14 days."
                cta="Open The Yard"
              />
              <NextMoveCard
                icon={Users}
                href="/trade-off/yard/canteens"
                title="Join a Canteen"
                body="Your trade's private chat + product hub. Where the real conversations happen."
                cta="Find your canteen"
              />
              <NextMoveCard
                icon={ShoppingBag}
                href="/trade-off/trade-center"
                title="List on Trade Center"
                body="Every product you sell, cross-syndicated to every canteen on The Network."
                cta="Add your first"
              />
            </div>
          </section>
        )}

        {/* Peers who joined today — social proof, cements ecosystem
            membership. */}
        {isLive && (
          <section
            className="mb-4 overflow-hidden rounded-2xl border bg-white shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <div
              className="flex items-center gap-1.5 border-b px-4 py-3"
              style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: `${BRAND_YELLOW}0F` }}
            >
              <Users size={12} color={BRAND_BLACK} strokeWidth={2.5}/>
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-700">
                You joined with these tradies today
              </span>
            </div>
            <ul className="grid grid-cols-2 gap-1 p-1 md:grid-cols-3">
              {PEERS_TODAY.map((peer) => (
                <li key={peer.name}>
                  <div
                    className="flex items-center gap-2 rounded-lg p-2 transition hover:bg-neutral-50"
                  >
                    <div
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-black shadow-sm"
                      style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                    >
                      {peer.initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-black text-neutral-900">
                        {peer.name}
                      </div>
                      <div className="truncate text-[10px] font-bold text-neutral-500">
                        {peer.trade} · {peer.city}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Edit link — bookmark this, always shown. */}
        <section
          className="mb-4 overflow-hidden rounded-2xl border bg-white p-5 shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <div className="flex items-center gap-1.5">
            <StoreIcon size={12} color={BRAND_BLACK} strokeWidth={2.5}/>
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-700">
              Your keycard back into Studio
            </span>
          </div>
          <p className="mt-2 text-[12.5px] leading-snug text-neutral-600">
            This link opens Studio for your app. Bookmark it. WhatsApp it to yourself. If you lose it, request a fresh one from the login page using your WhatsApp number.
          </p>
          <div
            className="mt-3 break-all rounded-lg border p-3 font-mono text-[11.5px] text-neutral-800"
            style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FAFAFA" }}
          >
            {editAbsolute}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyEdit}
              className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition active:scale-[0.97]"
              style={{ backgroundColor: BRAND_YELLOW }}
            >
              {editCopied ? <Check size={12} strokeWidth={2.5}/> : <Copy size={12} strokeWidth={2.5}/>}
              {editCopied ? "Copied" : "Copy edit link"}
            </button>
            <Link
              href={editPath}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-[11px] font-black uppercase tracking-wider text-neutral-800 transition hover:bg-neutral-50"
              style={{ borderColor: "rgba(139,69,19,0.20)" }}
            >
              <ArrowRight size={12} strokeWidth={2.5}/>
              Open Studio now
            </Link>
          </div>
        </section>

        {/* Trust footer strip */}
        <section
          className="rounded-2xl border bg-white p-4 shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            <TrustLine label="Free-for-life. Not a trial."/>
            <TrustLine label="No commission. Ever."/>
            <TrustLine label="Customers WhatsApp you direct."/>
            <TrustLine label="Cancel any time by walking away."/>
          </ul>
        </section>
      </div>

      <XratedFooter />
    </main>
  );
}

function NextMoveCard({
  icon: Icon,
  href,
  title,
  body,
  cta,
  featured = false
}: {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number | string }>;
  href: string;
  title: string;
  body: string;
  cta: string;
  /** When true, the card gets a 2px yellow border + tinted background
   *  so it reads as the primary next-move. Used for the Notebook card
   *  since that's the merchant's private control room. */
  featured?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      style={
        featured
          ? {
              borderColor: BRAND_YELLOW,
              borderWidth: 2,
              background: `linear-gradient(135deg, ${BRAND_YELLOW}18 0%, #FFFFFF 60%)`
            }
          : { borderColor: "rgba(139,69,19,0.15)" }
      }
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ backgroundColor: featured ? BRAND_YELLOW : `${BRAND_YELLOW}22` }}
      >
        <Icon size={18} color={BRAND_BLACK} strokeWidth={2}/>
      </div>
      <div className="mt-3 text-[14px] font-black leading-tight text-neutral-900 group-hover:underline">
        {title}
      </div>
      <p className="mt-1 flex-1 text-[12px] leading-snug text-neutral-600">
        {body}
      </p>
      <span
        className="mt-3 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider"
        style={{ color: featured ? BRAND_BLACK : BRAND_GREEN_DARK }}
      >
        {cta}
        <ArrowRight size={11} strokeWidth={2.5}/>
      </span>
    </Link>
  );
}

function TrustLine({ label }: { label: string }) {
  return (
    <li className="inline-flex items-center gap-1.5 text-[11px] font-bold text-neutral-700">
      <ShieldCheck size={11} color={BRAND_GREEN_DARK} strokeWidth={2.5} className="flex-shrink-0"/>
      {label}
    </li>
  );
}

export default function TradeOffSignupDonePage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
