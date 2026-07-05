// Knowledge Domain: Deliveries.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Moving stuff (materials, machines, people) to the site. Owns
// DeliverySlot + VehicleRun + DropManifest. Verticals extend with
// trade-specific fields (Merchant adds delivery-radius pricing;
// Plant Hire adds low-loader-vs-flatbed logic; Concrete Supplier
// adds volumetric-truck constraints).

import { knowledgeDomainRegistry } from "../registry";
import type { KnowledgeDomain } from "../types";

const domain: KnowledgeDomain = {
  id: "deliveries",
  name: "Deliveries",
  tagline: "From yard to site — routed, tracked, dropped.",
  description:
    "The horizontal contract for moving stuff. Owns DeliverySlot + VehicleRun + DropManifest and the DVSA + CDM compliance surface. Merchants + hire depots + concrete/aggregate suppliers all extend this.",
  version: "1.0.0",
  entities: [
    {
      id: "delivery-slot",
      name: "Delivery slot",
      description:
        "A booked window for a drop. Ties to a Deal + a vehicle run.",
      contract: {
        deal_id: "reference",
        vehicle_run_id: "reference",
        promised_start_at: "date",
        promised_end_at: "date",
        actual_start_at: "date",
        actual_end_at: "date",
        drop_postcode: "string",
        access_notes: "text"
      }
    },
    {
      id: "vehicle-run",
      name: "Vehicle run",
      description:
        "A single vehicle's route for a shift — start yard → drops → return.",
      contract: {
        vehicle_id: "reference",
        driver_id: "reference",
        started_at: "date",
        completed_at: "date",
        total_drops: "number",
        planned_mileage: "number",
        actual_mileage: "number"
      }
    },
    {
      id: "drop-manifest",
      name: "Drop manifest",
      description:
        "Everything on-board for one vehicle run — items, weights, offload requirements.",
      contract: {
        vehicle_run_id: "reference",
        total_weight_kg: "number",
        requires_hiab: "boolean",
        requires_grab: "boolean",
        item_count: "number"
      }
    }
  ],
  capabilities: [
    {
      id: "route-planning",
      name: "Route planning",
      description:
        "Optimise a set of drops into an efficient vehicle run. Postcode geocoding + turn-by-turn."
    },
    {
      id: "delivery-tracking",
      name: "Delivery tracking",
      description:
        "Customer-visible live tracking of their drop — ETA + driver contact."
    },
    {
      id: "driver-check-in",
      name: "Driver check-in",
      description:
        "Driver arrives on-site, photos + POD signature captured, stamp on the DeliverySlot."
    },
    {
      id: "load-manifest",
      name: "Load manifest",
      description:
        "Compose a DropManifest from selected drops, check total weight + offload equipment fit vehicle."
    },
    {
      id: "delivery-radius-pricing",
      name: "Delivery radius pricing",
      description:
        "Postcode → distance from yard → delivery-fee band. Free-inside-radius vs quoted-beyond model."
    }
  ],
  aiRetrieval: [
    {
      id: "typical-free-radius",
      description:
        "Typical UK trade delivery free-radius (5-15 miles) + threshold-value (£75-£150 order).",
      keywords: ["free delivery", "radius", "threshold"]
    },
    {
      id: "grab-hiab-when-needed",
      description:
        "When does a drop need a grab or hiab? Bulk-bag > 500kg, palletised goods without customer forklift.",
      keywords: ["grab", "hiab", "offload"]
    }
  ],
  integrations: [
    {
      id: "here-routing",
      name: "HERE Routing",
      category: "logistics",
      description:
        "Multi-stop route optimisation + live traffic. Paid tier for real usage."
    },
    {
      id: "mapbox-navigation",
      name: "Mapbox Navigation",
      category: "logistics",
      description:
        "Turn-by-turn navigation + live traffic. Generous free tier."
    },
    {
      id: "twilio-sms",
      name: "Twilio SMS",
      category: "communications",
      description:
        "Delivery ETA + status SMS to customers. Per-message pricing."
    },
    {
      id: "dvla-mot-lookup",
      name: "DVLA MOT History",
      category: "compliance-register",
      description:
        "Free public API — verify road-legal status of delivery vehicles."
    }
  ],
  compliance: [
    {
      id: "vehicle-mot-goods",
      name: "Goods vehicle MOT + PSV requirements",
      regulator: "DVSA",
      source: "https://www.gov.uk/mot-goods-vehicles"
    },
    {
      id: "drivers-hours-2005",
      name: "Community Drivers' Hours + Working Time Regs 2005",
      regulator: "DVSA",
      source:
        "https://www.legislation.gov.uk/uksi/2005/639/contents/made"
    },
    {
      id: "cdm-2015-site-drop",
      name: "CDM 2015 — construction site delivery safety",
      regulator: "HSE",
      source:
        "https://www.legislation.gov.uk/uksi/2015/51/contents/made"
    },
    {
      id: "operator-licence",
      name: "Operator's Licence — GB goods vehicles over 3.5t",
      regulator: "Traffic Commissioner / DVSA",
      source: "https://www.gov.uk/being-a-goods-vehicle-operator"
    }
  ],
  relatedDomains: ["materials", "staff", "vehicles", "assets", "scheduling"]
};

knowledgeDomainRegistry.register(domain);
export default domain;
