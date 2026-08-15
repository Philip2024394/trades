// NEX Business Context · conversations store (Philip 2026-08-14).
//
// In-memory conversation store keyed by (businessSlug, conversationId).
// Every message has an author role (customer|business) and a timestamp.
//
// Constitutional rule: NEX generated responses MUST be traceable + never
// fabricate business facts. Responses use only the customer identity
// projection · plus explicit "I don't know" language when data missing.

import type { CustomerBusinessIdentity } from "./types";
import { getBusiness } from "./registry";

export type MessageAuthor = "customer" | "business";

export type ConversationMessage = {
  id: string;
  at: string;              // ISO
  author: MessageAuthor;
  text: string;
  /** For business messages · which knowledge/fact drove the response (never fabricated). */
  provenance?: { source: "business-identity" | "brain" | "template"; fields: string[] };
};

export type Conversation = {
  id: string;
  businessSlug: string;
  customerId: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
};

const STORE = new Map<string, Conversation>();   // key: `${slug}::${convId}`

function key(slug: string, convId: string): string {
  return `${slug}::${convId}`;
}

export function createConversation(slug: string, customerId: string): Conversation {
  const id = `conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const conv: Conversation = {
    id,
    businessSlug: slug,
    customerId,
    createdAt: now,
    updatedAt: now,
    messages: []
  };
  STORE.set(key(slug, id), conv);
  return conv;
}

export function getConversation(slug: string, convId: string): Conversation | null {
  return STORE.get(key(slug, convId)) ?? null;
}

export function listConversationsForBusiness(slug: string): Conversation[] {
  return [...STORE.values()].filter((c) => c.businessSlug === slug);
}

export function appendMessage(slug: string, convId: string, msg: Omit<ConversationMessage, "id" | "at">): ConversationMessage | null {
  const conv = getConversation(slug, convId);
  if (!conv) return null;
  const full: ConversationMessage = {
    id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    ...msg
  };
  conv.messages.push(full);
  conv.updatedAt = full.at;
  return full;
}

// ────────────────────────────────────────────────────────────
// Business auto-reply · deterministic, never fabricates
// ────────────────────────────────────────────────────────────

/** Produce a business-side response to a customer message. Uses ONLY the
 *  customer identity projection + LIVE catalogue data from the registered
 *  Blueprint · no external LLM · never fabricates.
 *
 *  Phase 14 addition · when a customer asks "how much is X" NEX reads
 *  the current product data (which reflects owner mutations) and answers
 *  with the current price. Because the business registry is authoritative
 *  the customer automatically sees the latest state after apply.
 */
export function generateBusinessReply(customerText: string, biz: CustomerBusinessIdentity): Omit<ConversationMessage, "id" | "at"> {
  const t = customerText.toLowerCase();
  const bizName = biz.displayName;

  // ── Price lookup · reflects any owner mutations ─────────────────
  const priceMatch = /(?:how\s+much|price|cost|how\s+expensive)/i.test(customerText);
  if (priceMatch) {
    const record = getBusiness(biz.slug);
    const products = record?.blueprint.data.find((d) => d.id === "products")?.seed ?? [];
    // Try to identify which product · match any product name/slug token in the message
    for (const p of products as Record<string, unknown>[]) {
      const name = String(p.name ?? "").toLowerCase();
      const slug = String(p.slug ?? "").toLowerCase();
      const nameFirstWord = name.split(/\s+/)[0];
      const match = (nameFirstWord && t.includes(nameFirstWord)) || (slug && t.includes(slug));
      if (match) {
        const priceRaw = p.price as { amount?: number; currency?: string } | number | undefined;
        if (priceRaw && typeof priceRaw === "object" && typeof priceRaw.amount === "number") {
          const formatted = new Intl.NumberFormat("en-GB", { style: "currency", currency: priceRaw.currency ?? "GBP" }).format(priceRaw.amount / 100);
          return {
            author: "business",
            text: `The ${p.name} is currently ${formatted}.`,
            provenance: { source: "business-identity", fields: [`data.products.${slug || nameFirstWord}.price`] }
          };
        }
      }
    }
    // No product match · honest fallback
    return {
      author: "business",
      text: `Which product were you asking about? ${bizName} can share the current price once you tell me which one.`,
      provenance: { source: "template", fields: [] }
    };
  }

  // Deterministic intent → response mapping. Extending: add a route below.
  if (/\b(hi|hello|hey)\b/.test(t)) {
    return {
      author: "business",
      text: `Hi — this is ${bizName}. How can we help?`,
      provenance: { source: "template", fields: ["identity.displayName"] }
    };
  }
  if (/\b(what|which|type|kinds?)\b.*\b(do|make|offer|service|specialise)\b/.test(t) || /\b(services?|offerings?)\b/.test(t)) {
    return {
      author: "business",
      text: `${bizName} specialises in ${biz.vertical.label}. Tell me what you're looking for and I can point you at the right pages.`,
      provenance: { source: "business-identity", fields: ["vertical.label"] }
    };
  }
  if (/\b(quote|price|cost|how much|budget)\b/.test(t)) {
    return {
      author: "business",
      text: `I can pass this to ${bizName} for a quote. Could you share a few more details — location, size of the project, timeline?`,
      provenance: { source: "template", fields: ["identity.displayName"] }
    };
  }
  if (/\b(email|contact|phone|call)\b/.test(t)) {
    const parts: string[] = [];
    if (biz.contact.primaryPhone) parts.push(`phone ${biz.contact.primaryPhone}`);
    if (biz.contact.primaryEmail) parts.push(`email ${biz.contact.primaryEmail}`);
    if (parts.length === 0) {
      return {
        author: "business",
        text: `The best way to get in touch is right here in this chat — leave your name and I'll route your enquiry to ${bizName}.`,
        provenance: { source: "template", fields: [] }
      };
    }
    return {
      author: "business",
      text: `You can reach ${bizName} on ${parts.join(" or ")}. Or continue here and I'll pass your message to the team.`,
      provenance: { source: "business-identity", fields: ["identity.contact"] }
    };
  }
  if (/\b(area|cover|location|where|radius)\b/.test(t)) {
    if (biz.contact.hasServiceRadius) {
      return {
        author: "business",
        text: `${bizName} has a set service area — share your postcode and I can check whether we cover it.`,
        provenance: { source: "business-identity", fields: ["contact.hasServiceRadius"] }
      };
    }
    return {
      author: "business",
      text: `Let me pass this to ${bizName} to confirm the service area for your postcode.`,
      provenance: { source: "template", fields: [] }
    };
  }
  // Default — honest fallback · never fabricates
  return {
    author: "business",
    text: `Thanks — I've noted this for ${bizName}. Could you share your name and how best to reach you so the team can follow up?`,
    provenance: { source: "template", fields: ["identity.displayName"] }
  };
}

/** Test helper. */
export function _resetConversationsForTest(): void {
  STORE.clear();
}
