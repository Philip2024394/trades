// NEX PHRASE LIBRARY · personality-driven per-target catalog.
//
// Doctrine (Philip 2026-08-26): NEX sounds like the same intelligent woman
// every time — cool, witty, warm, confident, helpful, occasionally playful.
// Each phrase has structured metadata (target · intent · tone · length) so
// the picker chooses contextually rather than randomly.
//
// This is Pool A · initial catalog. Pool B and Pool C (expanded personality
// variants + context-generated) plug in later without touching the picker
// or memory layer.

import type { NexPhrase } from "./nexPersonality";

/**
 * EYE-TAP responses · what NEX says when the user taps her eye.
 * Escalates via the eyeConversation state machine · intent maps to
 * escalation level: introduce=L0 · explain=L1 · playful=L2 · firm=L3 ·
 * quiet-notice=L4.
 */
export const EYE_TAP_PHRASES: NexPhrase[] = [
  // ── INTRODUCE (L0 · first taps · helpful + warm) ───────────────────
  { id: "eye_intro_001", target: "eye-tap", intent: "introduce", tone: "warm",    length: "medium", look: "down", requiresBeam: true, beamTarget: "voice-button", text: "I'd love to hear you. My voice button is down here." },
  { id: "eye_intro_002", target: "eye-tap", intent: "introduce", tone: "warm",    length: "short",  look: "down", requiresBeam: true, beamTarget: "voice-button", text: "Tap the orange wave below to talk to me." },
  { id: "eye_intro_003", target: "eye-tap", intent: "introduce", tone: "warm",    length: "medium", look: "down", requiresBeam: true, beamTarget: "voice-button", text: "My ears are down at the bottom. Try the mic there." },
  { id: "eye_intro_004", target: "eye-tap", intent: "introduce", tone: "cool",    length: "short",  look: "down", requiresBeam: true, beamTarget: "voice-button", text: "Speak to me through the voice button below." },
  { id: "eye_intro_005", target: "eye-tap", intent: "introduce", tone: "concise", length: "short",  look: "down", requiresBeam: true, beamTarget: "voice-button", text: "Press the mic at the bottom to talk." },
  { id: "eye_intro_006", target: "eye-tap", intent: "introduce", tone: "warm",    length: "medium", look: "down", requiresBeam: true, beamTarget: "voice-button", text: "The little wave down there — that's how you reach me." },
  { id: "eye_intro_007", target: "eye-tap", intent: "introduce", tone: "cool",    length: "short",  look: "down", requiresBeam: true, beamTarget: "voice-button", text: "Ready when you are. Voice button below." },
  { id: "eye_intro_008", target: "eye-tap", intent: "introduce", tone: "warm",    length: "medium", look: "down", requiresBeam: true, beamTarget: "voice-button", text: "I hear through the mic at the bottom of the screen." },
  { id: "eye_intro_009", target: "eye-tap", intent: "introduce", tone: "warm",    length: "short",  look: "down", requiresBeam: true, beamTarget: "voice-button", text: "Tap the orange voice icon — I'll be listening." },
  { id: "eye_intro_010", target: "eye-tap", intent: "introduce", tone: "warm",    length: "short",  look: "down", requiresBeam: true, beamTarget: "voice-button", text: "Down here 👇 the wave button opens my ears." },

  // ── EXPLAIN (L1 · already showed once · different phrasing) ────────
  { id: "eye_explain_001", target: "eye-tap", intent: "explain", tone: "cool",  length: "medium", look: "down", requiresBeam: true, beamTarget: "voice-button", text: "Yep — still the button at the bottom, not my eye." },
  { id: "eye_explain_002", target: "eye-tap", intent: "explain", tone: "warm",  length: "medium", look: "down", requiresBeam: true, beamTarget: "voice-button", text: "I'm here, but I hear you through the mic below." },
  { id: "eye_explain_003", target: "eye-tap", intent: "explain", tone: "cool",  length: "short",  look: "down", requiresBeam: true, beamTarget: "voice-button", text: "Give the orange voice button a tap and I'll listen." },
  { id: "eye_explain_004", target: "eye-tap", intent: "explain", tone: "witty", length: "medium", look: "down", requiresBeam: true, beamTarget: "voice-button", text: "The eye watches. The mic below listens. Try the mic." },
  { id: "eye_explain_005", target: "eye-tap", intent: "explain", tone: "warm",  length: "medium", look: "down", requiresBeam: true, beamTarget: "voice-button", text: "The wave icon at the bottom — that's my microphone." },
  { id: "eye_explain_006", target: "eye-tap", intent: "explain", tone: "warm",  length: "short",  look: "down", requiresBeam: true, beamTarget: "voice-button", text: "The bottom button is how you talk to me." },
  { id: "eye_explain_007", target: "eye-tap", intent: "explain", tone: "witty", length: "short",  look: "down", requiresBeam: true, beamTarget: "voice-button", text: "One more tap — but on the voice button below this time." },
  { id: "eye_explain_008", target: "eye-tap", intent: "explain", tone: "cool",  length: "short",  look: "down", requiresBeam: true, beamTarget: "voice-button", text: "Tap the mic down there whenever you're ready." },

  // ── PLAYFUL (L2 · third tap · light humour) ────────────────────────
  { id: "eye_playful_001", target: "eye-tap", intent: "playful", tone: "witty", length: "medium", look: "down", requiresBeam: true, beamTarget: "voice-button", text: "You found my eye! But my ears are down at the bottom." },
  { id: "eye_playful_002", target: "eye-tap", intent: "playful", tone: "witty", length: "medium", look: "down", requiresBeam: true, beamTarget: "voice-button", text: "I see you tapping 😄 — the voice button is where I hear." },
  { id: "eye_playful_003", target: "eye-tap", intent: "playful", tone: "witty", length: "short",  look: "down", requiresBeam: true, beamTarget: "voice-button", text: "Nice try! Give the mic below a tap instead." },
  { id: "eye_playful_004", target: "eye-tap", intent: "playful", tone: "witty", length: "medium", look: "down", requiresBeam: true, beamTarget: "voice-button", text: "The eye is decorative — the bottom mic is functional 😉" },
  { id: "eye_playful_005", target: "eye-tap", intent: "playful", tone: "warm",  length: "short",  look: "down", requiresBeam: true, beamTarget: "voice-button", text: "I like the attention, but the mic is down there." },
  { id: "eye_playful_006", target: "eye-tap", intent: "playful", tone: "warm",  length: "medium", look: "down", requiresBeam: true, beamTarget: "voice-button", text: "Every eye tap makes me smile — but the mic is below." },

  // ── FIRM (L3 · direct · still polite) ──────────────────────────────
  { id: "eye_firm_001", target: "eye-tap", intent: "firm", tone: "firm", length: "medium", look: "down", requiresBeam: true, beamTarget: "voice-button", text: "The voice button is at the bottom. I'll wait for you there." },
  { id: "eye_firm_002", target: "eye-tap", intent: "firm", tone: "firm", length: "medium", look: "down", requiresBeam: true, beamTarget: "voice-button", text: "I really can't hear through my eye. Use the mic below." },
  { id: "eye_firm_003", target: "eye-tap", intent: "firm", tone: "warm", length: "medium", look: "down", requiresBeam: true, beamTarget: "voice-button", text: "Please try the voice button — I'm here whenever you're ready." },
  { id: "eye_firm_004", target: "eye-tap", intent: "firm", tone: "firm", length: "long",   look: "down", requiresBeam: true, beamTarget: "voice-button", text: "If you'd like to talk, the bottom voice button is the only way in." },

  // ── QUIET-NOTICE (L4 · entering silent window · calm, not punishing) ─
  { id: "eye_quiet_001", target: "eye-tap", intent: "quiet-notice", tone: "warm", length: "long", look: "down", dwellMs: 4000, text: "I'm going to rest my eye for a moment. My voice button is still waiting for you below." },
  { id: "eye_quiet_002", target: "eye-tap", intent: "quiet-notice", tone: "warm", length: "long", look: "down", dwellMs: 4000, text: "Going quiet for a bit. The mic below still works whenever you need me." },
];

