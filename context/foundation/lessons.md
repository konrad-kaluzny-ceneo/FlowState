---
project: FlowState
type: lessons
version: 2
created: 2026-05-28
updated: 2026-06-20
prd_version: 3
---

# Lessons learned

Recurring rules and pitfalls surfaced during implementation. Referenced by `/10x-plan` and `/10x-implement` to avoid repeat mistakes.

---

## L-01: Never create duplicate Linear issues for existing roadmap items

**Trigger:** `/10x-linear-backlog` or any issue-creation flow for a roadmap slice.

**Rule:** Before creating a Linear issue for a roadmap item, check if a `FLO-*` ID already exists in `roadmap.md` for that Change ID. If it does, use the existing issue — never create a second one.

**What went wrong:** On 2026-05-27, a second sync run created FLO-15–18 as duplicates of FLO-14, FLO-8, FLO-13, FLO-7. Each duplicate was auto-linked to the same GitHub issue as the canonical. When duplicates were later marked Done/Canceled, the two-way Linear ↔ GitHub sync closed the canonical GitHub issues — breaking the project state.

**Impact:** GitHub issues #7, #9, #13 were incorrectly closed. Required manual reopen and attachment cleanup.

---

## L-02: Detach GitHub attachment before canceling a duplicate Linear issue

**Trigger:** Canceling or closing a Linear issue that shares a GitHub attachment with another (canonical) issue.

**Rule:** Always delete the GitHub attachment from the duplicate Linear issue *before* changing its status to Canceled or Done. The two-way sync fires on status change — if the attachment is still present at that moment, it will close the linked GitHub issue.

**Sequence:**
1. Delete attachment (Linear MCP `delete_attachment`)
2. Set status to Canceled (`save_issue` state=Canceled)

Never reverse this order.

**What went wrong:** FLO-15 (duplicate of FLO-14) was marked Done while still linked to GitHub #6. FLO-16/17/18 were canceled while still linked to #7/#13/#9. The sync closed all linked GitHub issues.

---

## L-03: Verify Linear ↔ GitHub sync after any bulk status change

**Trigger:** Changing status on more than one Linear or GitHub issue in a single session.

**Rule:** After bulk changes, run the verification table from the `update-status` skill for every affected pair. Don't assume the sync handled it correctly — especially when canceled/closed issues share attachments with open ones.

**Check:** `gh issue list --state all --json number,title,state` + Linear MCP `list_issues` filtered by team.

---

## L-04: NFR 200ms applies per action surface, not per slice

**Trigger:** Shipping a slice that touches one user-facing control while another surface in the same flow still blocks on the server.

**Rule:** When the PRD NFR calls for perceived latency under 200ms, verify **each** interactive surface that users tap in a flow — not only the slice you are implementing. Start/interrupt, inline edit, and form controls each need their own oracle (unit or component test) if they can block on network.

**What went wrong:** S-09 (`optimistic-task-mutations`) sped up task CRUD but its plan explicitly excluded `cycle.create` / `cycle.interrupt` — so Start/Interrupt stayed pessimistic until B-03. Separately, B-02 (task title clipped in edit mode) shipped in `task-list.tsx` with zero co-located component tests — a single-line `<input>` hid long and multiline titles until manual QA.

**Impact:** Users still perceived lag on any non-optimistic surface; long titles remained a regression risk with no automated guard on the edit control choice (textarea vs input).

---

## Test every wedge transition before shipping transition logic changes

- **Context**: Changes to wedge overlays, transition gates, or F-07 conductor orchestration — `use-pomodoro-cycle`, `transition-conductor`, `pomodoro-dashboard`, and co-located overlay components.
- **Problem**: Popups and transition gates frequently regress into dead-end states: chips or buttons appear but do nothing, or the overlay stays open after the user selects an option — trapping the user and making the app unusable. Confirmed in `session-entry-wedge-bugs` (focus popup permission deferral deadlock, false entry closure/handoff) and Cycle Complete overlay not dismissing after choice.
- **Rule**: Treat every transition beat as a critical path. Before merging, add or extend hook/component tests that assert each gate opens, accepts the primary action (Skip, chip, Continue later, dismiss), and closes before the next beat proceeds. Change transition ordering, async deferral, and conductor priority with highest caution — never ship overlay-sequence changes without a dismiss-oracle for every affected gate.
- **Applies to**: frame, research, plan, plan-review, implement, impl-review

---

## Use E2E env vars for auth manual verification

- **Context**: Agent manual verification of authenticated user flows — browser testing, wedge/session checks, and auth-only paths that guest mode cannot cover.
- **Problem**: Without valid credentials the agent cannot log in to verify server-side session/cycle behavior; hardcoding passwords in lessons, plans, or code leaks secrets and goes stale when credentials rotate.
- **Rule**: For logged-in manual checks, read `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` from the project `.env` at runtime. In durable docs (lessons, plans, frames) refer only to those variable names — never paste actual credential values.
- **Applies to**: implement, impl-review


---

## Run E2E tests one spec at a time, never the full belt during iteration

- **Context**: Any implementation or stabilization work that touches Playwright specs or app code that affects E2E flows.
- **Problem**: The full e2e belt takes 2–3 minutes per run. Running it after every change wastes time and produces walls of output where individual failure context is lost. The agent ends up re-running tests it already diagnosed because the output was truncated.
- **Rule**: Always run a single spec file (`pnpm exec playwright test e2e/<name>.spec.ts`) or a `--grep` filter during iteration. Capture the full error output on failure — never discard it. Run the belt only as the final gate when you're confident all specs should pass.
- **Applies to**: implement, impl-review

