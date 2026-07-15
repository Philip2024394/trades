"use client";

// CanteenTabbedSection — the canteen home dashboard's core content
// section. Three tabs (Feed / Products / Jobs) render into the same
// scrollable strip so the section stays in prime real estate and the
// user never has to leave the page to browse.
//
// Quick Action buttons ("Products", "My Jobs") deep-link into the
// right tab via URL hash (#tab-products / #tab-jobs) so the tap-to-
// switch feels instant. Owners get a "+ Add" button in the section
// header when the active tab has an add flow.
//
// Row cards share a **landscape** template — image on the right,
// content on the left — matching the feed card language so posts,
// products, and jobs feel visually unified.

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Heart,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Star,
  Sparkles,
  MessageCircle,
  X,
  Map as MapIcon,
  MapPin,
  Clock,
  ShoppingBag
} from "lucide-react";
import type { CanteenProduct, CanteenDesign } from "@/lib/canteens";
import type { RotatorPost } from "@/components/xrated/yard/CanteenMobilePostsRotator";
import { competitorSlugsFor, tradeLabel as lookupTradeLabel } from "@/lib/tradeOff";
import { reviewsForMerchant, overallForReview } from "@/lib/reviews";
import { CanteenVariantPicker, type VariantSelectionState } from "@/components/xrated/yard/CanteenVariantPicker";
import { VerifiedContactButton } from "@/components/xrated/VerifiedContactButton";

const TAN = "#B8860B";
const TAN_SOFT = "#F5E9D3";
const BRAND_BLACK = "#0A0A0A";

type TabSlug = "feed" | "products" | "jobs" | "contact" | "trades" | "reviews" | "designs" | "about";
const TABS: { slug: TabSlug; label: string }[] = [
  { slug: "feed",     label: "Feed" },
  { slug: "about",    label: "About" },
  { slug: "products", label: "Products" },
  { slug: "designs",  label: "Projects" },
  { slug: "jobs",     label: "Jobs" },
  { slug: "contact",  label: "Contact" },
  { slug: "trades",   label: "Trades" },
  { slug: "reviews",  label: "Reviews" }
];

// Trade-aware label for the Designs tab. Kitchen fitters call their
// work "Kitchens" — leave that. Every other trade sees "Projects".
// Extend the map when a trade wants a specific noun (e.g. bathroom-
// fitter → "Bathrooms", tiler → "Rooms", scaffolder → "Sites").
const DESIGNS_LABEL_BY_TRADE: Record<string, { title: string; lower: string }> = {
  "kitchen-fitter":  { title: "Kitchens",   lower: "kitchens" },
  "bathroom-fitter": { title: "Bathrooms",  lower: "bathrooms" }
};
function designsLabelFor(tradeSlug: string | undefined): { title: string; lower: string } {
  return (tradeSlug && DESIGNS_LABEL_BY_TRADE[tradeSlug])
    ?? { title: "Projects", lower: "projects" };
}

// Demo designs — landscape image cards with header + text overlay. Real
// design data will land when the design gallery editor ships. Format
// matches what a kitchen supplier would populate: a hero image, a
// short catchy name, a tagline, and full description for the popup.
type DemoDesign = {
  id: string;
  /** Design reference number — printed on card + modal so customers can
   *  quote "Ref DS-101" when they message the merchant. Makes the
   *  connection between "which design" and "who to contact" trivial. */
  ref: string;
  imageUrl: string;
  /** Optional extra angles / detail shots. Rendered as rounded-square
   *  thumbnails in the design modal; tap to swap the main image.
   *  Max 3 additional (4 total with the hero) so it stays a focused
   *  "here's my kitchen" story rather than a scrolling gallery. */
  galleryUrls?: string[];
  name: string;
  tagline: string;
  description: string;
  style: string;
};

// Electrician projects — surfaced on Craig's canteen (uk-rated-
// electricians / any trade === "electrician") via demoDesignsForTrade
// below. Every image belongs to ONE project (twin-board + solar
// workshop install); more projects added as EP-102, EP-103 etc. when
// Philip sends more.
const DEMO_DESIGNS_ELECTRICIAN: DemoDesign[] = [
  {
    id: "ep1",
    ref: "EP-101",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2012_53_59%20AM.png",
    // galleryUrls holds the EXTRA gallery shots — do NOT repeat
    // imageUrl here or the popup shows the hero image twice.
    galleryUrls: [
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2012_58_47%20AM.png",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2012_59_51%20AM.png"
    ],
    name: "Workshop Power + Solar Hybrid",
    tagline: "Twin-board install, solar-linked heat + power",
    description: "Workshop power system with a twin-board setup — one board dedicated to the workshop machinery circuit, the second board isolating the house supply so nothing on the workshop side can trip the domestic circuits. Solar array integrated at the tie-in so the workshop's heat + electric load pulls from renewable first, grid second. Full first-fix + second-fix, SPD protection, EIC certificate and DNO notification handled end-to-end. Suits detached properties with garage or workshop separation. From £3,800 supply + fit; solar tie-in quoted per array size.",
    style: "Twin-Board Industrial"
  },
  {
    id: "ep2",
    ref: "EP-102",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2001_08_40%20AM.png",
    galleryUrls: [
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2001_15_42%20AM.png",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2001_10_15%20AM.png",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2001_22_55%20AM.png"
    ],
    name: "Electric Gate Installation",
    tagline: "Powered driveway gate — motor, controls, safety",
    description: "Full electric gate install for a residential driveway. Wired in the BFT motor + control board, photocells for obstruction detection, safety edge for BS EN 12453 compliance, keypad entry, and remote fobs. Fed from a dedicated circuit off the consumer unit with weatherproof isolator. Coordinated with the ironwork installer to time the electric work around the gate leaf delivery. From £2,800 supply + fit for a single-leaf setup; double-leaf and sliding variants quoted on visit.",
    style: "Powered Gate Automation"
  },
  {
    id: "ep3",
    ref: "EP-103",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2001_44_54%20AM.png",
    galleryUrls: [
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2001_37_59%20AM.png",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2001_45_23%20AM.png",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2001_47_34%20AM.png"
    ],
    name: "First + Second Fix · Dwellings & Offices",
    tagline: "Full-scope electrical fit, private + commercial",
    description: "Complete first-fix and second-fix electrical for private house dwellings and office fit-outs. First fix covers chases, back boxes, cable runs to the consumer unit, and pre-plaster testing — ready for the plasterer to skim. Second fix covers accessory install (sockets, switches, lighting, isolators), consumer unit tie-in, full BS 7671 testing, and EIC certificate. Coordinated with builder, plasterer, plumber and gas engineer to keep the site rolling. Typical duration 3-7 working days depending on scope. Domestic and small-commercial baseline; larger commercial units quoted on visit.",
    style: "First + Second Fix"
  },
  {
    id: "ep4",
    ref: "EP-104",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2002_18_13%20AM.png",
    galleryUrls: [
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2002_18_58%20AM.png",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2002_44_10%20AM.png"
    ],
    name: "Industrial Wire + Pipe Installation",
    tagline: "Commercial cable containment, conduit + tray",
    description: "Industrial-grade wire and pipe (conduit) installation for a commercial unit. SWA cabling on cable tray, galvanised steel conduit for surface containment, TP&N sub-boards, motor circuits and control-panel feeds. Full labour, IET Wiring Regs BS 7671 testing, EIC certificate and building-control notification included. Suits factories, workshops, warehouses, garages and any commercial fit-out where the fabric of the building can't be chased. Typical duration 5-10 working days depending on unit size.",
    style: "Industrial Containment"
  }
];

// Plumber projects — surfaced on James Holt's canteen (uk-verified-
// plumbers / any trade === "plumber") via demoDesignsForTrade below.
// Image placeholders reused from the trending library until Philip
// provides real project artwork.
const DEMO_DESIGNS_PLUMBER: DemoDesign[] = [
  {
    id: "pp1",
    ref: "PP-101",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2012_05_53%20AM.png",
    galleryUrls: [],
    name: "Master Bathroom Refurb + Walk-in Shower",
    tagline: "Full strip-out + wet room conversion",
    description: "Master bathroom transformed into a modern wet room. Old suite stripped, walls re-boarded and tanked, drainage rerouted to gulley, thermostatic shower valve fitted with rainhead + handset, back-to-wall WC + wall-hung vanity + LED mirror. Underfloor heating manifold tied into the existing central heating. Coordinated with a tiler for large-format porcelain walls + slip-resistant floor tile. Duration 8 working days. From £6,800 supply + fit (fixtures + tiles supplied separately).",
    style: "Wet Room Refurb"
  },
  {
    id: "pp2",
    ref: "PP-102",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2002_03_04%20PM.png",
    galleryUrls: [],
    name: "Full System Central Heating + Combi",
    tagline: "New Worcester boiler + 8-radiator rebuild",
    description: "Complete central heating replacement in a 4-bed detached. Old back-boiler removed, Worcester Bosch 4000 30kW combi installed in the utility, all pipework re-run in copper, 8 radiators sized to each room with TRVs, Nest smart thermostat, magnetic filter, powerflush of the flow-and-return before fill. Building Control notification handled end-to-end. 10-year manufacturer + 2-year workmanship warranty. From £5,400 supply + fit.",
    style: "Central Heating Install"
  },
  {
    id: "pp3",
    ref: "PP-103",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2002_01_34%20PM.png",
    galleryUrls: [],
    name: "Kitchen Plumbing · Island + Boiling Tap",
    tagline: "Full kitchen plumbing coordination",
    description: "Kitchen fit plumbing — routing water + waste to a central island for prep sink, main run to Belfast under-window sink with Quooker boiling water tap, waste-disposal unit tied to trap, dishwasher and washing-machine supply/waste, isolators on every appliance. Coordinated with kitchen fitter's install week so first-fix landed before carcasses went in. Duration 3 working days. From £1,850 labour (tap + WD unit supplied separately).",
    style: "Kitchen Plumbing"
  }
];

function demoDesignsForTrade(tradeSlug: string | undefined | null): DemoDesign[] {
  if (tradeSlug === "electrician") return DEMO_DESIGNS_ELECTRICIAN;
  if (tradeSlug === "plumber")     return DEMO_DESIGNS_PLUMBER;
  return DEMO_DESIGNS;
}

