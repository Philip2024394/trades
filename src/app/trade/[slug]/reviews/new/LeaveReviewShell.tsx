"use client";

// The leave-a-review form. Client shell with:
//   - 5-slider category rating (helper text at each level)
//   - Optional trade-specific 6th dimension
//   - Live-computed overall + 72h cool-off warning under 4.0
//   - Written review textarea with 60-char minimum
//   - Job verification radio (job-tag / WhatsApp thread / invoice)
//   - Optional photo upload (mock — real upload wires to Supabase)
//   - Submit → POST /api/reviews/create → success screen
//
// The overall score is DERIVED from the dimensions, never asked
// separately. This is what breaks the bimodal collapse trap where
// everyone just clicks 5 stars on an "overall" question.

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  Star,
  FileCheck2,
  MessageCircle,
  Receipt,
  Camera,
  Clock,
  Sparkles,
  Send,
  CircleAlert,
  Check,
  X as XIcon,
  Loader2,
  ImagePlus
} from "lucide-react";
import {
  REVIEW_DIMENSIONS,
  TRADE_SPECIFIC_DIMENSION,
  overallForReview,
  type ReviewDimensionScores,
  type ReviewJobVerificationKind
} from "@/lib/reviews";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK, BRAND_RED } from "@/lib/brand/tokens";

type Verification = Exclude<ReviewJobVerificationKind, null>;

