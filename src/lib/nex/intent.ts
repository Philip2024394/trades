// Nex intent detection.
//
// Turns a merchant's natural language into a structured action Nex can
// execute — invoke a Studio, edit brand, research a topic, teach Nex,
// or answer a question. Deterministic keyword pass first.

export type NexIntent =
  | { kind: "invoke_studio";  capability_id: string; user_prompt?: string }
  | { kind: "edit_brand";     field: "colour" | "typography" | "logo" | "tagline" | "positioning"; hint?: string }
  | { kind: "open_page";      path: string; label: string }
  | { kind: "answer";         topic: string }
  | { kind: "research";       topic: string; trade?: string }
  | { kind: "teach";          content: string }
  | { kind: "approve_all";    confirm: boolean }
  | { kind: "what_changed";   scope: "recent" | "this_week" }
  | { kind: "social_post";    platform: "facebook" | "instagram" | "tiktok" | "linkedin" | "google_business" | "any"; brief: string }
  | { kind: "business_intel"; question: string }
  | { kind: "project_intel";  question: string }
  | { kind: "estimate";       question: string }
  | { kind: "customer_intel"; question: string }
  | { kind: "md_intel";       question: string }
  | { kind: "financial_intel"; question: string }
  | { kind: "supply_chain";   question: string }
  | { kind: "project_manager"; question: string }
  | { kind: "vision";          question: string }
  | { kind: "network";         question: string }
  | { kind: "autonomy";        question: string }
  | { kind: "construction_cloud"; question: string }
  | { kind: "marketplace";     question: string }
  | { kind: "experience";      question: string }
  | { kind: "orchestrate";     question: string }
  | { kind: "world";           question: string }
  | { kind: "global";          question: string }
  | { kind: "business_ops";    question: string }
  | { kind: "digital_twin";    question: string }
  | { kind: "bos";             question: string }
  | { kind: "memory";          question: string }
  | { kind: "unknown";        original: string };

type Pattern = {
  match:  (t: string, original: string) => boolean;
  build:  (t: string, original: string) => NexIntent;
};

/** Deterministic keyword-first intents. Order matters — most specific
 *  first. Add here to widen Nex's coverage without touching Claude. */
