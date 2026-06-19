# Timer Change-Impact Digest Implementation Plan

## Overview

Ship the narrow MVP from PRD thread `timer-change-impact-digest`: a read-only maintainer CLI that prints top git co-changed paths and suggested test commands for a timer-hub file before editing. No product (`src/`) runtime changes; no CI gate in v1.

## Current State Analysis

Mom Test git replay (4/5 commits with new co-change signal) and stack assessment confirm the stack is sufficient. Blast-radius knowledge lives in `context/map/repo-map.md` and research prose but is not invoked at edit time.

### Key Discoveries

- **Agent-hooks ESM precedent:** `scripts/agent-hooks/*.mjs` — project root resolution, `spawnSync` with `pnpm.cmd` on Windows (`scripts/agent-hooks/lib/spawn-pnpm.mjs`, `scripts/agent-hooks/lib/input.mjs`).
- **Git co-change is authoritative for E2E:** repo-map §3 — `e2e/` coupling is git-only, not depcruise (`context/map/repo-map.md:83-84`).
- **depcruise already wired:** `package.json` scripts `depcruise`, `.dependency-cruiser.cjs` — use for optional fan-out count only (FR-005).
- **Static test layers for timer hub:** hook unit test, dashboard smoke, belt E2E — commands in `AGENTS.md` (`pnpm test`, `pnpm exec vitest run …`, `pnpm test:e2e:belt`).
- **Default reference path:** `src/hooks/use-pomodoro-cycle.ts` (shape + opportunity map).
- **Top co-changes since 2026-04-01 (Mom Test baseline):** `use-pomodoro-cycle.test.tsx` (29), `pomodoro-dashboard.tsx` (22), `task-list.tsx` (10), `e2e/pomodoro-cycle.spec.ts` (5).

## Desired End State

1. Maintainer runs `pnpm change-impact` (default path) or `pnpm change-impact -- src/app/_components/pomodoro-dashboard.tsx`.
2. Stdout shows: target path, `--since` date, ranked co-changed paths with counts, test-command block, optional fan-out line.
3. Exit 0 on success; non-zero with clear message if path missing or git unavailable.
4. No workspace writes; completes in <30s on typical Windows clone.
5. Vitest covers pure co-change aggregation and test-catalog mapping.

### Verification

- Automated: `pnpm check`, `pnpm typecheck`, `pnpm exec vitest run scripts/change-impact/lib/git-cochange.test.ts scripts/change-impact/lib/test-catalog.test.ts`
- Manual: run on `use-pomodoro-cycle.ts`; confirm dashboard + hook test + e2e spec appear in co-change top rows; compare with Mom Test replay table

## What We're NOT Doing

- CI gate, PR comment bot, lefthook pre-commit hook (PRD non-goals)
- Full depcruise graph or HTML report in output
- Replacing or auto-generating `repo-map.md`
- Timer-hub paths outside `src/hooks/use-pomodoro-cycle.ts`, `src/app/_components/pomodoro-dashboard.tsx`, `src/lib/wedge/**` validation warnings (accept any repo path, but catalog optimized for hub)
- Staged-diff / line-count quiet mode and PRD FR-004 default-quiet behavior (defer to v2 — see **PRD FR-004 v1 deviation** below)
- TypeScript product changes or new npm dependencies beyond existing stack

## Implementation Approach

Three phases: (1) git co-change core + CLI entry, (2) report formatter + test catalog + flags, (3) vitest + optional depcruise + AGENTS.md. Pure functions in `scripts/change-impact/lib/`; thin CLI in `scripts/change-impact/run.mjs`. Follow ESM + `shell: false` subprocess patterns from agent-hooks.

## Critical Implementation Details

**PRD FR-004 v1 deviation:** PRD FR-004 describes `--strict` as diff-size warnings plus a default quiet mode (suppress output below a line threshold). v1 **does not** implement staged-diff or quiet mode. v1 `--strict` means only: (1) raise `--top` default from 8 → 15, (2) include `context/` co-change rows in the table, (3) print E2E `(co-change — not in depcruise graph)` labels inline. Diff-threshold quiet mode is v2; document this deviation in AGENTS.md maintainer section.

**Git co-change algorithm:** For each commit touching the target path since `--since`, collect all other changed paths in that commit via `git log --name-only --no-merges`. Increment counter per co-path; exclude the target path itself; normalize paths to forward slashes and repo-relative form (strip leading `./`); skip merge commits to avoid duplicate inflation. Filter to `src/` and `e2e/` only for default display (drop pure `context/` rows from top table unless `--strict`).

**Windows git:** Use `git` on PATH with `spawnSync("git", args, { shell: false, encoding: "utf8" })` — same safety model as `spawn-pnpm.mjs`.

**Project root resolution:** Walk up from `cwd` until `.git` directory found; if none, fall back to env vars used by agent-hooks (`CURSOR_PROJECT_DIR`, `CLAUDE_PROJECT_DIR`). Extends agent-hooks pattern — agent-hooks does not walk `.git` today, but subdir runs from `scripts/` require walk-up.

