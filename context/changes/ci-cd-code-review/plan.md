# CI/CD PR Code Review — Implementation Plan

## Overview

Extend the shipped **advisory** Cursor SDK PR review (`cursor-review.yml` + `scripts/cursor-review/*`) with composite action extraction, C1–C6 scored criteria, deterministic pass/fail via a JSON sidecar, and `ai-cr:*` labels with on-demand retry. Stays parallel to blocking `ci.yml` — not a merge gate. No `CURSOR_API_KEY` in `AGENTS.md`.

## Current State Analysis

- **Shipped**: advisory workflow on PR open/sync/reopen; `pnpm review:cloud`; PR comment upsert; graceful skip without secret; plan-drift context via `--change-id` (`cursor-review.yml`, `review.ts`, `build-prompt.ts`).
- **Missing**: composite action, 1–10 scores, `ai-cr:*` labels, `labeled` retry, PR title/description inputs, stable comment marker.
- **Bug**: comment upsert searches `<!-- cursor-review -->` but output writes `<!-- cursor-review agent=... -->` — duplicates on each push (`cursor-review.yml:94`, `review.ts:189`).
- **No tests** under `scripts/cursor-review/` today.

### Key Discoveries

- `code-reviewer.md` dimensions map cleanly to C1–C6 criteria in `requirements.md`.
- Repo has zero `.github/actions/` — first composite action sets the pattern (mirror `ci.yml` toolchain: checkout, pnpm, node 22).
- Label ensure step needs `issues: write` (create repo labels); PR label apply needs `pull-requests: write`.

## Desired End State

On every same-repo PR push (when `CURSOR_API_KEY` is set):

1. Cloud agent reviews diff vs `main`, emits markdown with Summary, **Scores** (C1–C6), Findings (`path:line`), Strengths, Follow-ups.
2. `review.ts` writes `reports/review.md` (upsert marker `<!-- cursor-review-v1 -->`) and `reports/review.json` (parsed scores + `passed` boolean).
3. Workflow upserts **one** PR comment and sets **`ai-cr:passed`** or **`ai-cr:failed`** (mutually exclusive).
4. Adding **`ai-cr:review`** label re-runs review; label removed at run start along with stale pass/fail labels.

When key absent: job succeeds, notice only — no comment, no labels.

**Verify**: open a test PR on `features/ci-cd-code-review`; push twice → single comment updates; labels match JSON `passed`; add `ai-cr:review` → re-run.

## What We're NOT Doing

- Merge-gate / branch-protection for `cursor-review`
- `CURSOR_API_KEY` in `AGENTS.md` or `src/env.js`
- Changes to blocking `ci.yml`
- Fork PR automatic review
- Parked business/architectural alignment criteria
- E2E tests for the GHA workflow (script-level Vitest only)

## Implementation Approach

Three incremental phases shipped in code (1–3); **Phase 4** closes CI verification gaps when Cursor GitHub integration is unavailable (local review on GHA runner, drop `--pr-url`).

## Critical Implementation Details

**Marker contract**: First line of `reports/review.md` must start with `<!-- cursor-review-v1 -->` (metadata may append on same line). Workflow `contains("<!-- cursor-review-v1 -->")` must match exactly.

**C5 handling**: When `--change-id` absent, prompt omits C5 from required scores; parser treats missing C5 as N/A; mean renormalized over C1–C4, C6 only.

**Agent failure path** (user decision): review step may exit non-zero; a final workflow step ( `if: always() && !skipped` ) applies `ai-cr:failed`, posts a short failure comment if no `review.md`, and job **exits 0** so advisory semantics hold.

**Label trigger guard**: On `labeled` events, run only when `github.event.label.name == 'ai-cr:review'` to avoid spurious runs.

---

## Phase 1: Review contract & score sidecar

### Overview

Fix comment marker, extend prompt for C1–C6 + `path:line` + optional PR metadata, parse scores into `reports/review.json`, unit-test parser and pass/fail evaluator.

