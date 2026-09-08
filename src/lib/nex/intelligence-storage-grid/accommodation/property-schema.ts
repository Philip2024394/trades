// src/lib/nex/intelligence-storage-grid/accommodation/property-schema.ts
//
// NEX Accommodation Agent · Property Record Schema (Rule Book v2)
// Founder §9-§24 · §32 · Complete property intelligence checklist
//
// Every field carries required-provenance semantics per §30 (no fabrication).
// Structured room/bed intelligence per §11-§12 (Founder-mandated).
//
// Additive types. Does NOT modify Postgres columns.

import type {
  AccommodationUnitKind,
  BedType,
  BoardMealPlan,
  BreakfastKind,
  CanonicalAccommodationCategory,
  ImageClassification,
  ImageScope,
  PropertyStyleTag,
  PurposeSegmentTag,
  ServiceLevelTier,
} from "./taxonomy.js";
import type {
  CountryCode,
  EvidenceLabel,
  FreshnessState,
  KnowledgeStatus,
  ProvenanceRecord,
  TrustLayer,
} from "../types.js";

// ═══════════════════════════════════════════════════════════════════
// §9 · REQUIRED IDENTITY (Founder-mandated minimum)
// ═══════════════════════════════════════════════════════════════════

export interface PropertyIdentity {
  canonical_property_id: string;       // internal_id (uuid) OR public_listing_ref (#AC-YYYY-XXXXX)
  public_listing_ref: string;          // #AC-YYYY-XXXXX
  property_name: string;
  original_name: string | null;
  original_language: string | null;    // ISO 639-1
  translated_name: string | null;
  aliases: string[];
  canonical_category: CanonicalAccommodationCategory;  // one of the 7 · matches SQL enum
  extended_type_slug: string | null;                    // from taxonomy.ts (e.g. "ryokan" · "kos")
  source_type: string | null;                          // OSM/source raw type
  source_subtype: string | null;                       // OSM/source raw subtype
  brand: string | null;
  chain: string | null;
  independent: boolean | null;                         // true if not chain
  description: string | null;
  description_language: string | null;
  style_tags: PropertyStyleTag[];
  purpose_tags: PurposeSegmentTag[];
  service_level: ServiceLevelTier | null;
}

// ═══════════════════════════════════════════════════════════════════
// §10 · LOCATION
// ═══════════════════════════════════════════════════════════════════

export interface PropertyLocation {
  country_code: CountryCode;
  region: string | null;
  state_province: string | null;
  city: string;
  district: string | null;
  neighbourhood: string | null;
  street: string | null;
  address_full: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  geographic_confidence: number;       // 0..1
  city_centre_distance_km: number | null;
  airport_distance_km: number | null;
  station_distance_km: number | null;
  beach_distance_km: number | null;
}

// ═══════════════════════════════════════════════════════════════════
// §11-§12 · ROOM / UNIT INTELLIGENCE (Founder mandate · answerable bed questions)
// ═══════════════════════════════════════════════════════════════════

export interface BedConfiguration {
  bed_type: BedType;
  count: number;                       // e.g. 2 twin beds
  extra_bed_available: boolean | null;
  crib_cot_available: boolean | null;
}

export interface BathroomConfiguration {
  count: number;
  private: boolean | null;             // false = shared
  ensuite: boolean | null;
  has_shower: boolean | null;
  has_bathtub: boolean | null;
  has_toilet: boolean | null;
  has_bidet: boolean | null;
}

export interface PropertyView {
  city_view: boolean | null;
  garden_view: boolean | null;
  pool_view: boolean | null;
  sea_view: boolean | null;
  mountain_view: boolean | null;
  landmark_view: boolean | null;
  landmark_name: string | null;
}

/**
 * §11 · Room/Unit record.
 * Composes with existing nex.accommodation_room_type table (Slice A3 · 47 columns).
 */
