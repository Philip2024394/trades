"use client";

// MerchantProfileSheet · Trade Centre v3 · Philip 2026-08-02.
//
// v3 changes on top of v2:
//   - "How can we help you today?" section ABOVE Nex Chat with 5 quick-
//     action chips (Request a Quote · Book a Survey · Ask a Question ·
//     Discuss an Existing Order · Need Advice). Each chip auto-sends the
//     matching intent to Nex Chat so the conversation starts qualifying.
//   - Primary contact row simplified: Nex Chat · Call · Website.
//   - "More contact options" expandable section: WhatsApp · Facebook ·
//     Instagram · Email.
//   - Trust section: "Why choose this business?" — bullets rendered ONLY
//     for signals we can prove (Verified badge · years trading · trade
//     specialisation). Fabricated stats deliberately omitted.
//   - Nex Chat modal now posts to /api/nex/merchant-chat (dedicated
//     endpoint) instead of the temporary staircase-chat wiring.

import { useEffect, useState } from "react";
import {
  BookOpen,
  ExternalLink,
  FileText,
  Heart,
  HelpCircle,
  Lightbulb,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Send,
  Share2,
  Sparkles,
  Star,
  Store,
} from "lucide-react";

// lucide-react dropped brand icons (trademark/licensing reasons). Inline
// SVG brand marks used as drop-in components with the same {className} +
// {strokeWidth?} prop shape lucide-react uses, so they slot into the
// existing SecondaryButton icon slot without changing button internals.
function Facebook({ className }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
    </svg>
  );
}
function Instagram({ className }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}
import type { CentreFeedItem } from "@/lib/nex/centre-publishing/types";
import { WhatsAppProtectionModal } from "./WhatsAppProtectionModal";

const PAID_TIERS = new Set([
  "starter", "professional", "business", "works",
  "app_trial", "app_paid", "app_verified", "verified", "verified_plus",
]);
function isPaidTier(seed: CentreFeedItem): boolean {
  return (seed.merchant_tier != null && PAID_TIERS.has(seed.merchant_tier)) || seed.is_promoted;
}

type Intent = "quote" | "survey" | "question" | "order" | "advice";

const QUICK_ACTIONS: Array<{
  intent: Intent;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  prefill: string;
}> = [
  { intent: "quote",    label: "Request a Quote",         icon: FileText,   prefill: "I'd like to request a quotation." },
  { intent: "survey",   label: "Book a Survey",           icon: BookOpen,   prefill: "I'd like to arrange a site survey." },
  { intent: "question", label: "Ask a Question",          icon: HelpCircle, prefill: "I have a question about your services." },
  { intent: "order",    label: "Discuss an Existing Order",icon: Package,   prefill: "I'd like to discuss an existing order." },
  { intent: "advice",   label: "Need Advice",             icon: Lightbulb,  prefill: "I'd like some advice before deciding." },
];

type Props = {
  seed: CentreFeedItem;
  onSelectProduct: (item: CentreFeedItem) => void;
};

