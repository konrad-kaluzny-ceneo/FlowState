# Timer change-impact digest — Plan Brief

> Full plan: `context/changes/timer-change-impact-digest/plan.md`
> Research: `context/team/mom-test-validation.md`, `context/foundation/stack-assessment.md` (thread section)
> Shape: `context/foundation/shape-notes.md` — Change thread: Timer change-impact digest
> PRD: `context/foundation/prd.md` — Change thread PRD: Timer change-impact digest

## What & Why

Read-only maintainer CLI: given a timer-hub file path, print top git co-changed paths and copy-paste test commands before editing — so blast-radius awareness is a 30-second terminal check, not a mid-slice repo-map hunt.

**Why:** Mom Test git replay showed 4/5 recent timer commits would gain co-change signal; stack is ready; product runtime must not change.

## Starting Point

FlowState has depcruise scripts, Vitest belt commands, and `scripts/agent-hooks/` ESM patterns, but no pre-change co-change tool. E2E layers appear in git co-change only (depcruise excludes `e2e/`).

## Desired End State

Maintainer runs `pnpm change-impact -- src/hooks/use-pomodoro-cycle.ts` and gets a one-screen report (<30s, exit 0) with co-change ranks and suggested `pnpm test` / `pnpm test:e2e:belt` commands. No `src/` product edits; optional fan-out count when depcruise succeeds.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| MVP scope | Git co-change + test catalog only | Replay value; full joiner duplicates repo-map | Shape / Mom Test |
| Runtime | Node ESM under `scripts/change-impact/` | Matches `scripts/agent-hooks/` precedent | Stack assess |
| Default `--since` | `2026-04-01` | Aligns with Mom Test replay window and product epoch | Plan |
| Default path | `src/hooks/use-pomodoro-cycle.ts` | Reference hub from opportunity map | Shape |
| Default `--top` | 8 | One screen; `--strict` raises to 15 | Plan |
| Depcruise | Optional fan-out count via spawn; never fail | `reports/` may be absent; E2E not in graph | Stack assess |
| CI / lefthook | Out of scope | Habit validation first (≥3 manual uses) | PRD non-goals |

## Scope

**In scope:**

- `pnpm change-impact` script + CLI flags (`--since`, `--top`, `--strict`)
- Pure modules: git co-change aggregation, static test-command map, report formatter
- Vitest unit tests for parsing/aggregation (mocked git)
- AGENTS.md maintainer section (post-ship)

**Out of scope:**

- CI gate, PR bot, lefthook hook
- Full depcruise graph rendering
- Auto-updating repo-map
- Changes to `src/` product code

## Architecture / Approach

```
pnpm change-impact [--since] [--top N] [--strict] [--] [path]
        │
        ├─► git log co-change counter (subprocess)
        ├─► static prefix → test commands (timer hub catalog)
        └─► optional: pnpm depcruise --focus (fan-out count only)
                │
                ▼
           stdout report (≤40 lines default)
```

Reuse project-root resolution patterns from `scripts/agent-hooks/lib/input.mjs`. Windows-safe git spawn (`shell: false`).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Co-change core | Git aggregation + CLI entry + `package.json` script | Git log performance on large history — mitigate with `--since` |
| 2. Report + catalog | Test commands, flags, formatted one-screen output | E2E paths mis-mapped — label `source: git` |
| 3. Tests + docs | Vitest for pure functions, optional depcruise, AGENTS.md | Over-testing CLI glue — test pure lib only |

**Prerequisites:** Git repo with history since 2026-04-01; pnpm; local clone on Windows dev machine.

**Estimated effort:** ~1 after-hours session across 3 phases.

## Open Risks & Assumptions

- Quiet-mode line threshold (FR-004) deferred — v1 uses `--top` / `--strict` only; no staged-diff integration.
- Maintainer habit unconfirmed until 3 manual uses before CI promotion (PRD OQ3).
- Assumes git is on PATH in dev environment (same as lefthook/agents).

## Success Criteria (Summary)

- `pnpm change-impact` on default path completes <30s with co-change table + test block.
- `pnpm check` and `pnpm test` green after adding script tests.
- Zero changes to FlowState app runtime behavior.
