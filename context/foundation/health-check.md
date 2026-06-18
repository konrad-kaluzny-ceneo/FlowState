---
project: flow-state
version: 3
checked_at: 2026-06-13T17:30:00Z
updated: 2026-06-18
health_status: healthy
context_type: brownfield
prd_version: 3
language_family: js
stack_assessment_available: true
stack_assessment_path: context/foundation/stack-assessment.md
change_thread_health_checks:
  - id: break-alerts-out-of-tab
    checked_at: 2026-06-18T20:32:00Z
    thread_health: needs-attention
    focus: "timer visibility / audio tests — break-out-of-tab MVP gaps"
    stack_assessment_ref: context/foundation/stack-assessment.md#change-thread-assessment-break-alerts-outside-active-tab-narrow-mvp
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

MVP shipped 2026-06-07. CI: GitHub Actions (quality + e2e belt). Vitest + Playwright in place. PRD v3 defines iteration backlog. Stack assessment: [`stack-assessment.md`](stack-assessment.md).

Next step: next roadmap slice per `roadmap.md` §Backlog Handoff — recommended **S-17** (`session-narrative-summary`).

---

## Change thread health check: Break alerts (timer visibility / audio)

**Checked:** 2026-06-18  
**Thread:** `break-alerts-out-of-tab`  
**Focus:** Test coverage for out-of-tab break alerts (PRD change thread + stack-assessment gaps T2–T4)  
**Baseline report above:** unchanged — project remains **healthy** for general agent work.

> **Thread verdict: needs-attention** — existing timer visibility/audio tests cover **work-cycle catch-up on tab return**, not **break-start reachability while the tab stays hidden**. Safe to plan the slice; budget new tests before shipping FR-002/FR-003.

### Execution snapshot (2026-06-18)

Commands run locally (read-only audit):

```text
pnpm exec vitest run src/lib/audio.test.ts src/lib/cycle-end-tab-pulse.test.ts src/hooks/use-cycle-end-audio-preference.test.tsx
  → 13 passed

pnpm exec vitest run src/app/_components/tab-return-catchup.test.tsx src/app/_components/cycle-audio-preference-control.test.tsx
  → 6 passed

pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx
  → 68 passed (includes 6 catchUp + playAlarm/visibility cases)

pnpm exec vitest run src/hooks/use-pomodoro-cycle-guest.test.tsx -t "catchUp"
  → 2 passed
```

**Note:** `vitest run … -t catchUp` on the auth hook file **alone** fails (6/6) — `queryTasks` mock lives in parent `describe`; full file run is the reliable gate. Fix describe isolation optional, not blocking MVP.

### Coverage inventory

| Layer | Location | Count / status | Covers today | Gap vs break-alerts MVP |
|-------|----------|----------------|--------------|-------------------------|
| Unit | `src/lib/audio.test.ts` | 6 tests ✓ | `playAlarm` normal/soft/muted; autoplay `NotAllowedError` swallowed | No break-start trigger; no background-tab contract |
| Unit | `src/lib/cycle-end-tab-pulse.test.ts` | 5 tests ✓ | Title/favicon pulse module | Hook fires pulse **WORK + soft/muted only** — not break start |
| Unit | `src/lib/cycle-audio-preference/storage.test.ts` | ✓ | Scoped localStorage (guest + user) | Pattern for out-of-tab toggle — **not implemented** |
| Hook | `src/hooks/use-pomodoro-cycle.test.tsx` | 68 tests ✓ | Hidden **work** expiry → `catchUp` + `playAlarm`; visibility recalc; muted while hidden | **No break-start** alert; **no `Notification`**; catchUp is **on return**, not out-of-tab ping |
| Hook | `src/hooks/use-pomodoro-cycle-guest.test.tsx` | 2 catchUp ✓ | Guest hidden-tab catchUp | Same gap as auth hook |
| Component | `src/app/_components/tab-return-catchup.test.tsx` | 4 tests ✓ | Copy when user **returns** (`tab-return-catchup`) | In-tab overlay after return — not system notification while away |
| Component | `src/app/_components/cycle-audio-preference-control.test.tsx` | 2 tests ✓ | In-app audio mode toggle | No notification permission / out-of-tab disable UI |
| E2E helper | `e2e/helpers/visibility.ts` | Present | `runWhileHidden` mocks `visibilityState` + `visibilitychange` | **Zero imports** in active `e2e/*.spec.ts` |
| E2E belt | `e2e/pomodoro-cycle.spec.ts` et al. | Belt green (CI) | In-tab Pomodoro flows | `background-tab-return.spec.ts` **demoted 2026-06-11** per `test-plan.md` §6 — Vitest backfill; **no belt guard for out-of-tab** |

