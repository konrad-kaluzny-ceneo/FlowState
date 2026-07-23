---
change_id: platform-refactor-batch
title: Platform refactor batch (F-15) — close the remaining refactor-opportunities tail + prod hygiene
status: archived
created: 2026-07-18
updated: 2026-07-23
archived_at: 2026-07-23T09:24:13Z
roadmap_id: F-15
prd_refs: guardrails
---

## Notes

Foundation epic **F-15** (roadmap `active`; GitHub [#190](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/190) / Linear FLO-96). Closes the leftover
tail of the `refactor-opportunities` rollout (`context/foundation/refactor-opportunities/`,
research frozen 2026-06-17) plus deferred production-hygiene issues.

Of the 8 sub-scopes in #190, **F-08** (`data-mode-acl-hardening`) and **F-10**
(`timer-change-impact-digest`) are already done — verified 2026-07-18
(`data-mode-context.test.tsx` exists; `pnpm change-impact` runs). This plan covers the
**6 remaining**, ordered independent/low-risk first, F-09 last & cut-able:

1. F-12 `sign-in-schema-extract` — break `action.ts ↔ sign-in-form.tsx` import cycle.
2. `production-health-probe` — `GET /api/health` readiness (Neon + auth reachable).
3. `sentry-wedge-error-monitoring` — **app-wide** `@sentry/nextjs` (user chose broad over narrow).
4. `auth-boundary-audit` — checklist doc + one unauthed-rejection smoke test.
5. F-13 `guest-merge-consolidation` — retire tRPC `guest` router; server action is sole entry.
6. F-09 `cycle-hook-pure-extracts` — minimal pure-helper extracts, zero return-API churn (cut-able).

Decisions locked during `/10x-plan` (2026-07-18): all-6-in-one-phased-plan · F-09 minimal
pure extracts only (no timer-engine split) · F-13 keep server action / retire router ·
Sentry app-wide · health = readiness (Neon + auth) · auth-audit = doc + one smoke test.

**Linear:** FLO-96 (sync pending — connector unauthorized this session)
**GitHub:** [#190](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/190)

### Known gaps / follow-ups

- **No `src/app/global-error.tsx`** (discovered during Phase 3). React render errors that
  escape to the root error boundary are therefore **not** captured by Sentry — only the
  client/server/edge instrumentation hooks report. Deliberately deferred: the page needs
  i18n copy (`src/i18n/`) plus a `DESIGN.md`-conformant treatment, which is beyond the
  Phase 3 "wire up Sentry" scope. Track as a follow-up change.

Full follow-up register: [`follow-ups/review-fixes.md`](./follow-ups/review-fixes.md) (FU-1
global-error, FU-2 `/api/health` cost bound, FU-3 DSN provisioning cleanup).

### Implementation review (S8)

[`reviews/impl-review.md`](./reviews/impl-review.md) — 2026-07-21, **APPROVED**:
0 critical / 2 warnings / 8 observations. All four plan deviations (Sentry `instrumentation-client.ts`
+ `process.env` boot reads, the p4 dynamic procedure sweep, the p6 optional `now`/`clientTimer`
params) judged correct. Zero return-API churn in `use-pomodoro-cycle.ts`; no guest/authenticated
asymmetry from retiring the tRPC `guest` router. `typecheck` / `check` / `test` (1413) / `depcruise`
all green. Two fixes applied during review: Sentry entries added to `.gitignore`, and the
health-route `process.env` comment corrected to cite parity with `src/lib/auth/server.ts`.
