"use client";

// Host dashboard for a canteen. Client-side state so the host can edit
// the banner URL, tagline, products, and members and see the changes
// reflect immediately in the mock. When the DB schema lands, each
// section commits via a POST to /api/canteens/[id]/{appearance|products
// |members|settings}.

import { useState, useEffect } from "react";
import Link from "next/link";
import Link from "next/link";
import {
  ArrowLeft,
  Image as ImageIcon,
  Upload,
  Save,
  Plus,
  Trash2,
  Star,
  X as XIcon,
  Users,
  MessageCircle,
  Sparkles,
  Settings,
  ShieldAlert,
  ExternalLink,
  Rocket,
  BookOpen,
  ChevronRight
} from "lucide-react";
import type { Canteen, CanteenMember, CanteenProduct } from "@/lib/canteens";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK, BRAND_RED } from "@/lib/brand/tokens";
import { CANTEEN_ACTIVITY_TARGET, CANTEEN_BOOST_PLANS } from "@/lib/canteens";
import { TOTAL_STORAGE_CAP_BYTES, type MembershipTier } from "@/lib/tierGates";

const CREAM = "#FBF6EC";

export function CanteenManageShell({
  canteen: initialCanteen,
  admin,
  members: initialMembers,
  products: initialProducts
}: {
  canteen: Canteen;
  admin: CanteenMember | null;
  members: CanteenMember[];
  products: CanteenProduct[];
}) {
  const [canteen, setCanteen] = useState<Canteen>(initialCanteen);
  const [products, setProducts] = useState<CanteenProduct[]>(initialProducts);
  const [members, setMembers] = useState<CanteenMember[]>(initialMembers);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const flashSaved = (label: string) => {
    setSavedFlash(label);
    setTimeout(() => setSavedFlash(null), 2500);
  };

  // Stripe redirect return handler — the checkout success_url points
  // back here with ?boost_ok=1&session_id=cs_xxx. Fire the apply
  // endpoint synchronously so the boost lands even if the webhook is
  // delayed (webhook is redundant safety).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("boost_ok") !== "1") return;
    const sessionId = url.searchParams.get("session_id");
    if (!sessionId) return;

    (async () => {
      // Locate the product this session corresponds to via a fresh
      // Stripe session read done on our server (the boost apply
      // endpoint does that internally). We need the product id from
      // the session metadata — the URL doesn't carry it. Simplest
      // path: expose it via a small fetch to /api/boost/session-info,
      // OR trust the checkout endpoint's returned metadata. For now,
      // ping every product in the local state and apply against
      // whichever matches. Small fleet — max ~200 products.
      for (const p of products) {
        const boost = p.boost as { checkoutSessionId?: string } | undefined;
        if (boost?.checkoutSessionId === sessionId) return; // already applied by webhook
      }

      // Fire apply against each product until one succeeds — the
      // endpoint validates the session's product_id against the URL
      // param, so wrong products just 400.
      for (const p of products) {
        const res = await fetch(
          `/api/canteens/${encodeURIComponent(canteen.slug)}/products/${encodeURIComponent(p.id)}/boost`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              planId: url.searchParams.get("plan_id") ?? "boost-30d",
              checkoutSessionId: sessionId
            })
          }
        );
        const data = await res.json();
        if (res.ok && data.ok) {
          setProducts((prev) => prev.map((prod) => prod.id === p.id
            ? { ...prod, boost: { expiresAt: data.expiresAt, paidGbp: 0, checkoutSessionId: sessionId } }
            : prod));
          flashSaved("Boost activated");
          break;
        }
      }

      // Clean the URL so a page refresh doesn't re-fire.
      url.searchParams.delete("boost_ok");
      url.searchParams.delete("session_id");
      url.searchParams.delete("plan_id");
      window.history.replaceState({}, "", url.pathname + (url.search ? `?${url.searchParams.toString()}` : ""));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen" style={{ backgroundColor: CREAM }}>
      {/* Sticky manage header */}
      <div
        className="sticky top-0 z-30 border-b backdrop-blur"
        style={{
          backgroundColor: "rgba(251,246,236,0.96)",
          borderColor: "rgba(139,69,19,0.15)"
        }}
      >
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-3 py-3 sm:px-6">
          <Link
            href={`/trade-off/yard/canteens/${canteen.slug}`}
            className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border bg-white text-neutral-700 transition hover:bg-neutral-50"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
            aria-label="Back to canteen"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
              Host dashboard
            </div>
            <div className="truncate text-[15px] font-black text-neutral-900 sm:text-[17px]">
              Manage · {canteen.name}
            </div>
          </div>
          {savedFlash && (
            <div
              className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-black uppercase tracking-wider text-white shadow-md"
              style={{ backgroundColor: BRAND_GREEN_DARK }}
            >
              <Save size={11} strokeWidth={2.5} />
              {savedFlash}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-3 pb-16 pt-4 sm:px-6 sm:pt-6">
        {/* Notebook entry — the merchant's private business feed. Sits
            at the top so the host can jump straight to today's leads
            and reviews without hunting through the manage sections. */}
        <NotebookEntryCard hostSlug={canteen.hostSlug} />

        {/* Activity + F100 */}
        <ActivitySection canteen={canteen} />

        {/* Storage meter — proves the tier gate + shows upgrade lever */}
        <StorageMeterSection />


        {/* Appearance */}
        <AppearanceSection
          canteen={canteen}
          onChange={setCanteen}
          onSaved={() => flashSaved("Appearance saved")}
        />

        {/* Products */}
        <ProductsSection
          canteenSlug={canteen.slug}
          products={products}
          onChange={setProducts}
          onSaved={(label) => flashSaved(label)}
        />

        {/* Members */}
        <MembersSection
          members={members}
          adminSlug={admin?.slug ?? ""}
          onChange={setMembers}
          onSaved={(label) => flashSaved(label)}
        />

        {/* Settings */}
        <SettingsSection canteen={canteen} onChange={setCanteen} onSaved={() => flashSaved("Settings saved")} />
      </div>
    </main>
  );
}

