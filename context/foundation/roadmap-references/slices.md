> Detail reference — load on demand. Index: [roadmap.md](../roadmap.md).

# Slices (S-01…S-31)

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
- **Status:** active

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
- **Status:** done — shipped via [PR #102](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/102) (2026-06-12)

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

### S-28: Calm Garden illustration foundation

- **Outcome:** user sees reusable **Calm Garden** botanical graphics (pastel blob backdrops + single-weight line-art) on home hero sprig, Empty Garden Bed empty state, and shared illustration primitives in `src/lib/design/illustrations/`; **phase 2 (P-105):** the same Serene Pastel + Calm Garden atmosphere extends to wedge overlay scrims and auth/merge/sign-in surfaces — subtle botanical backdrops without illustration clutter on interactive gates (energy selectors, suggestion CTAs, check-in controls stay clean per FR-044).
- **Change ID:** wellness-illustration-foundation
- **Linear:** [FLO-63](https://linear.app/flowstate-10xdev/issue/FLO-63)
- **GitHub:** [#98](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/98)
- **PRD refs:** FR-039, FR-044, FR-025, Secondary Success Criteria, proposed-FR-empty-state-guidance, proposed-FR-calm-garden-illustrations
- **Prerequisites:** F-06
- **Parallel with:** S-31
- **Blockers:** —
- **Unknowns:**
  - Prefer inline SVG React components or static assets under public/? Owner: implementer. Block: no.
  - Any botanical motif to avoid (religious, clinical, overly floral)? Owner: user. Block: no.
  - Phase 2: energy-state tint on overlay scrim (Focused/Steady/Fading) or neutral pastel only? Owner: user. Block: no.
  - Phase 2: include first-run onboarding overlay in atmosphere scope or overlay/auth only? Owner: user. Block: no.
- **Risk:** Illustration components add bundle weight or inconsistent sizing if blob/line-art primitives lack shared viewBox and aria-hidden defaults; phase 2 decorative SVG on wedge gates hurts scan speed — restrict botanicals to scrim/atmosphere layers only. Expand score 63/90 → phase 2 **59/90 accept** (roadmap-expand 2026-06-12 coherence batch P-105).
- **Status:** proposed

### S-29: Task create persona presets

- **Outcome:** user can add or edit a task by choosing one of three persona presets — **Deep planning**, **Mail & admin**, **Hotfix urgent** — each with work-type icon and color, pre-filling workType plus F-05 importance, urgency, effort, and commitment horizon; or tap **Custom** to expand the full attribute panel (replacing the hidden + Details toggle).
- **Change ID:** task-create-persona-presets
- **Linear:** [FLO-64](https://linear.app/flowstate-10xdev/issue/FLO-64)
- **GitHub:** [#105](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/105)
- **PRD refs:** FR-004, FR-005, FR-017, FR-018, FR-035, FR-036, FR-037
- **Prerequisites:** F-05, F-06, S-13
- **Parallel with:** S-28
- **Blockers:** —
- **Unknowns:**
  - Exact Deep planning / Mail & admin / Hotfix → workType + importance/urgency/effort/horizon mapping? Owner: user. Block: no.
  - Apply presets on inline edit or create-only v1? Owner: user. Block: no.
  - Icons: Lucide vs Calm Garden SVG from S-28? Owner: implementer. Block: no.
- **Risk:** Preset bundles could mis-rank niche tasks if users never discover Custom — mitigate with visible pre-fill and Custom as co-primary path. Expand score 77/90 — **promote** (roadmap-expand 2026-06-12 P-101).
- **Status:** ready

### S-30: Daily work timing recap

- **Outcome:** user sees on home a calm collapsible daily recap: **Last 24 hours** lists tasks worked with first cycle start, last cycle end, and total focused minutes (from WORK cycles plus tasks marked done in the window); **Today** lists active tasks still on plan (enriched with S-27 daily-standing items when that slice ships); **focus footprint sub-phase (P-107):** each active task row and focus picker shows a one-line footprint — last focused (relative time) and cumulative focused minutes from completed WORK cycles — to inform manual picks and refocus without an analytics screen. List-only, copy-friendly for standup, no charts or analytics dashboard.
- **Change ID:** daily-work-timing-recap
- **Linear:** [FLO-65](https://linear.app/flowstate-10xdev/issue/FLO-65)
- **GitHub:** [#106](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/106)
- **PRD refs:** proposed-FR-daily-work-timing, proposed-FR-task-focus-footprint, FR-008, FR-019, FR-021, FR-043, NFR (90-day session retention)
- **Prerequisites:** S-02, S-18
- **Parallel with:** S-27
- **Blockers:** —
- **Unknowns:**
  - Rolling last-24h vs local-calendar day for done section? Owner: user. Block: no.
  - Include INTERRUPTED work cycles or COMPLETED only? Owner: implementer. Block: no.
  - Guest mode parity from local cycle blob? Owner: implementer. Block: no.
  - Footprint on all active rows or focus picker + expanded row only in v1? Owner: user. Block: no.
- **Risk:** Cycle-only timing misses tasks completed without a finished work cycle — include mark-done via updatedAt with clear labeling; guard against overlap with S-17 session narrative prose; footprint on every row may add visual noise — prefer picker + expanded row in v1. Expand score 52/90 + footprint **59/90 accept** (roadmap-expand 2026-06-12 coherence batch P-107).
- **Status:** ready

### S-31: Work focus shell

- **Outcome:** user running a WORK cycle sees the task list and non-essential home chrome gently recede — timer and active task remain the visual hero — so the screen reads as a calm focus surface, not a full task manager competing for attention; completed tasks and mid-cycle switch paths stay reachable via peek or one gesture; full chrome restores on interrupt, break, or cycle end.
- **Change ID:** work-focus-shell
- **Linear:** [FLO-66](https://linear.app/flowstate-10xdev/issue/FLO-66)
- **GitHub:** [#107](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/107)
- **PRD refs:** FR-039, FR-012, proposed-FR-focus-shell-dimming
- **Prerequisites:** S-13, F-06
- **Parallel with:** S-17, S-28, S-29
- **Blockers:** —
- **Unknowns:**
  - Dim completed section only vs entire list vs hide add-task chrome? Owner: user. Block: no.
  - Apply during SHORT_BREAK/LONG_BREAK or WORK only? Owner: user. Block: no.
  - Guest mode parity from local cycle state? Owner: implementer. Block: no.
- **Risk:** Over-dimming hides mid-cycle task switch and S-18 resume-note affordances — keep active row + timer at full contrast; respect `prefers-reduced-motion`. Expand score **75/90 — promote** (roadmap-expand 2026-06-12 coherence batch P-101).
- **Status:** ready

### S-32: Create→wedge trust bridge

- **Outcome:** after creating or editing a task via S-29 persona preset, the **first** suggestion (kickoff idle or post-check-in) includes a rationale clause citing the persona choice — e.g. "Hotfix urgent — reactive work fits your current energy." One clause on the suggestion card; S-23 expander unchanged.
- **Change ID:** create-wedge-trust-bridge
- **Linear:** —
- **GitHub:** —
- **PRD refs:** FR-021, FR-017, FR-018, FR-026, FR-025
- **Prerequisites:** S-29, F-05, S-06
- **Parallel with:** S-31
- **Blockers:** —
- **Unknowns:**
  - Kickoff only vs post-check-in vs both? Owner: user. Block: no.
  - `createdViaPreset` on Task vs infer from F-05 attribute bundle? Owner: implementer. Block: no.
  - "First suggestion" = first ever per task vs first per session? Owner: user. Block: no.
- **Risk:** Template feels artificial — one clause max; do not duplicate S-17 narrative or S-30 lists. Expand score 73/90 — **promote**. Alternative: fold as phase 2 of S-29 in `/10x-plan` without separate change folder.
- **Orchestrator note:** P-203 (empty→preset→cycle nudge) and P-204 (feature discovery coaches) merge into S-29 plan, not this slice.
- **Status:** proposed

### S-33: Break restoration atmosphere

- **Outcome:** during SHORT_BREAK and LONG_BREAK the home shell shifts to a calm break atmosphere — break wash on shell, subdued task chrome, timer accent — not only the timer card on a work-gradient background. Atmosphere yields when a wedge gate (suggestion on break idle) becomes active.
- **Change ID:** break-restoration-atmosphere
- **Linear:** —
- **GitHub:** —
- **PRD refs:** FR-011, FR-014, FR-041, Secondary Success Criteria
- **Prerequisites:** F-06, S-13
- **Parallel with:** S-21, S-28
- **Blockers:** —
- **Unknowns:**
  - Animate atmosphere transition vs instant swap? Owner: user. Block: no.
  - Apply during break with active suggestion overlay? Owner: implementer — atmosphere must not fight gate. Block: no.
- **Risk:** S-21 delivers words (FR-041); this slice delivers **felt** break — ship together or S-21 first with neutral shell. Expand score 69/90 — **promote** (gap batch Tier A).
- **Status:** proposed

### S-34: Optimistic wedge transitions

- **Outcome:** after energy check-in, suggestion accept/override and break handoff update within 200ms (optimistic UI with rollback on failure) — mirroring B-03 for Start/Interrupt on the wedge path; guest local-first parity preserved where applicable.
- **Change ID:** optimistic-wedge-transitions
- **Linear:** —
- **GitHub:** —
- **PRD refs:** NFR (200ms acknowledgement), FR-020, FR-021, FR-022
- **Prerequisites:** S-06, S-09, S-25, B-03, B-04
- **Parallel with:** S-34 bundles with S-35 recovery
- **Blockers:** —
- **Unknowns:**
  - Scope: post-check-in only vs kickoff `suggestion.next` vs `recordDecision` vs break-start? Owner: `/10x-plan`. Block: no.
  - Race with S-16 wind-down branch — owner: implementer. Block: no.
- **Risk:** Optimistic wedge state diverges on check-in + confirmComplete + suggestion + wind-down races. Expand score 63/90 — **revise then promote**.
- **Status:** proposed

### S-35: Wedge transition sync recovery

- **Outcome:** when network is lost on a wedge gate (check-in, suggestion, readiness), user sees a calm recovery handoff — what is saved locally, one-tap retry, no forced re-entry of energy; optional reconnect banner for broader offline state (bundle of P-GAP-107 + P-GAP-108).
- **Change ID:** wedge-transition-sync-recovery
- **Linear:** —
- **GitHub:** —
- **PRD refs:** NFR (no silent data loss), FR-020, FR-021
- **Prerequisites:** S-06, S-22, S-09
- **Parallel with:** S-34
- **Blockers:** —
- **Unknowns:**
  - Local outbox vs retry-only without persistence — owner: implementer. Block: no.
  - Multi-tab desync when one tab offline — owner: implementer. Block: no.
- **Risk:** Banner alone (P-GAP-107) without wedge retry logic is half a fix; ship as one slice. Trust layer under S-34 optimistic path. Expand scores 53 + 60/90 — **revise as bundle**.
- **Status:** proposed
