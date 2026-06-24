# Frame Brief: CI/CD PR code review

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

Change `ci-cd-code-review` is titled "Introduce first CI/CD workflow for PR code
reviews" and `requirements.md` specifies a GHA workflow on every PR, a composite
action, 1–10 scored criteria (`{{CR_CRITERIA}}`), PR comments, pass/fail labels
(`ai-cr:passed` / `ai-cr:failed`), and on-demand retry via the `ai-cr:review`
label.

## Initial Framing (preserved)

- **User's stated cause or approach**: Greenfield introduction of the first
  automated PR code-review workflow in CI/CD.
- **User's proposed direction**: Build per `requirements.md` — composite action,
  scored criteria, labels, PR comment side-effects.
- **Pre-dispatch narrowing**: Something runs on PRs but does not match
  `requirements.md` (labels, scoring, composite action, retry) — leading
  concern is **gap between spec and shipped behavior**, not absence of any
  workflow.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Greenfield build** — no workflow exists; implement everything from
   `requirements.md` from scratch.
2. **Gap completion** — a Cursor SDK workflow already ships PR comments; missing
   pieces are composite action, scoring, labels, and label-triggered retry. ←
   initial framing + user narrowing
3. **Requirements staleness** — `requirements.md` is a post-hoc sketch written
   after the SDK path landed; the real work is reconciling docs/status, not
   building the sketch literally.
4. **Operational readiness** — shipped workflow is the intended shape
   (advisory, non-blocking); gaps are secret setup, discoverability, and
   reliability — not missing `ai-cr:*` features.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Greenfield: no workflow exists | `.github/workflows/cursor-review.yml` (PR trigger, comment upsert); `scripts/cursor-review/*`; `pnpm review` / `review:cloud` in `package.json:32-33`; `@cursor/sdk` dep | **NONE** |
| Gap completion: spec features missing from shipped impl | PR comment: `cursor-review.yml:86-100`. Missing: composite action (no `.github/actions/`), `ai-cr:*` labels (grep: only `requirements.md`), `labeled` trigger (only `opened/synchronize/reopened` + `workflow_dispatch` at `cursor-review.yml:9-12`), `{{CR_CRITERIA}}` scoring (prompt uses severity at `build-prompt.ts:67-70`) | **STRONG** |
| Requirements staleness: sketch superseded by SDK | SDK commits 2026-06-18 (`04c8dde`…`0b461f3`); change folder added 2026-06-19 (`33e2023`); commit `ead2382` parked change as "DO NOT START YET"; zero code references to `ai-cr` or `CR_CRITERIA` outside requirements | **STRONG** |
| Operational readiness: secret/adoption only | Advisory design explicit (`cursor-review.yml:1-5`); graceful skip on missing/invalid key (`cursor-review.yml:28-38`, `review.ts:127-132`); README documents setup (`scripts/cursor-review/README.md:14,65`); not in `AGENTS.md` or roadmap | **STRONG** (for shipped shape) / **WEAK** (as sole explanation — user expects spec gaps) |

## Narrowing Signals

- User selected **gap** over greenfield, operational-only, or unsure — confirms
  the mismatch between `requirements.md` and runtime is the leading concern.
- Independent search (no hypothesis named) landed on the same split: live
  `cursor-review` path vs frozen change folder with unbuilt requirements.
- Change was explicitly **parked** in committed HEAD (`ead2382`: `status: new
  (DO NOT START YET, PARKED FOR LATER)`); working tree currently shows
  `status: new` without parking — status intent is ambiguous.

## Cross-System Convention

FlowState CI merge gates live in `.github/workflows/ci.yml` (quality + e2e).
`AGENTS.md` references only that workflow for PR checks. The shipped review
workflow is documented as **advisory** and parallel — not a merge gate
(`cursor-review.yml:1-5`, `scripts/cursor-review/README.md:76-78`). That
matches the project's pattern of keeping AI review separate from blocking CI,
but it diverges from `requirements.md`'s pass/fail label contract.

No archived slice or roadmap entry defines `ai-cr:*` labels or numeric scoring
as a project convention — those exist only in this change's requirements sketch.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: reconcile the `ci-cd-code-review`
> change with an already-shipped Cursor SDK PR review workflow — explicitly
> deciding which `requirements.md` items are still desired versus which were
> superseded by the SDK implementation, then closing the agreed gaps.

The initial "introduce first workflow" framing is stale: commit `33e2023` added
the change folder the day after the workflow landed on `main`. PR comment review
already runs via `cursor-review.yml` + `scripts/cursor-review/`. What remains
is not greenfield construction but **scope reconciliation**: composite action,
1–10 criteria, and `ai-cr:*` labels/retry are entirely unbuilt, while the SDK
path adds un-specified capabilities (change-id plan context, cloud agent,
advisory skip). Planning must start from the shipped baseline and a deliberate
keep/drop decision on each requirements line — not from "build the first
workflow."

## Confidence

**HIGH** — greenfield hypothesis falsified with file evidence; gap and
staleness both STRONG; user narrowing aligns; independent search converges.

One open product decision before `/10x-plan`: whether pass/fail labels and
numeric scoring are still wanted, or `requirements.md` should be rewritten to
match the advisory Cursor SDK design.

## What Changes for /10x-plan

Do not plan a greenfield GHA workflow. Plan **incremental work on the existing
`cursor-review` stack**, scoped by an explicit requirements reconciliation
(keep vs retire composite action, scoring, labels, retry). Include ops
enablement (`CURSOR_API_KEY`, optional `AGENTS.md` pointer) only if still in
scope after reconciliation. Resolve change `status` (parked vs active) in the
first plan sub-phase.

## References

- Source files: `.github/workflows/cursor-review.yml`, `scripts/cursor-review/review.ts`, `scripts/cursor-review/build-prompt.ts`, `context/changes/ci-cd-code-review/requirements.md`, `context/changes/ci-cd-code-review/change.md`
- Related research: none (`research.md` not present)
- Investigation tasks: greenfield verify (cacacf46), gap matrix (7adf29cf), staleness timeline (227d2d94), operational readiness (6fe78c79), independent search (7362a003)
