// How It Works — one topic per Trade Center surface.
//
// Every notebook section has its own focused explainer so trades never
// see copy about a feature they aren't looking at. Button labels also
// change per topic so the trigger explains what the panel will cover.

import {
  Send,
  ClipboardList,
  Calculator,
  ShieldCheck,
  Truck,
  PoundSterling,
  Package,
  Repeat,
  Receipt,
  Tag,
  FileText,
  MapPin,
  Briefcase,
  Home,
  MessageCircle,
  Heart,
  User,
  Store,
  ShoppingCart,
  Search,
  Bell,
  Route,
  Handshake,
  type LucideIcon
} from "lucide-react";

export type HowItWorksTopicKey =
  | "trade-center"
  | "trade-quote"
  | "trade-purchase"
  | "jobs"
  | "site-projects"
  | "quotation-list"
  | "clearance"
  | "past-orders"
  | "offers"
  | "templates"
  | "hub"
  | "marketplace"
  | "product"
  | "merchant-profile"
  | "settings-location"
  | "settings-recovery"
  | "identity"
  | "messages"
  | "orders"
  | "favourites"
  | "rates"
  | "routes"
  | "trade-counter"
  | "merchant-inbox"
  | "sign-in";

export type HowItWorksFeature = {
  Icon: LucideIcon;
  title: string;
  body: string;
};

export type HowItWorksTopic = {
  buttonLabel: string;          // Text on the trigger button
  headerLabel: string;          // Sub-line under the wordmark
  heroTitle: string;
  heroSubtitle: string;
  featuresTitle: string;
  features: HowItWorksFeature[];
  flowTitle?: string;
  flow?: string[];
  footerCta: string;
};