// ─── Notebook entry ─────────────────────────────
//
// Prominent yellow-bordered card at the top of the manage dashboard
// pointing to the merchant's private Notebook. Kept out of the
// section header nav (this file's sections structure) because the
// Notebook lives on a separate route — this card is the bridge.

function NotebookEntryCard({ hostSlug }: { hostSlug: string }) {
  return (
    <Link
      href={`/trade-off/notebook/${hostSlug}`}
      className="mb-6 flex items-center gap-3 rounded-2xl border-2 p-4 shadow-md transition hover:-translate-y-0.5"
      style={{
        borderColor: BRAND_YELLOW,
        background: `linear-gradient(135deg, ${BRAND_YELLOW}22 0%, #FFFFFF 60%)`
      }}
    >
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: BRAND_YELLOW }}
      >
        <BookOpen size={18} color={BRAND_BLACK} strokeWidth={2}/>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-700">
          Your Notebook
        </div>
        <div className="text-[14px] font-black leading-tight text-neutral-900">
          Every lead, review, canteen mention, product view in one feed.
        </div>
        <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
          Private by design — only you see this. Actions needed float to the top with a 72-hour countdown.
        </p>
      </div>
      <ChevronRight size={16} color={BRAND_BLACK} strokeWidth={2.5} className="flex-shrink-0"/>
    </Link>
  );
}

// ─── Activity + F100 progress ──────────────────

function ActivitySection({ canteen }: { canteen: Canteen }) {
  const monthTargetHit = Math.min(canteen.postsLast30d, CANTEEN_ACTIVITY_TARGET.postsPerMonth);
  const pct = Math.round((monthTargetHit / CANTEEN_ACTIVITY_TARGET.postsPerMonth) * 100);
  return (
    <section className="mb-4 rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
      <SectionHeader icon={Sparkles} label="Activity · Founding 100 progress" />
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Stat
          label="Members"
          value={String(canteen.memberCount)}
          hint="Across the canteen"
        />
        <Stat
          label="Posts / 30 days"
          value={`${canteen.postsLast30d} / ${CANTEEN_ACTIVITY_TARGET.postsPerMonth}`}
          hint={`${pct}% of monthly target`}
        />
        <Stat
          label="Streak"
          value={`${canteen.activityStreakMonths}mo`}
          hint={`Need ${CANTEEN_ACTIVITY_TARGET.months}mo for free app`}
        />
      </div>
      {/* Progress bar */}
      <div className="mt-3">
        <div className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
          F100 free-topic-app unlock
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full transition-all"
            style={{
              width: `${Math.min(100, (canteen.activityStreakMonths / CANTEEN_ACTIVITY_TARGET.months) * 100)}%`,
              backgroundColor: BRAND_YELLOW
            }}
          />
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-neutral-600">
          Hit 50 posts/month for 3 months in a row and your canteen unlocks the topic app for 12 months on us. Quality-weighted — posts with 3+ reactions count double.
        </p>
      </div>
    </section>
  );
}

