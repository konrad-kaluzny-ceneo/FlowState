# Opportunity Map

## Context

- **Project / context**: FlowState — solo-maintained Pomodoro app; recent L2–L5 architect artifacts (repo-map, feature analysis, refactor plan, domain distillation)
- **Data constraint**: Local / read-only / non-sensitive — analysis on the FlowState codebase, git history, and static context artifacts (no production customer data)
- **Date**: 2026-06-18

## Map

| Signal | Existing / default response | Thin complement | First useful version | Data risk | Direction if valuable |
|---|---|---|---|---|---|
| Timer hub blast radius — every timer change touches hook + dashboard + hook tests + E2E | Mental checklist; static `repo-map.md`; ad-hoc co-change counts in research docs | Pre-change digest joining depcruise fan-out, git co-change pairs, and test file map for touched modules | Script/report: given a path (e.g. `use-pomodoro-cycle.ts`), print dependents, historical co-changed files, and required test layers | local / read-only | Review / CI gate |
| Wedge beat mutex — ≤1 interstitial + ≤1 gate enforced via scattered `&&` in dashboard | Roadmap B-05 → B-06 → F-07; `user-flow.md` T-01–T-06; active `wedge-transition-conductor` slice | Pure `transition-conductor.ts` consumed by dashboard (already chosen) | In-flight feature work — not a separate prototype | local | Feature (product) |
| Dual client data-access — repo layer vs direct `api.*` in hook/dashboard | Planned K2 char tests in L4 rollout; manual code review | ast-grep or char-test rule listing every `api.*` call outside `useRepositories()` | One-shot scan + failing test on new bypasses | local / read-only | Review / CI gate |
| Onboarding / territorial knowledge — folder depth ≠ architectural weight | `context/map/repo-map.md`, architect report, AGENTS.md | Keep map updated after major slices; link from PR template | Static map already exists — maintain, don't rebuild | local | Wait / no build |
| Domain language ↔ code drift — PRD terms (Wedge, beat, S-24 pause) lack code anchors | `context/domain/`, event-storming board, roadmap refs | Glossary diff: PRD term → grep/ast-grep symbol hits + explicit "missing" rows | Markdown table generated from `context/domain/` vs `src/` search | local / read-only | Internal tool |
| Refactor rollout manual gates — L4 phases require sign-off with no consolidated readiness view | Per-change `plan.md` Progress checkboxes; roadmap Stream N | Rollout status digest reading `context/changes/*/plan.md` Progress + CI gate names | Single markdown status page for B-05 → F-07 → K1 → K2 | local | Internal tool |

## Recommended First Candidate

```text
Candidate:
Timer slice change-impact digest

Reads:
dependency-cruiser output on `src/`; git log co-change pairs for timer hub files;
static test catalog from repo-map / test-plan (hook tests, dashboard smoke, e2e belt specs)

Returns:
Short pre-change report — e.g. "Touching use-pomodoro-cycle.ts → 19 dependents;
historically co-changed with pomodoro-dashboard (35 commits), e2e pomodoro-cycle.spec (27);
run: hook tests + dashboard smoke + e2e:belt"

Does not do:
Replace repo-map; auto-fix code; enforce gates in CI (yet); cover E2E harness vs production parity

Data risk:
local / read-only — runs on developer clone and exported depcruise JSON

Direction if it proves valuable:
Review / CI gate — PR comment or pre-push hook when timer-slice paths change
```

## Why This Candidate

- **Repeats regularly** — ~50% of git activity is the timer vertical slice; blast radius is the recurring cost, not a one-time onboarding problem.
- **Joins two sources** — depcruise structure and git co-change history answer different questions; neither alone prevents missed seams.
- **Clear manual pain today** — L3 documents 19 fan-out + 27 E2E co-changes; that knowledge lives in research prose, not in a repeatable check before each edit.
- **Read-only and throwaway-safe** — no prod data, no new system of record; validates value before wiring CI.
- **Does not duplicate in-flight work** — beat mutex (F-07) and ACL char tests (K2) already have product/refactor paths; this complements them at the planning layer.
- **Not the others** — repo-map solves onboarding once; domain glossary diff is valuable but lower frequency; rollout status digest serves meta-process, not daily coding friction.

## Next Direction If Valuable

**Review / CI gate** — if the digest becomes habit on every timer touch, promote to a PR comment bot or lefthook step scoped to `src/hooks/use-pomodoro-cycle.ts`, `pomodoro-dashboard.tsx`, and `src/lib/wedge/`.

**Chosen next step (2026-06-18):** Validate, then shape — `/10x-mom-test` → `/10x-shape` → `/10x-prd` → `/10x-roadmap`.
