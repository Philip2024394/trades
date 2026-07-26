// NEX Merchant Assistant — tool definitions.
//
// Anthropic tool schemas for every action NEX can propose. Every tool
// here has a matching executor in toolExecutors.ts that re-validates
// merchant ownership and runs the operation through the existing
// Products app helpers.
//
// Reference: docs/brains/PHASE_7_IMPLEMENTATION_PLAN.md · Section 11
// Reference: src/lib/llm/anthropic.ts · AnthropicToolDef
//
// Rule: NEX never writes to lifecycleStatus: active directly. Every
// create/update lands in draft. Only publish_product (with explicit
// merchant confirmation in the message) or the /approve endpoint
// transitions to active.

import "server-only";
import type { AnthropicToolDef } from "@/lib/llm/anthropic";

/** list_products — returns the merchant's existing products with filters */
export const LIST_PRODUCTS_TOOL: AnthropicToolDef = {
  name: "list_products",
  description:
    "List the merchant's existing products (canonical + offers). Use this before creating anything new to check whether a similar product already exists. Read-only.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Optional case-insensitive substring to filter product names or brand.",
      },
      lifecycle_status: {
        type: "string",
        enum: ["draft", "active", "legacy", "withdrawn"],
        description: "Optional lifecycle status filter.",
      },
      limit: {
        type: "integer",
        description: "Max results to return (default 20, max 100).",
      },
    },
  },
};

/** create_product_draft — new product in draft state */
export const CREATE_PRODUCT_DRAFT_TOOL: AnthropicToolDef = {
  name: "create_product_draft",
  description:
    "Create a new product in DRAFT state. The merchant must approve it via the /approve endpoint (or by asking to publish it) before it goes live. Never publishes directly.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Product name. Required." },
      brand_name: { type: "string", description: "Brand name. Required." },
      description: { type: "string", description: "Long-form description." },
      category_path: {
        type: "array",
        items: { type: "string" },
        description: "Category taxonomy path (e.g. ['staircase', 'treads', 'oak']).",
      },
      price_pence: {
        type: "integer",
        description: "Merchant offer price in pence (e.g. £45 = 4500).",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "Search tags.",
      },
      hero_image_url: {
        type: "string",
        description: "Primary product image URL. Merchant is expected to have uploaded this.",
      },
    },
    required: ["name", "brand_name", "price_pence"],
  },
};

/** update_product_field — modify a single field on an existing product/draft */
export const UPDATE_PRODUCT_FIELD_TOOL: AnthropicToolDef = {
  name: "update_product_field",
  description:
    "Update a single field on an existing product or draft. Restricted to whitelisted fields (name, description, price, tags, images, category). Field-level updates go through the same guardrails as full creates.",
  input_schema: {
    type: "object",
    properties: {
      product_id: {
        type: "string",
        description: "The canonical product ID (uuid).",
      },
      field: {
        type: "string",
        enum: [
          "name",
          "description",
          "price_pence",
          "tags",
          "hero_image_url",
          "category_path",
          "stock_status",
          "stock_quantity",
        ],
        description: "The field to update.",
      },
      value: {
        description:
          "The new value. Must match the schema for the chosen field (string / integer / string[] etc.).",
      },
    },
    required: ["product_id", "field", "value"],
  },
};

/** generate_banner — NEX-composed promotional banner */
export const GENERATE_BANNER_TOOL: AnthropicToolDef = {
  name: "generate_banner",
  description:
    "Generate a promotional banner (headline + body + call-to-action) for an existing merchant offer. Banner is saved as a NEW version in the banners table with is_active: false. Merchant must explicitly activate it to make it live.",
  input_schema: {
    type: "object",
    properties: {
      offer_id: {
        type: "string",
        description: "The merchant offer ID (uuid) this banner is for.",
      },
      visual_style: {
        type: "string",
        enum: ["premium", "utility", "seasonal", "minimal"],
        description: "The style register for the banner voice.",
      },
      angle: {
        type: "string",
        description:
          "The angle the banner should take (e.g. 'quality craftsmanship', 'winter promotion', 'trade-focused pricing').",
      },
    },
    required: ["offer_id"],
  },
};

/** preview_change — returns a customer-facing preview of a draft */
export const PREVIEW_CHANGE_TOOL: AnthropicToolDef = {
  name: "preview_change",
  description:
    "Return a customer-facing preview of a draft product or a proposed change. Read-only — does not modify data.",
  input_schema: {
    type: "object",
    properties: {
      product_id: {
        type: "string",
        description: "The canonical product ID (uuid) to preview.",
      },
    },
    required: ["product_id"],
  },
};

/** publish_product — transition draft to active */
export const PUBLISH_PRODUCT_TOOL: AnthropicToolDef = {
  name: "publish_product",
  description:
    "Transition a product from draft to active (published). REQUIRES explicit merchant confirmation in the preceding message — NEX must ask 'shall I publish this?' and see the merchant say yes before calling this tool. Fires the product.published event which makes the product appear in the NEX Centre feed.",
  input_schema: {
    type: "object",
    properties: {
      product_id: {
        type: "string",
        description: "The canonical product ID (uuid) to publish.",
      },
      confirm: {
        type: "boolean",
        description:
          "Must be true. The AI sets this to true only after the merchant has explicitly confirmed publish intent in the preceding chat turn.",
      },
    },
    required: ["product_id", "confirm"],
  },
};

/** archive_product — withdraw an active product */
export const ARCHIVE_PRODUCT_TOOL: AnthropicToolDef = {
  name: "archive_product",
  description:
    "Withdraw an active product (lifecycle -> withdrawn). REQUIRES explicit merchant confirmation. Fires product.withdrawn event which removes the product from the NEX Centre feed and search index.",
  input_schema: {
    type: "object",
    properties: {
      product_id: {
        type: "string",
        description: "The canonical product ID (uuid) to archive.",
      },
      confirm: {
        type: "boolean",
        description: "Must be true after merchant confirmation.",
      },
    },
    required: ["product_id", "confirm"],
  },
};

/** The full toolset the Merchant Assistant endpoint exposes to NEX. */
export const MERCHANT_ASSISTANT_TOOLS: AnthropicToolDef[] = [
  LIST_PRODUCTS_TOOL,
  CREATE_PRODUCT_DRAFT_TOOL,
  UPDATE_PRODUCT_FIELD_TOOL,
  GENERATE_BANNER_TOOL,
  PREVIEW_CHANGE_TOOL,
  PUBLISH_PRODUCT_TOOL,
  ARCHIVE_PRODUCT_TOOL,
];