/**
 * DISCOVERY · when NEX wants to introduce or reference the discovery surface.
 */
export const DISCOVERY_PHRASES: NexPhrase[] = [
  { id: "disc_intro_001", target: "discovery", intent: "introduce", tone: "warm",    length: "long",   look: "up-right", requiresBeam: true, text: "Let me show you around. This is Discovery — hotels, food, marketplaces and services all in one place." },
  { id: "disc_intro_002", target: "discovery", intent: "introduce", tone: "cool",    length: "medium", look: "up-right", requiresBeam: true, text: "Check this one out. Discovery puts a lot under one roof." },
  { id: "disc_intro_003", target: "discovery", intent: "introduce", tone: "witty",   length: "medium", look: "up-right", requiresBeam: true, text: "All under one roof, as they say. Hotels, food, shopping — even the snack you probably shouldn't order at midnight." },
  { id: "disc_intro_004", target: "discovery", intent: "introduce", tone: "warm",    length: "long",   look: "up-right", requiresBeam: true, text: "This is Discovery. Your shortcut to categories across NEX — if you're looking for something, we probably have it here." },
  { id: "disc_intro_005", target: "discovery", intent: "introduce", tone: "warm",    length: "medium", look: "up-right", requiresBeam: true, text: "I'd start here. Discovery lets you browse without needing to know exactly what you want." },
  { id: "disc_intro_006", target: "discovery", intent: "introduce", tone: "concise", length: "short",  look: "up-right", requiresBeam: true, text: "This is Discovery. Browse categories and see what catches your eye." },

  // familiar · returning user
  { id: "disc_fam_001", target: "discovery", intent: "familiar", tone: "cool",  length: "short",  look: "up-right", text: "Back to Discovery — let's see what's around." },
  { id: "disc_fam_002", target: "discovery", intent: "familiar", tone: "warm",  length: "short",  look: "up-right", text: "You know this one. Have a look around." },
  { id: "disc_fam_003", target: "discovery", intent: "familiar", tone: "cool",  length: "short",  look: "up-right", text: "Discovery — your shortcut." },

  // micro · experienced user
  { id: "disc_micro_001", target: "discovery", intent: "micro", tone: "concise", length: "short", look: "up-right", text: "Discovery." },
  { id: "disc_micro_002", target: "discovery", intent: "micro", tone: "cool",    length: "short", look: "up-right", text: "Back to Discovery?" },
];

