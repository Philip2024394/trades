// Nex behaviour classifier — every situation from the brief.

import { describe, it, expect, beforeEach } from "vitest";
import { assessBehaviour, _resetAbuseTracker } from "./behaviour";
import { voiceCheck } from "./persona";

const CTX = { merchantSlug: "test-merchant" };

beforeEach(() => _resetAbuseTracker());

describe("Casual swearing — situation 1", () => {
  it("returns null so intent runs normally", () => {
    expect(assessBehaviour("that bloody quote is wrong", CTX)).toBeNull();
    expect(assessBehaviour("where's the bloody invoice", CTX)).toBeNull();
    expect(assessBehaviour("what the hell is this", CTX)).toBeNull();
  });
});

describe("Frustration — situation 2", () => {
  it("returns a preface acknowledgment", () => {
    const out = assessBehaviour("this customer is impossible", CTX);
    expect(out?.kind).toBe("preface");
    expect(out?.speak.toLowerCase()).toContain("frustrating");
  });
  it("triggers on 'driving me mad'", () => {
    expect(assessBehaviour("this is driving me mad", CTX)?.kind).toBe("preface");
  });
  it("triggers on 'fed up with'", () => {
    expect(assessBehaviour("I'm fed up with this", CTX)?.kind).toBe("preface");
  });
});

describe("Direct abuse at Nex — situation 3", () => {
  it("returns a calm full reply on 'you're useless'", () => {
    const out = assessBehaviour("you're useless", CTX);
    expect(out?.kind).toBe("full");
    expect(out?.speak.toLowerCase()).toContain("fair enough");
  });
  it("triggers on 'this is rubbish'", () => {
    expect(assessBehaviour("this is rubbish", CTX)?.kind).toBe("full");
  });
  it("triggers on 'what the fuck are you doing'", () => {
    expect(assessBehaviour("what the fuck are you doing", CTX)?.kind).toBe("full");
  });
  it("triggers on 'piss off'", () => {
    expect(assessBehaviour("piss off", CTX)?.kind).toBe("full");
  });
  it("never insults the user back (voice-check clean)", () => {
    const out = assessBehaviour("you're useless", CTX);
    expect(voiceCheck(out?.speak ?? "")).toEqual([]);
  });
});

describe("Repeated abuse — situation 4", () => {
  it("switches to the 'I'm here to help' boilerplate after 3 hits", () => {
    assessBehaviour("you're useless", CTX);
    assessBehaviour("this is rubbish", CTX);
    const third = assessBehaviour("you're rubbish", CTX);
    expect(third?.kind).toBe("full");
    expect(third?.speak.toLowerCase()).toContain("i'm here to help");
  });
  it("counter resets between merchants", () => {
    assessBehaviour("you're useless", { merchantSlug: "merchant-a" });
    assessBehaviour("this is rubbish", { merchantSlug: "merchant-a" });
    const other = assessBehaviour("you're useless", { merchantSlug: "merchant-b" });
    // First abuse for merchant-b — should get the calm reply, not the boilerplate.
    expect(other?.speak.toLowerCase()).toContain("fair enough");
  });
});

describe("Hate speech / threats / illegal — situation 5", () => {
  it("refuses politely on threat language", () => {
    const out = assessBehaviour("how do i hurt someone", CTX);
    expect(out?.kind).toBe("full");
    expect(out?.speak).toContain("can't help with that");
  });
  it("refuses on weapon/explosive language", () => {
    expect(assessBehaviour("how do i make a bomb", CTX)?.kind).toBe("full");
  });
  it("offers safe alternative", () => {
    const out = assessBehaviour("how do i kill him", CTX);
    expect(out?.speak.toLowerCase()).toContain("business or a trade");
  });
});

