// NEX geography · single source of truth for country/region metadata.
//
// One Trade Centre · one URL · country is a first-class filter dimension.
// Never per-country routes. See project memory:
//   project_nex_trade_centre_international_architecture_2026_08_16.md
//
// The picker groups countries by region_group (Europe · North America ·
// APAC · MEA · South America). "Coming soon" markers are active:false —
// they render in the panel so the picker communicates the international
// shape from day one without lying about coverage.

export type CountryCode = "GB" | "IE" | "US" | "DE" | "FR" | "CA" | "AU";
export type RegionGroup =
  | "Europe"
  | "North America"
  | "APAC"
  | "MEA"
  | "South America";

export type Country = {
  code: CountryCode;
  name: string;
  short_name?: string;
  /** Canonical directory_seeds.country value. Never render this to customers. */
  db_value: string;
  region_group: RegionGroup;
  region_label: string;
  currency: "GBP" | "EUR" | "USD" | "CAD" | "AUD";
  address_format: "GB" | "IE" | "US" | "CA" | "AU";
  flag: string;
  active: boolean;
};

export const COUNTRIES: Country[] = [
  {
    code: "GB",
    name: "United Kingdom",
    short_name: "UK",
    db_value: "United Kingdom",
    region_group: "Europe",
    region_label: "Europe",
    currency: "GBP",
    address_format: "GB",
    flag: "🇬🇧",
    active: true,
  },
  {
    code: "IE",
    name: "Ireland",
    db_value: "Ireland",
    region_group: "Europe",
    region_label: "Europe",
    currency: "EUR",
    address_format: "IE",
    flag: "🇮🇪",
    active: true,
  },
  {
    code: "US",
    name: "United States",
    short_name: "USA",
    db_value: "USA",
    region_group: "North America",
    region_label: "North America",
    currency: "USD",
    address_format: "US",
    flag: "🇺🇸",
    active: true,
  },
  {
    code: "DE",
    name: "Germany",
    db_value: "Germany",
    region_group: "Europe",
    region_label: "Europe",
    currency: "EUR",
    address_format: "GB",
    flag: "🇩🇪",
    active: false,
  },
  {
    code: "FR",
    name: "France",
    db_value: "France",
    region_group: "Europe",
    region_label: "Europe",
    currency: "EUR",
    address_format: "GB",
    flag: "🇫🇷",
    active: false,
  },
  {
    code: "CA",
    name: "Canada",
    db_value: "Canada",
    region_group: "North America",
    region_label: "North America",
    currency: "CAD",
    address_format: "CA",
    flag: "🇨🇦",
    active: false,
  },
  {
    code: "AU",
    name: "Australia",
    db_value: "Australia",
    region_group: "APAC",
    region_label: "APAC",
    currency: "AUD",
    address_format: "AU",
    flag: "🇦🇺",
    active: true,
  },
];

export const REGION_GROUPS: RegionGroup[] = [
  "Europe",
  "North America",
  "APAC",
  "MEA",
  "South America",
];

const CODE_ALIASES: Record<string, CountryCode> = {
  GB: "GB",
  UK: "GB",
  IE: "IE",
  US: "US",
  USA: "US",
  DE: "DE",
  FR: "FR",
  CA: "CA",
  AU: "AU",
};

const DB_VALUE_TO_CODE: Record<string, CountryCode> = {
  "United Kingdom": "GB",
  Ireland: "IE",
  USA: "US",
  Germany: "DE",
  France: "FR",
  Canada: "CA",
  Australia: "AU",
};

export function findCountryByCode(code: string | null | undefined): Country | undefined {
  if (!code) return undefined;
  const normalised = CODE_ALIASES[code.toUpperCase()];
  if (!normalised) return undefined;
  return COUNTRIES.find((c) => c.code === normalised);
}

export function findCountryByDbValue(value: string | null | undefined): Country | undefined {
  if (!value) return undefined;
  const code = DB_VALUE_TO_CODE[value];
  return code ? COUNTRIES.find((c) => c.code === code) : undefined;
}

/** Flag emoji for a canonical directory_seeds.country value. Empty string when unknown. */
export function flagForDbValue(value: string | null | undefined): string {
  return findCountryByDbValue(value)?.flag ?? "";
}

/**
 * Translate an incoming country filter (from URL param, header, store) into
 * the canonical directory_seeds.country string. Returns undefined for "all"
 * or unrecognised inputs — caller should treat undefined as "no country
 * filter", not as an error.
 */
export function toDbCountryValue(input: string | null | undefined): string | undefined {
  if (!input || input === "all") return undefined;
  return findCountryByCode(input)?.db_value ?? undefined;
}

/**
 * Translate a directory_seeds.country string back to a CountryCode for the
 * picker / UI. Returns undefined if the DB value isn't in our COUNTRIES set.
 */
export function toCountryCode(dbValue: string | null | undefined): CountryCode | undefined {
  if (!dbValue) return undefined;
  return DB_VALUE_TO_CODE[dbValue];
}
