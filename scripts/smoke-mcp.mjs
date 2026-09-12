#!/usr/bin/env node
// scripts/smoke-mcp.mjs
//
// Founder Path A · MCP-3 · JSON-RPC 2.0 HTTP transport regression.
//
// Verifies:
//   A · GET /api/nex/mcp → server info · supported_methods
//   B · initialize → protocolVersion + serverInfo
//   C · tools/list → registered actions
//   D · tools/call save_favorite → audit_id in result payload · Doctrine #2
//   E · tools/call unknown → JSON-RPC method-not-found (or per-tool error)
//   F · tools/call with bad params → invalid_params (-32602)
//   G · unknown method → -32601 method_not_found
//   H · malformed request (no jsonrpc field) → -32600 invalid_request
//   I · notification (no id) → 204 no content
//   J · batch of 2 → array of 2 responses
//   K · Observatory reflects the new tools/call audits

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";

async function rpc(body, opts = {}) {
  const res = await fetch(`${HOST}/api/nex/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const parsed = text ? tryParse(text) : null;
  return { status: res.status, body: parsed, raw: text, headers: Object.fromEntries(res.headers) };
}

function tryParse(s) { try { return JSON.parse(s); } catch { return { _parse_error: s.slice(0, 200) }; } }

const failures = [];

// ══ A · GET discovery
console.log("\n══ A · GET /api/nex/mcp returns server info");
{
  const res = await fetch(`${HOST}/api/nex/mcp`);
  const body = await res.json();
  console.log(`  status=${res.status} server=${body?.server?.name} protocol=${body?.server?.protocolVersion} methods=${body?.supported_methods?.length}`);
  if (res.status !== 200) failures.push({ case: "A", reason: `status_${res.status}` });
  if (!body?.server?.name) failures.push({ case: "A", reason: "no_server_info" });
  if (!Array.isArray(body?.supported_methods)) failures.push({ case: "A", reason: "no_supported_methods" });
}

// ══ B · initialize
console.log("\n══ B · initialize returns protocolVersion + serverInfo");
{
  const r = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { clientInfo: { name: "smoke", version: "1" } } });
  console.log(`  status=${r.status} protocol=${r.body?.result?.protocolVersion} server=${r.body?.result?.serverInfo?.name}`);
  if (r.body?.jsonrpc !== "2.0") failures.push({ case: "B", reason: "no_jsonrpc" });
  if (r.body?.id !== 1) failures.push({ case: "B", reason: `id_${r.body?.id}` });
  if (!r.body?.result?.protocolVersion) failures.push({ case: "B", reason: "no_protocolVersion" });
  if (!r.body?.result?.serverInfo?.name) failures.push({ case: "B", reason: "no_serverInfo" });
}

// ══ C · tools/list
console.log("\n══ C · tools/list returns registered actions");
{
  const r = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  const tools = r.body?.result?.tools ?? [];
  console.log(`  count=${tools.length} first_name=${tools[0]?.name}`);
  if (!Array.isArray(tools)) failures.push({ case: "C", reason: "no_tools_array" });
  if (tools.length < 1) failures.push({ case: "C", reason: "empty_tools" });
  for (const t of tools) {
    if (!t.name || typeof t.description !== "string" || !t.annotations || typeof t.annotations.requires_confirmation !== "boolean") {
      failures.push({ case: "C", reason: `bad_tool_shape_${JSON.stringify(t).slice(0, 80)}` });
    }
  }
}

// ══ D · tools/call save_favorite
console.log("\n══ D · tools/call save_favorite → audit_id + executed");
{
  const r = await rpc({
    jsonrpc: "2.0", id: 3, method: "tools/call",
    params: { name: "save_favorite", arguments: { entity_ref: "#AC-2026-0000C" } },
  }, { headers: { "X-NEX-Session-Id": "smoke-mcp-D" } });
  const content = r.body?.result?.content ?? [];
  const payload = content[0]?.text ? tryParse(content[0].text) : null;
  console.log(`  outcome=${payload?.outcome} audit_id=${payload?.audit_id}`);
  if (payload?.outcome !== "executed") failures.push({ case: "D", reason: `expected_executed_got_${payload?.outcome}` });
  if (!payload?.audit_id) failures.push({ case: "D", reason: "no_audit_id" });
}

// ══ E · tools/call unknown tool
console.log("\n══ E · tools/call unknown → outcome rejected");
{
  const r = await rpc({
    jsonrpc: "2.0", id: 4, method: "tools/call",
    params: { name: "fabricated_action_not_registered", arguments: {} },
  });
  const content = r.body?.result?.content ?? [];
  const payload = content[0]?.text ? tryParse(content[0].text) : null;
  console.log(`  outcome=${payload?.outcome} isError=${r.body?.result?.isError}`);
  if (payload?.outcome !== "rejected_unknown_action") failures.push({ case: "E", reason: `expected_rejected_unknown_action_got_${payload?.outcome}` });
  if (r.body?.result?.isError !== true) failures.push({ case: "E", reason: "isError_not_true" });
}

// ══ F · tools/call bad params (missing 'name')
console.log("\n══ F · tools/call bad params → -32602 invalid_params");
{
  const r = await rpc({ jsonrpc: "2.0", id: 5, method: "tools/call", params: {} });
  console.log(`  error.code=${r.body?.error?.code} message=${r.body?.error?.message}`);
  if (r.body?.error?.code !== -32602) failures.push({ case: "F", reason: `expected_-32602_got_${r.body?.error?.code}` });
}

// ══ G · unknown method → -32601
console.log("\n══ G · unknown method → -32601 method_not_found");
{
  const r = await rpc({ jsonrpc: "2.0", id: 6, method: "not_a_real_method" });
  console.log(`  error.code=${r.body?.error?.code}`);
  if (r.body?.error?.code !== -32601) failures.push({ case: "G", reason: `expected_-32601_got_${r.body?.error?.code}` });
}

// ══ H · malformed (missing jsonrpc field)
console.log("\n══ H · missing jsonrpc field → -32600 invalid_request");
{
  const r = await rpc({ id: 7, method: "initialize" });
  console.log(`  error.code=${r.body?.error?.code}`);
  if (r.body?.error?.code !== -32600) failures.push({ case: "H", reason: `expected_-32600_got_${r.body?.error?.code}` });
}

// ══ I · notification (no id) → 204
console.log("\n══ I · notification → 204 no content");
{
  const r = await rpc({ jsonrpc: "2.0", method: "ping" });
  console.log(`  status=${r.status} raw_len=${r.raw?.length ?? 0}`);
  if (r.status !== 204) failures.push({ case: "I", reason: `expected_204_got_${r.status}` });
  if (r.raw && r.raw.length > 0) failures.push({ case: "I", reason: `notification_returned_body` });
}

// ══ J · batch
console.log("\n══ J · batch of 2 → array of 2 responses");
{
  const r = await rpc([
    { jsonrpc: "2.0", id: "b1", method: "ping" },
    { jsonrpc: "2.0", id: "b2", method: "tools/list" },
  ]);
  const arr = Array.isArray(r.body) ? r.body : null;
  console.log(`  count=${arr?.length}`);
  if (!arr || arr.length !== 2) failures.push({ case: "J", reason: `expected_2_got_${arr?.length}` });
  if (arr && (arr[0]?.id !== "b1" || arr[1]?.id !== "b2")) failures.push({ case: "J", reason: "batch_ids_wrong" });
}

// ══ K · Observatory reflects
console.log("\n══ K · Observatory reflects MCP tools/call audits");
{
  const res = await fetch(`${HOST}/api/nex/observatory/snapshot?window=1h`);
  const snap = await res.json();
  const proposed = snap?.doctrine_health?.doctrine_2_action_rejections?.total_proposed;
  console.log(`  total_proposed=${proposed}`);
  if (typeof proposed !== "number" || proposed < 2) failures.push({ case: "K", reason: `expected_>=2_got_${proposed}` });
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · MCP HTTP JSON-RPC 2.0 green · Doctrine #2 enforced through external transport.");
  process.exit(0);
}