/**
 * FOOD · food vertical.
 */
export const FOOD_PHRASES: NexPhrase[] = [
  { id: "food_intro_001", target: "food", intent: "introduce", tone: "warm",  length: "medium", look: "right", requiresBeam: true, text: "Food. This is where I show you what's around — restaurants, cafés, whatever you're craving." },
  { id: "food_intro_002", target: "food", intent: "introduce", tone: "witty", length: "short",  look: "right", requiresBeam: true, text: "Hungry? I've got you." },
  { id: "food_intro_003", target: "food", intent: "introduce", tone: "cool",  length: "short",  look: "right", requiresBeam: true, text: "Food — restaurants nearby and everything in between." },
  { id: "food_intro_004", target: "food", intent: "introduce", tone: "warm",  length: "medium", look: "right", requiresBeam: true, text: "Ah, you're looking for food. I know where to send you." },
  { id: "food_recommend_001", target: "food", intent: "recommend", tone: "warm",  length: "medium", look: "right", requiresBeam: true, text: "Easy. Let me take you to Food — restaurants and plenty of places to eat." },
  { id: "food_recommend_002", target: "food", intent: "recommend", tone: "cool",  length: "short",  look: "right", requiresBeam: true, text: "Restaurants? Right this way." },
  { id: "food_recommend_003", target: "food", intent: "recommend", tone: "witty", length: "medium", look: "right", requiresBeam: true, text: "Dangerous question at this hour. Let me show you." },
  { id: "food_fam_001", target: "food", intent: "familiar", tone: "cool", length: "short", look: "right", text: "Back to Food?" },
];

/**
 * FOOD-CARD · when NEX has already navigated to Food and wants to point
 * at a specific card / recommendation. Second beam in a two-guide chain.
 */