### Stack-assessment cross-reference

| Stack-assessment gap | Health-check finding |
|--------------------|----------------------|
| **T2** Break-start vs work-end timing | Hook tests assert catchUp on **cycle expiry while hidden**, not when `SHORT_BREAK`/`LONG_BREAK` **starts running** after check-in gate. No test pins the hook transition the slice must wire. |
| **T3** E2E notification + background tab | `runWhileHidden` exists but unused; no `context.grantPermissions(['notifications'])` in e2e; no spec asserts one notification per break start. |
| **T4** Graceful degradation | `audio.test.ts` covers autoplay block; **no test** for denied notification + blocked audio leaving timer state consistent. |

`test-plan.md` explicitly documents intentional **e2e demotion** for background-tab and quiet-audio (Vitest authority). Break-alerts MVP **re-opens out-of-tab behavior** — cookbook §6 should gain a new entry when the slice ships; until then agents must not assume belt covers hidden-tab break reach.

### Recommended fixes (thread — Category A)

Fix before implementing break-alerts slice (`/10x-new` → `/10x-plan`):

#### 1. Unit tests for notification helper (FR-002)

**Impact:** Without tests, agents will ship notification logic only in the hook — hard to test permission states and “one ping per break start.”  
**Effort:** moderate (15–30 min)  
**Fix:**

```bash
# After adding e.g. src/lib/break-out-of-tab-alert/:
pnpm exec vitest run src/lib/break-out-of-tab-alert.test.ts
# Cases: granted + hidden → notify once; visible → no notify; denied → no throw; preference off → skip
```

#### 2. Hook tests at break-start + hidden (FR-002, FR-003, T2)

**Impact:** Prevents wiring alerts to `handleCycleExpired` (work end) instead of break running.  
**Effort:** moderate  
**Fix:**

```bash
# Extend use-pomodoro-cycle.test.tsx (or co-located *.test.ts):
# — check-in pending → no out-of-tab alert
# — break running + visibility hidden → notification helper invoked once + playAlarm
pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx
```

#### 3. E2E spec with `runWhileHidden` + notifications (T3)

**Impact:** Belt stays in-tab; thread needs at least one Playwright spec before CI promotion of notification behavior.  
**Effort:** moderate  
**Fix:**

```bash
# New e2e/break-out-of-tab-alert.spec.ts — tag @skip-belt initially if flaky
# Use e2e/helpers/visibility.ts runWhileHidden + context.grantPermissions(['notifications'])
# Assert: at most one notification event; settings toggle suppresses next break
set CI=true; pnpm exec playwright test e2e/break-out-of-tab-alert.spec.ts
```

#### 4. Belt regression guard while editing timer hub

**Impact:** FR-005 preservation — in-tab catchUp/audio must not regress.  
**Effort:** quick (run existing suites)  
**Fix:**

```bash
pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx src/hooks/use-pomodoro-cycle-guest.test.tsx src/lib/audio.test.ts
set CI=true; pnpm test:e2e:belt
```

#### 5. Optional — catchUp describe isolation

**Impact:** `vitest -t catchUp` fails without parent mocks — slows targeted debugging.  
**Effort:** quick  
**Fix:** Duplicate minimal `queryTasks` mock in catchUp `beforeEach` or extract shared test harness.

### Category B (thread)

- **Promote notification e2e to belt** — only after `@skip-belt` spec is stable across CI workers (Neon auth + notification permission variability).
- **Update `test-plan.md` §6 cookbook** — add break-out-of-tab pattern when slice merges (location, reference test, run command).

### Thread summary

**Thread health: needs-attention** (does not downgrade baseline **healthy**).

**Strengths:** Solid Vitest coverage for audio modes, autoplay failure, catchUp-on-hidden-expiry, guest parity, and tab-return UI; E2E visibility helper ready; full hook file (68 tests) passes.

**Gaps for break-alerts MVP:** no Notification tests; no break-start trigger tests; no active E2E using `runWhileHidden`; intentional historical demotion of background-tab e2e must be superseded by a new thread-specific spec.

**Recommended next step for this thread:** `/10x-new break-alerts-out-of-tab` → `/10x-plan` with test sub-phases 1–3 above before editing `use-pomodoro-cycle.ts`.
