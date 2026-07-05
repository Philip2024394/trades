// Zod schema builder — turns a FormManifest into a runtime Zod schema.
//
// Respects visibleWhen conditions: a hidden field is not required.
// Called by StrategyAwareForm at render time using the currently
// visible field set.

import { z } from "zod";
import type { FormFieldDefinition } from "./types";

export function buildFieldSchema(field: FormFieldDefinition): z.ZodTypeAny {
  const v = field.validation ?? {};
  let schema: z.ZodTypeAny;

  switch (field.kind) {
    case "text":
    case "textarea":
    case "hidden":
    case "postcode":
    case "address":
    case "signature": {
      let s = z.string();
      if (v.minLength !== undefined) s = s.min(v.minLength);
      if (v.maxLength !== undefined) s = s.max(v.maxLength);
      if (v.pattern) s = s.regex(new RegExp(v.pattern));
      schema = s;
      break;
    }
    case "email":
      schema = z.string().email();
      break;
    case "url":
      schema = z.string().url();
      break;
    case "tel":
      schema = z
        .string()
        .min(v.minLength ?? 6)
        .max(v.maxLength ?? 30);
      break;
    case "number": {
      let s = z.coerce.number();
      if (v.min !== undefined) s = s.min(v.min);
      if (v.max !== undefined) s = s.max(v.max);
      schema = s;
      break;
    }
    case "date":
    case "time":
    case "datetime":
      schema = z.string();
      break;
    case "select":
    case "radio-group":
      schema = z.string();
      break;
    case "multi-select":
      schema = z.array(z.string());
      break;
    case "checkbox":
    case "switch":
      schema = z.boolean();
      break;
    case "file-upload":
    case "photo-upload":
      // File shape handled by consumer via FormData.
      schema = z.unknown();
      break;
    default:
      schema = z.unknown();
  }

  return field.required ? schema : schema.optional().or(z.literal(""));
}

/** Build a Zod object schema from a set of currently-visible fields. */
export function buildFormSchema(
  fields: readonly FormFieldDefinition[]
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    shape[field.key] = buildFieldSchema(field);
  }
  return z.object(shape);
}
