// Add NEX-DESIGN-000029 as a STUB · Philip 2026-08-02.
// Primary image only · design_notes + qa awaiting Philip's dump.
// Marked as "pending_description" so we don't pretend to have knowledge we don't.

import { readFileSync, writeFileSync } from "node:fs";

const PATH = "data/nex-confirmed-images.json";
const d = JSON.parse(readFileSync(PATH, "utf8"));

const existing = d.confirmed.find((r) => r.design_id === "NEX-DESIGN-000029");
const now = new Date().toISOString();

const record = {
  design_id:            "NEX-DESIGN-000029",
  title:                "Pending description · Philip to author",
  design_family:        "Unclassified",
  primary_brain:        "staircase",
  url:                  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%202,%202026,%2006_32_10%20AM.png",
  additional_views:     [],
  view_types:           ["hero"],
  staircase_type:       "",
  layout:               "",
  materials:            [],
  balustrade_style:     "",
  handrail_style:       "",
  newel_style:          "",
  design_style:         "",
  project_suitability:  [],
  priority:             "hidden",           // do not surface in library until authored
  related_articles:     [],
  customer_description: "",
  designer_notes:       "Awaiting Philip's design description before this record can be published. Universal Q&A still applies for any question routed to this design.",
  confirmed_by:         "Philip O'Farrell",
  confirmed_at:         now,
  image_state:          "concept",
  families:             [],
  components:           [],
  design_notes:         "",
  qa:                   [],
};

if (existing) {
  Object.assign(existing, record);
  console.log("NEX-DESIGN-000029 (Nex029) · UPDATED stub");
} else {
  d.confirmed.push(record);
  console.log("NEX-DESIGN-000029 (Nex029) · CREATED stub · priority=hidden");
}
d.updated_at = now;
writeFileSync(PATH, JSON.stringify(d, null, 2), "utf8");

console.log("  URL:  ", record.url);
console.log("  Status: awaits description · priority=hidden so it does not appear in library");
