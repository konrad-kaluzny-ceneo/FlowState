<!-- PLAN-REVIEW-REPORT -->

# Plan Review: day-schedule-timeline

**Date:** 2026-08-17  
**Reviewer:** Cursor Agent (`/10x-plan-review`, sub-agent code verification)  
**Plan:** `context/changes/day-schedule-timeline/plan.md`  
**Brief:** `context/changes/day-schedule-timeline/plan-brief.md`  
**Verdict:** APPROVED  
**Confidence:** 86/100

## Summary

S-54 plan is feasible, PRD v4–aligned (US-08, US-15, FR-001–004 in scope; FR-003/005/007 correctly deferred), and sequenced sensibly (schema → API → UI → attachments → tests). Code verification confirms the placeholder in `plan-dnia-view.tsx` (lines 17–95, 292–297), auth-only `dayPlan` router, `DayPlan` budget-only schema, `@dnd-kit` sortable list in `task-list.tsx` (not a timeline), and `Task.id` as `Int` — not cuid. Stack-assessment Gap 1 (same `localDateKey`, no parallel day model) and Gap 4 auth-first exception are adequately documented.

**Fixes applied in place:** task ID types, axis bounds, overlap transaction, `deleteContextTag` reject-when-in-use, custom-tag sanitize/cap, isolation test file, vertical dnd approach, localDateKey rollover invalidation, Phase 2→3→4 optimistic sequencing clarified.

## Dimension verdicts

| Dimension | Verdict | Notes |
|-----------|---------|-------|
| PRD v4 alignment | PASS | US-08/15 + FR-001/002/004 in; FR-003/005/007/006/007 explicitly out |
| Stack-assessment Gap 1 | PASS | `ScheduleBlock` on `(userId, localDateKey)`; budget row optional |
| Stack-assessment Gap 4 | PASS | Auth-only + guest stub + FR-017 note in `change.md` |
| L-04 NFR (200ms) | PASS | Phase 3 drag/resize + Phase 4 attachment oracles specified |
| Phase sequencing | PASS | schema → API → UI → attachments → belt e2e |
| Internal consistency | PASS | Phase 2 pessimistic API-first vs Phase 3–4 optimistic clarified |
| Feasibility | PASS | Greenfield timeline UX remains highest implementation risk |
| Pattern compliance | PASS | Repository seam + tRPC extend; isolation test naming added |
| Success criteria / Progress | PASS | Progress mirrors phase automated/manual bullets |
| Scope discipline | PASS | No timer-hub, RRULE, guest storage, or handoff creep |

## Findings