export interface RoomUnitRecord {
  room_type_id: string;                          // matches SQL room_type_id
  property_ref: string;                          // FK to accommodation_business.public_listing_ref
  unit_kind: AccommodationUnitKind;              // §7 · room · suite · studio · villa · etc.
  room_name: string;
  original_room_name: string | null;
  translated_room_name: string | null;
  room_category: string | null;                  // "deluxe" · "standard" · "family" · etc.
  bed_configurations: BedConfiguration[];
  total_beds: number;                            // sum across configurations
  maximum_occupancy: number | null;
  minimum_occupancy: number | null;
  adult_capacity: number | null;
  child_capacity: number | null;
  room_size: number | null;
  room_size_unit: "sqm" | "sqft" | null;
  bedroom_count: number | null;
  bathrooms: BathroomConfiguration[];
  bathroom_count: number | null;
  has_kitchen: boolean | null;
  has_kitchenette: boolean | null;
  has_refrigerator: boolean | null;
  has_microwave: boolean | null;
  has_cooking_facilities: boolean | null;
  has_balcony: boolean | null;
  has_terrace: boolean | null;
  has_patio: boolean | null;
  has_garden: boolean | null;
  has_private_pool: boolean | null;
  view: PropertyView | null;
  has_air_conditioning: boolean | null;
  has_heating: boolean | null;
  has_soundproofing: boolean | null;
  has_desk: boolean | null;
  has_workspace: boolean | null;
  has_wardrobe: boolean | null;
  has_safe: boolean | null;
  has_television: boolean | null;
  has_streaming: boolean | null;
  has_minibar: boolean | null;
  has_coffee_machine: boolean | null;
  has_kettle: boolean | null;
  accessibility_features: string[];
  smoking_status: "SMOKING" | "NON_SMOKING" | "UNKNOWN";
  pet_allowed: boolean | null;
  daily_housekeeping: boolean | null;
  room_description: string | null;
  evidence_ref_ids: string[];
  source: string;
  confidence: number;                            // 0..1
  freshness_state: FreshnessState;
  trust_layer: TrustLayer;
  provenance: ProvenanceRecord;
}

// ═══════════════════════════════════════════════════════════════════
// §13 · FACILITIES (property-level · not per-room)
// ═══════════════════════════════════════════════════════════════════

/**
 * Extensible facility vocabulary. Values populate the existing
 * `amenities` TEXT[] column but with structured typing here.
 */
export type Facility =
  | "swimming_pool" | "indoor_pool" | "outdoor_pool" | "private_pool" | "infinity_pool" | "kids_pool"
  | "hot_tub" | "jacuzzi" | "spa" | "sauna" | "steam_room" | "gym" | "fitness_centre"
  | "restaurant" | "restaurants_multi" | "bar" | "rooftop_bar" | "cafe" | "breakfast_room"
  | "room_service" | "parking" | "private_parking" | "valet_parking" | "ev_charging"
  | "wifi" | "air_conditioning" | "heating" | "laundry" | "dry_cleaning"
  | "24_hour_reception" | "concierge" | "luggage_storage"
  | "airport_shuttle" | "airport_transfer"
  | "business_centre" | "meeting_rooms" | "conference_facilities"
  | "garden" | "terrace" | "beach_access" | "private_beach"
  | "ski_access" | "golf_facilities" | "tennis"
  | "kids_club" | "playground" | "pet_facilities"
  | "wheelchair_accessible" | "elevator" | "security";

export interface FacilityAssertion {
  facility: Facility;
  present: boolean;
  quantity: number | null;
  hours: string | null;
  free_of_charge: boolean | null;
  additional_fee: boolean | null;
  evidence_ref_ids: string[];
  confidence: number;
  status: KnowledgeStatus;
  trust_layer: TrustLayer;
  freshness_state: FreshnessState;
}

// ═══════════════════════════════════════════════════════════════════
// §14 · SERVICES
// ═══════════════════════════════════════════════════════════════════

export type Service =
  | "breakfast" | "room_service" | "housekeeping" | "daily_housekeeping"
  | "laundry" | "dry_cleaning" | "concierge"
  | "airport_transfer" | "car_rental" | "tour_desk" | "ticket_service"
  | "luggage_storage" | "24_hour_reception" | "wake_up_service"
  | "childcare" | "babysitting" | "massage" | "spa_treatments"
  | "restaurant_reservation" | "shuttle" | "valet" | "business_services";

export interface ServiceAssertion {
  service: Service;
  available: boolean;
  included_in_rate: boolean | null;
  additional_fee: boolean | null;
  hours: string | null;
  evidence_ref_ids: string[];
  confidence: number;
  status: KnowledgeStatus;
  trust_layer: TrustLayer;
  freshness_state: FreshnessState;
}

// ═══════════════════════════════════════════════════════════════════
// §15-§17 · FOOD, BREAKFAST, BOARD
// ═══════════════════════════════════════════════════════════════════