export function LeaveReviewShell({
  merchantSlug,
  merchantDisplayName,
  merchantTradeLabel,
  merchantTradeSlug,
  merchantCity,
  merchantAvatarUrl,
  merchantHomeHref,
  merchantHomeLabel
}: {
  merchantSlug: string;
  merchantDisplayName: string;
  merchantTradeLabel: string;
  merchantTradeSlug: string;
  merchantCity: string;
  merchantAvatarUrl: string | null;
  /** Server-resolved destination for the merchant's main page —
   *  canteen when they host one, /trade/{slug} legacy path when they
   *  don't. Prevents 404s on mock merchants. */
  merchantHomeHref: string;
  merchantHomeLabel: string;
}) {
  const tradeSpecific = TRADE_SPECIFIC_DIMENSION[merchantTradeSlug];

  const [scores, setScores] = useState<ReviewDimensionScores>({
    quality: 4,
    communication: 4,
    punctuality: 4,
    value: 4,
    cleanliness: 4,
    ...(tradeSpecific ? { trade_specific: 4 } : {})
  });
  const [body, setBody] = useState("");
  const [verification, setVerification] = useState<Verification | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    id: string;
    status: "pending" | "published";
    coolOffActive: boolean;
    publishAt: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const overall = useMemo(() => overallForReview(scores), [scores]);
  const goesToCoolOff = overall < 4.0;
  const bodyLen = body.trim().length;
  const bodyOk = bodyLen >= 60;
  const canSubmit = bodyOk && !!verification && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantSlug,
          scores,
          body: body.trim(),
          jobVerification: { kind: verification },
          photoUrls
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "unknown-error");
        return;
      }
      setResult({
        id: data.id,
        status: data.status,
        coolOffActive: data.coolOffActive,
        publishAt: data.publishAt
      });
    } catch {
      setError("network");
    } finally {
      setSubmitting(false);
    }
  }

  // Success state — full-screen confirmation replaces the form.
  if (result) {
    return (
      <SuccessScreen
        result={result}
        merchantSlug={merchantSlug}
        merchantDisplayName={merchantDisplayName}
        merchantHomeHref={merchantHomeHref}
        merchantHomeLabel={merchantHomeLabel}
      />
    );
  }

  return (
    <div className="pb-16">
      {/* Hero — thin dark banner with merchant identity */}
      <section
        className="relative overflow-hidden border-b"
        style={{ backgroundColor: BRAND_BLACK, borderColor: `${BRAND_YELLOW}33` }}
      >
        <div className="mx-auto max-w-3xl px-3 py-6 md:px-6 md:py-8">
          <Link
            href={`/trade/${merchantSlug}/reviews`}
            className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-400 hover:text-white"
          >
            <ArrowLeft size={11} strokeWidth={2.5}/>
            Back to reviews
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <div
              className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border-2 shadow-lg"
              style={{
                borderColor: BRAND_YELLOW,
                backgroundImage: merchantAvatarUrl ? `url('${merchantAvatarUrl}')` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundColor: !merchantAvatarUrl ? BRAND_YELLOW : undefined
              }}
            >
              {!merchantAvatarUrl && (
                <div className="flex h-full w-full items-center justify-center text-[16px] font-black" style={{ color: BRAND_BLACK }}>
                  {merchantDisplayName.charAt(0)}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="text-[10px] font-black uppercase tracking-[0.24em]"
                style={{ color: BRAND_YELLOW }}
              >
                Leave a review
              </div>
              <h1 className="text-[20px] font-black leading-tight text-white md:text-[24px]">
                {merchantDisplayName}
              </h1>
              <div className="text-[11px] font-bold text-neutral-400">
                {merchantTradeLabel}{merchantCity ? ` · ${merchantCity}` : ""}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-3 pt-6 md:px-6 md:pt-8">
        {/* Trust preamble — honest framing before the sliders. */}
        <div
          className="mb-4 rounded-2xl border p-4 shadow-sm"
          style={{ borderColor: `${BRAND_YELLOW}44`, backgroundColor: `${BRAND_YELLOW}0F` }}
        >
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={12} color={BRAND_GREEN_DARK} strokeWidth={2.5}/>
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-700">
              Honest, verified, protective
            </span>
          </div>
          <p className="mt-1.5 text-[12px] leading-snug text-neutral-700">
            Rate five dimensions, not one star. The overall score is calculated — never asked separately, so nobody clicks 5s to be nice. Ratings under 4★ enter a 72-hour response window so the merchant can resolve issues before publishing.
          </p>
        </div>

        {/* Dimension sliders */}
        <section
          className="mb-4 rounded-2xl border bg-white p-5 shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <div className="mb-3 flex items-center gap-1.5">
            <Sparkles size={12} color={BRAND_BLACK} strokeWidth={2.5}/>
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-700">
              Rate the work
            </span>
          </div>
          <div className="flex flex-col gap-4">
            {REVIEW_DIMENSIONS.filter((d) => d.key !== "trade_specific").map((dim) => (
              <DimensionSlider
                key={dim.key}
                label={dim.label}
                helper={dim.helper}
                scoreCopy={dim.scoreCopy}
                value={scores[dim.key] ?? 4}
                onChange={(v) => setScores((s) => ({ ...s, [dim.key]: v }))}
              />
            ))}
            {tradeSpecific && (
              <DimensionSlider
                label={tradeSpecific.label}
                helper={tradeSpecific.helper}
                scoreCopy={tradeSpecific.scoreCopy}
                value={scores.trade_specific ?? 4}
                onChange={(v) => setScores((s) => ({ ...s, trade_specific: v }))}
                accent
              />
            )}
          </div>

          {/* Live overall — the honest math result. */}
          <div
            className="mt-4 flex items-center justify-between rounded-lg border p-3"
            style={{
              borderColor: goesToCoolOff ? `${BRAND_YELLOW}88` : `${BRAND_GREEN_DARK}66`,
              backgroundColor: goesToCoolOff ? `${BRAND_YELLOW}18` : `${BRAND_GREEN_DARK}0F`
            }}
          >
            <div className="flex items-center gap-1.5">
              <Star size={14} fill={BRAND_YELLOW} color={BRAND_YELLOW} strokeWidth={0}/>
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-700">
                Overall
              </span>
              <span className="text-[18px] font-black tabular-nums text-neutral-900">
                {overall.toFixed(1)}
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                / 5
              </span>
            </div>
            {goesToCoolOff && (
              <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider" style={{ color: "#7A5300" }}>
                <Clock size={11} strokeWidth={2.5}/>
                72h response window
              </div>
            )}
          </div>
        </section>

        {/* Written review */}
        <section
          className="mb-4 rounded-2xl border bg-white p-5 shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <MessageCircle size={12} color={BRAND_BLACK} strokeWidth={2.5}/>
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-700">
                Your review
              </span>
            </div>
            <span
              className="text-[10px] font-black uppercase tracking-wider"
              style={{ color: bodyOk ? BRAND_GREEN_DARK : "#737373" }}
            >
              {bodyLen}/60 min
            </span>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 1000))}
            rows={5}
            placeholder="What went well? What could have been better? Plain words — no salesy fluff. Real trades and real customers read this."
            className="w-full rounded-lg border p-3 text-[13px] leading-relaxed text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2"
            style={{
              borderColor: "rgba(139,69,19,0.20)",
              backgroundColor: "#FAFAFA"
            }}
          />
          <div className="mt-1.5 text-[10px] leading-snug text-neutral-500">
            Written in the same tone you'd use on a WhatsApp voice note. Specific beats generic — "he showed up on time three days running" beats "great service."
          </div>
        </section>

        {/* Job verification */}
        <section
          className="mb-4 rounded-2xl border bg-white p-5 shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <div className="mb-2 flex items-center gap-1.5">
            <FileCheck2 size={12} color={BRAND_BLACK} strokeWidth={2.5}/>
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-700">
              How do you know this merchant?
            </span>
          </div>
          <p className="mb-3 text-[12px] leading-snug text-neutral-600">
            Every review needs a documented interaction. Pick the strongest proof you have — reviews with weaker proof weight less in the aggregate.
          </p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <VerificationCard
              kind="job-tag"
              active={verification === "job-tag"}
              onClick={() => setVerification("job-tag")}
              icon={ShieldCheck}
              title="Verified job"
              subtitle="Merchant + you both tagged the job complete in-app"
              weight="1.5×"
            />
            <VerificationCard
              kind="whatsapp-thread"
              active={verification === "whatsapp-thread"}
              onClick={() => setVerification("whatsapp-thread")}
              icon={MessageCircle}
              title="WhatsApp thread"
              subtitle="Upload an export showing ≥ 3 messages, dated within 90 days"
              weight="1.0×"
            />
            <VerificationCard
              kind="invoice"
              active={verification === "invoice"}
              onClick={() => setVerification("invoice")}
              icon={Receipt}
              title="Invoice"
              subtitle="Upload the merchant's invoice — matching business name required"
              weight="0.5×"
            />
          </div>
        </section>

        {/* Photos — real uploads to /api/uploads → Supabase Storage */}
        <PhotosSection
          photoUrls={photoUrls}
          setPhotoUrls={setPhotoUrls}
          uploading={uploading}
          setUploading={setUploading}
          uploadError={uploadError}
          setUploadError={setUploadError}
        />

        {/* Submit + guardrails */}
        <section
          className="rounded-2xl border-2 p-5 shadow-md"
          style={{
            borderColor: BRAND_YELLOW,
            background: `linear-gradient(135deg, ${BRAND_YELLOW}18 0%, #FFFFFF 60%)`
          }}
        >
          {goesToCoolOff && (
            <div
              className="mb-3 flex items-start gap-2 rounded-lg border p-3"
              style={{ borderColor: `${BRAND_YELLOW}66`, backgroundColor: `${BRAND_YELLOW}22` }}
            >
              <Clock size={14} color="#7A5300" strokeWidth={2.5} className="mt-0.5 flex-shrink-0"/>
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-neutral-900">
                  72-hour response window
                </div>
                <p className="mt-0.5 text-[12px] leading-snug text-neutral-700">
                  Your overall is under 4★. The merchant has 72 hours to respond privately, publicly, or dispute with evidence before this publishes. If they resolve the issue, you can edit or withdraw. This is what makes The Network's reviews trustworthy.
                </p>
              </div>
            </div>
          )}
          {!bodyOk && (
            <div className="mb-3 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-neutral-500">
              <CircleAlert size={11} strokeWidth={2.5}/>
              Add {60 - bodyLen} more character{60 - bodyLen === 1 ? "" : "s"} to the written review
            </div>
          )}
          {!verification && (
            <div className="mb-3 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-neutral-500">
              <CircleAlert size={11} strokeWidth={2.5}/>
              Pick a verification method
            </div>
          )}
          {error && (
            <div className="mb-3 rounded-lg border p-2 text-[11px] text-red-700" style={{ borderColor: "#DC262666", backgroundColor: "#FEF2F2" }}>
              Submission failed: {error}
            </div>
          )}
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="flex h-12 w-full items-center justify-center gap-1.5 rounded-full text-[13px] font-black uppercase tracking-wider text-neutral-900 shadow-md transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: BRAND_YELLOW }}
          >
            <Send size={13} strokeWidth={2.5}/>
            {submitting
              ? "Submitting..."
              : goesToCoolOff
                ? "Submit — starts 72h window"
                : "Publish review"}
          </button>
        </section>
      </div>
    </div>
  );
}

