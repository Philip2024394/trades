// src/app/nex-native/directory/[id]/page.tsx
//
// NEX Directory · Phase A · The Directory-side detail surface for ONE
// canonical row.
//
// What this page is
//   · The Directory's own detail view for any canonical row that
//     reaches it. Rendered for discovery visitors who clicked a card
//     whose destination is `claim_available` or `place_detail`.
//   · A rich-conditional presentation framework: every content block
//     renders only when the backing field exists on the view model.
//     If a field is missing, the block disappears. No fabrication, no
//     placeholders, no "N/A", no "coming soon" dead copy.
//
// What this page is NOT
//   · Not the owner's cover page. If the destination resolves to
//     `nex_business` or `nex_user_profile`, this page redirects to
//     the owner's existing route (301 server-side) · the Directory
//     is the discovery layer, not a duplicate of the owner surface.
//   · Not a mutator. All DB access is SELECT (listing + evidence
//     presence check).
//   · Not a Message Business surface yet. The primary interaction
//     area is reserved · it renders ONLY actions the data genuinely
//     supports today (tel:, https:, maps directions) · no dead
//     button, no "coming soon" placeholder. When Message Business
//     lands as a separate authorisation, it fits here naturally.
//
// Current reality
//   · The one canonical row today is the sealed synthetic first-write
//     proof fixture. It has no phone, no website, no categories, no
//     real city, no coordinates returned to the service, no primary
//     image (migration 173 deferred). The detail page will therefore
//     render sparse-but-honest sections for it. When real canonical
//     rows arrive, the same code lights up with real content.

import "server-only";
import type * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCanonicalBusinessById } from "@/lib/nex-native/directory/directory-service";
import type {
  DirectoryClassification,
  DirectoryDestination,
  DirectoryListingVM,
} from "@/lib/nex-native/directory";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { NexPageHeader } from "../../_page-header";
import { NoImage } from "../_no-image";
import { buildDirectoryDetailPath } from "../_routes";
import { isVerifiedLifecycle } from "../_verified";
import { DetailDistanceChip } from "./_detail-distance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ═════════════════════════════════════════════════════════════════════
// §1 · Palette · aligned with /nex-native/directory list surface
// ═════════════════════════════════════════════════════════════════════

const NEX = {
  bg: "#020914",
  surface: "#0E1526",
  surfaceHi: "#182540",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  textSoft: "#4B6683",
  orange: "#FF7200",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0,175,255,0.08)",
  divider: "rgba(255,255,255,0.08)",
  borderSoft: "rgba(255,255,255,0.06)",
} as const;

const CLASSIFICATION_LABEL: Record<DirectoryClassification, string> = {
  business: "Business",
  person: "Person",
  place: "Place",
};

const CLASSIFICATION_ACCENT: Record<DirectoryClassification, string> = {
  business: NEX.orange,
  person: NEX.cyan,
  place: NEX.textDim,
};

// ═════════════════════════════════════════════════════════════════════
// §2 · The page
// ═════════════════════════════════════════════════════════════════════

interface PageProps {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function DirectoryDetailPage(
  props: PageProps,
): Promise<React.ReactElement> {
  const { id } = await props.params;
  await resolveNexAppSessionFromContext();

  const outcome = await getCanonicalBusinessById(id);

  if (!outcome.systemReady) {
    return <PreparingShell />;
  }
  if (outcome.result === null) {
    notFound();
  }

  const { listing, destination, hasEvidence } = outcome.result;

  // Owner-claimed destinations redirect to the owner's existing cover /
  // profile. The Directory detail page is specifically for unowned /
  // place-only canonical rows.
  if (destination.kind === "nex_business") {
    redirect(destination.path);
  }
  if (destination.kind === "nex_user_profile") {
    redirect(destination.path);
  }
  // SUPERSEDED chain · the detail page follows one hop via Next.js
  // server redirect. The target id's detail page then re-resolves
  // (and if that is also SUPERSEDED, redirects again · bounded by
  // the lifecycle discipline that chains terminate in a non-SUPERSEDED
  // row).
  if (destination.kind === "redirect_to_canonical") {
    redirect(buildDirectoryDetailPath(destination.targetBusinessId));
  }
  // Honest unresolved: fall through to notFound rather than render
  // a defective detail. Defensive · the resolver should not emit
  // "unresolved" for a row we just read, but we never fabricate a
  // destination to recover.
  if (destination.kind === "unresolved") {
    notFound();
  }

  // destination.kind is now `claim_available` or `place_detail`.
  return (
    <DetailShell
      listing={listing}
      destination={destination}
      hasEvidence={hasEvidence}
    />
  );
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Shells
// ═════════════════════════════════════════════════════════════════════

function PageFrame(props: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <main
      data-nex-directory-detail-page
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "0 20px 48px 20px",
          width: "100%",
        }}
      >
        <NexPageHeader dataScope="directory-detail" />
        <BackToDirectory />
        {props.children}
      </div>
    </main>
  );
}