### Changes Required

#### 1. Comment marker constant

**File**: `scripts/cursor-review/constants.ts` (new)

**Intent**: Single source for the upsert marker string used by `review.ts` and documented for the workflow.

**Contract**: Export `REVIEW_COMMENT_MARKER = "<!-- cursor-review-v1 -->"`.

#### 2. Score parser & evaluator

**File**: `scripts/cursor-review/parse-scores.ts` (new)

**Intent**: Deterministically extract C1–C6 integers from the agent's **Scores** section and detect `critical` findings in the **Findings** section.

**Contract**:
- Input: review markdown string (body without HTML header).
- Output: `{ scores: Partial<Record<"C1"|…|"C6", number>>, criticalCount: number }`.
- Score line pattern: `C{n}: {1-10}/10` (tolerant of bold/markdown wrappers).
- **Critical findings**: increment `criticalCount` for each finding line whose severity token is `critical` — match case-insensitively at line start, e.g. `(critical)`, `**critical**`, or `- critical:` before the location text. Lock with fixture strings in tests (non-English reviews may use English severity labels per prompt contract).

**File**: `scripts/cursor-review/evaluate-pass.ts` (new)

**Intent**: Apply pass/fail rules from `requirements.md`.

**Contract**:
- Input: parsed scores, `criticalCount`, `hasPlanContext: boolean`.
- Output: `{ passed: boolean, failReasons: string[], mean: number | null }`.
- Fail if: any present score < 6, `criticalCount > 0`, or **zero C1–C6 scores parsed** after a completed agent run (`failReasons` includes `"missing scores"`).

#### 3. Prompt extension

**File**: `scripts/cursor-review/build-prompt.ts`

**Intent**: Require Scores section (C1–C6 per plan context), `path:line` locations in findings, optional PR title/description block.

**Contract**:
- New options: `prTitle?: string`, `prDescription?: string` (description truncated to 2000 chars in caller).
- Deliverable adds **Scores** section between Summary and Findings with format `C1: N/10 — rationale`.
- When `changeId` absent, prompt states C5 not applicable.
- Update **both** cloud and local deliverable blocks (two templates in this file).

#### 3b. Code-reviewer subagent output

**File**: `.cursor/agents/code-reviewer.md`

**Intent**: Align subagent output with the Scores contract — cloud prompt delegates to this agent; without matching output format the main agent may omit C1–C6 scores.

**Contract**:
- **Output** section requires **Scores** between Summary and Findings: one line per criterion (`C1: N/10 — brief rationale`).
- Findings use severity (`critical` / `high` / `medium` / `low`) with **Location** as `path:line` or `path:start-end`.
- When no plan context is provided, omit C5 from Scores (main prompt handles renormalization).

#### 4. CLI & output wiring

**File**: `scripts/cursor-review/review.ts`

**Intent**: Accept `--pr-title` / `--pr-description`; write marker header; emit sidecar JSON alongside markdown output.

**Contract**:
- New CLI flags: `--pr-title`, `--pr-description`.
- Update `--help` output to document new flags.
- When `--output reports/review.md`: also write `reports/review.json` with `{ version: 1, passed, scores, mean, failReasons, criticalCount, agentId?, runId? }`.
- Header line: `${REVIEW_COMMENT_MARKER} agent=… run=…\n\n` (marker substring must remain searchable).

#### 5. Unit tests

**File**: `scripts/cursor-review/parse-scores.test.ts`, `scripts/cursor-review/evaluate-pass.test.ts` (new)

**Intent**: Lock parser and pass/fail rules without calling Cursor API.

**Contract**: Add `// @vitest-environment node` atop each file (parser tests do not need jsdom). Cover happy path, missing C5 renormalization, score < 6 fail, critical finding fail, **zero parsed scores → fail**, malformed scores graceful degradation.