const DEMO_DESIGNS: DemoDesign[] = [
  {
    id: "d1",
    ref: "DS-101",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2012_31_13%20PM.png",
    galleryUrls: [
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2009_14_25%20PM.png",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2009_08_59%20PM.png",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2009_05_46%20PM.png"
    ],
    name: "Signature Handleless",
    tagline: "Bespoke to your space",
    description: "Full-height handleless doors with a soft-close mechanism, wrapped in a warm neutral palette. Quartz worktops with a matching upstand, integrated appliances, and hidden pantry storage. A design that reads calm and clean — every line intentional. Priced from £14,500 including install and 10-year cabinet warranty.",
    style: "Modern Handleless"
  },
  {
    id: "d2",
    ref: "DS-102",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2001_52_07%20PM.png",
    galleryUrls: [
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2002_16_52%20PM.png",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2002_20_49%20PM.png",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2002_44_16%20PM.png"
    ],
    name: "Walnut Statement Island",
    tagline: "Warm walnut, clean lines",
    description: "A wide central island in rich walnut, warming the room and balancing against light wall cabinets. Matt-finish undermount sink pairs with brushed brass taps and mitred-edge stone worktops. Integrated wine cooler and breakfast bar seating for four. Perfect for open-plan family homes where the kitchen is the social hub. From £18,900 fitted, typically installed in 3-4 weeks.",
    style: "Walnut Two-Tone"
  },
  {
    id: "d3",
    ref: "DS-103",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2001_49_21%20PM.png",
    galleryUrls: [
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2002_54_07%20PM.png",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2002_57_15%20PM.png",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2002_58_59%20PM.png",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2003_02_24%20PM.png"
    ],
    name: "Brushed Stainless",
    tagline: "Professional-grade finish",
    description: "Brushed stainless steel doors and worktops with soft-close mechanisms — the finish you see in restaurant kitchens, engineered for a family home. Hardwearing, hygienic, and virtually maintenance-free. Pairs with warm timber flooring to soften the industrial edge. Best in open-plan spaces where the metal can reflect light back into the room. From £17,400 supplied and fitted.",
    style: "Brushed Stainless"
  },
  {
    id: "d4",
    ref: "DS-104",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2001_46_41%20PM.png",
    galleryUrls: [
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2003_07_05%20PM.png",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2003_08_14%20PM.png",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2003_10_28%20PM.png",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2003_25_14%20PM.png",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2003_38_21%20PM.png"
    ],
    name: "Classic In-Frame",
    tagline: "Craftsmanship, no compromise",
    description: "In-frame painted doors with beaded detailing — the mark of a joiner-built kitchen. Solid oak worktops, Belfast sink, and a shaker dresser end. Built to last 30 years without a wobble. Ideal for period properties and Victorian terraces. From £22,400 including hand-finish paint job.",
    style: "Traditional"
  },
  {
    id: "d5",
    ref: "DS-105",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2001_37_29%20PM.png",
    galleryUrls: [
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2003_45_13%20PM.png",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2003_45_49%20PM.png",
      "https://ik.imagekit.io/9mrgsv2rp/Untitledsdsvvvv.png",
      "https://ik.imagekit.io/9mrgsv2rp/Untitledsdsvvvvf.png",
      "https://ik.imagekit.io/9mrgsv2rp/Untitledsdsvvvvff.png"
    ],
    name: "Compact Galley",
    tagline: "Small footprint, full function",
    description: "A galley layout designed for narrow terraces and flat conversions — every inch working hard. Corner pull-outs, integrated bin, tall pantry unit. Handleless doors keep the space feeling open. Works from 2.4m upwards. From £9,800 including appliances and install.",
    style: "Compact"
  },
  {
    id: "d6",
    ref: "DS-106",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2001_32_24%20PM.png",
    galleryUrls: [
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2008_58_14%20PM.png",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2008_59_27%20PM.png",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2009_00_24%20PM.png"
    ],
    name: "Open-Plan Showstopper",
    tagline: "Design-led, entertain-ready",
    description: "A statement piece for open-plan spaces — long island, waterfall worktop, floor-to-ceiling larder tower. Integrated seating and hidden charging points. Colour and finish tailored to your home during the design consultation. From £26,500, install in 4-5 weeks.",
    style: "Luxury Open-Plan"
  }
];

// Demo reviews for the Reviews tab. Real review data will land when
// the review submission UI ships. Format matches what the review
// system will emit: name, rating (1-5), body, date, verified flag.
type DemoReview = {
  id: string;
  reviewerName: string;
  reviewerCity: string;
  rating: number;
  body: string;
  createdAt: string;
  jobType: string;
  /** Reviewer photo. Falls back to black initials chip when missing. */
  avatarUrl?: string | null;
  /** Project photo — when present the card shows the work delivered
   *  as the large right-hand image. Overrides the avatar chip. */
  photoUrl?: string | null;
};

const DEMO_REVIEWS: DemoReview[] = [
  { id: "r1", reviewerName: "Rachel S.",   reviewerCity: "Sale",       rating: 5, body: "The joinery is spec you don't get from a showroom. On time, priced clearly, no callbacks.",                                       createdAt: new Date(Date.now() -  7 * 24 * 60 * 60 * 1000).toISOString(), jobType: "Kitchen refit" },
  { id: "r2", reviewerName: "Andrew D.",   reviewerCity: "Altrincham", rating: 5, body: "Full-height carcass fit-out. Turned my tired kitchen into something I'm proud of. Two-week turnaround.",                          createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(), jobType: "Full kitchen fit" },
  { id: "r3", reviewerName: "Priya M.",    reviewerCity: "Stockport",  rating: 4, body: "Great craftsmanship. Small delay on the worktop but communicated well throughout. Would hire again.",                              createdAt: new Date(Date.now() - 34 * 24 * 60 * 60 * 1000).toISOString(), jobType: "Cabinet refresh" },
  { id: "r4", reviewerName: "Sam B.",      reviewerCity: "Manchester", rating: 5, body: "First call for unusual bespoke work — anything our designers draw, his team builds. Six years running.",                          createdAt: new Date(Date.now() - 62 * 24 * 60 * 60 * 1000).toISOString(), jobType: "Custom joinery" },
  { id: "r5", reviewerName: "Emma T.",     reviewerCity: "Cheadle",    rating: 5, body: "Beautiful shaker doors and brushed brass handles. Clean site, tidy install, dust-free hand-back.",                                createdAt: new Date(Date.now() - 89 * 24 * 60 * 60 * 1000).toISOString(), jobType: "Shaker kitchen" },
  { id: "r6", reviewerName: "James O.",    reviewerCity: "Bolton",     rating: 4, body: "Solid work. Not the cheapest but you get what you pay for. Two years on and everything still perfect.",                            createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(), jobType: "Kitchen refit" }
];

// Demo trades for the Find Trades tab. When real trade signups roll
// in these will be pulled from the DB and filtered by competitor set
// server-side. For now this is a curated subset to prove the flow.
type DemoTrade = {
  slug: string;
  displayName: string;
  tradeSlug: string;
  city: string;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  whatsapp: string;
  bio: string;
};

