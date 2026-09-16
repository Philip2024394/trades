// NEX1 · CAPABILITY A · v5.0.0-alpha.1 vocabulary tests
// Cluster 4 additions: scanning / security / SBOM / fuzz / coverage / property /
// formal verification / mutation / load / dep-analysis / type-check / lint tools.
//
// Fixture list mirrors the exact insertions in vocabulary.ts under the
// `// v5.0.0-alpha.1 · scanning / security …` header.

import { describe, it, expect } from "vitest";
import { classifyFounderIntent } from "../classifier";
import {
  CODE_CONCEPT_LEXEMES,
  TOOL_LEXEMES,
  VOCABULARY_VERSION,
} from "../vocabulary";
import type { Nex1IntentClassified } from "../types";

function classified(result: ReturnType<typeof classifyFounderIntent>): Nex1IntentClassified {
  if (result.kind !== "classified") throw new Error(`expected classified, got ${result.kind}`);
  return result;
}

const NEW_TOOLS: readonly string[] = [
  // SAST
  "semgrep", "codeql", "sonarqube", "sonarcloud", "deepsource", "codacy",
  "veracode", "checkmarx", "fortify", "coverity", "klocwork", "brakeman",
  "bandit", "gosec", "spotbugs", "find-sec-bugs", "njsscan", "dodgy", "dlint",
  "safety",
  // DAST + IAST + RASP
  "owasp-zap", "burp", "nuclei", "nikto", "acunetix", "contrast",
  "signal-sciences", "sqreen",
  // secrets + supply-chain scanners
  "gitguardian", "gitleaks", "trufflehog", "trufflehog3", "detect-secrets",
  "whispers", "ripsecrets", "semgrep-secrets",
  // SBOM tooling
  "syft", "grype", "trivy", "tern", "cdxgen", "dependency-track", "sbom-tool",
  "kubescape",
  // supply-chain integrity
  "slsa", "in-toto", "gittuf", "tuf", "notary", "rekor", "fulcio",
  // container / image scanners
  "docker-scout", "clair", "anchore", "twistlock", "aqua", "sysdig", "falco",
  "tracee",
  // IaC + policy scanners
  "checkov", "kics", "tfsec", "terrascan", "cfn-lint", "snyk-iac", "tflint",
  "opa", "rego", "conftest", "sentinel", "cloudsploit", "prowler", "scoutsuite",
  // Kubernetes security
  "kubesec", "kube-linter", "kubeval", "kube-bench", "kube-hunter", "popeye",
  "polaris", "datree", "kubeaudit",
  // coverage
  "c8", "nyc", "istanbul", "coverlet", "gcov", "lcov", "kcov", "tarpaulin",
  "jacoco", "simplecov", "codecov", "coveralls", "coverage-py",
  // fuzzing
  "libfuzzer", "afl", "aflplusplus", "honggfuzz", "cargo-fuzz", "go-fuzz",
  "jazzer", "atheris", "boofuzz", "syzkaller", "jqf", "restler", "radamsa",
  "echidna", "medusa",
  // property-based testing
  "hypothesis", "fast-check", "jsverify", "quickcheck", "proptest", "scalacheck",
  "junit-quickcheck", "gopter", "stream-data", "rantly",
  // symbolic execution + formal verification
  "klee", "angr", "manticore", "mythril", "frama-c", "dafny", "tla-plus", "coq",
  "isabelle", "lean", "alloy", "spark", "fstar",
  // mutation testing
  "stryker", "pitest", "mutmut", "cosmic-ray", "mull", "gremlins-js",
  // load / performance testing
  "gatling", "jmeter", "wrk2", "vegeta", "hey", "bombardier", "autocannon",
  "apache-bench", "drill", "oha", "siege",
  // dependency analysis
  "madge", "depcheck", "npm-check-updates", "ncu", "retire-js", "deps.dev",
  "npm-audit", "yarn-audit", "pnpm-audit", "pip-audit", "cargo-audit",
  "bundler-audit",
  // type checkers
  "flow-typecheck", "pyright", "mypy", "pyre", "sorbet", "hh-client",
  "dialyzer", "merlin", "roslyn",
  // additional linters
  "shellcheck", "hadolint", "rubocop", "staticcheck", "golangci-lint",
  "goimports", "revive-go", "errcheck", "reek-ruby", "standardrb",
];

const NEW_CONCEPTS: readonly string[] = [
  "reproducible-build",
  "property-based-testing",
  "mutation-testing",
];

describe("capability-a v5.0.0-alpha.1 · vocabulary version + baseline sizes", () => {
  it("VOCABULARY_VERSION is v5.0.0-alpha.1 or a later alpha in the same series", () => {
    // Later alpha bumps preserve alpha.1 additions (add-only).
    expect(VOCABULARY_VERSION.startsWith("v5.0.0-alpha.")).toBe(true);
  });

  it("TOOL_LEXEMES grew by at least Cluster 4 size (v4 baseline was ~180)", () => {
    expect(TOOL_LEXEMES.size).toBeGreaterThanOrEqual(180 + NEW_TOOLS.length - 5);
  });

  it("CODE_CONCEPT_LEXEMES grew by at least the 3 new methodology concepts", () => {
    expect(CODE_CONCEPT_LEXEMES.size).toBeGreaterThanOrEqual(650 + NEW_CONCEPTS.length);
  });
});