### Success Criteria

#### Automated Verification

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm exec vitest run scripts/cursor-review/parse-scores.test.ts scripts/cursor-review/evaluate-pass.test.ts` passes
- `pnpm test` passes (full suite)

#### Manual Verification

- `pnpm review --output reports/review.md` on a local branch produces `reports/review.json` with expected shape (requires `CURSOR_API_KEY` locally — optional smoke)

**Implementation Note**: Pause for human confirmation after manual smoke before Phase 2.

---

## Phase 2: Composite action

### Overview

Extract checkout → install → cloud review into `.github/actions/cursor-review/action.yml`; slim `cursor-review.yml` to triggers, guards, and orchestration stubs (comment/labels land in Phase 3).

### Changes Required

#### 1. Composite action

**File**: `.github/actions/cursor-review/action.yml` (new)

**Intent**: Encapsulate review execution so the workflow YAML stays readable.

**Contract**:
- **Inputs**: `ref` (required), `pr-url`, `change-id`, `base` (default `main`), `pr-title`, `pr-description`, `api-key` (from `secrets.CURSOR_API_KEY`).
- **Steps**: checkout (`fetch-depth: 0`, `ref`), pnpm setup, node 22, `pnpm install --frozen-lockfile`, `pnpm review:cloud` with args mirroring current inline script (`cursor-review.yml:60-84`) plus new title/description flags.
- **Outputs**: `review-md` (path), `review-json` (path), `skipped`, `review-outcome` (`success`|`failure`).
- **Output mapping** (after `pnpm review:cloud`):
  - Exit 0 + `reports/review.md` present → `skipped=false`, `review-outcome=success`, set path outputs.
  - Exit 0 + no `reports/review.md` (auth soft-skip) → `skipped=true`, `review-outcome=success`, paths empty.
  - Exit 2 (agent run error) → `skipped=false`, `review-outcome=failure`.
  - Other non-zero exit → `skipped=false`, `review-outcome=failure`.

> **Note:** `requirements.md` lists composite outputs `review-path`, `agent-id`, `run-id` — superseded by this plan's `review-md` / `review-json` sidecar design; agent/run ids remain in markdown header and JSON optional fields.

#### 2. Workflow refactor

**File**: `.github/workflows/cursor-review.yml`

**Intent**: Replace inline checkout/install/review steps with `uses: ./.github/actions/cursor-review`.

**Contract**:
- Pass PR metadata: `title` from `github.event.pull_request.title`, `body` truncated in shell before input.
- Keep: concurrency, fork guard, key-availability pre-check, permissions unchanged until Phase 3.
- Comment step: update marker search to `<!-- cursor-review-v1 -->`.
- Post comment when `review-md` exists and review succeeded (interim — labels in Phase 3).

### Success Criteria

#### Automated Verification

- `pnpm check` passes
- `pnpm typecheck` passes
- YAML is valid (no syntax errors — `action.yml` + workflow)

#### Manual Verification

- `workflow_dispatch` on a test PR runs composite action successfully (or skips cleanly without key)
- PR comment upserts on second push (single comment, not duplicates)

**Implementation Note**: Pause for human confirmation before Phase 3.

---

## Phase 3: Labels, triggers & failure path

### Overview

Ensure `ai-cr:*` labels exist, apply pass/fail from `review.json`, add `labeled` retry, handle agent failure softly, update README.

### Changes Required

#### 1. Permissions & label bootstrap

**File**: `.github/workflows/cursor-review.yml`

**Intent**: Create labels idempotently before review runs.

**Contract**:
- `permissions`: add `issues: write` (label create) alongside `pull-requests: write`.
- New step **Ensure review labels** (before composite action, when not skipped):
  - `gh label create "ai-cr:passed" --color 2da44e --description "AI code review passed" 2>/dev/null || true`
  - `gh label create "ai-cr:failed" --color cf222e --description "AI code review failed" 2>/dev/null || true`
  - `gh label create "ai-cr:review" --color bfd4f2 --description "Re-run AI code review" 2>/dev/null || true`

#### 2. Triggers

**File**: `.github/workflows/cursor-review.yml`

**Intent**: Support on-demand retry via label.

**Contract**:
```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened, labeled]
```
- Job `if` (combine with existing fork guard):
```yaml
if: >
  (github.event_name == 'workflow_dispatch' ||
   github.event.pull_request.head.repo.full_name == github.repository) &&
  (github.event_name != 'pull_request' ||
   github.event.action != 'labeled' ||
   github.event.label.name == 'ai-cr:review')