/** Storage meter — reads the viewer's tier + current usage (mock for
 *  now) and renders a bar with the upgrade lever when close to the cap.
 *  Wire the current-bytes value to a real Supabase query when the
 *  schema lands. */
function StorageMeterSection() {
  // Mock: free tier with 62% of the 200 KB cap used.
  const tier: MembershipTier = "free";
  const capBytes = TOTAL_STORAGE_CAP_BYTES[tier];
  const usedBytes = Math.round(capBytes * 0.62);
  const pct = Math.min(100, Math.round((usedBytes / capBytes) * 100));
  const nearLimit = pct >= 75;
  const tierLabel = tier === "free" ? "Free" : tier === "pro" ? "Network Pro" : "Premium";
  const fmt = (bytes: number) =>
    bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB`
      : bytes < 1024 * 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
        : `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  return (
    <section
      className="mb-4 rounded-xl border bg-white p-4 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <SectionHeader icon={ImageIconGrey} label={`Storage · ${tierLabel} tier`} />
      <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-600">
        <span>
          Used <span className="font-black text-neutral-900">{fmt(usedBytes)}</span> of {fmt(capBytes)}
        </span>
        <span className="font-black uppercase tracking-wider" style={{ color: nearLimit ? BRAND_RED : BRAND_GREEN_DARK }}>
          {pct}%
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: nearLimit ? BRAND_RED : BRAND_YELLOW
          }}
        />
      </div>
      {tier === "free" ? (
        <div
          className="mt-3 flex items-start gap-2 rounded-lg border p-2.5"
          style={{ borderColor: `${BRAND_YELLOW}66`, backgroundColor: `${BRAND_YELLOW}0F` }}
        >
          <Sparkles size={13} className="mt-0.5 flex-shrink-0" color={BRAND_BLACK}/>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-black text-neutral-900">
              Upgrade to Network Pro · £14.99/mo → 5 GB storage
            </div>
            <div className="mt-0.5 text-[11px] leading-snug text-neutral-600">
              Unlock canteen images, video posts, product listings on The Counter, and every paid app in the Warehouse — all included.
            </div>
            <button
              className="mt-2 inline-flex h-8 items-center gap-1 rounded-full px-3 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-sm"
              style={{ backgroundColor: BRAND_YELLOW }}
            >
              Start free trial
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 text-[10px] leading-snug text-neutral-500">
          Inactive uploads older than 6 months auto-archive to cold storage to keep costs down. Reactivate on demand.
        </div>
      )}
    </section>
  );
}

// A small greyed icon so we can reuse Image without conflicting.
function ImageIconGrey({ size = 13 }: { size?: number }) {
  return <ImageIcon size={size} className="text-neutral-500" />;
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-2.5">
      <div className="text-[9px] font-black uppercase tracking-[0.22em] text-neutral-500">{label}</div>
      <div className="mt-0.5 text-[18px] font-black leading-none text-neutral-900">{value}</div>
      <div className="mt-1 text-[10px] leading-tight text-neutral-500">{hint}</div>
    </div>
  );
}

// ─── Appearance ──────────────────