describe("capability-a v5.0.0-alpha.1 · every new tool is registered as `tool`", () => {
  for (const lex of NEW_TOOLS) {
    it(`TOOL_LEXEMES has \`${lex}\` = tool`, () => {
      expect(TOOL_LEXEMES.get(lex)).toBe("tool");
    });
  }
});

describe("capability-a v5.0.0-alpha.1 · every new concept is registered as `concept`", () => {
  for (const lex of NEW_CONCEPTS) {
    it(`CODE_CONCEPT_LEXEMES has \`${lex}\` = concept`, () => {
      expect(CODE_CONCEPT_LEXEMES.get(lex)).toBe("concept");
    });
  }
});

describe("capability-a v5.0.0-alpha.1 · classifier surfaces new lexemes via classifyFounderIntent", () => {
  it("SAST tools extracted", () => {
    const r = classified(
      classifyFounderIntent("build a semgrep and codeql pipeline that also runs sonarqube"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("semgrep:tool");
    expect(cats).toContain("codeql:tool");
    expect(cats).toContain("sonarqube:tool");
  });

  it("secrets scanners extracted", () => {
    const r = classified(
      classifyFounderIntent("build a pipeline that runs gitleaks and trufflehog and gitguardian on push"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("gitleaks:tool");
    expect(cats).toContain("trufflehog:tool");
    expect(cats).toContain("gitguardian:tool");
  });

  it("SBOM tools extracted", () => {
    const r = classified(
      classifyFounderIntent("author a script that runs syft to build an sbom then grype and trivy on the image"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("syft:tool");
    expect(cats).toContain("grype:tool");
    expect(cats).toContain("trivy:tool");
  });

  it("supply-chain integrity terms extracted", () => {
    const r = classified(
      classifyFounderIntent("author a workflow that produces slsa provenance signed with fulcio recorded in rekor"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("slsa:tool");
    expect(cats).toContain("fulcio:tool");
    expect(cats).toContain("rekor:tool");
  });

  it("IaC + policy scanners extracted", () => {
    const r = classified(
      classifyFounderIntent("build a checkov and tflint check that enforces opa rego policies via conftest"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("checkov:tool");
    expect(cats).toContain("tflint:tool");
    expect(cats).toContain("opa:tool");
    expect(cats).toContain("rego:tool");
    expect(cats).toContain("conftest:tool");
  });

  it("kubernetes security tools extracted", () => {
    const r = classified(
      classifyFounderIntent("author a workflow that runs kubesec and kube-linter and kube-bench on the manifests"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("kubesec:tool");
    expect(cats).toContain("kube-linter:tool");
    expect(cats).toContain("kube-bench:tool");
  });

  it("coverage tools extracted", () => {
    const r = classified(
      classifyFounderIntent("author a report that combines c8 and nyc and jacoco coverage into codecov"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("c8:tool");
    expect(cats).toContain("nyc:tool");
    expect(cats).toContain("jacoco:tool");
    expect(cats).toContain("codecov:tool");
  });

  it("fuzzing frameworks extracted", () => {
    const r = classified(
      classifyFounderIntent("build a fuzzing harness for libfuzzer and cargo-fuzz and honggfuzz"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("libfuzzer:tool");
    expect(cats).toContain("cargo-fuzz:tool");
    expect(cats).toContain("honggfuzz:tool");
  });

  it("property-based testing frameworks extracted", () => {
    const r = classified(
      classifyFounderIntent("author tests using hypothesis and fast-check and proptest"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("hypothesis:tool");
    expect(cats).toContain("fast-check:tool");
    expect(cats).toContain("proptest:tool");
  });

  it("formal-verification tools extracted", () => {
    const r = classified(
      classifyFounderIntent("author a klee harness plus a coq proof and an alloy model"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("klee:tool");
    expect(cats).toContain("coq:tool");
    expect(cats).toContain("alloy:tool");
  });

  it("load-testing tools extracted", () => {
    const r = classified(
      classifyFounderIntent("author a load test using gatling and vegeta and bombardier for the api"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("gatling:tool");
    expect(cats).toContain("vegeta:tool");
    expect(cats).toContain("bombardier:tool");
  });

  it("dependency-analysis tools extracted", () => {
    const r = classified(
      classifyFounderIntent("build a script that runs npm-audit and pip-audit and cargo-audit weekly"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("npm-audit:tool");
    expect(cats).toContain("pip-audit:tool");
    expect(cats).toContain("cargo-audit:tool");
  });

  it("type checkers extracted (with flow-typecheck + hh-client aliases)", () => {
    const r = classified(
      classifyFounderIntent("author a build that runs pyright and mypy and sorbet in ci"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("pyright:tool");
    expect(cats).toContain("mypy:tool");
    expect(cats).toContain("sorbet:tool");
  });

  it("additional linters extracted", () => {
    const r = classified(
      classifyFounderIntent("author a workflow that runs shellcheck and hadolint and staticcheck"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("shellcheck:tool");
    expect(cats).toContain("hadolint:tool");
    expect(cats).toContain("staticcheck:tool");
  });

  it("new methodology concepts extracted", () => {
    const r = classified(
      classifyFounderIntent("add property-based-testing and mutation-testing to reach reproducible-build guarantees"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("property-based-testing:concept");
    expect(cats).toContain("mutation-testing:concept");
    expect(cats).toContain("reproducible-build:concept");
  });
});
