---
project: FlowState
checked_at: 2026-05-23T12:00:00Z
health_status: needs-attention
context_type: brownfield
language_family: js
stack_assessment_available: false
checks_run:
  - lockfile
  - dependency_audit
  - outdated_deps
  - test_runner
  - ci_cd
  - configuration
audit_findings:
  critical: 0
  high: 1
  moderate: 6
  low: 0
test_runner_detected: false
ci_provider: null
recommended_fixes: 5
---

## Dependency Health

### Lockfile

```
Status: present (package-lock.json)
Package manager: npm
```

### Security Audit

```
Tool: npm audit --json
Summary: 0 CRITICAL, 1 HIGH, 6 MODERATE, 0 LOW
Direct vs transitive: breakdown available
```

#### HIGH findings

- **drizzle-orm** 0.41.0 — GHSA-gpj5-g38j-94v9: SQL injection via improperly escaped SQL identifiers (CVSS 7.5). Fix: update to `drizzle-orm@0.45.2` (`npm audit fix --force` — breaking change).

#### MODERATE findings (6 total)

- **esbuild** <=0.24.2 — GHSA-67mh-4wv8-2f99: development server allows any website to send requests and read responses. Transitive via `drizzle-kit`. Fix: update `drizzle-kit` to 0.31.10.
- **@esbuild-kit/core-utils** — depends on vulnerable esbuild. Transitive via `drizzle-kit`.
- **@esbuild-kit/esm-loader** — depends on vulnerable @esbuild-kit/core-utils. Transitive via `drizzle-kit`.
- **drizzle-kit** 0.30.6 — depends on vulnerable esbuild and @esbuild-kit/esm-loader. Direct dependency.
- **postcss** <8.5.10 — GHSA-qx2v-qp2m-jg93: XSS via unescaped `</style>` in CSS stringify output. Transitive via `next`.
- **next** — depends on vulnerable postcss. Direct dependency (pinned to ^15.2.3, installed 15.5.18).

### Outdated Dependencies

```
Packages with major version gaps: 3
```

- **next**: 15.5.18 → 16.2.6 (1 major version behind)
- **typescript**: 5.9.3 → 6.0.3 (1 major version behind)
- **zod**: 3.25.76 → 4.4.3 (1 major version behind)

Additional notable gaps (minor/patch, same major):
- **@libsql/client**: 0.14.0 → 0.17.3
- **drizzle-orm**: 0.41.0 → 0.45.2
- **drizzle-kit**: 0.30.6 → 0.31.10
- **@types/node**: 20.19.41 → 25.9.1 (5 major versions behind)

## Test Suite

```
Test runner: not detected
Tests found: not applicable
Test execution: not attempted
```

⚠ No test runner detected. The agent cannot verify its own changes.

No test-related scripts found in `package.json`. No `vitest.config.*`, `jest.config.*`, `playwright.config.*`, or `cypress.config.*` configuration files present.

Recommended: Install Vitest (the standard choice for Next.js + TypeScript projects):

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

Then add a `vitest.config.ts` and a `"test": "vitest run"` script to `package.json`.

## CI/CD

```
Provider: not detected
Configuration: not found
```

ℹ No CI/CD configuration detected. You'll set this up in [Sprint Zero z Agentem: infrastruktura, walking skeleton i pierwszy deploy (M1L5)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l5).
For now, a local test runner is sufficient for agent collaboration.

## Configuration

### High severity

No high-severity configuration gaps. TypeScript `strict: true` is enabled. `.gitignore` is present.

### Medium severity

No medium-severity gaps. Biome is configured as both formatter and linter (`biome.jsonc` present with linter and formatter enabled).

### Low severity

- **`.editorconfig`** — ensures consistent formatting (indentation, line endings) across editors and contributors. Fix: create a `.editorconfig` with project defaults (indent_style, indent_size, end_of_line, charset).

## Stack Assessment Cross-Reference

No stack-assessment.md found. Run `/10x-stack-assess` for quality-gate analysis.

## Recommended Fixes

### Fix before agent work (Category A)

### 1. Update drizzle-orm to fix SQL injection vulnerability

**Impact**: The agent generates database queries using drizzle-orm. A SQL injection vulnerability in the ORM means agent-generated code could be exploitable even when following standard patterns.
**Severity**: high
**Effort**: moderate (15–30 min) — breaking changes between 0.41 and 0.45
**Fix**:

```bash
npm install drizzle-orm@latest drizzle-kit@latest
```

Then verify your schema and queries still compile: `npm run typecheck`. Review the [drizzle-orm changelog](https://github.com/drizzle-team/drizzle-orm/releases) for migration notes between 0.41 and 0.45.

### 2. Install a test runner

**Impact**: Without tests, the agent cannot verify its own changes. Every code generation becomes a trust exercise — the agent writes code, but neither you nor it can confirm correctness without manual inspection.
**Severity**: high
**Effort**: moderate (15–30 min)
**Fix**:

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

Create `vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
  },
  resolve: {
    alias: {
      "~": "./src",
    },
  },
});
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

### 3. Update drizzle-kit to resolve moderate esbuild vulnerabilities

**Impact**: The esbuild vulnerability allows any website to send requests to the dev server. While moderate severity and dev-only, updating drizzle-kit resolves 4 of the 6 moderate findings in one step.
**Severity**: moderate
**Effort**: quick (< 5 min)
**Fix**:

```bash
npm install -D drizzle-kit@latest
```

### 4. Add .editorconfig for consistent formatting

**Impact**: Without `.editorconfig`, the agent may produce code with inconsistent indentation or line endings depending on its defaults vs. your Biome config. Minor but avoidable friction.
**Severity**: low
**Effort**: quick (< 5 min)
**Fix**:

Create `.editorconfig`:

```ini
root = true

[*]
indent_style = tab
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

### 5. Review major version upgrades (next, typescript, zod)

**Impact**: Major version gaps mean the agent's training data may reference newer APIs that don't exist in your installed versions, or deprecated patterns that still work but aren't ideal. Not urgent, but worth planning.
**Severity**: low
**Effort**: significant (> 1 hour) — each major upgrade requires testing
**Fix**:

Plan upgrades individually. Priority order:
1. `zod` 3→4: check migration guide, API changes are moderate
2. `typescript` 5→6: check for new strict checks that may surface errors
3. `next` 15→16: largest change surface, plan separately

### Addressed in upcoming lessons (Category B)

### No CI/CD pipeline

**Lesson**: [Sprint Zero z Agentem: infrastruktura, walking skeleton i pierwszy deploy (M1L5)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l5)
**What you'll do there**: Set up GitHub Actions (or equivalent) with lint, test, build, type-check, and security stages — the full quality gate pipeline.

### No AI assistant instruction files (AGENTS.md)

**Lesson**: [Agent Onboarding: Agents.md, AI Rules i feedback loops (M1L4)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l4)
**What you'll do there**: Build AGENTS.md with project-specific conventions, routing rules, and feedback loops so the agent understands your codebase's patterns and constraints.

## Summary

Health status: **needs-attention**

FlowState has solid foundations — TypeScript strict mode, Biome for formatting and linting, a proper lockfile, and clean project structure from the T3 scaffold. The two gaps that matter most for agent collaboration are the HIGH-severity SQL injection in drizzle-orm (fix with an update) and the complete absence of a test runner (install Vitest). Once those are addressed, the project is ready for productive agent-assisted development.

Next step: address fixes #1 and #2 above (drizzle-orm update + Vitest setup), then proceed to agent onboarding.
