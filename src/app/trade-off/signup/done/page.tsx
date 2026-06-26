"use client";

// Post-submit confirmation. Reads slug + token + status from query.
// Shows the live profile link, the magic edit link (with copy-to-clipboard),
// and the "free for life" reassurance. No email required — tradies just
// bookmark this URL.

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { WelcomeKnifePopup } from "@/components/xrated/WelcomeKnifePopup";
import { WELCOME_KNIFE_PRODUCT } from "@/lib/xratedVoucher";

export const dynamic = "force-dynamic";

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
  const editAbsolute =
    typeof window !== "undefined" ? `${window.location.origin}${editPath}` : editPath;
  const profileAbsolute =
    typeof window !== "undefined" ? `${window.location.origin}${profilePath}` : profilePath;
  const profileDisplay = `xratedtrade.com/${slug}`;

  const [copied, setCopied] = useState(false);
  const [profileCopied, setProfileCopied] = useState(false);

  // Expiry shown to the tradie is the same +12 months horizon the API
  // applies, formatted in en-GB for readability (matches the "voucher
  // expires" copy in the dashboard card).
  const expiryDate = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 12);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    });
  })();

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(editAbsolute);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // older browser fallback: select via prompt
      window.prompt("Copy this link and save it somewhere safe:", editAbsolute);
    }
  }

  async function copyProfile() {
    try {
      await navigator.clipboard.writeText(profileAbsolute);
      setProfileCopied(true);
      setTimeout(() => setProfileCopied(false), 2500);
    } catch {
      window.prompt("Copy this URL:", profileAbsolute);
    }
  }

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedHeader />

      {/* Welcome-knife popup auto-opens when a fresh signup carries a voucher
          in the URL. Adds the knife straight to the Hammerex cart so the
          tradie can branch to /cart or back to Xrated in one tap. */}
      {voucher && isLive && (
        <WelcomeKnifePopup
          voucherCode={voucher}
          product={WELCOME_KNIFE_PRODUCT}
          expiryLabel={expiryDate}
        />
      )}

      <section className="mx-auto max-w-2xl px-4 pb-16 pt-12">
        <div
          className={`rounded-2xl border p-6 ${
            isLive
              ? "border-brand-success/40 bg-brand-success/10"
              : "border-brand-line bg-brand-surface/40"
          }`}
        >
          <p
            className={`text-xs font-bold uppercase tracking-widest ${
              isLive ? "text-brand-success" : "text-[#FFB300]"
            }`}
          >
            {isLive
              ? isEdit
                ? "Changes saved · You're live"
                : "You're live on Trade Off"
              : "Saved as draft"}
          </p>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight sm:text-3xl">
            {isLive
              ? "Customers can now find you."
              : "Your draft is safe — finish when you're ready."}
          </h1>
          {!isLive && (
            <p className="mt-3 text-xs text-brand-muted">
              You're missing one or more required fields (name, primary trade,
              city, WhatsApp, email, a short bio, or at least one photo). Use
              the edit link below to finish it off — you'll go live the moment
              everything's filled in.
            </p>
          )}
        </div>

        {/* Public link — the share URL is the star of this page */}
        {isLive && (
          <div className="mt-6 rounded-2xl border-2 border-[#FFB300]/60 bg-[#FFB300]/5 p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-[#FFB300]">
              Your share URL
            </p>
            <p className="mt-2 break-all font-mono text-lg font-bold text-brand-text sm:text-xl">
              {profileDisplay}
            </p>
            <p className="mt-2 text-xs text-brand-muted">
              Screenshot this. Put it on your van. Send it to customers on WhatsApp.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={copyProfile}
                className="h-11 rounded-lg bg-[#FFB300] px-5 text-xs font-bold text-black transition hover:opacity-90"
              >
                {profileCopied ? "Copied!" : "Copy share URL"}
              </button>
              <a
                href={profilePath}
                className="inline-flex h-11 items-center rounded-lg border border-brand-line bg-brand-surface px-5 text-xs font-semibold text-brand-text transition hover:border-[#FFB300]"
              >
                View my profile
              </a>
              <a
                href={`/trade/${slug}/qr.png?download=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center rounded-lg border border-brand-line bg-brand-surface px-5 text-xs font-semibold text-brand-text transition hover:border-[#FFB300]"
              >
                Download QR
              </a>
            </div>
          </div>
        )}

        {/* Edit link */}
        <div className="mt-6 rounded-2xl border border-brand-line bg-brand-surface/40 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#FFB300]">
            Save this link — it's your edit pass
          </p>
          <p className="mt-2 text-xs text-brand-muted">
            We don't email you a password. This link is the only way back into
            your profile. Bookmark it. Send it to yourself on WhatsApp. Keep it
            somewhere safe.
          </p>
          <div className="mt-3 break-all rounded-lg border border-brand-line bg-brand-bg p-3 text-xs text-brand-text">
            {editAbsolute}
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={copyLink}
              className="h-11 rounded-lg bg-[#FFB300] px-5 text-xs font-bold text-black transition hover:opacity-90"
            >
              {copied ? "Copied!" : "Copy edit link"}
            </button>
            <a
              href={editPath}
              className="inline-flex h-11 items-center rounded-lg border border-brand-line bg-brand-surface px-5 text-xs font-semibold text-brand-text transition hover:border-[#FFB300]"
            >
              Open editor now
            </a>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-brand-muted">
          Trade Off is free for life. We use it to introduce you to customers — that's it.
        </p>
      </section>
      <XratedFooter />
    </main>
  );
}

export default function TradeOffSignupDonePage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