function AppearanceSection({
  canteen,
  onChange,
  onSaved
}: {
  canteen: Canteen;
  onChange: (c: Canteen) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(canteen.name);
  const [tagline, setTagline] = useState(canteen.tagline);
  const [bannerUrl, setBannerUrl] = useState(canteen.headerBgUrl ?? "");

  const save = () => {
    onChange({ ...canteen, name, tagline, headerBgUrl: bannerUrl || null });
    onSaved();
  };

  return (
    <section className="mb-4 rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
      <SectionHeader icon={ImageIcon} label="Appearance · Banner and tagline" />

      {/* Live preview of the banner + overlay */}
      <div className="mt-3 overflow-hidden rounded-lg">
        <div
          className="relative h-32 w-full sm:h-40"
          style={{
            backgroundColor: BRAND_BLACK,
            backgroundImage: bannerUrl ? `url('${bannerUrl}')` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center"
          }}
        >
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.10) 40%, rgba(0,0,0,0.75) 100%)" }}
          />
          <div className="absolute inset-x-0 bottom-0 p-3">
            <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>
              Preview
            </div>
            <div className="text-[17px] font-black leading-tight text-white drop-shadow-md sm:text-[20px]">
              {name || "Canteen name"}
            </div>
            <div className="text-[11px] leading-snug text-white/85">{tagline || "Canteen tagline appears here."}</div>
          </div>
        </div>
      </div>

      {/* Editable fields */}
      <div className="mt-3 grid grid-cols-1 gap-3">
        <Field label="Canteen name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-[13px] focus:outline-none focus:border-yellow-400"
          />
        </Field>
        <Field label="Tagline (overlay text)">
          <textarea
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            rows={2}
            maxLength={160}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-[13px] focus:outline-none focus:border-yellow-400"
            style={{ resize: "none" }}
          />
        </Field>
        <Field label="Banner image URL" hint="ImageKit / Supabase URL. Auto-treated with a dark gradient overlay so uploaded photos can never ruin the look.">
          <div className="flex gap-2">
            <input
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              placeholder="https://ik.imagekit.io/…"
              className="h-11 min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-3 text-[13px] focus:outline-none focus:border-yellow-400"
            />
            <button
              type="button"
              className="inline-flex h-11 flex-shrink-0 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 text-[11px] font-black uppercase tracking-wider text-neutral-700 transition hover:bg-neutral-50"
              title="Upload flow lands with the schema"
            >
              <Upload size={12} strokeWidth={2.5} />
              Upload
            </button>
          </div>
        </Field>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={save}
          className="inline-flex h-11 items-center gap-1.5 rounded-full px-5 text-[13px] font-black uppercase tracking-wider text-neutral-900 shadow-md transition active:scale-[0.97]"
          style={{ backgroundColor: BRAND_YELLOW }}
        >
          <Save size={13} strokeWidth={2.5} />
          Save appearance
        </button>
      </div>
    </section>
  );
}

// ─── Products ──────────────────

