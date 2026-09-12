// src/lib/nex/live-chat-completion/llm-rescue/mock-provider.ts
//
// Founder BEGIN Phase 3.4 · Mock rescue provider for regression testing.
//
// Deterministic outputs — used when NEX_LLM_RESCUE_PROVIDER=mock. Emits
// three scripted scenarios based on message content so the gate can be
// exercised without Ollama running:
//
//   contains "cite:real"   → answered=true, all source_refs from bundle (should pass gate)
//   contains "cite:orphan" → answered=true, ONE claim cites a fake ref (should be rejected)
//   contains "cite:none"   → answered=false, unverified_reason set (honest abstain)
//   default                → answered=true, cites first bundle ref
//
// Zero fabrication assertion: even when the mock produces orphan claims,
// the gate must reject them AND produce an honest "couldn't verify" reply.

import type { LlmRescueProvider, LlmRescueOutput } from "./contract";

export function makeMockRescueProvider(): LlmRescueProvider {
  return {
    name: "mock:test",
    async invoke({ bundle, budget_ms: _budget_ms }) {
      const t0 = performance.now();
      const msg = String(bundle.message ?? "").toLowerCase();
      const first = bundle.items[0]?.ref_id ?? null;

      let output: LlmRescueOutput;
      // Founder Phase 3.7 · action-proposal scenarios for regression.
      if (msg.includes("action:save_favorite") && first) {
        const entity = bundle.entity_ref ?? "unknown_entity";
        output = {
          answered: true,
          claims: [{ text: bundle.items[0].text, source_ref: first, confidence: 0.7 }],
          reply_hint: "Save this to favorites",
          proposed_action: { action_id: "save_favorite", args: { entity_ref: entity }, rationale: "User asked to save" },
        };
      } else if (msg.includes("action:contact_wa") && first) {
        const entity = bundle.entity_ref ?? "unknown_entity";
        output = {
          answered: true,
          claims: [{ text: bundle.items[0].text, source_ref: first, confidence: 0.7 }],
          reply_hint: "Open WhatsApp for this hotel",
          proposed_action: { action_id: "contact_via_whatsapp", args: { entity_ref: entity, message: "Hi, I have a booking question." }, rationale: "User asked to contact" },
        };
      } else if (msg.includes("action:unknown")) {
        output = {
          answered: true,
          claims: [],
          reply_hint: "Do this thing",
          proposed_action: { action_id: "fabricated_action_that_isnt_registered", args: {}, rationale: "LLM tried a non-registered action" },
        };
      } else if (msg.includes("action:bad_args") && first) {
        output = {
          answered: true,
          claims: [{ text: bundle.items[0].text, source_ref: first, confidence: 0.7 }],
          reply_hint: "Bad args",
          proposed_action: { action_id: "save_favorite", args: { /* missing required entity_ref */ }, rationale: "Bad shape" },
        };
      } else if (msg.includes("cite:orphan")) {
        output = {
          answered: true,
          claims: [
            { text: "The Ritz Fabricated Hotel has 999 rooms.", source_ref: "fake_orphan_ref_that_does_not_exist", confidence: 0.9 },
          ],
          reply_hint: "The Ritz Fabricated Hotel has 999 rooms.",
        };
      } else if (msg.includes("cite:postrationalisation") && first) {
        // Founder Path A · Phase A1 · Fabrication Gate v2 scenario.
        // Real ref_id, but the claim text is totally unrelated to the
        // cited evidence text · classic postrationalisation. Gate v2
        // must reject via alignment scoring even though ref exists.
        output = {
          answered: true,
          claims: [
            { text: "Xenopus laevis frogs have been to space six times.", source_ref: first, confidence: 0.9 },
          ],
          reply_hint: "Xenopus laevis frogs have been to space six times.",
        };
      } else if (msg.includes("cite:memory")) {
        // Founder Doctrine #4 (MEMORY IS NOT TRUTH): a claim citing a
        // memory: ref must be rejected by the gate even though the LLM
        // "would like to". This scenario proves the doctrine.
        output = {
          answered: true,
          claims: [
            { text: "The user's business address is 123 Fabricated St.", source_ref: "memory:aaaabbbbccccdddd:m_fabricated", confidence: 0.9 },
          ],
          reply_hint: "According to what you told me, your business address is 123 Fabricated St.",
        };
      } else if (msg.includes("cite:none")) {
        output = {
          answered: false,
          claims: [],
          unverified_reason: "mock_provider_abstain_test",
        };
      } else if (msg.includes("cite:real") && first) {
        output = {
          answered: true,
          claims: [
            { text: bundle.items[0].text, source_ref: first, confidence: 0.8 },
          ],
          reply_hint: `Cited real evidence: ${bundle.items[0].text}`,
        };
      } else if (first) {
        output = {
          answered: true,
          claims: [
            { text: bundle.items[0].text, source_ref: first, confidence: 0.7 },
          ],
          reply_hint: bundle.items[0].text,
        };
      } else {
        output = {
          answered: false,
          claims: [],
          unverified_reason: "no_evidence_items",
        };
      }

      // Empty async iterator so the token stream drains immediately.
      const tokens: AsyncIterable<string> = {
        [Symbol.asyncIterator]() {
          return { async next() { return { value: undefined, done: true }; } };
        },
      };
      return {
        tokens,
        output: Promise.resolve(output),
        provider_meta: {
          model: "mock:test",
          ttft_ms: 1,
          total_ms: Math.round(performance.now() - t0),
          completed: true,
        },
      };
    },
  };
}