```

#### 3. Label orchestration steps

**File**: `.github/workflows/cursor-review.yml`

**Intent**: Sync PR labels with review outcome; clean stale labels on retry.

**Contract**:
- **Prepare labels** (start of review path): remove `ai-cr:review`, `ai-cr:passed`, `ai-cr:failed` from PR.
- **Apply outcome** (after comment, on success with `review.json`): `jq -r .passed reports/review.json` → add `ai-cr:passed` or `ai-cr:failed`.
- **Failure handler** (`if: always() && !skipped && composite failed`): add `ai-cr:failed`; if no `review.md`, post minimal comment: marker + "Review agent failed to complete."

#### 4. README

**File**: `scripts/cursor-review/README.md`

**Intent**: Document labels, retry, scores, sidecar JSON, label colors; reinforce advisory stance.

**Contract**: New sections: **PR labels** (`ai-cr:*`), **On-demand retry**, **Scores & pass rules**; update workflow description for composite action + single-comment upsert fix.

### Success Criteria

#### Automated Verification

- `pnpm check` passes
- `pnpm test` passes (no regressions from Phase 1 tests)

#### Manual Verification

- Test PR receives `ai-cr:passed` or `ai-cr:failed` matching review content
- Adding `ai-cr:review` triggers re-run; stale labels cleared
- Agent failure (simulate or force) → `ai-cr:failed`, job green in Actions
- Repo without `CURSOR_API_KEY` → no labels, no comment, job succeeds

**Implementation Note**: Final manual sign-off before merge.

---

## Phase 4: CI smoke without Cursor GitHub integration

### Overview

Post-implementation verification (2026-06-23) after `CURSOR_API_KEY` was added to repo secrets. Phases 1–3 code is merged on `features/ci-cd-code-review` (PR #154); manual sign-off items in §Progress remain open. This phase closes the gap between **workflow green** and **agent actually producing a review** when Cursor **GitHub Integrations** cannot be configured.

### Findings (2026-06-23)

#### Workflow blockers (fixed on branch)

Two issues prevented `cursor-review` from running on PR events at all:

1. **Missing checkout before local composite action** — `uses: ./.github/actions/cursor-review` requires a prior `actions/checkout` in the parent workflow so GitHub can load the action definition. Without it, push events failed workflow validation (0 jobs).
2. **YAML syntax in failure-handler step** — multiline bash `FAILURE_BODY='…'` broke YAML indentation at line ~151 (`Invalid workflow file`). Fixed with `printf` for the two-line body.

Commits: `e55d655` (checkout), `4fdec82` (YAML).

#### Secret & job semantics (verified)

- `CURSOR_API_KEY` present in repo secrets (added 2026-06-23).
- After workflow fixes, job `cursor-review` runs green (~35s) on PR `synchronize` (run `28045726594`).
- Key is detected (`skip=false`); advisory semantics hold — job exits 0 even when agent fails.

#### Agent failure — integration not optional for current cloud+PR path

Cloud review with `--pr-url` fails at agent startup:

```
Startup failed: [pr_resolution_failed] Failed to fetch pull request details (retryable=false)
```

Cause: CI passes `pr-url: ${{ github.event.pull_request.html_url }}` into `pnpm review:cloud`, which maps to Cursor SDK `cloud.repos[].prUrl`. Resolving the PR requires the repo to be linked in [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations) for the API key's account/team.

**User constraint**: GitHub integration in Cursor cannot be completed. `--pr-url` path is therefore unavailable.

#### What still works without integration

| Mode | Command | GitHub integration | Notes |
| --- | --- | --- | --- |
| Cloud + PR attach | `pnpm review:cloud --pr-url …` | **Required** | Current CI path; fails with `pr_resolution_failed` |
| Cloud + ref only | `pnpm review:cloud --ref <sha>` | **Maybe** | VM must clone repo from GitHub; may still need repo link for private/auth clone |
| **Local on runner** | `pnpm review` | **Not required** | Repo already checked out on GHA; only `CURSOR_API_KEY` needed |

PR title/description can still reach the prompt via `--pr-title` / `--pr-description` without `--pr-url` (already wired in workflow).

#### Side effects observed on failed run

- `ai-cr:failed` label applied (correct per failure path).
- Failure comment upserted (`<!-- cursor-review-v1 -->` + "Review agent failed to complete.").
- `workflow_dispatch` unavailable until workflow on `main` includes valid trigger (branch-only fix; not blocking PR `synchronize`).

### Desired end state (Phase 4)

When `CURSOR_API_KEY` is set and Cursor GitHub integration is **absent**:

1. CI runs **local** review (`pnpm review`, not `review:cloud`) against the checked-out PR head on the GHA runner.
2. **Do not pass `--pr-url`** to the SDK (remove from composite action default CI path).
3. Keep existing outputs: `reports/review.md`, `reports/review.json`, PR comment upsert, `ai-cr:*` labels, `labeled` retry.
4. Optional fallback: try cloud with `--ref <sha>` only if local mode proves unsuitable on GHA (document outcome).

### Changes required

#### 1. Composite action — local review mode

**File**: `.github/actions/cursor-review/action.yml`

**Intent**: Run review without cloud VM / GitHub PR resolution.

**Contract**:
- Replace `pnpm review:cloud` with `pnpm review` (or add input `mode: local|cloud`, default `local`).
- Drop `--pr-url` from default `REVIEW_ARGS`; retain `--ref` only if needed for logging (local mode uses `cwd` + `getCurrentBranch` / detached HEAD at checkout SHA).
- Retain `--base`, `--change-id`, `--pr-title`, `--pr-description`, `--output`.
- Update action `description` to reflect local-on-runner execution.

#### 2. Workflow — stop passing pr-url

**File**: `.github/workflows/cursor-review.yml`

**Intent**: Avoid `pr_resolution_failed` when integration unavailable.

**Contract**:
- Remove `pr-url` input from composite action call (or pass empty string).
- Add parent `checkout` before composite action (already landed — keep).

#### 3. review.ts / build-prompt (minimal)

**File**: `scripts/cursor-review/review.ts`, `build-prompt.ts`

**Intent**: Ensure local prompt on detached HEAD in CI still computes diff vs `main`.

**Contract**:
- Verify `getChangedFiles` / merge-base work when GHA checks out commit SHA (detached HEAD); adjust only if smoke fails.
- No new CLI flags required.

#### 4. README

**File**: `scripts/cursor-review/README.md`

**Intent**: Document integration requirement vs local CI path.

**Contract**:
- **Cloud + `--pr-url`**: requires Cursor GitHub integration.
- **CI default (local)**: no integration; needs checkout on runner.
- Troubleshooting table: add `pr_resolution_failed` → use local CI path or connect repo in Integrations.

### Success criteria

#### Automated verification

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm test` passes

