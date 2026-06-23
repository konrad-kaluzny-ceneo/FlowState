# CI/CD PR Code Review — Plan Brief

> Full plan: `context/changes/ci-cd-code-review/plan.md`
> Frame brief: `context/changes/ci-cd-code-review/frame.md`
> Research: `context/changes/ci-cd-code-review/research.md`

## What & Why

> **The actual problem to plan around is**: reconcile the `ci-cd-code-review` change with an already-shipped Cursor SDK PR review workflow — explicitly deciding which `requirements.md` items are still desired versus which were superseded by the SDK implementation, then closing the agreed gaps.

Extend the advisory review with composite action extraction, C1–C6 scoring, deterministic pass/fail labels, and on-demand retry — without making it a merge gate.

## Starting Point

`cursor-review.yml` + `scripts/cursor-review/*` already run cloud reviews and post PR comments. Missing: composite action, numeric scores, `ai-cr:*` labels, label retry, stable comment upsert, and PR metadata inputs.

## Desired End State

Every PR push (with API key) yields one upserted comment with Scores + Findings, plus `ai-cr:passed` or `ai-cr:failed`. Adding `ai-cr:review` re-runs. Without key: silent skip, green job. Blocking CI unchanged.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Scope | Gap completion on shipped stack | Workflow already exists; not greenfield | Frame |
| Advisory stance | Keep non-blocking | Matches `ci.yml` separation | Research |
| Scoring | C1–C6, fail if &lt; 6 or critical | Per reconciled `requirements.md` | Research |
| Score → labels | Sidecar `review.json` from `review.ts` | Deterministic, unit-testable | Plan |
| Agent failure | Job succeeds + `ai-cr:failed` | Advisory CI must not block merge | Plan |
| Label bootstrap | Idempotent `gh label create` in workflow | Zero manual repo setup | Plan |
| `AGENTS.md` | No `CURSOR_API_KEY` mention | Secret may be absent | Research |
| Comment marker | `<!-- cursor-review-v1 -->` | Fixes upsert duplicate bug | Research |

## Scope

**In scope:** marker fix, prompt/scores, parser + JSON sidecar, Vitest, composite action, label ensure/apply, `labeled` trigger, README update

**Out of scope:** merge gate, `AGENTS.md` secret docs, `ci.yml` changes, fork PRs, parked business/arch criteria, GHA e2e tests

## Architecture / Approach

```
PR event / ai-cr:review label
  → cursor-review.yml (guards, ensure labels)
  → .github/actions/cursor-review (checkout, pnpm review:cloud)
  → review.ts → review.md + review.json
  → workflow: upsert comment, apply ai-cr:passed|failed
```

Parser and pass/fail logic live in TypeScript; workflow reads JSON — no shell regex on LLM output.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Review contract | Marker, prompt, parser, sidecar JSON, Vitest | LLM may omit Scores — parser must degrade safely |
| 2. Composite action | `.github/actions/cursor-review`, slim workflow | First composite action in repo — follow `ci.yml` patterns |
| 3. Labels & triggers | `ai-cr:*` labels, retry, failure path, README | `issues: write` permission expansion |

**Prerequisites:** `CURSOR_API_KEY` on repo for manual verification; feature branch `features/ci-cd-code-review`

**Estimated effort:** ~2–3 implementation sessions across 3 phases

## Open Risks & Assumptions

- Old PR comments with legacy marker won't upsert — one-time duplicate possible until old comment closed
- LLM score format drift handled by tolerant parser + fail-safe (`ai-cr:failed` if scores unparseable)
- Label colors are GitHub defaults; no org-wide label policy conflict assumed

## Success Criteria (Summary)

- Single upserted PR comment per PR with Scores section
- `ai-cr:passed` / `ai-cr:failed` matches `review.json` rules
- `ai-cr:review` triggers re-run; missing key skips cleanly
