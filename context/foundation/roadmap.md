---

## project: FlowState
version: 1
status: draft
created: 2026-05-26
updated: 2026-06-11
expanded: 2026-06-07
expanded_intelligence: 2026-06-07
expanded_story: 2026-06-07
expanded_followup: 2026-06-07
expanded_ux_gaps: 2026-06-07
expanded_task_planning: 2026-06-09
active_slices: []
prd_version: 1
main_goal: speed
top_blocker: time

# Roadmap: FlowState

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.
> **Issue tracking:** each roadmap item is mirrored in Linear (team `FLO`) and GitHub Issues on `konrad-kaluzny-ceneo/FlowState`; IDs are in the tables below and in each slice section.
> **No Linear ↔ GitHub auto-sync** — `roadmap.md` is the pairing table; update both on ship.

## Vision recap

FlowState is a single-user web app for the Dynamic Knowledge Worker — a developer or analyst whose day is structurally interrupt-driven. The product enforces mindful Pomodoro cycles linked to selected tasks, and after each cycle suggests the next task by combining user-declared weight and work-type with session context (cycles completed, interruptions, time of day, declared energy). The MVP must end with a logged-in user finishing a full session, marking work done, and seeing a clear active-vs-completed split — and it must do so without ever silently losing data.

The product *wedge* — the one trait that, if removed, makes FlowState indistinguishable from a generic task list — is that the system observes session state and proposes the *next* thing to work on with a one-line rationale, while the user remains free to override. Every roadmap decision below is biased to surface and protect that wedge as early as the dependency graph allows.

## North star

**S-01: First Pomodoro cycle on an existing task** — user picks one task, runs one full configurable work cycle, hears the audio prompt at cycle end, and confirms the transition without losing state on refresh.

> *North star* here means the smallest end-to-end slice whose successful delivery would prove FlowState's core hypothesis — placed as early as Prerequisites allow because every later slice (sessions, check-ins, scoring) only matters if the cycle itself is trustworthy. It is also the *validation milestone* against PRD §Success Criteria.Primary.

## At a glance


