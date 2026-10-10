// src/components/nex-native/directory/CategoryDetailSections.tsx
//
// NEX Directory · Card-refresh wave · per-entity_type detail sections.
//
// What this component is
//   · The presentation layer for a listing's category-specific body,
//     rendered inside the detail-panel between CTA strip and the
//     claim-prompt area. Dispatches on `projectCategoryDetails(...)`.
//   · One component per sealed `kind` from `CategoryDetails`. Each
//     sub-section is responsible for its own honest-empty handling:
//     if the entire sub-section has no validated data, it emits
//     nothing. Partially-populated sections render available fields
//     and a per-sub-section micro-copy for the missing one.
//
// What this component is NOT
//   · Not a mutator. Read-only presentation. No server actions here.
//   · Not a fabrication layer. If the projected shape is empty, the
//     section disappears from the DOM entirely. We never render fake
//     room types, fake menu items, fake vehicles, or "N/A" placeholders.
//   · Not a shared layout primitive — this component is specific to
//     the Directory detail panel. It intentionally reuses the panel's
//     palette tokens so visual drift is impossible.
//
// Accessibility
//   · Each section emits `<section data-nex-category-section>` + a
//     stable `data-nex-category-kind={kind}` attribute so Playwright
//     and the parent panel can locate it reliably.
//   · All opening-hours tables are rendered inside a `<details>` so
//     keyboard users can expand without extra JS.
//
// Palette · the NEX navy/orange/cyan trio (same as ListingDetailPanel).

"use client";

import type * as React from "react";
import type { DirectoryListingVM } from "@/lib/nex-native/directory";
import { projectCategoryDetails } from "@/lib/nex-native/directory/category-details/project";
import type {
  AccommodationFacility,
  CategoryDetails,
  DietaryFlag,
  MenuSection,
  Money,
  OpeningHoursRange,
  RentalTerms,
  RoomType,
  ServicePriceMethod,
  TransportPriceMethod,
  VehicleOffer,
} from "@/lib/nex-native/directory/category-details/types";

const PALETTE = {
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
  borderSoft: "rgba(255,255,255,0.08)",
} as const;