**Output length NFR:** Default mode targets ≤40 lines. `--strict` may exceed one screen (top 15 + `context/` rows + E2E labels); print a one-line footer when row count exceeds 40: `Expanded (--strict) — see context/map/repo-map.md for full blast radius`.

**E2E labeling:** Any row under `e2e/` must print `(co-change — not in depcruise graph)` in `--strict` mode or in test-catalog footnote once.

**Vitest outside `src/`:** First co-located tests under `scripts/change-impact/`. Global `vitest.config.ts` uses jsdom + `setupFiles` for app tests — script tests must declare `// @vitest-environment node` and test pure parsers only (no React/DOM). If ESM import friction appears, add a vitest `projects` split in a follow-up; not required for v1 if mocks stay on exported pure helpers.

**Depcruise fan-out metric (optional, Phase 3):** Run full graph JSON, not `--focus` neighborhood alone. Command: `pnpm exec depcruise src --output-type json --output-to -` (or reuse existing `pnpm depcruise` config). Count **direct dependents**: modules with an import edge pointing at the target file (regex-escaped path in module id). Label stdout line `Direct dependents (depcruise): N — see repo-map §4 for architect fan-out`; do not claim repo-map “19 fan-out” total from `--focus` depth-1 output.

---

## Phase 1: Git co-change core

### Overview

Implement co-change aggregation and minimal CLI that prints ranked paths.

### Changes Required

#### 1. Project root helper

**File**: `scripts/change-impact/lib/project-root.mjs`

**Intent**: Resolve repo root by walking up from `cwd` for `.git`; if not found, fall back to agent-hooks env vars (`CURSOR_PROJECT_DIR`, `CLAUDE_PROJECT_DIR`).

**Contract**: Export `resolveProjectRoot(cwd?) → string`; throws if not inside a git work tree.

#### 2. Co-change aggregator

**File**: `scripts/change-impact/lib/git-cochange.mjs`

**Intent**: Given `{ root, targetPath, sinceIsoDate }`, return sorted `{ path, count }[]`.

**Contract**: Export `collectCoChanges(options) → Promise<CoChangeRow[]>`; pure parsing helpers exported for tests; git subprocess isolated in `runGit(args, root)`.

#### 3. CLI entry (minimal)

**File**: `scripts/change-impact/run.mjs`

**Intent**: Parse argv (`--since`, `--top`, `--strict`, positional path); default path `src/hooks/use-pomodoro-cycle.ts`; print ranked table to stdout.

**Contract**: Shebang `#!/usr/bin/env node`; exit codes: 0 success, 1 usage/validation, 2 git error.

#### 4. Package script

**File**: `package.json`

**Intent**: Register maintainer command.

**Contract**: `"change-impact": "node scripts/change-impact/run.mjs"`

### Success Criteria

#### Automated Verification

- `pnpm check` passes
- `node scripts/change-impact/run.mjs -- src/hooks/use-pomodoro-cycle.ts` exits 0 from repo root

#### Manual Verification

- Output lists `pomodoro-dashboard.tsx` and `use-pomodoro-cycle.test.tsx` in top rows for default path
- Run completes in <30s on maintainer machine

**Implementation Note**: Pause after manual spot-check against Mom Test replay before Phase 2.

---

## Phase 2: Report formatter, test catalog, and flags

### Overview

One-screen report with test commands; `--strict` expands top-N; optional depcruise fan-out stub (Phase 3 completes depcruise).

### Changes Required

#### 1. Test command catalog

**File**: `scripts/change-impact/lib/test-catalog.mjs`

**Intent**: Map path prefixes to suggested pnpm commands for timer hub.

**Contract**: Export `suggestTestCommands(coChangeRows, targetPath) → string[]` — at minimum:

- `src/hooks/use-pomodoro-cycle.ts` → `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx`
- `pomodoro-dashboard` → `pnpm exec vitest run src/app/_components/pomodoro-dashboard.test.tsx`
- any `e2e/` co-change → `set CI=true && pnpm test:e2e:belt`
- fallback → `pnpm test`

Deduplicate commands; max 4 lines in block.

#### 2. Report formatter

**File**: `scripts/change-impact/lib/format-report.mjs`

**Intent**: Build ≤40-line stdout string from co-change rows, catalog, metadata.

**Contract**: Export `formatReport({ targetPath, since, rows, testCommands, fanOutCount?, strict })`; include header `Timer change-impact digest` and footer `Advisory only — see context/map/repo-map.md`. Default mode ≤40 lines; `--strict` may exceed — emit expanded footer per Critical Details.

#### 3. CLI flag wiring

**File**: `scripts/change-impact/run.mjs`

**Intent**: Wire `--since` default `2026-04-01`, `--top` default 8 (15 if `--strict`), `--strict` boolean (expanded table per FR-004 v1 deviation — not diff-size quiet mode).

**Contract**: `--help` documents flags and v1 `--strict` semantics; unknown flags → exit 1 with usage.

### Success Criteria

#### Automated Verification

- `pnpm check` passes
- `pnpm change-impact -- --help` shows flags

#### Manual Verification

