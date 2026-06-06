---
project: FlowState
version: 1
status: draft
created: 2026-05-26
updated: 2026-06-06
active_slices: [S-08]
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: FlowState

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.
> **Issue tracking:** each roadmap item is mirrored in Linear (team `FLO`) and GitHub Issues on `konrad-kaluzny-ceneo/FlowState`; IDs are in the tables below and in each slice section.

## Vision recap

FlowState is a single-user web app for the Dynamic Knowledge Worker — a developer or analyst whose day is structurally interrupt-driven. The product enforces mindful Pomodoro cycles linked to selected tasks, and after each cycle suggests the next task by combining user-declared weight and work-type with session context (cycles completed, interruptions, time of day, declared energy). The MVP must end with a logged-in user finishing a full session, marking work done, and seeing a clear active-vs-completed split — and it must do so without ever silently losing data.

The product *wedge* — the one trait that, if removed, makes FlowState indistinguishable from a generic task list — is that the system observes session state and proposes the *next* thing to work on with a one-line rationale, while the user remains free to override. Every roadmap decision below is biased to surface and protect that wedge as early as the dependency graph allows.

## North star

**S-01: First Pomodoro cycle on an existing task** — user picks one task, runs one full configurable work cycle, hears the audio prompt at cycle end, and confirms the transition without losing state on refresh.

> *North star* here means the smallest end-to-end slice whose successful delivery would prove FlowState's core hypothesis — placed as early as Prerequisites allow because every later slice (sessions, check-ins, scoring) only matters if the cycle itself is trustworthy. It is also the *validation milestone* against PRD §Success Criteria.Primary.


## At a glance

