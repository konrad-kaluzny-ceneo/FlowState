# Requirements: CI/CD PR code review (advisory)

> Reconciled with the shipped Cursor SDK stack (`cursor-review.yml` + `scripts/cursor-review/*`).
> See `research.md` for baseline audit. This change **extends** the advisory path — it does not
> add a merge gate.

## Role in CI

- **Advisory only** — runs in parallel with blocking `ci.yml` (`quality` + `e2e`). Not branch protection.
- **Optional secret** — when `CURSOR_API_KEY` is unset or invalid, the job succeeds with a GitHub notice (CI not blocked).
- **Fork PRs** — skipped unless manually dispatched (`workflow_dispatch`).
- **Ops docs** — setup lives in `scripts/cursor-review/README.md` and `.env.example` only. Do **not** document `CURSOR_API_KEY` in `AGENTS.md` (the secret may be absent; agents must not assume it exists).

## Shipped baseline (preserve)

These behaviors already exist and must not regress:

- GHA workflow on every PR to `main` (`opened`, `synchronize`, `reopened`) + `workflow_dispatch`
- Cursor SDK cloud agent (`pnpm review:cloud`), model `composer-2.5`
- PR head commit SHA (not branch name) for cloud checkout
- Auto `--change-id` from `features/<id>` branch names → plan-drift context in prompt
- Graceful skip on missing/invalid API key (workflow + `review.ts`)
- PR comment upsert from `reports/review.md` (fix marker bug — see Gaps)
- Local dev path: `pnpm review` (sandboxed; separate from CI)

## Gaps to implement

### 1. Composite action

Extract review execution from `cursor-review.yml` into `.github/actions/cursor-review/action.yml`.

**Composite action owns:**

- Checkout (full history, PR head ref)
- Node 22 + pnpm install
- Run `pnpm review:cloud` with inputs: `ref`, `pr-url`, `change-id`, `base` (default `main`)
- Outputs: `review-path`, `skipped` (key missing), `agent-id`, `run-id`

**Workflow keeps:**

- Triggers, concurrency, fork guard, key-availability check
- Post PR comment (needs `pull-requests: write` + `github.token`)
- Apply/remove `ai-cr:*` labels
- `labeled` handler for on-demand retry

### 2. Scored criteria (1–10)

Each criterion is scored **1–10** (1 = worst, 10 = best). Findings still use severity (`critical` / `high` / `medium` / `low`) for human scan; scores drive pass/fail labels.

| ID | Criterion | What to judge |
| --- | --- | --- |
| C1 | **Correctness** | Logic bugs, off-by-one timers, stale client state, race conditions |
| C2 | **Security** | Authn/authz at boundaries, XSS, injection, leaked secrets, guest vs auth paths |
| C3 | **Reliability** | Error handling at API/DB boundaries, session recovery, optimistic rollback |
| C4 | **Conventions** | AGENTS.md, DESIGN.md, Biome patterns, Prisma `@@map`, tRPC router registration |
| C5 | **Plan alignment** | When `--change-id` / plan context is present: drift, missing items, scope creep |
| C6 | **Tests** | Missing coverage on risky paths touched by the diff |

**Prompt contract** (`build-prompt.ts`):

- Instruct agent to emit a **Scores** section: one line per criterion (`C1: N/10 — brief rationale`).
- Findings must include **Location** as `path:line` or `path:start-end` (impl-review style).
- Overall score = arithmetic mean of C1–C6 (C5 omitted from mean when no plan context — renormalize over remaining criteria).

**Pass/fail for labels** (see Side-effects):

- `ai-cr:failed` if any criterion < 6, or any `critical` finding, or agent run error
- `ai-cr:passed` otherwise (and review completed successfully)

### 3. PR inputs

| Input | Required | Notes |
| --- | --- | --- |
| Git diff scope | Yes | Cloud agent self-computes via merge-base diff (shipped) |
| PR title | No | Pass to prompt when present; low cost |
| PR description | No | Pass when present; **cost tradeoff** — truncate (e.g. 2k chars) to cap tokens |

### 4. Comment upsert fix

Use a **stable HTML marker** in both `review.ts` output and workflow search (e.g. `<!-- cursor-review-v1 -->` as the first line). Agent/run metadata may follow on the same line or a second comment line, but the searchable substring must be identical.

### 5. Labels and on-demand retry

| Label | Color | When |
| --- | --- | --- |
| `ai-cr:passed` | Green | Review succeeded and pass/fail rules → pass |
| `ai-cr:failed` | Red | Review succeeded and pass/fail rules → fail, or agent run error |
| `ai-cr:review` | (neutral) | **Trigger only** — adding this label re-runs review; remove after run starts |

**Triggers:**

- Existing: `opened`, `synchronize`, `reopened`, `workflow_dispatch`
- Add: `labeled` when label name is `ai-cr:review`

On label-triggered run: remove `ai-cr:review` and previous `ai-cr:passed` / `ai-cr:failed` before applying new outcome.

## Expected side-effects

Every successful review (when key present and agent completes):

1. **PR comment** — upsert single comment with Summary, Scores, Findings, Strengths, Follow-ups
2. **Labels** — set `ai-cr:passed` or `ai-cr:failed` (mutually exclusive)

When skipped (no key): no comment, no labels, job succeeds with notice.

## Parked for later

- Business alignment (requires broader product context)
- Architectural fit (requires broader product context)

## Out of scope

- Merge-gate / branch-protection requirement for this workflow
- `CURSOR_API_KEY` in `AGENTS.md` or `src/env.js`
- Blocking `ci.yml` changes
- Fork PR automatic review (keep skip)