const PATTERNS: Pattern[] = [
  // Research intents — highest priority so "research X" doesn't fall
  // through to the question fallback.
  {
    match: (t) => /\b(research|find|check|look\s+up|investigate)\b/.test(t)
              && /\b(guidance|regulations?|regs|rules|standards?|law|advice|best practice|new|latest|changes?)\b/.test(t),
    build: (t, original) => {
      // Strip common prefixes to isolate the topic.
      const topic = original
        .replace(/^\s*(nex[,\s]+)?/i, "")
        .replace(/^(please\s+)?(research|find|check|look\s+up|investigate)\s+/i, "")
        .replace(/\s+(from\s+official\s+sources|for\s+me)?\.?\s*$/i, "")
        .trim();
      return { kind: "research", topic: topic || t };
    }
  },
  // Teach Nex — merchant asserts a fact and asks Nex to remember it.
  {
    match: (t) => /\bnex[,\s]+(learn|remember|store|save)\b/.test(t)
              || /\bstore\s+this\s+permanently\b/.test(t)
              || /\bthis\s+is\s+(now\s+)?company\s+knowledge\b/.test(t)
              || /\b(add|save|remember)\s+this\s+to\s+(your\s+)?(memory|knowledge)\b/.test(t),
    build: (_t, original) => ({ kind: "teach", content: original })
  },
  // Approve everything — chat-native admin action.
  {
    match: (t) => /\b(approve|accept)\b.*\b(everything|all|the\s+lot|all\s+of\s+them|all\s+pending)\b/.test(t),
    build: (t) => ({ kind: "approve_all", confirm: /\b(yes|confirm|do it|go ahead)\b/.test(t) })
  },
  // What changed — summarise recent knowledge updates.
  {
    match: (t) => /\bwhat\s+(changed|has\s+changed|is\s+new)\b/.test(t)
              || /\bany\s+(updates|changes|news)\b/.test(t),
    build: (t) => ({ kind: "what_changed", scope: /week/.test(t) ? "this_week" : "recent" })
  },
  // Social post intents — before Studio so "create a Facebook post"
  // doesn't fall through to Van Wrap on the "create" verb.
  {
    match: (t) => /\b(post|share|publish|schedule|promote|marketing|campaign)\b/.test(t)
              && /\b(facebook|instagram|insta|ig|tiktok|linkedin|social|google\s+business)\b/.test(t),
    build: (t, original) => {
      const platform =
        /facebook/.test(t)                      ? "facebook" :
        /instagram|\binsta\b|\big\b/.test(t)    ? "instagram" :
        /tiktok/.test(t)                        ? "tiktok" :
        /linkedin/.test(t)                      ? "linkedin" :
        /google\s+business/.test(t)             ? "google_business" :
                                                  "any";
      return { kind: "social_post", platform: platform as never, brief: original };
    }
  },
  {
    match: (t) => /\b(promote|share|announce)\b.*\b(project|renovation|job|job\s+we\s+did|latest)\b/.test(t)
              || /\b(latest|new)\b.*\b(project|renovation|kitchen|bathroom|extension)\b/.test(t)
              || /\bcreate\b.*\b(post|posts)\b/.test(t),
    build: (_t, original) => ({ kind: "social_post", platform: "any", brief: original })
  },
  // Studio intents.
  {
    match: (t) => /\b(design|make|generate|create|do)\b.*\b(van|vehicle|wrap|fleet)\b/.test(t)
              || (/\b(van|vehicle|wrap)\b/.test(t) && /\b(design|make|do)\b/.test(t)),
    build: (t) => ({ kind: "invoke_studio", capability_id: "vehicle.van-wrap", user_prompt: t })
  },
  {
    match: (t) => /\b(business ?cards?|calling cards?|contact cards?)\b/.test(t),
    build: (t) => ({ kind: "invoke_studio", capability_id: "print.business-card", user_prompt: t })
  },
  // Brand edit intents.
  {
    match: (t) => /\b(change|update|swap|new)\b.*\b(colour|color)\b/.test(t),
    build: (t) => ({ kind: "edit_brand", field: "colour", hint: t })
  },
  {
    match: (t) => /\b(change|update|swap|new)\b.*\b(font|typography|typeface)\b/.test(t),
    build: (t) => ({ kind: "edit_brand", field: "typography", hint: t })
  },
  {
    match: (t) => /\b(change|update|uploaded|new)\b.*\b(logo)\b/.test(t)
              || /\bi'?ve changed my logo\b/.test(t),
    build: (t) => ({ kind: "edit_brand", field: "logo", hint: t })
  },
  // Navigation intents.
  {
    match: (t) => /\b(what.*brand|show.*brand|brand vault|my brand)\b/.test(t),
    build: () => ({ kind: "open_page", path: "/studio/vault", label: "Brand Vault" })
  },
  {
    match: (t) => /\b(what can i buy|packages?|bundles?|store)\b/.test(t),
    build: () => ({ kind: "open_page", path: "/studio/store", label: "Capability Store" })
  },
  {
    match: (t) => /\b(discovery|questionnaire|start again|new brand)\b/.test(t),
    build: () => ({ kind: "open_page", path: "/studio/discovery", label: "Business Discovery" })
  },
  {
    match: (t) => /\b(export|download|zip|leave|take.*with me)\b/.test(t),
    build: () => ({ kind: "open_page", path: "/studio/vault", label: "Brand Vault (Export button)" })
  },
  // Network — find-me-a-trade / trust-profile / collaborators /
  // referrals. Sits BEFORE customer_intel so "find me a bricklayer"
  // doesn't route to CX "find <name>" contact search.
  {
    match: (t) => /\bfind\s+me\s+a\b|\brecommend\s+(a|an)\b|\bi\s+need\s+(a|an)\b/.test(t)
              || /\btrust\s+score\b|\bmy\s+trust\s+profile\b|\bhow\s+trusted\s+am\s+i\b/.test(t)
              || /\bcollaborators?\b|\bwho\s+have\s+i\s+worked\s+with\b/.test(t)
              || /\bwho\s+should\s+i\s+ask\s+for\s+a\s+referral\b|\breferrals?\b/.test(t),
    build: (_t, original) => ({ kind: "network", question: original })
  },
  // Construction Experience — anonymous benchmarks from contributed
  // projects. Sits BEFORE Construction Cloud so "how long does a loft
  // conversion take?" routes to XP (real-world median) not property
  // history.
  {
    match: (t) => /\bhow\s+long\s+(does|do)\s+.+\s+(take|last)\b/.test(t)
              || /\btypical\s+duration\b|\baverage\s+labour\s+hours\b/.test(t)
              || /\bshow\s+(projects|jobs)\s+similar\b/.test(t)
              || /\bhow\s+many\s+contributing\s+projects\b/.test(t),
    build: (_t, original) => ({ kind: "experience", question: original })
  },
  // Construction Cloud — property-scoped (persists across projects).
  // Must sit BEFORE project_intel + project_manager because
  // "tell me everything about number 14" is property-level, not
  // project-level.
  {
    match: (t) => /\bbuild(ing)?\s+passport\b|\bgenerate\s+(the\s+)?passport\b|\bexport\s+passport\b/.test(t)
              || /\bfind\s+every\s+property\s+(with|using)\b/.test(t)
              || /\btell\s+me\s+everything\s+about\s+[a-z0-9]/i.test(t)
              || /\bshow\s+everything\s+about\s+[a-z0-9]/i.test(t)
              || /\bshow\s+every\s+(project|photo)\s+(at|for)\s+/i.test(t)
              || /\bwhen\s+(should|does|is)\s+(the\s+|my\s+)?(boiler|roof|kitchen|bathroom|windows|doors|flooring|solar|heating|plumbing|electrical)\s+(be\s+)?(serviced|maintained|inspected|due)\b/i.test(t),
    build: (_t, original) => ({ kind: "construction_cloud", question: original })
  },
  // Autonomy — approval queue, overnight run, mode, multi-agent
  // handles ("marketing nex, ..."). Sits at the top so agent handles
  // route correctly before any other classifier sees them.
  {
    match: (t) => /^(marketing|finance|projects|customer|procurement|compliance)\s+nex[,:]/i.test(t)
              || /^@(marketing|finance|projects|customer|procurement|compliance)\b/i.test(t)
              || /\bwhat\s+needs\s+my\s+approval\b|\bapproval\s+queue\b|\bpending\s+approvals?\b/.test(t)
              || /\bwhat\s+did\s+you\s+do\s+overnight\b|\bovernight\s+run\b/.test(t)
              || /\bwhat\s+mode\s+am\s+i\s+on\b|\bautonomy\s+mode\b|\bwhat'?s\s+my\s+autonomy\b/.test(t),
    build: (_t, original) => ({ kind: "autonomy", question: original })
  },
  // Vision — image-referring questions. Sits BEFORE everything else
  // because the phrases are specific ("what do you think of this
  // photo?", "compare these images", "read this receipt"). Chat route
  // must pass an imageUrl or the vision router returns "attach an
  // image".
  {
    match: (t) => /\bwhat\s+do\s+you\s+think\s+of\s+(this|the)\s+(photo|image|picture)\b/.test(t)
              || /\banaly[sz]e\s+(this|the)\s+(image|photo)\b/.test(t)
              || /\binspect\s+this\b|\bwhat'?s\s+in\s+(this|the)\s+(image|photo)\b/.test(t)
              || /\bwhat'?s\s+wrong\s+with\s+(this|the)\s+(wall|ceiling|roof|photo|image|floor)\b/.test(t)
              || /\bany\s+defects\b|\bdamage\b.*\b(this|photo|image)\b/.test(t)
              || /\bis\s+this\s+safe\b|\bsafety\s+check\b|\bany\s+safety\b/.test(t)
              || /\bmeasure\b.*\b(this|photo|image)\b|\bhow\s+big\s+is\s+(this|the)\b/.test(t)
              || /\bread\s+(this|the)\s+(receipt|invoice|certificate|delivery\s+note|document)\b|\bocr\b/.test(t)
              || /\bcompare\s+(these|the)\s+(photos?|images?|pictures?)\b|\bbefore\s+and\s+after\b/.test(t),
    build: (_t, original) => ({ kind: "vision", question: original })
  },
  // Project Manager — multi-project + command centre. Must sit BEFORE
  // project_intel (single-project) so "how are my projects?" (all)
  // doesn't route to single-project overview. Also owns "run today's
  // business" — the top-of-stack digest.
  {
    match: (t) => /\brun\s+today'?s\s+business\b|\btoday'?s\s+command\s+centre\b/.test(t)
              || /\bhow\s+are\s+my\s+projects\b|\bshow\s+(all\s+)?my\s+projects\b|\bportfolio\b/.test(t)
              || /\bwhich\s+project\s+worries\s+you\b|\bwhich\s+project\s+needs\s+me\b|\bwhich\s+project\s+is\s+worst\b/.test(t)
              || /\bwhat'?s\s+falling\s+behind\b|\bdelayed\s+projects\b|\bwhich\s+projects\s+are\s+late\b/.test(t)
              || /\bwhen\s+will\s+.+\s+(finish|complete|be\s+done)\b/.test(t),
    build: (_t, original) => ({ kind: "project_manager", question: original })
  },
  // Marketplace — buying-focused questions ("I need 120 blocks",
  // "compare timber prices", "find cheaper insulation"). Sits BEFORE
  // supply_chain because SC's shopping-list is JOB-scoped (materials
  // needed) whereas MP is CATALOGUE-scoped (what's for sale).
  {
    match: (t) => /\bcompare\s+(prices?|timber|paint|blocks?|bricks?|plasterboard|tiles?)\b/.test(t)
              || /\bi\s+need\s+\d+\s+\w+/.test(t)
              || /\bfind\s+(me\s+)?\d+\s+\w+/.test(t)
              || /\bfind\s+(me\s+)?(cheaper|the\s+cheapest)\b/.test(t)
              || /\bbuy\s+(today'?s\s+)?materials?\b/.test(t)
              || /\bwho\s+sells\b/.test(t)
              || /\bwhat\s+can'?t\s+you\s+buy\b/.test(t),
    build: (_t, original) => ({ kind: "marketplace", question: original })
  },
  // Supply Chain — most specific purchasing/materials questions.
  // Sits BEFORE Financial and MD so "compare suppliers" routes to SC
  // (which extends MD's supplier list with reliability) rather than
  // the broader MD reply. Also owns "what materials do I need next
  // week?" — the spec's primary success criterion.
  {
    match: (t) => /\bwhat\s+materials?\s+do\s+i\s+need\b/.test(t)
              || /\bmaterials?\s+for\s+(next\s+week|upcoming\s+jobs?|this\s+week)\b/.test(t)
              || /\bwhat'?s\s+on\s+the\s+shopping\s+list\b/.test(t)
              || /\bcompare\s+suppliers?\b|\bwhich\s+supplier\s+(is\s+)?best\b|\bwho\s+is\s+my\s+top\s+supplier\b/.test(t)
              || /\bwhere\s+am\s+i\s+wasting\s+materials?\b|\bmaterials?\s+waste\b|\bwaste\s+report\b/.test(t)
              || /\balternatives?\s+(for|to)\s+[a-z]/.test(t)
              || /\bfind\s+(an?\s+)?alternative\b/.test(t),
    build: (_t, original) => ({ kind: "supply_chain", question: original })
  },
  // Financial Intelligence — most specific finance questions. Sits
  // BEFORE MD so "how are my finances?" / "can I afford X?" / "VAT"
  // route to FI (which composes MD + adds FI-only capabilities) rather
  // than the broader MD reply.
  //
  // VAT/tax patterns require an ownership word ("my VAT", "MY tax
  // position") so general-knowledge questions like "what's the VAT
  // threshold?" still fall through to the knowledge/answer intent.
  {
    match: (t) => /\bhow\s+are\s+my\s+finances?\b|\bfinancial\s+overview\b|\bfinance\s+director\b/.test(t)
              || /\bfinancial\s+health\b|\bhow\s+healthy\s+are\s+my\s+finances?\b/.test(t)
              || /\bcan\s+i\s+afford\b|\bcould\s+i\s+afford\b|\bshould\s+i\s+buy\b|\bcan\s+i\s+buy\b/.test(t)
              || /\b(my|our)\s+(vat|tax)\s+(position|summary|liability|bill|return)\b/.test(t)
              || /\bwhat'?s\s+my\s+(vat|tax)\b|\bhow\s+much\s+(vat|tax)\s+do\s+i\s+owe\b/.test(t)
              || /\bwhere\s+am\s+i\s+spending\b|\bcost\s+breakdown\b|\bexpense\s+breakdown\b/.test(t)
              || /\brevenue\s+by\s+customer\b/.test(t)
              || /\bwho'?s\s+my\s+best\s+customer\b|\bwhich\s+customers?\s+earn\s+me\s+the\s+most\b/.test(t),
    build: (_t, original) => ({ kind: "financial_intel", question: original })
  },
  // Managing Director — top-level composition. Matches BEFORE
  // business/customer intel because "how's my business?" should get
  // the MD overview (which INCLUDES the BI headline) rather than the
  // narrower BI reply.
  {
    match: (t) => /\bhow'?s\s+my\s+business\b|\bbusiness\s+overview\b|\bmanaging\s+director\b/.test(t)
              || /\bwhat\s+worries\s+you\b/.test(t)
              || /\bwhat\s+should\s+i\s+do\s+first\b|\btoday'?s\s+priorities\b|\bwhat'?s\s+next\b/.test(t)
              || /\bwhere\s+am\s+i\s+losing\s+money\b|\bwhich\s+jobs?\s+(are\s+)?los(e|ing)\s+money\b/.test(t)
              || /\bbiggest\s+opportunit\w+\b|\bwhat'?s\s+my\s+(biggest\s+)?opportunit/.test(t)
              || /\bcash\s?flow\b|\bhow'?s\s+cash\b/.test(t)
              || /\bforecast\b|\bnext\s+month'?s?\s+revenue\b|\bpredict\b/.test(t)
              || /\bworkforce\b|\butilisation\b|\bcapacity\b/.test(t)
              || /\bsuppliers?\b|\bwho\s+do\s+i\s+buy\s+from\b/.test(t),
    build: (_t, original) => ({ kind: "md_intel", question: original })
  },
  // Customer Intelligence — specific-customer + list questions. Must
  // sit BEFORE Business/Project intel so "tell me about Mrs Smith"
  // doesn't route to BI. Also catches "who owes me money?" and the
  // "who should I contact today?" family. The BI equivalent
  // ("outstanding"/"who owes") still matches BI, so CX must win here.
  {
    match: (t) => /\bwho\s+owes\b|\bwho'?s\s+outstanding\b|\bunpaid\s+customers?\b|\bwho\s+hasn'?t\s+paid\b/.test(t)
              || /\bwho\s+should\s+i\s+(contact|phone|call)\s+today\b|\bwho\s+have\s+i\s+not\s+contacted\b|\bwho\s+hasn'?t\s+heard\s+from\s+me\b/.test(t)
              || /\bwho\s+leaves\s+the\s+best\s+reviews\b|\bbest\s+review(s|ers)\b|\bhighest\s+rated\s+customers?\b/.test(t)
              || /\brepeat\s+(work|customers?|business)\b|\bwhich\s+customers?\s+have\s+repeat/.test(t)
              || /\bshow\s+[a-z]+\s+customers?\b/.test(t)
              || /\btell\s+me\s+about\s+[a-z][\w'\s-]+/.test(t)
              || /\bopen\s+[a-z][\w'\s-]+\s+project\b/.test(t)
              || /\bwho\s+is\s+[a-z]/.test(t)
              || /\bfind\s+customer\b/.test(t),
    build: (_t, original) => ({ kind: "customer_intel", question: original })
  },
  // Estimating — must sit BEFORE Business Intel + Project Intel so
  // "estimate a 42m² plastering job" doesn't route to overall revenue
  // or a project overview. Also catches "why 18 boards?" follow-ups
  // and "what's my profit?" when a prior estimate is in the session.
  {
    match: (t) => /\b(estimate|quote|price|cost)\b.*\b\d+(?:\.\d+)?\s*(?:m2|m²|m3|m³|sq|square|metres?|cubic|by|x|×)/.test(t)
              || /^\s*(why|how)\s+.*\b(boards?|bags?|hours?|days?|plasterers?|workers?|waste|overhead|profit|vat|labour|labor)\b/.test(t)
              || /\bwhat'?s\s+my\s+profit\b|\bprofit\s+margin\b/.test(t)
              || /\bcompare\s+suppliers?\b/.test(t)
              || /\bwhich\s+trades?\s+can\s+you\s+estimate\b/.test(t),
    build: (_t, original) => ({ kind: "estimate", question: original })
  },
  // Project Intelligence questions — project-scoped. Must sit BEFORE
  // Business Intelligence so "show me the Smith extension" doesn't
  // route to overall revenue. Chat route resolves the specific project
  // from surrounding context (URL, active project cookie).
  {
    match: (t) => /\b(show|open|tell me about|everything about)\b.*\b(project|extension|kitchen|bathroom|renovation|build)\b/.test(t)
              || /\bhow'?s\s+(my|the)\s+(project|extension|build|house)\b/.test(t)
              || /\btoday'?s\s+(jobs?|activity|progress|site diary)\b/.test(t)
              || /\bwhat\s+happened\s+yesterday\b/.test(t)
              || /\bshow\s+(all\s+)?(kitchen|plastering|roof|electrical|before|after)\s+photos?\b/.test(t)
              || /\bhave\s+we\s+paid\s+the\b/.test(t)
              || /\bhow\s+much\s+have\s+we\s+spent\b/.test(t)
              || /\bwhat'?s\s+left\s+to\s+do\b/.test(t)
              || /\bwhat\s+delayed\s+the\s+project\b/.test(t)
              || /\bshow\s+(all\s+)?variations\b/.test(t)
              || /\bshow\s+delivery\s+notes\b/.test(t)
              || /\bshow\s+scaffold\s+certificates\b/.test(t)
              || /\bopen\s+latest\s+drawing\b/.test(t)
              || /\bwhen\s+is\s+completion\b/.test(t),
    build: (_t, original) => ({ kind: "project_intel", question: original })
  },
  // Business Intelligence questions — routed to the BI engine BEFORE the
  // knowledge fallback so "how's business" doesn't get RAG'd.
  {
    match: (t) => /\b(how'?s\s+business|business\s+health|health\s+score)\b/.test(t)
              || /\b(revenue|turnover|income|profit|margin)\b/.test(t)
              || /\b(who\s+owes|outstanding|unpaid|awaiting\s+(payment|reply))\b/.test(t)
              || /\b(quote\s+conversion|win\s+rate|conversion\s+rate)\b/.test(t)
              || /\b(response\s+(time|rate)|how\s+quickly\s+do\s+i\s+reply)\b/.test(t)
              || /\bhow\s+much\s+did\s+i\s+(make|earn)\b/.test(t)
              || /\bwhich\s+trade\s+earns\s+me\s+the\s+most\b/.test(t)
              || /\bwhat\s+should\s+i\s+(improve|work\s+on)\b/.test(t),
    build: (_t, original) => ({ kind: "business_intel", question: original })
  },
  // Memory Engine (Phase 26 V0) — merchant-scoped recall. "How did we
  // price X last time?", "which customers pay late?", "how's cash been?"
  // Sits ABOVE BOS so recall doesn't get swallowed by "can I afford"
  // or the general question fallback. Owner-only reads in V0 — cross-
  // tenant benchmarks arrive in V1.
  {
    match: (t) => /\bhow\s+(did|do)\s+(i|we|you)\s+price\b/.test(t)
              || /\bwhat\s+did\s+i\s+charge\s+for\b/.test(t)
              || /\bwhat'?s?\s+my\s+usual\s+price\b/.test(t)
              || /\bwhat\s+have\s+(we|i)\s+done\s+like\s+this\b/.test(t)
              || /\bsimilar\s+jobs?\s+before\b/.test(t)
              || /\banything\s+like\s+this\s+before\b/.test(t)
              || /\bwhich\s+customers?\s+(pay|paid)\s+late\b/.test(t)
              || /\bslow\s+payers?\b/.test(t)
              || /\bcash\s+(horizon|trend|history)\b/.test(t)
              || /\bhow'?s\s+cash\s+been\b/.test(t),
    build: (_t, original) => ({ kind: "memory", question: original })
  },
  // Business Operating System (Phase 25) — morning intelligence,
  // predictive risks, market signals, growth openings, "can I afford
  // X?" decisions, trade knowledge graph, action drafts. Sits ABOVE
  // digital_twin so "morning intelligence report" doesn't fall to the
  // "if I …" twin classifier. Sits ABOVE business_ops so the specific
  // BOS asks fire here rather than the generic Phase-22 briefing.
  {
    match: (t) => /\bmorning\s+intelligence\s+report\b/.test(t)
              || /\brun\s+my\s+business\s+intelligence\b/.test(t)
              || /\bbusiness\s+briefing\b/.test(t)
              || /\bpredict\s+(risks?|delays?)\b|\bproject\s+risks?\b|\bwhat\s+could\s+go\s+wrong\b/.test(t)
              || /\b(market|industry)\s+(signals?|trends?)\b/.test(t)
              || /\bgrowth\s+(opportunit|opps?)\b/.test(t)
              || /\bcan\s+i\s+afford\s+/.test(t)
              || /\bwhat\s+do\s+i\s+know\s+about\s+[a-z]/.test(t)
              || /\bdraft\s+(the\s+)?(reminders?|follow[- ]ups?|actions?)\b/.test(t),
    build: (_t, original) => ({ kind: "bos", question: original })
  },
  // Digital Twin — scenario simulation ("what if fuel goes up 20%",
  // "if I hire another carpenter", "if I raise prices by 5%"). Sits
  // BEFORE business_ops so "run my business" doesn't swallow "if I
  // hire". Never persists anything.
  {
    match: (t) => /\bif\s+fuel\s+(?:increases?|goes?\s+up|rises?)\s+by\s+\d/.test(t)
              || /\bif\s+i\s+(?:raise|increase|bump)\s+(?:my\s+)?prices?\s+by\s+\d/.test(t)
              || /\bif\s+i\s+hire\s+(?:another|an?)\s+/.test(t)
              || /\b(?:if\s+i\s+buy|can\s+i\s+buy)\s+(?:another\s+)?(?:a\s+)?van\b/.test(t)
              || /\bif\s+i\s+(?:advertise|spend)\s+£?\d/.test(t)
              || /\blist\s+scenarios\b|\bwhat\s+scenarios\s+can\b/.test(t),
    build: (_t, original) => ({ kind: "digital_twin", question: original })
  },
  // Business Operations — the "Good morning Phil" personalised
  // briefing composer. Sits at the TOP so "morning nex" fires
  // immediately without hitting other classifiers.
  {
    match: (t) => /\bmorning\s+nex\b|\bgood\s+morning\s+nex\b/.test(t)
              || /\bwhat'?s\s+today\s+looking\s+like\b/.test(t)
              || /\bmorning\s+briefing\b/.test(t)
              || /\brun\s+my\s+business\b/.test(t)
              || /\bprepare\s+today'?s\s+work\b/.test(t),
    build: (_t, original) => ({ kind: "business_ops", question: original })
  },
  // Global Intelligence — regulation asks with an explicit country
  // hint AND country-profile asks. Sits ABOVE World so
  // "the regulation in Canada for stairs" gets the country-hint path
  // (World's own regulation branch handles the merchant-resolved case).
  {
    match: (t) => /\b(country|regional|market)\s+profile\b/.test(t)
              || /\btell\s+me\s+about\s+construction\s+in\s+(canada|new\s+zealand|uae|dubai|australia|ireland|scotland|england|wales|us)\b/.test(t)
              || /\bwhat'?s\s+my\s+country(?:\s+profile)?\b/.test(t)
              || /\b(?:regulation|standard|code)\s+(?:for|in)\s+(canada|australia|ireland|scotland|england|wales|new\s+zealand|uae|dubai|us|united\s+states)\b/.test(t)
              || /\bin\s+(canada|australia|ireland|scotland|wales|new\s+zealand|uae|dubai|us|united\s+states)[,.\s].*\b(regulation|code|standard)\b/.test(t),
    build: (_t, original) => ({ kind: "global", question: original })
  },
  // World Model — location + regulations + universal search + impact
  // analysis. Sits ABOVE the knowledge fallback so region-aware
  // regulation asks route here.
  {
    match: (t) => /\bwhat\s+country\s+am\s+i\s+in\b|\bwhere\s+am\s+i\b|\bmy\s+location\b|\bset\s+my\s+country\b/.test(t)
              || /\bwhat'?s\s+the\s+minimum\s+stair\s+width\b/.test(t)
              || /\b(minimum|maximum)\s+.+\s+for\s+(stairs|staircase|fire|access|electrical|plumbing)\b/.test(t)
              || /\bbuilding\s+regulations?\s+for\b/.test(t)
              || /\bapproved\s+document\s+[a-z]/.test(t)
              || /\bwhat\s+(happens|if)\s+i\s+(delay|cancel|reprice|reassign)\s+/.test(t)
              || /\buniversal\s+search\b|\bsearch\s+everything\b/.test(t),
    build: (_t, original) => ({ kind: "world", question: original })
  },
  // Orchestrator — compound asks like "quote this extension" that
  // need multiple specialists coordinated. Sits BEFORE the question
  // fallback so multi-agent shapes ("plan my week", "organise my next
  // project", "loft conversion", "load-bearing wall", "heat pump into
  // listed building") route here. Phase 24 routes chat to the mesh
  // (single Nex voice, ~40 specialists) rather than the baseline runner.
  {
    match: (t) => /\bquote\s+(this|my|the)\s+(extension|kitchen|bathroom|loft|renovation|project)\b/.test(t)
              || /\bprice\s+(this|my|the)\s+(extension|kitchen|bathroom|loft|renovation|project)\b/.test(t)
              || /\borganise\s+(my|the)\s+next\s+project\b/.test(t)
              || /\bprepare\s+(my|the)\s+next\s+project\b/.test(t)
              || /\bplan\s+my\s+(week|day)\b/.test(t)
              || /\bstarting\s+.+(next\s+monday|next\s+week)\b/.test(t)
              || /\bhelp\s+(this|the)\s+customer\b/.test(t)
              || /\bloft\s+conversion\b/.test(t)
              || /\bload[- ]?bearing\b|\bknock\s+(through|down)\b|\bremove\s+(this|a)\s+wall\b/.test(t)
              || /\bheat\s+pump\b|\bashp\b|\bgshp\b/.test(t)
              || /\blisted\s+building\b|\bconservation\s+area\b/.test(t),
    build: (_t, original) => ({ kind: "orchestrate", question: original })
  },
  // Question fallback — anything shaped like a question routes to knowledge.
  {
    match: (t) => /^(what|how|why|when|is|does|do|are|can|which|who|where)\b/.test(t) || /\?$/.test(t),
    build: (t) => ({ kind: "answer", topic: t })
  }
];

/** Detect intent from a raw merchant utterance. Case-insensitive
 *  matching against the lowercased text; original preserved for
 *  intents that need it (research, teach). */
export function detectIntent(text: string): NexIntent {
  const original = text.trim();
  const t = original.toLowerCase();
  if (!t) return { kind: "unknown", original: text };
  for (const p of PATTERNS) {
    if (p.match(t, original)) return p.build(t, original);
  }
  return { kind: "unknown", original: text };
}
