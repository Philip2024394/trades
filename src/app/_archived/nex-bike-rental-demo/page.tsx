// src/app/nex-bike-rental-demo/page.tsx · Philip 2026-08-29
//
// Bike rental directory · Trade Centre theme (warm off-white bg, white cards,
// orange primary, dark green WhatsApp CTA). Reads real listings from Postgres
// via /api/nex/bike-rentals (seeded in migration 132).

"use client";

import React, { useEffect, useState } from "react";
import { RentalListingCard, type RentalListing, T_TC } from "@/components/nex/RentalListingCard";
import type { TaxonomyBike } from "@/lib/nex/bikeRentalRotation";

export default function BikeRentalDemo() {
  const [rentals, setRentals] = useState<RentalListing[]>([]);
  const [taxonomy, setTaxonomy] = useState<TaxonomyBike[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/nex/bike-rentals").then((r) => r.json()),
      fetch("/api/nex/bike-models").then((r) => r.json()),
    ]).then(([a, b]) => {
      setRentals(a.rentals ?? []);
      setTaxonomy(b.bikes ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: T_TC.bg,
      color: T_TC.text,
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      padding: "24px 16px 60px",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{
          fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase",
          color: T_TC.primary, fontWeight: 800, marginBottom: 4,
        }}>NEX bike rental directory</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: -0.4, color: T_TC.text }}>
          Rent a bike in Indonesia
        </h1>
        <p style={{ fontSize: 13, color: T_TC.textSoft, marginTop: 6, marginBottom: 24, maxWidth: 620 }}>
          Every listing shows included helmets and raincoats, hotel/villa drop-off, and whether the tank comes full.
          A green &quot;Rent or Buy&quot; chip means the rental company also sells the bike outright.
        </p>

        {loading && <div style={{ color: T_TC.textSoft, textAlign: "center", padding: 40 }}>Loading rentals…</div>}

        <div style={{
          display: "grid", gap: 18,
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
        }}>
          {rentals.map((rental) => (
            <RentalListingCard
              key={rental.rental_id}
              rental={rental}
              taxonomy={taxonomy}
              onReserve={() => alert(`Reserve · ${rental.name}`)}
              onWhatsapp={() => rental.whatsapp_e164
                ? window.open(`https://wa.me/${rental.whatsapp_e164.replace(/\D/g, "")}`, "_blank")
                : alert(`WhatsApp · ${rental.name} (no number yet)`)}
            />
          ))}
        </div>

        {!loading && rentals.length === 0 && (
          <div style={{ color: T_TC.textSoft, textAlign: "center", padding: 40 }}>
            No rentals yet. Run migration 132 to seed.
          </div>
        )}
      </div>
    </div>
  );
}