function BackToDirectory(): React.ReactElement {
  return (
    <nav
      aria-label="Directory navigation"
      data-nex-directory-detail-back
      style={{ marginTop: 20, marginBottom: 8 }}
    >
      <Link
        href="/nex-native/directory"
        style={{
          color: NEX.textDim,
          fontSize: 13,
          fontWeight: 500,
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <ChevronLeft />
        Back to Directory
      </Link>
    </nav>
  );
}

function PreparingShell(): React.ReactElement {
  return (
    <PageFrame>
      <section
        data-nex-directory-detail-state="preparing"
        style={{
          background: NEX.surface,
          border: `1px solid ${NEX.borderSoft}`,
          borderRadius: 16,
          padding: "28px 20px",
          textAlign: "center",
          marginTop: 20,
        }}
      >
        <h1
          style={{
            margin: 0,
            color: NEX.text,
            fontSize: 20,
            fontWeight: 600,
          }}
        >
          The NEX Directory is being prepared.
        </h1>
        <p
          style={{
            margin: "10px 0 0 0",
            color: NEX.textMuted,
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          Verified business and people data is being carefully assembled
          and reviewed. Come back soon.
        </p>
      </section>
    </PageFrame>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Detail content
// ═════════════════════════════════════════════════════════════════════

function DetailShell(props: {
  readonly listing: DirectoryListingVM;
  readonly destination: DirectoryDestination;
  readonly hasEvidence: boolean;
}): React.ReactElement {
  const { listing, destination, hasEvidence } = props;

  return (
    <PageFrame>
      <article
        data-nex-directory-detail-canonical-id={listing.canonicalBusinessId}
        data-nex-directory-detail-classification={listing.classification}
        data-nex-directory-detail-destination-kind={destination.kind}
        data-nex-directory-detail-has-image={
          listing.primaryImage !== null ? "true" : "false"
        }
        data-nex-directory-detail-has-evidence={hasEvidence ? "true" : "false"}
        style={{ marginTop: 12 }}
      >
        <HeroSection listing={listing} />
        <AliasesSection listing={listing} />
        <AboutSection listing={listing} />
        <CategoriesSection listing={listing} />
        <LocationSection listing={listing} />
        <ContactSection listing={listing} />
      </article>
    </PageFrame>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────

function HeroSection(props: {
  readonly listing: DirectoryListingVM;
}): React.ReactElement {
  const { listing } = props;
  // The "Verified" chip is gated on `lifecycleState` (the sealed
  // enum values VERIFIED and OWNER_VERIFIED) · NOT on evidence-row
  // presence. See _verified.ts for the semantic rationale: evidence
  // is provenance, lifecycle is verification.
  const verified = isVerifiedLifecycle(listing.lifecycleState);
  return (
    <section
      data-nex-directory-detail-hero
      style={{
        marginTop: 20,
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
        flexWrap: "wrap",
      }}
    >
      <HeroImage listing={listing} />
      <div
        style={{
          flex: 1,
          minWidth: 220,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            data-nex-directory-detail-chip="classification"
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: CLASSIFICATION_ACCENT[listing.classification],
            }}
          >
            {CLASSIFICATION_LABEL[listing.classification]}
          </span>
          {verified ? (
            <span
              data-nex-directory-detail-chip="verified"
              aria-label="Verified listing"
              title="Verified listing"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: NEX.cyan,
                padding: "2px 8px",
                borderRadius: 999,
                border: `1px solid ${NEX.cyan}`,
                background: NEX.cyanFaint,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <VerifiedGlyph />
              Verified
            </span>
          ) : null}
        </div>
        <h1
          data-nex-directory-detail-name
          style={{
            margin: 0,
            color: NEX.text,
            fontSize: 26,
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
            wordBreak: "break-word",
          }}
        >
          {listing.name}
        </h1>
      </div>
    </section>
  );
}

function HeroImage(props: {
  readonly listing: DirectoryListingVM;
}): React.ReactElement {
  const { listing } = props;
  if (listing.primaryImage !== null) {
    return (
      <div
        data-nex-directory-detail-image="present"
        style={{
          width: 140,
          height: 140,
          flexShrink: 0,
          borderRadius: 18,
          overflow: "hidden",
          background: NEX.surfaceHi,
        }}
      >
        {/* Plain <img> · Phase B contract is a plain URL string.
            next/image allowlist is a future wave. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={listing.primaryImage.url}
          alt={listing.primaryImage.altText || listing.name}
          data-nex-directory-detail-image-src
          loading="lazy"
          decoding="async"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      </div>
    );
  }
  return (
    <div
      data-nex-directory-detail-image="absent"
      style={{ flexShrink: 0 }}
    >
      <NoImage classification={listing.classification} name={listing.name} />
    </div>
  );
}

// ─── Aliases ──────────────────────────────────────────────────────────

function AliasesSection(props: {
  readonly listing: DirectoryListingVM;
}): React.ReactElement | null {
  const aliases = props.listing.aliases.filter(
    (a) => a.trim().length > 0,
  );
  if (aliases.length === 0) return null;
  return (
    <section
      data-nex-directory-detail-aliases
      style={{ marginTop: 10 }}
    >
      <p
        style={{
          margin: 0,
          color: NEX.textSoft,
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        Also known as: {aliases.join(" · ")}
      </p>
    </section>
  );
}

// ─── About · reserved for future description/overview column ─────────

function AboutSection(props: {
  readonly listing: DirectoryListingVM;
}): React.ReactElement | null {
  // The canonical table does not currently expose a free-text
  // description / overview column. When migration 175's
  // `nex.business_directory_v` view (or an equivalent later wave) adds
  // one, read it here. Until then, this section renders nothing · we
  // never fabricate "about" copy.
  void props;
  return null;
}

// ─── Categories ──────────────────────────────────────────────────────

function CategoriesSection(props: {
  readonly listing: DirectoryListingVM;
}): React.ReactElement | null {
  const categories = props.listing.categoryIds.filter(
    (c) => c.trim().length > 0,
  );
  if (categories.length === 0) return null;
  return (
    <SectionBlock
      title="Services and categories"
      dataAttr="categories"
    >
      <ul
        aria-label="Services and categories"
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {categories.map((c) => (
          <li
            key={c}
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              padding: "4px 10px",
              background: NEX.surfaceHi,
              color: NEX.textDim,
              borderRadius: 999,
            }}
          >
            {c}
          </li>
        ))}
      </ul>
    </SectionBlock>
  );
}

// ─── Location ────────────────────────────────────────────────────────

function LocationSection(props: {
  readonly listing: DirectoryListingVM;
}): React.ReactElement | null {
  const {
    city,
    district,
    country,
    streetLine,
    neighbourhood,
    address,
    coordinates,
  } = props.listing;

  // Each location field is rendered independently when present ·
  // honoring the no-concatenation rule. We do NOT fabricate a full
  // address by stitching together partial fields from the source.
  const addressLine1HasValue =
    address !== null &&
    address.line1 !== null &&
    address.line1.trim().length > 0;
  const addressPostalHasValue =
    address !== null &&
    address.postal_code !== null &&
    address.postal_code.trim().length > 0;
  const streetLineHasValue =
    streetLine !== null && streetLine.trim().length > 0;
  const neighbourhoodHasValue =
    neighbourhood !== null && neighbourhood.trim().length > 0;
  const districtHasValue = district !== null && district.length > 0;
  const cityHasValue = city !== null && city.length > 0;
  const countryHasValue = country.length > 0;

  // Area line (district / city / country) composed deterministically
  // in that order with " · " separators · each component is a real
  // field from the canonical row.
  const areaParts: string[] = [];
  if (districtHasValue) areaParts.push(district!);
  if (cityHasValue) areaParts.push(city!);
  if (countryHasValue) areaParts.push(country);
  const hasAreaLine = areaParts.length > 0;

  const hasAnyText =
    addressLine1HasValue ||
    addressPostalHasValue ||
    streetLineHasValue ||
    neighbourhoodHasValue ||
    hasAreaLine;
  const hasCoords = coordinates !== null;
  if (!hasAnyText && !hasCoords) return null;

  // Rendered order top → bottom (bold → muted):
  //   address.line1 (free-text address from source)
  //   street_line   (dedicated structured street column)
  //   neighbourhood
  //   area (district · city · country)
  //   postal_code (small chip below area · only when populated)
  //   distance chip
  // Each line hides when its backing field is empty · no concatenation.
  const topLinePresent = addressLine1HasValue;
  const secondLinePresent = !topLinePresent && streetLineHasValue;

  return (
    <SectionBlock title="Location" dataAttr="location">
      {addressLine1HasValue ? (
        <p
          data-nex-directory-detail-location-line="address-line1"
          style={{
            margin: 0,
            color: NEX.text,
            fontSize: 14,
            fontWeight: 500,
            lineHeight: 1.5,
          }}
        >
          {address!.line1}
        </p>
      ) : null}
      {streetLineHasValue ? (
        <p
          data-nex-directory-detail-location-line="street"
          style={{
            margin: topLinePresent ? "4px 0 0 0" : 0,
            color: topLinePresent ? NEX.textDim : NEX.text,
            fontSize: 14,
            fontWeight: topLinePresent ? 400 : 500,
            lineHeight: 1.5,
          }}
        >
          {streetLine}
        </p>
      ) : null}
      {neighbourhoodHasValue ? (
        <p
          data-nex-directory-detail-location-line="neighbourhood"
          style={{
            margin:
              topLinePresent || secondLinePresent ? "4px 0 0 0" : 0,
            color: NEX.textDim,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {neighbourhood}
        </p>
      ) : null}
      {hasAreaLine ? (
        <p
          data-nex-directory-detail-location-line="area"
          style={{
            margin:
              addressLine1HasValue ||
              streetLineHasValue ||
              neighbourhoodHasValue
                ? "4px 0 0 0"
                : 0,
            color: NEX.textDim,
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          {areaParts.join(" · ")}
        </p>
      ) : null}
      {addressPostalHasValue ? (
        <p
          data-nex-directory-detail-location-line="postal_code"
          style={{
            margin: "4px 0 0 0",
            color: NEX.textMuted,
            fontSize: 12.5,
            lineHeight: 1.5,
          }}
        >
          Postal code: {address!.postal_code}
        </p>
      ) : null}
      <DetailDistanceChip listingCoords={coordinates} />
    </SectionBlock>
  );
}

// ─── Contact · primary interaction area ──────────────────────────────

function ContactSection(props: {
  readonly listing: DirectoryListingVM;
}): React.ReactElement | null {
  const { phoneE164, websiteApex } = props.listing;
  const haveAny =
    (phoneE164 !== null && phoneE164.length > 0) ||
    (websiteApex !== null && websiteApex.length > 0);
  if (!haveAny) {
    // No real contact information available for this listing. The
    // detail page does NOT render a dead button, a "coming soon"
    // placeholder, or a disabled "Message" affordance. When a
    // Message Business subsystem lands as a separate authorisation,
    // it will slot in here as a real action.
    return null;
  }
  return (
    <SectionBlock title="Contact" dataAttr="contact">
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        {phoneE164 !== null && phoneE164.length > 0 ? (
          <a
            href={`tel:${phoneE164}`}
            data-nex-directory-detail-action="call"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 14px",
              borderRadius: 999,
              background: NEX.orange,
              color: "#1A1300",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <PhoneGlyph />
            Call
          </a>
        ) : null}
        {websiteApex !== null && websiteApex.length > 0 ? (
          <a
            href={buildWebsiteHref(websiteApex)}
            target="_blank"
            rel="noopener noreferrer"
            data-nex-directory-detail-action="website"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 14px",
              borderRadius: 999,
              background: NEX.surfaceHi,
              color: NEX.text,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              border: `1px solid ${NEX.borderSoft}`,
            }}
          >
            <GlobeGlyph />
            Website
          </a>
        ) : null}
      </div>
    </SectionBlock>
  );
}

/** Build a safe https:// href from a `website_apex` value. The canonical
 *  CHECK constraint already enforces that `website_apex` is a plain host
 *  (no scheme, no path, no credentials); we prefix `https://` for the
 *  href. Pure. */
function buildWebsiteHref(websiteApex: string): string {
  const trimmed = websiteApex.trim();
  return `https://${trimmed}`;
}

// ═════════════════════════════════════════════════════════════════════
// §5 · Shared section block
// ═════════════════════════════════════════════════════════════════════

function SectionBlock(props: {
  readonly title: string;
  readonly dataAttr: string;
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <section
      data-nex-directory-detail-section={props.dataAttr}
      style={{
        marginTop: 22,
        background: NEX.surface,
        border: `1px solid ${NEX.borderSoft}`,
        borderRadius: 16,
        padding: "18px 20px",
      }}
    >
      <h2
        style={{
          margin: "0 0 10px 0",
          color: NEX.textDim,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {props.title}
      </h2>
      {props.children}
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §6 · Glyphs
// ═════════════════════════════════════════════════════════════════════

function ChevronLeft(): React.ReactElement {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function VerifiedGlyph(): React.ReactElement {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function PhoneGlyph(): React.ReactElement {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.12.9.34 1.78.66 2.63a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.45-1.45a2 2 0 012.11-.45c.85.32 1.73.54 2.63.66A2 2 0 0122 16.92z" />
    </svg>
  );
}

function GlobeGlyph(): React.ReactElement {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 010 20" />
      <path d="M12 2a15.3 15.3 0 000 20" />
    </svg>
  );
}
