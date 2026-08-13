// Editing Platform · EditCommand → Design History Operation.
//
// Bridge · never mutates the document directly. Produces an Operation that the
// Design History Engine records.
//
// Doctrine: docs/brains/nex-phase-e5-e7-editing-delivery-design-memory-philip-2026-08-04.md

import type { Operation } from "../design-history/types";
import type { EditCommand } from "./types";

/** Convert an EditCommand into a Design History Operation payload (without op_id/at ·
 *  which the History Engine stamps in apply()). Uses target_id to build a JSON pointer
 *  when target_path is not explicit. */
export function toOperation(cmd: EditCommand, opts: {
  before: unknown;                       // caller supplies the current value at target_path
  author: string;
  target_path?: string;                  // explicit override
  target_path_resolver?: (target_id: string | undefined) => string;
}): Omit<Operation, "op_id" | "at"> {
  const target_path = opts.target_path
    ?? cmd.target_path
    ?? (opts.target_path_resolver ? opts.target_path_resolver(cmd.target_id) : "");
  if (!target_path) throw new Error(`Cannot resolve target_path for command: ${cmd.raw_text}`);

  let after: unknown;
  switch (cmd.intent) {
    case "replace_material":
      after = cmd.to;
      break;
    case "change_theme":
    case "change_camera":
    case "change_lighting":
      after = cmd.to;
      break;
    case "recolor":
      after = { color_op: cmd.hex_delta };
      break;
    case "resize":
      after = { resize_pct: cmd.amount_pct, resize_mm: cmd.amount_mm };
      break;
    case "move":
      after = { direction: cmd.direction, amount_mm: cmd.amount_mm };
      break;
    case "rotate":
      after = { direction: cmd.direction, amount_deg: cmd.amount_mm };  // reuse amount for a "15 degrees" style
      break;
    case "delete":
      after = null;
      break;
    case "add":
      after = { added: cmd.to ?? cmd.target_id };
      break;
    default:
      after = cmd.raw_text;
  }

  const kindMap: Record<EditCommand["intent"], Operation["kind"]> = {
    move: "move_layer",
    resize: "resize_container",
    replace_material: "replace_material",
    recolor: "set_property",
    rotate: "custom",
    delete: "remove_layer",
    add: "add_layer",
    change_camera: "change_camera",
    change_lighting: "change_lighting",
    change_theme: "replace_theme_pack",
    custom: "custom",
  };

  return {
    kind: kindMap[cmd.intent],
    target_path,
    before: opts.before,
    after,
    author: opts.author,
    reason: `edit_command: ${cmd.raw_text}`,
  };
}