function ProductsSection({
  canteenSlug,
  products,
  onChange,
  onSaved
}: {
  canteenSlug: string;
  products: CanteenProduct[];
  onChange: (p: CanteenProduct[]) => void;
  onSaved: (label: string) => void;
}) {
  const promoteToCounter = async (p: CanteenProduct) => {
    const confirmMsg = `Promote "${p.name}" to The Counter? Every canteen on The Network will see this listing.`;
    if (!window.confirm(confirmMsg)) return;
    try {
      const res = await fetch(`/api/canteens/${encodeURIComponent(canteenSlug)}/posts/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "counter",
          body: `${p.name} · ${p.blurb ?? ""}`.slice(0, 200),
          photoUrls: p.imageUrl ? [p.imageUrl] : [],
          priceGbp: p.priceGbp,
          currency: "GBP"
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        onSaved(`Promote failed: ${data.error ?? "unknown"}`);
        return;
      }
      onSaved(`Live on The Counter · ${p.name}`);
    } catch {
      onSaved("Promote failed — network error");
    }
  };
  const featuredCount = products.filter((p) => p.featured).length;
  const [addOpen, setAddOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftBlurb, setDraftBlurb] = useState("");
  const [draftPrice, setDraftPrice] = useState("");
  const [draftImage, setDraftImage] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftFeatured, setDraftFeatured] = useState(false);
  const [draftTradeCenter, setDraftTradeCenter] = useState("");

  const resetDraft = () => {
    setDraftName("");
    setDraftBlurb("");
    setDraftPrice("");
    setDraftImage("");
    setDraftDesc("");
    setDraftFeatured(false);
    setDraftTradeCenter("");
  };

  const priceNum = Number(draftPrice);
  const canAdd = draftName.trim().length >= 2 && priceNum > 0 && draftImage.trim().length > 0;

  const commitAdd = () => {
    if (!canAdd) return;
    const canteenId = products[0]?.canteenId ?? "cant_unknown";
    const hostSlug = products[0]?.hostSlug ?? "demo-mike-watson-drywall-manchester";
    const newProduct: CanteenProduct = {
      id: `prod_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      canteenId,
      hostSlug,
      name: draftName.trim(),
      imageUrl: draftImage.trim(),
      priceGbp: priceNum,
      blurb: draftBlurb.trim() || `£${priceNum} · Trade price`,
      description: draftDesc.trim() || draftBlurb.trim() || draftName.trim(),
      featured: draftFeatured,
      tradeCenterListingId: draftTradeCenter.trim() || undefined
    };
    onChange([...products, newProduct]);
    onSaved("Product added");
    resetDraft();
    setAddOpen(false);
  };

  const toggleFeatured = (id: string) => {
    onChange(products.map((p) => p.id === id ? { ...p, featured: !p.featured } : p));
    onSaved("Product updated");
  };
  const removeProduct = (id: string) => {
    if (!window.confirm("Remove this product from the canteen?")) return;
    onChange(products.filter((p) => p.id !== id));
    onSaved("Product removed");
  };

  const [boostFor, setBoostFor] = useState<string | null>(null);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const applyBoost = async (productId: string, planId: string) => {
    if (checkoutPending) return;
    setCheckoutPending(true);
    try {
      const res = await fetch("/api/boost/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, canteenSlug, productId })
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.url) {
        onSaved(`Boost checkout failed: ${data.error ?? "unknown"}`);
        return;
      }
      // Hosted redirect — Stripe handles the payment, on success the
      // customer lands back at /manage?boost_ok=1&session_id=... where
      // BoostReturnHandler fires the apply.
      window.location.href = data.url;
    } catch {
      onSaved("Boost checkout failed — network error");
    } finally {
      setCheckoutPending(false);
    }
  };
  const cancelBoost = async (productId: string) => {
    if (!window.confirm("Cancel this boost? Remaining days won't be refunded.")) return;
    try {
      const res = await fetch(
        `/api/canteens/${encodeURIComponent(canteenSlug)}/products/${encodeURIComponent(productId)}/boost`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        onSaved(`Cancel failed: ${data.error ?? "unknown"}`);
        return;
      }
      onChange(products.map((p) => p.id === productId ? { ...p, boost: undefined } : p));
      onSaved("Boost cancelled");
    } catch {
      onSaved("Cancel failed — network error");
    }
  };
  const isBoostActive = (p: CanteenProduct) =>
    !!p.boost && new Date(p.boost.expiresAt).getTime() > Date.now();
  const daysLeftOnBoost = (p: CanteenProduct): number => {
    if (!p.boost) return 0;
    const diff = new Date(p.boost.expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
  };

  return (
    <section className="mb-4 rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
      <SectionHeader
        icon={Star}
        label={`Products · ${products.length} total · ${featuredCount} featured`}
      />
      <p className="mt-1 text-[11.5px] leading-snug text-neutral-600">
        Pin up to 5 products to the canteen showcase. Products auto-syndicate to the platform-wide The Counter. Trade-Center-linked SKUs get a "Buy on Trade Center" button on the product-focus view.
      </p>

      <ul className="mt-3 flex flex-col gap-2">
        {products.map((p) => {
          const boostActive = isBoostActive(p);
          const boostDays = daysLeftOnBoost(p);
          return (
            <li
              key={p.id}
              className="rounded-lg border shadow-sm"
              style={{
                borderColor: boostActive ? `${BRAND_GREEN_DARK}66` : "rgba(139,69,19,0.12)",
                backgroundColor: boostActive ? `${BRAND_GREEN_DARK}0F` : "#FFFFFF"
              }}
            >
              <div className="flex items-center gap-3 p-2.5">
                <div
                  className="h-14 w-14 flex-shrink-0 rounded-md"
                  style={{
                    backgroundImage: `url('${p.imageUrl}')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundColor: "#F3F4F6"
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className="truncate text-[13px] font-black text-neutral-900">{p.name}</div>
                    {p.tradeCenterListingId && (
                      <ExternalLink size={11} className="flex-shrink-0 text-neutral-400" />
                    )}
                    {boostActive && (
                      <span
                        className="ml-1 flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[8px] font-black uppercase tracking-wider text-white shadow-sm"
                        style={{ backgroundColor: BRAND_GREEN_DARK }}
                      >
                        <Rocket size={8} strokeWidth={2.5}/>
                        Boosted · {boostDays}d left
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-neutral-500">{p.blurb}</div>
                  <div className="mt-0.5 text-[11px] font-black text-neutral-900">£{p.priceGbp}</div>
                </div>
                <div className="flex flex-shrink-0 flex-col gap-1">
                  <button
                    onClick={() => toggleFeatured(p.id)}
                    className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[10px] font-black uppercase tracking-wider shadow-sm"
                    style={
                      p.featured
                        ? { backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }
                        : { backgroundColor: "#F3F4F6", color: "#525252" }
                    }
                  >
                    <Star size={10} fill={p.featured ? BRAND_BLACK : "none"}/>
                    {p.featured ? "Featured" : "Feature"}
                  </button>
                  {boostActive ? (
                    <button
                      onClick={() => cancelBoost(p.id)}
                      className="inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-[10px] font-black uppercase tracking-wider transition hover:bg-red-50"
                      style={{ borderColor: `${BRAND_RED}66`, color: BRAND_RED }}
                      title="Cancel boost early (no refund for remaining days)"
                    >
                      <XIcon size={10}/>
                      Cancel boost
                    </button>
                  ) : (
                    <button
                      onClick={() => setBoostFor(boostFor === p.id ? null : p.id)}
                      className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[10px] font-black uppercase tracking-wider text-white shadow-sm"
                      style={{ backgroundColor: BRAND_GREEN_DARK }}
                    >
                      <Rocket size={10} strokeWidth={2.5}/>
                      Boost
                    </button>
                  )}
                  <button
                    onClick={() => promoteToCounter(p)}
                    className="inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-[10px] font-black uppercase tracking-wider transition hover:bg-neutral-50"
                    style={{ borderColor: `${BRAND_YELLOW}88`, color: BRAND_BLACK, backgroundColor: `${BRAND_YELLOW}22` }}
                    title="Promote this product to The Counter across every canteen"
                  >
                    <Sparkles size={10} strokeWidth={2.5}/>
                    Counter
                  </button>
                  <button
                    onClick={() => removeProduct(p.id)}
                    className="inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-[10px] font-black uppercase tracking-wider transition hover:bg-red-50"
                    style={{ borderColor: `${BRAND_RED}66`, color: BRAND_RED }}
                  >
                    <Trash2 size={10} />
                    Remove
                  </button>
                </div>
              </div>

              {/* Boost plan picker — slides open under the product row */}
              {boostFor === p.id && (
                <div
                  className="border-t p-3"
                  style={{ borderColor: `${BRAND_GREEN_DARK}22`, backgroundColor: `${BRAND_GREEN_DARK}0F` }}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: BRAND_GREEN_DARK }}>
                      Choose a boost plan
                    </div>
                    <button
                      onClick={() => setBoostFor(null)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50"
                      aria-label="Close"
                    >
                      <XIcon size={11} strokeWidth={2.5}/>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {CANTEEN_BOOST_PLANS.map((plan) => (
                      <button
                        key={plan.id}
                        onClick={() => applyBoost(p.id, plan.id)}
                        className="flex flex-col items-start gap-1 rounded-lg border bg-white p-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        style={{ borderColor: `${BRAND_GREEN_DARK}44` }}
                      >
                        <div className="text-[11px] font-black uppercase tracking-wider text-neutral-800">
                          {plan.label}
                        </div>
                        <div className="text-[16px] font-black text-neutral-900">
                          £{plan.priceGbp}
                        </div>
                        <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: BRAND_GREEN_DARK }}>
                          {plan.reach === "all-canteens" ? "All canteens" : "Trade-targeted"}
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] leading-snug text-neutral-500">
                    Boosted products float above organic Counter posts across every canteen (or every canteen matching your trade tags for shorter plans). Billed via your Network Pro subscription — no separate payment.
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {addOpen ? (
        <div
          className="mt-3 rounded-lg border-2 border-dashed p-3"
          style={{ borderColor: BRAND_YELLOW, backgroundColor: `${BRAND_YELLOW}0F` }}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-700">
              New product
            </div>
            <button
              onClick={() => { resetDraft(); setAddOpen(false); }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 transition hover:bg-neutral-50"
              aria-label="Close"
            >
              <XIcon size={12} strokeWidth={2.5}/>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name *">
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                maxLength={80}
                placeholder="e.g. Solid Oak Worktop 40mm"
                className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-[13px] focus:outline-none focus:border-yellow-400"
              />
            </Field>
            <Field label="Price GBP *">
              <input
                type="number"
                inputMode="numeric"
                value={draftPrice}
                onChange={(e) => setDraftPrice(e.target.value)}
                min={1}
                placeholder="120"
                className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-[13px] focus:outline-none focus:border-yellow-400"
              />
            </Field>
            <Field label="Image URL *" hint="ImageKit / Supabase URL. Any square-ish image works.">
              <input
                value={draftImage}
                onChange={(e) => setDraftImage(e.target.value)}
                placeholder="https://ik.imagekit.io/…"
                className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-[13px] focus:outline-none focus:border-yellow-400"
              />
            </Field>
            <Field label="Trade Center listing ID (optional)" hint="If this SKU is dual-listed on Trade Center, paste the listing ID.">
              <input
                value={draftTradeCenter}
                onChange={(e) => setDraftTradeCenter(e.target.value)}
                placeholder="prod_xxx"
                className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-[13px] focus:outline-none focus:border-yellow-400"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Blurb" hint="One-line teaser shown on the product tile (max 80 chars).">
                <input
                  value={draftBlurb}
                  onChange={(e) => setDraftBlurb(e.target.value)}
                  maxLength={80}
                  placeholder="Cut to size, oiled, delivered NW · £120/lm"
                  className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-[13px] focus:outline-none focus:border-yellow-400"
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Description" hint="Full detail shown on the product-focus view.">
                <textarea
                  value={draftDesc}
                  onChange={(e) => setDraftDesc(e.target.value)}
                  rows={3}
                  placeholder="40mm European oak, kiln-dried, pre-finished with Osmo…"
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-[13px] focus:outline-none focus:border-yellow-400"
                  style={{ resize: "none" }}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white p-2.5 sm:col-span-2">
              <input
                type="checkbox"
                checked={draftFeatured}
                onChange={(e) => setDraftFeatured(e.target.checked)}
                className="h-4 w-4"
              />
              <div>
                <div className="text-[12px] font-black text-neutral-900">Pin as featured</div>
                <div className="text-[10px] text-neutral-500">Featured products appear in the canteen product panel + syndicate to the platform The Counter.</div>
              </div>
            </label>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => { resetDraft(); setAddOpen(false); }}
              className="h-10 rounded-full border border-neutral-200 bg-white px-4 text-[11px] font-black uppercase tracking-wider text-neutral-700"
            >
              Cancel
            </button>
            <button
              onClick={commitAdd}
              disabled={!canAdd}
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-[12px] font-black uppercase tracking-wider text-neutral-900 shadow-md transition disabled:opacity-40 sm:flex-none sm:px-5"
              style={{ backgroundColor: BRAND_YELLOW }}
            >
              <Plus size={13} strokeWidth={2.5} />
              Add product
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddOpen(true)}
          className="mt-3 inline-flex h-11 items-center gap-1.5 rounded-full border-2 border-dashed px-4 text-[12px] font-black uppercase tracking-wider text-neutral-800 transition hover:bg-neutral-50"
          style={{ borderColor: `${BRAND_YELLOW}` }}
        >
          <Plus size={14} strokeWidth={2.5} />
          Add product
        </button>
      )}
    </section>
  );
}

// ─── Members ──────────────────

function MembersSection({
  members,
  adminSlug,
  onChange,
  onSaved
}: {
  members: CanteenMember[];
  adminSlug: string;
  onChange: (m: CanteenMember[]) => void;
  onSaved: (label: string) => void;
}) {
  const promote = (slug: string) => {
    onChange(members.map((m) => m.slug === slug ? { ...m, role: "moderator" } : m));
    onSaved("Member promoted");
  };
  const demote = (slug: string) => {
    onChange(members.map((m) => m.slug === slug ? { ...m, role: "member" } : m));
    onSaved("Member demoted");
  };
  const kick = (slug: string) => {
    if (!window.confirm("Remove this member from the canteen?")) return;
    onChange(members.filter((m) => m.slug !== slug));
    onSaved("Member removed");
  };

  return (
    <section className="mb-4 rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
      <SectionHeader icon={Users} label={`Members · ${members.length}`} />
      <ul className="mt-3 flex flex-col gap-1.5">
        {members.map((m) => {
          const isHost = m.slug === adminSlug;
          return (
            <li
              key={m.slug}
              className="flex items-center gap-2.5 rounded-lg border p-2 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.12)" }}
            >
              <div
                className="h-9 w-9 flex-shrink-0 rounded-full border-2 shadow-sm"
                style={{
                  borderColor: m.role === "admin" ? BRAND_YELLOW : "#FFFFFF",
                  backgroundImage: m.avatarUrl ? `url('${m.avatarUrl}')` : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundColor: !m.avatarUrl ? BRAND_YELLOW : undefined
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-black text-neutral-900">
                  {m.displayName}
                  {isHost && (
                    <span className="ml-1 rounded-sm bg-yellow-400 px-1 text-[8px] font-black uppercase tracking-wider text-neutral-900">
                      Host
                    </span>
                  )}
                  {m.role === "moderator" && (
                    <span className="ml-1 rounded-sm bg-slate-800 px-1 text-[8px] font-black uppercase tracking-wider text-white">
                      Mod
                    </span>
                  )}
                </div>
                <div className="truncate text-[10px] font-bold text-neutral-500">
                  {m.tradeLabel} · {m.city}
                </div>
              </div>
              {!isHost && (
                <div className="flex flex-shrink-0 gap-1">
                  {m.role === "moderator" ? (
                    <button
                      onClick={() => demote(m.slug)}
                      className="inline-flex h-8 items-center rounded-full border border-neutral-200 bg-white px-2.5 text-[10px] font-black uppercase tracking-wider text-neutral-700 transition hover:bg-neutral-50"
                    >
                      Demote
                    </button>
                  ) : (
                    <button
                      onClick={() => promote(m.slug)}
                      className="inline-flex h-8 items-center rounded-full border border-neutral-200 bg-white px-2.5 text-[10px] font-black uppercase tracking-wider text-neutral-700 transition hover:bg-neutral-50"
                    >
                      Make mod
                    </button>
                  )}
                  <button
                    onClick={() => kick(m.slug)}
                    className="inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-[10px] font-black uppercase tracking-wider transition hover:bg-red-50"
                    style={{ borderColor: `${BRAND_RED}66`, color: BRAND_RED }}
                  >
                    <XIcon size={10} strokeWidth={2.5}/>
                    Kick
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ─── Settings ──────────────────

function SettingsSection({
  canteen,
  onChange,
  onSaved
}: {
  canteen: Canteen;
  onChange: (c: Canteen) => void;
  onSaved: () => void;
}) {
  const [tradeSlug, setTradeSlug] = useState(canteen.tradeSlug);
  const [tradeLabel, setTradeLabel] = useState(canteen.tradeLabel);
  const [autoSyndicate, setAutoSyndicate] = useState(true);

  const save = () => {
    onChange({ ...canteen, tradeSlug, tradeLabel });
    onSaved();
  };

  return (
    <section className="mb-4 rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
      <SectionHeader icon={Settings} label="Settings" />
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Trade tag slug">
          <input
            value={tradeSlug}
            onChange={(e) => setTradeSlug(e.target.value)}
            className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-[13px] focus:outline-none focus:border-yellow-400"
          />
        </Field>
        <Field label="Trade tag label">
          <input
            value={tradeLabel}
            onChange={(e) => setTradeLabel(e.target.value)}
            className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-[13px] focus:outline-none focus:border-yellow-400"
          />
        </Field>
      </div>

      {/* Syndication toggle */}
      <label className="mt-3 flex items-start gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
        <input
          type="checkbox"
          checked={autoSyndicate}
          onChange={(e) => setAutoSyndicate(e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-shrink-0"
        />
        <div>
          <div className="text-[12px] font-black text-neutral-900">Auto-syndicate to platform The Counter</div>
          <div className="mt-0.5 text-[11px] leading-snug text-neutral-600">
            Every product and marketplace post you list flows into the platform-wide The Counter, visible on every canteen page. Turn off to keep this canteen's content siloed (not recommended — kills discovery).
          </div>
        </div>
      </label>

      {/* Danger zone */}
      <div className="mt-4 rounded-lg border border-dashed p-3" style={{ borderColor: `${BRAND_RED}66` }}>
        <div className="flex items-start gap-2">
          <ShieldAlert size={14} className="mt-0.5 flex-shrink-0" color={BRAND_RED} strokeWidth={2.5}/>
          <div>
            <div className="text-[12px] font-black" style={{ color: BRAND_RED }}>Danger zone</div>
            <div className="mt-0.5 text-[11px] leading-snug text-red-800">
              Archiving a canteen freezes the feed, The Counter, and product panel. Members can still see it read-only. This action is reversible.
            </div>
            <button
              className="mt-2 inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[10px] font-black uppercase tracking-wider transition hover:bg-red-50"
              style={{ borderColor: BRAND_RED, color: BRAND_RED }}
            >
              Archive canteen
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={save}
          className="inline-flex h-11 items-center gap-1.5 rounded-full px-5 text-[13px] font-black uppercase tracking-wider text-neutral-900 shadow-md transition active:scale-[0.97]"
          style={{ backgroundColor: BRAND_YELLOW }}
        >
          <Save size={13} strokeWidth={2.5} />
          Save settings
        </button>
      </div>
    </section>
  );
}

// ─── Shared bits ──────────────────

function SectionHeader({
  icon: Icon,
  label
}: {
  icon: typeof Users;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon size={13} className="text-neutral-500" />
      <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-700">
        {label}
      </span>
    </div>
  );
}

function Field({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
        {label}
      </div>
      {children}
      {hint && <div className="mt-1 text-[10px] leading-snug text-neutral-500">{hint}</div>}
    </div>
  );
}