| ID | Change ID | Linear | GitHub | Outcome (user can …) | Prerequisites | PRD refs | Status |
|---|---|---|---|---|---|---|---|
| F-01 | session-domain-model | [FLO-6](https://linear.app/flowstate-10xdev/issue/FLO-6) | [#5](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/5) (closed) | (foundation) Pomodoro session domain wired in Prisma + tRPC: Task gains workType + weight; Session, Cycle, CheckIn entities and routers exist with strict per-user isolation | — | NFR (data isolation), NFR (no silent data loss), NFR (90-day retention), FR-017, FR-018, FR-019, FR-020 | done |
| F-02 | e2e-test-infra | [FLO-14](https://linear.app/flowstate-10xdev/issue/FLO-14) | [#6](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/6) | (foundation) Playwright installed with authenticated test user flow; agent and CI can run browser-based e2e tests against the real app | — | NFR (crash/refresh recovery), NFR (200ms acknowledgement), NFR (timer drift ≤ ±2s) | done |
| S-01 | first-pomodoro-cycle | [FLO-8](https://linear.app/flowstate-10xdev/issue/FLO-8) | [#7](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/7) (closed) | start one configurable work cycle on a selected task, hear the audio prompt at cycle end, confirm transition, and return to the same state after a refresh | F-01, F-02 | US-01, FR-009, FR-010, FR-012, FR-013, FR-014, NFR (timer drift ≤ ±2s), NFR (crash/refresh recovery), NFR (200ms acknowledgement) | done |
| S-02 | full-session-with-breaks | [FLO-10](https://linear.app/flowstate-10xdev/issue/FLO-10) | [#10](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/10) | complete a multi-cycle session with short and long breaks, see configured break durations applied, and end the session explicitly or after 4h inactivity | S-01 | US-01, FR-011, FR-014, FR-019, NFR (session retention 90 days) | done |
| S-03 | mid-cycle-completion-prompt | [FLO-11](https://linear.app/flowstate-10xdev/issue/FLO-11) | [#11](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/11) (closed) | mark a task done mid-cycle and choose between picking the next task to keep the cycle running or ending the cycle to take a break now | S-01 | FR-015, FR-009a (revert path consistency) | done |
| S-04 | task-attributes-for-scoring | [FLO-9](https://linear.app/flowstate-10xdev/issue/FLO-9) | [#8](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/8) | tag tasks with work type (deep work / admin / reactive) and weight (1–3) at creation and during edit, with values surfaced in the task list | F-01, F-02 | FR-005 (extend), FR-017, FR-018 | done |
| S-05 | end-of-cycle-checkin | [FLO-12](https://linear.app/flowstate-10xdev/issue/FLO-12) | [#12](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/12) (closed) | declare energy state ("Focused" / "Steady" / "Fading") at every cycle end before transitioning, with the response stored for the active session | S-01 | FR-020, NFR (mental-state data privacy) | done |
| S-06 | adaptive-task-suggestion | [FLO-13](https://linear.app/flowstate-10xdev/issue/FLO-13) | [#13](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/13) | after each check-in, see a suggested next task with a one-line rationale and accept it or override by picking any other task | S-04, S-05 | FR-021, FR-022, NFR (suggestion feedback ≥1s visible) | proposed |
| S-07 | account-recovery-flow | [FLO-7](https://linear.app/flowstate-10xdev/issue/FLO-7) | [#9](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/9) | reset a forgotten password and recover access without losing existing tasks or session history | F-02 | FR-003a, NFR (auth must not lock user out of own data) | ready |
| S-08 | guest-local-storage-merge | — | — | use tasks and a focus cycle without an account (device-local storage), then sign in or sign up and have that work merged into the account | S-01, F-02 | NFR (no silent data loss), FR-004–FR-009 | active |
| S-09 | optimistic-task-mutations | — | — | see task list and task actions update immediately while logged in (optimistic UI), with rollback on server error — matching perceived speed of local guest storage | S-01, F-02 | NFR (200ms acknowledgement), FR-004–FR-008 | proposed |
| S-10 | google-oauth-provider | [FLO-20](https://linear.app/flowstate-10xdev/issue/FLO-20) | [#20](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/20) (closed) | sign in or sign up with a Google account in one click, alongside the existing email/password flow | F-02 | FR-001, FR-002 | done |
| F-03 | align-prisma-config | — | — | (foundation) `prisma.config.ts` aligned with Prisma 7: `dotenv/config`, `env()` helper, unpooled URL for CLI migrations; runtime adapter unchanged | — | — | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme | Chain | Note |
|---|---|---|---|
| A | Core loop (north-star path) | `F-01` → `F-02` → `S-01` → `S-02` → `S-03` | Shortest path to PRD §Success Criteria.Primary; hosts the validation milestone. F-02 gates all UI-facing slices. Bias from `main_goal: speed`. |
| B | Scoring substrate | `S-04` (parallel with `S-01`/`S-02`, requires `F-02`) | Adds task attributes. Independent of timer mechanics; safe to fan out alongside Stream A once `F-01` + `F-02` land. |
| C | Wedge convergence | `S-05` → `S-06` | Joins Stream A at `S-01` (needs cycle-end hook) and Stream B at `S-04` (needs scoring inputs). Wedge — the differentiating mechanic — lands here. |
| D | Auth hardening | `S-07` (requires `F-02`), `S-10` (requires `F-02`) | Standalone slices; require e2e infra to verify auth flows end-to-end in a browser. |
| E | UX responsiveness | `S-09` (requires `S-01`, `F-02`) | TanStack Query optimistic updates on authenticated task (and optionally cycle) mutations. Pairs with guest trial (`S-08` when shipped) so login does not feel slower than try-before-signup. |


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
- **Linear:** —
- **GitHub:** —
- **PRD refs:** —
- **Unlocks:** — (hygiene; reduces agent confusion when running Prisma CLI)
- **Prerequisites:** —
- **Parallel with:** any slice (no runtime dependency)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Minimal — config-only; verify `pnpm prisma migrate status` and `pnpm db:generate` after change.
- **Status:** proposed


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
- **Status:** proposed


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
- **Status:** ready

### S-08: Guest trial and merge on login

- **Outcome:** visitor uses `/` without an account to manage tasks and run a work cycle (local persistence + refresh recovery); after sign-in or sign-up, guest data imports into the account; logged-in sessions use server data only (no guest blob reads).
- **Change ID:** guest-local-storage-merge
- **Linear:** —
- **GitHub:** —
- **PRD refs:** NFR (no silent data loss), FR-004–FR-009 (trial path; account still required for durable cross-device use)
- **Prerequisites:** S-01, F-02
- **Parallel with:** S-02, S-07, S-09
- **Blockers:** —
- **Unknowns:** Neon Auth middleware configuration for optional session on `/` — owner: `/10x-implement` Phase 4. Block: no.
- **Risk:** Dual-store complexity and merge edge cases (title collision, active cycle). Plan: `context/changes/guest-local-storage-merge/plan.md`.
- **Status:** active — change `guest-local-storage-merge` in progress (`context/changes/guest-local-storage-merge/`)

### S-09: Optimistic task mutations (authenticated UX)

- **Outcome:** while logged in, task create / update / delete / status changes reflect in the UI immediately (optimistic cache updates via TanStack Query); on mutation failure the UI rolls back and shows an error — no silent loss. Optionally extends to cycle start/complete if scoped in `/10x-plan`.
- **Change ID:** optimistic-task-mutations
- **Linear:** —
- **GitHub:** —
- **PRD refs:** NFR (200ms acknowledgement), FR-004, FR-005, FR-006, FR-007, FR-008, FR-009a
- **Prerequisites:** S-01, F-02
- **Parallel with:** S-02, S-03, S-04, S-07, S-08 (guest-local-storage-merge — recommended after or alongside S-08 so post-login UX matches guest perceived speed)
- **Blockers:** —
- **Unknowns:** Whether cycle mutations (`cycle.create`, `complete`, `interrupt`) belong in the same slice or a follow-up — owner: `/10x-plan`. Block: no — task list alone satisfies the slice outcome.
- **Risk:** Optimistic state can diverge from server truth on race or double-submit; mitigation: `onMutate` / rollback pattern, invalidate on settle, tests for failed mutation. Out of scope for `guest-local-storage-merge` (separate change-id per plan brief).
- **Status:** proposed

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

## Backlog Handoff

| Roadmap ID | Change ID | Linear | GitHub | Suggested issue title | Ready for `/10x-plan` | Notes |
|---|---|---|---|---|---|---|
| F-01 | session-domain-model | FLO-6 | #5 | FlowState — wire Pomodoro session domain (Task attrs + Session/Cycle/CheckIn) | yes | Implemented; GitHub closed, Linear Done |
| F-02 | e2e-test-infra | FLO-14 | #6 | FlowState — Playwright e2e test infrastructure with authenticated test user | yes | Run `/10x-plan e2e-test-infra`; gates all UI-facing slices |
| S-01 | first-pomodoro-cycle | FLO-8 | #7 | FlowState — first Pomodoro cycle on a selected task (north star) | no | Unblocks once F-01 + F-02 land; this is the validation milestone |
| S-02 | full-session-with-breaks | FLO-10 | #10 | FlowState — multi-cycle session with short/long breaks and explicit end | no | Unblocks after S-01 |
| S-03 | mid-cycle-completion-prompt | FLO-11 | #11 | FlowState — mid-cycle completion prompt (continue or break) | no | Unblocks after S-01; can run parallel to S-02 |
| S-04 | task-attributes-for-scoring | FLO-9 | #8 | FlowState — task work-type and weight attributes | no | Unblocks once F-01 + F-02 land; runs parallel to S-01/S-02/S-03 |
| S-05 | end-of-cycle-checkin | FLO-12 | #12 | FlowState — end-of-cycle mindful check-in | no | Unblocks after S-01 |
| S-06 | adaptive-task-suggestion | FLO-13 | #13 | FlowState — adaptive next-task suggestion with override (wedge) | no | Unblocks after S-04 + S-05; carries the v1 scoring formula |
| S-07 | account-recovery-flow | FLO-7 | #9 | FlowState — verify and expose password recovery flow | no | Requires F-02 for browser-based verification of recovery flow |
| S-08 | guest-local-storage-merge | — | — | FlowState — guest trial (localStorage) and merge on login | no | Plan at `context/changes/guest-local-storage-merge/` |
| S-09 | optimistic-task-mutations | — | — | FlowState — optimistic TanStack Query updates for authenticated task mutations | no | Unblocks after S-01; best after S-08 if guest trial ships first |
| S-10 | google-oauth-provider | FLO-20 | #20 | FlowState — Google OAuth social login (one-click sign-in) | yes | Neon Auth supports Google OAuth natively; minimal UI addition |
| F-03 | align-prisma-config | — | — | FlowState — align prisma.config.ts with Prisma 7 conventions | yes | Run `/10x-plan align-prisma-config`; config-only, no user-visible behavior |

## Research requirements <!-- needs-research -->

Items tagged `needs-research` are non-trivial — they require external research (`research.md` generated by `/10x-research` + exa.ai / Context7) **before** `/10x-plan`. Do not plan these without evidence.

| Roadmap ID | Change ID | Priority | Research targets |
|---|---|---|---|
| F-02 | e2e-test-infra | 🔴 High | Playwright auth strategies with Neon Auth (beta); Next.js 16 + Playwright integration patterns |
| S-01 | first-pomodoro-cycle | 🔴 High | Browser timer throttling (Page Visibility API, Web Workers); Web Audio autoplay policies; server-authoritative timer patterns for crash/refresh recovery |
| S-06 | adaptive-task-suggestion | 🟡 Medium | Weighted scoring / task-prioritization algorithms; Pomodoro technique research on task-energy matching; deterministic formula design patterns |
| S-07 | account-recovery-flow | 🟢 Low | Neon Auth password reset/recovery API surface (quick lookup) |

**Not requiring research** (straightforward implementation on existing stack): F-03, S-02, S-03, S-04, S-05, S-09, S-10.

## Open Roadmap Questions

1. **What are the exact weights and thresholds in the scoring formula?** — Owner: implementer (first iteration, calibrate after real usage). Block: S-06 only at calibration step, not at planning. Mirrors PRD §Open Questions Q1; surfaced here so it's not lost to `/10x-plan` as a silent scope grab.

## Parked

- **FR-016: full surprise animation on task completion** — Why parked: PRD marks this `nice-to-have` and explicitly defers until the core loop is solid; under `main_goal: speed` it does not enter MVP scope.
- **Mobile / native push notifications** — Why parked: PRD §Non-Goals — MVP is browser-only.
- **Historical analytics or dashboards** — Why parked: PRD §Non-Goals — session history is retained for 90 days but no charts/trends in MVP.
- **Team / social / shared-task features** — Why parked: PRD §Non-Goals — single-user only.
- **AI/ML-powered scoring** — Why parked: PRD §Non-Goals — deterministic formula only in MVP.
- **External integrations (Jira / Todoist / Calendar / Slack)** — Why parked: PRD §Non-Goals — no import/export in MVP.
- **Parallel CI workflow under `.github/workflows/`** — Why parked: under `main_goal: speed`, Vercel's GitHub auto-deploy already covers the build-on-push surface; a parallel CI is a quality investment for after launch.
- **Observability stack (Sentry / OTel / log drains)** — Why parked: baseline absent; not gated by any must-have FR; revisit post-launch.

## Done

- **S-03: mark a task done mid-cycle and choose between picking the next task to keep the cycle running or ending the cycle to take a break now** — Archived 2026-06-06 → product in `testing-active-slice-browser-proofs` (`context/archive/2026-06-06-testing-active-slice-browser-proofs/`). Lesson: bundled S-03 + S-05 UI with test-plan Phase 2 e2e.
- **S-05: declare energy state ("Focused" / "Steady" / "Fading") at every cycle end before transitioning, with the response stored for the active session** — Archived 2026-06-06 → product in `testing-active-slice-browser-proofs` (`context/archive/2026-06-06-testing-active-slice-browser-proofs/`). Lesson: check-in gate e2e partially covered; batched tRPC oracle deferred.