const DEMO_TRADES: DemoTrade[] = [
  { slug: "demo-james-holt-plumbing",       displayName: "James Holt Plumbing & Gas", tradeSlug: "plumber",                 city: "Nottingham", rating: 4.9, reviewCount: 68, imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2002_03_04%20PM.png", whatsapp: "447700900450", bio: "Gas Safe. Boiler installs, radiator swaps." },
  { slug: "demo-craig-mcdermott-electrical", displayName: "Craig McDermott Electrical", tradeSlug: "electrician",             city: "Leeds",      rating: 4.8, reviewCount: 52, imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2001_26_18%20AM.png", whatsapp: "447700900461", bio: "NICEIC. Kitchen circuits + EV chargers." },
  { slug: "demo-sarah-yates-tiling",         displayName: "Sarah Yates Tiling",         tradeSlug: "tiler",                   city: "Sheffield",  rating: 5.0, reviewCount: 41, imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2008_44_32%20AM.png", whatsapp: "447700900472", bio: "Porcelain + natural stone. Splashbacks." },
  { slug: "demo-bob-watson-plastering",      displayName: "Bob Watson Plastering",      tradeSlug: "plasterer",               city: "Manchester", rating: 4.9, reviewCount: 74, imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2030,%202026,%2006_38_39%20PM.png", whatsapp: "447700900483", bio: "18 years. Skim, render, damp treatment." },
  { slug: "demo-anna-forde-decorating",      displayName: "Anna Forde Decorating",      tradeSlug: "painter",                 city: "Preston",    rating: 4.9, reviewCount: 33, imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2012_45_11%20AM.png", whatsapp: "447700900494", bio: "Farrow & Ball. Cabinet respraying." },
  { slug: "demo-danny-lawson-carpentry",     displayName: "Danny Lawson Joinery",       tradeSlug: "carpenter",               city: "Hull",       rating: 4.7, reviewCount: 22, imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2012_01_55%20AM.png", whatsapp: "447700900505", bio: "Bespoke joinery. Wardrobes, staircases." },
  { slug: "demo-steve-obrien-roofing",       displayName: "Steve O'Brien Roofing",      tradeSlug: "roofer",                  city: "Liverpool",  rating: 4.9, reviewCount: 58, imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2001_44_51%20PM.png", whatsapp: "447700900516", bio: "Slate, tile, flat roof. Lead flashing." },
  { slug: "demo-paul-webb-bricklaying",      displayName: "Paul Webb Bricklayer",       tradeSlug: "bricklayer",              city: "Bolton",     rating: 4.8, reviewCount: 39, imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2001_46_00%20PM.png", whatsapp: "447700900527", bio: "RSJ specialist. Open-plan builds." },
  { slug: "demo-ryan-cross-steel",           displayName: "Ryan Cross Steel Erector",   tradeSlug: "structural-steel-erector", city: "Glasgow",    rating: 4.7, reviewCount: 18, imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2002_34_38%20PM.png", whatsapp: "447700900538", bio: "Steel installs, RSJ lifts, mezzanines." }
];

function isLive(iso: string): boolean {
  return Date.now() - Date.parse(iso) < 5 * 60 * 1000;
}

function timeAgoShort(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

// Demo thumbnails keyed off author slug so demo posts always look
// consistent. Same technique as the LiveFeed rotator.
const DEMO_THUMBS = [
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2011_04_56%20PM.png",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2008_44_32%20AM.png",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2030,%202026,%2006_38_39%20PM.png",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2001_00_58%20AM.png"
];

// Default row count shown in the collapsed view. "See all" reveals
// this many MORE rows on top of the default (so expanded = default +
// DEFAULT_LIMIT reveal), giving the user a chunk to scan without a
// full page navigation.
const DEFAULT_LIMIT = 4;
const REVEAL_MORE = 10;

export function CanteenTabbedSection({
  canteenSlug,
  isHost: _isHost,
  posts,
  products,
  designs = [],
  hostDisplayName,
  hostFirstName,
  hostSlug,
  hostWhatsapp,
  tradeSlug,
  tradeLabel,
  hostRating,
  sendToTradeCenter = false,
  addressLine,
  postcode,
  city,
  postcodeArea,
  openingHours,
  bioShort,
  servicesOffered
}: {
  canteenSlug: string;
  isHost: boolean;
  posts: RotatorPost[];
  products: CanteenProduct[];
  /** DB-backed merchant designs. When empty, the tab falls back to the
   *  hardcoded DEMO_DESIGNS so a fresh merchant's page reads full during
   *  onboarding. The moment their first real design lands in the DB,
   *  real data takes over — no code change needed. */
  designs?: CanteenDesign[];
  hostDisplayName?: string;
  hostFirstName: string;
  /** Merchant slug — powers the Reviews tab lookup against the
   *  canonical `reviewsForMerchant()` source. Same reviews that appear
   *  on `/trade/{hostSlug}/reviews`. */
  hostSlug?: string;
  hostWhatsapp: string | null;
  /** Current trade slug — powers the Trades tab's competitor filter
   *  so Mike Watson (kitchen-fitter) never sees other kitchen fitters. */
  tradeSlug?: string | null;
  tradeLabel: string;
  hostRating: { avg: number; count: number } | null;
  /** When true, product quick-view + trending sheet render a "Buy on
   *  Trade Center" button alongside "Ask on WhatsApp" for any product
   *  that has a tradeCenterListingId. Sourced from the merchant's
   *  admin profile (`sendToTradeCenter`) — merchant explicitly opts in. */
  sendToTradeCenter?: boolean;
  addressLine?: string | null;
  postcode?: string | null;
  city?: string | null;
  postcodeArea?: string | null;
  openingHours?: string | null;
  /** Short "About Us" line pulled from the merchant admin record.
   *  Used by the About tab. When empty, the About tab still renders
   *  the location + trade summary + legal footer. */
  bioShort?: string | null;
  /** Discrete services the merchant offers — rendered as yellow-dot
   *  rows in the About tab under the "What we do best" header. */
  servicesOffered?: string[] | null;
}) {
  const [activeTab, setActiveTab] = useState<TabSlug>("feed");
  // Product detail lightbox — when set, the Products tab renders the
  // compact detail view for that product id instead of the row list.
  const [viewingProductId, setViewingProductId] = useState<string | null>(null);
  // Design quick-view — when set the Designs tab renders a popup modal
  // overlay showing the full design image + description + details.
  const [viewingDesignId, setViewingDesignId] = useState<string | null>(null);
  // Per-tab expanded state so switching tabs doesn't leak the "see
  // all" state across sections.
  const [expanded, setExpanded] = useState<Record<TabSlug, boolean>>({
    feed:     false,
    about:    false,
    products: false,
    jobs:     false,
    contact:  false,
    trades:   false,
    reviews:  false,
    designs:  false
  });
  const isExpanded = expanded[activeTab];
  const limit = isExpanded ? DEFAULT_LIMIT + REVEAL_MORE : DEFAULT_LIMIT;
  function toggleExpanded() {
    setExpanded((s) => ({ ...s, [activeTab]: !s[activeTab] }));
  }

  // Deep-link + Quick Action wiring. TWO paths that can switch the tab:
  //   1. `canteen:set-tab` CustomEvent — dispatched by Quick Action
  //      buttons on the same page. Bulletproof cross-browser.
  //   2. URL hash `#tab-{slug}` — supports direct deep-links from
  //      other surfaces and refresh persistence.
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Read hash on mount so a shared URL like /uk-kitchen-fitters#tab-jobs
    // opens on the right tab.
    const initial = window.location.hash.replace(/^#tab-/, "");
    if (initial === "products" || initial === "jobs" || initial === "feed" || initial === "about" || initial === "contact" || initial === "trades" || initial === "reviews" || initial === "designs") {
      setActiveTab(initial as TabSlug);
    }
    function handleSetTab(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const t = detail.tab;
      if (t === "products" || t === "jobs" || t === "feed" || t === "about" || t === "contact" || t === "trades" || t === "reviews" || t === "designs") {
        setActiveTab(t);
      }
    }
    function handleHashChange() {
      const h = window.location.hash.replace(/^#tab-/, "");
      if (h === "products" || h === "jobs" || h === "feed" || h === "about" || h === "contact" || h === "trades" || h === "reviews" || h === "designs") {
        setActiveTab(h as TabSlug);
      }
    }
    window.addEventListener("canteen:set-tab", handleSetTab as EventListener);
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("canteen:set-tab", handleSetTab as EventListener);
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  function selectTab(t: TabSlug) {
    setActiveTab(t);
    // Update the URL hash without triggering a scroll jump.
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#tab-${t}`);
    }
  }

  // Clear the product quick-view whenever the user leaves the Products
  // tab so returning to it starts on the list, not a stale detail.
  useEffect(() => {
    if (activeTab !== "products") setViewingProductId(null);
  }, [activeTab]);

  // Derived data — jobs are showcase posts with at least one photo.
  const jobs = useMemo(
    () => posts.filter((p) => p.imageUrl),
    [posts]
  );
  // Trades tab filters the demo list to complementary trades only.
  const complementaryTrades = useMemo(() => {
    if (!tradeSlug) return DEMO_TRADES;
    const banned = competitorSlugsFor(tradeSlug);
    return DEMO_TRADES.filter((t) => !banned.has(t.tradeSlug));
  }, [tradeSlug]);

  // Designs — real DB rows when the merchant has published any,
  // otherwise the hardcoded DEMO_DESIGNS fallback so the surface reads
  // full during onboarding. The moment merchant adds their first real
  // design, real data takes over — no code change required.
  const activeDesigns = useMemo<DemoDesign[]>(() => {
    if (!designs || designs.length === 0) return demoDesignsForTrade(tradeSlug);
    return designs.map((d) => ({
      id:          d.id,
      ref:         d.ref,
      imageUrl:    d.imageUrl,
      galleryUrls: d.galleryUrls,
      name:        d.name,
      tagline:     d.tagline ?? "",
      description: d.description ?? "",
      style:       d.style ?? ""
    }));
  }, [designs]);

  // Reviews — pulled from the canonical review store keyed by merchant
  // slug so the same reviews shown on `/trade/{hostSlug}/reviews` render
  // inside the Reviews tab. Falls back to DEMO_REVIEWS when the host
  // has no reviews on file yet.
  const reviews = useMemo<DemoReview[]>(() => {
    if (!hostSlug) return DEMO_REVIEWS;
    const merchantReviews = reviewsForMerchant(hostSlug);
    if (merchantReviews.length === 0) return DEMO_REVIEWS;
    return merchantReviews.map((r) => ({
      id:            r.id,
      reviewerName:  r.reviewer.displayName,
      reviewerCity:  r.reviewer.city,
      rating:        Math.round(overallForReview(r.scores)),
      body:          r.body,
      createdAt:     r.createdAt,
      jobType:       r.reviewer.tradeLabel,
      avatarUrl:     r.reviewer.avatarUrl,
      photoUrl:      r.photoUrls[0] ?? null
    }));
  }, [hostSlug]);

  // When the Products tab is focused on a specific product, swap the
  // header from the generic "Products" to that product's customer-
  // facing reference ("Item: K527"). Lets the merchant instantly know
  // which product a buyer is asking about ("we have your K527 up").
  const focusedProduct = viewingProductId
    ? products.find((p) => p.id === viewingProductId) ?? null
    : null;
  const productsLabel = focusedProduct?.ref
    ? `Item: ${focusedProduct.ref}`
    : focusedProduct
      ? `Item · ${focusedProduct.name.slice(0, 24)}${focusedProduct.name.length > 24 ? "…" : ""}`
      : "Products";

  const sectionLabel = activeTab === "feed" ? "Live Feed"
    : activeTab === "about" ? "About Us"
    : activeTab === "products" ? productsLabel
    : activeTab === "jobs" ? "Jobs"
    : activeTab === "trades" ? "Trades"
    : activeTab === "reviews" ? "Reviews"
    : activeTab === "designs" ? designsLabelFor(tradeSlug).title
    : "Contact";

  // Total items in the active list — powers the "N more" badge on
  // the See all button so users know how much is behind it.
  const totalForActive =
    activeTab === "feed" ? posts.length
    : activeTab === "products" ? products.length
    : activeTab === "jobs" ? jobs.length
    : activeTab === "trades" ? complementaryTrades.length
    : activeTab === "reviews" ? reviews.length
    : activeTab === "designs" ? activeDesigns.length
    : 0;
  const isContact = activeTab === "contact";
  const hiddenCount = Math.max(0, totalForActive - limit);
  const seeAllLabel = activeTab === "feed" ? "posts"
    : activeTab === "products" ? "products"
    : activeTab === "jobs" ? "jobs"
    : activeTab === "trades" ? "trades"
    : activeTab === "reviews" ? "reviews"
    : activeTab === "designs" ? designsLabelFor(tradeSlug).lower
    : "";

  const viewingDesign = viewingDesignId
    ? activeDesigns.find((d) => d.id === viewingDesignId) ?? null
    : null;

  return (
    <>
    <section id="canteen-tabbed">
      {/* Section header — label only, no tab controls. Content
          switches based on Quick Action button hash (#tab-products /
          #tab-jobs / #tab-contact / #tab-trades) since the 5 quick
          actions are the ONLY controls for this section. */}
      {/* Section label — hidden on the About tab per Philip: the About
          panel already has the company name as its own header, so an
          extra "About Us" label reads as redundant chrome. */}
      {activeTab !== "about" && (
        <div className="mb-1 flex items-center gap-1.5">
          <span className="text-[15px] font-black text-neutral-900">
            {sectionLabel}
          </span>
          {activeTab === "feed" && (
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: "#FFB300" }}
            />
          )}
          {/* Country flag — pushed right (ml-auto). Signals which
              country the merchant operates from now that "UK" is no
              longer in the canteen name (2026-07-15 international
              rebrand). Hardcoded to UK 🇬🇧 for demos; will read
              canteen.country when the field ships. Rendered as a
              round chip so the flag reads as an identity badge rather
              than raw emoji. */}
          <span
            aria-label="United Kingdom"
            title="United Kingdom"
            className="ml-auto flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border shadow-sm"
            style={{
              borderColor:     "rgba(0,0,0,0.10)",
              backgroundColor: "#F5F5F5",
              fontSize:        "13px",
              lineHeight:      "1"
            }}
          >
            🇬🇧
          </span>
        </div>
      )}

      {/* Trades tab disclaimer — honest positioning: platform helps
          the customer find, never vets the trades. Legal protection +
          fair-standing brand mark for Thenetworkers. */}
      {activeTab === "trades" && (
        <p className="mb-2 text-[11px] leading-snug text-neutral-500">
          Trades listed to help you find a tradesperson in your area — <span className="font-black text-neutral-700">we don&apos;t verify any trade.</span> Always do your own checks.
        </p>
      )}
      {activeTab === "reviews" && (
        <p className="mb-2 text-[11px] leading-snug text-neutral-500">
          Reviews left by customers on Thenetworkers — <span className="font-black text-neutral-700">unverified.</span> Treat them as guidance, not proof.
        </p>
      )}
      {activeTab === "designs" && (
        <p className="mb-2 text-[11px] leading-snug text-neutral-500">
          Call us today for your kitchen vision. Quote the design <span className="font-black text-neutral-700">Ref</span> when you get in touch.
        </p>
      )}

      {/* Content — landscape row cards, sliced to `limit`. No max
          height cap; the section grows as more rows reveal. */}
      <div className="relative">
        {activeTab === "feed" && (
          <FeedList
            posts={posts.slice(0, limit)}
            canteenSlug={canteenSlug}
            tradeLabel={tradeLabel}
          />
        )}
        {activeTab === "about" && (
          <AboutPanel
            canteenSlug={canteenSlug}
            hostDisplayName={hostDisplayName ?? hostFirstName}
            hostFirstName={hostFirstName}
            tradeLabel={tradeLabel}
            city={city ?? null}
            bioShort={bioShort ?? null}
            servicesOffered={servicesOffered ?? null}
          />
        )}
        {activeTab === "products" && (
          viewingProductId
            ? <ProductQuickView
                product={products.find((p) => p.id === viewingProductId) ?? null}
                canteenSlug={canteenSlug}
                hostSlug={hostSlug ?? canteenSlug}
                hostFirstName={hostFirstName}
                hostDisplayName={hostDisplayName ?? hostFirstName}
                hostWhatsapp={hostWhatsapp}
                hostRating={hostRating}
                tradeLabel={tradeLabel}
                city={city ?? null}
                sendToTradeCenter={sendToTradeCenter}
                onClose={() => setViewingProductId(null)}
              />
            : <ProductsList
                products={products.slice(0, limit)}
                canteenSlug={canteenSlug}
                hostRating={hostRating}
                onView={(id) => setViewingProductId(id)}
              />
        )}
        {activeTab === "jobs" && (
          <JobsList
            jobs={jobs.slice(0, limit)}
            canteenSlug={canteenSlug}
            hostSlug={hostSlug ?? canteenSlug}
            hostFirstName={hostFirstName}
            hostDisplayName={hostDisplayName ?? hostFirstName}
            hostWhatsapp={hostWhatsapp}
            tradeLabel={tradeLabel}
            city={city ?? null}
          />
        )}
        {activeTab === "trades" && (
          <TradesList trades={complementaryTrades.slice(0, limit)}/>
        )}
        {activeTab === "reviews" && (
          <ReviewsList reviews={reviews.slice(0, limit)}/>
        )}
        {activeTab === "designs" && (
          <DesignsList
            designs={activeDesigns.slice(0, limit)}
            onOpen={(id) => setViewingDesignId(id)}
          />
        )}
        {activeTab === "contact" && (
          <ContactCard
            canteenSlug={canteenSlug}
            hostSlug={hostSlug ?? canteenSlug}
            hostDisplayName={hostDisplayName ?? hostFirstName}
            hostFirstName={hostFirstName}
            hostWhatsapp={hostWhatsapp}
            tradeLabel={tradeLabel}
            addressLine={addressLine ?? null}
            postcode={postcode ?? null}
            city={city ?? null}
            postcodeArea={postcodeArea ?? null}
            openingHours={openingHours ?? null}
          />
        )}
      </div>

      {/* Expand / collapse control — sits at the bottom of the
          section. Reveals up to REVEAL_MORE more rows in-place, then
          the same button turns into a "Close" affordance. Only
          renders when there's more to show OR the section is
          already expanded. Hidden on the Contact tab (single card).
          Also hidden when a specific product is being viewed (the
          in-tab product detail has its own "View all products"
          exit affordance — showing the See all/Close toggle on top
          confuses the two navigation flows). */}
      {!isContact && !viewingProductId && (hiddenCount > 0 || isExpanded) && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={toggleExpanded}
            aria-expanded={isExpanded}
            className={`inline-flex items-center gap-1.5 border font-black uppercase tracking-wider transition active:scale-[0.97] ${
              isExpanded
                ? "h-7 rounded-md px-3 text-[11px]"
                : "h-9 rounded-full px-4 text-[11px]"
            }`}
            style={{
              backgroundColor: isExpanded ? "#991B1B" : "#FFB300",
              color:           isExpanded ? "#FFFFFF" : "#0A0A0A",
              borderColor:     isExpanded ? "#7F1D1D" : "#FFB300"
            }}
          >
            {isExpanded ? (
              <>
                <X size={12} strokeWidth={2.6}/>
                Close
              </>
            ) : (
              <>
                <ChevronDown size={12} strokeWidth={2.6}/>
                See all {seeAllLabel}
              </>
            )}
          </button>
        </div>
      )}

      {/* When expanded AND there's STILL more behind the extra reveal,
          a small "Open full page" link routes to the dedicated
          feed/products/jobs page for the deep browse. */}
      {!isContact && isExpanded && hiddenCount > REVEAL_MORE && (
        <div className="mt-2 flex justify-center">
          <Link
            href={activeTab === "feed"
              ? `/trade-off/yard/canteens/${canteenSlug}/feed`
              : activeTab === "products"
                ? `/trade-off/yard/canteens/${canteenSlug}/products`
                : `/trade-off/yard/canteens/${canteenSlug}/jobs`}
            className="inline-flex items-center gap-0.5 text-[11px] font-black uppercase tracking-wider"
            style={{ color: TAN }}
          >
            Open full page
            <ChevronRight size={11} strokeWidth={2.5}/>
          </Link>
        </div>
      )}
    </section>

    {/* Design popup modal — renders full image + description + details
        when a design card is tapped. Click backdrop or X to close. */}
    {viewingDesign && (
      <DesignModal
        design={viewingDesign}
        hostSlug={hostSlug ?? canteenSlug}
        hostFirstName={hostFirstName}
        hostDisplayName={hostDisplayName ?? hostFirstName}
        hostWhatsapp={hostWhatsapp}
        tradeLabel={tradeLabel}
        tradeSlug={tradeSlug}
        city={city ?? null}
        canteenSlug={canteenSlug}
        onClose={() => setViewingDesignId(null)}
      />
    )}
    </>
  );
}

// ─── Feed rows ─────────────────────────────────────────────

// Slow upward marquee for the Feed tab — posts float up continuously
// so the section reads as alive even when the tab is idle. Hovering
// (or long-pressing on touch) pauses the animation so the user can
// actually read what's on screen. Respects prefers-reduced-motion.
const FEED_MARQUEE_CSS = `
@keyframes canteen-feed-scroll-up {
  0%   { transform: translateY(0); }
  100% { transform: translateY(-50%); }
}
.canteen-feed-marquee {
  animation: canteen-feed-scroll-up 180s linear infinite;
  will-change: transform;
}
.canteen-feed-shell:hover .canteen-feed-marquee,
.canteen-feed-shell:active .canteen-feed-marquee {
  animation-play-state: paused;
}
@media (prefers-reduced-motion: reduce) {
  .canteen-feed-marquee { animation: none; }
}
`;

function FeedList({
  posts,
  canteenSlug,
  tradeLabel
}: {
  posts: RotatorPost[];
  canteenSlug: string;
  tradeLabel: string;
}) {
  if (posts.length === 0) return <EmptyRow label="No posts yet"/>;
  // Duplicate the list so the -50% keyframe loops seamlessly. Only
  // marquee when there are enough posts to justify it (>= 3) —
  // otherwise render static so the section doesn't look broken.
  const shouldMarquee = posts.length >= 3;
  const rows = shouldMarquee ? [...posts, ...posts] : posts;
  return (
    <>
      <style>{FEED_MARQUEE_CSS}</style>
      <div
        className={
          shouldMarquee
            ? "canteen-feed-shell relative overflow-hidden h-[min(60vh,520px)]"
            : ""
        }
        style={
          shouldMarquee
            ? {
                maskImage:
                  "linear-gradient(to bottom, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)"
              }
            : undefined
        }
      >
    <ul className={`flex flex-col ${shouldMarquee ? "canteen-feed-marquee" : ""}`}>
      {rows.map((p, i) => {
        const thumb = p.imageUrl || DEMO_THUMBS[
          (p.authorSlug.charCodeAt(0) + i) % DEMO_THUMBS.length
        ];
        return (
          <li key={`${p.id}-${i}`}>
            {i > 0 && (
              /* Dashed divider between posts. Inset 16px on each end.
                 Rendered as a `background-image` repeating linear-
                 gradient (not `border: dashed`) because the parent
                 `.canteen-feed-marquee` scrolls via `translateY` over
                 180s — browser-native dashed borders subpixel-shift
                 on every frame during transforms, which reads as a
                 flashing shimmer. A background gradient composites as
                 a single GPU layer that translates cleanly without
                 per-frame re-rasterisation. `translateZ(0)` promotes
                 the line to its own layer for extra stability. */
              <div
                aria-hidden
                style={{
                  height:          "1.5px",
                  marginLeft:      "16px",
                  marginRight:     "16px",
                  marginTop:       "10px",
                  marginBottom:    "10px",
                  backgroundImage: "repeating-linear-gradient(to right, #FFFFFF 0 6px, transparent 6px 12px)",
                  backgroundSize:  "12px 1.5px",
                  transform:       "translateZ(0)"
                }}
              />
            )}
            <Link
              href={`/trade-off/yard/canteens/${canteenSlug}/post?reply=${encodeURIComponent(p.id)}`}
              className="flex items-center gap-3 rounded-xl p-2 transition active:bg-neutral-900/[0.03]"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-1.5">
                  {p.authorAvatarUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.authorAvatarUrl}
                      alt=""
                      loading="lazy"
                      className="h-7 w-7 flex-shrink-0 rounded-full object-cover ring-[1.5px] ring-white"
                      style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.20)" }}
                      aria-hidden
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white ring-[1.5px] ring-white"
                      style={{ backgroundColor: TAN, boxShadow: "0 1px 2px rgba(0,0,0,0.20)" }}
                    >
                      {p.authorDisplayName.charAt(0)}
                    </span>
                  )}
                  <span className="truncate text-[12px] font-black text-neutral-900">
                    {p.authorDisplayName}
                  </span>
                  <span className="text-[11px] font-bold text-neutral-500">
                    · {timeAgoShort(p.createdAt)}
                  </span>
                  {isLive(p.createdAt) && (
                    <span
                      className="ml-auto rounded-md px-1.5 py-0.5 text-[11px] font-black uppercase tracking-[0.14em]"
                      style={{ backgroundColor: "rgba(184,134,11,0.15)", color: TAN }}
                    >
                      LIVE
                    </span>
                  )}
                </div>
                <p className="line-clamp-2 text-[11.5px] leading-snug text-neutral-800">
                  {p.body}
                </p>
                <div className="mt-1 flex items-center gap-3 text-[11px] font-black text-neutral-500">
                  <span className="inline-flex items-center gap-0.5">
                    <Heart size={11} strokeWidth={2.3}/>
                    {p.reactionsLike ?? 0}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <MessageSquare size={11} strokeWidth={2.3}/>
                    {p.replyCount ?? 0}
                  </span>
                  <span className="text-neutral-400">· {tradeLabel}</span>
                </div>
              </div>
              {/* Thumbnail — fills the tile so there's no cream/white
                  frame around the photo. Feed thumbnails are decorative
                  (not product spec shots) so cover-crop is acceptable
                  here — the trade-off memo about object-contain applies
                  to merchant / product / service / machine imagery. */}
              <div
                className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl shadow-sm sm:h-28 sm:w-28"
                aria-hidden
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumb}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
      </div>
    </>
  );
}

// ─── Product rows ──────────────────────────────────────────

function ProductsList({
  products,
  canteenSlug: _canteenSlug,
  hostRating,
  onView
}: {
  products: CanteenProduct[];
  canteenSlug: string;
  hostRating: { avg: number; count: number } | null;
  onView: (productId: string) => void;
}) {
  if (products.length === 0) return <EmptyRow label="No products yet"/>;
  return (
    <ul className="flex flex-col gap-2">
      {products.map((p) => {
        return (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onView(p.id)}
              className="flex w-full items-center gap-3 rounded-xl border bg-white p-2 text-left shadow-sm transition active:bg-neutral-50 active:scale-[0.99]"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div className="min-w-0 flex-1">
                {/* Item ref chip + Featured badge removed from the row
                    card 2026-07-15 — Ref lives on the product-focus
                    main image; row featured indicator was too noisy on
                    landscape list. Bulk-buy indicator stays because
                    it's data (progress toward group discount), not
                    decoration. */}
                {p.bulkBuy && (
                  <div className="mb-0.5">
                    <span
                      className="rounded-sm px-1 py-0.5 text-[11px] font-black uppercase tracking-wider text-white"
                      style={{ backgroundColor: "#166534" }}
                    >
                      Bulk · {p.bulkBuy.committedCount}/{p.bulkBuy.targetCount}
                    </span>
                  </div>
                )}
                <div className="line-clamp-2 text-[12.5px] font-black leading-tight text-neutral-900">
                  {p.name}
                </div>
                {p.blurb && (
                  <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-neutral-600">
                    {p.blurb}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-2 text-[11px] font-black text-neutral-700">
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[11px] shadow-sm"
                    style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
                  >
                    £{p.priceGbp}
                  </span>
                  {hostRating && (
                    <span className="inline-flex items-center gap-0.5 text-neutral-500">
                      <Star size={10} fill="currentColor" strokeWidth={0} style={{ color: "#F59E0B" }}/>
                      {hostRating.avg.toFixed(1)}
                    </span>
                  )}
                  {/* View product pill — visually reinforces that the
                      row expands to a compact detail view. Whole row is
                      still tappable; this pill just makes the action
                      obvious. */}
                  <span
                    className="ml-auto inline-flex h-6 items-center gap-0.5 rounded-full px-2 text-[11px] font-black uppercase tracking-wider shadow-sm"
                    style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
                  >
                    View
                    <ChevronRight size={10} strokeWidth={2.6}/>
                  </span>
                </div>
              </div>
              <div
                className="relative h-[68px] w-[68px] flex-shrink-0 overflow-hidden rounded-xl bg-neutral-100 shadow-sm sm:h-20 sm:w-20"
                aria-hidden
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.imageUrl}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Product Quick View (in-tab compact PDP) ───────────────
//
// Replaces the ProductsList when a row's View button is tapped.
// Compact detail card: image + name + price + description + specs +
// WhatsApp CTA + "See full details" link to the dedicated PDP page.

function ProductQuickView({
  product,
  canteenSlug,
  hostSlug,
  hostFirstName,
  hostDisplayName,
  hostWhatsapp,
  hostRating,
  tradeLabel,
  city,
  sendToTradeCenter = false,
  onClose
}: {
  product: CanteenProduct | null;
  canteenSlug: string;
  hostSlug: string;
  hostFirstName: string;
  hostDisplayName: string;
  hostWhatsapp: string | null;
  hostRating: { avg: number; count: number } | null;
  tradeLabel: string;
  city?: string | null;
  /** Merchant preference — when true AND the product has a
   *  tradeCenterListingId, we render a "Buy on Trade Center" button
   *  alongside "Ask on WhatsApp". */
  sendToTradeCenter?: boolean;
  onClose: () => void;
}) {
  if (!product) {
    return (
      <div className="rounded-xl border-2 border-dashed p-4 text-center text-[11px] font-bold text-neutral-500"
        style={{ borderColor: "rgba(139,69,19,0.20)" }}
      >
        Product not found.
        <button
          type="button"
          onClick={onClose}
          className="ml-2 rounded-full px-2 py-0.5 text-[11px] font-black text-white"
          style={{ backgroundColor: BRAND_BLACK }}
        >
          Back
        </button>
      </div>
    );
  }
  // Variant state — resolved by the CanteenVariantPicker when the
  // product has variants. When no variants, `variantState` stays null
  // and we fall back to the base product's fields.
  const [variantState, setVariantState] = useState<VariantSelectionState | null>(null);

  // Effective values — variant overrides beat product-level values.
  const effectivePriceGbp = variantState?.priceGbp ?? product.priceGbp;
  const effectiveImageUrl = variantState?.imageUrl || product.imageUrl;
  const variantSuffix = variantState?.label ? ` (${variantState.label})` : "";
  const outOfStockNote = variantState?.isOutOfStock ? " — is this variant back in stock?" : "";

  const waUrl = hostWhatsapp
    ? `https://wa.me/${hostWhatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
        `Hi ${hostFirstName}, I'm interested in "${product.name}${variantSuffix}" on Thenetworkers${outOfStockNote}. Can you tell me more?`
      )}`
    : null;

  // Trade Center deep-link carries the selected combo key so the
  // downstream PDP can preselect the same variant.
  const tcHref = product.tradeCenterListingId
    ? (() => {
        const params = new URLSearchParams();
        params.set("from", "canteen");
        params.set("slug", canteenSlug);
        if (variantState?.comboKey) params.set("v", variantState.comboKey);
        return `/tc/product/${product.tradeCenterListingId}?${params.toString()}`;
      })()
    : null;

  return (
    <div className="relative">
      {/* View all products — top-right pill. This is the ONLY back-to-list
          affordance in the product detail view. Replaces the yellow X
          close because "View all products" better signals what happens
          on tap (return to the products list, not "dismiss"). */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Back to all products"
        className="absolute right-2 top-2 z-10 inline-flex h-8 items-center gap-1 rounded-full px-3 text-[11px] font-black uppercase tracking-wider shadow-md active:scale-[0.95]"
        style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
      >
        <ChevronLeft size={12} strokeWidth={2.8}/>
        View all products
      </button>

      {/* Hero + thumb gallery — shared ImageGallery renders main
          image sharp (object-contain) + up to 3 additional shots
          from galleryUrls. Main image swaps to the variant image when
          the buyer picks a combo with an image override. */}
      <div className="overflow-hidden rounded-xl">
        <ImageGallery
          images={[effectiveImageUrl, ...(product.galleryUrls ?? [])]}
          altBase={product.name}
          overlay={
            product.bulkBuy ? (
              <span
                className="absolute left-2 top-2 rounded-sm px-1.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-white shadow-md"
                style={{ backgroundColor: "#166534" }}
              >
                Bulk · {product.bulkBuy.committedCount}/{product.bulkBuy.targetCount}
              </span>
            ) : null
          }
        />
      </div>

      {/* Body — no card wrapper, sits directly on the tab section bg */}
      <div className="pt-3">
        <div className="text-[14px] font-black leading-tight text-neutral-900">
          {product.name}
        </div>
        {/* Price — updates live as the buyer picks variants. Falls
            back to "Price on request" when the host hasn't set one. */}
        <div className="mt-0.5 text-[16px] font-black leading-none text-neutral-900">
          {effectivePriceGbp > 0 ? `£${effectivePriceGbp}` : (
            <span className="italic text-neutral-600">Price on request</span>
          )}
        </div>
        {product.blurb && (
          <p className="mt-0.5 text-[11.5px] leading-snug text-neutral-600">
            {product.blurb}
          </p>
        )}
        {hostRating && (
          <div className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-bold text-neutral-500">
            <Star size={10} fill="currentColor" strokeWidth={0} style={{ color: "#F59E0B" }}/>
            {hostRating.avg.toFixed(1)}
            <span className="text-neutral-400">· {hostRating.count} reviews</span>
          </div>
        )}
        {product.description && (
          <p className="mt-2 whitespace-pre-wrap text-[12px] leading-snug text-neutral-800">
            {product.description.length > 240
              ? product.description.slice(0, 240) + "…"
              : product.description}
          </p>
        )}
        {product.specs && product.specs.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1 text-[11px] leading-snug text-neutral-700">
            {product.specs.slice(0, 4).map((s, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span
                  aria-hidden
                  className="mt-1 inline-block h-1 w-1 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: TAN }}
                />
                {s}
              </li>
            ))}
          </ul>
        )}

        {/* Variant picker — renders only when the product has variants.
            Selected combo drives effectivePriceGbp / effectiveImageUrl
            (used in the price line and gallery above) and appears in
            the WhatsApp message + Trade Center URL below. */}
        {product.variants && (
          <div className="mt-3">
            <CanteenVariantPicker
              variants={product.variants}
              basePriceGbp={product.priceGbp}
              baseImageUrl={product.imageUrl}
              onChange={setVariantState}
            />
          </div>
        )}

        {/* Actions — dual button when the merchant has opted in
            (sendToTradeCenter) AND the product has a tradeCenterListingId.
            Otherwise just the WhatsApp button. Yellow "Ask on WhatsApp"
            always primary; dark green "Buy on Trade Center" secondary. */}
        {(waUrl || (sendToTradeCenter && tcHref)) && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {hostWhatsapp && (
              <VerifiedContactButton
                merchantSlug={hostSlug}
                merchantDisplayName={hostDisplayName}
                merchantFirstName={hostFirstName}
                merchantWhatsapp={hostWhatsapp}
                tradeLabel={tradeLabel}
                city={city}
                source="product-carousel"
                sourceLabel={`${hostFirstName}'s ${product.name}${variantSuffix} listing on Thenetworkers.app`}
                canteenSlug={canteenSlug}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-5 text-[11.5px] font-black uppercase tracking-wider text-white shadow-md active:scale-[0.98]"
                style={{ backgroundColor: "#166534" }}
              >
                <MessageCircle size={13} strokeWidth={2.6}/>
                Ask on WhatsApp
              </VerifiedContactButton>
            )}
            {sendToTradeCenter && tcHref && (
              <Link
                href={tcHref}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-5 text-[11.5px] font-black uppercase tracking-wider text-white shadow-md active:scale-[0.98]"
                style={{ backgroundColor: "#166534" }}
              >
                <ShoppingBag size={13} strokeWidth={2.6}/>
                Buy on Trade Center
                {effectivePriceGbp > 0 && (
                  <span className="ml-0.5 rounded-full bg-white/15 px-1.5 py-0.5 text-[11px]">
                    £{effectivePriceGbp}
                  </span>
                )}
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Job rows ──────────────────────────────────────────────

function JobsList({
  jobs,
  canteenSlug,
  hostSlug,
  hostFirstName,
  hostDisplayName,
  hostWhatsapp,
  tradeLabel,
  city
}: {
  jobs: RotatorPost[];
  canteenSlug: string;
  hostSlug: string;
  hostFirstName: string;
  hostDisplayName: string;
  hostWhatsapp: string | null;
  tradeLabel: string;
  city?: string | null;
}) {
  if (jobs.length === 0) return <EmptyRow label="No jobs uploaded yet"/>;
  return (
    <ul className="flex flex-col gap-2">
      {jobs.map((j, i) => {
        const thumb = j.imageUrl || DEMO_THUMBS[
          (j.authorSlug.charCodeAt(0) + i) % DEMO_THUMBS.length
        ];
        const jobsHref = `/trade-off/yard/canteens/${canteenSlug}/jobs`;
        return (
          <li key={j.id}>
            <div className="flex items-center gap-3 rounded-xl p-2 transition">
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 text-[11px] font-black uppercase tracking-[0.16em] text-neutral-500">
                  {tradeLabel} · {timeAgoShort(j.createdAt)}
                </div>
                <p className="line-clamp-2 text-[12px] font-black leading-tight text-neutral-900">
                  {j.body}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Link
                    href={jobsHref}
                    className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-black uppercase tracking-wider text-white shadow-sm"
                    style={{ backgroundColor: BRAND_BLACK }}
                  >
                    See
                    <ChevronRight size={10} strokeWidth={2.6}/>
                  </Link>
                  {hostWhatsapp && (
                    <VerifiedContactButton
                      merchantSlug={hostSlug}
                      merchantDisplayName={hostDisplayName}
                      merchantFirstName={hostFirstName}
                      merchantWhatsapp={hostWhatsapp}
                      tradeLabel={tradeLabel}
                      city={city}
                      source="canteen-hero"
                      sourceLabel={`one of ${hostFirstName}'s recent jobs on Thenetworkers.app`}
                      canteenSlug={canteenSlug}
                      className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-black uppercase tracking-wider text-white shadow-sm"
                      style={{ backgroundColor: "#166534" }}
                    >
                      <MessageCircle size={10} strokeWidth={2.5}/>
                      Book
                    </VerifiedContactButton>
                  )}
                </div>
              </div>
              <Link
                href={jobsHref}
                aria-label="See job details"
                className="relative block h-[68px] w-[68px] flex-shrink-0 overflow-hidden rounded-xl bg-neutral-100 shadow-sm sm:h-20 sm:w-20"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumb}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div
      className="rounded-xl border-2 border-dashed p-4 text-center text-[11px] font-bold text-neutral-500"
      style={{ borderColor: "rgba(139,69,19,0.20)" }}
    >
      {label}
    </div>
  );
}

// ─── About panel (in-tab About Us) ──────────────────────────
//
// Sourced from the canteen's admin record (`bioShort`, address, city).
// Fallback copy composes a short "trade + location" summary so a fresh
// canteen with no bio still reads full. Ends with a small legal-links
// row (Privacy · Terms · Cookie policy · © YEAR Thenetworkers.app).

function AboutPanel({
  canteenSlug,
  hostDisplayName,
  hostFirstName,
  tradeLabel,
  city,
  bioShort,
  servicesOffered
}: {
  canteenSlug: string;
  hostDisplayName: string;
  hostFirstName: string;
  tradeLabel: string;
  city: string | null;
  bioShort: string | null;
  servicesOffered: string[] | null;
}) {
  const bio = bioShort && bioShort.trim().length > 0
    ? bioShort
    : `${hostFirstName} is a ${tradeLabel}${city ? ` based in ${city}` : ""}. Get in touch via the Card action above to see full contact details and start a conversation.`;
  const year = new Date().getFullYear();
  return (
    <div className="flex flex-col gap-4 px-1">
      {/* Bio — no container. Sits directly on the section's cream so
          it reads as the merchant speaking, not a walled-off card. */}
      <div>
        <div className="text-[16px] font-black leading-tight text-neutral-900">
          {hostDisplayName}
        </div>
        <p className="mt-1.5 line-clamp-8 text-[13px] leading-relaxed text-neutral-700">
          {bio}
        </p>
      </div>

      {/* What we do best — same on-cream treatment as the bio. */}
      {servicesOffered && servicesOffered.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-500">
            What we do best..
          </div>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 md:flex md:flex-wrap md:items-center md:gap-x-5 md:gap-y-1.5">
            {servicesOffered.map((service) => (
              <li
                key={service}
                className="flex items-center gap-2 text-[12.5px] font-bold text-neutral-800"
              >
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: "#FFB300" }}
                />
                {service}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Legal + copyright — one combined link into the merchant's
          full legal notice page (which covers terms, privacy, and the
          under-18 reporting route). Powered-by copyright sits below. */}
      <div className="mt-2 flex flex-col items-center gap-1 pt-1 text-center">
        <Link
          href={`/trade-off/yard/canteens/${canteenSlug}/legal`}
          className="text-[12px] font-black uppercase tracking-[0.14em] text-neutral-500 hover:text-neutral-800"
        >
          {hostDisplayName}&apos;s terms &amp; privacy
        </Link>
        <div className="text-[12px] font-black uppercase tracking-[0.14em] text-neutral-400">
          Powered by{" "}
          <Link href="/" className="text-neutral-700 hover:text-neutral-900">
            Thenetworkers.app
          </Link>{" "}
          · © {year}
        </div>
      </div>
    </div>
  );
}

// ─── ImageGallery (shared by DesignModal + ProductQuickView) ──────
//
// Renders a main <img> (object-contain, sharp) with an optional row of
// rounded-square thumbnails below. Tap a thumb to swap the main image.
// Hidden entirely when there's only one image so single-image entries
// don't get an awkward one-thumb row.
//
// Design principle: max 4 total (1 hero + up to 3 additional). Beyond
// that a full gallery UI is warranted — this is meant to tell a focused
// "here's my kitchen" or "here's my product" story, not paginate.

function ImageGallery({
  images,
  altBase,
  overlay
}: {
  /** [hero, ...additional]. First image is the initial main. */
  images: string[];
  /** Alt-text prefix — the position index is appended per image. */
  altBase: string;
  /** Absolute-positioned overlays to render on top of the main image
   *  (chips, badges, etc). Renders inside the main-image container. */
  overlay?: React.ReactNode;
}) {
  const clean = images.filter((s) => s && s.trim().length > 0);
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => { setActiveIndex(0); }, [images]);
  if (clean.length === 0) return null;
  const active = clean[Math.min(activeIndex, clean.length - 1)];
  const showThumbs = clean.length > 1;

  return (
    <div className="w-full">
      {/* Main image — real <img> with object-contain so the full
          composition shows sharp, no CSS-scaled blur, no crop. */}
      <div className="relative w-full bg-neutral-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={active}
          alt={`${altBase} — image ${activeIndex + 1} of ${clean.length}`}
          className="block h-auto max-h-[60vh] w-full object-contain"
          loading="eager"
          decoding="async"
        />
        {overlay}
        {showThumbs && (
          <span
            className="absolute left-3 bottom-3 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-black tracking-wider text-white backdrop-blur"
          >
            {activeIndex + 1} / {clean.length}
          </span>
        )}
      </div>

      {/* Thumb row — hidden if there's only one image. Rounded-square
          (rectangles that read as "kitchen angles", not round chips
          which read as products). */}
      {showThumbs && (
        <div className="mt-2 flex items-center gap-2 px-1">
          {clean.slice(0, 6).map((src, i) => {
            const isActive = i === activeIndex;
            return (
              <button
                key={`${src}-${i}`}
                type="button"
                onClick={() => setActiveIndex(i)}
                aria-label={`Show image ${i + 1} of ${clean.length}`}
                className={`relative block h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg transition ${
                  isActive ? "" : "opacity-70 hover:opacity-100"
                }`}
                style={{
                  boxShadow: isActive
                    ? "0 0 0 2px #FFB300"
                    : "0 0 0 1px rgba(139,69,19,0.15)"
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  aria-hidden
                  className="block h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Contact card (in-tab) ─────────────────────────────────
//
// Full contact form rendered inline when the Contact tab is active.
// Structure (top → bottom):
//
//   1. Company header — name, address, phone number (tappable to call)
//   2. Form — name / email / phone / address / postcode / message
//   3. Submit button — opens WhatsApp with the whole form pre-filled
//      as one clean enquiry message. Falls back to mailto: when the
//      host hasn't published a WhatsApp number.
//   4. Google Maps embed below the submit button — landscape,
//      tappable to open the Google Maps directions app.

function ContactCard({
  canteenSlug,
  hostSlug,
  hostDisplayName,
  hostFirstName,
  hostWhatsapp,
  tradeLabel,
  addressLine,
  postcode,
  city,
  postcodeArea,
  openingHours
}: {
  canteenSlug: string;
  hostSlug: string;
  hostDisplayName: string;
  hostFirstName: string;
  hostWhatsapp: string | null;
  tradeLabel: string;
  addressLine: string | null;
  postcode: string | null;
  city: string | null;
  postcodeArea: string | null;
  openingHours: string | null;
}) {
  const fullAddress = [addressLine, postcode, city].filter(Boolean).join(", ");
  const anchor = fullAddress || city || postcodeArea || "the UK";
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(anchor)}&z=${fullAddress ? 15 : 10}&output=embed`;
  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(anchor)}`;
  const displayPhone = hostWhatsapp
    ? hostWhatsapp.startsWith("+") ? hostWhatsapp : `+${hostWhatsapp.replace(/^0/, "44 ")}`
    : null;

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPostcode, setCustomerPostcode] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildEnquiryText(): string {
    const lines: string[] = [];
    lines.push(`Hi ${hostFirstName}, enquiry from Thenetworkers:`);
    lines.push("");
    if (name) lines.push(`Name: ${name}`);
    if (email) lines.push(`Email: ${email}`);
    if (phone) lines.push(`Phone: ${phone}`);
    const custAddr = [customerAddress, customerPostcode].filter(Boolean).join(", ");
    if (custAddr) lines.push(`Address: ${custAddr}`);
    lines.push("");
    if (message) {
      lines.push(message);
    } else {
      lines.push(`Enquiring about ${tradeLabel.toLowerCase()}.`);
    }
    return lines.join("\n");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !message.trim()) {
      setError("Please add your name and a short message.");
      return;
    }
    setError(null);
    const text = buildEnquiryText();
    if (hostWhatsapp) {
      // Contact form already collected the customer's details in a
      // structured way — record the deduction intent on the platform,
      // then open WhatsApp with the pre-filled enquiry. Failures on the
      // deduct endpoint are swallowed so a slow/absent backend never
      // stalls the visitor's handoff to WhatsApp.
      try {
        await fetch(`/api/washers/deduct`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            merchantSlug: hostSlug,
            source: "canteen-contact-page",
            sourceLabel: `${hostFirstName}'s contact page on Thenetworkers.app`,
            guestName: name.trim(),
            guestWhatsapp: phone.trim() || email.trim() || "unknown",
            guestComment: message.trim()
          })
        });
      } catch {
        // ignore — proceed to WA handoff
      }
      const digits = hostWhatsapp.replace(/[^0-9]/g, "");
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    } else {
      // Fallback: mailto with the form contents. Email path skips the
      // washer deduct (no WhatsApp lead landed on the merchant).
      const subject = `Enquiry from ${name || "Thenetworkers"} · ${tradeLabel}`;
      window.location.href = `mailto:hello@thenetworkers.app?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    }
    setSent(true);
  }

  const submitLabel = hostWhatsapp ? "Send via WhatsApp" : "Send via Email";
  // Dark brand green matches the rest of the app's green accents
  // (WhatsApp deep-links elsewhere use the same tone).
  const submitColor = hostWhatsapp ? "#166534" : BRAND_BLACK;

  return (
    <div className="flex flex-col gap-3">
      {/* Company header — name, address, phone. No outer container:
          sits directly on the feed section background as a header
          strip. */}
      <div className="px-1">
        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-500">
          {tradeLabel}
        </div>
        <div className="mt-0.5 text-[14px] font-black leading-tight text-neutral-900">
          {hostDisplayName}
        </div>
        <div className="mt-1 flex flex-col gap-0.5 text-[11px] leading-snug text-neutral-700">
          <div className="inline-flex items-center gap-1">
            <MapPin size={11} strokeWidth={2.4} style={{ color: TAN }}/>
            <span className="font-bold">{anchor}</span>
          </div>
          {displayPhone && (
            <a
              href={`tel:${displayPhone.replace(/\s/g, "")}`}
              className="inline-flex items-center gap-1 font-black"
              style={{ color: BRAND_BLACK }}
            >
              <MessageCircle size={11} strokeWidth={2.4} style={{ color: TAN }}/>
              {displayPhone}
            </a>
          )}
          {openingHours && (
            <div className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-600">
              <Clock size={10} strokeWidth={2.3}/>
              {openingHours}
            </div>
          )}
        </div>
      </div>

      {/* Form — no outer card, fields sit directly in the tab section. */}
      {sent ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: "#166534" }}
          >
            <MessageCircle size={20} strokeWidth={2.4}/>
          </div>
          <div className="text-[13px] font-black text-neutral-900">Message ready to send</div>
          <p className="max-w-xs text-[11px] leading-snug text-neutral-600">
            {hostWhatsapp
              ? `WhatsApp opened with your enquiry — tap send in WhatsApp to reach ${hostFirstName}.`
              : `Email opened with your enquiry — tap send to reach ${hostFirstName}.`}
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="mt-1 inline-flex h-9 items-center gap-1 rounded-full border px-4 text-[11px] font-black uppercase tracking-wider text-neutral-800"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            Send another
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <FormField label="Your name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 100))}
              placeholder="e.g. Sam Butler"
              className="w-full rounded-lg border p-2 text-[12.5px] text-neutral-800"
              style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FAFAFA" }}
              required
            />
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.slice(0, 200))}
                placeholder="you@somewhere.co.uk"
                className="w-full rounded-lg border p-2 text-[12.5px] text-neutral-800"
                style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FAFAFA" }}
              />
            </FormField>
            <FormField label="Phone">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.slice(0, 20))}
                placeholder="07…"
                className="w-full rounded-lg border p-2 text-[12.5px] text-neutral-800"
                style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FAFAFA" }}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_100px] gap-2">
            <FormField label="Your address">
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value.slice(0, 200))}
                placeholder="Street, town"
                className="w-full rounded-lg border p-2 text-[12.5px] text-neutral-800"
                style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FAFAFA" }}
              />
            </FormField>
            <FormField label="Postcode">
              <input
                type="text"
                value={customerPostcode}
                onChange={(e) => setCustomerPostcode(e.target.value.toUpperCase().slice(0, 10))}
                placeholder="M33 7QR"
                className="w-full rounded-lg border p-2 text-[12.5px] font-mono text-neutral-800"
                style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FAFAFA" }}
              />
            </FormField>
          </div>
          <FormField label="Message" required>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
              rows={3}
              placeholder={`Hi ${hostFirstName}, I'd like a quote for…`}
              className="w-full resize-none rounded-lg border p-2 text-[12.5px] leading-relaxed text-neutral-800"
              style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FAFAFA" }}
              required
            />
          </FormField>

          {error && (
            <div className="text-[11px] font-black uppercase tracking-wider text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-full text-[12px] font-black uppercase tracking-wider text-white shadow-md transition active:scale-[0.98]"
            style={{ backgroundColor: submitColor }}
          >
            <MessageCircle size={14} strokeWidth={2.5}/>
            {submitLabel}
          </button>
        </form>
      )}

      {/* Map — landscape rectangle below the form. Whole surface is a
          tap-through to Google Maps directions; yellow "Directions"
          pill with map icon sits bottom-right. */}
      <a
        href={directionsHref}
        target="_blank"
        rel="noreferrer noopener"
        aria-label="Open in Google Maps for directions"
        className="relative block h-40 w-full overflow-hidden rounded-xl border sm:h-48"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <iframe
          title={`Map for ${hostDisplayName}`}
          src={mapSrc}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="pointer-events-none block h-full w-full"
          style={{ border: 0 }}
        />
        <span
          className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-lg"
          style={{ backgroundColor: "#FFB300" }}
        >
          <MapIcon size={12} strokeWidth={2.5}/>
          Directions
        </span>
      </a>
    </div>
  );
}

// ─── Trades rows (Find Trades tab) ─────────────────────────

function TradesList({ trades }: { trades: DemoTrade[] }) {
  if (trades.length === 0) return <EmptyRow label="No matching trades yet"/>;
  return (
    <ul className="flex flex-col gap-2">
      {trades.map((t) => {
        const label = lookupTradeLabel(t.tradeSlug);
        const tradeFirstName = t.displayName.split(" ")[0] ?? t.displayName;
        return (
          <li key={t.slug}>
            <div
              className="flex items-center gap-3 rounded-xl border bg-white p-2 shadow-sm transition"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-neutral-500">
                  {label} · {t.city}
                </div>
                <div className="mt-0.5 line-clamp-1 text-[13px] font-black leading-tight text-neutral-900">
                  {t.displayName}
                </div>
                <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-neutral-600">
                  {t.bio}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-black shadow-sm"
                    style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
                  >
                    <Star size={9} fill="currentColor" strokeWidth={0} style={{ color: "#0A0A0A" }}/>
                    {t.rating.toFixed(1)}
                  </span>
                  <span className="text-[11px] font-bold text-neutral-500">
                    {t.reviewCount} reviews
                  </span>
                  <VerifiedContactButton
                    merchantSlug={t.slug}
                    merchantDisplayName={t.displayName}
                    merchantFirstName={tradeFirstName}
                    merchantWhatsapp={t.whatsapp}
                    tradeLabel={label}
                    city={t.city}
                    source="canteen-hero"
                    sourceLabel={`${tradeFirstName}'s ${label} profile on Thenetworkers.app`}
                    ariaLabel={`WhatsApp ${t.displayName}`}
                    className="ml-auto inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[11px] font-black uppercase tracking-wider text-white shadow-sm"
                    style={{ backgroundColor: "#166534" }}
                  >
                    <MessageCircle size={10} strokeWidth={2.5}/>
                    Message
                  </VerifiedContactButton>
                </div>
              </div>
              <div
                className="relative h-[68px] w-[68px] flex-shrink-0 overflow-hidden rounded-xl bg-neutral-100 shadow-sm sm:h-20 sm:w-20"
                aria-hidden
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.imageUrl}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// Reviews marquee — same slow upward scroll pattern as the Feed tab.
// Keyframe named separately so both lists animate independently.
const REVIEWS_MARQUEE_CSS = `
@keyframes canteen-reviews-scroll-up {
  0%   { transform: translateY(0); }
  100% { transform: translateY(-50%); }
}
.canteen-reviews-marquee {
  animation: canteen-reviews-scroll-up 210s linear infinite;
  will-change: transform;
}
.canteen-reviews-shell:hover .canteen-reviews-marquee,
.canteen-reviews-shell:active .canteen-reviews-marquee {
  animation-play-state: paused;
}
@media (prefers-reduced-motion: reduce) {
  .canteen-reviews-marquee { animation: none; }
}
`;

function ReviewsList({ reviews }: { reviews: DemoReview[] }) {
  if (reviews.length === 0) return <EmptyRow label="No reviews yet"/>;
  const shouldMarquee = reviews.length >= 3;
  const rows = shouldMarquee ? [...reviews, ...reviews] : reviews;
  return (
    <>
      <style>{REVIEWS_MARQUEE_CSS}</style>
      <div
        className={
          shouldMarquee
            ? "canteen-reviews-shell relative overflow-hidden h-[min(60vh,520px)]"
            : ""
        }
        style={
          shouldMarquee
            ? {
                maskImage:
                  "linear-gradient(to bottom, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)"
              }
            : undefined
        }
      >
    <ul className={`flex flex-col gap-2 ${shouldMarquee ? "canteen-reviews-marquee" : ""}`}>
      {rows.map((r, i) => {
        const posted = new Date(r.createdAt);
        const daysAgo = Math.max(1, Math.floor((Date.now() - posted.getTime()) / (24 * 60 * 60 * 1000)));
        const timeLabel = daysAgo < 7
          ? `${daysAgo}d ago`
          : daysAgo < 30
            ? `${Math.floor(daysAgo / 7)}w ago`
            : `${Math.floor(daysAgo / 30)}mo ago`;
        const initials = r.reviewerName
          .split(" ")
          .map((s) => s[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
        return (
          <li key={`${r.id}-${i}`}>
            <div
              className="flex items-center gap-3 rounded-xl border bg-white p-2 shadow-sm transition"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-neutral-500">
                  {r.jobType} · {r.reviewerCity}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span
                    className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-black shadow-sm"
                    style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
                  >
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={9}
                        fill="currentColor"
                        strokeWidth={0}
                        style={{ color: i < r.rating ? "#0A0A0A" : "rgba(10,10,10,0.25)" }}
                      />
                    ))}
                  </span>
                  <span className="text-[11px] font-black text-neutral-900">
                    {r.reviewerName}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-neutral-700">
                  {r.body}
                </p>
                <div className="mt-1 text-[11px] font-bold text-neutral-500">
                  {timeLabel}
                </div>
              </div>
              {r.photoUrl || r.avatarUrl ? (
                <div
                  className="h-[68px] w-[68px] flex-shrink-0 overflow-hidden rounded-xl shadow-sm sm:h-20 sm:w-20"
                  style={{
                    backgroundImage: `url('${r.photoUrl ?? r.avatarUrl}')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundColor: "#F3F4F6"
                  }}
                  aria-hidden
                />
              ) : (
                <div
                  className="flex h-[68px] w-[68px] flex-shrink-0 items-center justify-center overflow-hidden rounded-xl text-[16px] font-black text-white shadow-sm sm:h-20 sm:w-20"
                  style={{ backgroundColor: BRAND_BLACK }}
                  aria-hidden
                >
                  {initials}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
      </div>
    </>
  );
}

function DesignsList({
  designs,
  onOpen
}: {
  designs: DemoDesign[];
  onOpen: (id: string) => void;
}) {
  if (designs.length === 0) return <EmptyRow label="No designs yet"/>;
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {designs.map((d) => (
        <li key={d.id}>
          <button
            type="button"
            onClick={() => onOpen(d.id)}
            aria-label={`View ${d.name} design`}
            className="group relative block aspect-[4/3] w-full overflow-hidden rounded-xl border bg-neutral-100 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={d.imageUrl}
              alt={d.name}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* Bottom-up gradient for text legibility */}
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-3/5"
              style={{
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.85) 15%, rgba(0,0,0,0.30) 60%, transparent 100%)"
              }}
            />
            {/* Style chip top-left */}
            <span
              className="absolute left-2 top-2 rounded-sm px-1.5 py-0.5 text-[11px] font-black uppercase tracking-wider shadow-md"
              style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
            >
              {d.style}
            </span>
            {/* Ref badge top-right — customers quote this when they
                message the merchant. Dark chip for high contrast on
                the light-image top corner. */}
            <span
              className="absolute right-2 top-2 rounded-sm px-1.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-white shadow-md"
              style={{ backgroundColor: "rgba(10,10,10,0.85)", backdropFilter: "blur(4px)" }}
            >
              Ref {d.ref}
            </span>
            {/* Header + tagline overlay */}
            <div className="absolute inset-x-0 bottom-0 p-2.5 text-left">
              <div className="text-[13px] font-black leading-tight text-white drop-shadow-md">
                {d.name}
              </div>
              <div className="mt-0.5 text-[11px] font-bold text-white/85 drop-shadow-sm">
                {d.tagline}
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function DesignModal({
  design,
  hostSlug,
  hostFirstName,
  hostDisplayName,
  hostWhatsapp,
  tradeLabel,
  tradeSlug,
  city,
  canteenSlug,
  onClose
}: {
  design: DemoDesign;
  hostSlug: string;
  hostFirstName: string;
  hostDisplayName: string;
  hostWhatsapp: string | null;
  tradeLabel: string;
  /** Trade slug drives the noun for this design surface — kitchen
   *  fitter → "Kitchen Design", bathroom fitter → "Bathroom Design",
   *  everyone else → "Project". Keeps copy trade-natural without
   *  cluttering per-design mock data. */
  tradeSlug?: string;
  city?: string | null;
  canteenSlug: string;
  onClose: () => void;
}) {
  // Trade-aware singular noun for THIS surface. Matches the plural
  // noun in designsLabelFor (Kitchens / Bathrooms / Projects).
  const singularNoun = tradeSlug === "kitchen-fitter"
    ? "Kitchen Design"
    : tradeSlug === "bathroom-fitter"
      ? "Bathroom Design"
      : "Project";
  const singularNounLower = singularNoun.toLowerCase();
  // Pre-filled WhatsApp deep link that includes the design ref so the
  // merchant instantly knows which project the customer is asking about.
  const waUrl = hostWhatsapp
    ? `https://wa.me/${hostWhatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
        `Hi ${hostFirstName}, I'm interested in the ${design.name} ${singularNounLower} (Ref ${design.ref}). Can you tell me more?`
      )}`
    : null;
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div
      aria-modal="true"
      role="dialog"
      aria-label={`${design.name} design details`}
      className="fixed inset-0 z-[100] flex items-center justify-center px-3 py-6"
      style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: "calc(100vh - 3rem)" }}
      >
        {/* Close — yellow chip so it reads as a positive dismiss action
            rather than a warning. Sits on the top-right corner of the
            entire modal (not the hero). */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full shadow-md transition active:scale-[0.95]"
          style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
        >
          <X size={16} strokeWidth={2.8}/>
        </button>

        {/* Hero + thumb gallery — shared ImageGallery renders main
            image sharp (object-contain) + optional 3 additional angles
            below. Chips overlay on the main image. */}
        <ImageGallery
          images={[design.imageUrl, ...(design.galleryUrls ?? [])]}
          altBase={`${design.name} ${singularNounLower}`}
          overlay={
            <>
              <span
                className="absolute left-3 top-3 rounded-sm px-1.5 py-0.5 text-[11px] font-black uppercase tracking-wider shadow-md"
                style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
              >
                {design.style}
              </span>
              <span
                className="absolute right-3 bottom-3 rounded-sm px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-white shadow-md"
                style={{ backgroundColor: "rgba(10,10,10,0.85)", backdropFilter: "blur(4px)" }}
              >
                Ref {design.ref}
              </span>
            </>
          }
        />

        {/* Details */}
        <div className="overflow-y-auto p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-neutral-500">
              {singularNoun} · Ref {design.ref}
            </div>
          </div>
          <h2 className="mt-0.5 text-[18px] font-black leading-tight text-neutral-900 md:text-[20px]">
            {design.name}
          </h2>
          <p className="mt-1 text-[12px] font-bold text-neutral-600 md:text-[13px]">
            {design.tagline}
          </p>
          <p className="mt-3 text-[12px] leading-relaxed text-neutral-700 md:text-[13px]">
            {design.description}
          </p>
          <p className="mt-3 rounded-lg border p-2.5 text-[11px] leading-relaxed text-neutral-900 md:text-[12px]"
             style={{ borderColor: "rgba(184,134,11,0.35)", backgroundColor: "#FFB300" }}>
            <span className="font-black text-neutral-900">Quote Ref {design.ref}</span> when you enquire — we&apos;ll pull the design straight up and can price it for your space.
          </p>

          {/* Enquire Now — dark green WhatsApp pill, pre-filled with the
              design ref so the merchant knows exactly which kitchen the
              customer means. Falls back to a disabled placeholder when
              the merchant hasn't published a WhatsApp number. */}
          <div className="mt-4">
            {hostWhatsapp ? (
              <VerifiedContactButton
                merchantSlug={hostSlug}
                merchantDisplayName={hostDisplayName}
                merchantFirstName={hostFirstName}
                merchantWhatsapp={hostWhatsapp}
                tradeLabel={tradeLabel}
                city={city}
                source="canteen-hero"
                sourceLabel={`${hostFirstName}'s ${design.name} ${singularNounLower} (Ref ${design.ref}) on Thenetworkers.app`}
                canteenSlug={canteenSlug}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full text-[13px] font-black uppercase tracking-wider text-white shadow-md transition active:scale-[0.98]"
                style={{ backgroundColor: "#166534" }}
              >
                <MessageCircle size={14} strokeWidth={2.6}/>
                Enquire Now
              </VerifiedContactButton>
            ) : (
              <span
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full border text-[13px] font-black uppercase tracking-wider text-neutral-500"
                style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#F9FAFB" }}
              >
                <MessageCircle size={14} strokeWidth={2.4}/>
                Contact details coming soon
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  required,
  children
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] font-black uppercase tracking-[0.14em] text-neutral-600">
        {label}{required && <span style={{ color: TAN }}> *</span>}
      </span>
      {children}
    </label>
  );
}
