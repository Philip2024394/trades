// /emergency — UK trade emergency hub.
//
// Phase 3 SEO surface. Ranks for high-intent, high-stress queries:
//   • "24 hour plumber UK" / "emergency plumber near me"
//   • "gas leak who to call"
//   • "emergency electrician"
//   • "locked out locksmith uk"
//   • "roof leak emergency"
//
// Every page follows the same structure:
//   1. If it's life-safety — call 999 / National Gas Emergency (0800
//      111 999) FIRST. Never route life-safety to a directory.
//   2. What counts as an emergency (vs a next-day job)
//   3. What to do first (safety + damage limitation)
//   4. Expected wait time + cost premium
//   5. Find a verified local trade
//
// Content is evidence-first — no fabricated response times. Wait +
// cost figures come from The Networkers UK Trade Price Index.

export type EmergencyKind = {
  slug:            string;
  displayName:     string;
  tradeSlug:       string;     // maps to /trades/[trade] for follow-through
  /** One-sentence definition — meta description + hero standfirst. */
  definition:      string;
  /** Life-safety scenarios that need 999 / gas emergency BEFORE a trade. */
  callFirstIfLifeSafety: string[];
  /** What counts as a trade emergency (not next-day work). */
  whatCountsAsEmergency: string[];
  /** Step-by-step safety + damage-limitation actions. */
  firstSteps:      string[];
  /** Typical UK 2026 out-of-hours pricing + response time. */
  expectations: {
    responseTime:  string;
    firstHourCost: string;
    hourlyRate:    string;
    minimumSpend:  string;
  };
  /** Anti-panic FAQs. */
  faqs:            Array<{ q: string; a: string }>;
  lastReviewed:    string;
};