export function MerchantProfileSheet({ seed, onSelectProduct }: Props) {
  const [showWaProtection, setShowWaProtection] = useState(false);
  const [savedMerchant, setSavedMerchant] = useState(false);
  const [chatOpen, setChatOpen] = useState<null | { prefill: string; intent: Intent | null }>(null);
  const [showMoreContacts, setShowMoreContacts] = useState(false);
  const [products, setProducts] = useState<CentreFeedItem[]>([]);

  const merchantName = seed.merchant_display_name ?? seed.brand_name;
  const location = seed.merchant_city ?? seed.merchant_postcode_prefix ?? "UK";
  const trade =
    seed.category_path[0] ??
    (seed.merchant_services.length > 0 ? seed.merchant_services[0] : null);
  const paid = isPaidTier(seed);
  const projectThumbs = (seed.merchant_photos ?? []).slice(0, 5);
  const isVerified =
    seed.merchant_verification_level === "verified" ||
    seed.merchant_verification_level === "partner";

  // Contact URLs — each hidden when merchant has no value.
  const whatsappUrl = seed.merchant_whatsapp
    ? `https://wa.me/${seed.merchant_whatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Hi ${merchantName}, I found you on NEX Trade Centre.`)}`
    : null;
  const mailtoUrl = seed.merchant_email
    ? `mailto:${seed.merchant_email}?subject=${encodeURIComponent(`NEX Trade Centre enquiry`)}`
    : null;
  const telUrl = seed.merchant_phone
    ? `tel:${seed.merchant_phone.replace(/[^0-9+]/g, "")}`
    : null;
  const websiteUrl = seed.merchant_website
    ? seed.merchant_website.startsWith("http")
      ? seed.merchant_website
      : `https://${seed.merchant_website}`
    : null;
  const facebookUrl = seed.merchant_facebook
    ? seed.merchant_facebook.startsWith("http")
      ? seed.merchant_facebook
      : `https://facebook.com/${seed.merchant_facebook}`
    : null;
  const instagramUrl = seed.merchant_instagram
    ? seed.merchant_instagram.startsWith("http")
      ? seed.merchant_instagram
      : `https://instagram.com/${seed.merchant_instagram.replace(/^@/, "")}`
    : null;

  const hasSecondaryContacts = Boolean(whatsappUrl || facebookUrl || instagramUrl || mailtoUrl);

  // Trust signals · only render bullets we can PROVE. No fabricated stats
  // (Rule A · Philip's "no fake data" governance). Signals we can prove:
  //   - Verified badge
  //   - Years trading (numeric on Supabase merchants)
  //   - Trade specialisation (from category_path or services)
  //   - Google review count (real Google-sourced number)
  const trustSignals: string[] = [];
  if (isVerified) trustSignals.push("Verified by NEX");
  if (seed.merchant_years_in_trade != null && seed.merchant_years_in_trade > 0) {
    trustSignals.push(
      `${seed.merchant_years_in_trade} ${seed.merchant_years_in_trade === 1 ? "year" : "years"} trading`,
    );
  }
  if (trade) trustSignals.push(`Specialises in ${trade.toLowerCase()}`);
  if (seed.merchant_google_review_count != null && seed.merchant_google_review_count >= 10) {
    trustSignals.push(`${seed.merchant_google_review_count} customer reviews`);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/nex/centre/feed?limit=24`, { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        const list = (data?.items as CentreFeedItem[]) ?? [];
        setProducts(list.filter((i) => i.merchant_id === seed.merchant_id));
      } catch { /* ignore */ }
    }
    void load();
    return () => { cancelled = true; };
  }, [seed.merchant_id]);

  const openChatFreeText = () => setChatOpen({ prefill: "", intent: null });
  const openChatWithIntent = (intent: Intent, prefill: string) =>
    setChatOpen({ prefill, intent });

  return (
    <div>
      <div className="relative h-56 w-full overflow-hidden bg-gradient-to-br from-neutral-200 to-neutral-300">
        {seed.hero_image_url ? (
          <img src={seed.hero_image_url} alt={merchantName} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <Store className="h-12 w-12 text-black/20" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
          {isVerified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm">
              <Sparkles className="h-3 w-3" strokeWidth={2.5} />
              {seed.merchant_verification_level === "partner" ? "NEX Partner" : "Verified"}
            </span>
          )}
          {paid && (
            <span className="inline-flex items-center rounded-full bg-orange-500 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm">
              Featured
            </span>
          )}
        </div>
      </div>

      <div className="px-5">
        <div className="-mt-8 flex items-end gap-3">
          {seed.merchant_avatar_url ? (
            <img src={seed.merchant_avatar_url} alt="" className="h-16 w-16 rounded-2xl border-4 border-white object-cover shadow-md" />
          ) : (
            <div className="grid h-16 w-16 place-items-center rounded-2xl border-4 border-white bg-orange-100 shadow-md">
              <Store className="h-6 w-6 text-orange-700" />
            </div>
          )}
          <div className="pb-1">
            <div className="text-lg font-semibold leading-tight text-black">{merchantName}</div>
            {trade && <div className="mt-0.5 text-[11px] font-medium text-black/70">{trade}</div>}
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-black/60">
              <MapPin className="h-3 w-3" />
              {location}
            </div>
          </div>
        </div>

        {seed.merchant_google_rating != null && (
          <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900">
            <Star className="h-3 w-3 fill-amber-500 text-amber-500" strokeWidth={0} />
            {Math.round(seed.merchant_google_rating * 10) / 10}
            {seed.merchant_google_review_count != null && seed.merchant_google_review_count > 0 && (
              <span className="text-amber-700/70">({seed.merchant_google_review_count} reviews)</span>
            )}
          </div>
        )}

        {seed.description && (
          <p className="mt-4 text-sm leading-relaxed text-black/80">{seed.description}</p>
        )}

        {/* Trust section · only renders when we have real signals. */}
        {trustSignals.length > 0 && (
          <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
              Why choose this business?
            </div>
            <ul className="mt-2 space-y-1">
              {trustSignals.map((s) => (
                <li key={s} className="flex items-center gap-2 text-[12px] text-emerald-900">
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-white text-[10px] font-bold">✓</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {seed.merchant_services.length > 0 && (
          <div className="mt-5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-black/50">Services</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {seed.merchant_services.slice(0, 12).map((s) => (
                <span key={s} className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-medium text-black/70">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-black/50">Location</div>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-black/80">
            <MapPin className="h-4 w-4 text-black/60" />
            {location}
          </div>
        </div>

        {projectThumbs.length > 0 && (
          <div className="mt-5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-black/50">Recent projects</div>
            <div className="mt-2 grid grid-cols-5 gap-1.5">
              {projectThumbs.map((url, idx) => (
                <div key={idx} className="aspect-square overflow-hidden rounded-xl bg-neutral-100">
                  <img src={url} alt={`${merchantName} project ${idx + 1}`} loading="lazy" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* "How can we help you today?" · quick-action chips ABOVE Nex Chat */}
        <div className="mt-6">
          <div className="text-sm font-semibold text-black">How can we help you today?</div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {QUICK_ACTIONS.map(({ intent, label, icon: Icon, prefill }) => (
              <button
                key={intent}
                type="button"
                onClick={() => openChatWithIntent(intent, prefill)}
                className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-white px-3 py-1.5 text-[12px] font-medium text-orange-800 shadow-sm transition hover:bg-orange-50"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* PRIMARY action row · Nex Chat · Call · Website */}
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={openChatFreeText}
            className="col-span-full flex items-center justify-center gap-2 rounded-full bg-orange-500 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-orange-600 sm:col-span-1"
          >
            <MessageCircle className="h-4 w-4" strokeWidth={2.5} />
            Nex Chat
          </button>
          {telUrl && (
            <a href={telUrl} className="flex items-center justify-center gap-1.5 rounded-full border border-black/10 bg-white py-3 text-sm font-medium text-black/80 shadow-sm transition hover:bg-black/[0.04]">
              <Phone className="h-4 w-4" />
              Call
            </a>
          )}
          {websiteUrl && (
            <a
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-full border border-black/10 bg-white py-3 text-sm font-medium text-black/80 shadow-sm transition hover:bg-black/[0.04]"
            >
              <ExternalLink className="h-4 w-4" />
              Website
            </a>
          )}
        </div>

        {/* Expandable "More contact options" · secondary channels */}
        {hasSecondaryContacts && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowMoreContacts((v) => !v)}
              className="text-[11px] font-medium text-black/60 underline-offset-2 hover:text-black hover:underline"
            >
              {showMoreContacts ? "Hide more contact options" : "More contact options"}
            </button>
            {showMoreContacts && (
              <div className="mt-2 flex flex-wrap gap-2">
                {whatsappUrl && (
                  <SecondaryButton onClick={() => setShowWaProtection(true)} icon={MessageCircle} label="WhatsApp" tone="green" />
                )}
                {facebookUrl && (
                  <SecondaryButton href={facebookUrl} icon={Facebook} label="Facebook" external />
                )}
                {instagramUrl && (
                  <SecondaryButton href={instagramUrl} icon={Instagram} label="Instagram" external />
                )}
                {mailtoUrl && (
                  <SecondaryButton href={mailtoUrl} icon={Mail} label="Email" />
                )}
              </div>
            )}
          </div>
        )}

        {/* Save · Share footer */}
        <div className="mt-6 flex items-center justify-around border-t border-black/5 pt-4">
          <button
            type="button"
            onClick={() => setSavedMerchant((v) => !v)}
            className={`flex flex-col items-center gap-1 text-[10px] ${savedMerchant ? "text-red-600" : "text-black/60"}`}
          >
            <Heart className={`h-5 w-5 ${savedMerchant ? "fill-current" : ""}`} />
            {savedMerchant ? "Saved" : "Save merchant"}
          </button>
          <button
            type="button"
            onClick={async () => {
              const url = seed.merchant_slug ? `${window.location.origin}/trade/${seed.merchant_slug}` : window.location.href;
              if (navigator.share) { try { await navigator.share({ title: merchantName, url }); } catch { /* ignore */ } }
              else if (navigator.clipboard) { try { await navigator.clipboard.writeText(url); } catch { /* ignore */ } }
            }}
            className="flex flex-col items-center gap-1 text-[10px] text-black/60"
          >
            <Share2 className="h-5 w-5" />
            Share
          </button>
        </div>

        {products.length > 0 && (
          <div className="mt-6">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-black/50">Products ({products.length})</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {products.map((p) => (
                <button key={p.offer_id} type="button" onClick={() => onSelectProduct(p)} className="overflow-hidden rounded-xl border border-black/5 bg-white text-left">
                  {p.hero_image_url ? (
                    <img src={p.hero_image_url} alt={p.name} className="h-28 w-full object-cover" />
                  ) : (
                    <div className="h-28 w-full bg-neutral-100" />
                  )}
                  <div className="p-2">
                    <div className="line-clamp-2 text-[11px] font-medium text-black">{p.name}</div>
                    {p.price_pence > 0 && <div className="mt-1 text-[11px] font-semibold text-black">£{(p.price_pence / 100).toFixed(2)}</div>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="h-10" />
      </div>

      {showWaProtection && whatsappUrl && (
        <WhatsAppProtectionModal whatsappUrl={whatsappUrl} merchantName={merchantName} onClose={() => setShowWaProtection(false)} />
      )}

      {chatOpen && (
        <NexChatModal
          merchantName={merchantName}
          merchantId={seed.merchant_id}
          initialPrefill={chatOpen.prefill}
          initialIntent={chatOpen.intent}
          onClose={() => setChatOpen(null)}
        />
      )}
    </div>
  );
}

function SecondaryButton({
  href, onClick, icon: Icon, label, external, tone,
}: {
  href?: string;
  onClick?: () => void;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  external?: boolean;
  tone?: "green";
}) {
  const className =
    tone === "green"
      ? "flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#25D366] px-3 py-2 text-[12px] font-medium text-white transition hover:opacity-90 min-w-[100px]"
      : "flex flex-1 items-center justify-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-2 text-[12px] font-medium text-black/80 transition hover:bg-black/[0.04] min-w-[100px]";
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </button>
    );
  }
  return (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className={className}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </a>
  );
}

// ─── Nex Chat modal ───────────────────────────────────────────────────
// v3 · posts to /api/nex/merchant-chat with an optional intent hint.
// When opened from a quick-action chip, the modal AUTO-SENDS the prefill
// message as the customer's first turn so Nex responds immediately —
// reduces friction to zero clicks after the chip tap. When opened from
// the plain Nex Chat button, the modal shows the greeting and waits.
function NexChatModal({
  merchantName, merchantId, initialPrefill, initialIntent, onClose,
}: {
  merchantName: string;
  merchantId: string;
  initialPrefill: string;
  initialIntent: Intent | null;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Array<{ role: "user" | "nex"; text: string }>>(() => {
    if (initialPrefill.trim().length > 0) return []; // auto-send flow · skip greeting
    return [
      {
        role: "nex",
        text: `Hi, I'm Nex. I can help connect you with ${merchantName}. Tell me about your project — what you're looking for, when you need it, and where you're based — and I'll prepare your enquiry.`,
      },
    ];
  });
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const sendMessage = async (text: string, intentHint: Intent | null) => {
    if (!text.trim() || sending) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setSending(true);
    try {
      const res = await fetch("/api/nex/merchant-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          merchant_id: merchantId,
          merchant_name: merchantName,
          conversation_id: conversationId,
          intent: intentHint ?? undefined,
        }),
      });
      const data = await res.json();
      const reply = (data?.answer as string) ?? `Thanks — I'll pass that on to ${merchantName}. They typically respond within a few working hours.`;
      if (typeof data?.conversation_id === "string") setConversationId(data.conversation_id);
      setMessages((m) => [...m, { role: "nex", text: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "nex", text: "Sorry, I couldn't reach the chat service just now. Try again in a moment." }]);
    } finally {
      setSending(false);
    }
  };

  // Auto-send the prefill message as the user's first turn when the modal
  // was opened from a quick-action chip. Runs once on mount.
  useEffect(() => {
    if (initialPrefill.trim().length > 0) {
      void sendMessage(initialPrefill.trim(), initialIntent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-black/5 bg-orange-50 px-4 py-3">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-orange-500 text-white">
            <MessageCircle className="h-4 w-4" strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-black">Nex Chat</div>
            <div className="text-[11px] text-black/60">Enquiring about {merchantName}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-black/50 hover:bg-black/5">✕</button>
        </div>

        <div className="flex max-h-[50vh] flex-col gap-2.5 overflow-y-auto bg-white px-4 py-4">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={m.role === "user"
                ? "max-w-[80%] rounded-2xl rounded-br-md bg-orange-500 px-3 py-2 text-sm text-white"
                : "max-w-[80%] rounded-2xl rounded-bl-md border border-black/5 bg-neutral-50 px-3 py-2 text-sm text-black"}>
                {m.text}
              </div>
            </div>
          ))}
          {sending && <div className="text-[11px] italic text-black/40">Nex is preparing your enquiry…</div>}
        </div>

        <div className="flex items-end gap-2 border-t border-black/5 bg-white px-4 py-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const t = draft.trim();
                if (t) { setDraft(""); void sendMessage(t, null); }
              }
            }}
            rows={2}
            placeholder="Type your reply…"
            className="flex-1 resize-none rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-black outline-none placeholder:text-black/40 focus:border-orange-400"
          />
          <button
            type="button"
            onClick={() => {
              const t = draft.trim();
              if (t) { setDraft(""); void sendMessage(t, null); }
            }}
            disabled={!draft.trim() || sending}
            className="grid h-10 w-10 place-items-center rounded-full bg-orange-500 text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-50"
            aria-label="Send"
          >
            <Send className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