const DAY_SHORT: readonly string[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ─────────────────────────────────────────────────────────────────────
// Public component
// ─────────────────────────────────────────────────────────────────────

export interface CategoryDetailSectionsProps {
  readonly listing: DirectoryListingVM;
  readonly locale?: string;
}

export function CategoryDetailSections(
  props: CategoryDetailSectionsProps,
): React.ReactElement | null {
  const details: CategoryDetails = projectCategoryDetails(props.listing);
  switch (details.kind) {
    case "accommodation":
      return <AccommodationSection details={details} />;
    case "food":
      return <FoodSection details={details} />;
    case "vehicle_rental":
      return <VehicleRentalSection details={details} />;
    case "service":
      return <ServiceSection details={details} />;
    case "transport":
      return <TransportSection details={details} />;
    case "marketplace_seller":
      return <MarketplaceSellerSection details={details} />;
    case "generic":
      return null;
    default: {
      const _exhaustive: never = details;
      void _exhaustive;
      return null;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Accommodation
// ─────────────────────────────────────────────────────────────────────

function AccommodationSection(props: {
  readonly details: Extract<CategoryDetails, { kind: "accommodation" }>;
}): React.ReactElement | null {
  const { roomTypes, facilities } = props.details;
  if (roomTypes.length === 0 && facilities.length === 0) return null;
  return (
    <section
      data-nex-category-section
      data-nex-category-kind="accommodation"
      style={sectionStyle}
    >
      <SectionTitle>Rooms & facilities</SectionTitle>
      {roomTypes.length > 0 ? (
        <div
          data-nex-category-room-types
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: facilities.length > 0 ? 10 : 0,
          }}
        >
          {roomTypes.map((rt) => (
            <RoomTypeCard key={rt.slug} room={rt} />
          ))}
        </div>
      ) : (
        <EmptyNudge>
          Room options not yet published — message the host to ask what's available.
        </EmptyNudge>
      )}
      {facilities.length > 0 ? (
        <div data-nex-category-facilities style={chipRowStyle}>
          {facilities.map((f) => (
            <Chip key={f} tone="dim">
              {humaniseFacility(f)}
            </Chip>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function RoomTypeCard(props: { readonly room: RoomType }): React.ReactElement {
  const { room } = props;
  return (
    <article
      data-nex-category-room-type-slug={room.slug}
      style={{
        background: PALETTE.surface,
        border: `1px solid ${PALETTE.borderSoft}`,
        borderRadius: 10,
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 13.5, fontWeight: 600, color: PALETTE.text }}>
          {room.label}
        </div>
        {room.priceFrom !== undefined ? (
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: PALETTE.orange,
            }}
          >
            {formatMoney(room.priceFrom)}
          </div>
        ) : null}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          color: PALETTE.textMuted,
          fontSize: 11.5,
        }}
      >
        {room.occupancy !== null ? (
          <span>Sleeps {room.occupancy}</span>
        ) : null}
        {room.bedConfiguration !== null ? (
          <span>· {humaniseBed(room.bedConfiguration)}</span>
        ) : null}
        {room.bathroom !== null ? (
          <span>· {room.bathroom === "ensuite" ? "Ensuite bathroom" : "Shared bathroom"}</span>
        ) : null}
      </div>
    </article>
  );
}

function humaniseBed(cfg: NonNullable<RoomType["bedConfiguration"]>): string {
  switch (cfg) {
    case "single":
      return "Single bed";
    case "double":
      return "Double bed";
    case "twin":
      return "Twin beds";
    case "queen":
      return "Queen bed";
    case "king":
      return "King bed";
    case "family":
      return "Family configuration";
  }
}

function humaniseFacility(f: AccommodationFacility): string {
  switch (f) {
    case "wifi":
      return "Wi-Fi";
    case "pool":
      return "Pool";
    case "parking":
      return "Parking";
    case "restaurant":
      return "Restaurant";
    case "bar":
      return "Bar";
    case "laundry":
      return "Laundry";
    case "breakfast":
      return "Breakfast";
    case "housekeeping":
      return "Housekeeping";
    case "airport_pickup":
      return "Airport pickup";
    case "ac":
      return "Air-conditioned";
    case "spa":
      return "Spa";
    case "gym":
      return "Gym";
    case "beach_access":
      return "Beach access";
    case "kitchen":
      return "Kitchen";
    case "family_friendly":
      return "Family friendly";
    case "pet_friendly":
      return "Pet friendly";
  }
}

// ─────────────────────────────────────────────────────────────────────
// Food
// ─────────────────────────────────────────────────────────────────────

function FoodSection(props: {
  readonly details: Extract<CategoryDetails, { kind: "food" }>;
}): React.ReactElement | null {
  const { cuisines, dietary, menu, openingHours } = props.details;
  if (
    cuisines.length === 0 &&
    dietary.length === 0 &&
    menu.length === 0 &&
    openingHours.length === 0
  ) {
    return null;
  }
  return (
    <section
      data-nex-category-section
      data-nex-category-kind="food"
      style={sectionStyle}
    >
      <SectionTitle>Menu & hours</SectionTitle>
      {cuisines.length > 0 ? (
        <div data-nex-category-cuisines style={chipRowStyle}>
          {cuisines.map((c) => (
            <Chip key={c} tone="orange">
              {c}
            </Chip>
          ))}
        </div>
      ) : null}
      {dietary.length > 0 ? (
        <div data-nex-category-dietary style={chipRowStyle}>
          {dietary.map((d) => (
            <Chip key={d} tone="cyan">
              {humaniseDietary(d)}
            </Chip>
          ))}
        </div>
      ) : null}
      {menu.length > 0 ? (
        <div
          data-nex-category-menu
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 8,
          }}
        >
          {menu.map((sec) => (
            <MenuSectionCard key={sec.label} section={sec} />
          ))}
        </div>
      ) : cuisines.length > 0 || openingHours.length > 0 ? (
        <EmptyNudge>
          Menu not yet published — message the restaurant to ask.
        </EmptyNudge>
      ) : null}
      {openingHours.length > 0 ? (
        <OpeningHoursDisclosure ranges={openingHours} />
      ) : null}
    </section>
  );
}

function MenuSectionCard(props: {
  readonly section: MenuSection;
}): React.ReactElement {
  const { section } = props;
  return (
    <details
      data-nex-category-menu-section
      style={{
        background: PALETTE.surface,
        border: `1px solid ${PALETTE.borderSoft}`,
        borderRadius: 10,
      }}
    >
      <summary
        style={{
          padding: "8px 10px",
          fontSize: 13,
          fontWeight: 600,
          color: PALETTE.text,
          cursor: "pointer",
          listStyle: "none",
        }}
      >
        {section.label}
      </summary>
      <ul
        style={{
          margin: 0,
          padding: "0 10px 10px 10px",
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {section.items.map((item, idx) => (
          <li
            // eslint-disable-next-line react/no-array-index-key
            key={`${item.name}-${idx}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              fontSize: 12.5,
              color: PALETTE.textDim,
              borderTop:
                idx === 0 ? "none" : `1px solid ${PALETTE.borderSoft}`,
              paddingTop: idx === 0 ? 0 : 6,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ color: PALETTE.text, fontWeight: 500 }}>
                {item.name}
              </span>
              {item.description !== undefined ? (
                <span style={{ color: PALETTE.textMuted, fontSize: 11.5 }}>
                  {item.description}
                </span>
              ) : null}
              {item.dietary !== undefined && item.dietary.length > 0 ? (
                <span
                  style={{
                    color: PALETTE.cyan,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.02em",
                  }}
                >
                  {item.dietary.map(humaniseDietary).join(" · ")}
                </span>
              ) : null}
            </div>
            {item.priceFrom !== undefined ? (
              <span
                style={{
                  color: PALETTE.orange,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                {formatMoney(item.priceFrom)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

function humaniseDietary(d: DietaryFlag): string {
  switch (d) {
    case "halal":
      return "Halal";
    case "vegetarian":
      return "Vegetarian";
    case "vegan":
      return "Vegan";
    case "gluten_free":
      return "Gluten-free";
    case "pork_free":
      return "Pork-free";
    case "alcohol_free":
      return "Alcohol-free";
  }
}

// ─────────────────────────────────────────────────────────────────────
// Vehicle rental
// ─────────────────────────────────────────────────────────────────────

function VehicleRentalSection(props: {
  readonly details: Extract<CategoryDetails, { kind: "vehicle_rental" }>;
}): React.ReactElement | null {
  const { vehicles, terms } = props.details;
  if (vehicles.length === 0 && terms === null) return null;
  return (
    <section
      data-nex-category-section
      data-nex-category-kind="vehicle_rental"
      style={sectionStyle}
    >
      <SectionTitle>Rentals</SectionTitle>
      {vehicles.length > 0 ? (
        <div
          data-nex-category-vehicles
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {vehicles.map((v, idx) => (
            // eslint-disable-next-line react/no-array-index-key
            <VehicleCard key={`${v.vehicleType}-${v.model ?? idx}`} vehicle={v} />
          ))}
        </div>
      ) : (
        <EmptyNudge>
          Vehicle options not yet published — message to ask what's available.
        </EmptyNudge>
      )}
      {terms !== null ? <RentalTermsBlock terms={terms} /> : null}
    </section>
  );
}

function VehicleCard(props: {
  readonly vehicle: VehicleOffer;
}): React.ReactElement {
  const { vehicle } = props;
  return (
    <article
      data-nex-category-vehicle-type={vehicle.vehicleType}
      style={{
        background: PALETTE.surface,
        border: `1px solid ${PALETTE.borderSoft}`,
        borderRadius: 10,
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 13.5, fontWeight: 600, color: PALETTE.text }}>
          {humaniseVehicle(vehicle.vehicleType)}
          {vehicle.model !== undefined ? ` · ${vehicle.model}` : ""}
        </div>
        {vehicle.dailyRate !== undefined ? (
          <div
            style={{ fontSize: 12, fontWeight: 700, color: PALETTE.orange }}
          >
            {formatMoney(vehicle.dailyRate)}/day
          </div>
        ) : null}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          color: PALETTE.textMuted,
          fontSize: 11.5,
        }}
      >
        {vehicle.transmission !== undefined ? (
          <span>
            {vehicle.transmission === "automatic" ? "Automatic" : "Manual"}
          </span>
        ) : null}
        {vehicle.capacity !== undefined ? (
          <span>· Seats {vehicle.capacity}</span>
        ) : null}
        {vehicle.depositRequired !== undefined ? (
          <span>· Deposit {formatMoney(vehicle.depositRequired)}</span>
        ) : null}
        {vehicle.licenceRequired !== undefined &&
        vehicle.licenceRequired !== null ? (
          <span>· Licence {vehicle.licenceRequired}</span>
        ) : null}
      </div>
      {vehicle.includedEquipment !== undefined &&
      vehicle.includedEquipment.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            marginTop: 2,
          }}
        >
          {vehicle.includedEquipment.map((eq) => (
            <Chip key={eq} tone="dim">
              {eq}
            </Chip>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function humaniseVehicle(t: VehicleOffer["vehicleType"]): string {
  switch (t) {
    case "motorbike":
      return "Motorbike";
    case "scooter":
      return "Scooter";
    case "car":
      return "Car";
    case "bicycle":
      return "Bicycle";
    case "van":
      return "Van";
    case "boat":
      return "Boat";
  }
}

function RentalTermsBlock(props: {
  readonly terms: RentalTerms;
}): React.ReactElement {
  const t = props.terms;
  const bits: string[] = [];
  if (t.minHours !== undefined) bits.push(`Min ${t.minHours}h`);
  if (t.maxDays !== undefined) bits.push(`Up to ${t.maxDays} days`);
  if (t.delivery !== null) {
    bits.push(t.delivery ? "Delivery available" : "No delivery");
  }
  return (
    <div
      data-nex-category-rental-terms
      style={{
        marginTop: 8,
        fontSize: 11.5,
        color: PALETTE.textMuted,
        lineHeight: 1.4,
      }}
    >
      {bits.length > 0 ? bits.join(" · ") : null}
      {t.cancellation !== undefined ? (
        <div style={{ marginTop: 2 }}>Cancellation: {t.cancellation}</div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────

function ServiceSection(props: {
  readonly details: Extract<CategoryDetails, { kind: "service" }>;
}): React.ReactElement | null {
  const { description, serviceArea, priceMethod, operatingHours } =
    props.details;
  if (
    description === null &&
    serviceArea === null &&
    priceMethod === null &&
    operatingHours.length === 0
  ) {
    return null;
  }
  return (
    <section
      data-nex-category-section
      data-nex-category-kind="service"
      style={sectionStyle}
    >
      <SectionTitle>Service</SectionTitle>
      {description !== null ? (
        <p
          data-nex-category-service-description
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.45,
            color: PALETTE.textDim,
          }}
        >
          {description}
        </p>
      ) : null}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          marginTop: 6,
        }}
      >
        {serviceArea !== null ? (
          <Chip tone="dim">Serves {serviceArea}</Chip>
        ) : null}
        {priceMethod !== null ? (
          <Chip tone="orange">{humaniseServicePrice(priceMethod)}</Chip>
        ) : null}
      </div>
      {operatingHours.length > 0 ? (
        <OpeningHoursDisclosure ranges={operatingHours} />
      ) : null}
    </section>
  );
}

function humaniseServicePrice(p: ServicePriceMethod): string {
  switch (p) {
    case "fixed":
      return "Fixed pricing";
    case "quote":
      return "Price on quote";
    case "hourly":
      return "Hourly rate";
    case "per_job":
      return "Per job";
  }
}

// ─────────────────────────────────────────────────────────────────────
// Transport
// ─────────────────────────────────────────────────────────────────────

function TransportSection(props: {
  readonly details: Extract<CategoryDetails, { kind: "transport" }>;
}): React.ReactElement | null {
  const { serviceTypes, coverage, priceMethod } = props.details;
  if (serviceTypes.length === 0 && coverage === null && priceMethod === null) {
    return null;
  }
  return (
    <section
      data-nex-category-section
      data-nex-category-kind="transport"
      style={sectionStyle}
    >
      <SectionTitle>Transport</SectionTitle>
      {serviceTypes.length > 0 ? (
        <div data-nex-category-service-types style={chipRowStyle}>
          {serviceTypes.map((s) => (
            <Chip key={s} tone="dim">
              {s}
            </Chip>
          ))}
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          marginTop: 6,
        }}
      >
        {coverage !== null ? <Chip tone="cyan">{coverage}</Chip> : null}
        {priceMethod !== null ? (
          <Chip tone="orange">{humaniseTransportPrice(priceMethod)}</Chip>
        ) : null}
      </div>
    </section>
  );
}

function humaniseTransportPrice(p: TransportPriceMethod): string {
  switch (p) {
    case "fixed":
      return "Fixed fare";
    case "metered":
      return "Metered";
    case "quote":
      return "Quote on request";
  }
}

// ─────────────────────────────────────────────────────────────────────
// Marketplace seller
// ─────────────────────────────────────────────────────────────────────

function MarketplaceSellerSection(props: {
  readonly details: Extract<CategoryDetails, { kind: "marketplace_seller" }>;
}): React.ReactElement | null {
  const { productCategories, shippingScope } = props.details;
  if (productCategories.length === 0 && shippingScope === null) return null;
  return (
    <section
      data-nex-category-section
      data-nex-category-kind="marketplace_seller"
      style={sectionStyle}
    >
      <SectionTitle>Products</SectionTitle>
      {productCategories.length > 0 ? (
        <div data-nex-category-product-categories style={chipRowStyle}>
          {productCategories.map((c) => (
            <Chip key={c} tone="dim">
              {c}
            </Chip>
          ))}
        </div>
      ) : null}
      {shippingScope !== null ? (
        <div
          data-nex-category-shipping-scope
          style={{
            marginTop: 6,
            fontSize: 12,
            color: PALETTE.textMuted,
          }}
        >
          Ships to {shippingScope}
        </div>
      ) : null}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Opening-hours disclosure
// ─────────────────────────────────────────────────────────────────────

function OpeningHoursDisclosure(props: {
  readonly ranges: readonly OpeningHoursRange[];
}): React.ReactElement {
  const { ranges } = props;
  // Group ranges by day for a stable row-per-day table.
  const byDay: Map<number, OpeningHoursRange[]> = new Map();
  for (const r of ranges) {
    const bucket = byDay.get(r.day) ?? [];
    bucket.push(r);
    byDay.set(r.day, bucket);
  }
  const summary =
    ranges.length === 7 &&
    ranges.every((r) => r.open === "00:00" && r.close === "24:00")
      ? "Open 24/7"
      : `${ranges.length} opening-hours entries`;
  return (
    <details
      data-nex-category-opening-hours
      style={{
        marginTop: 8,
        background: PALETTE.surface,
        border: `1px solid ${PALETTE.borderSoft}`,
        borderRadius: 10,
      }}
    >
      <summary
        style={{
          padding: "8px 10px",
          fontSize: 12.5,
          fontWeight: 600,
          color: PALETTE.cyan,
          cursor: "pointer",
          listStyle: "none",
        }}
      >
        {summary}
      </summary>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12,
          color: PALETTE.textDim,
        }}
      >
        <tbody>
          {Array.from({ length: 7 }, (_, dayIdx) => {
            const dayRanges = byDay.get(dayIdx) ?? [];
            if (dayRanges.length === 0) return null;
            return (
              <tr key={dayIdx}>
                <td
                  style={{
                    padding: "4px 10px",
                    width: 60,
                    color: PALETTE.textMuted,
                    fontWeight: 600,
                  }}
                >
                  {DAY_SHORT[dayIdx]}
                </td>
                <td style={{ padding: "4px 10px" }}>
                  {dayRanges
                    .map((r) => `${r.open} – ${r.close}`)
                    .join(", ")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </details>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────

const sectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const chipRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginTop: 2,
};

function SectionTitle(props: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: PALETTE.textMuted,
        marginBottom: 2,
      }}
    >
      {props.children}
    </div>
  );
}

function Chip(props: {
  readonly tone: "orange" | "cyan" | "dim";
  readonly children: React.ReactNode;
}): React.ReactElement {
  const bg =
    props.tone === "orange"
      ? "rgba(255,114,0,0.14)"
      : props.tone === "cyan"
        ? PALETTE.cyanFaint
        : PALETTE.surfaceHi;
  const color =
    props.tone === "orange"
      ? PALETTE.orange
      : props.tone === "cyan"
        ? PALETTE.cyan
        : PALETTE.textDim;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        background: bg,
        color,
        borderRadius: 999,
      }}
    >
      {props.children}
    </span>
  );
}

function EmptyNudge(props: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      style={{
        fontSize: 11.5,
        color: PALETTE.textMuted,
        fontStyle: "italic",
        lineHeight: 1.4,
      }}
    >
      {props.children}
    </div>
  );
}

function formatMoney(m: Money): string {
  // Honest-locale: no Intl.NumberFormat default (would be user-locale
  // and produce fabricated formatting). We just emit the raw integer
  // amount with a thousands-separator and the ISO currency code.
  const parts = String(Math.round(m.amount)).split("");
  const withSep: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i > 0 && (parts.length - i) % 3 === 0) withSep.push(",");
    withSep.push(parts[i]);
  }
  return `${m.currency} ${withSep.join("")}`;
}
