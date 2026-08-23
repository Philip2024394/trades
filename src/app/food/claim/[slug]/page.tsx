// Owner-side claim page · entered from a WhatsApp link.
// URL: /food/claim/2026-XXXXX   (URL-safe slug · no # or FL prefix)
//
// This is an OWNER-facing page · deliberately outside /nexapp so it works
// standalone when the owner taps the WhatsApp link. Per pinned Food V1 Lock 2:
//   Lock 2 governs the customer-facing directory (centre-panel state inside
//   /nexapp). Owner tooling is a legitimate separate route.

import { notFound } from "next/navigation";
import { getFoodDbPool } from "@/lib/nex-food/db";
import { slugToRef } from "@/lib/nex-food/claim-codes";
import { FoodClaimForm } from "./FoodClaimForm";

export const dynamic = "force-dynamic";

async function loadBusiness(ref: string) {
  const pool = getFoodDbPool();
  const q = await pool.query(
    `SELECT public_listing_ref, business_name, category, city, district, claim_status
     FROM nex.food_business WHERE public_listing_ref = $1 LIMIT 1`,
    [ref]
  );
  return q.rows[0] ?? null;
}

export default async function ClaimPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^\d{4}-[A-HJ-KM-NP-TV-Z0-9]{5}$/.test(slug)) notFound();
  const ref = slugToRef(slug);
  const business = await loadBusiness(ref);
  if (!business) notFound();

  const alreadyClaimed = business.claim_status === "claimed" || business.claim_status === "paying";

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#0a0a0a",
      color: "#f4f4f4",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    }}>
      <div style={{
        maxWidth: 420,
        width: "100%",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: "28px 24px",
      }}>
        <div style={{
          fontSize: 11,
          letterSpacing: 3,
          color: "#f97316",   // NEX orange
          fontWeight: 700,
          marginBottom: 16,
        }}>NEX FOOD · CLAIM YOUR BUSINESS</div>

        <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px", lineHeight: 1.25 }}>
          {business.business_name}
        </h1>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 20 }}>
          {business.category} · {business.district ?? business.city} · {business.public_listing_ref}
        </div>

        {alreadyClaimed ? (
          <div style={{
            padding: "16px 14px",
            borderRadius: 10,
            background: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.30)",
            color: "#a7f3d0",
            fontSize: 13,
            lineHeight: 1.5,
          }}>
            <strong>Already claimed.</strong>
            <br />
            This business is already registered on NEX. If this is your business
            and you need to regain access, contact NEX support.
          </div>
        ) : (
          <FoodClaimForm publicListingRef={business.public_listing_ref} />
        )}

        <div style={{
          marginTop: 24,
          paddingTop: 16,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          fontSize: 10.5,
          color: "rgba(255,255,255,0.35)",
          lineHeight: 1.5,
        }}>
          Enter the 6-digit code we sent to your WhatsApp number.
          The code expires 10 minutes after it was sent.
        </div>
      </div>
    </div>
  );
}
