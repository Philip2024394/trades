// WO-WORKSTATION-11 · three-page app fixture builder
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// Given a founder request for a 3-page application, produce the
// ProjectModel + FilePlan that the WO-03..WO-09 chain will realise into
// a real running app.
//
// Per the vertical-slice discipline locked in memory:
//   "Founder: Build a simple 3-page application: Home / About / Contact.
//    Then NEX1 must actually create it, write the files, build it, start
//    it, test it, inspect it, and report the evidence."
//
// v0.1 uses the zero-dependency plain-node-server template so real
// build+runtime finish in seconds. A future WO-11.5 could swap the
// template for Next.js and add `npm install`+`next build` steps.

import { randomUUID } from "node:crypto";
import type { ProjectModel, PageSpec, FilePlan } from "./wo3-types";

export interface ThreePageAppInput {
  readonly project_id: string;
  readonly trace_id: string;
  readonly project_name: string;
  /** TCP port for the runtime. Caller typically allocates via
   *  pickFreePort() in tests. Must be in [1024, 65535]. */
  readonly port: number;
  /** Override pages if the caller wants something other than the
   *  default Home / About / Contact triple. */
  readonly pages?: readonly PageSpec[];
}

const DEFAULT_PAGES: readonly PageSpec[] = [
  { route: "/",        title: "Home",    headline: "Welcome home",   body: ["This is the home page."] },
  { route: "/about",   title: "About",   headline: "About us",       body: ["About page content."] },
  { route: "/contact", title: "Contact", headline: "Get in touch",   body: ["Contact page content."] },
];

/** Build the canonical 3-page-app ProjectModel. */
export function buildThreePageAppProjectModel(input: ThreePageAppInput): ProjectModel {
  return {
    record_type: "NEX1_PROJECT_MODEL",
    project_id: input.project_id,
    trace_id: input.trace_id,
    project_name: input.project_name,
    framework: "static-html",   // v0.1: not Next.js; plain node server serves the routes
    pages: input.pages ?? DEFAULT_PAGES,
    created_at: new Date().toISOString(),
    deterministic_extractor_version: "wo11.v0.1",
  };
}

/** Build the WO-03 FilePlan that WO-03..WO-09 will realise into a
 *  running app. The plan targets the plain-node-server template so
 *  WO-05 (`node --check`) and WO-06 (`node server.js`) can exercise
 *  it end-to-end without needing an npm install pass. */
export function buildThreePageAppFilePlan(input: {
  readonly model: ProjectModel;
  readonly port_env_var?: string;
  readonly default_port?: number;
}): FilePlan {
  const portEnv = input.port_env_var ?? "PORT";
  const defaultPort = input.default_port ?? 3000;
  const routes = input.model.pages.map((p) => ({
    path: p.route,
    body: `<h1>${p.headline}</h1>\n${p.body.join("\n")}`,
  }));
  return {
    record_type: "NEX1_FILE_PLAN",
    plan_id: `wo11-plan-${randomUUID()}`,
    project_id: input.model.project_id,
    trace_id: input.model.trace_id,
    ops: [
      {
        kind: "create",
        path: "server.js",
        template_ref: "plain-node-server.v1",
        template_params: {
          port_env_var: portEnv,
          default_port: defaultPort,
          routes,
        },
        reason: "authored HTTP server for 3-page application",
      },
      {
        kind: "create",
        path: "README.md",
        template_ref: "readme.v1",
        template_params: {
          projectName: input.model.project_name,
          summary: `Zero-dependency Node HTTP server serving ${input.model.pages.length} route(s): ${input.model.pages.map((p) => p.route).join(", ")}.`,
        },
        reason: "project overview",
      },
    ],
    created_at: new Date().toISOString(),
  };
}
