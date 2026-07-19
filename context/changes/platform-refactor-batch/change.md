---
change_id: platform-refactor-batch
title: Platform refactor batch (F-15) — close the remaining refactor-opportunities tail + prod hygiene
status: implementing
created: 2026-07-18
updated: 2026-07-19
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
