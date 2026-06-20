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
