// NEX Centre — types for the mobile discovery surface.
// Two card states: `claimed` (merchant onboarded, full profile) and
// `unclaimed` (Companies-House-only placeholder waiting to be claimed).
// WhatsApp deep-link only appears on claimed cards, and the CUSTOMER
// always initiates (no PECR/GDPR/WhatsApp-ToS exposure).

export type SupplierState = "claimed" | "unclaimed";

export type Supplier = {
  id:              string;
  state:           SupplierState;
  name:            string;
  category:        string;                // e.g. "Timber Merchant"
  tags?:           string[];              // e.g. ["Oak", "Delivery", "Trade prices"]
  location:        string;                // human, e.g. "Salford · 4 mi"
  distance_km?:    number;
  photo_url:       string;                // hero image
  logo_url?:       string;
  verified?:       boolean;               // Companies House verified
  featured?:       boolean;               // curated hero slot

  // Only present on `claimed` suppliers
  whatsapp_e164?:  string;                // e.g. "+447700900000"
  response_text?:  string;                // e.g. "Usually replies in 20 min"
  rating?:         number;                // 0-5, one decimal
  reviews_count?:  number;
  headline?:       string;                // merchant-authored one-liner
  hours_today?:    string;                // e.g. "Open · closes 6 PM"

  // On unclaimed cards, only public Companies House data is shown
  companies_house_no?: string;
};

export type CentreCategory = {
  id:     string;
  label:  string;
  emoji?: string;
};
