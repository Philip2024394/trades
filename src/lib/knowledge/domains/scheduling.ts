// Knowledge Domain: Scheduling.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Horizontal contract for time. Appointments, availability, calendar
// sync, buffer/travel time, blackout windows. Every service trade
// schedules something; every merchant trade schedules deliveries.
// Verticals extend with trade-specific rules (Plant Hire adds machine
// availability; Roofer adds weather-dependent windows).

import { knowledgeDomainRegistry } from "../registry";
import type { KnowledgeDomain } from "../types";

const domain: KnowledgeDomain = {
  id: "scheduling",
  name: "Scheduling",
  tagline: "Slots, buffers, blackouts, sync.",
  description:
    "The horizontal contract for time-bound work. Owns Appointment + Availability entities + sync with Google/Apple/Microsoft calendars. Verticals extend with trade-specific rules — weather-dependent windows for roofers, machine-availability blocks for plant hire.",
  version: "1.0.0",
  entities: [
    {
      id: "appointment",
      name: "Appointment",
      description:
        "A booked slot with a customer. Ties to a Deal + assigned resource.",
      contract: {
        deal_id: "reference",
        start_at: "date",
        end_at: "date",
        assigned_resource: "string",
        confirmation_status: "enum",
        location_postcode: "string"
      }
    },
    {
      id: "availability-slot",
      name: "Availability slot",
      description:
        "A window the merchant is available OR blocked. Blocking beats availability on conflict.",
      contract: {
        resource_id: "string",
        start_at: "date",
        end_at: "date",
        kind: "enum",
        reason: "string"
      }
    },
    {
      id: "calendar-sync-link",
      name: "Calendar sync link",
      description:
        "Two-way tie between the platform + external calendar (Google, Apple, Microsoft).",
      contract: {
        provider: "enum",
        external_calendar_id: "string",
        sync_direction: "enum",
        last_sync_at: "date"
      }
    }
  ],
  capabilities: [
    {
      id: "slot-lookup",
      name: "Slot lookup",
      description:
        "Given a duration + preferred window, return offered slots. Respects buffer + travel time."
    },
    {
      id: "calendar-sync",
      name: "Calendar sync",
      description:
        "Two-way with Google/Microsoft/iCal. Merchant blocks in their calendar propagate to the platform."
    },
    {
      id: "buffer-time",
      name: "Buffer time",
      description:
        "Configurable pre/post-appointment padding — prevents back-to-back bookings without breathing room."
    },
    {
      id: "travel-time",
      name: "Travel time",
      description:
        "Postcode → postcode driving estimate. Powers 'can we make this back-to-back?' decisions."
    },
    {
      id: "blackout-management",
      name: "Blackout management",
      description:
        "Recurring or one-off unavailability (bank holidays, annual leave, weather blackouts for roofers)."
    }
  ],
  aiRetrieval: [
    {
      id: "typical-appointment-duration",
      description:
        "Look up typical duration for a trade activity (bathroom fitter measure = 45min; boiler service = 1hr).",
      keywords: ["duration", "how long", "appointment"]
    },
    {
      id: "seasonal-window",
      description:
        "Which trades have seasonal availability constraints (roofer weather-dependent; landscaper Mar-Oct).",
      keywords: ["seasonal", "weather", "window"]
    }
  ],
  integrations: [
    {
      id: "google-calendar",
      name: "Google Calendar",
      category: "communications",
      description:
        "Two-way sync via Google Calendar API. OAuth-based. Free tier ample for individual merchants."
    },
    {
      id: "microsoft-graph-calendar",
      name: "Microsoft Graph Calendar",
      category: "communications",
      description:
        "Two-way sync for merchants running Microsoft 365. OAuth-based."
    },
    {
      id: "nylas",
      name: "Nylas",
      category: "communications",
      description:
        "Unified calendar API — Google + Microsoft + iCloud in one integration. Paid tier."
    },
    {
      id: "here-maps",
      name: "HERE Maps",
      category: "logistics",
      description:
        "Postcode → postcode driving times for travel-time calc. Free tier for low volume."
    }
  ],
  compliance: [
    {
      id: "working-time-regs-1998",
      name: "Working Time Regulations 1998 — daily/weekly rest requirements",
      regulator: "HSE",
      source:
        "https://www.legislation.gov.uk/uksi/1998/1833/contents/made"
    },
    {
      id: "driver-hours-2005",
      name: "The Community Drivers' Hours and Working Time Regulations 2005",
      regulator: "DVSA",
      source:
        "https://www.legislation.gov.uk/uksi/2005/639/contents/made"
    }
  ],
  relatedDomains: ["crm", "staff", "customers", "deliveries", "vehicles"]
};

knowledgeDomainRegistry.register(domain);
export default domain;