| ID   | Change ID                              | Linear                                                     | GitHub                                                                      | Outcome (user can …)                                                                                                                                                         | Prerequisites    | PRD refs                                                                                                                          | Status   |
| ---- | -------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------- |
| F-01 | session-domain-model                   | [FLO-6](https://linear.app/flowstate-10xdev/issue/FLO-6)   | [#5](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/5) (closed)   | (foundation) Pomodoro session domain wired in Prisma + tRPC: Task gains workType + weight; Session, Cycle, CheckIn entities and routers exist with strict per-user isolation | —                | NFR (data isolation), NFR (no silent data loss), NFR (90-day retention), FR-017, FR-018, FR-019, FR-020                           | done     |
| F-02 | e2e-test-infra                         | [FLO-14](https://linear.app/flowstate-10xdev/issue/FLO-14) | [#6](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/6)            | (foundation) Playwright installed with authenticated test user flow; agent and CI can run browser-based e2e tests against the real app                                       | —                | NFR (crash/refresh recovery), NFR (200ms acknowledgement), NFR (timer drift ≤ ±2s)                                                | done     |
| S-01 | first-pomodoro-cycle                   | [FLO-8](https://linear.app/flowstate-10xdev/issue/FLO-8)   | [#7](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/7) (closed)   | start one configurable work cycle on a selected task, hear the audio prompt at cycle end, confirm transition, and return to the same state after a refresh                   | F-01, F-02       | US-01, FR-009, FR-010, FR-012, FR-013, FR-014, NFR (timer drift ≤ ±2s), NFR (crash/refresh recovery), NFR (200ms acknowledgement) | done     |
| S-02 | full-session-with-breaks               | [FLO-10](https://linear.app/flowstate-10xdev/issue/FLO-10) | [#10](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/10)          | complete a multi-cycle session with short and long breaks, see configured break durations applied, and end the session explicitly or after 4h inactivity                     | S-01             | US-01, FR-011, FR-014, FR-019, NFR (session retention 90 days)                                                                    | done     |
| S-03 | mid-cycle-completion-prompt            | [FLO-11](https://linear.app/flowstate-10xdev/issue/FLO-11) | [#11](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/11) (closed) | mark a task done mid-cycle and choose between picking the next task to keep the cycle running or ending the cycle to take a break now                                        | S-01             | FR-015, FR-009a (revert path consistency)                                                                                         | done     |
| S-04 | task-attributes-for-scoring            | [FLO-9](https://linear.app/flowstate-10xdev/issue/FLO-9)   | [#8](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/8)            | tag tasks with work type (deep work / admin / reactive) and weight (1–3) at creation and during edit, with values surfaced in the task list                                  | F-01, F-02       | FR-005 (extend), FR-017, FR-018                                                                                                   | done     |
| S-05 | end-of-cycle-checkin                   | [FLO-12](https://linear.app/flowstate-10xdev/issue/FLO-12) | [#12](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/12) (closed) | declare energy state ("Focused" / "Steady" / "Fading") at every cycle end before transitioning, with the response stored for the active session                              | S-01             | FR-020, NFR (mental-state data privacy)                                                                                           | done     |
| S-06 | adaptive-task-suggestion               | [FLO-13](https://linear.app/flowstate-10xdev/issue/FLO-13) | [#13](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/13)          | after each check-in, see a suggested next task with a one-line rationale and accept it or override by picking any other task                                                 | S-04, S-05       | FR-021, FR-022, NFR (suggestion feedback ≥1s visible)                                                                             | done     |
| S-07 | account-recovery-flow                  | [FLO-7](https://linear.app/flowstate-10xdev/issue/FLO-7)   | [#9](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/9) (closed)   | reset a forgotten password and recover access without losing existing tasks or session history                                                                               | F-02             | FR-003a, NFR (auth must not lock user out of own data)                                                                            | done     |
| S-08 | guest-local-storage-merge              | [FLO-21](https://linear.app/flowstate-10xdev/issue/FLO-21) | [#30](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/30) (closed) | use tasks and a focus cycle without an account (device-local storage), then sign in or sign up and have that work merged into the account                                    | S-01, F-02       | NFR (no silent data loss), FR-003b, FR-003c, FR-004–FR-009                                                                        | done     |
| S-09 | optimistic-task-mutations              | [FLO-24](https://linear.app/flowstate-10xdev/issue/FLO-24) | [#35](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/35) (closed) | see task list and task actions update immediately while logged in (optimistic UI), with rollback on server error — matching perceived speed of local guest storage           | S-01, F-02       | NFR (200ms acknowledgement), FR-004–FR-008                                                                                        | done     |
| S-10 | google-oauth-provider                  | [FLO-20](https://linear.app/flowstate-10xdev/issue/FLO-20) | [#20](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/20) (closed) | sign in or sign up with a Google account in one click, alongside the existing email/password flow                                                                            | F-02             | FR-001, FR-002                                                                                                                    | done     |
| F-03 | align-prisma-config                    | [FLO-22](https://linear.app/flowstate-10xdev/issue/FLO-22) | [#33](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/33)          | (foundation) `prisma.config.ts` aligned with Prisma 7: `dotenv/config`, `env()` helper, unpooled URL for CLI migrations; runtime adapter unchanged                           | —                | —                                                                                                                                 | proposed |
| F-04 | impeccable-design-foundation           | [FLO-25](https://linear.app/flowstate-10xdev/issue/FLO-25) | [#36](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/36)          | (foundation) `DESIGN.md` via Impeccable shape + document — tokens, typography, color, motion, component patterns for downstream craft                                        | S-09             | Secondary Success Criteria, NFR (200ms acknowledgement), proposed-FR-visual-design-system                                         | done |
| S-11 | first-run-wedge-onboarding             | [FLO-26](https://linear.app/flowstate-10xdev/issue/FLO-26) | [#37](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/37)          | on first visit, follow a dismissible first-run flow that teaches the check-in → suggestion wedge and lands ready to accept or override the first real suggestion             | S-06, S-08       | FR-003b, FR-017, FR-018, FR-021, proposed-FR-first-run-guidance                                                                   | done     |
| S-12 | wedge-overlay-visual-polish            | [FLO-28](https://linear.app/flowstate-10xdev/issue/FLO-28) | [#38](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/38)          | complete a work cycle and move through check-in and next-task suggestion inside a calm, cohesive designed flow — overlays no longer feel like unstyled defaults              | S-09, F-04       | FR-013, FR-015, FR-020, FR-021, FR-022, NFR (suggestion feedback ≥1s visible)                                                     | done     |
| S-13 | focus-home-visual-craft                | [FLO-29](https://linear.app/flowstate-10xdev/issue/FLO-29) | [#39](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/39)          | open FlowState and see a cohesive branded home with active and completed tasks visually distinct at a glance — not T3 boilerplate                                            | S-09, F-04       | FR-008, US-01, Secondary Success Criteria                                                                                         | done     |
| S-14 | auth-merge-first-impression            | [FLO-27](https://linear.app/flowstate-10xdev/issue/FLO-27) | [#40](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/40)          | on auth pages understand FlowState's value; after sign-in with guest data see an explicit merge-success moment instead of a silent import                                    | S-08             | FR-001, FR-002, FR-003c, NFR (no silent data loss)                                                                                | done     |
| S-15 | session-kickoff-suggestion             | [FLO-30](https://linear.app/flowstate-10xdev/issue/FLO-30) | [#41](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/41)          | kickoff suggestion + work-type duration presets + remembered per-type defaults (tap-to-apply only)                                                                           | S-06             | FR-021, FR-019, FR-009, FR-010, FR-017, proposed-FR-session-start-guidance                                                        | done     |
| S-16 | mindful-session-wind-down              | [FLO-31](https://linear.app/flowstate-10xdev/issue/FLO-31) | [#42](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/42)          | receive an optional, dismissible prompt to end the session with rationale when energy is Fading and fatigue signals align — and override to continue                         | S-05, S-06       | FR-020, FR-021, FR-019                                                                                                            | done     |
| S-17 | session-narrative-summary              | [FLO-32](https://linear.app/flowstate-10xdev/issue/FLO-32) | [#43](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/43)          | in-flow narrative + closure + 8h return handoff composing S-18 resume note (max two clauses, no charts)                                                                      | S-02, S-05, S-18 | FR-019, FR-020, FR-012, NFR (90-day retention), proposed-FR-return-handoff                                                        | proposed |
| S-18 | task-resume-context-note               | [FLO-33](https://linear.app/flowstate-10xdev/issue/FLO-33) | [#44](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/44)          | capture resume note at mid-cycle switch and mid-cycle completion; show on suggestion card and manual refocus                                                                 | S-06             | FR-015, FR-019, FR-021, FR-022, proposed-FR-interruption-context                                                                  | proposed |
| S-19 | suggestion-override-acknowledgement    | [FLO-34](https://linear.app/flowstate-10xdev/issue/FLO-34) | [#45](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/45) (closed) | validating acknowledgement on post-check-in and kickoff suggestion override — same FR-022 story                                                                              | S-06             | FR-022, FR-021, FR-019, proposed-FR-session-start-guidance                                                                        | done     |
| S-20 | persistent-quiet-cycle-audio           | [FLO-35](https://linear.app/flowstate-10xdev/issue/FLO-35) | [#46](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/46)          | persistent mute/soften cycle chime; optional title/favicon pulse when muted + tab backgrounded; pair with S-22                                                               | S-01             | FR-013, FR-014, NFR (200ms acknowledgement)                                                                                       | done     |
| S-21 | mindful-transition-copy                | [FLO-36](https://linear.app/flowstate-10xdev/issue/FLO-36) | [#47](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/47)          | skippable break/re-entry copy; re-entry variant keyed to last check-in energy (Focused/Steady/Fading)                                                                        | S-02, S-05, S-12 | FR-014, FR-011, FR-012, FR-020                                                                                                    | proposed |
| S-22 | background-tab-return-catchup          | [FLO-37](https://linear.app/flowstate-10xdev/issue/FLO-37) | [#48](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/48)          | returning to a backgrounded tab after cycle end sees a calm catch-up handoff to the next wedge step (check-in, break confirm, or suggestion)                                 | S-01, S-05, S-06 | FR-013, FR-014, FR-020, FR-021, NFR (timer drift ≤ ±2s)                                                                           | done     |
| S-23 | suggestion-rationale-expander          | [FLO-38](https://linear.app/flowstate-10xdev/issue/FLO-38) | [#49](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/49) (closed) | tap "Why this?" on the suggestion card for a deterministic factor breakdown — no analytics screen                                                                            | S-06             | FR-021, FR-022, FR-019, NFR (suggestion feedback ≥1s visible)                                                                     | done     |
| S-24 | cycle-pause-resume                     | [FLO-39](https://linear.app/flowstate-10xdev/issue/FLO-39) | [#50](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/50)          | pause and resume a work or break cycle with remaining time preserved — without INTERRUPTED state or interruptionCount increment                                              | S-01, S-02       | FR-012, FR-019, US-01, NFR (crash/refresh recovery)                                                                               | proposed |
| B-01 | fix-cycle-audio-toggle                 | [FLO-53](https://linear.app/flowstate-10xdev/issue/FLO-53) | [#72](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/72)          | **(bug)** Cycle end audio Normal / Soft / Muted buttons respond to click and persist preference                                                                              | S-20             | FR-013, FR-014                                                                                                                    | done     |
| B-02 | fix-task-title-multiline-edit          | [FLO-54](https://linear.app/flowstate-10xdev/issue/FLO-54) | [#73](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/73) (closed) | **(bug)** task title edit uses multi-line text area so long names wrap and remain fully visible                                                                              | —                | FR-005, FR-008                                                                                                                    | done     |
| B-03 | fix-cycle-start-interrupt-optimistic   | [FLO-55](https://linear.app/flowstate-10xdev/issue/FLO-55) | [#74](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/74) (closed) | **(bug)** Start Cycle / Interrupt update timer UI within 200ms (optimistic), not after server round-trip                                                                     | S-09             | NFR (200ms acknowledgement), FR-009, FR-012                                                                                       | done     |
| B-04 | fix-cycle-complete-flash-after-checkin | [FLO-56](https://linear.app/flowstate-10xdev/issue/FLO-56) | [#75](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/75)          | **(bug)** after energy check-in, Cycle Complete overlay must not flash/hang until break/suggestion                                                                           | S-05, S-06       | FR-020, FR-021, NFR (200ms acknowledgement)                                                                                       | done     |
| F-05 | eisenhower-effort-task-attributes      | [FLO-57](https://linear.app/flowstate-10xdev/issue/FLO-57) | [#78](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/78)          | (foundation) importance + urgency + effort minutes + commitment horizon on Task; deterministic scorer v2 (Eisenhower/Pareto/Ockham)                                          | S-04, S-06       | FR-017, FR-018, FR-021, proposed-FR-task-importance, proposed-FR-commitment-horizon, proposed-FR-effort-estimate                  | done     |
| S-25 | pre-suggestion-readiness               | [FLO-58](https://linear.app/flowstate-10xdev/issue/FLO-58) | [#79](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/79)          | declare Focused/Steady/Fading at kickoff and before next-task suggestion — feeds scorer instead of hardcoded STEADY                                                          | S-05, S-06, S-15 | FR-020, FR-021, FR-019, proposed-FR-pre-suggestion-readiness                                                                      | done     |
| S-26 | task-manual-priority-order             | [FLO-59](https://linear.app/flowstate-10xdev/issue/FLO-59) | [#81](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/81)          | **drag-reorder** active tasks with persisted manual priority as suggester tie-breaker                                                                                        | S-04, S-06, S-09 | FR-021, FR-022, FR-005, NFR (200ms acknowledgement)                                                                               | done     |
| S-27 | daily-standing-tasks-capacity-plan     | [FLO-60](https://linear.app/flowstate-10xdev/issue/FLO-60) | [#80](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/80)          | daily standing tasks roll into today's plan with focus-hours budget and capacity-aware suggestion rationale (no RRULE)                                                       | F-05, S-06, S-15 | FR-021, FR-022, FR-019, proposed-FR-daily-standing-tasks, proposed-FR-daily-focus-budget                                          | proposed |


## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.


| Stream | Theme                          | Chain                                                            | Note                                                                                                                                                                                                                                                          |
| ------ | ------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A      | Core loop (north-star path)    | `F-01` → `F-02` → `S-01` → `S-02` → `S-03`                       | Shortest path to PRD §Success Criteria.Primary; hosts the validation milestone. F-02 gates all UI-facing slices. Bias from `main_goal: speed`.                                                                                                                |
| B      | Scoring substrate              | `S-04` (parallel with `S-01`/`S-02`, requires `F-02`)            | Adds task attributes. Independent of timer mechanics; safe to fan out alongside Stream A once `F-01` + `F-02` land.                                                                                                                                           |
| C      | Wedge convergence              | `S-05` → `S-06`                                                  | Joins Stream A at `S-01` (needs cycle-end hook) and Stream B at `S-04` (needs scoring inputs). Wedge — the differentiating mechanic — lands here.                                                                                                             |
| D      | Auth hardening                 | `S-07` (requires `F-02`), `S-10` (requires `F-02`)               | Standalone slices; require e2e infra to verify auth flows end-to-end in a browser.                                                                                                                                                                            |
| E      | UX responsiveness              | `S-09` (requires `S-01`, `F-02`)                                 | TanStack Query optimistic updates on authenticated task (and optionally cycle) mutations. Pairs with guest trial (`S-08` when shipped) so login does not feel slower than try-before-signup.                                                                  |
| F      | Post-MVP first impression      | `S-09` → `F-04` → (`S-12` ∥ `S-13`); `S-11` ∥ `S-14`             | Impeccable `[shape` → `DESIGN.md` → `craft`/`polish](https://impeccable.style/docs/)`. Onboarding teaches the wedge; visual-ui polishes home and overlay surfaces. Expanded via `/10x-roadmap-expand` 2026-06-07.                                             |
| G      | Intelligent wedge (post-MVP)   | `S-15` ∥ `S-16`; `S-17` (after `S-12` recommended); `S-18`       | Extends deterministic scoring beyond post-check-in moments — kickoff, wind-down, in-flow narrative, context recovery. Expanded via `/10x-roadmap-expand` 2026-06-07 (intelligence batch).                                                                     |
| H      | Story & mindfulness (post-MVP) | `S-19` ∥ `S-20`; `S-21` (after `S-12`); `S-22` pairs with `S-20` | Wedge narrative beats — override acknowledgement, quiet audio, paired break/re-entry copy. Follow-up batch 2 (2026-06-07): P-201→S-19, P-202→S-17, P-203+P-204→S-18, P-205→S-15, P-206→S-21, P-208→S-20 acceptance; P-207 **rejected** (duplicate S-13+S-17). |
| I      | Calm focus UX (post-MVP)       | `S-22` ∥ `S-23` ∥ `S-20`; `S-24` (product gate)                  | Tab-return catch-up, scoring transparency, quiet audio, reversible pause. Expanded via `/10x-roadmap-expand` 2026-06-07 (UX gaps batch). Merges: P-204+P-205→S-11, P-206→S-20.                                                                                |
| J      | Task planning & richer scoring | `**S-26` (high)** ∥ `S-25` ∥ `S-23`; `F-05` → `S-27`             | Expanded `/10x-roadmap-expand` 2026-06-09. User-priority drag-drop first; Eisenhower substrate before daily standing + capacity.                                                                                                                              |


## Baseline

What's already in place in the codebase as of `2026-05-26` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Next.js 16 + React 19 + Tailwind 4 wired; `src/app/page.tsx` + `src/app/_components/task-list.tsx` already implements full task CRUD UI with active/completed split (covers FR-004–FR-008, FR-009a UI side).
- **Backend / API:** present — tRPC 11 wired (`src/server/api/trpc.ts`, `src/server/api/root.ts`); `taskRouter` registered; protected-procedure helper present and tested.
- **Data:** partial — Prisma 7 + `@prisma/adapter-neon` wired; one `Task` model (`prisma/schema.prisma`) with `id / title / status / userId / timestamps`; one initial migration. Missing: `workType`, `weight` columns on Task; `Session`, `Cycle`, `CheckIn` entities. This is what `F-01` adds.
- **Auth:** present — Neon Auth wired end-to-end: `proxy.ts` middleware, `src/app/auth/sign-in` + `sign-up` routes, `src/app/api/auth/[...path]/route.ts`, `src/lib/auth/{client,server}.ts`. FR-001/FR-002/FR-003 covered. FR-003a (recovery) **technically supported by Neon Auth** but UI surface not verified end-to-end — `S-07` validates and exposes it.
- **Deploy / infra:** present (Vercel) / partial (CI) — Vercel project linked (`.vercel/`); auto-deploy via Vercel's GitHub integration. No `.github/workflows/` for parallel CI yet — out of MVP scope under `main_goal: speed`.
- **E2E testing:** absent — no Playwright, no headless browser, no test auth bypass. Unit/integration tests exist (Vitest + fast-check) but cannot verify UI behavior in a browser. This is what `F-02` adds.
- **Observability:** absent — Vercel default request logs only; no Sentry / OTel / log drains. Out of MVP scope; revisit post-launch.

## Foundations

### F-01: Session domain model wired through data and API

- **Outcome:** (foundation) Pomodoro session domain is expressible: Task carries `workType` and `weight`; `Session`, `Cycle`, and `CheckIn` exist as Prisma models with strict per-user isolation; matching tRPC routers are registered in `~/server/api/root.ts`. No user-visible UI changes from this foundation alone.
- **Change ID:** session-domain-model
- **Linear:** [FLO-6](https://linear.app/flowstate-10xdev/issue/FLO-6)
- **GitHub:** [#5](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/5) (closed)
- **PRD refs:** NFR (data isolation), NFR (no silent data loss), NFR (90-day session retention), FR-017, FR-018, FR-019, FR-020
- **Unlocks:** S-01 (cycle entity to start), S-02 (session lifecycle), S-03 (mid-cycle decision recorded), S-04 (Task attribute columns), S-05 (CheckIn entity), S-06 (scoring inputs queryable). Also unlocks the `## Open Roadmap Questions` Q1 work (formula calibration depends on durable session+check-in data).
- **Prerequisites:** —
- **Parallel with:** S-07 (auth recovery; touches auth surface, not data model)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Sequenced first because every other slice (except S-07) has a runtime dependency on it. The risk is over-reach — designing the schema for post-MVP features (analytics, ML scoring) instead of just the must-have FRs. Mitigation: schema scope is bounded by the FR list cited above; anything not on that list is out.
- **Status:** done

### F-02: E2E test infrastructure (Playwright + test auth)

- **Outcome:** (foundation) Playwright is installed and configured with a programmatic test-user authentication flow (bypassing interactive login); a single smoke test proves the pipeline works by signing in, loading the task list, and asserting DOM content. Agent and CI can run `pnpm test:e2e` to verify any UI-facing behavior in a real browser.
- **Change ID:** e2e-test-infra
- **Linear:** [FLO-14](https://linear.app/flowstate-10xdev/issue/FLO-14)
- **GitHub:** [#6](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/6)
- **PRD refs:** NFR (crash/refresh recovery), NFR (200ms acknowledgement), NFR (timer drift ≤ ±2s) — all require browser-level verification
- **Unlocks:** S-01 (cycle UI verifiable e2e), S-02 (session lifecycle e2e), S-03 (mid-cycle prompt e2e), S-04 (task attribute UI e2e), S-05 (check-in UI e2e), S-06 (suggestion UI e2e), S-07 (recovery flow e2e). Every slice with user-visible behavior depends on this to be properly verified.
- **Prerequisites:** —
- **Parallel with:** F-01, S-07 (planning only — S-07 implementation requires F-02)
- **Blockers:** —
- **Unknowns:**
  - How to authenticate a test user programmatically with Neon Auth — direct API call to get a session cookie, or a test-only auth bypass route? Owner: implementer (downstream `/10x-plan`). Block: no — both approaches are well-documented patterns.
- **Risk:** Without this, every UI-facing slice ships without real e2e confidence. The risk of NOT doing this is compounding: each slice adds manual verification debt that cannot be automated retroactively without this foundation. The risk of doing it is minimal — Playwright setup is well-understood and the scope is bounded to "auth + one smoke test".
- **Status:** done

### F-03: Align Prisma config with Prisma 7 conventions

- **Outcome:** (foundation) `prisma.config.ts` matches the official Prisma 7 pattern: `import "dotenv/config"`, `env()` from `prisma/config`, relative schema/migrations paths; `DATABASE_URL_UNPOOLED` in `datasource.url` for CLI (migrate, db push, studio). Runtime stays on pooled `DATABASE_URL` via `@prisma/adapter-neon` in `src/server/db/index.ts`.
- **Change ID:** align-prisma-config
- **Linear:** [FLO-22](https://linear.app/flowstate-10xdev/issue/FLO-22)
- **GitHub:** [#33](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/33)
- **PRD refs:** —
- **Unlocks:** — (hygiene; reduces agent confusion when running Prisma CLI)
- **Prerequisites:** —
- **Parallel with:** any slice (no runtime dependency)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Minimal — config-only; verify `pnpm prisma migrate status` and `pnpm db:generate` after change.
- **Status:** proposed

### F-04: Impeccable design foundation

- **Outcome:** (foundation) `DESIGN.md` captures FlowState's visual system — color, typography, spacing, motion, and component patterns — produced via `/impeccable shape` discovery and `/impeccable document`, so downstream craft slices stay on-brand.
- **Change ID:** impeccable-design-foundation
- **Linear:** [FLO-25](https://linear.app/flowstate-10xdev/issue/FLO-25)
- **GitHub:** [#36](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/36)
- **PRD refs:** Secondary Success Criteria (active/completed split visually clear), NFR (200ms acknowledgement), proposed-FR-visual-design-system
- **Unlocks:** S-12 (wedge overlay polish), S-13 (home visual craft)
- **Prerequisites:** S-09
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Calm/minimal vs bolder personality — which direction fits the mindfulness wedge? Owner: user. Block: no.
  - Does `DESIGN.md` live at repo root or under `context/foundation/`? Owner: implementer. Block: no.
- **Risk:** Open-ended shape discovery stalls without a locked calm/focus product voice — scope discovery to wedge surfaces (home, task list, cycle transitions) only.
- **Status:** done

### F-05: Eisenhower effort task attributes (scorer v2 substrate)

- **Outcome:** (foundation) Task carries separate importance (1–3) and urgency (1–3), optional effort estimate in minutes, and commitment horizon (ASAP / this week / when possible) at create/edit; existing `weight` migrates to urgency with sensible defaults; `workType` unchanged; deterministic scorer v2 applies Eisenhower (urgency×importance), Pareto (importance when Focused), and Ockham (low-effort when Fading); rationale templates and S-23 expander factors updated.
- **Change ID:** eisenhower-effort-task-attributes
- **Linear:** [FLO-57](https://linear.app/flowstate-10xdev/issue/FLO-57)
- **GitHub:** [#78](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/78)
- **PRD refs:** FR-017, FR-018, FR-021, proposed-FR-task-importance, proposed-FR-commitment-horizon, proposed-FR-effort-estimate
- **Unlocks:** S-27 (daily standing + capacity), S-23 factor breakdown refresh after ship
- **Prerequisites:** S-04, S-06
- **Parallel with:** S-25, S-26, S-23
- **Blockers:** —
- **Unknowns:**
  - Migrate existing `weight` → urgency only, or copy to both axes? Owner: implementer. Block: no.
  - Cap effort range (e.g. 5–240 min) and treat null as unknown in scoring? Owner: implementer. Block: no.
  - Relabel weight UI as "urgency" or keep label with tooltip? Owner: user. Block: no.
- **Risk:** Three user-facing scales plus horizon may feel heavy at task creation — mitigate with defaults (importance 2, urgency 2, horizon when possible) and compact pickers; `weight` retained as legacy fallback in v1. Expand score 73/90 — **promote** (roadmap-expand 2026-06-09); merges importance-commitment-horizon + effort estimate from ideation batch.
- **Status:** done

## Slices

### S-01: First Pomodoro cycle on an existing task (north star)

- **Outcome:** user can pick one existing task, start a configurable work cycle bound to it, hear an audio signal and see a UI prompt at cycle end, and confirm the transition; refreshing the page mid-cycle returns to the same state.
- **Change ID:** first-pomodoro-cycle
- **Linear:** [FLO-8](https://linear.app/flowstate-10xdev/issue/FLO-8)
- **GitHub:** [#7](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/7) (closed)
- **PRD refs:** US-01, FR-009, FR-010, FR-012, FR-013, FR-014, NFR (timer drift ≤ ±2s on background tabs), NFR (crash/refresh recovery of cycle config and current cycle), NFR (200ms acknowledgement on actions)
- **Prerequisites:** F-01, F-02
- **Parallel with:** S-04, S-07
- **Blockers:** —
- **Unknowns:**
  - How is the cycle clock kept authoritative across background tabs and refreshes? Owner: implementer (downstream `/10x-plan`). Block: no — directional answer (server-recorded `cycle.startedAt` + client polls/derives) is sufficient at roadmap level.
- **Risk:** This is the validation milestone; if the cycle isn't trustworthy, no later slice has value. The biggest concrete failure mode is the NFR timer-drift requirement — naive client-only `setInterval` cannot satisfy ≤2s drift on background tabs. Sequenced here so the timing pattern is forced into discussion in `/10x-plan` before any session/check-in/scoring work compounds on top of it.
- **Status:** done — shipped via [PR #16](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/16) (merge `9eae096`, 2026-05-29)

### S-02: Full session with breaks and explicit end

- **Outcome:** user can run multiple consecutive cycles separated by short breaks, with a long break after every 4 cycles, end the session explicitly, and have the session also end after 4 hours of inactivity.
- **Change ID:** full-session-with-breaks
- **Linear:** [FLO-10](https://linear.app/flowstate-10xdev/issue/FLO-10)
- **GitHub:** [#10](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/10)
- **PRD refs:** US-01, FR-011, FR-014, FR-019, NFR (session retention 90 days)
- **Prerequisites:** S-01
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:**
  - What exactly counts as "user inactivity" for the 4h timeout — no cycle started, or no UI interaction at all? Owner: user (product call). Block: no — PRD §FR-019 already says "no cycle started", so the directional answer is locked; the unknown is purely confirmation.
- **Risk:** Layers session lifecycle on top of the working cycle. Sequenced after S-01 so the cycle's storage shape is settled before sessions stitch cycles together. Failure mode if rushed: a session model that fights the cycle model when implementation diverges from F-01's schema intent.
- **Status:** done — shipped via [PR #18](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/18) (2026-05-31)

### S-03: Mid-cycle completion prompt

- **Outcome:** user can mark a task done while a cycle is running and choose between picking the next task to keep the cycle going, or ending the cycle to take a break now; if no active tasks remain, the only option offered is "end cycle and take a break".
- **Change ID:** mid-cycle-completion-prompt
- **Linear:** [FLO-11](https://linear.app/flowstate-10xdev/issue/FLO-11)
- **GitHub:** [#11](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/11)
- **PRD refs:** FR-015, FR-009a (consistency — revert path must not silently bypass this prompt)
- **Prerequisites:** S-01
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This is a mindfulness control point — its absence regresses the wedge. Sequenced after S-01 so the cycle has a real "in-flight" state to interrupt. Smaller than S-02 but logically peer to it.
- **Status:** done — shipped via change `testing-active-slice-browser-proofs` (2026-06-06); e2e: `e2e/mid-cycle-completion.spec.ts`, `e2e/mid-cycle-last-task.spec.ts`

### S-04: Task attributes for scoring

- **Outcome:** user can set a work type (deep work / admin / reactive) and a weight (1–3) on a task at creation and during edit; both attributes are visible on the task in the active list.
- **Change ID:** task-attributes-for-scoring
- **Linear:** [FLO-9](https://linear.app/flowstate-10xdev/issue/FLO-9)
- **GitHub:** [#8](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/8)
- **PRD refs:** FR-005 (extended), FR-017, FR-018
- **Prerequisites:** F-01, F-02
- **Parallel with:** S-01, S-02, S-03 (no runtime coupling to the cycle; touches Task UI and `taskRouter` only)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Pure UI + schema-extension slice. The risk is a scope drift toward "tag systems" or "categories" — strictly bound by FR-017's three-value taxonomy and FR-018's 1–3 scale. Sequenced as a parallel track so the team can fan out under `top_blocker: time`.
- **Status:** done — shipped via [PR #17](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/17) (2026-05-31)

### S-05: End-of-cycle mindful check-in

- **Outcome:** at the end of every work cycle, before transitioning, user picks one of three energy states ("Focused" / "Steady" / "Fading"); the response is stored against the active session and visible in the immediate next-task suggestion (consumed by S-06).
- **Change ID:** end-of-cycle-checkin
- **Linear:** [FLO-12](https://linear.app/flowstate-10xdev/issue/FLO-12)
- **GitHub:** [#12](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/12)
- **PRD refs:** FR-020, NFR (mental-state data privacy — no third-party export, no cross-purpose use)
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-03, S-04
- **Blockers:** —
- **Unknowns:**
  - Should the check-in block the transition or be skippable? Owner: user (product call). Block: no — PRD §FR-020 phrasing ("user completes a mindful check-in") implies blocking; treat as non-skippable in MVP and revisit if check-in fatigue surfaces.
- **Risk:** Adds a UI step in the cycle-end transition that S-01 already owns. Risk is regression of S-01's confirm-flow ergonomics. Mitigation: check-in lives between work-end-prompt and break-start, not in front of the audio signal.
- **Test substrate:** Risk #7 integration via `testing-check-in-persistence`; UI gate via `testing-active-slice-browser-proofs` (e2e + `completeCheckIn` helper). Dedicated `check-in-gate.spec.ts` deferred per test-plan §6.6.
- **Status:** done — shipped via change `testing-active-slice-browser-proofs` (2026-06-06)

### S-06: Adaptive task suggestion with override

- **Outcome:** after the check-in, user sees a suggested next task with a one-line rationale ("deep work — fresh and uninterrupted" / "light admin — energy dipping after 4 cycles"); user can accept it with one click or override by selecting any other task; the override is recorded as a session-context input for the next suggestion.
- **Change ID:** adaptive-task-suggestion
- **Linear:** [FLO-13](https://linear.app/flowstate-10xdev/issue/FLO-13)
- **GitHub:** [#13](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/13)
- **PRD refs:** FR-021, FR-022, NFR (suggestion feedback ≥1s visible; ≤200ms acknowledgement)
- **Prerequisites:** S-04, S-05
- **Parallel with:** S-07
- **Blockers:** —
- **Unknowns:**
  - What are the exact weights and thresholds in the scoring formula? Owner: implementer (`/10x-plan` for first pass, calibrated post-launch). Block: no — directional behaviour from PRD §Business Logic is sufficient to ship a v1 deterministic formula. (Mirrors PRD §Open Questions Q1.)
- **Risk:** This is the wedge — the differentiating mechanic this product is built for. The biggest failure mode is over-engineering the formula before real data exists. Mitigation: ship a transparent deterministic v1 (per PRD §Non-Goals "no AI/ML scoring"), expose the rationale in the UI, treat coefficient calibration as post-MVP iteration.
- **Status:** done — shipped via [PR #31](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/31) (2026-06-07)

### S-07: Account recovery flow

- **Outcome:** user can request a password reset from the sign-in screen, follow the recovery email, set a new password, and sign in — without losing any existing tasks or session history.
- **Change ID:** account-recovery-flow
- **Linear:** [FLO-7](https://linear.app/flowstate-10xdev/issue/FLO-7)
- **GitHub:** [#9](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/9)
- **PRD refs:** FR-003a, NFR (auth must not lock a user out of their own data)
- **Prerequisites:** F-02
- **Parallel with:** F-01, S-01, S-02, S-03, S-04, S-05, S-06
- **Blockers:** —
- **Unknowns:**
  - Is Neon Auth's recovery flow already exposed end-to-end in the wired UI, or only available as an API surface? Owner: implementer (audit step in `/10x-plan`). Block: no — the audit IS the slice; if recovery is already wired, the slice closes with verification only; if not, it adds the missing UI surface.
- **Risk:** Standalone hardening slice. Risk is leaving a guardrail gap (forgotten password = permanent lockout) silently inherited from baseline. Sequenced as `ready` and parallel because it has zero coupling to the Pomodoro domain.
- **Status:** done — shipped via [PR #32](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/32) (2026-06-07)

### S-08: Guest trial and merge on login

- **Outcome:** visitor uses `/` without an account to manage tasks and run a work cycle (local persistence + refresh recovery); after sign-in or sign-up, guest data imports into the account; logged-in sessions use server data only (no guest blob reads).
- **Change ID:** guest-local-storage-merge
- **Linear:** [FLO-21](https://linear.app/flowstate-10xdev/issue/FLO-21)
- **GitHub:** [#30](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/30) (closed)
- **PRD refs:** NFR (no silent data loss), FR-004–FR-009 (trial path; account still required for durable cross-device use)
- **Prerequisites:** S-01, F-02
- **Parallel with:** S-02, S-07, S-09
- **Blockers:** —
- **Unknowns:** Neon Auth middleware configuration for optional session on `/` — owner: `/10x-implement` Phase 4. Block: no.
- **Risk:** Dual-store complexity and merge edge cases (title collision, active cycle). Plan: `context/changes/guest-local-storage-merge/plan.md`.
- **Status:** done — archived 2026-06-07 at `context/archive/2026-05-29-guest-local-storage-merge/`

### S-09: Optimistic task mutations (authenticated UX)

- **Outcome:** while logged in, task create / update / delete / status changes reflect in the UI immediately (optimistic cache updates via TanStack Query); on mutation failure the UI rolls back and shows an error — no silent loss. Optionally extends to cycle start/complete if scoped in `/10x-plan`.
- **Change ID:** optimistic-task-mutations
- **Linear:** [FLO-24](https://linear.app/flowstate-10xdev/issue/FLO-24)
- **GitHub:** [#35](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/35)
- **PRD refs:** NFR (200ms acknowledgement), FR-004, FR-005, FR-006, FR-007, FR-008, FR-009a
- **Prerequisites:** S-01, F-02
- **Parallel with:** S-02, S-03, S-04, S-07, S-08 (guest-local-storage-merge — recommended after or alongside S-08 so post-login UX matches guest perceived speed)
- **Blockers:** —
- **Unknowns:** Whether cycle mutations (`cycle.create`, `complete`, `interrupt`) belong in the same slice or a follow-up — owner: `/10x-plan`. Block: no — task list alone satisfies the slice outcome.
- **Risk:** Optimistic state can diverge from server truth on race or double-submit; mitigation: `onMutate` / rollback pattern, invalidate on settle, tests for failed mutation. Out of scope for `guest-local-storage-merge` (separate change-id per plan brief).
- **Status:** done — shipped via [PR #51](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/51) (2026-06-07)

### S-10: Google OAuth social login

- **Outcome:** user can sign in or sign up with their Google account in one click from the sign-in and sign-up pages; the OAuth flow is handled entirely by Neon Auth — no new backend routes or schema changes required.
- **Change ID:** google-oauth-provider
- **Linear:** [FLO-20](https://linear.app/flowstate-10xdev/issue/FLO-20)
- **GitHub:** [#20](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/20)
- **PRD refs:** FR-001, FR-002 (registration and login — OAuth is an additional mechanism)
- **Prerequisites:** F-02 (e2e verification of the OAuth flow in a browser)
- **Parallel with:** S-03, S-05, S-06, S-07, S-08, S-09 (no coupling to Pomodoro domain)
- **Blockers:** —
- **Unknowns:**
  - Whether the existing custom sign-in pages should use `authClient.signIn.social()` directly or switch to Neon Auth UI components (`NeonAuthUIProvider` + pre-built forms). Owner: implementer (`/10x-plan`). Block: no — both approaches are documented; direct `signIn.social()` call is simpler and preserves the existing custom UI.
- **Risk:** Minimal. Google OAuth is enabled by default with shared credentials in Neon Auth dev environments — no setup needed to test. Production requires a Google Cloud OAuth client + credentials in Neon Console + trusted domains. The main risk is a misconfigured redirect URI causing `redirect_uri_mismatch` in production; mitigation: document the exact URI pattern (`{NEON_AUTH_BASE_URL}/callback/google`) in the plan.
- **Implementation sketch:**
  1. Add a "Sign in with Google" button to `/auth/sign-in` and `/auth/sign-up` calling `authClient.signIn.social({ provider: "google", callbackURL: "/" })`.
  2. Verify the flow works in dev (shared credentials — no config needed).
  3. For production: create Google Cloud OAuth client, paste Client ID + Secret into Neon Console (branch → Auth), register redirect URI, add trusted domains.
  4. Add e2e test verifying the Google button renders and the OAuth redirect initiates.
- **Status:** done — shipped via [PR #21](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/21) (merge 2026-05-31)

### S-11: First-run path to the suggestion wedge

- **Outcome:** user on first visit follows a dismissible first-run flow teaching check-in → suggestion wedge; **plus** ongoing empty-list guidance when active tasks drop to zero again (not only "No active tasks"); **plus** inline one-line coach at first-ever check-in and first suggestion — subcopy only, no second blocking modal. *(Scope expanded P-204+P-205 / roadmap-expand UX batch 2026-06-07.)*
- **Change ID:** first-run-wedge-onboarding
- **Linear:** [FLO-26](https://linear.app/flowstate-10xdev/issue/FLO-26)
- **GitHub:** [#37](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/37)
- **PRD refs:** FR-003b, FR-004, FR-008, FR-009, FR-017, FR-018, FR-020, FR-021, FR-022, proposed-FR-first-run-guidance, proposed-FR-empty-state-guidance
- **Prerequisites:** S-06, S-08
- **Parallel with:** S-09, S-14
- **Blockers:** —
- **Unknowns:**
  - Should first-run trigger for guests only, authenticated empty accounts only, or both with different copy? Owner: user. Block: no.
  - Empty-list guide: hide after first completed cycle or show whenever active count is zero? Owner: user. Block: no.
  - First wedge coach: one combined tip or two sequential one-liners at check-in vs suggestion? Owner: user. Block: no.
  - Persist "seen" flags in localStorage, server profile, or session-only? Owner: implementer. Block: no.
- **Risk:** Blocking tours, naggy empty-state copy, or stacked coaching on check-in overlay can fight the mindfulness loop — coordinate modal timing with S-14 merge handoff.
- **Orchestrator doubts:** P-204 scored 69 / P-205 scored 52 — merged here intentionally; high confidence if coaching stays non-blocking subcopy.
- **Status:** done — shipped via [PR #65](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/65)

### S-12: Wedge transition surfaces polish

- **Outcome:** user completes a work cycle and moves through check-in and next-task suggestion inside a calm, cohesive designed flow — cycle-end, check-in, mid-cycle, and suggestion surfaces no longer feel like unstyled overlay defaults.
- **Change ID:** wedge-overlay-visual-polish
- **Linear:** [FLO-28](https://linear.app/flowstate-10xdev/issue/FLO-28)
- **GitHub:** [#38](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/38)
- **PRD refs:** FR-013, FR-015, FR-020, FR-021, FR-022, NFR (suggestion feedback ≥1s visible)
- **Prerequisites:** S-09, F-04
- **Parallel with:** S-13
- **Blockers:** —
- **Unknowns:**
  - How much motion is in scope given FR-016 (surprise animation) is parked? Owner: user. Block: no.
- **Risk:** Visual refactors break existing e2e selectors or cycle-gate behavior — preserve `data-testid` contracts and gate logic; visual-only diffs.
- **Status:** done — shipped via change `wedge-overlay-visual-polish` ([PR #96](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/96)). Lesson: merge `@theme` with parallel S-13 home tokens; shared `overlay-shell` keeps wedge surfaces consistent.

### S-13: Branded home shell and task-list clarity

- **Outcome:** user opens FlowState (guest or logged in) and sees a cohesive branded home — not T3 boilerplate or hardcoded gradients — with active and completed tasks visually distinct at a glance; when marking a task done, user sees a brief calm completion moment (sub-second restrained motion per FR-016 — not surprise arcade animation). *(Scope expanded P-110 / roadmap-expand 2026-06-07.)*
- **Change ID:** focus-home-visual-craft
- **Linear:** [FLO-29](https://linear.app/flowstate-10xdev/issue/FLO-29)
- **GitHub:** [#39](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/39)
- **PRD refs:** FR-008, FR-007, FR-016, US-01 (selected task visually highlighted), Secondary Success Criteria
- **Prerequisites:** S-09, F-04
- **Parallel with:** S-12
- **Blockers:** —
- **Unknowns:**
  - Include auth page visual alignment in this slice or defer to a follow-up? Owner: user. Block: no.
- **Risk:** Surface-area creep across layout metadata, header, guest banner, and task list — bound scope to `home-shell`, `globals.css` tokens, and task-list hierarchy only.
- **Orchestrator doubts:** Per-task completion delight only (P-110) — **reject** follow-up P-207 "session-end completion moment" as duplicate of S-17 closure; do not add third celebration surface.
- **Status:** done

### S-14: Auth narrative and guest-merge handoff

- **Outcome:** user on sign-in or sign-up pages understands FlowState's value (mindful Pomodoro + session-aware next-task picks with rationale), and after authenticating with guest data sees an explicit merge-success moment naming imported tasks and what unlocked (full sessions, check-ins, suggestions) instead of a silent import.
- **Change ID:** auth-merge-first-impression
- **Linear:** [FLO-27](https://linear.app/flowstate-10xdev/issue/FLO-27)
- **GitHub:** [#40](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/40)
- **PRD refs:** FR-001, FR-002, FR-003c, NFR (no silent data loss)
- **Prerequisites:** S-08
- **Parallel with:** S-09, S-11
- **Blockers:** —
- **Unknowns:**
  - Should merge confirmation be a modal, inline banner, or toast — and should it offer "review imported tasks" vs "continue"? Owner: user. Block: no.
  - Does auth narrative appear on both sign-in and sign-up, or sign-up only with sign-in staying minimal? Owner: user. Block: no.
- **Risk:** Marketing copy on auth pages can drift from actual guest vs logged-in feature parity if narrative oversells scoring or multi-cycle sessions; merge success UI may race with S-11 first-run — coordinate modal timing.
- **Status:** done

### S-15: Session kickoff suggestion

- **Outcome:** user can see a suggested task with one-line rationale when idle at session start or after a break with no pre-selected task — before manually picking what to focus on next; optionally accept a one-tap work-cycle duration preset matched to the selected task's work type (e.g. 45m deep / 25m admin / 15m reactive) — never auto-applied without explicit accept; kickoff preset chips remember last accepted or customized duration per work type across sessions (labeled "your usual", tap-to-apply only). *(Scope expanded P-103 + follow-up P-205 / roadmap-expand 2026-06-07.)*
- **Change ID:** session-kickoff-suggestion
- **Linear:** [FLO-30](https://linear.app/flowstate-10xdev/issue/FLO-30)
- **GitHub:** [#41](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/41)
- **PRD refs:** FR-021, FR-019, FR-009, FR-010, FR-017, proposed-FR-session-start-guidance
- **Prerequisites:** S-06
- **Parallel with:** S-09, S-11, S-16
- **Blockers:** —
- **Unknowns:**
  - Should kickoff fire only on first cycle of a new session, or also whenever the user clears focus and sits idle mid-session? Owner: user. Block: no.
  - Reuse `suggestion.next` with synthetic context (no check-in) or a dedicated kickoff scorer path? Owner: implementer. Block: no.
  - Default mapping deep/admin/reactive → 45/25/15 minutes OK, or user-configurable per type? Owner: user. Block: no.
  - Fire preset chip on every focus change or only when current duration differs from suggested preset? Owner: implementer. Block: no.
  - Store per-type defaults server-side for logged-in users and localStorage for guests (mirror S-20 audio preference)? Owner: implementer. Block: no.
  - Expose reset-to-PRD-defaults (45/25/15) in cycle picker or adjacent surface? Owner: user. Block: no.
- **Risk:** Kickoff suggestions may duplicate post-check-in picks if session state is not scoped to true idle/cold-start moments. Per-type remembered defaults can fight a one-off deep-work sprint if chips read as enforced settings. Expand score 71/100 — **promote**; follow-up P-205 merged (57/90 revise).
- **Orchestrator doubts:** Kickoff override acknowledgement belongs in S-19, not here — S-15 only supplies the kickoff suggestion surface.
- **Status:** done

### S-16: Mindful session wind-down nudge

- **Outcome:** user can receive an optional, dismissible prompt to end the session with a one-line rationale when check-in energy is Fading and session fatigue/interruption signals align — and override to continue working.
- **Change ID:** mindful-session-wind-down
- **Linear:** [FLO-31](https://linear.app/flowstate-10xdev/issue/FLO-31)
- **GitHub:** [#42](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/42)
- **PRD refs:** FR-020, FR-021, FR-019
- **Prerequisites:** S-05, S-06
- **Parallel with:** S-09, S-12, S-15
- **Blockers:** —
- **Unknowns:**
  - Which fatigue combo triggers the nudge — Fading alone, Fading + ≥4 cycles, or Fading + high interruptionCount? Owner: user. Block: no.
  - Should declining the nudge suppress it for the rest of the session or only until the next check-in? Owner: implementer. Block: no.
- **Risk:** An over-eager wind-down prompt feels preachy and fights FR-022 override culture if thresholds are too aggressive. Expand score 70/100 — **promote**.
- **Status:** done

### S-17: Session narrative summary (in-flow + closure)

- **Outcome:** user can see a lightweight session narrative — a live one-line summary during an active session (cycles done, tasks completed this session, latest check-in energy, optional per-cycle intention line), a calm closure line on session end, and on return after more than 8 hours away a single dismissible handoff line that composes last closure and, when present, the interrupted task's resume note from S-18 (max two clauses total) — without charts, trends, or analytics screens. *(Scope expanded P-107+P-108 + follow-up P-202 / roadmap-expand 2026-06-07.)*
- **Change ID:** session-narrative-summary
- **Linear:** [FLO-32](https://linear.app/flowstate-10xdev/issue/FLO-32)
- **GitHub:** [#43](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/43)
- **PRD refs:** FR-019, FR-020, FR-012, NFR (90-day session retention), Secondary Success Criteria (calm end-of-day feeling), proposed-FR-cycle-intention, proposed-FR-return-handoff
- **Prerequisites:** S-02, S-05, S-18
- **Parallel with:** S-09, S-12
- **Blockers:** S-18 resume data must exist before handoff can compose it — can ship closure/intention first, handoff+resume second.
- **Unknowns:**
  - Should timeout-ended sessions show the same closure overlay as user-initiated end? Owner: user. Block: no.
  - Guest mode: omit summary or derive from local guest session blob only? Owner: user. Block: no.
  - Ship closure UI before or after S-12 wedge overlay polish? Owner: implementer. Block: no.
  - Prompt cycle intention on every cycle start or only first cycle of session? Owner: user. Block: no.
  - 8h return threshold fixed or derived from last explicit session end vs last cycle? Owner: user. Block: no.
  - Store intention on Cycle entity vs ephemeral client-only for guest? Owner: implementer. Block: no.
  - When handoff has both open task and resume note, prefer resume note over task title? Owner: user. Block: no.
- **Risk:** Summary line plus suggestion rationale may feel redundant — show summary between cycles only (not overlapping suggestion card). Return handoff must not surface streaks, totals, or comparative stats (parked analytics). Follow-up P-202 merged (63/90 revise).
- **Orchestrator doubts:** Sequencing S-18 before or in parallel with S-17 handoff phase — do not block entire S-17 on S-18 if closure ships first.
- **Status:** proposed

### S-18: Task resume context note

- **Outcome:** user can attach or capture at interruption time a one-line "where I left off" note (~120 chars) when switching focus mid-cycle or when marking a task done mid-cycle and choosing the next task to continue the cycle (not when choosing "end cycle and break") — skippable at capture — and see it in the suggestion card **and** when manually re-selecting that task from the active list or focus picker; manual edit on task row remains supported. *(Scope expanded P-102 + follow-up P-203+P-204 / roadmap-expand 2026-06-07.)*
- **Change ID:** task-resume-context-note
- **Linear:** [FLO-33](https://linear.app/flowstate-10xdev/issue/FLO-33)
- **GitHub:** [#44](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/44)
- **PRD refs:** FR-019, FR-021, FR-022, proposed-FR-task-resume-context, proposed-FR-interruption-context
- **Prerequisites:** S-06, S-03
- **Parallel with:** S-09, S-15, S-17
- **Blockers:** —
- **Unknowns:**
  - Is a single optional resume line enough, or should the note auto-clear when the task is marked done? Owner: user. Block: no.
  - Should resume text influence deterministic scoring or only augment the rationale display? Owner: implementer. Block: no.
  - Reuse `Task.resumeNote` vs separate interruption snapshot cleared on completion? Owner: implementer. Block: no.
  - On mid-cycle completion path, attach note to the task being left behind or the newly selected next task? Owner: user. Block: no.
  - Manual refocus surface: ephemeral toast, focus-picker subtitle, or expanded row on select? Owner: user. Block: no.
  - Show resume on manual re-select during active cycle or only when idle? Owner: user. Block: no.
- **Risk:** A free-form notes field can drift into generic CRUD unless display is gated to wedge surfaces and length is strictly bounded (~120 chars). Mid-cycle completion capture adds transition fatigue if not gated to "pick next task" path only. Follow-up P-203+P-204 merged (61+59/90 revise).
- **Orchestrator doubts:** Resolve schema choice (`resumeNote` vs snapshot) in `/10x-plan` before implementation — blocks clean S-17 handoff composition.
- **Status:** proposed

### S-19: Suggestion override acknowledgement

- **Outcome:** user can override the suggested next task (post-check-in **and** idle kickoff suggestion from S-15) and see the same brief validating acknowledgement line — autonomy preserved, override recorded for session context, no guilt or patronizing copy. *(Follow-up P-201 merged / roadmap-expand 2026-06-07.)*
- **Change ID:** suggestion-override-acknowledgement
- **Linear:** [FLO-34](https://linear.app/flowstate-10xdev/issue/FLO-34)
- **GitHub:** [#45](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/45)
- **PRD refs:** FR-022, FR-021, FR-019, proposed-FR-session-start-guidance
- **Prerequisites:** S-06
- **Parallel with:** S-15, S-16, S-09
- **Blockers:** Kickoff-surface acknowledgement requires S-15 shipped — post-check-in ack can ship with S-19 alone.
- **Unknowns:**
  - Always show acknowledgement vs only when override diverges from top suggestion by work type? Owner: user. Block: no.
  - Does override increment `interruptionCount` or a separate `overrideCount` for scoring? Owner: implementer. Block: no.
  - Reuse exact copy component for kickoff vs post-check-in, or kickoff-specific neutral variant? Owner: user. Block: no.
  - Suppress second acknowledgement if user overrides kickoff then immediately hits check-in override in same transition beat? Owner: implementer. Block: no.
  - Does kickoff override feed the same session-context signal as post-check-in override? Owner: implementer. Block: no.
- **Risk:** Patronizing copy ("you know best!") erodes calm tone — one neutral line max. Duplicate ack on back-to-back transitions feels naggy. Expand score 78/90 — **promote**; follow-up P-201 merged (67/90 revise).
- **Status:** done — shipped via [PR #67](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/67) (2026-06-08). Post-check-in ack only; kickoff ack deferred to S-15.

### S-20: Persistent quiet cycle audio

- **Outcome:** user can mute or soften the in-browser cycle-end chime with a preference that persists across sessions (server profile when logged in, localStorage for guests); the visual transition prompt remains the authoritative mindful signal; when audio is muted/softened and the tab was backgrounded at cycle end, an optional single calm title or favicon pulse may fire until the user returns (work-end at minimum — not native push). *(Follow-up P-208 merged into acceptance / roadmap-expand 2026-06-07.)*
- **Change ID:** persistent-quiet-cycle-audio
- **Linear:** [FLO-35](https://linear.app/flowstate-10xdev/issue/FLO-35)
- **GitHub:** [#46](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/46)
- **PRD refs:** FR-013, FR-014, NFR (200ms acknowledgement)
- **Prerequisites:** S-01
- **Parallel with:** S-09, S-12
- **Blockers:** —
- **Unknowns:**
  - Binary mute vs volume slider? Owner: user. Block: no.
  - Store preference server-side for logged-in users and localStorage for guests? Owner: implementer. Block: no.
  - Title/favicon pulse on break-end as well as work-end, or work-end only? Owner: user. Block: no.
  - Respect `prefers-reduced-motion` for favicon animation? Owner: implementer. Block: no.
- **Risk:** Silent-only users may miss transitions if visual prompt is off-tab — **S-22 is the primary fix**; title/favicon pulse is a lightweight adjunct only. Aggressive title flashing feels alarming, not calm.
- **Orchestrator doubts:** Do not ship mute without either S-22 catch-up or documented title-pulse acceptance test. Follow-up P-208 merged (40/90 revise) — not a standalone slice.
- **Status:** done — shipped via [PR #71](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/71) (2026-06-08)
- **Known regression:** [B-01](#b-01-cycle-end-audio-toggle-unresponsive) — toggle buttons do not switch on click (production, reported 2026-06-08)

### S-21: Mindful transition copy (break + work re-entry)

- **Outcome:** user can see calm, skippable one-line prompts at break-cycle start and when confirming break → work transition — paired mindful beats that never block timer start or duplicate check-in/suggestion gates; break→work re-entry copy is chosen from a fixed library keyed to the last check-in energy (Focused / Steady / Fading), with neutral fallback when no prior check-in exists. *(Follow-up P-206 merged / roadmap-expand 2026-06-07.)*
- **Change ID:** mindful-transition-copy
- **Linear:** [FLO-36](https://linear.app/flowstate-10xdev/issue/FLO-36)
- **GitHub:** [#47](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/47)
- **PRD refs:** FR-014, FR-011, FR-012, FR-020
- **Prerequisites:** S-02, S-05, S-12
- **Parallel with:** S-16, S-19
- **Blockers:** —
- **Unknowns:**
  - Fixed copy library vs rotating lines keyed to short vs long break? Owner: user. Block: no.
  - Same component voice for break and re-entry, or distinct copy tone? Owner: user. Block: no.
  - Should guests see shorter variant or omit entirely? Owner: user. Block: no.
  - Rotate lines within energy bucket or one fixed line per energy for MVP? Owner: user. Block: no.
  - Fading re-entry copy must not duplicate S-16 wind-down preachiness — how to keep invitational? Owner: user. Block: no.
- **Risk:** Interstitial fatigue if shown alongside check-in + suggestion on the same transition — show re-entry line only when no check-in gate is active. Fading-toned re-entry can overlap S-16 wind-down if copy is not carefully separated. Follow-up P-206 merged (53/90 revise).
- **Orchestrator doubts:** Energy-keyed copy is a variant of S-21, not a new slice — share copy module with S-19/S-17 tone contract when F-04 lands.
- **Status:** proposed

### S-22: Background tab return catch-up

- **Outcome:** user returning to a backgrounded tab after a cycle ended while away sees a calm catch-up surface — what finished, how long ago, and the single next action (check-in gate, break confirm, or suggestion accept) — instead of landing silently on a gate they may have missed.
- **Change ID:** background-tab-return-catchup
- **Linear:** [FLO-37](https://linear.app/flowstate-10xdev/issue/FLO-37)
- **GitHub:** [#48](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/48)
- **PRD refs:** FR-013, FR-014, FR-020, FR-021, NFR (timer drift ≤ ±2s), NFR (crash/refresh recovery)
- **Prerequisites:** S-01, S-05, S-06
- **Parallel with:** S-12, S-20, S-09
- **Blockers:** —
- **Unknowns:**
  - After missed chime, replay audio, visual-only catch-up, or respect S-20 mute? Owner: user. Block: no.
  - Show elapsed away time or only pending transition state? Owner: implementer. Block: no.
  - Wrap all post-work gates or only first pending gate? Owner: implementer. Block: no.
- **Risk:** `visibilitychange` already fires completion — duplicate overlays if not keyed to one-shot `endedWhileHidden` cleared on first interaction.
- **Orchestrator doubts:** Overlap with S-12 polish and S-20 mute paths — coordinate in `/10x-plan`. Expand score 67/100 — **promote**; high user value, medium implementation risk.
- **Status:** done — shipped via [PR #68](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/68) (2026-06-08)

### S-23: Suggestion rationale expander

- **Outcome:** user can tap "Why this?" on the next-task suggestion card and see a calm, deterministic breakdown of factors (energy fit, interruptions, cycles completed, time of day, last override) — without leaving the wedge overlay or opening analytics.
- **Change ID:** suggestion-rationale-expander
- **Linear:** [FLO-38](https://linear.app/flowstate-10xdev/issue/FLO-38)
- **GitHub:** [#49](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/49)
- **PRD refs:** FR-021, FR-022, FR-019, NFR (suggestion feedback ≥1s visible)
- **Prerequisites:** S-06
- **Parallel with:** S-12, S-15, S-17
- **Blockers:** —
- **Unknowns:**
  - Full ranked factor list or top 2–3 only? Owner: implementer. Block: no.
  - Include S-15 kickoff and break-idle picks? Owner: user. Block: no.
  - Guest mode: same templates from local session blob? Owner: implementer. Block: no.
- **Risk:** Factor copy overwhelms if every signal shown equally — dominant factor + "also considered" chips; never stack on S-17 narrative line.
- **Orchestrator doubts:** Must add trust beyond one-line rationale, not duplicate it; resist scoring-debugger creep. Expand score 67/100 — **promote**.
- **Status:** done — shipped via [PR #89](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/89) (2026-06-10)

### S-24: Cycle pause and resume

- **Outcome:** user can temporarily pause a running work or break cycle and resume later with remaining time preserved — without ending the cycle, without marking INTERRUPTED, and without incrementing session `interruptionCount`.
- **Change ID:** cycle-pause-resume
- **Linear:** [FLO-39](https://linear.app/flowstate-10xdev/issue/FLO-39)
- **GitHub:** [#50](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/50)
- **PRD refs:** FR-012, FR-019, US-01, NFR (crash/refresh recovery), NFR (timer drift ≤ ±2s)
- **Prerequisites:** S-01, S-02
- **Parallel with:** S-09, S-22
- **Blockers:** —
- **Unknowns:**
  - Does pause time count toward 4h session inactivity (FR-019)? Owner: user. Block: **yes before promote to ready**.
  - Pause unlimited or capped (auto-resume after N minutes)? Owner: user. Block: no.
  - Server-side `PAUSED` + `remainingMs` vs client-only timer freeze? Owner: implementer. Block: no.
- **Risk:** PAUSED semantics touch Prisma enum, tRPC, guest blob, timer worker, refresh recovery — half-implemented pause worse than today's Interrupt.
- **Orchestrator doubts:** PRD gap on pause vs interrupt; largest scope in UX batch — **low promote confidence** until inactivity + interruptionCount rules locked. Expand score 66/100 — **revise**.
- **Status:** proposed

### S-25: Pre-suggestion readiness gate

- **Outcome:** at session kickoff and before the post-check-in next-task suggestion card, user declares readiness using the same Focused / Steady / Fading control as S-05 — skippable with Steady default — and the declared energy feeds `suggestion.next` / kickoff scorer instead of the current hardcoded STEADY path.
- **Change ID:** pre-suggestion-readiness
- **Linear:** [FLO-58](https://linear.app/flowstate-10xdev/issue/FLO-58)
- **GitHub:** [#79](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/79)
- **PRD refs:** FR-020, FR-021, FR-019, proposed-FR-pre-suggestion-readiness
- **Prerequisites:** S-05, S-06, S-15
- **Parallel with:** S-26, S-23, F-05
- **Blockers:** —
- **Unknowns:**
  - Reuse exact check-in overlay component vs compact inline chips on suggestion surface? Owner: implementer. Block: no.
  - Does skipped readiness persist as STEADY for session context only or also write a CheckIn row? Owner: implementer. Block: no.
- **Risk:** Second energy gate on the same transition beat as check-in — show pre-suggestion readiness only when no check-in gate is active; coordinate with Open Roadmap Q2. Expand score 80/90 — **promote** (roadmap-expand 2026-06-09).
- **Status:** done — shipped via [PR #88](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/88) (2026-06-10)

### S-26: Manual task priority order (drag-and-drop)

- **Outcome:** user drag-reorders active tasks in the task list; order persists across refresh and guest merge (`sortOrder` on Task); post-check-in and kickoff suggestions use manual order as the deterministic tie-breaker when scorer scores tie — not as the primary ranking signal.
- **Change ID:** task-manual-priority-order
- **Linear:** [FLO-59](https://linear.app/flowstate-10xdev/issue/FLO-59)
- **GitHub:** [#81](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/81)
- **PRD refs:** FR-021, FR-022, FR-005, NFR (200ms acknowledgement)
- **Prerequisites:** S-04, S-06, S-09
- **Parallel with:** S-25, S-23
- **Blockers:** —
- **Unknowns:**
  - Manual order on active tasks only, or also completed list? Owner: user. Block: no — active only in v1.
  - Guest merge: preserve relative sortOrder on import? Owner: implementer. Block: no.
  - Drag handle vs full-row drag for touch? Owner: implementer. Block: no.
- **Risk:** Optimistic reorder + suggester cache invalidation may desync list order from accepted suggestion on race — mirror S-09 rollback pattern. Expand score 65/90 — **promote**; **user priority: high** — first `/10x-plan` target in batch 2026-06-09.
- **Status:** done — shipped via [PR #83](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/83) (2026-06-09)

### S-27: Daily standing tasks and focus-hours capacity plan

- **Outcome:** user marks tasks as daily standing work, sets today's available focus hours once per local day, and adds optional per-task minute estimates (or uses F-05 effort field); at session kickoff and post-check-in, standing tasks not yet done today roll into the active suggestion pool and the suggester prefers tasks that fit remaining capacity — rationale cites fit (e.g. "fits ~25 min left today"). **Scope guard:** boolean daily flag + local-day reset only — no RRULE, no weekly/monthly schedules, no habit dashboard.
- **Change ID:** daily-standing-tasks-capacity-plan
- **Linear:** [FLO-60](https://linear.app/flowstate-10xdev/issue/FLO-60)
- **GitHub:** [#80](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/80)
- **PRD refs:** FR-021, FR-022, FR-019, proposed-FR-daily-standing-tasks, proposed-FR-daily-focus-budget
- **Prerequisites:** F-05, S-06, S-15
- **Parallel with:** S-25, S-26
- **Blockers:** —
- **Unknowns:**
  - Store day plan on Session vs per-user per-local-date record? Owner: implementer. Block: no.
  - Completing daily standing task: archive until midnight vs `todayDone` flag? Owner: user. Block: no.
  - Decrement capacity on cycle complete minutes vs task-done only? Owner: implementer. Block: no.
- **Risk:** Daily reset semantics can drift into full recurring-product scope — bound to suggestion pool only; no auto-spawn at midnight without user opening app. Expand score 64/90 — **revise then promote**; safe reframe of parked P-109.
- **Status:** proposed

## Follow-up scope merges (batch 3)

> `/10x-roadmap-expand` task-planning pass 2026-06-09 — **Commit** synced to Linear + GitHub.


| Proposal                               | Score | Action                           | Target                              |
| -------------------------------------- | ----- | -------------------------------- | ----------------------------------- |
| P-101 Pre-suggestion readiness         | 80    | promote                          | S-25                                |
| P-102 Eisenhower + effort foundation   | 73    | promote                          | F-05                                |
| P-103 Manual task priority (drag-drop) | 65    | promote (**high user priority**) | S-26                                |
| P-104 Daily standing + capacity        | 64    | promote (revise)                 | S-27                                |
| P-105 Importance & commitment horizon  | 66    | merge                            | F-05                                |
| P-106 Task effort & focus window       | 65    | merge                            | F-05 (effort) + S-27 (focus budget) |
| P-107 Today focus mega-bundle          | 61    | **reject** → Future ideas        | —                                   |


**Recommended `/10x-plan` order:** `S-26` (drag-drop, high priority) → `F-05` → `S-25` ∥ `S-23` → `S-27`.

## Follow-up scope merges (batch 2)

> `/10x-roadmap-expand` follow-up pass 2026-06-07 — no new roadmap IDs; evaluator merged P-201…P-208 into existing slices. **Commit** synced to Linear issue bodies.


| Proposal                                  | Score | Action                  | Target slice              |
| ----------------------------------------- | ----- | ----------------------- | ------------------------- |
| P-201 Kickoff override acknowledgement    | 67    | merge                   | S-19                      |
| P-202 Return handoff + resume context     | 63    | merge                   | S-17 (+ prereq S-18)      |
| P-203 Manual refocus resume surface       | 61    | merge                   | S-18                      |
| P-204 Mid-cycle completion resume capture | 59    | merge                   | S-18 (+ prereq S-03)      |
| P-205 Persist work-type cycle defaults    | 57    | merge                   | S-15                      |
| P-206 Energy-keyed re-entry copy          | 53    | merge                   | S-21 (+ prereq S-05)      |
| P-207 Session-end completion moment       | 45    | **reject** → Parked     | —                         |
| P-208 Muted background-tab cue            | 40    | merge (acceptance note) | S-20; primary path = S-22 |


**Open sequencing doubts (orchestrator):**

1. Ship S-19 post-check-in ack before S-15 kickoff ack, or both in one plan?
2. S-17 closure can ship before S-18 if handoff+resume phase is explicitly phased.
3. S-20 mute should not ship without S-22 catch-up or title-pulse e2e — pick one path in `/10x-plan`.
4. Calm voice copy module (F-04 downstream) should unify S-19, S-21, S-17 lines — defer copy finalization until `DESIGN.md`.

## Backlog Handoff


| Roadmap ID | Change ID                              | Linear | GitHub | Suggested issue title                                                          | Ready for `/10x-plan` | Notes                                                                      |
| ---------- | -------------------------------------- | ------ | ------ | ------------------------------------------------------------------------------ | --------------------- | -------------------------------------------------------------------------- |
| F-01       | session-domain-model                   | FLO-6  | #5     | FlowState — wire Pomodoro session domain (Task attrs + Session/Cycle/CheckIn)  | yes                   | Implemented; GitHub closed, Linear Done                                    |
| F-02       | e2e-test-infra                         | FLO-14 | #6     | FlowState — Playwright e2e test infrastructure with authenticated test user    | yes                   | Run `/10x-plan e2e-test-infra`; gates all UI-facing slices                 |
| S-01       | first-pomodoro-cycle                   | FLO-8  | #7     | FlowState — first Pomodoro cycle on a selected task (north star)               | no                    | Unblocks once F-01 + F-02 land; this is the validation milestone           |
| S-02       | full-session-with-breaks               | FLO-10 | #10    | FlowState — multi-cycle session with short/long breaks and explicit end        | no                    | Unblocks after S-01                                                        |
| S-03       | mid-cycle-completion-prompt            | FLO-11 | #11    | FlowState — mid-cycle completion prompt (continue or break)                    | no                    | Unblocks after S-01; can run parallel to S-02                              |
| S-04       | task-attributes-for-scoring            | FLO-9  | #8     | FlowState — task work-type and weight attributes                               | no                    | Unblocks once F-01 + F-02 land; runs parallel to S-01/S-02/S-03            |
| S-05       | end-of-cycle-checkin                   | FLO-12 | #12    | FlowState — end-of-cycle mindful check-in                                      | no                    | Unblocks after S-01                                                        |
| S-06       | adaptive-task-suggestion               | FLO-13 | #13    | FlowState — adaptive next-task suggestion with override (wedge)                | yes                   | Shipped 2026-06-07 via PR #31; GitHub closed, Linear Done                  |
| S-07       | account-recovery-flow                  | FLO-7  | #9     | FlowState — verify and expose password recovery flow                           | no                    | Requires F-02 for browser-based verification of recovery flow              |
| S-08       | guest-local-storage-merge              | FLO-21 | #30    | FlowState — guest trial (localStorage) and merge on login                      | yes                   | Shipped 2026-06-07; GitHub closed, Linear Done                             |
| S-09       | optimistic-task-mutations              | FLO-24 | #35    | FlowState — optimistic TanStack Query updates for authenticated task mutations | yes                   | Shipped 2026-06-07 via PR #51; GitHub closed, Linear Done                  |
| S-10       | google-oauth-provider                  | FLO-20 | #20    | FlowState — Google OAuth social login (one-click sign-in)                      | yes                   | Neon Auth supports Google OAuth natively; minimal UI addition              |
| F-03       | align-prisma-config                    | FLO-22 | #33    | FlowState — align prisma.config.ts with Prisma 7 conventions                   | yes                   | Run `/10x-plan align-prisma-config`; config-only, no user-visible behavior |
| F-04       | impeccable-design-foundation           | FLO-25 | #36    | FlowState — Impeccable design foundation (DESIGN.md via shape + document)      | no                    | Unblocks after S-09; gates S-12 and S-13 craft slices                      |
| S-11       | first-run-wedge-onboarding             | FLO-26 | #37    | FlowState — first-run onboarding + empty-list guide + first wedge coach        | yes                   | P-204+P-205 merged; coordinate with S-14                                   |
| S-12       | wedge-overlay-visual-polish            | FLO-28 | #38    | FlowState — wedge overlay visual polish (check-in, suggestion, cycle-end)      | no                    | Requires F-04 + S-09; `/impeccable craft`/`polish`                         |
| S-13       | focus-home-visual-craft                | FLO-29 | #39    | FlowState — branded home shell, task-list clarity, calm completion delight     | no                    | Requires F-04 + S-09; includes FR-016 subset (P-110)                       |
| S-14       | auth-merge-first-impression            | FLO-27 | #40    | FlowState — auth narrative and guest-merge success handoff                     | yes                   | Coordinate with S-11 first-run timing                                      |
| S-15       | session-kickoff-suggestion             | FLO-30 | #41    | FlowState — kickoff suggestion + presets + per-type memory                     | yes                   | P-103+P-205 merged; kickoff ack → S-19                                     |
| S-16       | mindful-session-wind-down              | FLO-31 | #42    | FlowState — mindful session wind-down nudge                                    | yes                   | Expand score 70/100 promote; deterministic mindfulness guardrail           |
| S-17       | session-narrative-summary              | FLO-32 | #43    | FlowState — narrative + handoff composing S-18 resume                          | no                    | P-107+P-108+P-202; prereq S-18 for handoff phase                           |
| S-18       | task-resume-context-note               | FLO-33 | #44    | FlowState — capture + manual refocus + mid-cycle path                          | no                    | P-102+P-203+P-204; schema Unknown blocks S-17 handoff                      |
| S-19       | suggestion-override-acknowledgement    | FLO-34 | #45    | FlowState — override ack (check-in + kickoff)                                  | yes                   | P-101+P-201 merged 78/67; kickoff needs S-15                               |
| S-20       | persistent-quiet-cycle-audio           | FLO-35 | #46    | FlowState — mute/soften + optional title pulse                                 | yes                   | P-208 in acceptance; **require** S-22 or pulse e2e                         |
| S-21       | mindful-transition-copy                | FLO-36 | #47    | FlowState — transition copy + energy-keyed re-entry                            | no                    | P-105+P-106+P-206; requires S-12, S-05                                     |
| S-22       | background-tab-return-catchup          | FLO-37 | #48    | FlowState — background tab return catch-up                                     | yes                   | P-201 promote 67; pair with S-20 mute                                      |
| S-23       | suggestion-rationale-expander          | FLO-38 | #49    | FlowState — suggestion "Why this?" expander                                    | yes                   | P-202 promote 67                                                           |
| S-24       | cycle-pause-resume                     | FLO-39 | #50    | FlowState — cycle pause/resume without scoring penalty                         | no                    | P-203 revise 66; product gate on FR-019 pause semantics                    |
| B-01       | fix-cycle-audio-toggle                 | FLO-53 | #72    | Bug — cycle end audio toggle unresponsive                                      | yes                   | S-20 regression; production 2026-06-08                                     |
| B-02       | fix-task-title-multiline-edit          | FLO-54 | #73    | Bug — task title edit truncates long names                                     | yes                   | Shipped 2026-06-10 via PR #85; GitHub closed, Linear Done                  |
| B-03       | fix-cycle-start-interrupt-optimistic   | FLO-55 | #74    | Bug — Start/Interrupt hang without optimistic UI                               | yes                   | Shipped 2026-06-10 via PR #85 + #86; GitHub closed, Linear Done            |
| B-04       | fix-cycle-complete-flash-after-checkin | FLO-56 | #75    | Bug — Cycle Complete flashes after check-in                                    | yes                   | S-05/S-06; state machine gap                                               |
| F-05       | eisenhower-effort-task-attributes      | FLO-57 | #78    | FlowState — Eisenhower task attributes + scorer v2                             | no                    | Substrate for S-27; refresh S-23 factors after ship                        |
| S-25       | pre-suggestion-readiness               | FLO-58 | #79    | FlowState — pre-suggestion readiness gate                                      | yes                   | Fixes S-15 hardcoded STEADY                                                |
| S-26       | task-manual-priority-order             | FLO-59 | #81    | FlowState — drag-reorder task priority                                         | yes                   | **High user priority** — plan first                                        |
| S-27       | daily-standing-tasks-capacity-plan     | FLO-60 | #80    | FlowState — daily standing + focus budget                                      | no                    | Requires F-05; anti-RRULE guard                                            |


## Bugs

### B-01: Cycle end audio toggle unresponsive

- **Outcome:** user can click **Normal**, **Soft**, or **Muted** on the timer panel **Cycle end audio** control and see the selection update immediately; preference persists across refresh (localStorage for guests, server profile when logged in); cycle-end chime respects the chosen mode.
- **Change ID:** fix-cycle-audio-toggle
- **Linear:** [FLO-53](https://linear.app/flowstate-10xdev/issue/FLO-53)
- **GitHub:** [#72](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/72)
- **PRD refs:** FR-013, FR-014
- **Prerequisites:** S-20 (shipped — regression)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Server-sync effect in `useCycleEndAudioPreference` may overwrite optimistic UI before mutation completes; e2e may have seeded preference without exercising live toggle.
- **Status:** done — shipped via [PR #77](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/77) (2026-06-09)

### B-02: Task title edit truncates long names

- **Outcome:** user editing a task title sees a multi-line text control that wraps long names across several lines (auto-resize or scroll) so the full title is readable and editable — not a single-line input that clips overflow.
- **Change ID:** fix-task-title-multiline-edit
- **Linear:** [FLO-54](https://linear.app/flowstate-10xdev/issue/FLO-54)
- **GitHub:** [#73](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/73)
- **PRD refs:** FR-005, FR-008
- **Prerequisites:** —
- **Parallel with:** B-01
- **Blockers:** —
- **Unknowns:** Enter key — newline vs save (document in implement plan).
- **Risk:** Multi-line titles in list display may need matching wrap/read mode when not editing.
- **Status:** done — archived 2026-06-10 → `context/archive/2026-06-09-fix-title-multiline-and-cycle-optimistic/` ([PR #85](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/85)).

### B-03: Cycle start / interrupt not optimistic

- **Outcome:** logged-in user clicking **Start Cycle** or **Interrupt** sees the timer panel update within 200ms — running countdown on start, idle/ready on interrupt — without waiting for `sessions.getOrCreateActive` / `cycles.create` / `cycles.interrupt` to complete; server sync runs async with rollback on failure (mirror S-09 task mutation contract).
- **Change ID:** fix-cycle-start-interrupt-optimistic
- **Linear:** [FLO-55](https://linear.app/flowstate-10xdev/issue/FLO-55)
- **GitHub:** [#74](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/74)
- **PRD refs:** NFR (200ms acknowledgement), FR-009, FR-012
- **Prerequisites:** S-09 (optimistic pattern shipped for tasks)
- **Parallel with:** B-01, B-02
- **Blockers:** —
- **Unknowns:** Full S-27 wedge optimistic scope (check-in, suggestion accept) vs fix Start/Interrupt only in B-03 — owner: `/10x-plan`. Block: no.
- **Risk:** Optimistic cycle state diverges on double-submit or server rejection; guest path already local-first — parity testing required.
- **Status:** done — archived 2026-06-10 → `context/archive/2026-06-09-fix-title-multiline-and-cycle-optimistic/` ([PR #85](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/85), [PR #86](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/86)).

### B-04: Cycle Complete overlay flashes after check-in

- **Outcome:** after submitting energy at cycle end, user never sees the stale **Cycle Complete!** modal again — transition proceeds immediately to break start, suggestion loading, or wind-down without a multi-second freeze on the old overlay.
- **Change ID:** fix-cycle-complete-flash-after-checkin
- **Linear:** [FLO-56](https://linear.app/flowstate-10xdev/issue/FLO-56)
- **GitHub:** [#75](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/75)
- **PRD refs:** FR-020, FR-021, NFR (200ms acknowledgement)
- **Prerequisites:** S-05, S-06
- **Parallel with:** B-03
- **Blockers:** —
- **Unknowns:** Show explicit post-check-in loading shell vs hide overlay via `postCheckInTransitioning` flag — owner: `/10x-plan`. Block: no.
- **Risk:** `awaitingCheckIn=false` + `state=completed` gap is the flash window; wind-down branch must stay excluded.
- **Status:** done — shipped via [PR #82](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/82) (2026-06-09)

## Research requirements 

Items tagged `needs-research` are non-trivial — they require external research (`research.md` generated by `/10x-research` + exa.ai / Context7) **before** `/10x-plan`. Do not plan these without evidence.


| Roadmap ID | Change ID                | Priority  | Research targets                                                                                                                                         |
| ---------- | ------------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-02       | e2e-test-infra           | 🔴 High   | Playwright auth strategies with Neon Auth (beta); Next.js 16 + Playwright integration patterns                                                           |
| S-01       | first-pomodoro-cycle     | 🔴 High   | Browser timer throttling (Page Visibility API, Web Workers); Web Audio autoplay policies; server-authoritative timer patterns for crash/refresh recovery |
| S-06       | adaptive-task-suggestion | 🟡 Medium | Weighted scoring / task-prioritization algorithms; Pomodoro technique research on task-energy matching; deterministic formula design patterns            |
| S-07       | account-recovery-flow    | 🟢 Low    | Neon Auth password reset/recovery API surface (quick lookup)                                                                                             |


| S-15 | session-kickoff-suggestion | 🟡 Medium | Kickoff scoring contract without check-in; reuse vs fork of `suggestion.next` API |
| S-24 | cycle-pause-resume | 🟡 Medium | PAUSED cycle state + guest blob + refresh recovery; pause vs inactivity timeout semantics |
| F-05 | eisenhower-effort-task-attributes | 🟡 Medium | Eisenhower/Pareto deterministic scoring patterns; weight→urgency migration; horizon coefficient calibration |
| S-26 | task-manual-priority-order | 🟢 Low | dnd-kit vs native HTML DnD with optimistic reorder; guest merge sortOrder |
| S-27 | daily-standing-tasks-capacity-plan | 🟡 Medium | Local-day reset semantics; capacity decrement model; anti-RRULE scope boundary |

**Not requiring research** (straightforward implementation on existing stack): F-03, F-04, S-02, S-03, S-04, S-05, S-09, S-10, S-11, S-12, S-13, S-14, S-16, S-17, S-18, S-19, S-20, S-21, S-22, S-23, S-25.

## Open Roadmap Questions

1. **What are the exact weights and thresholds in the scoring formula?** — Owner: implementer (first iteration, calibrate after real usage). Block: S-06 only at calibration step, not at planning. Mirrors PRD §Open Questions Q1; surfaced here so it's not lost to `/10x-plan` as a silent scope grab.
2. **Which transition surfaces may fire on the same beat?** — Check-in gate, suggestion card, S-21 copy, S-17 narrative, S-19 ack — orchestrator rule: at most one interstitial line + one gate per transition; owner: implementer in `/10x-plan` for S-12/S-21/S-19 coordination. Block: no for individual slices; **yes** for polish pass.
3. `**Task.resumeNote` vs interruption snapshot?** — Owner: implementer. Block: **S-18 and S-17 handoff phase**.
4. `**weight` migration vs dual-axis defaults?** — Owner: implementer. Block: **F-05** before S-27 capacity scoring.
5. **Drag-drop library and touch targets?** — Owner: implementer. Block: no for S-26 planning.

## Future ideas

> Consciously deferred from `/10x-roadmap-expand` 2026-06-09 — preserve analysis for the next expand or unpark review. Not scheduled slices; revisit only if they strengthen FR-021 wedge without violating PRD Non-Goals.


| Idea                                                                          | Why deferred                                                                              | Revisit when                                                               |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Today focus mega-bundle** (deadline + standing + drag + hours in one slice) | Rejected 61/90 — vertical-slice discipline; decomposed into F-05, S-25–S-27               | Never as bundle; parts already sliced                                      |
| **Full RRULE / habit tracker**                                                | Weekly/monthly recurrence, auto-spawn at midnight — parked P-109 / ideas-notes            | S-27 daily flag proves insufficient in real use                            |
| **Hard calendar deadlines (datetime)**                                        | "Before standup 10:00" needs datetime picker + overdue rules — ideas-notes deadline scope | Wedge needs datetime boost beyond commitment horizon (ASAP/this week)      |
| **Eisenhower 2×2 matrix screen**                                              | Visual quadrant UI = analytics-adjacent dashboard                                         | Attributes ship in F-05; screen only if users can't map importance/urgency |
| **Separate task-type enums** (learning / run-meeting / book-room)             | Generic taxonomy creep vs `workType` + importance/urgency                                 | User testing shows F-05 mapping fails for recurring personas               |
| **Tags / projects / SMART goals**                                             | Generic CRUD not tied to wedge — ideas-notes parked                                       | Only if proven to feed scoring or context recovery                         |
| **Focus window start + end band**                                             | Full working-hours schedule vs S-27 single focus-hours budget                             | User needs start-time blocking, not just remaining capacity                |
| **Legacy `weight` field removal**                                             | Scorer v2 needs migration period                                                          | After F-05 stable + S-23 factors updated                                   |
| **Suggestion helpfulness feedback** (Helpful / Not quite)                     | No ML path; dead data without calibration loop — rejected P-207 UX batch                  | Formula calibration pipeline exists post-launch                            |
| **Past-deadline urgency boost cap**                                           | Product rule for overdue tasks not in v1 horizon model                                    | Datetime deadlines unparked                                                |
| **Agile modifiers** (sprint points, WIP limits)                               | Outside mindfulness + Pomodoro wedge                                                      | Explicit user demand with wedge tie-in                                     |
| **Calendar / Slack / Jira integrations**                                      | PRD Non-Goals                                                                             | Platform slice post-MVP                                                    |
| **Expanded energy states** beyond Focused/Steady/Fading                       | S-25 reuses S-05 triad by design                                                          | Check-in fatigue research suggests need                                    |


## Parked

- **FR-016: full surprise animation on task completion** — Why parked: PRD marks this `nice-to-have` and explicitly defers until the core loop is solid; under `main_goal: speed` it does not enter MVP scope.
- **Mobile / native push notifications** — Why parked: PRD §Non-Goals — MVP is browser-only.
- **Historical analytics or dashboards** — Why parked: PRD §Non-Goals — session history is retained for 90 days but no charts/trends in MVP.
- **Team / social / shared-task features** — Why parked: PRD §Non-Goals — single-user only.
- **AI/ML-powered scoring** — Why parked: PRD §Non-Goals — deterministic formula only in MVP.
- **External integrations (Jira / Todoist / Calendar / Slack)** — Why parked: PRD §Non-Goals — no import/export in MVP.
- **Parallel CI workflow under `.github/workflows/`** — Why parked: under `main_goal: speed`, Vercel's GitHub auto-deploy already covers the build-on-push surface; a parallel CI is a quality investment for after launch.
- **Observability stack (Sentry / OTel / log drains)** — Why parked: baseline absent; not gated by any must-have FR; revisit post-launch.
- **Cross-day focus streak nudge (P-106 / ideas-notes "statystyki" adjacent)** — Why parked: return-day streak surfacing is cross-session pattern analytics — conflicts with PRD §Non-Goals and parked "Historical analytics or dashboards" even without charts. Expand score 39/100 — **reject**.
- **ideas-notes: tagi / projekty / SMART / deadline'y / zadania cykliczne / nawyki / mobile / AI plan tuning** — Why parked: either generic CRUD not tied to wedge (tags, projects, SMART tooling), future platform scope (mobile), or explicit Non-Goals (AI/ML scoring). Revisit only if a slice proves they feed FR-021 scoring or context recovery — not as standalone list features.
- **Recurring wedge kickoff tasks (P-109)** — Why parked: daily recurring template reopens ideas-notes recurring/habits scope and RRULE creep; kickoff scoring can weight standing tasks via work-type/weight today. Expand score 53/90 — **reject** (roadmap-expand 2026-06-07).
- **Session-end completion moment (P-207 / follow-up batch 2)** — Why parked: duplicate of S-13 per-task delight + S-17 session closure; a third celebration surface adds motion fatigue without wedge value. Expand score 45/90 — **reject** (follow-up 2026-06-07).
- **Suggestion helpfulness one-tap (P-207 / ideation)** — Why parked: PRD forbids AI/ML scoring; no MVP consumer for Helpful/Not quite without formula calibration path — collecting feedback is dead weight. Expand score 43/100 — **reject** (UX gaps batch 2026-06-07).
- **Focus shell during WORK (research gap)** — Why parked: dim/hide task chrome while cycle runs — strong UX win, not yet sliced; pairs with S-13 but distinct from rebrand; revisit next expand batch.
- **Wedge keyboard shortcuts (research gap)** — Why parked: accept/override/start without mouse — power-user speed; no slice yet; verify a11y overlap before planning.
- **Session reconnect calm banner (research gap)** — Why parked: NFR connection-loss recovery exists but no UX surface; lightweight banner slice candidate for post-S-01 hardening.

## Done

- **S-12: user completes a work cycle and moves through check-in and next-task suggestion inside a calm, cohesive designed flow — cycle-end, check-in, mid-cycle, and suggestion surfaces no longer feel like unstyled overlay defaults.** — Archived 2026-06-11 → `context/archive/2026-06-11-wedge-overlay-visual-polish/` ([PR #96](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/96)). Lesson: shared `overlay-shell` + merged `@theme` with S-13; preserve all wedge `data-testid` contracts.
- **S-13: user opens FlowState (guest or logged in) and sees a cohesive branded home — not T3 boilerplate or hardcoded gradients — with active and completed tasks visually distinct at a glance; when marking a task done, user sees a brief calm completion moment (sub-second restrained motion per FR-016 — not surprise arcade animation).** — Archived 2026-06-11 → `context/archive/2026-06-11-focus-home-visual-craft/` ([PR #95](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/95)). Lesson: add home/task @theme tokens only; defer auth pages and overlay surfaces to parallel S-12.
- **F-04: (foundation) `DESIGN.md` captures FlowState's visual system — color, typography, spacing, motion, and component patterns — produced via `/impeccable shape` discovery and `/impeccable document`, so downstream craft slices stay on-brand.** — Archived 2026-06-11 → `context/archive/2026-06-11-impeccable-design-foundation/` ([PR #94](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/94)). Lesson: exclude vendor Impeccable scripts from Biome; track skills under `.cursor` only.
- **F-05: (foundation) Task carries separate importance (1–3) and urgency (1–3), optional effort estimate in minutes, and commitment horizon (ASAP / this week / when possible) at create/edit; existing `weight` migrates to urgency with sensible defaults; `workType` unchanged; deterministic scorer v2 applies Eisenhower (urgency×importance), Pareto (importance when Focused), and Ockham (low-effort when Fading); rationale templates and S-23 expander factors updated.** — Archived 2026-06-11 → `context/archive/2026-06-11-eisenhower-effort-task-attributes/` ([PR #93](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/93)). Lesson: clamp migration backfill to 1–3; scope e2e urgency picker when Importance shares Light/Medium/Heavy labels.
- **S-25: declare Focused/Steady/Fading at kickoff and before next-task suggestion — feeds scorer instead of hardcoded STEADY.** — Archived 2026-06-10 → `context/archive/2026-06-10-pre-suggestion-readiness/` ([PR #88](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/88)). Lesson: defer kickoff `suggestion.next` until readiness gate resolves; extract `EnergySelector` for S-05 reuse; post-check-in path already satisfied by check-in — no second gate.
- **B-03: logged-in user clicking Start Cycle or Interrupt sees the timer panel update within 200ms — running countdown on start, idle/ready on interrupt — without waiting for sessions.getOrCreateActive / cycles.create / cycles.interrupt to complete; server sync runs async with rollback on failure.** — Archived 2026-06-10 → `context/archive/2026-06-09-fix-title-multiline-and-cycle-optimistic/` ([PR #85](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/85), [PR #86](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/86)). Lesson: await server cycle id when create is still pending before check-in mutations; E2E uses `waitForCycleCreateSettled` not latency assertions.
- **B-02: user editing a task title sees a multi-line text control that wraps long names across several lines so the full title is readable and editable — not a single-line input that clips overflow.** — Archived 2026-06-10 → `context/archive/2026-06-09-fix-title-multiline-and-cycle-optimistic/` ([PR #85](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/85)). Lesson: co-locate textarea smoke test in `task-list.test.tsx` when edit control type changes.
- **B-04: after submitting energy at cycle end, user never sees the stale Cycle Complete! modal again — transition proceeds immediately to break start, suggestion loading, or wind-down without a multi-second freeze on the old overlay.** — Archived 2026-06-09 → `context/archive/2026-06-09-fix-cycle-complete-flash-after-checkin/`. Lesson: defer `awaitingCheckIn` clear until break `running` observable; gate overlay mount with `isPostCheckInTransitioning`.
- **S-26: user drag-reorders active tasks in the task list; order persists across refresh and guest merge (`sortOrder` on Task); post-check-in and kickoff suggestions use manual order as the deterministic tie-breaker when scorer scores tie — not as the primary ranking signal.** — Archived 2026-06-09 → `context/archive/2026-06-09-task-manual-priority-order/`. Lesson: mirror S-09 optimistic rollback for reorder; dnd-kit drag handle + `onSettled` cache invalidate keeps list and suggestion paths consistent.
- **B-01: user can click Normal, Soft, or Muted on the timer panel Cycle end audio control and see the selection update immediately; preference persists across refresh (localStorage for guests, server profile when logged in); cycle-end chime respects the chosen mode.** — Archived 2026-06-09 → `context/archive/2026-06-08-fix-cycle-audio-toggle/`. Lesson: one-time server-sync guard per auth scope prevents suggestion-fetch re-entry from overwriting optimistic toggles.
- **S-20: user can mute or soften the in-browser cycle-end chime with a preference that persists across sessions (server profile when logged in, localStorage for guests); the visual transition prompt remains the authoritative mindful signal; when audio is muted/softened and the tab was backgrounded at cycle end, an optional single calm title or favicon pulse may fire until the user returns (work-end at minimum — not native push).** — Archived 2026-06-08 → `context/archive/2026-06-08-persistent-quiet-cycle-audio/`. Lesson: —.
- **S-15: user can see a suggested task with one-line rationale when idle at session start or after a break with no pre-selected task — before manually picking what to focus on next; optionally accept a one-tap work-cycle duration preset matched to the selected task's work type (e.g. 45m deep / 25m admin / 15m reactive) — never auto-applied without explicit accept; kickoff preset chips remember last accepted or customized duration per work type across sessions (labeled "your usual", tap-to-apply only).** — Archived 2026-06-08 → `context/archive/2026-06-08-session-kickoff-suggestion/`. Lesson: isolate kickoff vs post-check-in `suggestion.next` mutation hooks to avoid stuck loading on CI.
- **S-16: user can receive an optional, dismissible prompt to end the session with a one-line rationale when check-in energy is Fading and session fatigue/interruption signals align — and override to continue working.** — Archived 2026-06-08 → `context/archive/2026-06-08-mindful-session-wind-down/`. Lesson: —.
- **S-22: returning to a backgrounded tab after a cycle ended while away sees a calm catch-up surface — what finished, how long ago, and the single next action (check-in gate, break confirm, or suggestion accept) — instead of landing silently on a gate they may have missed.** — Archived 2026-06-08 → `context/archive/2026-06-08-background-tab-return-catchup/`. Lesson: visibility-recalc path needs `tabWasHiddenWhileRunningRef`; guest e2e must dismiss first-run overlay.
- **S-19: user can override the suggested next task (post-check-in and idle kickoff suggestion from S-15) and see the same brief validating acknowledgement line — autonomy preserved, override recorded for session context, no guilt or patronizing copy.** — Archived 2026-06-08 → `context/archive/2026-06-08-suggestion-override-acknowledgement/`. Lesson: post-check-in ack shipped first; kickoff surface waits on S-15.
- **S-14: user on sign-in or sign-up pages understands FlowState's value (mindful Pomodoro + session-aware next-task picks with rationale), and after authenticating with guest data sees an explicit merge-success moment naming imported tasks and what unlocked (full sessions, check-ins, suggestions) instead of a silent import.** — Archived 2026-06-08 → `context/archive/2026-06-08-auth-merge-first-impression/`. Lesson: —.
- **S-11: user on first visit follows a dismissible first-run flow teaching check-in → suggestion wedge; **plus** ongoing empty-list guidance when active tasks drop to zero again (not only "No active tasks"); **plus** inline one-line coach at first-ever check-in and first suggestion — subcopy only, no second blocking modal. (Scope expanded P-204+P-205 / roadmap-expand UX batch 2026-06-07.)* — Archived 2026-06-08 → context/archive/2026-06-07-first-run-wedge-onboarding/. Lesson: —.
- **S-09: while logged in, task create / update / delete / status changes reflect in the UI immediately (optimistic cache updates via TanStack Query); on mutation failure the UI rolls back and shows an error — no silent loss.** — Archived 2026-06-07 → `context/archive/2026-06-07-optimistic-task-mutations/`. Lesson: —.
- **S-07: reset a forgotten password and recover access without losing existing tasks or session history** — Archived 2026-06-07 → `context/archive/2026-06-07-account-recovery-flow/`. Lesson: —.
- **S-06: after the check-in, user sees a suggested next task with a one-line rationale ("deep work — fresh and uninterrupted" / "light admin — energy dipping after 4 cycles"); user can accept it with one click or override by selecting any other task; the override is recorded as a session-context input for the next suggestion.** — Archived 2026-06-07 → `context/archive/2026-06-07-adaptive-task-suggestion/`. Lesson: —.
- **S-08: use tasks and a focus cycle without an account (device-local storage), then sign in or sign up and have that work merged into the account** — Archived 2026-06-07 → `context/archive/2026-05-29-guest-local-storage-merge/`. Lesson: —.
- **S-08: use tasks and a focus cycle without an account (device-local storage), then sign in or sign up and have that work merged into the account** — Shipped 2026-06-07 → change `guest-local-storage-merge` (`context/changes/guest-local-storage-merge/`). E2E: `e2e/guest-trial.spec.ts`, `e2e/guest-merge-on-sign-in.spec.ts`, `e2e/guest-merge-cycle-on-sign-in.spec.ts`.
- **S-03: mark a task done mid-cycle and choose between picking the next task to keep the cycle running or ending the cycle to take a break now** — Archived 2026-06-06 → product in `testing-active-slice-browser-proofs` (`context/archive/2026-06-06-testing-active-slice-browser-proofs/`). Lesson: bundled S-03 + S-05 UI with test-plan Phase 2 e2e.
- **S-05: declare energy state ("Focused" / "Steady" / "Fading") at every cycle end before transitioning, with the response stored for the active session** — Archived 2026-06-06 → product in `testing-active-slice-browser-proofs` (`context/archive/2026-06-06-testing-active-slice-browser-proofs/`). Lesson: check-in gate e2e partially covered; batched tRPC oracle deferred.
- **F-01: (foundation) Pomodoro session domain wired in Prisma + tRPC: Task gains workType + weight; Session, Cycle, CheckIn entities and routers exist with strict per-user isolation** — Archived 2026-06-06 → `context/archive/2026-05-26-session-domain-model/`. Lesson: —.
- **F-02: (foundation) Playwright installed with authenticated test user flow; agent and CI can run browser-based e2e tests against the real app** — Archived 2026-06-06 → `context/archive/2026-05-28-e2e-test-infra/`. Lesson: —.
- **S-01: start one configurable work cycle on a selected task, hear the audio prompt at cycle end, confirm transition, and return to the same state after a refresh** — Archived 2026-06-06 → `context/archive/2026-05-28-first-pomodoro-cycle/`. Lesson: —.
- **S-02: complete a multi-cycle session with short and long breaks, see configured break durations applied, and end the session explicitly or after 4h inactivity** — Archived 2026-06-06 → `context/archive/2026-05-30-full-session-with-breaks/`. Lesson: —.
- **S-04: tag tasks with work type (deep work / admin / reactive) and weight (1–3) at creation and during edit, with values surfaced in the task list** — Archived 2026-06-06 → `context/archive/2026-05-30-task-attributes-for-scoring/`. Lesson: —.
- **S-10: sign in or sign up with a Google account in one click, alongside the existing email/password flow** — Archived 2026-06-06 → `context/archive/2026-05-31-google-oauth-provider/`. Lesson: —.