- Default output fits one terminal screen (~40 lines)
- `--strict` shows more rows than default
- Test-command block includes vitest + belt suggestion for hook path

**Implementation Note**: Confirm output format before Phase 3 tests.

---

## Phase 3: Tests, optional depcruise, and documentation

### Overview

Unit-test pure modules; add optional fan-out count; document in AGENTS.md.

### Changes Required

#### 1. Vitest unit tests

**File**: `scripts/change-impact/lib/git-cochange.test.ts`

**Intent**: Test co-change counting from fixture commit file lists (no real git in unit tests).

**Contract**: Use `// @vitest-environment node` (required — global config is jsdom); mock `runGit` or test exported `aggregateCommits(nameLists, targetPath)` only; no DOM/React imports.

**File**: `scripts/change-impact/lib/test-catalog.test.ts`

**Intent**: Assert catalog returns belt E2E when e2e path present in co-change rows.

#### 2. Optional depcruise fan-out

**File**: `scripts/change-impact/lib/depcruise-fanout.mjs`

**Intent**: Spawn `pnpm exec depcruise src --output-type json --output-to -` (uses `.dependency-cruiser.cjs`); parse JSON and count direct dependents of target path (import edges into module matching escaped path regex).

**Contract**: Return `{ fanOutCount: number | null, label: string }` where label is `Direct dependents (depcruise): N`; on failure or timeout >10s, return null; never throw to CLI (FR-005 nice-to-have). Do not use `--focus` alone as fan-out total.

#### 3. AGENTS.md maintainer section

**File**: `AGENTS.md`

**Intent**: Add block from stack-assessment "Recommended instruction file additions (thread)" — `pnpm change-impact`, default path, advisory-only, E2E via git not depcruise.

**Contract**: Place after Layout & conventions or new `## Maintainer tooling` subsection; no product-domain wedge jargon required.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run scripts/change-impact/lib/git-cochange.test.ts scripts/change-impact/lib/test-catalog.test.ts`
- `pnpm test` passes (full suite)
- `pnpm check` passes
- `pnpm typecheck` passes

#### Manual Verification

- `pnpm change-impact` on default path: optional fan-out line present or graceful skip message
- Re-run on path from Mom Test commit `4f6ae9f` scenario — dashboard + e2e rows visible with `--strict`

**Implementation Note**: After Phase 3, log 3 manual uses in change Notes before any CI promotion (PRD OQ3).

---

## Testing Strategy

### Unit Tests

- Co-change aggregation: empty history, single commit, duplicate paths across commits, path normalization (`./` strip, forward slashes), merge commits excluded via `--no-merges`
- Test catalog: hook-only rows, e2e row triggers belt, deduplication

### Integration Tests

- None in v1 (manual git-dependent smoke)

### Manual Testing Steps

1. `pnpm change-impact` — default path, scan top 5 rows vs Mom Test table
2. `pnpm change-impact -- src/app/_components/pomodoro-dashboard.tsx` — hook appears as co-change
3. `pnpm change-impact -- --strict --top 15` — more rows, still one screen
4. Run from subdirectory — confirm repo root resolution works

## Performance Considerations

- Bound git log with `--since` (default 2026-04-01) to keep runtime <30s
- Single `git log` pass preferred over N× `diff-tree` if performance acceptable; optimize only if manual timing fails

## Migration Notes

Not applicable — new dev tooling only.

## References

- Mom Test validation: `context/team/mom-test-validation.md`
- Opportunity map: `context/team/opportunity-map-automated.md`
- Shape thread: `context/foundation/shape-notes.md` (Change thread: Timer change-impact digest)
- PRD thread: `context/foundation/prd.md` (Change thread PRD: Timer change-impact digest)
- Stack assess thread: `context/foundation/stack-assessment.md`
- Repo map §3: `context/map/repo-map.md`
- Agent-hooks patterns: `scripts/agent-hooks/lib/input.mjs`, `scripts/agent-hooks/lib/spawn-pnpm.mjs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Git co-change core

#### Automated

- [x] 1.1 `pnpm check` passes
- [x] 1.2 `node scripts/change-impact/run.mjs -- src/hooks/use-pomodoro-cycle.ts` exits 0 from repo root

#### Manual

- [x] 1.3 Output lists dashboard and hook test in top rows for default path; completes in <30s

### Phase 2: Report formatter, test catalog, and flags

#### Automated

- [ ] 2.1 `pnpm check` passes
- [ ] 2.2 `pnpm change-impact -- --help` shows flags

#### Manual

- [ ] 2.3 Default output ≤40 lines; `--strict` expands rows; test-command block includes vitest + belt

### Phase 3: Tests, optional depcruise, and documentation

#### Automated

- [ ] 3.1 `pnpm exec vitest run scripts/change-impact/lib/git-cochange.test.ts scripts/change-impact/lib/test-catalog.test.ts`
- [ ] 3.2 Full `pnpm test` passes
- [ ] 3.3 `pnpm check` passes
- [ ] 3.4 `pnpm typecheck` passes

#### Manual

- [ ] 3.5 Fan-out line present or graceful skip; Mom Test `4f6ae9f` scenario checked with `--strict`