// ─── Slider primitive ─────────────────────────────────

function DimensionSlider({
  label,
  helper,
  scoreCopy,
  value,
  onChange,
  accent = false
}: {
  label: string;
  helper: string;
  scoreCopy: readonly [string, string, string, string, string];
  value: number;
  onChange: (v: number) => void;
  accent?: boolean;
}) {
  const scoreLabel = scoreCopy[Math.max(0, Math.min(4, value - 1))];
  const color = accent ? BRAND_YELLOW : value >= 4 ? BRAND_GREEN_DARK : value >= 3 ? "#F59E0B" : "#DC2626";
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <div>
          <span className="text-[13px] font-black text-neutral-900">{label}</span>
          <span className="ml-1.5 text-[10px] font-bold text-neutral-500">{helper}</span>
        </div>
        <span className="text-[14px] font-black tabular-nums" style={{ color }}>
          {value}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="flex h-9 flex-1 items-center justify-center gap-1 rounded-full border transition"
            style={
              value >= n
                ? { backgroundColor: color, borderColor: color, color: "#FFFFFF" }
                : { backgroundColor: "#FFFFFF", borderColor: "rgba(139,69,19,0.15)", color: "#737373" }
            }
            aria-label={`Score ${n}`}
          >
            <Star size={13} fill={value >= n ? "#FFFFFF" : "none"} strokeWidth={value >= n ? 0 : 2}/>
          </button>
        ))}
      </div>
      <div className="mt-1 text-[10px] font-bold leading-snug text-neutral-600">
        {scoreLabel}
      </div>
    </div>
  );
}

