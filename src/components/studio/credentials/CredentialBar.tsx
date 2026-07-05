// Public-facing credential bar — a strip of badges that any section
// can drop into its trust zone.
//
// Server component. Receives a brand id, loads the merchant's public
// credentials, and renders the widgets. Sections that ONLY need to
// filter to a specific set of schemes pass `schemes={[...]}`.
//
// Silently renders nothing when the merchant holds none of the
// requested schemes — no empty container, no "0 verified badges"
// placeholder, no half-broken UI.

import { loadPublicCredentialsForBrand } from "@/lib/studio/credentials/loader";
import type { CredentialScheme } from "@/lib/studio/blueprints";
import { CredentialWidget } from "./CredentialWidget";

export async function CredentialBar({
  brandId,
  schemes,
  variant = "chip",
  className
}: {
  brandId: string;
  schemes?: CredentialScheme[];
  variant?: "chip" | "card";
  className?: string;
}) {
  const held = await loadPublicCredentialsForBrand(brandId);
  const filtered = schemes
    ? held.filter((h) => schemes.includes(h.scheme))
    : held;
  if (filtered.length === 0) return null;
  return (
    <div
      className={
        variant === "card"
          ? `flex flex-wrap gap-3 ${className ?? ""}`
          : `flex flex-wrap items-center gap-2 ${className ?? ""}`
      }
    >
      {filtered.map((c) => (
        <CredentialWidget
          key={`${c.scheme}-${c.number}`}
          scheme={c.scheme}
          credentials={filtered}
          variant={variant}
        />
      ))}
    </div>
  );
}
