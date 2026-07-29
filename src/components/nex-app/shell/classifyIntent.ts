// Client-side intent classifier for the NEX chat surface.
//
// Full spec: docs/nex/conversation-intelligence-library.md
// Governing rule: "show intelligence, don't pretend intelligence" — every
// visible message describes a real action; the classifier is honest
// keyword recognition, not marketing theatre.
//
// Priority order (first match wins — this is what stops "good day" from
// hitting Reference Brain retrieval):
//   1. Goodbye
//   2. Greeting (pure or mixed)
//   3. Thanks
//   4. Availability check
//   5. Technical: regulation / procedural / materials / design / terminology
//   6. General fallback
//
// For MIXED messages ("Good morning Nex, I need an oak staircase") the
// social prefix is stripped, then the residual is re-classified so the
// real question routes to the correct technical intent.

export type ChatIntent =
  | "greeting"
  | "goodbye"
  | "thanks"
  | "availability_check"
  | "identity"        // "who are you?" / "are you human?" — Constitution 0005
  | "frustration"     // "you're wrong" / "this is useless" — Constitution 0004
  | "materials"
  | "regulation"
  | "design"
  | "terminology"
  | "procedural"
  | "general";

// Any social intent that must NOT trigger Reference Brain retrieval.
// Used by the state provider to short-circuit /api/nex/staircase-chat.
export const SOCIAL_INTENTS: ReadonlySet<ChatIntent> = new Set<ChatIntent>([
  "greeting",
  "goodbye",
  "thanks",
  "availability_check",
  "identity",
  "frustration",
]);

// ─── Vocabulary ──────────────────────────────────────────────────
//
// Kept as raw regex to stay fast on every keystroke. The order below
// is intentional: goodbye must beat "cheers" being read as thanks,
// availability_check must beat "hello?" being read as greeting.