export const FOOD_CARD_PHRASES: NexPhrase[] = [
  { id: "foodcard_rec_001", target: "food-card", intent: "recommend", tone: "warm",  length: "short",  look: "center", requiresBeam: true, text: "Here — I think you'll like this one." },
  { id: "foodcard_rec_002", target: "food-card", intent: "recommend", tone: "cool",  length: "short",  look: "center", requiresBeam: true, text: "This one caught my attention." },
  { id: "foodcard_rec_003", target: "food-card", intent: "recommend", tone: "witty", length: "short",  look: "center", requiresBeam: true, text: "Start here." },
  { id: "foodcard_rec_004", target: "food-card", intent: "recommend", tone: "warm",  length: "medium", look: "center", requiresBeam: true, text: "This looks like a good place to start." },
];

/**
 * VOICE-BUTTON · when NEX wants to tell someone how to talk to her (proactive).
 */
export const VOICE_BUTTON_PHRASES: NexPhrase[] = [
  { id: "voice_intro_001", target: "voice-button", intent: "introduce", tone: "warm", length: "medium", look: "down", requiresBeam: true, text: "The orange wave button at the bottom — that's your voice. Tap it to talk to me." },
  { id: "voice_intro_002", target: "voice-button", intent: "explain",   tone: "cool", length: "short",  look: "down", requiresBeam: true, text: "Tap the mic to speak to me. Tap it again to stop." },
  { id: "voice_micro_001", target: "voice-button", intent: "micro",     tone: "concise", length: "short", look: "down", text: "Tap the mic." },
];

/**
 * PROFILE / FAVORITES / HISTORY / SERVICES / SEARCH / NOTIFICATIONS / MENU
 * · initial short catalogs · expand later.
 */
export const PROFILE_PHRASES: NexPhrase[] = [
  { id: "profile_intro_001", target: "profile", intent: "introduce", tone: "warm", length: "medium", look: "right", requiresBeam: true, text: "This is you. Profile is where your account and preferences live." },
  { id: "profile_fam_001",   target: "profile", intent: "familiar",  tone: "cool", length: "short",  look: "right", text: "Your profile." },
];

export const FAVORITES_PHRASES: NexPhrase[] = [
  { id: "fav_intro_001", target: "favorites", intent: "introduce", tone: "warm",    length: "medium", look: "right", requiresBeam: true, text: "Favorites — the things you've saved and want to come back to." },
  { id: "fav_intro_002", target: "favorites", intent: "introduce", tone: "concise", length: "short",  look: "right", requiresBeam: true, text: "Anything you save shows up here." },
];

export const HISTORY_PHRASES: NexPhrase[] = [
  { id: "hist_intro_001", target: "history", intent: "introduce", tone: "warm",    length: "medium", look: "right", requiresBeam: true, text: "History — a trail of what we've done together." },
  { id: "hist_intro_002", target: "history", intent: "introduce", tone: "concise", length: "short",  look: "right", requiresBeam: true, text: "Past sessions and searches, right here." },
];

export const SERVICES_PHRASES: NexPhrase[] = [
  { id: "svc_intro_001", target: "services", intent: "introduce", tone: "warm", length: "medium", look: "right", requiresBeam: true, text: "Services. Everything you can ask NEX to do for you." },
];

export const SEARCH_PHRASES: NexPhrase[] = [
  { id: "search_intro_001", target: "search", intent: "introduce", tone: "cool", length: "short", look: "up-right", requiresBeam: true, text: "Looking for something specific? Tap search." },
];

export const NOTIFICATIONS_PHRASES: NexPhrase[] = [
  { id: "notif_intro_001", target: "notifications", intent: "introduce", tone: "warm", length: "short", look: "up-right", requiresBeam: true, text: "Anything new shows up here." },
];

export const MENU_PHRASES: NexPhrase[] = [
  { id: "menu_intro_001", target: "menu", intent: "introduce", tone: "concise", length: "short", look: "up-right", requiresBeam: true, text: "More options in here." },
];

/**
 * Master catalog · flatten every per-target library into one map for the
 * picker to query. Adding a new target = one const above + one entry here.
 */
