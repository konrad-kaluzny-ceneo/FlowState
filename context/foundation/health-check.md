---
project: flow-state
version: 2
checked_at: 2026-06-12T12:00:00Z
updated: 2026-06-12
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
  moderate: 0
  low: 0
test_runner_detected: true
ci_provider: github-actions
recommended_fixes: 2
note: "Housekeeping refresh 2026-06-12 — MVP shipped; CI wired; re-run full audit for current dependency counts."
---

## Dependency Health

### Lockfile

```
Status: present (pnpm-lock.yaml)
Package manager: pnpm
```

Lockfile is present and managed by pnpm 11.2.2. Dependency versions are pinned — builds are reproducible.

### Security Audit

```
Tool: pnpm audit --json
Summary: 0 CRITICAL, 0 HIGH, 2 MODERATE, 0 LOW
Direct vs transitive: 1 transitive (production), 1 transitive (dev)
```

#### MODERATE findings

- **esbuild** 0.18.20 — GHSA-67mh-4wv8-2f99: Development server allows any website to send requests and read responses (CWE-346). Transitive via `drizzle-kit > @esbuild-kit/esm-loader`. Dev-only dependency — no production exposure. Fix: update `drizzle-kit` when a patched version is available.
- **postcss** 8.4.31 — GHSA-qx2v-qp2m-jg93: XSS via unescaped `</style>` in CSS stringify output (CWE-79). Transitive via `next > postcss`. Fix: will resolve when `next` updates its bundled postcss to ≥8.5.10.

Both findings are transitive and moderate severity. Neither is directly exploitable in the application's runtime context (one is dev-only, the other requires attacker-controlled CSS input to the build pipeline).

### Outdated Dependencies

```
Packages with major version gaps: 3
```

- **@types/node**: 20.19.41 → 25.9.1 (5 major versions behind) — type definitions only, low risk
- **typescript**: 5.9.3 → 6.0.3 (1 major version behind) — TypeScript 6 is recent; evaluate when ecosystem stabilizes
- **zod**: 3.25.76 → 4.4.3 (1 major version behind) — Zod 4 has breaking API changes; migration requires schema review

Additional minor gaps (not urgent): `next` 15 → 16, `@libsql/client` 0.14 → 0.17, `@t3-oss/env-nextjs` 0.12 → 0.13.

## Test Suite

```
Test runner: Vitest + Playwright
Unit/integration: co-located under src/; full suite via pnpm test
E2E belt: 12 tests via pnpm test:e2e:belt (CI merge gate)
Test execution: passing (verify with pnpm test && pnpm test:e2e:belt)
```

Configuration: `vitest.config.ts`, `playwright.config.ts`. Test infrastructure expanded post-MVP (Phases 1–7 in test-plan.md).

## CI/CD

```
Provider: GitHub Actions
Configuration: .github/workflows/ci.yml
Gates: Biome check, typecheck, Vitest, Playwright e2e belt (12 tests)
```

CI runs on PR and push to main. E2E belt uses Playwright with Neon auth pool (see `e2e/README.md`). Vercel auto-deploy remains on merge to main.

## Configuration

All expected configuration files present. No gaps detected.

| File | Status | Notes |
|------|--------|-------|
| `.editorconfig` | ✓ | Tabs, LF, UTF-8 configured |
| `biome.jsonc` | ✓ | Linter + formatter (replaces ESLint/Prettier) |
| `tsconfig.json` | ✓ | `strict: true`, `noUncheckedIndexedAccess: true` |
| `.gitignore` | ✓ | Comprehensive exclusions |
| `.env.example` | ✓ | Documents required env vars |
| `AGENTS.md` | ✓ | Agent instruction file present |

## Stack Assessment Cross-Reference

No stack-assessment.md found. Run /10x-stack-assess for quality-gate analysis.

## Recommended Fixes

### Fix before agent work (Category A)

### 1. Expand test coverage

**Impact**: With only 1 test, the agent has minimal ability to verify its changes don't break existing functionality. As features are added, untested code paths become silent regression risks.
**Severity**: medium
**Effort**: moderate (15–30 min per feature area)
**Fix**:

```bash
# Add tests for existing tRPC routers — start with the post router:
# Create src/server/api/routers/post.test.ts
# Test each procedure (getLatest, create) with mocked DB context
pnpm test
```

### 2. Update transitive dependency (postcss via next)

**Impact**: Moderate XSS advisory in the build pipeline. Low practical risk but shows up in every audit scan, creating noise.
**Severity**: low
**Effort**: quick (< 5 min)
**Fix**:

```bash
# Check if a newer next patch resolves the transitive postcss:
pnpm update next --latest
pnpm audit
```

### 3. Evaluate Zod 4 migration path

**Impact**: Zod 4 has breaking changes. Staying on 3.x is fine for now, but the gap will widen. The agent generates Zod schemas frequently — knowing which version to target avoids mixed patterns.
**Severity**: low
**Effort**: significant (> 1 hour — requires reviewing all schema definitions)
**Fix**:

```bash
# When ready to migrate:
# 1. Read Zod 4 migration guide
# 2. Update: pnpm update zod@latest
# 3. Fix breaking changes in src/env.js and tRPC input schemas
# Not urgent — Zod 3.x is fully supported and stable.
```

### Addressed in upcoming lessons (Category B)

### No stack assessment on file

**Lesson:** Optional upstream context from /10x-stack-assess.

### Observability (Sentry / OTel)

**Status:** Out of scope per PRD Non-Goals and roadmap Parked.

## Summary

Health status: **healthy** (housekeeping refresh 2026-06-12; re-run `pnpm audit` for current advisory counts).

MVP shipped 2026-06-07. CI: GitHub Actions (quality + e2e belt). Vitest + Playwright in place. PRD v2 defines iteration backlog.

Next step: next roadmap slice per `roadmap.md` §Backlog Handoff — recommended **S-17** (`session-narrative-summary`).
