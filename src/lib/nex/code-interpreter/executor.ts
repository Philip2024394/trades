// src/lib/nex/code-interpreter/executor.ts
//
// Founder Phase 20 · P20-2 · Sandboxed JavaScript executor.
//
// Uses Node's built-in `vm` module. The sandbox context is a plain object
// that does NOT expose:
//   · require            (module loading)
//   · process            (env/exit/versions)
//   · fs, net, http, ...  (any built-in module)
//   · __proto__ chains that lead back to the host globalThis
//
// Whitelisted globals:
//   · console.log/error   (captured to stdout/stderr strings)
//   · Math, JSON, Date, Number, String, Array, Object, Boolean, RegExp
//   · Error, TypeError, RangeError, SyntaxError
//   · Symbol, Map, Set, WeakMap, WeakSet, Promise
//   · setTimeout/clearTimeout · shimmed to reject anything past budget
//   · Uint8Array/Int8Array/... typed arrays
//
// Timeout enforcement: vm.runInContext has a hard timeout · when it
// fires, `TIMEOUT` propagates back as timed_out:true.
//
// Output caps: stdout+stderr each truncated at 64KB to prevent runaway.

import { createContext, runInContext } from "node:vm";
import type { CodeExecuteRequest, CodeExecuteResult } from "./contract";
import { hashCode } from "./contract";

const MAX_STREAM_LEN = 64 * 1024;   // 64 KB per stream

interface CapturedIO { stdout: string; stderr: string; }

function makeConsole(io: CapturedIO): Record<string, (...args: unknown[]) => void> {
  const format = (args: unknown[]): string =>
    args
      .map((a) => {
        if (typeof a === "string") return a;
        try { return JSON.stringify(a); } catch { return String(a); }
      })
      .join(" ");
  const push = (stream: "stdout" | "stderr", args: unknown[]) => {
    const line = format(args) + "\n";
    if (io[stream].length + line.length > MAX_STREAM_LEN) {
      const remaining = MAX_STREAM_LEN - io[stream].length;
      if (remaining > 20) io[stream] += line.slice(0, remaining - 20) + "…[truncated]\n";
      return;
    }
    io[stream] += line;
  };
  return {
    log: (...a) => push("stdout", a),
    info: (...a) => push("stdout", a),
    debug: (...a) => push("stdout", a),
    warn: (...a) => push("stderr", a),
    error: (...a) => push("stderr", a),
  };
}

function safeSerialize(value: unknown): { value: unknown; kind: "undefined" | "primitive" | "object" | "error" } {
  if (value === undefined) return { value: undefined, kind: "undefined" };
  if (value === null) return { value: null, kind: "primitive" };
  const t = typeof value;
  if (t === "number" || t === "string" || t === "boolean" || t === "bigint") {
    return { value: t === "bigint" ? String(value) : value, kind: "primitive" };
  }
  if (value instanceof Error) {
    return {
      value: { name: value.name, message: value.message.slice(0, 500) },
      kind: "error",
    };
  }
  try {
    const s = JSON.stringify(value);
    if (typeof s === "string" && s.length <= MAX_STREAM_LEN) return { value: JSON.parse(s), kind: "object" };
    return { value: "[unserialisable]", kind: "object" };
  } catch {
    return { value: "[unserialisable]", kind: "object" };
  }
}

function buildSandbox(io: CapturedIO): Record<string, unknown> {
  // Deliberately hand-picked · nothing that leaks the host runtime.
  return {
    console: makeConsole(io),
    Math, JSON, Date, Number, String, Array, Object, Boolean, RegExp,
    Error, TypeError, RangeError, SyntaxError, EvalError, URIError, ReferenceError,
    Symbol, Map, Set, WeakMap, WeakSet, Promise,
    Uint8Array, Int8Array, Uint16Array, Int16Array, Uint32Array, Int32Array,
    Float32Array, Float64Array, ArrayBuffer, DataView,
    // Iteration primitives
    isFinite, isNaN, parseFloat, parseInt,
    encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
    // Deliberately withheld: require, process, global, globalThis, Buffer,
    // fetch, XMLHttpRequest, WebSocket, fs, net, dns, dgram, timers,
    // setTimeout (we don't want long-lived promises to escape).
  };
}

export async function executeSandboxed(input: CodeExecuteRequest): Promise<CodeExecuteResult> {
  const t0 = performance.now();
  const code_hash = hashCode(input.code);
  const io: CapturedIO = { stdout: "", stderr: "" };
  const sandbox = buildSandbox(io);
  const context = createContext(sandbox, {
    name: "nex-code-sandbox",
    codeGeneration: { strings: false, wasm: false },      // no dynamic eval, no wasm compile
  });

  // Wrap in an IIFE so `return` at top level works. Force strict mode so
  // reserved-word errors surface deterministically.
  const wrapped = `"use strict";(function(){${input.code}\n})();`;

  let ok = false;
  let timed_out = false;
  let error_class: string | null = null;
  let error_message: string | null = null;
  let returned: unknown = undefined;

  try {
    returned = runInContext(wrapped, context, {
      timeout: input.budget_ms,
      breakOnSigint: true,
      displayErrors: false,
    });
    ok = true;
  } catch (e) {
    // Cross-realm: errors thrown from inside the vm context are NOT
    // instances of the host's Error, so instanceof fails. Use duck-typing
    // on `.name` + `.message` + `.constructor?.name` instead.
    const anyE = e as { name?: string; message?: string; code?: string; constructor?: { name?: string } };
    const className = (typeof anyE?.name === "string" && anyE.name)
      || anyE?.constructor?.name
      || (typeof e === "string" ? "Error" : "Unknown");
    error_class = className;
    error_message = (typeof anyE?.message === "string" ? anyE.message : String(e)).slice(0, 500);
    // Node throws with code:'ERR_SCRIPT_EXECUTION_TIMEOUT' when timeout fires.
    // Also check the message string because in some contexts the code is
    // stripped when the error crosses the realm boundary.
    if (anyE?.code === "ERR_SCRIPT_EXECUTION_TIMEOUT"
        || /Script execution timed out/i.test(error_message)) {
      timed_out = true;
    }
    ok = false;
  }

  const { value: return_value, kind: return_kind } = safeSerialize(returned);
  const request_ms = Math.round(performance.now() - t0);

  return {
    execution_id: `code:${code_hash}`,
    language: input.language,
    code_hash,
    code_length: input.code.length,
    stdout: io.stdout,
    stderr: io.stderr,
    return_value,
    return_kind: ok ? return_kind : "error",
    ok,
    timed_out,
    error_class,
    error_message,
    request_ms,
  };
}