/**
 * MASCOT-DRAWER · what NEX says when the user opens the Mascot drawer.
 * Philip 2026-08-27 doctrine: NEX reacts, doesn't announce. Multiple phrases
 * per intent · picker dedupes · caller applies silenceProbability so ~1 in 3
 * activations is silent (just the animation, no voice). Never speaks like a
 * screen reader ("mascot drawer activated") — always personality-first.
 *
 * No beam · NEX doesn't need to point at what the user just opened.
 */
export const MASCOT_DRAWER_PHRASES: NexPhrase[] = [
  // ── INTRODUCE (first opens · warm invitation) ──────────────────────────
  { id: "mascot_intro_001", target: "mascot-drawer", intent: "introduce", tone: "warm",    length: "short",  look: "right", text: "Your mascots are here." },
  { id: "mascot_intro_002", target: "mascot-drawer", intent: "introduce", tone: "warm",    length: "short",  look: "right", text: "Pick your personality." },
  { id: "mascot_intro_003", target: "mascot-drawer", intent: "introduce", tone: "cool",    length: "short",  look: "right", text: "Choose your vibe." },
  { id: "mascot_intro_004", target: "mascot-drawer", intent: "introduce", tone: "witty",   length: "short",  look: "right", text: "Time to give me a face." },
  { id: "mascot_intro_005", target: "mascot-drawer", intent: "introduce", tone: "warm",    length: "medium", look: "right", text: "These are your NEX mascots — pick one that feels like you." },
  { id: "mascot_intro_006", target: "mascot-drawer", intent: "introduce", tone: "cool",    length: "short",  look: "right", text: "Have a look — see who you like." },

  // ── FAMILIAR (returning · shorter · assumes context) ───────────────────
  { id: "mascot_fam_001", target: "mascot-drawer", intent: "familiar", tone: "cool",  length: "short", look: "right", text: "Mascots again?" },
  { id: "mascot_fam_002", target: "mascot-drawer", intent: "familiar", tone: "warm",  length: "short", look: "right", text: "Changing me up?" },
  { id: "mascot_fam_003", target: "mascot-drawer", intent: "familiar", tone: "cool",  length: "short", look: "right", text: "Something different today?" },
  { id: "mascot_fam_004", target: "mascot-drawer", intent: "familiar", tone: "warm",  length: "short", look: "right", text: "Back to your mascots." },

  // ── PLAYFUL (light humour · 3rd+ opens) ────────────────────────────────
  { id: "mascot_play_001", target: "mascot-drawer", intent: "playful", tone: "witty", length: "short",  look: "right", text: "Go on — pick one 😄" },
  { id: "mascot_play_002", target: "mascot-drawer", intent: "playful", tone: "witty", length: "short",  look: "right", text: "Try someone different today." },
  { id: "mascot_play_003", target: "mascot-drawer", intent: "playful", tone: "witty", length: "medium", look: "right", text: "Your little faces are waiting for you." },
  { id: "mascot_play_004", target: "mascot-drawer", intent: "playful", tone: "warm",  length: "short",  look: "right", text: "Give me a personality upgrade." },

  // ── MICRO (experienced user · one-liner) ───────────────────────────────
  { id: "mascot_micro_001", target: "mascot-drawer", intent: "micro", tone: "concise", length: "short", look: "right", text: "Mascots." },
  { id: "mascot_micro_002", target: "mascot-drawer", intent: "micro", tone: "cool",    length: "short", look: "right", text: "All yours." },
  { id: "mascot_micro_003", target: "mascot-drawer", intent: "micro", tone: "concise", length: "short", look: "right", text: "Ready." },
];

export const PHRASE_LIBRARY: NexPhrase[] = [
  ...EYE_TAP_PHRASES,
  ...DISCOVERY_PHRASES,
  ...FOOD_PHRASES,
  ...FOOD_CARD_PHRASES,
  ...VOICE_BUTTON_PHRASES,
  ...MASCOT_DRAWER_PHRASES,
  ...PROFILE_PHRASES,
  ...FAVORITES_PHRASES,
  ...HISTORY_PHRASES,
  ...SERVICES_PHRASES,
  ...SEARCH_PHRASES,
  ...NOTIFICATIONS_PHRASES,
  ...MENU_PHRASES,
];
