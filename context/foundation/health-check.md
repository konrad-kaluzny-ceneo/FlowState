---
project: .bootstrap-scaffold
checked_at: 2026-05-23T12:00:00Z
health_status: healthy
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
  high: 0
  moderate: 6
  low: 0
test_runner_detected: true
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
Summary: 0 CRITICAL, 0 HIGH, 6 MODERATE, 0 LOW
Direct vs transitive: 2 direct, 4 transitive
```

#### MODERATE findings

- **esbuild** <=0.24.2 (transitive, via drizzle-kit) — GHSA-67mh-4wv8-2f99: development server allows any website to send requests and read responses (CVSS 5.3). Fix available: update drizzle-kit to 0.18.1 (semver-major).
- **@esbuild-kit/core-utils** (transitive, via drizzle-kit) — inherits esbuild vulnerability. Fix: same as above.
- **@esbuild-kit/esm-loader** (transitive, via drizzle-kit) — inherits esbuild vulnerability. Fix: same as above.
- **drizzle-kit** (direct) — pulls in vulnerable esbuild chain. Fix available at 0.18.1 but is a semver-major downgrade — verify compatibility.
- **postcss** <8.5.10 (transitive, via next) — GHSA-qx2v-qp2m-jg93: XSS via unescaped `</style>` in CSS stringify output (CVSS 6.1). Fix available: update next (semver-major).
- **next** (direct) — inherits postcss vulnerability. Fix available at next@9.3.3 per npm but this is a false downgrade — wait for next@15 patch or next@16 which bundles postcss >=8.5.10.

All 6 findings are MODERATE severity. The esbuild issue only affects the dev server (not production). The postcss XSS requires user-controlled CSS input to exploit. Neither is blocking for agent-assisted development.

### Outdated Dependencies

```
Packages with major version gaps: 3
```

- **next**: 15.5.18 → 16.2.6 (1 major version behind)
- **typescript**: 5.9.3 → 6.0.3 (1 major version behind)
- **zod**: 3.25.76 → 4.4.3 (1 major version behind)

Additional minor gaps (not major): @libsql/client (0.14→0.17), @t3-oss/env-nextjs (0.12→0.13), @types/node (20→25).

## Test Suite

```
Test runner: Vitest
Tests found: 1 test in 1 suite
Test execution: passing
```

Configuration: `vitest.config.ts`
Framework: Vitest 4.x with @vitejs/plugin-react, jsdom environment
Setup file: `src/test/setup.ts`
Testing libraries: @testing-library/react, @testing-library/jest-dom

Note: Only 1 smoke test exists. Test coverage is minimal but the infrastructure is fully configured and working.

## CI/CD

```
Provider: not detected
Configuration: not found
```

ℹ No CI/CD configuration detected. You'll set this up in the infrastructure and deployment lesson.
For now, a local test runner is sufficient for agent collaboration.

## Configuration

All expected configuration files present. No gaps detected.

| File | Status | Notes |
|------|--------|-------|
| `.editorconfig` | ✓ | Present |
| `biome.jsonc` | ✓ | Formatter + linter configured (replaces ESLint + Prettier) |
| `tsconfig.json` | ✓ | `strict: true`, `noUncheckedIndexedAccess: true` |
| `.gitignore` | ✓ | Present |
| `.env.example` | ✓ | Environment variable documentation present |
| `AGENTS.md` | — | Category B — covered in agent onboarding |

## Stack Assessment Cross-Reference

No stack-assessment.md found. Run /10x-stack-assess for quality-gate analysis.

## Recommended Fixes

### Fix before agent work (Category A)

### 1. Expand test coverage beyond the smoke test

**Impact**: The agent can run tests (Vitest works), but with only 1 smoke test it cannot meaningfully verify changes to application logic. Adding tests for existing tRPC routers and utilities gives the agent a feedback loop.
**Severity**: medium
**Effort**: moderate (15–30 min)

**Fix**:

```bash
# Add a test for the post router as a starting point:
# Create src/server/api/routers/post.test.ts with basic CRUD tests
# The test infrastructure is already configured — just add test files.
```

### 2. Address outdated dependencies with major version gaps

**Impact**: When the agent generates code, it references the installed version's API. Major version gaps mean online documentation and training data may describe newer APIs that don't match your installed versions, causing subtle errors.
**Severity**: low
**Effort**: moderate (15–30 min per package)

**Fix**:

```bash
# Review each major upgrade individually:
# next: 15 → 16 (check Next.js 16 migration guide)
npm install next@latest

# typescript: 5 → 6 (check breaking changes)
npm install -D typescript@latest

# zod: 3 → 4 (significant API changes — review migration guide)
npm install zod@latest
```

Note: Do these one at a time, running `npm run typecheck` and `npm run test` after each to catch breakage early.

### 3. Review moderate audit findings in drizzle-kit

**Impact**: The esbuild vulnerability in drizzle-kit only affects the dev server, not production. Low urgency, but worth tracking for when drizzle-kit ships a compatible fix.
**Severity**: low
**Effort**: quick (< 5 min to check for updates)

**Fix**:

```bash
# Check if a newer drizzle-kit resolves the issue:
npm info drizzle-kit version
# If a newer minor/patch is available:
npm update drizzle-kit
```

### Addressed in upcoming lessons (Category B)

### No CI/CD pipeline

**Lesson**: [Sprint Zero z Agentem: infrastruktura, walking skeleton i pierwszy deploy (M1L5)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l5)
**What you'll do there**: Set up GitHub Actions (or equivalent) with lint, type-check, test, and build stages to catch regressions automatically.

### No AI assistant instruction files (AGENTS.md)

**Lesson**: [Agent Onboarding: Agents.md, AI Rules i feedback loops (M1L4)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l4)
**What you'll do there**: Generate a structured AGENTS.md that teaches the agent your project's conventions, architecture, and constraints — so it produces code that fits without constant correction.

## Summary

Health status: **healthy**

The project has a solid foundation for agent-assisted development: TypeScript strict mode is enabled, Biome handles formatting and linting with a single tool, Vitest is configured and passing, and dependencies are locked. The main gap is test coverage — only a smoke test exists, which limits the agent's ability to verify non-trivial changes. All 6 audit findings are MODERATE severity with no production impact.

Next step: Address the test coverage gap (Category A #1) to give the agent a meaningful verification loop, then proceed to agent onboarding.
