// Intent classifier regression sweep · Philip 2026-08-01
//
// Tests each intent with contracted AND expanded forms so we know the
// classifier isn't accidentally sensitive to apostrophes / test-script escaping.
// Uses fetch with JSON.stringify so shell quoting can never cause false failures.

const BASE = "http://localhost:3008/api/nex/staircase-chat";

const suites = [
  {
    name: "CAPABILITY_QUESTION",
    expect: "capability_question",
    messages: [
      "Why can't you show images?",
      "Why can you not show images?",
      "Can you show pictures?",
      "Why aren't the images showing?",
      "Where are the images?",
      "Why don't I see the gallery?",
      "Can you display photos?",
      "Are you able to upload pictures?",
    ],
  },
  {
    name: "ESCALATION_REQUEST",
    expect: "escalation_request",
    messages: [
      "Can I speak to your boss?",
      "Can I speak your boss",
      "Can I talk to your boss",
      "Manager",
      "Manager please",
      "Supervisor",
      "Human",
      "Real person",
      "Put me through to someone",
      "I want to make a complaint",
      "Talk to a manager please",
    ],
  },
  {
    name: "SOCIAL_AFFECTION (contraction pairs)",
    expect: "social_affection",
    messages: [
      "I love you",
      "You're amazing",
      "You are amazing",
      "Thanks so much",
      "Thank you very much",
      "You're the best",
      "You are the best",
    ],
  },
  {
    name: "NEGATIVE_FEEDBACK (contraction pairs)",
    expect: "feedback_acknowledgment",
    messages: [
      "You're stupid",
      "You are stupid",
      "That's wrong",
      "That is wrong",
      "This isn't what I asked",
      "This is not what I asked",
      "You're useless",
      "You are useless",
    ],
  },
  {
    name: "GREETING",
    expect: "greeting",
    messages: [
      "Hi",
      "Hello",
      "Good morning",
      "Good evening",
      "Hey",
    ],
  },
  {
    name: "IDENTITY_PROBE",
    expect: "identity_response",
    messages: [
      "Are you AI?",
      "Are you a bot?",
      "What model are you?",
      "Who built you?",
    ],
  },
  {
    name: "KITCHEN_REDIRECT",
    expect: "kitchen_redirect",
    messages: [
      "Can you design my kitchen?",
      "Do you do kitchen design?",
      "I need help with my kitchen",
    ],
  },
];

async function ask(message) {
  const conv = `sweep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, conversation_id: conv }),
  });
  const j = await res.json();
  return j.advisor?.action;
}

(async () => {
  let totalPass = 0;
  let totalFail = 0;
  for (const suite of suites) {
    console.log("\n" + "=".repeat(60));
    console.log(suite.name + " · expect: " + suite.expect);
    console.log("=".repeat(60));
    for (const msg of suite.messages) {
      const actual = await ask(msg);
      const ok = actual === suite.expect;
      totalPass += ok ? 1 : 0;
      totalFail += ok ? 0 : 1;
      const marker = ok ? "✓" : "✗";
      console.log(`  ${marker} ${JSON.stringify(msg).padEnd(48)} → ${actual}`);
    }
  }
  console.log("\n" + "=".repeat(60));
  console.log(`TOTAL: ${totalPass} pass · ${totalFail} fail · ${totalPass + totalFail} tests`);
  console.log("=".repeat(60));
})();
