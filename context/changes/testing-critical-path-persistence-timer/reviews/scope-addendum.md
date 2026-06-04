# Scope addendum — testing-critical-path-persistence-timer

**Date:** 2026-06-04  
**Decision:** Impl review F2/F3 — accept cost × signal cut for e2e ±2s oracle.

## Accepted deviation from original plan

| Planned | Shipped |
|---------|---------|
| `e2e/helpers/countdown.ts` + reload specs assert `timer-countdown` within ±2s | Vitest-only oracle (`src/test-utils/countdown-tolerance.ts`); e2e asserts task row + `timer-panel-running` after `reload` |
| Shared `storageState` + optional `page.clock` advance before reload | Per-test API sign-up/sign-in (`e2e/fixtures.ts`); reload specs use real elapsed time |

## Rationale

- Risk **#2** (±2s drift) is covered at hook + unit layers with controlled `Date.now` / `visibilitychange` — aligns with test-plan §6.6 Worker limitation.
- Risk **#1** UI round-trip (tasks + running panel after refresh) is covered at e2e; remaining-second accuracy is integration + hook responsibility.
- Playwright mm:ss assertions were deferred to avoid `formatRemainingMs` ceil flakes and clock-survival ambiguity across `reload`.

## Follow-up (optional)

- `/10x-test-plan --refresh` if stakeholders want the quality contract file to reflect this cut formally in §2 risk mapping.