export const HOW_IT_WORKS_TOPICS: Record<HowItWorksTopicKey, HowItWorksTopic> = {
  // ─── Trade Center overall — the master explainer ─────────────────
  "trade-center": {
    buttonLabel:   "How Trade Center works",
    headerLabel:   "How it works",
    heroTitle:     "One buying floor for every job you run",
    heroSubtitle:  "Trade Center puts every verified merchant near you on one screen and lets them compete for your basket. Faster quotes, single delivery, zero commission — tuned to your postcode.",
    featuresTitle: "What Trade Center does for every job",
    features: [
      { Icon: Send,           title: "One bulk quote, every merchant at once",       body: "Your basket goes to the nearest verified merchants in one tap. They compete on price and delivery. Whoever prices wins." },
      { Icon: Package,        title: "Nearest merchant, matched automatically",       body: "Every item is auto-matched to the closest verified merchant. No shopping around. Nearest by default, never cheapest by default." },
      { Icon: Truck,          title: "One delivery, one arrival window",              body: "The winning merchant consolidates your order into a single delivery in the window you asked for." },
      { Icon: ShieldCheck,    title: "One trade identity for every merchant",         body: "Verified Trade Identity autofills every merchant's trade-account application. Apply to any merchant in one tap." },
      { Icon: PoundSterling,  title: "Zero commission on winning quotes",             body: "Trade Center never takes a cut of what you pay. The saving from merchants competing lands entirely in your pocket." }
    ],
    footerCta: "Got it — take me back"
  },

  // ─── Quote Me / Trade Quote flow ────────────────────────────────
  "trade-quote": {
    buttonLabel:   "How Trade Quote works",
    headerLabel:   "How Trade Quote works",
    heroTitle:     "One request. Nearest merchants compete.",
    heroSubtitle:  "Trade Quote turns your basket into a live tender. The nearest verified merchants price it against each other. You accept the winner in one tap.",
    featuresTitle: "What Trade Quote does",
    features: [
      { Icon: Send,        title: "Bulk request, one submit",                   body: "One tap sends every item in your basket to the nearest verified merchants — no per-item shopping around." },
      { Icon: Repeat,      title: "Live price competition",                     body: "Merchants see your whole basket and price it against each other. First to price with a good deal wins." },
      { Icon: Truck,       title: "Delivery timing on YOUR terms",              body: "Pick same-day / tomorrow / 3-5 days / 1 week. Merchants confirm their exact window when they reply." },
      { Icon: PoundSterling, title: "Cheapest total, most days",                body: "Because merchants compete on the whole basket, the total usually beats a-la-carte shopping — even without you asking for a discount." }
    ],
    flowTitle: "How a Trade Quote runs",
    flow: [
      "Add items to your Notebook basket.",
      "Set delivery address, timing, and receiver.",
      "Tap Quote My Project. Merchants get pinged.",
      "Compare replies side-by-side. Accept the winner.",
      "One consolidated delivery lands on site."
    ],
    footerCta: "Got it — take me back"
  },

  // ─── Trade Purchase (post-accept order + delivery) ──────────────
  "trade-purchase": {
    buttonLabel:   "How Trade Purchase works",
    headerLabel:   "How Trade Purchase works",
    heroTitle:     "Accept once. Delivery lands on site.",
    heroSubtitle:  "Trade Purchase kicks in the moment you accept a merchant's quote. Payment, dispatch, and delivery timing are already agreed — you just wait for the truck.",
    featuresTitle: "What Trade Purchase does",
    features: [
      { Icon: ShieldCheck, title: "Pay direct to the merchant",            body: "Payment stays between you and the winning merchant. Trade Center never touches the money — just the paperwork." },
      { Icon: Truck,       title: "Consolidated delivery",                 body: "The whole basket arrives in one drop, in the window the merchant confirmed. No stacked trips." },
      { Icon: Receipt,     title: "Everything filed under the job",        body: "The purchase auto-attaches to the Site Project. Invoice, delivery note, POD — all in one place." },
      { Icon: Repeat,      title: "Reorder in one tap",                    body: "Repeat jobs? Open the past request, tap Reorder. Basket refills instantly, ready to send again." }
    ],
    footerCta: "Got it — take me back"
  },

  // ─── Jobs / Site Projects ───────────────────────────────────────
  "jobs": {
    buttonLabel:   "How Jobs work",
    headerLabel:   "How Jobs work",
    heroTitle:     "Every job on one page",
    heroSubtitle:  "A Job is a live Site Project — safe UK address, delivery notes, and every quote/order that ever touched it in one place.",
    featuresTitle: "What Jobs do",
    features: [
      { Icon: MapPin,     title: "Safe UK address",              body: "Postcode lookup + What3Words fallback so drivers hit the right gate every time." },
      { Icon: Briefcase,  title: "Everything for the job in one place", body: "Materials, quotes, deliveries and merchant contacts — all under the job's name." },
      { Icon: Calculator, title: "Live job cost",                body: "Every material total drops onto the job the moment you accept a quote. Margin never surprises you." },
      { Icon: ClipboardList, title: "Reference in one tap",     body: "Send the job's address + directions to a driver, a merchant, or a subbie without retyping." }
    ],
    footerCta: "Got it — take me back"
  },

  // ─── Site Projects list ─────────────────────────────────────────
  "site-projects": {
    buttonLabel:   "How Site Projects work",
    headerLabel:   "How Site Projects work",
    heroTitle:     "Every site, mapped and organised",
    heroSubtitle:  "Every job you create becomes a Site Project — postcode-anchored, filterable, and always ready for the next quote.",
    featuresTitle: "What Site Projects do",
    features: [
      { Icon: MapPin,       title: "Postcode-anchored",             body: "Every project sits under its exact UK postcode. Filter by area, drive-time, or customer name." },
      { Icon: Briefcase,    title: "Live materials totals",         body: "Quotes and orders attached to each project stack into a live running total — no separate spreadsheet." },
      { Icon: ClipboardList, title: "Directions bundled",           body: "Notes like 'second gate on left' travel with the project so every merchant driver gets the same brief." }
    ],
    footerCta: "Got it — take me back"
  },

  // ─── Quotation List ─────────────────────────────────────────────
  "quotation-list": {
    buttonLabel:   "How the Quotation List works",
    headerLabel:   "How the Quotation List works",
    heroTitle:     "Your live basket. Ready to send.",
    heroSubtitle:  "The Quotation List holds every item you've added to quote. Edit qty, remove lines, attach it to a project, then send.",
    featuresTitle: "What the Quotation List does",
    features: [
      { Icon: ClipboardList, title: "Editable up until you send",  body: "Change quantities, delete lines, swap the delivery address — every edit updates the live total instantly." },
      { Icon: Briefcase,     title: "Attach to a project",          body: "Tag the quote to an existing Site Project — or create one on the fly at submit time." },
      { Icon: Truck,         title: "Delivery timing set here",     body: "Same day, tomorrow, 3 days, 5 days, 1 week. Merchants confirm the exact window when they reply." },
      { Icon: Send,          title: "One submit, many merchants",   body: "One tap sends the whole basket to the nearest verified merchants for competitive quotes." }
    ],
    footerCta: "Got it — take me back"
  },

  // ─── Trade Clearance ────────────────────────────────────────────
  "clearance": {
    buttonLabel:   "How Trade Clearance works",
    headerLabel:   "How Trade Clearance works",
    heroTitle:     "End-of-line, expiring live",
    heroSubtitle:  "Trade Clearance surfaces the merchant surplus and discounted lines that are only live for 5 days. When the countdown hits zero, the merchant has to re-post.",
    featuresTitle: "What Trade Clearance does",
    features: [
      { Icon: Tag,          title: "Real merchant surplus",       body: "Only ≥15% off retail OR low-stock end-of-line items qualify — no manufactured urgency." },
      { Icon: PoundSterling, title: "Countdown on every offer",   body: "Every card shows the exact time remaining. When it hits zero, the merchant has to re-post the offer." },
      { Icon: Send,         title: "One-tap add to quote",        body: "Add a clearance line to your Quote Me basket alongside your regular items — same submit flow." }
    ],
    footerCta: "Got it — take me back"
  },

  // ─── Past Orders ────────────────────────────────────────────────
  "past-orders": {
    buttonLabel:   "How Past Orders work",
    headerLabel:   "How Past Orders work",
    heroTitle:     "Every purchase, one tap away",
    heroSubtitle:  "Past Orders is your archive — every merchant delivery, invoice and POD stays here so repeat jobs run without retyping.",
    featuresTitle: "What Past Orders do",
    features: [
      { Icon: Receipt,     title: "Full order history",         body: "Every merchant delivery, filed with its date, total and site." },
      { Icon: Repeat,      title: "One-tap reorder",             body: "Tap Again on any past order — the basket refills, ready for a fresh quote request." },
      { Icon: FileText,    title: "Invoices + POD",              body: "PDFs live under the order — no rummaging through email." }
    ],
    footerCta: "Got it — take me back"
  },

  // ─── Offers on your items ───────────────────────────────────────
  "offers": {
    buttonLabel:   "How Offers work",
    headerLabel:   "How Offers work",
    heroTitle:     "Deals on the items you already buy",
    heroSubtitle:  "Offers is scoped to your Notebook — only deals from verified merchants on the products you already buy. No generic marketing wall.",
    featuresTitle: "What Offers do",
    features: [
      { Icon: Tag,           title: "Scoped to your Notebook",    body: "Only offers on items you've actually bought before — no generic marketplace noise." },
      { Icon: PoundSterling, title: "Ends-in countdown",           body: "Every offer carries a live expiry so you know when it's about to go." },
      { Icon: Send,          title: "Add to quote instantly",     body: "One tap adds the discounted line to your Quote Me basket." }
    ],
    footerCta: "Got it — take me back"
  },

  // ─── Job Templates ──────────────────────────────────────────────
  "templates": {
    buttonLabel:   "How Job Templates work",
    headerLabel:   "How Job Templates work",
    heroTitle:     "Recurring jobs, pre-built baskets",
    heroSubtitle:  "Every recurring job you run turns into a template. Load it, tweak the qtys, hit Quote — no re-typing.",
    featuresTitle: "What Job Templates do",
    features: [
      { Icon: FileText, title: "One template per job type",     body: "Skim job, ceiling repair, full house re-skim — every recurring pattern gets a saved basket." },
      { Icon: Repeat,   title: "Load + tweak in seconds",        body: "Open the template, adjust the qtys for THIS job's size, then send." },
      { Icon: Send,     title: "Straight into Quote Me",         body: "Loading a template drops every item into your Quote basket, ready to send." }
    ],
    footerCta: "Got it — take me back"
  },

  // ─── Hub (Facebook-style front door) ────────────────────────────
  "hub": {
    buttonLabel:   "How the Hub works",
    headerLabel:   "How the Hub works",
    heroTitle:     "Everything for today's work, one screen",
    heroSubtitle:  "The Hub is your Facebook-style front door — pending quotes, active jobs, delivery windows and merchant messages all in one live feed.",
    featuresTitle: "What the Hub does",
    features: [
      { Icon: Home,      title: "Priority-ordered work queue",   body: "The feed leads with what needs attention right now — pending quote replies, deliveries incoming, unread messages." },
      { Icon: ClipboardList, title: "Active jobs at a glance",   body: "Every open Site Project surfaces with its next merchant action, so you never lose track of what's live." },
      { Icon: Bell,      title: "Alerts you can act on",         body: "Every alert has a one-tap action — accept a quote, confirm a delivery, reply to a message." }
    ],
    footerCta: "Got it — take me back"
  },

  // ─── Marketplace (browse) ───────────────────────────────────────
  "marketplace": {
    buttonLabel:   "How the Marketplace works",
    headerLabel:   "How the Marketplace works",
    heroTitle:     "Every merchant near you, one grid",
    heroSubtitle:  "The Marketplace is the browse layer for Trade Center — verified merchants, live stock, trade-price surfacing, all filtered to your postcode.",
    featuresTitle: "What the Marketplace does",
    features: [
      { Icon: Search,        title: "One search, every merchant",       body: "Search products across every verified merchant near you. No jumping between sites." },
      { Icon: PoundSterling, title: "Trade price by default",           body: "Signed-in trades see the trade tier price, not retail. Never miss the discount you're entitled to." },
      { Icon: Package,       title: "Live stock + delivery windows",    body: "Every card carries in-stock status and a delivery promise — no phoning around to check availability." }
    ],
    footerCta: "Got it — take me back"
  },

  // ─── Product PDP ───────────────────────────────────────────────
  "product": {
    buttonLabel:   "How the product page works",
    headerLabel:   "How the product page works",
    heroTitle:     "Everything you need to price this item",
    heroSubtitle:  "The product page shows the trade price, the merchant behind it, and one-tap paths to add it to your Notebook or to your Quote Me basket.",
    featuresTitle: "What the product page does",
    features: [
      { Icon: PoundSterling, title: "Trade + retail transparently",    body: "Retail on top, your trade tier price under it. No hidden pricing." },
      { Icon: Store,         title: "The merchant behind the listing", body: "One tap to their profile, distance, response time, and full catalog." },
      { Icon: Send,          title: "Add to Notebook OR Quote basket", body: "Add to your Notebook for future jobs, or drop straight into your Quote Me basket." }
    ],
    footerCta: "Got it — take me back"
  },

  // ─── Merchant Profile ──────────────────────────────────────────
  "merchant-profile": {
    buttonLabel:   "How the merchant profile works",
    headerLabel:   "How the merchant profile works",
    heroTitle:     "The merchant, checked out",
    heroSubtitle:  "Verified badges, distance, typical quote reply time, catalog, and a direct message thread — everything you need to decide if this merchant is right for the job.",
    featuresTitle: "What the merchant profile does",
    features: [
      { Icon: ShieldCheck, title: "Verified trust layers",              body: "Identity, business, insurance, reviews — every verification the merchant has passed shows here." },
      { Icon: MessageCircle, title: "Message before you buy",           body: "One tap opens a thread — clarify stock, timing, or substitutions before you place an order." },
      { Icon: Package,     title: "Their full catalog",                  body: "Browse every product this merchant carries — filtered to trade tier if you're signed in." }
    ],
    footerCta: "Got it — take me back"
  },

  // ─── Settings: Location ────────────────────────────────────────
  "settings-location": {
    buttonLabel:   "How Location works",
    headerLabel:   "How Location works",
    heroTitle:     "Your postcode drives everything",
    heroSubtitle:  "Trade Center matches merchants by distance from your postcode. Update it if you move base and every downstream match adjusts.",
    featuresTitle: "What Location does",
    features: [
      { Icon: MapPin, title: "Nearest-merchant matching", body: "Every Notebook item, every Quote Me request, every marketplace grid uses your postcode as the origin." },
      { Icon: Truck,  title: "Returns routing",          body: "Merchants send returns to your postcode by default — no need to type it every time." },
      { Icon: Repeat, title: "Change any time",          body: "Move to a new base? Update your postcode and Trade Center re-computes matches instantly." }
    ],
    footerCta: "Got it — take me back"
  },

  // ─── Settings: Recovery ────────────────────────────────────────
  "settings-recovery": {
    buttonLabel:   "How Backup channels work",
    headerLabel:   "How Backup channels work",
    heroTitle:     "Never locked out",
    heroSubtitle:  "Pin up to 3 backup channels — WhatsApp, SMS, email. If you lose your SIM, sign in through a backup and Trade Center reunites you with your account.",
    featuresTitle: "What Backup channels do",
    features: [
      { Icon: ShieldCheck, title: "Verified before it counts",    body: "Every backup channel requires an OTP to prove ownership. Unverified channels can't recover your account." },
      { Icon: Bell,        title: "Recovery-first sign-in",        body: "If you sign in with a verified backup, Trade Center recognises you — no new account is created." },
      { Icon: Repeat,      title: "Up to 3 channels",              body: "Three-channel cap so you always have redundancy without account sprawl." }
    ],
    footerCta: "Got it — take me back"
  },

  // ─── Verified Identity ─────────────────────────────────────────
  "identity": {
    buttonLabel:   "How Verified Identity works",
    headerLabel:   "How Verified Identity works",
    heroTitle:     "One trade identity, every merchant",
    heroSubtitle:  "Complete your Verified Trade Identity once — every merchant's trade-account application autofills. Apply to any merchant in one tap.",
    featuresTitle: "What Verified Identity does",
    features: [
      { Icon: ShieldCheck, title: "Eight verification layers",        body: "Identity, business, insurance, skills, address, qualifications, reviews, years trading — layered trust." },
      { Icon: Repeat,      title: "Autofill every application",       body: "Merchant trade accounts, quote requests, delivery paperwork — all auto-populated from your identity." },
      { Icon: Store,       title: "Merchant-side trust signal",       body: "Merchants see your verification level before quoting so serious trades get priority pricing." }
    ],
    footerCta: "Got it — take me back"
  },

  // ─── Messages ──────────────────────────────────────────────────
  "messages": {
    buttonLabel:   "How Messages work",
    headerLabel:   "How Messages work",
    heroTitle:     "One inbox for every merchant thread",
    heroSubtitle:  "Every conversation with a merchant lives here — quotes, deliveries, substitutions, disputes. Scoped per job so nothing gets mixed up.",
    featuresTitle: "What Messages do",
    features: [
      { Icon: MessageCircle, title: "Scoped to the quote or order", body: "Every thread ties to a specific quote request or order — never generic 'chat.'" },
      { Icon: Repeat,        title: "Merchants see the same thread", body: "The merchant's reply lands in the same thread so history stays intact." },
      { Icon: Bell,          title: "Notification on every reply",   body: "Push, WhatsApp, and email all light up when the merchant responds." }
    ],
    footerCta: "Got it — take me back"
  },

  // ─── Orders (past + in-flight) ─────────────────────────────────
  "orders": {
    buttonLabel:   "How Orders work",
    headerLabel:   "How Orders work",
    heroTitle:     "Every order, tracked to the door",
    heroSubtitle:  "Orders shows every merchant delivery you've ever accepted, its status, its POD and its invoice — all in one place.",
    featuresTitle: "What Orders do",
    features: [
      { Icon: ShoppingCart, title: "In-flight status",           body: "See exactly where every order is — dispatched, en route, delivered, disputed." },
      { Icon: Receipt,      title: "Invoice + POD on file",      body: "Every order carries its PDF trail. No rummaging through email." },
      { Icon: Repeat,       title: "Reorder in one tap",         body: "Same job again? Tap Again on any past order — basket refills, ready to quote." }
    ],
    footerCta: "Got it — take me back"
  },

  // ─── Favourites ────────────────────────────────────────────────
  "favourites": {
    buttonLabel:   "How Favourites work",
    headerLabel:   "How Favourites work",
    heroTitle:     "Save it now, buy it later",
    heroSubtitle:  "Favourite any product, merchant, or offer and Trade Center keeps a live watch — price drops, back-in-stock, expiry warnings all surface in one list.",
    featuresTitle: "What Favourites do",
    features: [
      { Icon: Heart,         title: "One-tap save",                 body: "Tap the heart on any product, merchant, or offer to add it to your Favourites." },
      { Icon: Bell,          title: "Alerts on price + stock",      body: "Price drops and back-in-stock events notify you the moment they happen." },
      { Icon: PoundSterling, title: "Ready for the next quote",     body: "Favourites feed straight into your Quote Me basket — no re-searching." }
    ],
    footerCta: "Got it — take me back"
  },

  // ─── Rates ─────────────────────────────────────────────────────
  "rates": {
    buttonLabel:   "How Rates work",
    headerLabel:   "How Rates work",
    heroTitle:     "Your published price book",
    heroSubtitle:  "Rates lets you publish a rate card that other trades and merchants can see up front — day rates, per-m² rates, minimum call-out — so quotes come pre-briefed.",
    featuresTitle: "What Rates do",
    features: [
      { Icon: PoundSterling, title: "Publish once, quote fast",     body: "Set your day rate, per-m² rate, call-out minimum. Merchants see it before they ask you to price." },
      { Icon: Repeat,        title: "Update any time",              body: "Rates change with the market — bump them in seconds and every future quote reflects the new number." },
      { Icon: ShieldCheck,   title: "Trust signal for buyers",      body: "A published rate card signals a serious trade. Buyers know what to expect." }
    ],
    footerCta: "Got it — take me back"
  },

  // ─── Routes ────────────────────────────────────────────────────
  "routes": {
    buttonLabel:   "How Routes work",
    headerLabel:   "How Routes work",
    heroTitle:     "Every stop on today's van, mapped",
    heroSubtitle:  "Routes plans the most efficient order to hit today's sites — merchant pickups, deliveries and site visits stitched into one drive.",
    featuresTitle: "What Routes do",
    features: [
      { Icon: Route,   title: "Optimised for today",       body: "Sites + merchant collections are ordered by drive time from your current base." },
      { Icon: Truck,   title: "One-tap navigate",           body: "Hand off to your preferred sat-nav app from any stop." },
      { Icon: MapPin,  title: "Postcode-anchored",          body: "Every stop uses the safe postcode or What3Words tied to the job." }
    ],
    footerCta: "Got it — take me back"
  },

  // ─── Trade Counter (peer classifieds) ─────────────────────────
  "trade-counter": {
    buttonLabel:   "How Trade Counter works",
    headerLabel:   "How Trade Counter works",
    heroTitle:     "Trade-to-trade, no commission",
    heroSubtitle:  "Trade Counter is the peer-to-peer classifieds for verified trades near you — for sale, swap, free. Zero commission, always local.",
    featuresTitle: "What Trade Counter does",
    features: [
      { Icon: Handshake, title: "For sale, swap, free",             body: "Three post types — sell your surplus, swap for something you need, or just give it away." },
      { Icon: MapPin,    title: "Nearest trades first",              body: "Feed is sorted by distance so you're only seeing trades in your area." },
      { Icon: ShieldCheck, title: "Verified trades only",           body: "Every listing comes from a verified trade — no random accounts, no scam risk." }
    ],
    footerCta: "Got it — take me back"
  },

  // ─── Merchant Inbox ────────────────────────────────────────────
  "merchant-inbox": {
    buttonLabel:   "How the Quote Inbox works",
    headerLabel:   "How the Quote Inbox works",
    heroTitle:     "Every trade's quote request, priced fast",
    heroSubtitle:  "Trades send bulk quote requests to their nearest verified merchants. First to price with a good deal wins. Your Inbox is where you turn requests into won orders.",
    featuresTitle: "What the Quote Inbox does",
    features: [
      { Icon: Send,          title: "Priced against you and your neighbours", body: "Every request goes to the nearest 3 verified merchants. Speed + price = wins." },
      { Icon: Receipt,       title: "Per-item pricing, one submit",   body: "Enter unit prices for each line, add a delivery promise + notes, hit Send." },
      { Icon: PoundSterling, title: "Zero commission on wins",        body: "Trade Center never takes a cut of what the trade pays you. Every penny of the winning quote is yours." }
    ],
    footerCta: "Got it — take me back"
  },

  // ─── Sign-in ────────────────────────────────────────────────────
  "sign-in": {
    buttonLabel:   "How Sign-in works",
    headerLabel:   "How Sign-in works",
    heroTitle:     "One tap in. No passwords.",
    heroSubtitle:  "Same flow for new + returning trades — Google, Facebook, WhatsApp OTP, email code. No passwords, no verification loops.",
    featuresTitle: "What Sign-in does",
    features: [
      { Icon: User,        title: "Same flow, new or returning",     body: "Trade Center recognises the destination — if you're new, we provision your account and route to complete-identity. Returning? Straight to the app." },
      { Icon: MessageCircle, title: "WhatsApp OTP is primary",       body: "95% of UK trades live in WhatsApp. A 6-digit code lands in seconds. No inbox to check." },
      { Icon: ShieldCheck, title: "OAuth + magic link fallbacks",    body: "Google, Facebook, or an email link — pick what's fastest for you today." }
    ],
    footerCta: "Got it — take me back"
  }
};