export interface FoodAndDrinkOffering {
  has_restaurant: boolean | null;
  restaurant_count: number | null;
  restaurant_cuisines: string[];
  has_bar: boolean | null;
  has_cafe: boolean | null;
  has_pool_bar: boolean | null;
  has_rooftop_bar: boolean | null;
  has_room_service: boolean | null;
  halal_options: boolean | null;
  vegetarian_options: boolean | null;
  vegan_options: boolean | null;
  gluten_free_options: boolean | null;
  dietary_options_other: string[];
  breakfast: BreakfastOffering;
  board_plans_available: BoardMealPlan[];
  evidence_ref_ids: string[];
}

export interface BreakfastOffering {
  kind: BreakfastKind;
  included_in_rate: boolean | null;
  price_local_currency: number | null;
  price_currency_code: string | null;
  hours: string | null;
  service_style: "buffet" | "table_service" | "grab_and_go" | "unknown" | null;
}

// ═══════════════════════════════════════════════════════════════════
// §18-§19 · IMAGES (first-class)
// ═══════════════════════════════════════════════════════════════════

export interface AccommodationImage {
  image_id: string;                    // UUID
  property_ref: string;
  room_type_id: string | null;         // when linked to a specific room (§19)
  source: string;
  source_url: string;
  collection_time_iso: string;
  content_hash: string;                // SHA-256[:24]
  perceptual_hash: string | null;      // for dedup across small changes
  classification: ImageClassification;
  scope: ImageScope;                   // PROPERTY_GENERAL when uncertain (§19)
  classification_confidence: number;
  width_px: number | null;
  height_px: number | null;
  rights_metadata: {
    licence: string | null;
    attribution: string | null;
    commercial_use_permitted: boolean | null;
  };
  provenance: ProvenanceRecord;
  status: KnowledgeStatus;
  freshness_state: FreshnessState;
  first_seen_iso: string;
  last_seen_iso: string;
  removed_from_source: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// §20 · PROPERTY-LEVEL POLICIES
// ═══════════════════════════════════════════════════════════════════

export interface PropertyPolicies {
  check_in_time: string | null;        // "14:00"
  check_out_time: string | null;       // "12:00"
  minimum_stay_nights: number | null;
  maximum_stay_nights: number | null;
  reception_hours: string | null;      // "24-hour" or "07:00-23:00"
  quiet_hours: string | null;
  smoking_policy: "NON_SMOKING_PROPERTY" | "SMOKING_AREAS_ONLY" | "SMOKING_ALLOWED" | "UNKNOWN";
  pet_policy: PetPolicy;
  children_policy: ChildrenPolicy;
  extra_bed_policy: string | null;
  crib_policy: string | null;
  cancellation_information: string | null;
  payment_methods: string[];
  evidence_ref_ids: string[];
}

export interface PetPolicy {
  pets_allowed: boolean | null;
  pet_types_allowed: string[];
  pet_fee_local_currency: number | null;
  pet_fee_currency_code: string | null;
  pet_restrictions: string | null;
  pet_facilities: string[];
}

export interface ChildrenPolicy {
  children_allowed: boolean | null;
  age_restriction_min: number | null;
  age_restriction_max: number | null;
  family_rooms_available: boolean | null;
  crib_available: boolean | null;
  extra_bed_available: boolean | null;
  kids_pool: boolean | null;
  kids_club: boolean | null;
  playground: boolean | null;
  babysitting_service: boolean | null;
}

// ═══════════════════════════════════════════════════════════════════
// §21 · ACCESSIBILITY
// ═══════════════════════════════════════════════════════════════════

export interface AccessibilityFeatures {
  wheelchair_access: boolean | null;
  accessible_entrance: boolean | null;
  accessible_room_available: boolean | null;
  accessible_bathroom_available: boolean | null;
  elevator: boolean | null;
  ground_floor_access: boolean | null;
  accessible_parking: boolean | null;
  visual_assistance: boolean | null;
  hearing_assistance: boolean | null;
  evidence_ref_ids: string[];
}

// ═══════════════════════════════════════════════════════════════════
// §24 · NEARBY WORLD (cross-domain relationship references)
// ═══════════════════════════════════════════════════════════════════

export interface NearbyReference {
  category: "restaurant" | "cafe" | "bar" | "supermarket" | "pharmacy" | "hospital"
          | "clinic" | "airport" | "rail_station" | "bus_station" | "metro" | "tram"
          | "attraction" | "museum" | "beach" | "shopping" | "market" | "nightlife"
          | "park" | "gym" | "golf" | "university" | "business_district" | "office"
          | "religious_site" | "tourist_area";
  target_domain: "food" | "travel" | "healthcare" | "transport" | "business" | "vision";
  target_entity_ref: string | null;               // canonical entity ref when linkable
  target_display_name: string;
  distance_km: number;
  bearing_degrees: number | null;
  confidence: number;
  freshness_state: FreshnessState;
  evidence_ref_ids: string[];
}

// ═══════════════════════════════════════════════════════════════════
// §32 · WORLD-CLASS COMPLETE PROPERTY RECORD (the aspiration)
// ═══════════════════════════════════════════════════════════════════

export interface WorldClassPropertyRecord {
  identity: PropertyIdentity;
  location: PropertyLocation;
  rooms: RoomUnitRecord[];
  facilities: FacilityAssertion[];
  services: ServiceAssertion[];
  food_and_drink: FoodAndDrinkOffering | null;
  policies: PropertyPolicies;
  accessibility: AccessibilityFeatures;
  images: AccommodationImage[];
  nearby: NearbyReference[];
  evidence: {
    total_evidence_refs: number;
    verified_field_count: number;
    unverified_field_count: number;
    conflicting_field_count: number;
    unknown_field_count: number;
    provenance_coverage_pct: number;
  };
  freshness: {
    last_full_refresh_iso: string | null;
    oldest_field_written_at_iso: string | null;
    stale_field_count: number;
    fresh_field_count: number;
  };
  quality: {
    completeness_pct: number;          // populated required-field ratio
    evidence_coverage_pct: number;
    overall_confidence: number;
    evidence_label: EvidenceLabel;
  };
  version: string;                     // "v2.rulebook.2026-09-08"
  measured_at_iso: string;
}

// ═══════════════════════════════════════════════════════════════════
// Deterministic completeness scorer (Founder §32 · never fabricate)
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute how complete a property record is, based on presence of required
 * fields. Missing fields count as MISSING, not filled — NEVER inferred.
 */
export function computePropertyCompleteness(record: Partial<WorldClassPropertyRecord>): {
  completeness_pct: number;
  present_fields: string[];
  missing_fields: string[];
} {
  const required = [
    "identity.property_name",
    "identity.canonical_category",
    "location.city",
    "location.latitude",
    "location.longitude",
    "policies.check_in_time",
    "policies.check_out_time",
  ] as const;
  const richDesired = [
    "rooms.at_least_one",
    "facilities.at_least_one",
    "images.at_least_one",
    "food_and_drink.breakfast_kind",
    "nearby.at_least_one",
    "accessibility.wheelchair_access",
    "policies.pet_policy",
    "policies.children_policy",
  ] as const;

  const present: string[] = [];
  const missing: string[] = [];

  // Required
  if (record.identity?.property_name) present.push("identity.property_name"); else missing.push("identity.property_name");
  if (record.identity?.canonical_category) present.push("identity.canonical_category"); else missing.push("identity.canonical_category");
  if (record.location?.city) present.push("location.city"); else missing.push("location.city");
  if (record.location?.latitude != null) present.push("location.latitude"); else missing.push("location.latitude");
  if (record.location?.longitude != null) present.push("location.longitude"); else missing.push("location.longitude");
  if (record.policies?.check_in_time) present.push("policies.check_in_time"); else missing.push("policies.check_in_time");
  if (record.policies?.check_out_time) present.push("policies.check_out_time"); else missing.push("policies.check_out_time");

  // Rich desired
  if (record.rooms && record.rooms.length > 0) present.push("rooms.at_least_one"); else missing.push("rooms.at_least_one");
  if (record.facilities && record.facilities.length > 0) present.push("facilities.at_least_one"); else missing.push("facilities.at_least_one");
  if (record.images && record.images.length > 0) present.push("images.at_least_one"); else missing.push("images.at_least_one");
  if (record.food_and_drink?.breakfast?.kind && record.food_and_drink.breakfast.kind !== "NONE") present.push("food_and_drink.breakfast_kind"); else missing.push("food_and_drink.breakfast_kind");
  if (record.nearby && record.nearby.length > 0) present.push("nearby.at_least_one"); else missing.push("nearby.at_least_one");
  if (record.accessibility?.wheelchair_access !== null && record.accessibility?.wheelchair_access !== undefined) present.push("accessibility.wheelchair_access"); else missing.push("accessibility.wheelchair_access");
  if (record.policies?.pet_policy) present.push("policies.pet_policy"); else missing.push("policies.pet_policy");
  if (record.policies?.children_policy) present.push("policies.children_policy"); else missing.push("policies.children_policy");

  const total = required.length + richDesired.length;
  const pct = total === 0 ? 0 : Math.round((present.length / total) * 1000) / 10;
  return { completeness_pct: pct, present_fields: present, missing_fields: missing };
}
