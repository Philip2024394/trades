// BeaconClaimsSection — inbox surface for the 3-tier beacon system.
//
// Renders every beacon claim assigned to this merchant, grouped by
// status:
//   • assigned  → live SLA countdown + "Message customer" CTA (claim → washer deducts → WhatsApp)
//   • claimed   → confirmation strip with the WhatsApp handoff already fired
//   • timed_out → grey "expired" state, message body still visible (Philip's FOMO signal)
//
// Server passes the pre-loaded rows + the merchant's slug + edit
// token (needed to POST the claim endpoint).

"use client";

import { useEffect, useState } from "react";
import { Clock, MessageCircle, XCircle, CheckCircle2 } from "lucide-react";
import { BeaconClaimComposeModal } from "./BeaconClaimComposeModal";

export type BeaconClaimRow = {
  id:              string;
  beaconId:        string;
  status:          "assigned" | "claimed" | "timed_out" | "expired";
  assignedAt:      string;
  slaExpiresAt:    string;
  claimedAt:       string | null;
  timedOutAt:      string | null;
  readinessTier:   1 | 2 | 3;
  customerName:    string;
  customerCity:    string | null;
  customerWhatsapp: string | null;
  tradeSlug:       string;
  description:     string;
};

export function BeaconClaimsSection({
  claims,
  merchantSlug,
  editToken,
  merchantDisplayName
}: {
  claims:              BeaconClaimRow[];
  merchantSlug:        string;
  editToken:           string;
  merchantDisplayName: string;
}) {
  if (claims.length === 0) {
    return (
      <div className="mt-3 rounded-2xl border border-dashed border-[#1B1A17]/15 bg-white/60 p-5 text-center text-[12px] text-[#1B1A17]/60">
        No community job requests yet. When homeowners post a project matching your trade + city, it lands here with a 2-hour claim window.
      </div>
    );
  }
  return (
    <ul className="mt-3 space-y-2">
      {claims.map((c) => (
        <BeaconClaimCard
          key={c.id}
          claim={c}
          merchantSlug={merchantSlug}
          editToken={editToken}
          merchantDisplayName={merchantDisplayName}
        />
      ))}
    </ul>
  );
}

function BeaconClaimCard({
  claim,
  merchantSlug,
  editToken,
  merchantDisplayName
}: {
  claim:               BeaconClaimRow;
  merchantSlug:        string;
  editToken:           string;
  merchantDisplayName: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [modalOpen, setModalOpen] = useState(false);
  const [claimedHref, setClaimedHref] = useState<string | null>(null);

  useEffect(() => {
    if (claim.status !== "assigned") return;
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [claim.status]);

  const slaMs   = Date.parse(claim.slaExpiresAt) - now;
  const expired = slaMs <= 0;
  const status  = claimedHref ? "claimed" : (expired && claim.status === "assigned") ? "expired" : claim.status;

  function handleSubmitted(waHref: string) {
    setClaimedHref(waHref);
    setModalOpen(false);
    // Open WhatsApp in a new tab so the trade sees the message immediately.
    if (typeof window !== "undefined") {
      window.open(waHref, "_blank", "noopener,noreferrer");
    }
  }

  // Format SLA remaining as "1h 23m" / "45m" / "2m"
  function formatSla(): string {
    const totalMin = Math.max(0, Math.floor(slaMs / 60_000));
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h > 0) return `${h}h ${m}m left`;
    return `${m}m left`;
  }

  return (
    <li className={`rounded-2xl border p-4 shadow-sm ${status === "expired" || status === "timed_out" ? "border-[#1B1A17]/10 bg-neutral-50 opacity-70" : "border-amber-400/40 bg-[#FFF7DB]"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <p className="text-[13.5px] font-black text-[#1B1A17]">
            {claim.customerName}
          </p>
          {claim.customerCity && (
            <span className="text-[10px] font-black uppercase tracking-wider text-[#7A5B00]">
              · {claim.customerCity}
            </span>
          )}
        </div>
        {status === "assigned" && (
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${slaMs < 20 * 60_000 ? "bg-red-100 text-red-700" : "bg-white text-[#7A5B00]"}`}>
            <Clock size={10} strokeWidth={2.6}/>
            {formatSla()}
          </span>
        )}
        {(status === "claimed" || claimedHref) && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-green-800">
            <CheckCircle2 size={10} strokeWidth={2.6}/>
            Claimed
          </span>
        )}
        {(status === "expired" || status === "timed_out") && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-neutral-600">
            <XCircle size={10} strokeWidth={2.6}/>
            SLA missed
          </span>
        )}
      </div>

      <p className={`mt-2 text-[12.5px] leading-relaxed ${status === "expired" || status === "timed_out" ? "text-neutral-600" : "text-[#1B1A17]/85"}`}>
        &ldquo;{claim.description}&rdquo;
      </p>

      {status === "assigned" && (
        <>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-white transition"
              style={{ backgroundColor: "#166534" }}
            >
              <MessageCircle size={12} strokeWidth={2.6}/>
              Message customer via WhatsApp
            </button>
            <span className="text-[10px] text-neutral-500">
              Preview + edit your message · 1 washer on send
            </span>
          </div>
          <BeaconClaimComposeModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onSubmitted={handleSubmitted}
            merchantSlug={merchantSlug}
            editToken={editToken}
            beaconId={claim.beaconId}
            customerName={claim.customerName}
            customerCity={claim.customerCity}
            customerWhatsapp={claim.customerWhatsapp}
            description={claim.description}
            tradeName={merchantDisplayName}
          />
        </>
      )}
      {claimedHref && (
        <div className="mt-3 flex items-center gap-2">
          <a
            href={claimedHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[11px] font-black uppercase tracking-wider text-white"
            style={{ backgroundColor: "#166534" }}
          >
            <MessageCircle size={12} strokeWidth={2.6}/>
            Re-open WhatsApp
          </a>
          <span className="text-[10px] text-neutral-500">Washer deducted · WhatsApp sent</span>
        </div>
      )}
      {(status === "expired" || status === "timed_out") && (
        <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-red-700">
          You missed this — the customer is already being messaged by faster trades.
        </p>
      )}
    </li>
  );
}