#### Manual verification

- [ ] 4.1 PR `synchronize` runs `cursor-review`; agent completes; `reports/review.md` + `.json` produced
- [ ] 4.2 PR comment upserts with Scores section; `ai-cr:passed` or `ai-cr:failed` matches JSON
- [ ] 4.3 No `pr_resolution_failed` in Action logs
- [ ] 4.4 `ai-cr:review` label still triggers re-run
- [ ] 4.5 Missing key path unchanged (skip, green job, no labels/comment)

**Implementation note**: Phase 4 unblocks manual items 2.3–2.4 and 3.3–3.5 in §Progress without requiring Cursor GitHub integration.

---

## Testing Strategy

### Unit Tests

- `parse-scores.test.ts`: all C1–C6 lines, partial scores, markdown noise, critical finding detection
- `evaluate-pass.test.ts`: threshold 6, critical override, C5 omitted renormalization

### Integration Tests

- None for GHA in this slice (manual `workflow_dispatch` verification)

### Manual Testing Steps

1. Configure `CURSOR_API_KEY` on repo; open PR from `features/ci-cd-code-review`
2. Push twice → verify single PR comment with Scores section; check `reports/` shape in Action logs if uploaded
3. Verify `ai-cr:passed` or `ai-cr:failed` on PR
4. Add `ai-cr:review` → verify re-run and label swap
5. Remove secret temporarily → verify skip path (no labels/comment, green job)