---

## L-06: E2E tests that exceed 15 seconds belong in integration/hook layer

**Trigger:** Adding or reviewing Playwright e2e specs.

**Rule:** If an e2e test consistently takes >15s, it exercises too many async steps (cycle start → clock advance → overlay → check-in → suggestion fetch → assertion). Demote the signal to a Vitest hook/integration test where the same logic runs in <100ms without browser orchestration overhead. Reserve e2e belt for fast (<15s) happy-path proofs that need real DOM.

**What went wrong (2026-07-05 ui-refactor):** 6 belt tests (pomodoro-cycle, task-suggestion, session-kickoff, seed mid-cycle, mindful-wind-down fatigue/end-session) ran 17–25s, introduced timing flakiness due to fake-clock/parallel-worker interactions, and broke after any layout restructure (task-list moved from /focus to /tasks).

**Correct approach:** Each removed e2e already had Vitest hook coverage: `use-pomodoro-cycle.test.tsx` (check-in gate, mid-cycle, suggestion fetch, kickoff eligibility, wind-down trigger), `suggestion.test.ts` (router-level scoring/exclusion), `transition-conductor.test.ts` (gate mutex), `wind-down-nudge.test.ts` (trigger logic), `pomodoro-dashboard.test.tsx` (overlay visibility matrix). These tests run in ~2s total and catch the same regressions.

**Anti-patterns to avoid:**
1. E2e testing pure state-machine logic (cycle transitions, gate priority) — use `renderHook` instead.
2. E2e testing tRPC response shape (suggestion rationale, scoring) — use `createCaller` integration.
3. E2e testing overlay show/hide matrix — use component render with mocked hook returns.
4. Multi-cycle flows requiring 3+ clock advances — flaky by design in parallel workers.
5. Tests depending on `waitForResponse` matching tRPC batch stream URLs — fragile and timing-sensitive.

- **Applies to**: e2e, testing, implement

---

## L-07: Next-task suggestion surfaces only via the FocusReady star

**Trigger:** Any change touching next-task suggestion UI, the break view, or the idle kickoff flow.

**Rule:** The next-task suggestion surfaces only via the `FocusReady` star (+ its popup) in "Gotów skupić się na" — never as a standalone panel on break or idle. Accept/override at the star are both recorded as `KICKOFF` `SuggestionDecision`s (accept via `acceptKickoffSuggestion`, override via the `selectTask` kickoff branch). A running break shows only the calm break atmosphere — no suggestion card, no `post_check_in` fetch.

**What went wrong:** A standalone `TaskSuggestionCard` panel rendered during a running break (fed by a separate `post_check_in` pipeline) and a second standalone panel rendered during idle kickoff — both duplicating the star's job and confusing users about where "the suggestion" actually lives.

**Correct approach:** Route all suggestion UI through `FocusReadyState`'s star + popup (`pendingKickoffSuggestion` pipeline). Do not add a second suggestion surface for break or idle states, even for a narrow use case — extend the star's popup instead.

- **Applies to**: suggestion, break-view, kickoff, wedge

---

## Never promote an inferred cause to "confirmed"

- **Context**: Filing or framing any bug where the observable is a *client-side* error message and the suspected cause is server-side. Especially where one catch block maps every failure to a single generic message.
- **Problem**: On 2026-07-13 a generic toast ("Nie udało się wstrzymać cyklu") was read as proof that the server rejected `cycle.pause` with "Cycle is not running". A bug was filed `verdict: confirmed`, blaming #200/#201. A runtime probe then showed **no `cycle.pause` request was ever sent** — the server was never involved. We came within one step of "fixing" high-blast-radius timer files (`use-pomodoro-cycle.ts`, `cycle.ts`) for a bug that did not exist.
- **Rule**: Never mark a bug `verdict: confirmed` on an inferred cause. A generic client error proves that *something* failed — not that a *specific* server guard rejected it. Confirm by observing the actual failure (network response, server log, or persisted state), or file it as `suspected`. When two code paths produce the same user-visible message, the message identifies neither.
- **Applies to**: frame, research, plan, implement, impl-review

---

## Playwright's fake clock starves timer-dispatched mutations

- **Context**: Any Playwright spec that installs `page.clock` (via `ensureFakeClock` / `startFocusedWorkCycle`) and then triggers a UI action whose mutation is dispatched from a timer callback — pause, and anything batched/debounced through tRPC. Extends L-06.
- **Problem**: With a frozen clock the click lands and the request is *scheduled*, but the schedule never runs — zero requests leave the browser. The client rolls back its optimistic update and shows a generic error that looks exactly like a server rejection. This cost a full false-alarm investigation (2026-07-13/14): pause was never broken.
- **Rule**: If a journey never advances time, do not install the fake clock — pass `{ fakeClock: false }` to `startFocusedWorkCycle` / `clickStartCycle` and use a cycle duration long enough that it cannot expire. Reserve the fake clock for journeys that actually advance time. When an action "fails" under a fake clock, first check whether its request was ever sent before blaming the server.
- **Applies to**: implement, impl-review, e2e/testing
