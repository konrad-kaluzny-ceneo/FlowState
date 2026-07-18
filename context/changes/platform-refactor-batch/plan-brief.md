# Platform Refactor Batch (F-15) — Plan Brief

> Full plan: `context/changes/platform-refactor-batch/plan.md`
> Research: `context/foundation/refactor-opportunities/research.md`

## What & Why

Foundation epic **F-15** closes the leftover tail of the `refactor-opportunities` rollout plus
deferred production-hygiene issues (GitHub #190 / FLO-96). It ships the 6 sub-scopes that are
still outstanding as independently mergeable phases — retiring structural debt in the timer hub,
sign-in, and guest-merge, and adding the production observability (health probe, Sentry, auth
boundary) the app has been missing.

## Starting Point

Of the 8 sub-scopes in #190, **F-08** (data-mode ACL char tests) and **F-10** (`change-impact`
digest) are already done — verified 2026-07-18. The other six are untouched: the sign-in import
cycle is still live, there's no `/api/health`, no `@sentry` dependency, no auth-boundary artifact,
guest merge still has dual entry (server action + tRPC router), and the timer hook has grown to
**3317 LOC** (up from 2357 at research time).

## Desired End State

`GET /api/health` reports Neon + auth readiness; Sentry captures app-wide errors when a DSN is set
(inert otherwise); the sign-in import cycle is gone; guest merge has a single server-action entry;
a documented auth-boundary checklist is backed by a CI smoke test; and a few more pure helpers are
extracted from the timer hook with an unchanged public API. `rollout.md`, roadmap F-15, and #190
are closed.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Batch scope | All 6 remaining in one phased plan | Closes F-15 coherently; infra value ships early | Plan |
| Phase ordering | Independent/low-risk first, F-09 last & cut-able | Protects the batch from the riskiest refactor slipping | Plan |
| F-09 depth | Minimal pure-helper extracts, zero return-API churn | Hook grew ~960 LOC; deeper split deserves its own change | Research / Plan |
| F-13 target entry | Keep server action, retire tRPC `guest` router | Action is already the sole prod UI write path (0 prod `api.guest` callers) | Research / Plan |
| Sentry scope | App-wide `@sentry/nextjs`, inert without DSN | User chose broad coverage over the narrow default | Plan |
| Health probe | Readiness — Neon + auth reachable, 200/503 | Matches #190 intent; real deploy/uptime signal | Plan |
| Auth audit | Checklist doc + one unauthed-rejection smoke test | Durable guardrail enforced in CI without a full sweep | Plan |

## Scope

**In scope:** F-12 sign-in schema extract · `/api/health` readiness probe · app-wide Sentry ·
auth-boundary checklist + smoke test · F-13 guest-router retirement · F-09 minimal hook extracts.

**Out of scope:** timer-engine/sub-hook split · guest-merge behavior change · narrow-only Sentry ·
full per-router isolation sweep · re-doing F-08/F-10 · React Query unification / `refreshGuest`.

## Architecture / Approach

Six self-contained phases on the F-15 branch. Phases 1–4 touch isolated or net-new surfaces (auth
folder, a new route, config, a new test); Phase 5 removes a prod-dead API surface after migrating
its tests; Phase 6 nibbles the timer monolith behind an unchanged facade and can be cut. The hook's
130-case suite + belt E2E are the regression net.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Sign-in schema extract | Import cycle broken via `sign-in/schema.ts` | None material — mirror of existing pattern |
| 2. Health probe | `GET /api/health` readiness (Neon + auth) | Unbounded dependency call hanging the probe |
| 3. Sentry (app-wide) | `@sentry/nextjs` across runtimes, DSN-gated | Noise/overhead if init not gated on DSN |
| 4. Auth-boundary audit | Checklist doc + unauthed-rejection smoke test | Picking non-representative coverage |
| 5. Guest-merge consolidation | tRPC `guest` router retired; action sole entry | Losing coverage if router removed before test migration |
| 6. Hook pure extracts (cut-able) | Pure helpers extracted, identical return API | Accidental behavior/return-API drift in a 3317-LOC file |

**Prerequisites:** F-07/S-45 done (satisfied). Sentry needs a DSN provisioned to actually report
(plan guards its absence). `pnpm change-impact` run before Phase 6 (done 2026-07-18).
**Estimated effort:** ~4–6 sessions across 6 phases; phases 1–4 are small, 5–6 carry the risk.

## Open Risks & Assumptions

- Sentry DSN + `SENTRY_AUTH_TOKEN` are external to provision; without them Sentry stays inert (by design).
- App-wide Sentry deviates from #190's "narrow" wording — explicit user choice.
- F-09 must keep the hook's ~65-field return API identical; any drift shows in the 130-case suite.
- F-13 test migration must land before the router is removed to avoid an untested window.

## Success Criteria (Summary)

- Health endpoint reports honest Neon + auth readiness; Sentry reports errors when configured.
- Sign-in import cycle gone; guest merge has one entry; auth boundary has a CI-enforced smoke test.
- Timer hook shrinks slightly with zero behavior change; `check`/`typecheck`/`test`/belt all green.