export const EMERGENCIES: EmergencyKind[] = [
  {
    slug: "gas-leak",
    displayName: "Gas leak or gas emergency",
    tradeSlug: "gas-safe-engineer",
    definition:
      "Suspected gas escape, gas smell, boiler flame lockout, carbon-monoxide alarm sounding, or any gas appliance behaving unsafely. This is a life-safety event — call the free 24/7 National Gas Emergency Service before doing anything else.",
    callFirstIfLifeSafety: [
      "Call the National Gas Emergency Service on 0800 111 999 (free, 24/7, UK-wide)",
      "If you smell gas + hear escaping gas + feel unwell — leave the property immediately and call 999",
      "Do NOT operate light switches, phones, or anything electrical while gas is present — sparks can ignite"
    ],
    whatCountsAsEmergency: [
      "Persistent gas smell (rotten-egg odour from mercaptan)",
      "Hissing sound near a gas appliance",
      "Carbon monoxide alarm sounding",
      "Boiler flame going yellow/orange instead of blue",
      "Symptoms of CO exposure (headache, dizziness, nausea)"
    ],
    firstSteps: [
      "1. Turn off the gas at the meter (isolation valve is usually next to the meter — quarter-turn perpendicular = off)",
      "2. Open windows + doors to ventilate",
      "3. Extinguish any naked flames",
      "4. Evacuate the property if the smell is strong",
      "5. Call 0800 111 999 — NGN engineer attends free (they make the situation safe; they do NOT repair the appliance)",
      "6. After they leave — call a Gas Safe registered engineer to actually diagnose + fix"
    ],
    expectations: {
      responseTime:  "NGN emergency response typically 30-60 minutes UK-wide, 90 minutes+ in rural areas",
      firstHourCost: "NGN emergency = free. Gas Safe engineer follow-up: £100-£220 first hour out-of-hours",
      hourlyRate:    "£55-£110/hr Gas Safe standard rate (see UK Trade Price Index) · +40-60% out-of-hours premium",
      minimumSpend:  "£120-£250 minimum for a same-day Gas Safe callout including parts"
    },
    faqs: [
      { q: "What number do I call for a UK gas leak?",              a: "The National Gas Emergency Service on 0800 111 999. Free, 24/7, UK-wide. They send an emergency engineer to make the situation safe (isolate + cap the leak). They do NOT repair the appliance — that's a separate Gas Safe engineer callout." },
      { q: "How much does an emergency Gas Safe callout cost?",     a: "£100-£220 for the first hour out-of-hours in 2026 UK — 40-60% premium over standard Gas Safe rates. Total cost typically £150-£400 including parts for a common fix. The initial NGN visit is free." },
      { q: "Can I turn my gas back on after NGN has been?",         a: "Only if the NGN engineer signs off that the appliance is safe. Otherwise the appliance remains capped until a Gas Safe engineer diagnoses + fixes. Never turn gas back on to a capped appliance yourself." }
    ],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "burst-pipe",
    displayName: "Burst pipe or major water leak",
    tradeSlug: "plumber",
    definition:
      "Water actively spraying, cascading through a ceiling, or pouring from a pipe. Every minute of unchecked flow does more damage. Isolate first, plumber second.",
    callFirstIfLifeSafety: [
      "If water is close to any live electrical (sockets, consumer unit, light fittings) — turn off electricity at the consumer unit BEFORE approaching the water",
      "If a ceiling is bulging with trapped water — get everyone underneath to move out immediately (collapsing ceilings cause serious injury)"
    ],
    whatCountsAsEmergency: [
      "Water actively spraying or pouring",
      "Ceiling bulging or dripping heavily",
      "Water running under floorboards from above",
      "Water pooling near electrics",
      "No cold water at all in the property (usually mains failure — check street stopcock)"
    ],
    firstSteps: [
      "1. Turn off the mains stopcock — usually under the kitchen sink, or near the front door. Turn clockwise until it stops.",
      "2. Turn on all cold taps to drain the system fast + reduce pressure at the leak.",
      "3. Turn off the electricity if the leak is near any electrical fitting.",
      "4. If a ceiling is bulging — punch a hole in it with a broom handle into a bucket. Controlled release beats an unpredictable collapse.",
      "5. Photograph everything for the insurance claim.",
      "6. Call an emergency plumber."
    ],
    expectations: {
      responseTime:  "1-4 hours typical UK response for a genuine burst-pipe emergency during working hours; 2-6 hours out-of-hours",
      firstHourCost: "£75-£150 first hour standard callout; £150-£280 out-of-hours",
      hourlyRate:    "£45-£90/hr plumber standard (see UK Trade Price Index) · +50-100% out-of-hours",
      minimumSpend:  "£120-£300 minimum for a same-day plumber callout including basic parts"
    },
    faqs: [
      { q: "How much is an emergency plumber in the UK?",           a: "£75-£150 for the first hour during working hours; £150-£280 first hour out-of-hours (evenings, weekends, bank holidays). Follow-on hours £45-£140. Minimum charge typically 1 hour on-site." },
      { q: "Where is the water stopcock in a UK home?",              a: "Usually under the kitchen sink or near the front door. In older properties it may be in the cellar or an under-stairs cupboard. Turn clockwise (right) until it stops. Find yours + test it now — before you need it in an emergency." },
      { q: "Will my insurance cover a burst pipe?",                  a: "Most UK buildings insurance covers escape-of-water damage (walls, floors, contents). Insurance rarely covers the actual pipe repair itself — that's a plumber invoice you pay. Photograph before + after; keep the invoice." }
    ],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "power-failure",
    displayName: "Power failure or dangerous electrics",
    tradeSlug: "electrician",
    definition:
      "Total power loss, tripping RCD you can't reset, burning smell from a socket, exposed live wiring, or persistent electric shocks from an appliance. Some of these are life-safety.",
    callFirstIfLifeSafety: [
      "If someone has been electrocuted — call 999 immediately, then turn off the power at the consumer unit if you can do so safely",
      "If there's smoke or fire from wiring/sockets — call 999 (fire service) + turn off the mains if safe",
      "If your whole street is off, check the UK Power Networks / SSEN emergency line 105 (free from any phone) before assuming it's your property"
    ],
    whatCountsAsEmergency: [
      "Total loss of power that isn't a street-wide outage",
      "RCD trips + won't reset (indicates active fault current)",
      "Burning smell from a socket, switch, or consumer unit",
      "Sparks visible when plugging in appliances",
      "Any electric shock from an appliance or fitting",
      "Exposed live wiring — cable damaged, socket ripped from wall"
    ],
    firstSteps: [
      "1. Check if it's a street-wide outage first — call 105 (free UK-wide network operator emergency line).",
      "2. If it's just your property — turn off the main switch at the consumer unit.",
      "3. Unplug every appliance from every socket in the affected circuit.",
      "4. Try resetting the RCD/MCB. If it trips again immediately — leave it off + call an electrician.",
      "5. If there's smoke, sparks, or burning smell — evacuate + call 999 first.",
      "6. Call a Part-P registered electrician for after-999 emergency response."
    ],
    expectations: {
      responseTime:  "2-6 hours typical UK emergency electrician response during working hours; 4-10 hours out-of-hours",
      firstHourCost: "£65-£140 first hour standard; £140-£280 out-of-hours",
      hourlyRate:    "£45-£75/hr electrician standard (see UK Trade Price Index) · +50-100% out-of-hours",
      minimumSpend:  "£110-£280 minimum for same-day electrician callout with basic diagnostic parts"
    },
    faqs: [
      { q: "What number do I call for a UK street power cut?",       a: "105 — the free UK Power Emergency line, works from any phone, connects you to the correct regional distribution network operator (UK Power Networks, SSEN, Northern Powergrid, Electricity North West, National Grid, or SP Energy Networks). They don't repair your property wiring — but they DO fix + report street outages." },
      { q: "Is an RCD tripping an emergency?",                       a: "If it trips + won't reset — yes. It means there's an active fault current somewhere in your wiring. Leave the RCD OFF and call a Part-P electrician. If it trips + resets once — usually a faulty appliance; unplug things one at a time to find which appliance causes the trip." },
      { q: "How much does an emergency electrician cost UK?",         a: "£65-£140 first hour during working hours; £140-£280 first hour out-of-hours. Follow-on £45-£140/hr. Notifiable Part P work (new circuits, bathroom) requires a registered installer — check they can self-certify before booking." }
    ],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "roof-leak",
    displayName: "Storm damage or roof leak",
    tradeSlug: "roofer",
    definition:
      "Water actively entering through the roof during or after a storm — dislodged tiles, torn flashing, damaged flat roof, or blown-off ridge. Contain the internal water first; roofer next.",
    callFirstIfLifeSafety: [
      "Never climb onto a roof yourself in wet or windy conditions — falls from height are one of the UK's top DIY fatalities",
      "If a chimney or masonry section looks like it's about to fall — clear the area beneath + call 999 (they'll cordon it off)",
      "Structural collapse or bulging ceilings — evacuate + call 999"
    ],
    whatCountsAsEmergency: [
      "Water actively coming through a ceiling",
      "Tiles or slate dislodged during a storm — active weather risk",
      "Flat roof torn or blown up in high wind",
      "Chimney flashing failure with visible water entry",
      "Ridge tile or chimney pot displaced"
    ],
    firstSteps: [
      "1. Contain the interior — buckets under drips, move furniture + electronics out of the affected area, lift or protect flooring.",
      "2. If ceiling is bulging — punch a hole into a bucket (controlled release beats a collapse).",
      "3. Photograph everything for insurance.",
      "4. Do NOT climb onto the roof yourself.",
      "5. Call an emergency roofer for temporary tarp-and-batten (typically £150-£450 for a make-safe visit).",
      "6. Permanent repair after weather settles."
    ],
    expectations: {
      responseTime:  "Same-day or next-day for storm-emergency callouts; genuinely fast response can be difficult during widespread storm events (queues)",
      firstHourCost: "£150-£350 for a same-day make-safe visit including materials (tarp, batten, nails)",
      hourlyRate:    "£35-£60/hr roofer standard (see UK Trade Price Index) · +40-80% during storm periods due to demand",
      minimumSpend:  "£200-£450 typical for a make-safe visit; permanent repair costs from £250-£3,000+ depending on damage"
    },
    faqs: [
      { q: "Should I climb onto my roof after a storm?",              a: "No — never. Roof falls are one of the UK's most common serious DIY injuries. Even confident DIYers should photograph from the ground and let a roofer with proper edge protection or scaffold assess. Insurance claims may also be voided if you climb without appropriate PPE." },
      { q: "How much does emergency roof repair cost UK?",            a: "£150-£450 for a make-safe visit (tarp + batten). Permanent repair: £250-£1,200 for slipped or broken tiles, £600-£3,000+ for chimney flashing or ridge work, £5,000+ for structural damage. Insurance usually covers storm damage — check your policy before starting work." },
      { q: "Do storm-damaged roofs need scaffolding?",                 a: "For anything on a two-storey property or higher — yes, per HSE regulations. Emergency make-safe may use ladders + edge harness if the roofer is qualified, but any repair beyond that needs scaffold or a mobile elevated work platform." }
    ],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "locked-out",
    displayName: "Locked out — locksmith emergency",
    tradeSlug: "carpenter",
    definition:
      "Locked out of your home, keys lost or broken in the lock, front door won't open. Every locksmith is different — pick one who publishes prices in writing before they arrive.",
    callFirstIfLifeSafety: [
      "If someone is trapped inside + at risk (a young child, medical emergency, unattended running gas/water) — call 999 first. Fire service will force entry.",
      "If you suspect a break-in — call police 101 (non-emergency) or 999 if in progress"
    ],
    whatCountsAsEmergency: [
      "Fully locked out with no spare key access",
      "Broken key stuck in the lock",
      "Lock jammed or seized — key turns but door won't open",
      "Snapped Euro cylinder (very common on cheap uPVC doors)",
      "Post-break-in — need lock replaced immediately for security"
    ],
    firstSteps: [
      "1. Check every window + back door before calling — most 'lockouts' end with a side gate someone forgot to lock.",
      "2. Get a written quote by phone or WhatsApp before the locksmith travels. Anything above £150 for a standard non-destructive entry is high.",
      "3. Insist on non-destructive entry first (picking) — destructive (drilling the cylinder) is a last resort + means you pay for a new lock.",
      "4. Ask if they're a Master Locksmiths Association member — MLA registration filters out most rogue locksmiths."
    ],
    expectations: {
      responseTime:  "30-90 minutes typical UK response for locksmith callouts in urban areas",
      firstHourCost: "£100-£200 for a standard non-destructive entry + basic lock service, working hours",
      hourlyRate:    "£75-£120/hr standard; +50-100% out-of-hours",
      minimumSpend:  "£120-£220 typical total including new key + any minor lock adjustment. New Euro cylinder: £30-£120 for parts. Full lock replacement: £180-£400+"
    },
    faqs: [
      { q: "How much does a UK locksmith cost for a lockout?",        a: "£100-£200 for standard non-destructive entry during working hours; £150-£320 out-of-hours. Any locksmith quoting above £250 for a straight lockout is a red flag — get another quote. Always get the price in writing (WhatsApp is fine) before they travel." },
      { q: "How do I avoid a rogue locksmith UK?",                     a: "Master Locksmiths Association (MLA) members are vetted + insured — start there (locksmiths.co.uk). Get 2-3 phone quotes before any locksmith travels. Insist on non-destructive entry first — destructive entry means you also pay for a new lock." },
      { q: "Will my insurance cover a lockout?",                       a: "Home emergency insurance often covers lock-out response (usually capped at £150-£300 per claim). Buildings insurance covers replacement locks after a break-in. Standard buildings/contents insurance doesn't cover lost-key lockouts — check your specific policy." }
    ],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "blocked-drain",
    displayName: "Blocked drain or backup",
    tradeSlug: "plumber",
    definition:
      "External drain overflowing, toilet backing up, waste water rising through sink or shower waste — all indicate a blocked drainage run. Usually solvable in 1-2 hours by a drainage specialist.",
    callFirstIfLifeSafety: [
      "Raw sewage back-up creates a genuine health risk — evacuate children + pregnant persons from affected areas + call a drainage specialist immediately",
      "If sewage is entering a public area (pavement, street drain) — also call the water company's 24-hour line (they may attend if it's a shared/public drain)"
    ],
    whatCountsAsEmergency: [
      "External inspection chamber overflowing",
      "Toilet backing up when flushed",
      "Multiple fixtures affected (kitchen sink + shower + WC all draining slowly = shared blockage downstream)",
      "Sewage smell coming back through waste pipes",
      "Standing water in bath/shower that won't clear"
    ],
    firstSteps: [
      "1. Stop using ALL water fixtures immediately — every extra litre goes on top of the block.",
      "2. Lift the external inspection chamber lid — if it's full, the block is downstream (in the shared or public run).",
      "3. If the block is on YOUR side of the property boundary — call a drainage specialist or plumber.",
      "4. If the block is on the SHARED side or beyond — call your water/sewerage company's 24-hour line first (they often clear public blockages free).",
      "5. Do NOT pour boiling water down blocked drains — can crack porcelain + PVC waste pipes.",
      "6. Chemical drain cleaner is a short-term fix + can damage pipes with long-term use."
    ],
    expectations: {
      responseTime:  "1-3 hours typical UK drainage callout response during working hours; 2-6 hours out-of-hours",
      firstHourCost: "£100-£220 for a standard drain unblock (rods + jet)",
      hourlyRate:    "£45-£90/hr plumber/drainage standard · +50-100% out-of-hours",
      minimumSpend:  "£120-£300 typical for a standard unblock including basic call-out"
    },
    faqs: [
      { q: "Who is responsible for a blocked drain UK?",              a: "Your responsibility ends at the property boundary — inside your boundary, you pay a private plumber/drainage specialist. Outside the boundary (shared or public drains), your water/sewerage company is responsible — they often clear free. Lift the inspection chamber to see where the block is." },
      { q: "How much does drain unblocking cost UK?",                  a: "£100-£220 for a standard rod-and-jet unblock during working hours; £160-£320 out-of-hours. CCTV drain survey (for repeat blockages): £180-£350. Major drain repair (collapsed section): £600-£3,000+ depending on depth + access." },
      { q: "Can I unblock a UK drain myself?",                          a: "For a simple sink or shower block — yes, with rods or a plunger. For an external chamber or shared run — hire a professional. DIY drain rodding of external chambers regularly causes worse damage (pushing debris further, damaging pipe joints)." }
    ],
    lastReviewed: "2026-07-20"
  }
];

export const HUB_FAQS = [
  {
    q: "What's the fastest way to get a UK emergency trade?",
    a: "Life-safety first — 999 for fire, ambulance, or people in danger; 0800 111 999 for gas leaks; 105 for street power failures. For genuine trade emergencies (burst pipe, roof leak, lockout), start with a written phone/WhatsApp quote before the trade travels — legitimate emergency trades will quote a price by phone, not just show up and charge whatever."
  },
  {
    q: "How much extra do UK trades charge out-of-hours?",
    a: "Typically 40-100% premium over standard rates. Weekend + bank-holiday premiums are at the top of that range. Getting a written total-cost quote before the trade travels is the single best defence against rogue emergency pricing."
  },
  {
    q: "Should I DIY an emergency repair to save money?",
    a: "Damage-limitation steps (isolating water/gas/electricity, tarping a leak) — yes, everyone should know these. Actual repairs — no. Emergency DIY on gas, electrics, or roofing regularly causes 10× the original damage. Contain + call the pro."
  }
];
