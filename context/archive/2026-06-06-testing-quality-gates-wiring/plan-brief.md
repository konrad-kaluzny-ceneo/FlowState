# Quality-Gates Wiring — Plan Brief

> Full plan: `context/changes/testing-quality-gates-wiring/plan.md`
> Research: `context/changes/testing-quality-gates-wiring/research.md`

## What & Why

Test-plan Phase 4 must stop merges from bypassing lint, typecheck, Vitest, and Playwright. Existing E2E specs already protect key risks but were written before `/10x-e2e` levers existed — this change adds seed + rules, cleans stale auth docs, verifies tests fail when risks break, and wires GitHub Actions.

## Starting Point

Six spec files (10 tests) pass anti-pattern review on behavior; `e2e/fixtures.ts` per-test API auth is solid. Missing: `seed.spec.ts`, E2E rules in `AGENTS.md`, accurate README, CI workflow. Orphaned `auth.setup.ts` and redundant `global.setup.ts` contradict current config.

## Desired End State

Every PR runs `check → typecheck → test → e2e` in GitHub Actions. Agents and humans add E2E tests by copying `e2e/seed.spec.ts` under rules in `AGENTS.md`. Deliberate-break results documented. test-plan Phase 4 marked complete.

## Key Decisions Made

| Decision | Choice | Why | Source |
|----------|--------|-----|--------|
| Truth priority | `/10x-e2e` → Playwright docs → repo | User mandate; skill owns levers + VERIFY | Plan |
| Existing specs | Retrofit headers + VERIFY, no rewrite | Research: behavior already compliant | Research |
| Multi-test files | Keep as-is | Cost × signal; splitting adds churn without new protection | Research + Plan |
| Auth pattern in rules | API via fixtures, not UI login | Stronger than generic storageState; matches code | Research |
| Remove global.setup | Delete + drop E2E_TEST_* requirement | Fixtures create users; simplifies CI secrets | Research |
| check-in-gate.spec.ts | Deferred | test-plan §6.6; batched tRPC oracle still open | Research |
| CI e2e build | Production (`GITHUB_ACTIONS` already in config) | Playwright + Vercel parity | Repo |
| CI workers | `E2E_WORKERS=1` | Neon Auth rate limits | test-plan + config |

## Scope

**In scope:** seed.spec.ts, AGENTS.md rules, README/auth cleanup, DELIBERATE-BREAK.md, provenance headers, `.github/workflows/ci.yml`, test-plan §5/§3 update.

**Out of scope:** New risk e2e, file splits, mutation CI, branch protection automation, guest merge browser test.

## Architecture / Approach

```
Phase 1: /10x-e2e levers (seed + AGENTS rules) + delete dead auth setup
    ↓
Phase 2: Headers on existing specs + deliberate-break matrix (VERIFY once)
    ↓
Phase 3: GitHub Actions (quality job → e2e job with Neon secrets)
    ↓
Phase 4: test-plan.md sync, change complete
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|------------------|----------|
| 1. E2E levers & hygiene | seed.spec.ts, AGENTS rules, auth cleanup | Seed diverges from helpers if written from scratch |
| 2. Suite alignment | Headers + DELIBERATE-BREAK.md | VERIFY finds weak oracle → small assertion fix |
| 3. CI gate | `.github/workflows/ci.yml` | Secrets not configured → first CI red |
| 4. Doc sync | test-plan Phase 4 complete | — |

**Prerequisites:** Neon dev branch credentials for CI secrets; Playwright chromium in CI.
**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- GitHub secrets must be set manually before CI e2e passes (documented, not automated).
- Fork PRs from untrusted contributors won't have secrets — expected; e2e may skip or fail on forks (document behavior).
- Removing `global.setup.ts` assumes Neon Auth sign-up API always reachable from CI — same assumption fixtures already make.

## Success Criteria (Summary)

- Full local + CI e2e green with `CI=true`.
- `AGENTS.md` + `seed.spec.ts` enable `/10x-e2e`-compliant test generation.
- test-plan §5 lists PR CI as required.
