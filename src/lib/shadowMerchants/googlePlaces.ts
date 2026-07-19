// Google Places API (New) client for shadow-profile enrichment.
//
// Uses the v1 API with field-mask pricing so we pay only for the
// fields we actually consume:
//   - Text Search Essentials: $32/1000 (~£0.025 per business)
//   - Contact enterprise (websiteUri): +$3/1000 (~£0.0025 per business)
//   - Basic fields (id, displayName, formattedAddress): free
//
// Total ~£0.028 per business enriched. 5,000/mo = ~£140.
// Google gives $200/mo credit to new accounts — first 6-8k lookups
// are effectively free.
//
// Docs: https://developers.google.com/maps/documentation/places/web-service/text-search

const PLACES_BASE = "https://places.googleapis.com/v1";
const API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";

export type PlacesEnrichment = {
  placeId:      string;
  displayName:  string | null;
  address:      string | null;
  phone:        string | null;
  website:      string | null;
  starRating:   number | null;
  reviewCount:  number | null;
};

/**
 * Text search for a business by name + city. Returns the top match
 * or null. Uses field mask to fetch only what we need — cost-optimal.
 */
export async function findPlace(opts: {
  businessName: string;
  city:         string | null;
  postcode:     string | null;
}): Promise<PlacesEnrichment | null> {
  if (!API_KEY) {
    console.warn("[googlePlaces] GOOGLE_PLACES_API_KEY not set — enrichment dry-run");
    return null;
  }

  const query = [opts.businessName, opts.city, opts.postcode].filter(Boolean).join(" ");

  const res = await fetch(`${PLACES_BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type":     "application/json",
      "X-Goog-Api-Key":   API_KEY,
      // Field mask: only pay for these fields (essentials + contact + atmosphere)
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.internationalPhoneNumber",
        "places.websiteUri",
        "places.rating",
        "places.userRatingCount"
      ].join(",")
    },
    body: JSON.stringify({
      textQuery:      query,
      regionCode:     "GB",         // restrict to UK
      languageCode:   "en",
      maxResultCount: 1
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`[googlePlaces] search failed ${res.status}`, errText.slice(0, 200));
    return null;
  }

  const data = (await res.json()) as {
    places?: Array<{
      id?:                      string;
      displayName?:             { text?: string };
      formattedAddress?:        string;
      internationalPhoneNumber?: string;
      websiteUri?:              string;
      rating?:                  number;
      userRatingCount?:         number;
    }>;
  };

  const top = (data.places || [])[0];
  if (!top?.id) return null;

  return {
    placeId:     top.id,
    displayName: top.displayName?.text          || null,
    address:     top.formattedAddress           || null,
    phone:       top.internationalPhoneNumber   || null,
    website:     top.websiteUri                 || null,
    starRating:  top.rating                     || null,
    reviewCount: top.userRatingCount            || null
  };
}