| ID | Severity | Impact | Finding | Recommended fix | Status |
|----|----------|--------|---------|-----------------|--------|
| F1 | CRITICAL | HIGH | Plan used `taskIds: string[]` / vague `focusTaskId` FK; `Task.id` is `Int @default(autoincrement())` in `prisma/schema.prisma` | Use `number` / `z.number().int()` throughout router, repository, and hooks | **closed** — plan Critical Details + router contract |
| F2 | HIGH | HIGH | Overlap validation read-check without transaction allows concurrent double-booking | Wrap create/update in DB transaction with same-day re-read before write | **closed** — plan Critical Details + schedule-blocks contract |
| F3 | HIGH | MEDIUM | `deleteContextTag` left ambiguous (reject vs null FK) | Reject with calm message when blocks reference tag | **closed** — router contract + integration test bullet |
| F4 | HIGH | MEDIUM | Vertical timeline assumed task-list `@dnd-kit` precedent; `task-list.tsx` uses `SortableContext` reorder, not free Y-position drag/resize | Phase 3: `Draggable` + custom Y→minute modifiers; spike if needed | **closed** — plan Phase 3 contract + brief |
| F5 | MEDIUM | MEDIUM | Axis bounds underspecified — blocks could span past 22:00 or use 0–1439 while UI shows 06–22 | Server rejects unless `start >= 360` and `start + duration <= 1320` | **closed** — Critical Details + schema note |
| F6 | MEDIUM | MEDIUM | `useDayPlan` visibility rollover invalidates `getOrCreate` + `task.list` but plan did not require `listBlocks` invalidation | Share `localDateKey` from `useDayPlan`; invalidate schedule query on rollover | **closed** — Critical Details + hook contract |
| F7 | MEDIUM | MEDIUM | No `*-isolation.test.ts` file despite repo convention (`task-isolation.test.ts`, etc.) | Add `day-plan-schedule-isolation.test.ts` | **closed** — Phase 2 + Progress 2.2 |
| F8 | MEDIUM | LOW | Custom tag cap/sanitize only vaguely mentioned in brief open risks | Trim, strip control chars, max 32 chars, cap 50 tags/user | **closed** — router contract + brief |
| F9 | MEDIUM | LOW | Phase 4 attachment mutators lacked explicit L-04 optimistic oracle | Phase 4 optimistic attachment/context + hook tests in Phase 5 | **closed** — hook + Phase 4 sequencing |
| F10 | MEDIUM | LOW | Phase 2 “pessimistic OK” vs Phase 3 “optimistic” looked contradictory | Document intentional API-first then UI optimistic phases | **closed** — useDaySchedule contract |
| F11 | LOW | LOW | `ScheduleRepository` added but `useDaySchedule` uses direct tRPC like existing `useDayPlan` | Accept as consistent with day-plan precedent; repository is guest seam | **accepted** — no change |
| F12 | LOW | LOW | `setBudget` remains pessimistic (pre-existing) | Out of scope for S-54 | **accepted** |
| F13 | INFO | LOW | PLANNING block type without S-55 runtime | OK — schedule slot only; documented in Critical Details | **closed** |
| F14 | INFO | LOW | First `/plan` belt e2e spec | Plan uses API seed + visibility assert; `@skip-belt` for drag — sound | **accepted** |
| F15 | INFO | LOW | MCP `get_day_plan` extension marked optional | Correctly deferred | **accepted** |

## Strengths

- Correctly replaces `ComingSoonPreview` + `DayCalendarMock` only for auth; guest path preserved verbatim.
- Schedule entities independent of `DayPlan` budget row — matches `getOrCreate` zero-default behavior.
- Overlap = server `CONFLICT` + client rollback aligns with calm product voice.
- FR-002 batch checklist + meta label and FR-004 fixed enum + custom tags resolve PRD OQ #2/#3.
- Progress section fully enumerates phase success criteria (5 phases, automated + manual).
- Explicit out-of-scope list prevents S-55/S-56/S-58 timer-hub and RRULE creep.

## Checklist

- [x] US-08, US-15, FR-001–004 in scope; FR-003/005/007 out
- [x] Gap 1: same `localDateKey`, no parallel day model
- [x] Gap 4: auth-first exception documented (FR-017)
- [x] L-04: per-surface optimistic oracles for drag/resize and attachments
- [x] Phase order: schema → API → UI → attachments → tests
- [x] Overlap concurrency addressed (transaction)
- [x] Task ID types match Prisma (`Int`)
- [x] Axis bounds prevent midnight-span blocks on 06–22 view
- [x] Isolation test file planned
- [x] E2e belt: seed + smoke, skip fragile drag
- [x] Progress matches phase Success Criteria
- [x] No timer-hub / wedge edits

## Triage

| ID | Suggested action |
|----|------------------|
| F1–F10 | **Fixed in plan.md / plan-brief.md / change.md** |
| F4 (residual) | Monitor in Phase 3 — spike if `Draggable` modifiers insufficient |
| F11–F15 | Accepted / informational — no block |

## Decision

**APPROVED** — all CRITICAL/HIGH and actionable MEDIUM findings fixed in plan artifacts. Proceed to `/10x-implement day-schedule-timeline phase 1` on `features/day-schedule-timeline` after `git switch main; git pull; git switch -c features/day-schedule-timeline`.

**Top residual risks:** (1) Phase 3 vertical drag/resize UX is greenfield despite `@dnd-kit` being present; (2) overlap transaction correctness needs integration test under concurrent mock; (3) Phase 4 batch checklist UX complexity.

**Next:** `/10x-implement day-schedule-timeline phase 1`