// ─── Verification card primitive ──────────────────────

function VerificationCard({
  active,
  onClick,
  icon: Icon,
  title,
  subtitle,
  weight
}: {
  kind: Verification;
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number | string }>;
  title: string;
  subtitle: string;
  weight: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-1.5 rounded-xl border-2 p-3 text-left transition"
      style={
        active
          ? { borderColor: BRAND_GREEN_DARK, backgroundColor: `${BRAND_GREEN_DARK}0F` }
          : { borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FFFFFF" }
      }
    >
      <div className="flex w-full items-center justify-between">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ backgroundColor: active ? BRAND_GREEN_DARK : `${BRAND_YELLOW}22` }}
        >
          <Icon size={16} color={active ? "#FFFFFF" : BRAND_BLACK} strokeWidth={2}/>
        </div>
        <span
          className="rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
          style={{ backgroundColor: `${BRAND_YELLOW}44`, color: "#7A5300" }}
        >
          {weight}
        </span>
      </div>
      <div className="text-[12px] font-black text-neutral-900">{title}</div>
      <div className="text-[10px] leading-snug text-neutral-600">{subtitle}</div>
    </button>
  );
}

// ─── Success screen ───────────────────────────────────

function SuccessScreen({
  result,
  merchantSlug,
  merchantDisplayName,
  merchantHomeHref,
  merchantHomeLabel
}: {
  result: { id: string; status: "pending" | "published"; coolOffActive: boolean; publishAt: string };
  merchantSlug: string;
  merchantDisplayName: string;
  merchantHomeHref: string;
  merchantHomeLabel: string;
}) {
  return (
    <div className="pb-16">
      <section
        className="relative overflow-hidden border-b"
        style={{ backgroundColor: BRAND_BLACK, borderColor: `${BRAND_YELLOW}33` }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${BRAND_YELLOW}22 0%, transparent 55%), radial-gradient(circle at 70% 70%, ${BRAND_GREEN_DARK}22 0%, transparent 50%)`
          }}
        />
        <div className="relative mx-auto max-w-3xl px-3 py-10 md:px-6 md:py-12">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.24em]"
            style={{ backgroundColor: `${BRAND_GREEN_DARK}44`, color: "#7EE7A5" }}
          >
            <Check size={10} strokeWidth={2.5}/>
            Review received
          </span>
          <h1 className="mt-3 text-[26px] font-black leading-[1.05] text-white md:text-[34px]">
            {result.coolOffActive ? (
              <>
                Thanks. Your review is in the 72h window.
              </>
            ) : (
              <>
                Thanks. Your review is live on {merchantDisplayName}'s profile.
              </>
            )}
          </h1>
          <p className="mt-3 max-w-xl text-[13px] leading-snug text-neutral-300 md:text-[14px]">
            {result.coolOffActive
              ? `Your overall was under 4★, so ${merchantDisplayName} has 72 hours to respond privately, publicly, or dispute with evidence before this publishes. You'll be notified when they respond. If they resolve the issue, you can edit or withdraw.`
              : "It's now visible on their profile and factors into their aggregate rating. Thanks for helping every trade after you."}
          </p>
        </div>
      </section>
      <div className="mx-auto max-w-3xl px-3 pt-6 md:px-6 md:pt-8">
        <div
          className="rounded-2xl border bg-white p-5 shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <div className="mb-2 flex items-center gap-1.5">
            <Sparkles size={12} color={BRAND_BLACK} strokeWidth={2.5}/>
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-700">
              What happens next
            </span>
          </div>
          <ul className="flex flex-col gap-2 text-[12.5px] leading-snug text-neutral-700">
            {result.coolOffActive ? (
              <>
                <li className="flex items-start gap-1.5">
                  <Check size={12} color={BRAND_GREEN_DARK} strokeWidth={2.5} className="mt-0.5 flex-shrink-0"/>
                  {merchantDisplayName} is notified via WhatsApp + email
                </li>
                <li className="flex items-start gap-1.5">
                  <Check size={12} color={BRAND_GREEN_DARK} strokeWidth={2.5} className="mt-0.5 flex-shrink-0"/>
                  They have three response options: private DM to resolve, public reply, or dispute with evidence
                </li>
                <li className="flex items-start gap-1.5">
                  <Check size={12} color={BRAND_GREEN_DARK} strokeWidth={2.5} className="mt-0.5 flex-shrink-0"/>
                  At the 72h mark ({new Date(result.publishAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}), the review publishes with any responses attached
                </li>
                <li className="flex items-start gap-1.5">
                  <Check size={12} color={BRAND_GREEN_DARK} strokeWidth={2.5} className="mt-0.5 flex-shrink-0"/>
                  You can edit or withdraw at any point during the window
                </li>
              </>
            ) : (
              <>
                <li className="flex items-start gap-1.5">
                  <Check size={12} color={BRAND_GREEN_DARK} strokeWidth={2.5} className="mt-0.5 flex-shrink-0"/>
                  Your review is visible on {merchantDisplayName}'s profile immediately
                </li>
                <li className="flex items-start gap-1.5">
                  <Check size={12} color={BRAND_GREEN_DARK} strokeWidth={2.5} className="mt-0.5 flex-shrink-0"/>
                  It's weighted 1.5× if you picked "Verified job", 1.0× for WhatsApp thread, 0.5× for invoice
                </li>
                <li className="flex items-start gap-1.5">
                  <Check size={12} color={BRAND_GREEN_DARK} strokeWidth={2.5} className="mt-0.5 flex-shrink-0"/>
                  Time-decay kicks in after 6 months to keep the aggregate honest
                </li>
              </>
            )}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/trade/${merchantSlug}/reviews`}
              className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[12px] font-black uppercase tracking-wider text-neutral-900 shadow-md"
              style={{ backgroundColor: BRAND_YELLOW }}
            >
              <ArrowLeft size={12} strokeWidth={2.5}/>
              See all reviews for {merchantDisplayName}
            </Link>
            <Link
              href={merchantHomeHref}
              className="inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-[12px] font-black uppercase tracking-wider text-neutral-700 transition hover:bg-white"
              style={{ borderColor: "rgba(139,69,19,0.20)" }}
            >
              Back to their {merchantHomeLabel}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Photos section — real uploads ──────────────────────────
//
// Multipart POST to /api/uploads with ownerKind=reviewer. Server
// runs the tier gate (per-file cap + reviewer 200KB cumulative cap
// for free tier) and returns the public URL. Rejected uploads
// (HTTP 402) surface the tier-gate message inline.

const MAX_PHOTOS = 6;
const PER_FILE_MAX_MB = 5;

function PhotosSection({
  photoUrls,
  setPhotoUrls,
  uploading,
  setUploading,
  uploadError,
  setUploadError
}: {
  photoUrls: string[];
  setPhotoUrls: (v: string[]) => void;
  uploading: boolean;
  setUploading: (v: boolean) => void;
  uploadError: string | null;
  setUploadError: (v: string | null) => void;
}) {
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (photoUrls.length >= MAX_PHOTOS) {
      setUploadError(`Max ${MAX_PHOTOS} photos.`);
      return;
    }
    if (file.size > PER_FILE_MAX_MB * 1024 * 1024) {
      setUploadError(`File too large — max ${PER_FILE_MAX_MB}MB per photo.`);
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "review-photo");
      fd.append("ownerKind", "reviewer");
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setUploadError(data.message ?? data.error ?? "Upload failed.");
        return;
      }
      setPhotoUrls([...photoUrls, data.url]);
    } catch {
      setUploadError("Network error — try again.");
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(url: string) {
    setPhotoUrls(photoUrls.filter((u) => u !== url));
  }

  return (
    <section
      className="mb-4 rounded-2xl border bg-white p-5 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <Camera size={12} color={BRAND_BLACK} strokeWidth={2.5}/>
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-700">
          Photos of the work (optional)
        </span>
        <span className="ml-auto text-[10px] font-black text-neutral-500">
          {photoUrls.length}/{MAX_PHOTOS}
        </span>
      </div>
      <p className="mb-3 text-[12px] leading-snug text-neutral-600">
        Photos add serious trust for the next customer. Job photos, before/after, or the delivered product.
      </p>

      {photoUrls.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {photoUrls.map((url) => (
            <div
              key={url}
              className="relative h-20 w-20 overflow-hidden rounded-lg border shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Uploaded" className="h-full w-full object-cover"/>
              <button
                type="button"
                onClick={() => removePhoto(url)}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black"
                aria-label="Remove photo"
              >
                <XIcon size={11} strokeWidth={2.5}/>
              </button>
            </div>
          ))}
        </div>
      )}

      {photoUrls.length < MAX_PHOTOS && (
        <label
          className="flex h-24 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed text-[12px] font-black uppercase tracking-wider text-neutral-500 transition hover:border-yellow-400 hover:text-neutral-800"
          style={{ borderColor: "rgba(139,69,19,0.20)" }}
        >
          {uploading ? (
            <>
              <Loader2 size={14} strokeWidth={2.5} className="animate-spin"/>
              Uploading…
            </>
          ) : (
            <>
              <ImagePlus size={14} strokeWidth={2.5}/>
              Add photo
            </>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFile}
            disabled={uploading}
            className="hidden"
          />
        </label>
      )}

      {uploadError && (
        <div className="mt-2 rounded-lg border p-2 text-[11px] text-red-700" style={{ borderColor: `${BRAND_RED}66`, backgroundColor: "#FEF2F2" }}>
          <CircleAlert size={11} strokeWidth={2.5} className="mr-1 inline"/>
          {uploadError}
        </div>
      )}
    </section>
  );
}
