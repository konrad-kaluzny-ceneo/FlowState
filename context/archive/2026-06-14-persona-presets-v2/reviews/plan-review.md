<!-- PLAN-REVIEW-REPORT -->

# Plan Review — persona-presets-v2

**Reviewed:** 2026-06-13  
**Plan:** `context/changes/persona-presets-v2/plan.md`  
**Brief:** `context/changes/persona-presets-v2/plan-brief.md`  
**Verdict:** APPROVED (after triage patches)

## Triage

| ID | Decision |
|----|----------|
| F1 | **Applied** — `inbox` → `synchro` throughout plan |
| F2 | **Applied** — Fix A: sentinel `"custom"` in `personaPresetId`; create payload + validation + display oracle updated |
| F3 | **Applied** — unknown id → `custom-detail`; plan-brief aligned |
| F4 | **Applied** — Phase 1 extends `buildOptimisticCreateRow` |
| F5 | **Applied** — Phase 2 pre-step marked satisfied (2026-06-13 approval) |
| F6 | **Applied** — test file described as extend existing |

Proceed to `/10x-implement persona-presets-v2 phase 1`.

## Summary

Six-phase plan is well-scoped, matches the shipped S-29 codebase, and correctly threads persistence before UI. The locked 8-persona catalog and effort-on-preset-path decouple are sound. **Two internal-consistency gaps should be resolved in the plan before Phase 1:** stale `inbox` references vs the approved `synchro` id, and contradictory badge rules for `personaPresetId == null` (legacy vs Custom-created). One feasibility gap: optimistic create rows need `personaPresetId` for immediate row chrome (L-04 adjacent).

## Verdicts

| Area | Verdict |
|------|---------|
| Internal Consistency | WARNING ⚠️ |
| Code Feasibility | PASS ✅ |
| Scope Discipline | PASS ✅ |
| Architecture | WARNING ⚠️ |
| Testing Strategy | PASS ✅ |
| S-32 Handoff | PASS ✅ |

## Findings

### F1 — Stale `inbox` id in plan text

- **Severity:** ⚠️ WARNING
- **Impact:** 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension:** Internal Consistency
- **Location:** `plan.md` Phase 2 (L205), Phase 3 manual (L280), Phase 5 import test (L350), Phase 6 example (L401)
- **Detail:** Locked catalog (Critical Implementation Details + `change.md`) uses **`synchro`**, not `inbox`. Phase 2 union example lists `focus`, `inbox`, …; Phase 3 manual says "Select Inbox"; Phase 5 guest import test uses `"inbox"`; Phase 6 S-32 template cites "Inbox". Implementer following Phase 5 tests would assert a non-existent preset id.
- **Fix:** Global replace `inbox` → `synchro` (and "Inbox" → "Synchro" in prose/examples) everywhere except historical S-29 references.
- **Decision:** PENDING

### F2 — Custom vs legacy row display both use `personaPresetId == null`

- **Severity:** ⚠️ WARNING
- **Impact:** 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension:** Architecture / Internal Consistency
- **Location:** `plan.md` Critical Implementation Details (L93–95); `plan-brief.md` Row display rules table (L40–45)
- **Detail:** `getTaskBadgeDisplayMode` assigns **`legacy`** when `personaPresetId == null`, but also **`custom-detail`** when "user custom-created (`null` after custom)". Plan-brief success criteria require Custom-created tasks to show a **Custom** chip; pre-migration tasks with `null` must keep today's F-05 badges. Both states share the same stored value — the oracle cannot distinguish them. Create payload explicitly sends `personaPresetId: null` for Custom path (L107–111).
- **Fix A ⭐ Recommended:** Persist sentinel `"custom"` in `personaPresetId` for Custom-path creates; reserve `null` for legacy/pre-migration only. Extend create validation to allow `"custom"` alongside catalog ids. Update display oracle: `legacy` = null; `custom-detail` = `"custom"` OR id set with non-effort attr divergence OR unknown id.
  - Strength: No new column; fits string-not-enum design; satisfies success criteria.
  - Tradeoff: Plan + brief must update create payload rules and zod validation contract.
  - Confidence: HIGH — only durable discriminator without a second field.
  - Blind spot: S-32 must treat `"custom"` as non-rationale (skip persona clause).
