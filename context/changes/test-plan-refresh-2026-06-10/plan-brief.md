# Test Plan Refresh — E2E Belt Merge Gate — Plan Brief

> Full plan: `context/changes/test-plan-refresh-2026-06-10/plan.md`
> Research: `context/changes/test-plan-refresh-2026-06-10/research.md`

## What & Why

Document the agreed **12-test E2E belt merge gate** in `context/foundation/test-plan.md` so CI can target ≤3–4 min while risks #1–#7 keep browser entry points. Phase 4 wired the full 49-test catalog as the gate; belt realigns with §1 cost × signal without implementing code in this change.

## Starting Point

On disk today: full `pnpm test:e2e` on every PR (~49 tests, `E2E_WORKERS=1`, ~6–15 min). Test plan §5 requires full e2e; no Phase 7 row; no belt cookbook. Implementation (script, tags, CI swap, auth pool) belongs in `testing-e2e-belt-fast`.

## Desired End State

Readers of `test-plan.md` see belt-as-merge-gate in §1, updated Risk Response Guidance, Phase 7 row at `not started`, §4/`§5` naming `test:e2e:belt`, §6.3 canonical 12-test table, §6.6 rollout prerequisites, §7 negative space for full catalog, §8 ledger stamped 2026-06-10. Full suite documented as ad-hoc local + optional pre-release manual only.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|----------|--------|------------------|--------|
| Phase ordering | Phase 7 before Phase 5 mutation | Belt unblocks merge velocity; mutation ROI is separate | Plan |
| Full-suite cadence | Ad-hoc local + optional pre-release manual | Avoid nightly CI cost; belt covers merge signal | Plan |
| Vitest gap audit | Deferred to `testing-e2e-belt-fast` | This refresh documents belt table and demotion intent only | Research / Plan |
| Risk table rows | #1–#7 unchanged | Scenarios frozen; only Guidance columns get belt/Vitest split | Plan |
| Scope boundary | Documentation only in `test-plan.md` | AGENTS.md/CI/code sync ships with implementation change | Research |

## Scope

**In scope:** Edits to `context/foundation/test-plan.md` §1–§8 per four plan phases; `change.md` status → `planned`.

**Out of scope:** Code, CI, `package.json`, `AGENTS.md`, Playwright specs, Vitest backfill, nightly CI, per-file gap audit.

## Architecture / Approach

Single-file documentation refresh in four section-aligned phases. Canonical belt inventory (10 spec files, 12 tests) lives in plan § Critical Implementation Details and lands in §6.3. Demoted 11 e2e files named with delete-after-Vitest intent; implementation sequencing documented in §6.6 for `testing-e2e-belt-fast`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|------------------|----------|
| 1. Strategy + Risk + Phase 7 row | §1 belt principle; Guidance column updates; §3 row 7 | Over-editing §2 scenario table |
| 2. Stack + Quality Gates | §4 belt script row; §5 gate swap | Implying belt already on disk |
| 3. Belt cookbook + rollout | §6.3 12-test table; §6.6 prerequisites | Duplicating Vitest audit detail |
| 4. Negative space + ledger | §7 exclusions; §8 stamp; header date | Missing full acceptance review |

**Prerequisites:** `research.md` and `digest.md` complete; `test-plan.md` readable on branch.

**Estimated effort:** ~1 session, 4 small doc-edit passes with `pnpm check` each.

## Open Risks & Assumptions

- Belt script/command documented as **planned** until `testing-e2e-belt-fast` lands — readers must not assume CI already runs belt.
- AGENTS.md still says full e2e until follow-up change syncs docs.
- Demotion list assumes Vitest backfill succeeds in follow-up; no gap audit in this plan.

## Success Criteria (Summary)

- All `digest.md` acceptance sections reflected in `test-plan.md`
- `pnpm check` passes after each phase
- Manual diff confirms §2 risk rows unchanged and §3 rows 5–6 untouched
- No files changed outside `test-plan.md` for implementation work
