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
import { formatCardLocation } from "@/lib/nex/geography/formatAddress";
import { WhatsAppProtectionModal } from "./WhatsAppProtectionModal";
import {
  appendMessage,
  composeStarterPurpose,
  createProject,
  findOpenProjectForMerchant,
  formatRelativeTime,
  PROJECTS_UPDATED_EVENT,
  updateConversationId,
} from "@/lib/nex/projects/customer-store";
import { PROJECT_STATUS_LABEL, type Project } from "@/lib/nex/projects/types";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [showWaProtection, setShowWaProtection] = useState(false);
  const [savedMerchant, setSavedMerchant] = useState(false);
  const [chatOpen, setChatOpen] = useState<null | { prefill: string; intent: Intent | null; askAboutOnly?: boolean }>(null);
  const [showMoreContacts, setShowMoreContacts] = useState(false);
  const [products, setProducts] = useState<CentreFeedItem[]>([]);
  const [openProject, setOpenProject] = useState<Project | null>(null);

  // Watch for a pre-existing open Project with this merchant so the CTA
  // can flip to "Continue Project" instead of "Start Project" (Philip
  // 2026-08-02 · Project Object v2 · async Supabase-backed).
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const next = await findOpenProjectForMerchant(seed.merchant_id);
        if (!cancelled) setOpenProject(next);
      } catch (err) {
        console.error("[merchant-profile][openProject]", err);
      }
    };
    void refresh();
    if (typeof window !== "undefined") {
      const handler = () => { void refresh(); };
      window.addEventListener(PROJECTS_UPDATED_EVENT, handler);
      return () => {
        cancelled = true;
        window.removeEventListener(PROJECTS_UPDATED_EVENT, handler);
      };
    }
    return () => { cancelled = true; };
  }, [seed.merchant_id]);

  const merchantName = seed.merchant_display_name ?? seed.brand_name;
  const location =
    formatCardLocation({
      country: seed.merchant_country,
      city: seed.merchant_city,
      county: seed.merchant_region,
      region: seed.merchant_region,
      postcode: seed.merchant_postcode_prefix,
      postcode_prefix: seed.merchant_postcode_prefix,
    }) || (seed.merchant_city ?? seed.merchant_postcode_prefix ?? "");
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
  // Philip 2026-08-02 · Big Win #3 · Freshness stamp (Freshness Rule).
  // Renders only when the merchant has actually confirmed their info via
  // the 6-monthly cycle. Silent when null so we never imply freshness that
  // hasn't been earned (Third Law).
  const freshnessLabel = freshnessLabelFor(seed.merchant_last_confirmed_at ?? null);
  if (freshnessLabel) trustSignals.push(freshnessLabel);

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
  // Philip 2026-08-02 · Big Win #3 · "Ask Nex about this company."
  // Opens the modal in general-chat mode (no project created, no project
  // appended-to). For users still deciding whether to start something.
  const openAskAboutCompany = () =>
    setChatOpen({ prefill: "", intent: null, askAboutOnly: true });

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

        {/* Trust section · Philip 2026-08-02 · Big Win #3 · "Who they are"
            framing. Only bullets we can PROVE render here — never fabricated
            counts. Freshness stamp joins the bullet list when populated. */}
        {trustSignals.length > 0 && (
          <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
              Who they are
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

        {/* Ask Nex about this company · Big Win #3 · trust-before-contact
            step. Opens the chat modal in general-chat mode so the customer
            can explore without committing to a project. Nex answers using
            what it knows about the merchant + relevant Trade Brain content. */}
        <div className="mt-4">
          <button
            type="button"
            onClick={openAskAboutCompany}
            className="flex w-full items-center gap-2 rounded-2xl border border-black/10 bg-white px-3.5 py-2.5 text-left text-[13px] font-medium text-black/80 shadow-sm transition hover:border-orange-200 hover:bg-orange-50/50"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-neutral-900 text-[11px] font-bold text-white">
              N
            </span>
            <span className="flex-1 leading-tight">
              <span className="block text-black">Ask Nex about {merchantName.split(" ")[0]}</span>
              <span className="mt-0.5 block text-[11px] text-black/50">
                Get answers before you commit to a project
              </span>
            </span>
            <MessageCircle className="h-4 w-4 shrink-0 text-black/40" />
          </button>
        </div>

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

        {/* PRIMARY action row · Start Project (or Continue) · Call · Website
            Philip 2026-08-02: the button no longer says "Nex Chat" — it names
            the OBJECT being created (a Project), which is Nex's differentiator
            vs every other chat app. Continue label surfaces when the customer
            already has an open Project with this merchant. */}
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {/* Philip 2026-08-02 · Project-aware Nex Chat.
              When an open project exists, the primary CTA opens the MODAL
              (not a link to the detail page) so the user immediately sees a
              "Welcome back" greeting that names their existing project and
              offers Continue / View / Ask Nex / Start new. This is First
              Law + Second Law + Fifth Law made visible in the merchant
              chat moment — the "one screen" test. */}
          <button
            type="button"
            onClick={openChatFreeText}
            className="col-span-full flex items-center justify-center gap-2 rounded-full bg-orange-500 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-orange-600 sm:col-span-1"
          >
            <MessageCircle className="h-4 w-4" strokeWidth={2.5} />
            {openProject ? "Continue Project" : "Start Project"}
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
          merchantAvatarUrl={seed.merchant_avatar_url ?? undefined}
          merchantTrade={trade ?? undefined}
          initialPrefill={chatOpen.prefill}
          initialIntent={chatOpen.intent}
          initialAskAboutOnly={chatOpen.askAboutOnly === true}
          existingProject={openProject}
          onProjectCreated={(p) => setOpenProject(p)}
          onNavigateToProject={(pid) => {
            setChatOpen(null);
            router.push(`/nex-app/projects/${pid}`);
          }}
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
// v4 (Philip 2026-08-02) · creates a Project Object on the FIRST send,
// then appends every subsequent turn to that Project. After the first
// send, the modal footer shows a subtle "View project" chip so the
// customer sees their commitment has landed somewhere permanent.
function NexChatModal({
  merchantName,
  merchantId,
  merchantAvatarUrl,
  merchantTrade,
  initialPrefill,
  initialIntent,
  initialAskAboutOnly,
  existingProject,
  onProjectCreated,
  onNavigateToProject,
  onClose,
}: {
  merchantName: string;
  merchantId: string;
  merchantAvatarUrl?: string;
  merchantTrade?: string;
  initialPrefill: string;
  initialIntent: Intent | null;
  initialAskAboutOnly: boolean;
  existingProject: Project | null;
  onProjectCreated: (project: Project) => void;
  onNavigateToProject: (projectId: string) => void;
  onClose: () => void;
}) {
  // Philip 2026-08-02 · Project-aware Nex Chat.
  //
  // When the modal opens and an active project already exists with THIS
  // merchant, we show a "Welcome back" greeting with four choices before
  // the message thread. This is the one screen that demonstrates the
  // Nex philosophy in the merchant chat moment: commitments visible,
  // intent understood, work continued rather than restarted.
  //
  // Greeting is suppressed for chip auto-send flows (the intent is clear
  // and the chip's prefill drives the very first turn straight into the
  // existing project).
  // "Ask Nex about this company" bypasses the project-aware greeting AND
  // starts the conversation in general-chat mode from the first turn.
  const shouldShowGreeting =
    !initialAskAboutOnly &&
    existingProject !== null &&
    initialPrefill.trim().length === 0;

  const [showProjectGreeting, setShowProjectGreeting] = useState(shouldShowGreeting);

  // When true, subsequent sends do NOT create or append to a project —
  // used when the user picked "Ask Nex a general question" from the
  // greeting OR when the modal opened via "Ask Nex about this company."
  const [suppressProjectWrite, setSuppressProjectWrite] = useState(initialAskAboutOnly);

  const [messages, setMessages] = useState<Array<{ role: "user" | "nex"; text: string }>>(() => {
    // Ask Nex about this company · Big Win #3.
    // Opens directly in general-chat mode with a welcoming, non-committal
    // greeting so the customer can explore before starting a project.
    // Philip 2026-08-03 · shortened for mobile · warmer opener.
    if (initialAskAboutOnly) {
      return [
        {
          role: "nex",
          text: `Hi, I'm Nex. I can help you learn about ${merchantName} before you start a project. Ask me anything about their work, materials, or services.`,
        },
      ];
    }

    // Chip auto-send · skip greeting · straight to existing project
    if (initialPrefill.trim().length > 0) return [];

    // Existing project + no chip → greeting handles the initial UI,
    // messages start empty until the user picks a path.
    if (existingProject !== null) return [];

    // First-time chat with this merchant · default warm greeting.
    return [
      {
        role: "nex",
        text: `Hi, I'm Nex. I can help connect you with ${merchantName}. Tell me about your project — what you're looking for, when you need it, and where you're based — and I'll get things started.`,
      },
    ];
  });
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(
    existingProject?.conversation_id ?? null,
  );
  const [projectId, setProjectId] = useState<string | null>(existingProject?.id ?? null);

  // ─── Greeting-button handlers ─────────────────────────────────────
  const handleContinueProject = () => {
    if (!existingProject) return;
    const priorMessages = existingProject.messages
      .filter((m) => m.role === "customer" || m.role === "nex")
      .map((m) => ({
        role: (m.role === "customer" ? "user" : "nex") as "user" | "nex",
        text: m.text,
      }));
    setMessages(priorMessages);
    setShowProjectGreeting(false);
  };

  const handleViewProject = () => {
    if (!existingProject) return;
    onNavigateToProject(existingProject.id);
  };

  const handleGeneralChat = () => {
    setMessages([
      {
        role: "nex",
        text: `Sure — I can answer general questions about ${merchantName}. This chat won't be added to your existing project.`,
      },
    ]);
    setProjectId(null);
    setSuppressProjectWrite(true);
    setShowProjectGreeting(false);
  };

  const handleStartNewRequest = () => {
    setMessages([
      {
        role: "nex",
        text: `Let's start a new project with ${merchantName}. Tell me what this one is about — your other project stays open.`,
      },
    ]);
    setProjectId(null);
    setShowProjectGreeting(false);
  };

  const sendMessage = async (text: string, intentHint: Intent | null) => {
    if (!text.trim() || sending) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setSending(true);

    // Snapshot the current project id so async completion writes to the
    // right project even if state hasn't flushed yet.
    let activeProjectId = projectId;

    // General-chat mode · user picked "Ask Nex a general question."
    // Skip project persistence entirely · this exchange is ephemeral.
    // Philip 2026-08-02 · Project-aware Nex Chat.
    if (suppressProjectWrite) {
      activeProjectId = null;
    }

    // On the FIRST send, materialise a Project Object. Subsequent sends
    // append to the same Project. Intent (from chip prefill) becomes the
    // project title if this is the first send from a chip flow.
    try {
      if (suppressProjectWrite) {
        // no-op — general chat doesn't touch the project store
      } else if (!activeProjectId) {
        // Philip 2026-08-02 · every project starts with a purpose. Auto-
        // compose so no chip flow ships without one; free-text flows use
        // the customer's own first message.
        const purpose = composeStarterPurpose({
          merchantName,
          intent: intentHint ?? undefined,
          firstCustomerMessage: text,
          merchantTrade,
        });
        const created = await createProject({
          merchant_id: merchantId,
          merchant_name: merchantName,
          merchant_avatar_url: merchantAvatarUrl,
          intent: intentHint ?? undefined,
          purpose,
          initial_customer_message: text,
          conversation_id: conversationId ?? undefined,
        });
        activeProjectId = created.id;
        setProjectId(created.id);
        onProjectCreated(created);
      } else {
        await appendMessage(activeProjectId, "customer", text);
      }
    } catch (err) {
      console.error("[merchant-profile][create/append]", err);
      // Project write failed · surface as an in-chat error so the user
      // knows the enquiry didn't persist. The Nex reply below still fires
      // because the merchant-chat endpoint doesn't depend on the Project
      // store.
      setMessages((m) => [
        ...m,
        {
          role: "nex",
          text: "Sorry — I couldn't save your project just now. Please try again in a moment.",
        },
      ]);
      setSending(false);
      return;
    }

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
      if (typeof data?.conversation_id === "string") {
        setConversationId(data.conversation_id);
        if (activeProjectId && !suppressProjectWrite) {
          void updateConversationId(activeProjectId, data.conversation_id);
        }
      }
      setMessages((m) => [...m, { role: "nex", text: reply }]);
      if (activeProjectId && !suppressProjectWrite) {
        void appendMessage(activeProjectId, "nex", reply);
      }
    } catch {
      const errText = "Sorry, I couldn't reach the chat service just now. Try again in a moment.";
      setMessages((m) => [...m, { role: "nex", text: errText }]);
      if (activeProjectId && !suppressProjectWrite) {
        void appendMessage(activeProjectId, "nex", errText);
      }
    } finally {
      setSending(false);
    }
  };

  // Auto-send the prefill message as the user's first turn when the modal
  // was opened from a quick-action chip. Runs once on mount.
  useEffect(() => {
    if (initialPrefill.trim().length > 0 && messages.length === 0) {
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
            <div className="text-sm font-semibold text-black">
              {showProjectGreeting
                ? "Welcome back"
                : suppressProjectWrite
                ? "General chat"
                : projectId
                ? "Project"
                : "New Project"}
            </div>
            <div className="text-[11px] text-black/60">
              With {merchantName} · You · Nex
            </div>
          </div>
          {projectId && !showProjectGreeting && (
            <button
              type="button"
              onClick={() => onNavigateToProject(projectId)}
              className="rounded-full border border-orange-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-orange-800 hover:bg-orange-50"
            >
              View
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-black/50 hover:bg-black/5">✕</button>
        </div>

        {showProjectGreeting && existingProject ? (
          // ─── Project-aware greeting (Philip 2026-08-02) ───────────────
          // "Welcome back. You have an active project with {merchant}.
          //  What would you like to do?"
          // This is the one screen that demonstrates First + Second +
          // Fifth Law in the merchant chat moment.
          <div className="max-h-[65vh] overflow-y-auto bg-white px-4 py-4">
            <p className="text-[13px] leading-relaxed text-black/80">
              You have an active project with {merchantName}:
            </p>

            <div className="mt-3 rounded-2xl border border-orange-200 bg-orange-50 p-3">
              <div className="text-sm font-semibold text-orange-900">
                {existingProject.title}
              </div>
              {existingProject.purpose && (
                <div className="mt-1 text-[12px] leading-snug text-orange-900/80">
                  {existingProject.purpose}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-orange-800">
                <span className="rounded-full bg-white/70 px-2 py-0.5 font-semibold">
                  {PROJECT_STATUS_LABEL[existingProject.status]}
                </span>
                <span className="text-orange-800/70">
                  updated {formatRelativeTime(existingProject.updated_at)}
                </span>
              </div>
            </div>

            <div className="mt-4 text-[13px] font-semibold text-black">
              What would you like to do?
            </div>

            <div className="mt-2 flex flex-col gap-1.5">
              <GreetingChoiceButton onClick={handleContinueProject} primary>
                Continue project
              </GreetingChoiceButton>
              <GreetingChoiceButton onClick={handleViewProject}>
                View project details
              </GreetingChoiceButton>
              <GreetingChoiceButton onClick={handleGeneralChat}>
                Ask Nex a general question
              </GreetingChoiceButton>
              <GreetingChoiceButton onClick={handleStartNewRequest}>
                Start a new request
              </GreetingChoiceButton>
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}

// ─── Freshness label helper (Big Win #3 · Freshness Rule) ────────────
// Returns a short human phrase when the merchant has confirmed their info
// recently. Silent (returns null) when we have no confirmation on file so
// the trust section never implies freshness we can't prove.
function freshnessLabelFor(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const days = Math.max(0, Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000)));
  if (days === 0) return "Confirmed today";
  if (days === 1) return "Confirmed yesterday";
  if (days < 30) return `Confirmed ${days} days ago`;
  if (days < 60) return "Confirmed last month";
  const months = Math.floor(days / 30);
  if (months < 6) return `Confirmed ${months} months ago`;
  return null; // > 6 months · degrade silently; upstream logic will move
               // the merchant to "Needs confirmation" rather than lie here.
}

// ─── Greeting choice button ────────────────────────────────────────────
// One row per choice in the project-aware greeting. Primary variant is
// orange filled (Continue project) · other choices are outlined so the
// visual hierarchy points the user at the expected happy path.
function GreetingChoiceButton({
  children,
  onClick,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  const className = primary
    ? "flex items-center justify-center rounded-full bg-orange-500 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
    : "flex items-center justify-center rounded-full border border-black/10 bg-white py-2.5 text-sm font-medium text-black/80 transition hover:bg-black/[0.03]";
  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}
