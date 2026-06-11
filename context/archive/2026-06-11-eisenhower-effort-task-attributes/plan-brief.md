# F-05 Eisenhower Task Attributes — Plan Brief

> Full plan: `context/changes/eisenhower-effort-task-attributes/plan.md`
> Research: `context/changes/eisenhower-effort-task-attributes/research.md`

## What & Why

FlowState's suggester still treats `weight` as a single urgency proxy. F-05 adds **importance**, **urgency**, optional **effort minutes**, and **commitment horizon** on Task, migrates existing `weight` → `urgency`, and ships **scorer v2** (Eisenhower × session context, Pareto when Focused, Ockham when Fading). This is the substrate for S-27 daily standing + capacity-aware suggestions.

## Starting Point

Task has `workType`, `weight` (1–3), `sortOrder`. Scorer v1 base = `weight`; S-23 expander factors are session-only. Guest blob mirrors server fields. Strong Vitest coverage on scorer + suggestion API.

## Desired End State

Users set importance/urgency (compact pickers), optional effort, and horizon at create/edit — guest and logged-in paths match. Suggestions rank via v2 formula; rationale expander shows Eisenhower/importance/effort/horizon chips when dominant. Existing tasks keep sensible defaults after migration. `pnpm test` + `pnpm check` green; no belt e2e required.

## Key Decisions Made

| Decision | Choice | Why | Source |
| -------- | ------ | --- | ------ |
| `weight` migration | Copy → `urgency`; default `importance: 2`; keep `weight` column synced on write | Roadmap legacy fallback; no data loss | Research |
| Scorer base | `urgency × importance` then session multipliers | Eisenhower matrix per roadmap | Plan |
| Pareto (Focused) | `importance ≥ 3` → base × 1.15 | Emphasize high-impact work when energy allows | Plan |
| Ockham (Fading) | `effortMinutes ≤ 30` → × 1.12; `≥ 90` → × 0.88; null → neutral | Unknown effort must not penalize | Research + Plan |
| Horizon boost | ASAP × 1.18; THIS_WEEK × 1.06; WHEN_POSSIBLE × 1.0 | Calm defaults; ASAP visible on card | Plan |
| Tie-break | score → sortOrder → urgency → importance → createdAt | Replace weight tie-break | Plan |
| UI | Relabel weight control to **Urgency**; add Importance, Effort, Horizon in Details | Compact; avoids three confusing "weight" labels | Research |
| S-23 scope | In-slice: new factor keys + chip labels | Roadmap explicit; deferred in S-23 archive | Research |
| E2E | Vitest only | Foundation CRUD; belt unchanged per test-plan | test-plan |

## Scope

**In scope:** Prisma enum + migration backfill; domain/guest/tRPC parity; scorer v2 + expander; task-list UI; suggestion card ASAP badge; unit/integration tests.

**Out of scope:** Drop `weight` column; Eisenhower 2×2 UI; S-27 capacity logic; belt e2e; `DESIGN.md` visual polish.

## Architecture / Approach

Bottom-up: schema/types → scorer v2 (TDD) → task + suggestion routers → guest merge → UI pickers → rationale expander refresh. All v2 math stays in `src/lib/scoring/`; routers map DB → `ScoringTask` only.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Schema & domain types | Columns, enum, backfill, guest Zod | Migration backfill drift |
| 2. Scorer v2 | Formula + pickBestTask tie-break + tests | Coefficient tuning — unit tests as oracle |
| 3. Task & suggestion API | CRUD inputs, suggestion mapping | Legacy weight sync on write |
| 4. Guest parity | Repositories + merge import | Risk #5 merge field loss |
| 5. Task list UI | Pickers + badges + mutation defaults | Details panel clutter |
| 6. Rationale expander | New keys, chips, suggestion breakdown tests | Factor headline overlap |

**Prerequisites:** S-04, S-06 done; feature branch `features/eisenhower-effort-task-attributes`  
**Estimated effort:** ~4–6 sessions across 6 phases

## Open Risks & Assumptions

- Four new attributes may feel heavy at create — mitigated by defaults and collapsed Details panel.
- Coefficients are deterministic and test-locked; product can tune later without schema change.
- `weight` column remains until post-F-05 cleanup slice.

## Success Criteria (Summary)

- User can set importance, urgency, effort, horizon on tasks (guest + auth).
- Suggestion order changes predictably when importance/urgency/horizon differ (unit-proven).
- S-23 expander surfaces at least one new task-attribute factor when it wins.
- All automated plan Progress items pass locally and in CI.