## Performance Considerations

- PR description truncated to 2000 chars before prompt to cap tokens
- Concurrency group unchanged — cancel in-progress on new push
- 30-minute timeout retained

## Migration Notes

- Existing PR comments with old `<!-- cursor-review -->` marker will not upsert — first run after deploy creates a new comment; old duplicates can be closed manually (one-time)
- Labels created automatically on first workflow run with key present

## References

- Research: `context/changes/ci-cd-code-review/research.md`
- Requirements: `context/changes/ci-cd-code-review/requirements.md`
- Frame: `context/changes/ci-cd-code-review/frame.md`
- Shipped workflow: `.github/workflows/cursor-review.yml`
- Review scripts: `scripts/cursor-review/review.ts`, `build-prompt.ts`
- Code reviewer agent: `.cursor/agents/code-reviewer.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Review contract & score sidecar

#### Automated

- [x] 1.1 `pnpm check` passes
- [x] 1.2 `pnpm typecheck` passes
- [x] 1.3 `pnpm exec vitest run scripts/cursor-review/parse-scores.test.ts scripts/cursor-review/evaluate-pass.test.ts` passes
- [x] 1.4 `pnpm test` passes

#### Manual

- [ ] 1.5 Local smoke: `pnpm review --output reports/review.md` produces `reports/review.json` (optional if no local key)

### Phase 2: Composite action

#### Automated

- [x] 2.1 `pnpm check` passes
- [x] 2.2 `pnpm typecheck` passes

#### Manual

- [ ] 2.3 `workflow_dispatch` runs composite action on test PR
- [ ] 2.4 Second push upserts single PR comment (no duplicates)

### Phase 3: Labels, triggers & failure path

#### Automated

- [x] 3.1 `pnpm check` passes
- [x] 3.2 `pnpm test` passes

#### Manual

- [ ] 3.3 Test PR receives correct `ai-cr:passed` or `ai-cr:failed`
- [ ] 3.4 `ai-cr:review` label triggers re-run
- [ ] 3.5 Agent failure path applies `ai-cr:failed` with green job
- [ ] 3.6 Missing key skips labels and comment

### Phase 4: CI smoke without Cursor GitHub integration

#### Automated

- [x] 4.1 `pnpm check` passes
- [x] 4.2 `pnpm typecheck` passes
- [x] 4.3 `pnpm test` passes

#### Manual

- [ ] 4.4 PR synchronize produces review markdown + JSON (no `pr_resolution_failed`)
- [ ] 4.5 PR comment upsert + correct `ai-cr:passed` / `ai-cr:failed`
- [ ] 4.6 `ai-cr:review` retry still works
- [ ] 4.7 Missing key skip path unchanged