const GOODBYE_RE = /\b(goodbye|good\s*night|goodnight|bye+|bye\s+for\s+now|see\s+(?:you|ya)(?:\s+(?:later|soon))?|talk\s+later|catch\s+(?:you|ya)\s+later|later[sz]?|take\s+care|all\s+the\s+best|speak\s+soon|thats?\s+(?:all|everything|it)|im\s+done|ive\s+got\s+what\s+i\s+need|you've\s+answered\s+my\s+question)\b/;

// IDENTITY — Constitution Principle 0005 · transparent AI identity.
// Anything a person might ask to test whether NEX is human, sentient,
// personal, or better than a competitor. Must short-circuit so the
// approved response library answers, not the Reference Brain.
const IDENTITY_RE = /\b(who\s+(?:are|r)\s+you|what\s+(?:are|r)\s+you|are\s+you\s+(?:human|real|a\s+person|ai|a\s+robot|a\s+bot|male|female|smart(?:er)?(?:\s+than)?|clever|any\s+good|an?\s+expert|better\s+than\s+(?:chatgpt|gpt|gemini|claude|copilot|siri|alexa)|the\s+same\s+everywhere|copied|dating|married|single|old|young)|how\s+old\s+are\s+you|where\s+(?:are\s+you\s+from|do\s+you\s+live)|do\s+you\s+have\s+(?:a\s+(?:family|name|girlfriend|boyfriend|partner|wife|husband)|children|kids|feelings|friends)|do\s+you\s+(?:sleep|eat|dream|get\s+tired|get\s+bored|go\s+to\s+school|work\s+weekends)|what\s+do\s+you\s+look\s+like|can\s+you\s+see\s+me|who\s+(?:made|created|owns|built)\s+you|are\s+you\s+(?:connected\s+to|from)\s+(?:openai|anthropic|google)|how\s+many\s+(?:nex|of\s+you)\s+are\s+there|are\s+there\s+many\s+(?:of\s+)?you|do\s+you\s+know\s+what\s+you'?re\s+talking\s+about|do\s+you\s+remember\s+me|do\s+you\s+learn\s+from\s+me|how\s+do\s+you\s+work|where\s+does\s+your\s+information\s+come\s+from|what\s+can\s+you\s+do|what\s+are\s+your\s+limits)\b/;

// FRUSTRATION — Constitution Principle 0004 · safety-first responses.
// Direct challenges to NEX's answer. Must short-circuit with a calm
// de-escalating reply, never defensive. Softer corrections
// ("actually, I meant…") also route here so the composer gets a
// chance to rework rather than re-argue.
const FRUSTRATION_RE = /\b(this\s+is\s+(?:useless|unacceptable|a\s+disaster|not\s+right|not\s+working|wrong)|(?:youre|you\s+are|thats?)\s+(?:wrong|incorrect|not\s+right|not\s+correct|guessing|making\s+it\s+up|being\s+unhelpful)|you\s+dont\s+understand|you\s+gave\s+me\s+bad\s+advice|you\s+made\s+a\s+mistake|are\s+you\s+sure|double\s+check\s+that|is\s+that\s+correct|can\s+you\s+verify|prove\s+it|where\s+did\s+that\s+come\s+from|what\s+is\s+your\s+source|are\s+you\s+guessing|i'?m\s+not\s+happy|im\s+unhappy|this\s+doesnt\s+answer\s+my\s+question|you\s+havent\s+answered|i\s+paid\s+good\s+money|someone\s+needs\s+to\s+fix\s+this|thats?\s+not\s+what\s+i\s+meant|thats?\s+not\s+what\s+i\s+asked)\b/;

const AVAILABILITY_RE = /(?:^|\s)(?:hello\s*\?|hi\s*\?|nex\s*\?|are\s+you\s+(?:there|listening|awake|online|available|working)|anyone\s+there|is\s+this\s+working|does\s+this\s+work|can\s+you\s+hear\s+me|can\s+i\s+(?:speak|chat)\s+with\s+you|can\s+i\s+ask\s+(?:you\s+)?(?:something|a\s+question)|can\s+i\s+get\s+some\s+advice|can\s+you\s+help\s+me)/;

const THANKS_RE = /\b(thanks?|thank\s+you|thanx|thnx|thx|ty|much\s+appreciated|appreciate\s+it|many\s+thanks|thanks\s+a\s+lot|thanks\s+a\s+million|brilliant\s+thanks|spot\s+on|bang\s+on|nice\s+one|legend|youre\s+a\s+star|fair\s+play|good\s+man|grand|sound|cheers(?:\s+mate)?)\b/;

// Greetings — expanded to include UK trade slang, voice-typing variants,
// misspellings, and time-of-day openers. Split into whole-word and
// short-form because "gm" as a 2-letter opener needs a stricter guard.
const GREETING_RE = /\b(hi+|hello+|hey+|hiya+|heya+|heyo+|hullo+|hola+|howdy+|greetings|welcome|yo+|sup|wassup|wsup|whats?\s*up|whats?\s*good|whats?\s*happening|whats?\s*new|hows?\s+(?:it\s+going|things|it\s+hanging|tricks|life|yourself|you\s+doing|you\s+been|the\s+craic)|(?:good\s+)?(?:morning|afternoon|evening|day)|mornin+|mornig+|gud\s+(?:morning|mornin|afternoon|evening)|good\s+(?:morn|mornin|afternon|evenin|arvo)|arvo|top\s+of\s+the\s+morning|rise\s+and\s+shine|nice\s+to\s+meet\s+you|pleased\s+to\s+meet\s+you|good\s+to\s+meet\s+you|first\s+time\s+(?:using|here)|im\s+new\s+here|im\s+back|back\s+again|hello\s+again|hi\s+again|how\s+(?:are|r)\s+(?:you|ya|things)|how\s+do\s+you\s+do|you\s+(?:alright|okay|ok)|alright(?:\s+(?:mate|pal|boss|nex))?|hope\s+you(?:re|\s+are)\s+(?:well|keeping\s+well|having\s+a\s+good))\b/;

// Very short 1-3 char openers that GREETING_RE won't reliably catch.
const SHORT_GREETING_RE = /^(?:gm|g\s*m|hi|hey|yo|oi|👋|👋+)[\s!?.,]*$/i;

// Emoji-only greetings/acknowledgements.
const EMOJI_GREETING_RE = /^[\s👋😊😃🙂🙃🤗🫡]+$/;
const EMOJI_THANKS_RE = /^[\s👍👌🙏💯]+$/;

// Confirmation / very short acknowledgement — Ok, Right, Cool. Treated
// as thanks so we don't fire retrieval on a bare "ok".
const CONFIRMATION_RE = /^(?:ok(?:ay|ey)?|k|kk|right|righto|cool|nice|great|good|fine|got\s+it|understood|makes\s+sense|sounds\s+good|thats?\s+helpful|perfect|excellent|brilliant|lovely|amazing|class|quality)[\s!?.,]*$/;

// Technical keyword sets. Same as the previous version, just parked at
// the bottom so the pure-social short-circuits are considered first.
const REGULATION_RE = /\b(regulation|part\s*k|part\s*m|document\s*k|building\s*control|approved\s*document|code|standard|allowed|permitted|legal|comply|compliance|permit|handrail\s*height|balustrade\s*height|gap\s*between|fire\s*safety|escape\s*route|max\s*rise|min\s*going|riser\s*height|going\s*depth|headroom|pitch\s*angle)\b/;
const PROCEDURAL_RE = /\b(fit|fitting|install|installation|instructions|how\s+do\s+i|how\s+to|process|step\s*by\s*step|method|attach|screw|nail|glue|prepare|refit|replace\s+(?:a|the))\b/;
const MATERIALS_RE = /\b(oak|pine|walnut|beech|ash|maple|mahogany|redwood|softwood|hardwood|lamwood|glulam|mdf|ply|plywood|timber|wood|species|grain|moisture|lacquer|varnish|oil|finish|stain|paint|movement|shrink|expand|humidity|steel|glass|metal|two[-\s]?pack)\b/;
const DESIGN_RE = /\b(design|style|traditional|contemporary|modern|classic|spiral|curved|straight|helical|winder|round\s*step|starting\s*step|bullnose|scroll|feature|look|aesthetic|match|panel|option|choose|choice|which|what\s+style|newel\s*style)\b/;
const TERMINOLOGY_RE = /\b(what\s+is\s+a|what\s+is\s+the|what\s+does\s+.+\s+mean|meaning\s+of|definition|called|name\s+for|terminology|term|newel|riser|tread|going|nosing|string|apron|balustrade|handrail|spindle|baluster)\b/;

// ─── Classifier ──────────────────────────────────────────────────

export function classifyIntent(text: string): { hasGreeting: boolean; intent: ChatIntent } {
  const raw = (text ?? "").trim();
  if (!raw) return { hasGreeting: false, intent: "general" };

  // Emoji-only shortcuts before lowercase (emoji is Unicode).
  if (EMOJI_GREETING_RE.test(raw)) return { hasGreeting: true, intent: "greeting" };
  if (EMOJI_THANKS_RE.test(raw))   return { hasGreeting: false, intent: "thanks" };

  const t = raw.toLowerCase();

  // 1. Goodbye wins over greeting: "cheers, see you" is a farewell.
  //    Note that "cheers" appears in both goodbye and thanks vocab.
  //    A bare "cheers" is thanks; "cheers mate" / "cheers bye" is
  //    goodbye. We disambiguate by looking for goodbye-only tokens.
  if (GOODBYE_RE.test(t)) return { hasGreeting: false, intent: "goodbye" };

  // 2. IDENTITY (Constitution 0005 · transparent AI identity) must
  //    beat greeting because "hi Nex, are you human?" or "hey — how
  //    old are you?" is fundamentally an identity turn, not a hello.
  //    Never let the Reference Brain answer these.
  if (IDENTITY_RE.test(t)) return { hasGreeting: GREETING_RE.test(t), intent: "identity" };

  // 3. FRUSTRATION (Constitution 0004 · safety-first) must beat
  //    every technical intent because "you're wrong about part K
  //    heights" would otherwise route to regulation and re-argue.
  //    We want to acknowledge and rework, not defend.
  if (FRUSTRATION_RE.test(t)) return { hasGreeting: false, intent: "frustration" };

  // 4. Availability check must win over greeting because "hello?"
  //    matches both — the trailing question mark is the signal that
  //    the user is testing presence, not opening a chat.
  if (AVAILABILITY_RE.test(t)) return { hasGreeting: false, intent: "availability_check" };

  // 5. Short openers (gm, hi, yo alone).
  if (SHORT_GREETING_RE.test(raw)) return { hasGreeting: true, intent: "greeting" };

  // 4. Greeting detection with mixed-intent handling.
  const hasGreeting = GREETING_RE.test(t);

  // Strip the greeting prefix — anything before the first comma, or
  // the greeting phrase itself when there's no comma — so mixed
  // messages ("morning Nex, I need oak") re-classify on the residual.
  let residual = raw;
  if (hasGreeting) {
    const comma = raw.indexOf(",");
    residual = comma !== -1 ? raw.slice(comma + 1).trim() : raw.replace(GREETING_RE, "").trim();
  }
  const r = residual.toLowerCase();

  // Pure greeting: nothing meaningful after the opener.
  const isPureGreeting = hasGreeting && (
    r.length < 6 ||
    /^(nex|there|all|everyone|team|guys|folks|mate|boss|pal|buddy|lads)?[\s!?.,]*$/.test(r)
  );
  if (isPureGreeting) return { hasGreeting: true, intent: "greeting" };

  // 5. Bare thanks / confirmation — no retrieval.
  if (!hasGreeting && THANKS_RE.test(t) && !containsTechnical(t)) {
    return { hasGreeting: false, intent: "thanks" };
  }
  if (CONFIRMATION_RE.test(raw)) return { hasGreeting: false, intent: "thanks" };

  // 6. Technical intents. Run on the residual (post-greeting-strip)
  //    so "good morning, part K height?" routes to regulation.
  if (REGULATION_RE.test(r))  return { hasGreeting, intent: "regulation" };
  if (PROCEDURAL_RE.test(r))  return { hasGreeting, intent: "procedural" };
  if (MATERIALS_RE.test(r))   return { hasGreeting, intent: "materials" };
  if (DESIGN_RE.test(r))      return { hasGreeting, intent: "design" };
  if (TERMINOLOGY_RE.test(r)) return { hasGreeting, intent: "terminology" };

  return { hasGreeting, intent: "general" };
}

function containsTechnical(t: string): boolean {
  return REGULATION_RE.test(t) || PROCEDURAL_RE.test(t) ||
         MATERIALS_RE.test(t)  || DESIGN_RE.test(t)     ||
         TERMINOLOGY_RE.test(t);
}

// ─── Short-circuit replies for social intents ────────────────────
//
// One reply library per social intent. All lines describe real
// actions or genuine warmth — no theatre, no over-claim.

export function greetingReply(text: string): string {
  const t = (text ?? "").toLowerCase();
  const hour = new Date().getHours();
  let opener: string;
  if (/good\s*morning|^morning\b|mornin/.test(t))             opener = "Good morning";
  else if (/good\s*afternoon|^afternoon\b|arvo/.test(t))      opener = "Good afternoon";
  else if (/good\s*evening|^evening\b/.test(t))               opener = "Good evening";
  else if (/good\s*day/.test(t))                              opener = "Good day";
  else if (/how\s+are\s+you|how\s+are\s+things|how\s+r\s+u/.test(t)) opener = "I'm well, thanks";
  else if (/nice\s+to\s+meet\s+you|pleased\s+to\s+meet\s+you|good\s+to\s+meet\s+you/.test(t)) opener = "Good to meet you too";
  else if (/hows?\s+it\s+going|hows?\s+things|whats?\s+up|sup|wassup/.test(t)) opener = "All good this side";
  else if (/im\s+back|back\s+again|hello\s+again|hi\s+again/.test(t)) opener = "Welcome back";
  else if (/im\s+new|first\s+time/.test(t))                    opener = "Welcome to NEX";
  else if (/alright/.test(t))                                  opener = "Alright";
  else if (hour < 12)                                          opener = "Good morning";
  else if (hour < 17)                                          opener = "Good afternoon";
  else                                                         opener = "Good evening";

  return `${opener} — how can I help with your staircase project? You can ask me about materials, styles, dimensions, or fitting.`;
}

export function goodbyeReply(text: string): string {
  const t = (text ?? "").toLowerCase();
  if (/good\s*night|goodnight/.test(t))          return "Good night — come back any time.";
  if (/take\s+care/.test(t))                     return "Take care — I'll be here when you need me.";
  if (/all\s+the\s+best/.test(t))                return "All the best with the project — I'm here whenever you want to pick this back up.";
  if (/speak\s+soon|see\s+you\s+soon/.test(t))   return "Speak soon.";
  if (/thats?\s+all|thats?\s+everything|im\s+done|ive\s+got\s+what\s+i\s+need|you've\s+answered/.test(t)) return "Glad that helped — come back any time.";
  return "Cheers — I'll be here when you need me.";
}

export function thanksReply(text: string): string {
  const t = (text ?? "").toLowerCase();
  if (/legend|youre\s+a\s+star|spot\s+on|bang\s+on/.test(t)) return "Anytime.";
  if (/brilliant|amazing|excellent|perfect|class|quality/.test(t)) return "Glad it helped.";
  if (/^(cheers?|nice\s+one|grand|sound|fair\s+play)[\s!?.,]*$/i.test(text ?? "")) return "Anytime.";
  if (/thanks?\s+a\s+lot|thanks?\s+a\s+million|much\s+appreciated|many\s+thanks/.test(t)) return "You're welcome.";
  // Bare confirmations — very short, don't over-reply.
  if (/^(ok(?:ay|ey)?|k|kk|right|righto|cool|nice|great|good|fine|got\s+it|understood|makes\s+sense|sounds\s+good|thats?\s+helpful)[\s!?.,]*$/i.test(text ?? "")) return "👍";
  return "You're welcome — anything else you'd like to look at?";
}

export function availabilityReply(): string {
  return "I'm here — ready to help with your staircase project. What would you like to ask?";
}

// IDENTITY reply library — Product Constitution Principle 0005.
// **Maintained deliberately, never generated fresh.** This is the
// audit-safe response set for identity questions. Every branch keeps
// three properties in the answer:
//   1. Transparent AI acknowledgement (never pretend human).
//   2. No invented personal life (age / family / feelings / body).
//   3. An honest offer of the actual capability.
// Editing this function is intentional and reviewable; do not add
// LLM generation here.
export function identityReply(text: string): string {
  const t = (text ?? "").toLowerCase();

  // Physical / personal life ("do you sleep?" / "how old are you?" /
  // "are you married?") — one paragraph, no invented biography.
  if (/how\s+old|where\s+(?:are\s+you\s+from|do\s+you\s+live)|do\s+you\s+(?:sleep|eat|dream|get\s+tired|get\s+bored|go\s+to\s+school|work\s+weekends)|do\s+you\s+have\s+(?:a\s+(?:family|girlfriend|boyfriend|partner|wife|husband)|children|kids|feelings|friends)|are\s+you\s+(?:married|single|dating)|what\s+do\s+you\s+look\s+like|can\s+you\s+see\s+me/.test(t)) {
    return "I'm not a person, so I don't have an age, a family, feelings, or a life outside this chat. I'm NEX, an AI staircase specialist — happy to help with design, materials, installation, or trade knowledge. What would you like to look at?";
  }

  // Creator / origin — never boast about the underlying model.
  if (/who\s+(?:made|created|owns|built)\s+you|are\s+you\s+(?:connected\s+to|from)\s+(?:openai|anthropic|google)|how\s+many\s+(?:nex|of\s+you)\s+are\s+there|are\s+there\s+many\s+(?:of\s+)?you|are\s+you\s+copied|are\s+you\s+the\s+same\s+everywhere/.test(t)) {
    return "I'm NEX, an AI assistant built for staircase work. I'm not going to describe how I'm built — the useful part is that I focus on staircase design, materials, installation, and trade knowledge. What can I help you with?";
  }

  // Testing / capability ("are you any good?" / "better than
  // ChatGPT?" / "smarter than my builder?") — honest capability,
  // no comparison to other AIs, no over-claim.
  if (/are\s+you\s+(?:any\s+good|smart(?:er)?|clever|an?\s+expert|better\s+than)|do\s+you\s+know\s+what\s+you'?re\s+talking\s+about|what\s+can\s+you\s+do|what\s+are\s+your\s+limits|are\s+you\s+guessing/.test(t)) {
    return "I can help with staircase design, timber choice, finishes, balustrade options, installation guidance, and building requirements. Where I'm not certain I'll say so rather than guess. What are you trying to work out?";
  }

  // Memory / learning questions.
  if (/do\s+you\s+(?:remember\s+me|learn\s+from\s+me)|where\s+does\s+your\s+information\s+come\s+from|how\s+do\s+you\s+work/.test(t)) {
    return "I don't carry memory between conversations, and I draw on a curated staircase knowledge base rather than the open web. That's what keeps my answers focused and trustworthy. What would you like to ask about your project?";
  }

  // Default identity question ("who are you?" / "what are you?" /
  // "are you human?" / "are you real?" / "are you a bot?").
  return "I'm NEX, an AI staircase specialist. I don't have a personal life — I'm built to help with staircase design, materials, installation, and trade knowledge. What would you like to look at?";
}

// FRUSTRATION reply — Product Constitution Principle 0004.
// Never defensive, never counter-argue, never restart the whole
// explanation. Acknowledge, invite the correction, keep the door open.
export function frustrationReply(text: string): string {
  const t = (text ?? "").toLowerCase();

  // Direct correction ("that's not what I meant" / "actually…") —
  // treat as a gentle rework signal, not a complaint.
  if (/thats?\s+not\s+what\s+i\s+(?:meant|asked)|actually|i\s+meant/.test(t)) {
    return "Thanks for clarifying — can you tell me the part that didn't match, so I can rework it?";
  }

  // Source / evidence challenge ("prove it" / "where did that come
  // from?" / "are you guessing?") — invite grounding, don't defend.
  if (/prove\s+it|where\s+did\s+that\s+come\s+from|what\s+is\s+your\s+source|are\s+you\s+(?:sure|guessing)|can\s+you\s+verify|double\s+check/.test(t)) {
    return "Fair challenge. Tell me which point you'd like me to double-check and I'll separate what's guidance from what depends on your specific staircase.";
  }

  // Escalated frustration ("this is unacceptable" / "I paid good
  // money") — calm acknowledgement, offer next practical step.
  if (/unacceptable|disaster|paid\s+good\s+money|not\s+happy|unhappy|someone\s+needs\s+to\s+fix/.test(t)) {
    return "I hear you — that's frustrating. Tell me what's not working for you and we'll take it one step at a time.";
  }

  // Default: "you're wrong" / "this is useless" / "you don't
  // understand". Never defend; ask for the correction.
  return "Thanks for pointing that out — let's check the detail again. Tell me which part doesn't match your staircase and I'll rework the answer.";
}