- **Fix B:** Drop Custom row badge — treat all `null` as legacy F-05 chrome.
  - Strength: Simplest implementation; zero schema contract change.
  - Tradeoff: Violates stated success criteria and frame requirement ("Custom only when truly custom").
  - Confidence: HIGH that this downscopes product intent.
  - Blind spot: User may accept legacy badges for Custom if explained.
- **Decision:** PENDING

### F3 — Unknown stored id: legacy vs custom-detail

- **Severity:** ⚠️ WARNING
- **Impact:** 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension:** Internal Consistency
- **Location:** `plan.md` L95 vs `plan-brief.md` Risks table (L63)
- **Detail:** Plan-brief mitigates invalid ids with "treat as legacy F-05 display (defensive)". Plan's `getTaskBadgeDisplayMode` routes unknown ids to **`custom-detail`** (Custom chip + F-05). Different UX for corrupted/removed catalog ids.
- **Fix:** Pick one oracle and document in Critical Implementation Details — recommend **`custom-detail`** (Custom + F-05) so removed catalog ids don't masquerade as healthy legacy rows; align plan-brief risk row.
- **Decision:** PENDING

### F4 — Optimistic create row missing `personaPresetId`

- **Severity:** ⚠️ WARNING
- **Impact:** 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension:** Code Feasibility (L-04 adjacent)
- **Location:** `src/hooks/use-task-mutations.ts:48–74`; Phase 1 hooks section
- **Detail:** Phase 1 mentions `use-task-mutations.ts` for create arg types but not `buildOptimisticCreateRow`. Auth-mode create optimistically appends a temp row without `personaPresetId`; row badges won't show persona label until list refetch — perceptible flash of legacy F-05 chrome after preset create (same class as L-04).
- **Fix:** Add Phase 1 sub-step: extend `buildOptimisticCreateRow` + `TaskListItem` shape with `personaPresetId: input.personaPresetId ?? null`; add component test oracle that post-create optimistic row shows persona badge.
- **Decision:** PENDING

### F5 — Phase 2 catalog approval gate is stale

- **Severity:** ℹ️ OBSERVATION
- **Impact:** 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension:** Internal Consistency
- **Location:** `plan.md` Phase 2 Pre-step (L193–195); Progress 2.4
- **Detail:** Pre-step still says "User must approve catalog … before implementing bundles", but `change.md`, `frame.md`, and Critical Implementation Details record user sign-off 2026-06-13 with 8 locked personas. Implementer may unnecessarily block on a resolved gate.
- **Fix:** Change Pre-step to "Catalog approved 2026-06-13 — proceed; mark Progress 2.4 at Phase 2 start."
- **Decision:** PENDING

### F6 — `persona-presets.test.ts` already exists

- **Severity:** ℹ️ OBSERVATION
- **Impact:** 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension:** Internal Consistency
- **Location:** `plan.md` Phase 2 (L226), Verification (L41)
- **Detail:** File exists with apply/throw tests for 3 S-29 presets. Phase 2 extends it — wording "(new)" is inaccurate but not blocking.
- **Fix:** Rename intent to "extend existing" in Phase 2 and Verification sections.
- **Decision:** PENDING

## Checklist

| Area | Verdict |
|------|---------|
| Schema-first sequencing (Phase 1 before UI) | MATCH |
| Guest + auth parity layers enumerated | MATCH |
| Effort decouple from Custom (Phase 3) | MATCH |
| S-29 id replacement (no DB backfill needed) | MATCH |
| Inline edit out of scope | MATCH |
| Belt e2e unchanged | MATCH |
| L-04 component test oracle cited | MATCH |
| Codebase anchors match Current State Analysis | MATCH |
| Locked catalog in plan matches frame/change.md | MATCH (except inbox drift in examples) |

## Next handoff

After triage: patch plan for F1–F4 as decided → `/10x-implement persona-presets-v2 phase 1`.
