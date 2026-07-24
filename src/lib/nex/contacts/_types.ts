// Contacts + Groups — shared types.
//
// V2 additions: tags · favourite · last_interaction · private notes ·
// activity timeline. Everything is optional so existing seed data
// doesn't need every field, and so the profile sheet can degrade
// gracefully when a contact is sparse.

// NEX Relationship Memory — small structured summary of what NEX has
// noticed about each connection over time. Three shapes so a friend,
// a business and a tradesperson get the right facts — framed as
// helpful recall ("what NEX remembers") not surveillance.
export type PersonalMemory = {
  kind: "personal";
  connected_at:        string;    // human-readable, e.g. "July 2026"
  first_conversation?: string;    // topic, e.g. "Travel recommendations"
  shared?:             string;    // last shared thing, e.g. "Restaurant recommendation"
  message_count?:      number;
};

export type TradeMemory = {
  kind: "trade";
  met_through?:     string;       // e.g. "NEX Discover"
  jobs_completed?:  number;
  last_booking?:    string;       // e.g. "Kitchen lighting"
};

export type BusinessMemory = {
  kind: "business";
  first_contacted_at: string;
  enquiries_count?:   number;
  // NOTE: Business Brain context — the merchant's real quote to
  // *this* user is allowed here (per two-context £-price rule).
  last_quote_gbp?:    number;
};

export type RelationshipMemory = PersonalMemory | TradeMemory | BusinessMemory;

// Chronological events NEX has captured about the relationship.
export type TimelineEventKind =
  | "connected"
  | "discovered"
  | "message"
  | "quote"
  | "booking"
  | "meeting"
  | "shared"
  | "group_joined"
  | "note_added";

export type TimelineEvent = {
  at:    string;    // human-readable date, e.g. "July 2026"
  kind:  TimelineEventKind;
  label: string;    // e.g. "Connected through Discovery"
};

// Small "what happened last" summary used on cards + at the top
// of the profile sheet.
export type LastInteraction = {
  at:            string;   // e.g. "2 days ago"
  last_message?: string;   // e.g. "See you Friday"
};

export type PersonalContact = {
  id:                 string;
  name:               string;
  photo_url:          string;
  connection_type:    string;                // e.g. "Friend", "Electrician"
  online:             boolean;
  location?:          string;
  last_seen_text?:    string;
  connection_history?: string;
  favourite?:         boolean;
  tags?:              string[];              // e.g. ["Friend", "Coffee", "Travel"]
  last_interaction?:  LastInteraction;
  private_notes?:     string;                // never leaves the user's device
  memory?:            PersonalMemory | TradeMemory;
  timeline?:          TimelineEvent[];
};

export type BusinessContact = {
  id:                string;
  name:              string;
  photo_url:         string;
  category:          string;
  location:          string;
  favourite?:        boolean;
  tags?:             string[];               // e.g. ["Supplier", "Tools", "Construction"]
  last_interaction?: LastInteraction;
  private_notes?:    string;
  memory?:           BusinessMemory;
  timeline?:         TimelineEvent[];
};

export type ContactGroup = {
  id:            string;
  name:          string;
  photo_url:     string;
  member_count:  number;
  type:          GroupType;
  favourite?:    boolean;
};

export type GroupType = "friends" | "family" | "business" | "community" | "project";

// Smart tabs at the top of the Contacts screen.
export type ContactsTab = "all" | "people" | "business" | "groups";
