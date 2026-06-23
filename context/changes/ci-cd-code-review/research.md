---
date: 2026-06-22T12:00:00+02:00
researcher: Cursor Agent
git_commit: e04e72313d545cf2374fc2486fe5ae038c63b29d
branch: main
repository: FlowState
topic: "Reconcile ci-cd-code-review requirements with shipped Cursor SDK PR review workflow"
tags: [research, codebase, ci-cd, cursor-review, github-actions]
status: complete
last_updated: 2026-06-22
last_updated_by: Cursor Agent
last_updated_note: "Product decisions recorded; requirements.md rewritten"
---

# Research: Reconcile ci-cd-code-review requirements with shipped Cursor SDK PR review workflow

**Date**: 2026-06-22T12:00:00+02:00  
**Researcher**: Cursor Agent  
**Git Commit**: `e04e72313d545cf2374fc2486fe5ae038c63b29d`  
**Branch**: `main`  
**Repository**: [konrad-kaluzny-ceneo/FlowState](https://github.com/konrad-kaluzny-ceneo/FlowState)

## Research Question

What is the current state of PR code review CI/CD in FlowState, and how does it compare to `requirements.md` for change `ci-cd-code-review`? What work remains, and what product decisions block `/10x-plan`?

## Summary

The **first PR code review workflow already shipped** on 2026-06-18 as an **advisory** Cursor SDK path (`.github/workflows/cursor-review.yml` + `scripts/cursor-review/*`). The `ci-cd-code-review` change folder was added **the next day** with a **different spec** (composite action, 1–10 scoring, `ai-cr:*` labels, label-triggered retry) and was **parked ~22 minutes later**. None of those spec-only features exist in code.

Planning must treat this as **gap reconciliation on the shipped stack**, not greenfield workflow construction. Of eight requirement lines, **two are implemented** (PR workflow, PR comment), **one is partial** (git diff via agent self-compute; no PR title/description inputs), **four are missing** (composite action, numeric criteria, pass/fail labels, label retry), and **two parked items** remain intentionally unbuilt.

A **bug** in comment upsert may create duplicate PR comments: the workflow searches for `<!-- cursor-review -->` but `review.ts` writes `<!-- cursor-review agent=... run=... -->`, which does not contain that exact substring.

**Product decisions (2026-06-22):** keep composite action, 1–10 scoring (C1–C6), `ai-cr:*` labels/retry; stay advisory; `requirements.md` rewritten; change **active**; no `CURSOR_API_KEY` in `AGENTS.md`.

## Detailed Findings

### Shipped advisory workflow (`cursor-review.yml`)

- **Role**: Advisory only — runs in parallel with blocking `ci.yml`; not a merge gate ([cursor-review.yml:1-5](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/e04e72313d545cf2374fc2486fe5ae038c63b29d/.github/workflows/cursor-review.yml#L1-L5)).
- **Triggers**: `pull_request` (`opened`, `synchronize`, `reopened`) + `workflow_dispatch` ([cursor-review.yml:9-12](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/e04e72313d545cf2374fc2486fe5ae038c63b29d/.github/workflows/cursor-review.yml#L9-L12)). No `labeled` trigger.
- **Fork guard**: Skips fork PRs unless manually dispatched ([cursor-review.yml:26](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/e04e72313d545cf2374fc2486fe5ae038c63b29d/.github/workflows/cursor-review.yml#L26)).
- **Graceful skip**: Missing `CURSOR_API_KEY` → GitHub notice, job succeeds, later steps skipped ([cursor-review.yml:28-38](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/e04e72313d545cf2374fc2486fe5ae038c63b29d/.github/workflows/cursor-review.yml#L28-L38)).
- **Review invocation**: `pnpm review:cloud` with PR head SHA, optional `--pr-url`, auto `--change-id` for `features/*` branches ([cursor-review.yml:60-84](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/e04e72313d545cf2374fc2486fe5ae038c63b29d/.github/workflows/cursor-review.yml#L60-L84)).
- **PR comment upsert**: PATCH existing or create new via `gh api` ([cursor-review.yml:86-100](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/e04e72313d545cf2374fc2486fe5ae038c63b29d/.github/workflows/cursor-review.yml#L86-L100)).

### Review scripts (`scripts/cursor-review/`)

- **Entry points**: `pnpm review` (local sandbox) / `pnpm review:cloud` (CI) → `review.ts` ([package.json:32-33](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/e04e72313d545cf2374fc2486fe5ae038c63b29d/package.json#L32-L33)).
- **SDK**: `@cursor/sdk` `Agent.create` / `Agent.resume`, model `composer-2.5` ([review.ts:136-166](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/e04e72313d545cf2374fc2486fe5ae038c63b29d/scripts/cursor-review/review.ts#L136-L166)).
- **Auth soft-skip**: Invalid key → `::notice` + `exit(0)` in CI path ([review.ts:114-132](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/e04e72313d545cf2374fc2486fe5ae038c63b29d/scripts/cursor-review/review.ts#L114-L132)).
- **Prompt**: Cloud agent self-computes diff via `git fetch` + `git diff`; findings use severity tiers (critical/high/medium/low), not 1–10 scores ([build-prompt.ts:42-70](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/e04e72313d545cf2374fc2486fe5ae038c63b29d/scripts/cursor-review/build-prompt.ts#L42-L70)).
- **Plan drift context**: Optional `--change-id` injects `change.md` + `plan.md` ([build-prompt.ts:12-28](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/e04e72313d545cf2374fc2486fe5ae038c63b29d/scripts/cursor-review/build-prompt.ts#L12-L28)) — capability not in original `requirements.md`.
- **Comment marker**: Header written as `<!-- cursor-review agent=... run=... -->` ([review.ts:189](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/e04e72313d545cf2374fc2486fe5ae038c63b29d/scripts/cursor-review/review.ts#L189)).

### Blocking CI (`ci.yml`) — separate concern

- Merge gate: `quality` → `e2e` on PR/push to `main` ([ci.yml](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/e04e72313d545cf2374fc2486fe5ae038c63b29d/.github/workflows/ci.yml)).
- `AGENTS.md` references only `ci.yml` for required PR checks — not `cursor-review` ([AGENTS.md:44](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/e04e72313d545cf2374fc2486fe5ae038c63b29d/AGENTS.md#L44)).
- Archived slice `testing-quality-gates-wiring` (2026-06-06) wired blocking gates; advisory review is a parallel track.

### Gap matrix: `requirements.md` vs shipped

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | GHA workflow on every PR to master | **IMPLEMENTED** | Triggers on all PRs; default branch is `main`, not `master` |
| 2 | Composite action for review | **MISSING** | No `.github/actions/` directory |
| 3 | Inputs: PR title, description, git diff | **PARTIAL** | Diff via agent self-compute; title/description not passed |
| 4 | Criteria scored 1–10 (`{{CR_CRITERIA}}`) | **MISSING** | Severity buckets only; placeholder never filled |
| 5 | PR comment with summary | **IMPLEMENTED** | Upsert from `reports/review.md` |
| 6 | Labels `ai-cr:failed` / `ai-cr:passed` | **MISSING** | Grep: only in `requirements.md` / `frame.md` |
| 7 | On-demand retry via `ai-cr:review` label | **MISSING** | No `labeled` trigger; `workflow_dispatch` only |
| 8 | Parked: business alignment, architectural fit | **NOT IMPLEMENTED** | Intentionally deferred per spec |

### Comment upsert bug

Workflow searches comments containing exact substring `<!-- cursor-review -->` ([cursor-review.yml:94](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/e04e72313d545cf2374fc2486fe5ae038c63b29d/.github/workflows/cursor-review.yml#L94)). Saved output uses `<!-- cursor-review agent=${agentId} run=${resultId} -->` ([review.ts:189](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/e04e72313d545cf2374fc2486fe5ae038c63b29d/scripts/cursor-review/review.ts#L189)). The extra ` agent=... run=...` between `cursor-review` and `-->` means `contains("<!-- cursor-review -->")` likely **never matches** after the first run → duplicate comments on each push.

**Fix direction**: Use a stable marker in both places (e.g. `<!-- cursor-review-v1 -->` as prefix, search for that substring).

## Code References

- [`.github/workflows/cursor-review.yml`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/e04e72313d545cf2374fc2486fe5ae038c63b29d/.github/workflows/cursor-review.yml) — Advisory GHA workflow (triggers, skip, review, comment)
- [`.github/workflows/ci.yml`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/e04e72313d545cf2374fc2486fe5ae038c63b29d/.github/workflows/ci.yml) — Blocking merge gate (quality + e2e)
- [`scripts/cursor-review/review.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/e04e72313d545cf2374fc2486fe5ae038c63b29d/scripts/cursor-review/review.ts) — SDK orchestration, auth skip, output header
- [`scripts/cursor-review/build-prompt.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/e04e72313d545cf2374fc2486fe5ae038c63b29d/scripts/cursor-review/build-prompt.ts) — Prompt template, severity findings, plan context
- [`scripts/cursor-review/git-scope.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/e04e72313d545cf2374fc2486fe5ae038c63b29d/scripts/cursor-review/git-scope.ts) — Merge-base, diff helpers, `features/*` change-id
- [`scripts/cursor-review/README.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/e04e72313d545cf2374fc2486fe5ae038c63b29d/scripts/cursor-review/README.md) — Ops setup, advisory stance
- [`.cursor/agents/code-reviewer.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/e04e72313d545cf2374fc2486fe5ae038c63b29d/.cursor/agents/code-reviewer.md) — Subagent referenced in prompt
- [`context/changes/ci-cd-code-review/requirements.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/e04e72313d545cf2374fc2486fe5ae038c63b29d/context/changes/ci-cd-code-review/requirements.md) — Original spec sketch (partially superseded)
- [`context/changes/ci-cd-code-review/frame.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/e04e72313d545cf2374fc2486fe5ae038c63b29d/context/changes/ci-cd-code-review/frame.md) — Framing brief (uncommitted at research time)

## Architecture Insights

1. **Advisory vs blocking separation** is intentional: separate workflow file, no `needs:` link to `ci.yml`, optional secret with graceful skip, not in branch protection or `test-plan.md` required gates.
2. **No composite actions** exist anywhere in the repo — inline workflow steps are the only GHA pattern today.
3. **Secret convention**: `CURSOR_API_KEY` is documented in `.env.example` and scoped to `scripts/cursor-review` only — excluded from `src/env.js` (Next.js app secrets stay separate).
4. **Cloud vs local**: CI always uses cloud agent with PR-attached repo; local uses precomputed diff in prompt. Change-id plan context auto-detected from `features/<id>` branch naming.
5. **Shipped capabilities beyond spec**: plan-drift context (`--change-id`), cloud VM self-scoped diff, `code-reviewer` subagent, manual `workflow_dispatch` and CLI `--resume`.

## Historical Context (from prior changes)

| Date | Event | Commit |
|------|--------|--------|
| 2026-06-06 | Blocking CI merge gate wired | `c48c512` — archive `testing-quality-gates-wiring` |
| 2026-06-18 | Cursor SDK + `cursor-review.yml` landed | `04c8dde` … `0b461f3` |
| 2026-06-19 | Change folder added (docs only) | `33e2023` |
| 2026-06-19 | Change parked (`DO NOT START YET`) | `ead2382` |
| 2026-06-20 | Invalid key → advisory skip hardened | `c87bcfd` (PR #145) |

- **Roadmap**: No entry for `ci-cd-code-review` or PR code review.
- **test-plan.md**: Phase 4 quality gates = blocking `ci.yml` only; no advisory review row.
- **Archive**: No slice for `ci-cd-code-review` or `cursor-review`.
- **Committed HEAD** (`ead2382`): `status: new (DO NOT START YET, PARKED FOR LATER)`; working tree had `status: preparing` (uncommitted at research time).

## Related Research

- `context/changes/ci-cd-code-review/frame.md` — Pre-research framing with hypothesis table (converges with this document)
- `context/archive/2026-06-06-testing-quality-gates-wiring/` — Blocking CI wiring (adjacent, not PR review)

## Product decisions (2026-06-22)

| Decision | Outcome |
| --- | --- |
| Composite action | **Keep** — extract review steps to `.github/actions/cursor-review/` |
| 1–10 scoring | **Keep** — six criteria (C1–C6) aligned with `code-reviewer` agent; mean score + pass rules in `requirements.md` |
| `ai-cr:*` labels / retry | **Keep** — `ai-cr:passed` / `ai-cr:failed` + `ai-cr:review` label trigger |
| Advisory design | **Keep** — not a merge gate; graceful skip when no key |
| `requirements.md` | **Rewritten** — reconciled with shipped baseline + gap list |
| Change status | **Active** |
| `AGENTS.md` + `CURSOR_API_KEY` | **Do not add** — secret may be absent; ops docs stay in `scripts/cursor-review/README.md` only |

## Open Questions

1. **Engineering**: Should agent run failures (`exit 2`) soft-fail with notice (like auth skip) or continue hard-failing the advisory job? (`requirements.md` maps run error → `ai-cr:failed`.)
2. **Engineering**: Exact pass threshold (currently criterion < 6 or any `critical` finding → fail) — confirm in plan.

## Implications for `/10x-plan`

Plan **incremental work** on the `cursor-review` stack per reconciled `requirements.md`:

1. Fix comment upsert marker bug (stable `<!-- cursor-review-v1 -->`).
2. Add composite action; slim workflow to orchestration + comment + labels.
3. Extend `build-prompt.ts` with Scores section (C1–C6), `path:line` locations, optional PR title/description.
4. Add `labeled` trigger for `ai-cr:review`; label apply/remove logic for `ai-cr:passed` / `ai-cr:failed`.
5. Parse scores from review output for label decision (or structured output contract).