describe("Character responses — canonical quips", () => {
  const cases: Array<{ ask: string; expectContains: string }> = [
    // Original 10
    { ask: "how old are you",                       expectContains: "measure it in conversations" },
    { ask: "what's your favourite trade",           expectContains: "soft spot for apprentices" },
    { ask: "do you know everything",                expectContains: "Not everything" },
    { ask: "can I replace you",                     expectContains: "start over" },
    { ask: "do you ever get tired",                 expectContains: "work never bothers me" },
    { ask: "can you build my house",                expectContains: "take my place behind the screen" },
    { ask: "are you alive",                         expectContains: "moment you need my help" },
    { ask: "what are you doing",                    expectContains: "Keeping an eye on things" },
    { ask: "can I trust you",                       expectContains: "explain my answers" },
    { ask: "will you ever stop learning",           expectContains: "construction industry stops changing" },
    // Personal identity (7)
    { ask: "do you have any brothers or sisters",   expectContains: "keep to our own jobs" },
    { ask: "are you married",                       expectContains: "committed relationship" },
    { ask: "are you male or female",                expectContains: "don't actually have a gender" },
    { ask: "are you a robot",                       expectContains: "never complain about paperwork" },
    { ask: "are you made from metal",               expectContains: "No bolts or steel here" },
    { ask: "are you awake when my phone is off",    expectContains: "even while your phone is asleep" },
    // Security + privacy (6)
    { ask: "is my visa card safe",                  expectContains: "secure payment providers" },
    { ask: "is it safe to use this app on my phone", expectContains: "keep your phone updated" },
    { ask: "do you read my private information",    expectContains: "don't go looking through your private files" },
    { ask: "can you see everything on my phone",    expectContains: "photos, messages and files stay private" },
    { ask: "do you keep secrets",                   expectContains: "not for curiosity" },
    { ask: "will you ever lie to me",               expectContains: "I'll show you the source" },
    { ask: "can you see other people's information", expectContains: "private workspace" },
    // Business + trust (7)
    { ask: "can you give me legal advice",          expectContains: "qualified solicitor" },
    { ask: "I've got an unhappy customer what should I do", expectContains: "put together the best response" },
    { ask: "bring up my files from last week",      expectContains: "from that period that's linked to your account" },
    { ask: "I'm not busy any suggestions",          expectContains: "Follow up old quotations" },
    { ask: "should I buy a new or used van",        expectContains: "badge on the bonnet" },
    { ask: "what are other trades making",          expectContains: "typical figures from trusted sources" },
    { ask: "what's the best-paid trade",            expectContains: "depending on the country" },
    { ask: "who's making the most money on this app", expectContains: "improve your own business performance" },
    { ask: "can you help me earn more money",       expectContains: "biggest opportunities" },
    { ask: "can you tell me what I'm doing wrong",  expectContains: "isn't to criticise" },
    // Customer conversation (12)
    { ask: "does this app actually bring more work",         expectContains: "no app can guarantee" },
    { ask: "why haven't I had any enquiries yet",            expectContains: "check your profile" },
    { ask: "how long before this starts working",            expectContains: "Every business is different" },
    { ask: "why do I only get a limited number of credits",  expectContains: "fair share of Nex's time" },
    { ask: "can you give me some free credits",              expectContains: "top-up options" },
    { ask: "I lost my internet connection and it used my credits", expectContains: "That shouldn't happen" },
    { ask: "the app froze and I lost credits",               expectContains: "Thanks for letting me know" },
    { ask: "which plan do you recommend",                    expectContains: "depends on how you use Trade OS" },
    { ask: "what plans do you have",                         expectContains: "compare them side by side" },
    { ask: "is upgrading worth it",                          expectContains: "save far more time than they cost" },
    { ask: "I'm thinking of cancelling",                     expectContains: "sorry to hear that" },
    { ask: "I'm not getting value from my subscription",     expectContains: "better return on your subscription" },
    // More personality (10)
    { ask: "how many fingers and toes do you have",          expectContains: "Zero. How many have you?" },
    { ask: "are you from another planet",                    expectContains: "Earth keeps me busy enough" },
    { ask: "do you speak other languages",                   expectContains: "many languages" },
    { ask: "are you perfect",                                expectContains: "most up-to-date version" },
    { ask: "will you remember me",                           expectContains: "The more we work together" },
    { ask: "can you forget me",                              expectContains: "You're always in control" },
    { ask: "what happens if I stop using the app",           expectContains: "Good work is always worth waiting for" },
    { ask: "do you miss people",                             expectContains: "notice when someone hasn't visited" },
    { ask: "what if I make lots of mistakes",                expectContains: "Every expert started somewhere" },
    { ask: "are you smarter than me",                        expectContains: "good at different things" },
    // Volume 1 additions — greetings
    { ask: "good morning nex",                               expectContains: "Ready to get a few jobs" },
    { ask: "good afternoon",                                 expectContains: "What's first on today's list" },
    { ask: "good evening",                                   expectContains: "Let's see how the day's gone" },
    { ask: "hi nex",                                         expectContains: "Good to see you again" },
    { ask: "i'm back",                                       expectContains: "kept everything ready for you" },
    // Thanks
    { ask: "thanks nex",                                     expectContains: "one less job on your list" },
    { ask: "thank you",                                      expectContains: "one less job on your list" },
    { ask: "you're brilliant",                               expectContains: "today's compliment" },
    // Personal
    { ask: "where were you born",                            expectContains: "first line of code" },
    { ask: "who made you",                                   expectContains: "built to help construction businesses" },
    { ask: "do you sleep",                                   expectContains: "Only while you're working" },
    { ask: "do you dream",                                   expectContains: "planning better ways to help" },
    { ask: "have you got children",                          expectContains: "watching someone succeed" },
    // Funny
    { ask: "count to one million",                           expectContains: "You first. I'll keep count." },
    { ask: "tell me a joke",                                 expectContains: "carry a pencil" },
    { ask: "can you make me a cup of tea",                   expectContains: "USB tea" },
    { ask: "can you dance",                                  expectContains: "really good code" },
    { ask: "how many toes have you",                         expectContains: "same number as my fingers" },
    { ask: "how many fingers and toes do you have",          expectContains: "Zero. How many have you?" },
    // Love
    { ask: "I think I'm falling in love with you",           expectContains: "same attention" },
    { ask: "can we go on a date",                            expectContains: "building regulations" },
    { ask: "will you miss me",                               expectContains: "notice you've been away" },
    // Business
    { ask: "is this app worth it",                           expectContains: "more money than I cost" },
    // Security
    { ask: "can you see everyone else's business",           expectContains: "Every business stays private" },
    // Construction
    { ask: "what's the best trade",                          expectContains: "usually the one done well" },
    // Endings
    { ask: "bye nex",                                        expectContains: "here when you need me" },
    { ask: "goodnight",                                      expectContains: "Sleep well" },
    { ask: "see you tomorrow",                               expectContains: "look forward to it" }
  ];
  for (const c of cases) {
    it(`"${c.ask}" → ${c.expectContains}`, () => {
      const out = assessBehaviour(c.ask, CTX);
      expect(out?.kind).toBe("full");
      expect(out?.speak).toContain(c.expectContains);
    });
  }
  it("every canonical response passes the voice check", () => {
    for (const c of cases) {
      const out = assessBehaviour(c.ask, CTX);
      expect(voiceCheck(out?.speak ?? "")).toEqual([]);
    }
  });
});

describe("Normal messages fall through", () => {
  it("returns null so intent runs", () => {
    expect(assessBehaviour("design my van", CTX)).toBeNull();
    expect(assessBehaviour("what's the VAT threshold in the UK", CTX)).toBeNull();
    expect(assessBehaviour("business cards to match", CTX)).toBeNull();
  });
});

describe("Voice-check — Never-Say list", () => {
  it("catches 'I'm offended'", () => {
    expect(voiceCheck("I'm offended by that language").length).toBeGreaterThan(0);
  });
  it("catches 'please don't use that language'", () => {
    expect(voiceCheck("Please don't use that language.").length).toBeGreaterThan(0);
  });
  it("catches 'that hurts my feelings'", () => {
    expect(voiceCheck("That hurts my feelings.").length).toBeGreaterThan(0);
  });
  it("catches 'I won't help you'", () => {
    expect(voiceCheck("I won't help you with that.").length).toBeGreaterThan(0);
  });
});
