---
date: 2026-07-04T13:29:00+02:00
researcher: Cursor Agent
git_commit: 835d18a50c0d0194717f36503a8a59a2e0b2f064
branch: features/mvp-defect-intake
repository: FlowState
topic: "How to fix D-08 (WHEN_POSSIBLE not clickable) and D-09 (preset name on created task)"
tags: [research, codebase, task-edit, horizon, persona-presets, blur-save, mvp-defect-intake]
status: complete
last_updated: 2026-07-04
last_updated_by: Cursor Agent
---

# Research: D-08 + D-09 — Task Edit Interaction Fixes

**Date**: 2026-07-04T13:29:00+02:00  
**Researcher**: Cursor Agent  
**Git Commit**: [`835d18a`](https://github.com/konrad-kaluzny-ceneo/FlowState/commit/835d18a50c0d0194717f36503a8a59a2e0b2f064)  
**Branch**: `features/mvp-defect-intake`  
**Repository**: [konrad-kaluzny-ceneo/FlowState](https://github.com/konrad-kaluzny-ceneo/FlowState)

## Research Question

How to fix D-08 (horizon option "Gdy się da" / `WHEN_POSSIBLE` reported as not clickable) and D-09 (preset name e.g. "Gaszenie" should show on created task) from the post-MVP defect register?

## Summary

**D-09 has a confirmed static root cause** for the post-edit case: `getTaskBadgeDisplayMode` intentionally demotes to `"custom-detail"` (shows "Własny" + Eisenhower detail) when live attributes diverge from the stored preset bundle — this was by design in S-36/persona-presets-v2 but **conflicts with the 2026-07-03 product decision** (D-09). A second confirmed bug: **guest `createTask` drops `personaPresetId`** even though the guest repo supports it.

**D-08 wiring is statically correct** — all three horizon values render as clickable buttons with `onClick` and `onMouseDown preventDefault`. No test covers horizon chip clicks specifically. Most likely explanations are: (1) **weak active-state styling** making `WHEN_POSSIBLE` look unchanged when already selected (default horizon is `WHEN_POSSIBLE`), (2) **panel `onBlur` + Safari `relatedTarget=null`** committing edit before chip `click` fires, (3) possible **hit-target clipping** from `overflow-hidden` on the task row at narrow widths. **Browser repro is still required** to pick the primary fix.

## Detailed Findings

### D-08: WHEN_POSSIBLE ("Gdy się da") not clickable

#### Horizon control wiring (verified correct)

| Step | Location | Finding |
| --- | --- | --- |
| Enum values | [`task-fields-panel.tsx:10-14`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/src/app/_components/task-fields-panel.tsx#L10-L14) | `HORIZON_VALUES` includes `WHEN_POSSIBLE` |
| Label mapping | [`task-fields-panel.tsx:88-96`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/src/app/_components/task-fields-panel.tsx#L88-L96) | PL: `horizonWhenPossible` → "Gdy się da" |
| SegmentedControl | [`task-fields-panel.tsx:26-56`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/src/app/_components/task-fields-panel.tsx#L26-L56) | Plain `<button>`, `onClick`, `onMouseDown preventDefault`, no `disabled` |
| Horizon colorMap | [`task-fields-panel.tsx:148-159`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/src/app/_components/task-fields-panel.tsx#L148-L159) | All three values wired |
| Default horizon | [`persona-presets.ts:115-121`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/src/lib/task/persona-presets.ts#L115-L121) | `DEFAULT_CREATE_FORM_ATTRIBUTES.commitmentHorizon = "WHEN_POSSIBLE"` |
| Edit default | [`task-list.tsx:644-645`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/src/app/_components/task-list.tsx#L644-L645) | Edit state initializes to `WHEN_POSSIBLE` |

#### Hypothesis evaluation

| Hypothesis | Verdict | Evidence | Recommended fix |
| --- | --- | --- | --- |
| **Weak WHEN_POSSIBLE active styling** | **CONFIRMED (static)** | Active: `bg-surface-panel text-text-section` (:152); inactive: `bg-surface-panel text-text-secondary` (:44). Nearly identical — user may perceive "click did nothing" | Give `WHEN_POSSIBLE` a distinct active color (e.g. work-type token like ASAP/THIS_WEEK) |
| **Default already selected** | **CONFIRMED (static)** | Most tasks default to `WHEN_POSSIBLE`; clicking when already selected fires no `onChange` | Distinguish in repro; consider subtle pressed-state animation |
| **Blur-save before click** | **PARTIAL — residual risk** | Panel `onBlur` at [`task-list.tsx:407-412`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/src/app/_components/task-list.tsx#L407-L412) commits when focus leaves; SegmentedControl has `mousedown preventDefault` (:48). Archived fix-task-edit-blur-save shipped `commitEditIfDirty` + document `pointerdown` (:773-793). **Gap:** when `relatedTarget` is `null` (Safari/touch), blur may commit before chip click | Defer blur commit (`requestAnimationFrame`/`setTimeout(0)`) and cancel if SegmentedControl interaction follows; or use `pointerdown` capture on panel |
| **overflow-hidden on task row** | **PLausible — needs repro** | [`task-list.tsx:338`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/src/app/_components/task-list.tsx#L338) — `overflow-hidden` on `<li>` for rounded corners. Third chip has longest label ("Gdy się da"); may wrap on ~320px. Missed click → `pointerdown` outside panel → premature commit | Remove `overflow-hidden` when `editingId === task.id`, or use `overflow-clip` only in read mode |
| **Missing wiring / disabled** | **REFUTED** | No `disabled`, no `pointer-events-none` on horizon buttons | N/A |

#### Blur-save architecture (post fix-task-edit-blur-save)

Current save path uses centralized [`commitEditIfDirty`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/src/app/_components/task-list.tsx#L717-L760):

- Panel-level `onBlur` with `relatedTarget` containment check (:407-412)
- Document `pointerdown` outside edit panel (:778-787)
- `startEditing` saves prior edit before switching tasks (:796-798)
- In-flight guard via `commitInFlightRef` (:714-715, :754-759)

Existing test covers SegmentedControl + outside commit for **work type** only — not horizon:

```333:348:src/app/_components/task-list.test.tsx
	it("persists attribute changes when committing after SegmentedControl edit", async () => {
		// ... clicks "Deep" work type, pointerDown(document.body)
	});
```

**No test** clicks horizon → `WHEN_POSSIBLE` in inline edit or create custom panel.

#### Browser repro still required

1. **Inline edit:** Task with horizon `ASAP` or `THIS_WEEK` → open edit → click "Gdy się da" — does `aria-pressed` change? Does edit close prematurely?
2. **Create custom panel:** Select "Własny" → change horizon to "Gdy się da"
3. **Already-selected case:** Task/create form already on `WHEN_POSSIBLE` — is report UX-only?
4. **Viewports:** ~320px mobile; check third chip wrap + click landing
5. **Browsers:** Safari iOS, Chrome Android (touch blur/`relatedTarget` null)

---

### D-09: Preset name should show on created task

#### Product decision (binding)

From [`mvp-defect-intake/change.md:34,67`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/context/changes/mvp-defect-intake/change.md): preset name visible on created task; rule "preset → Własny after attribute edit" from S-36 **must be revised** if it hides the preset label.

#### Badge display oracle (root cause for post-edit)

[`getTaskBadgeDisplayMode`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/src/lib/task/persona-presets.ts#L176-L198) logic:

| Condition | Mode | UI |
| --- | --- | --- |
| `personaPresetId == null` | `legacy` | Eisenhower detail only |
| `personaPresetId === "custom"` | `custom-detail` | "Własny" + detail |
| Unknown catalog id | `custom-detail` | "Własny" + detail |
| Valid id + attrs match preset (`ignoreEffort: true`) | `persona` | Preset label + effort |
| Valid id + **non-effort attrs diverge** | `custom-detail` | **"Własny" + detail** ← D-09 conflict |

Test explicitly encodes divergence demotion:

```178:194:src/lib/task/persona-presets.test.ts
	it("getTaskBadgeDisplayMode returns custom-detail when non-effort attrs diverge", () => {
		// focus preset with urgency: 1 → custom-detail
	});
```

Historical intent from [`persona-presets-v2/plan-brief.md:38-46`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/context/archive/2026-06-14-persona-presets-v2/plan-brief.md): persona label hidden when attrs no longer match bundle; **`personaPresetId` is NOT cleared on edit** — display-only demotion.

[`TaskBadges`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/src/app/_components/task-list.tsx#L124-L188) renders persona label only when mode is `"persona"`.

#### Create path (auth — works when attrs match)

| Step | Location | Behavior |
| --- | --- | --- |
| Apply preset | [`task-list.tsx:622-631`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/src/app/_components/task-list.tsx#L622-L631) | `applyPersonaPresetToCreateState` fills attrs |
| Create payload | [`task-list.tsx:872-887`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/src/app/_components/task-list.tsx#L872-L887) | Sends `personaPresetId` from `selectedPresetId` |
| Server persist | `task.ts` create handler | Writes `personaPresetId` to DB |
| Row render | [`task-list.tsx:492-502`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/src/app/_components/task-list.tsx#L492-L502) | `TaskBadges` with stored id |

Component test confirms preset row shows label when attrs match:

```541:562:src/app/_components/task-list.test.tsx
	it("shows persona label and effort badge for preset task row", () => {
		// synchro → "Synchro" badge
	});
```

#### Scenario matrix (static)

| Scenario | Badge after create | Mechanism |
| --- | --- | --- |
| Select "Gaszenie" (firefight) → Add, no attr changes | **"Gaszenie"** (persona mode) | attrs match preset bundle |
| Select preset → open Custom → change any attr → Add | **"Własny"** | `markCreateFormCustom()` → `personaPresetId: "custom"` ([`task-list.tsx:633-635,918-935`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/src/app/_components/task-list.tsx#L633-L635)) |
| Select preset → Add → inline edit urgency | **"Własny"** (post-save) | `getTaskBadgeDisplayMode` divergence rule |
| Effort-only change after preset create | **Preset label stays** | `ignoreEffort: true` in oracle |
| Guest mode preset create | **Legacy badges (no persona)** | Guest hook drops `personaPresetId` |

#### Guest create gap (confirmed bug)

[`use-task-mutations.ts:496-506`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/src/hooks/use-task-mutations.ts#L496-L506) — guest `createTask` omits `personaPresetId`:

```typescript
return taskRepo.create({
  title: input.title,
  workType: input.workType,
  // ... no personaPresetId
});
```

Guest repo **supports** the field at [`guest-repositories.ts:204`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/src/lib/repositories/guest-repositories.ts#L204). Tests exist for repo round-trip ([`guest-repositories.test.ts:36-49`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/src/lib/repositories/guest-repositories.test.ts)) but not hook → UI path.

#### Recommended fix for D-09

1. **Revise display oracle** — return `"persona"` whenever `personaPresetId` is a valid catalog id (not `"custom"`, not `null`), regardless of live attribute divergence. Optionally show preset label **plus** Eisenhower detail when attrs diverge (fourth display mode) instead of replacing with "Własny".
2. **Guest parity** — forward `personaPresetId` in guest `createTask` ([`use-task-mutations.ts:497`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/src/hooks/use-task-mutations.ts#L497)).
3. **Update tests** — `persona-presets.test.ts` divergence case; `task-list.test.tsx`: create firefight → edit urgency → expect `task-persona-badge` "Gaszenie" (or PL equivalent); guest create with preset.
4. **Product-voice / plan note** — document that S-36 divergence display rule is uneważniona per D-09; S-32 rationale may still cite stored preset id even when attrs differ.

#### Browser repro still needed for D-09

Confirm which variant the user hit:

1. Auth: Select "Gaszenie" → Add → badge immediately? After reload?
2. After inline edit: which attribute changed?
3. Guest mode: same flow — expect no persona badge today
4. Custom panel path: preset → Własny → change → Add

---

## Code References

- [`src/app/_components/task-fields-panel.tsx:148-159`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/src/app/_components/task-fields-panel.tsx#L148-L159) — horizon SegmentedControl + weak WHEN_POSSIBLE active color
- [`src/app/_components/task-list.tsx:338`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/src/app/_components/task-list.tsx#L338) — `overflow-hidden` on task row
- [`src/app/_components/task-list.tsx:407-412`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/src/app/_components/task-list.tsx#L407-L412) — edit panel blur-save
- [`src/app/_components/task-list.tsx:717-793`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/src/app/_components/task-list.tsx#L717-L793) — `commitEditIfDirty` + pointerdown outside
- [`src/lib/task/persona-presets.ts:176-198`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/src/lib/task/persona-presets.ts#L176-L198) — badge display oracle (D-09 root)
- [`src/hooks/use-task-mutations.ts:493-506`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/src/hooks/use-task-mutations.ts#L493-L506) — guest create drops personaPresetId
- [`src/app/_components/task-list.test.tsx:333-348`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/src/app/_components/task-list.test.tsx#L333-L348) — SegmentedControl save test (work type only)
- [`src/lib/task/persona-presets.test.ts:178-194`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/src/lib/task/persona-presets.test.ts#L178-L194) — divergence → custom-detail test

## Architecture Insights

1. **Blur-save and SegmentedControl are coupled** — any new save trigger must preserve `onMouseDown preventDefault` on all segmented buttons (S-04, fix-task-edit-blur-save). Horizon chips share the same SegmentedControl primitive as work type.

2. **Display oracle ≠ persistence** — `personaPresetId` stays in DB on inline edit; only the badge renderer demotes. D-09 fix is primarily in `getTaskBadgeDisplayMode` + tests, not schema or tRPC.

3. **Guest hook gaps are a recurring pattern** — persona-presets-v2 added guest repo support but hook forwarding was incomplete for create (similar to pre-fix resumeNote gap in blur-save research).

4. **Create-form `markCreateFormCustom()` is aggressive** — any attribute tweak in create form (including horizon change via custom panel) sends `personaPresetId: "custom"`. If user selects Gaszenie then opens Własny and adjusts horizon, they get "Własny" by design of create flow — may be acceptable or need separate repro clarification.

5. **Test gap on horizon interaction** — L-04 (lessons.md): per-surface edit oracles; horizon chip click path has zero coverage despite work-type SegmentedControl test existing.

## Historical Context (from prior changes)

| Change | Relevance |
| --- | --- |
| [`context/archive/2026-06-12-fix-task-edit-blur-save/`](https://github.com/konrad-kaluzny-ceneo/FlowState/tree/835d18a/context/archive/2026-06-12-fix-task-edit-blur-save) | Shipped `commitEditIfDirty`, panel blur, document pointerdown; SegmentedControl race mitigated |
| [`context/archive/2026-06-14-persona-presets-v2/plan-brief.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/context/archive/2026-06-14-persona-presets-v2/plan-brief.md) | Introduced divergence → custom-detail display; do not clear `personaPresetId` on edit |
| [`context/changes/mvp-defect-intake/change.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/context/changes/mvp-defect-intake/change.md) | D-08 WEAK, D-09 decided — unieważnia S-36 display rule |
| S-04 task-attributes-for-scoring | Original blur vs SegmentedControl race; `mousedown preventDefault` pattern |

## Related Research

- [`context/changes/mvp-defect-intake/research.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/context/changes/mvp-defect-intake/research.md) — parent wave 3 scoping
- [`context/archive/2026-06-12-fix-task-edit-blur-save/research.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/835d18a/context/archive/2026-06-12-fix-task-edit-blur-save/research.md) — pre-fix blur-save analysis

## Open Questions

1. **D-08:** Which hypothesis matches user repro — styling/UX-only, blur race, or overflow clipping?
2. **D-09:** Did user see missing badge on create (guest?) or after edit (divergence oracle)?
3. **D-09 display design:** Preset label only, or preset label + Eisenhower detail when attrs diverge?
4. **Create custom path:** Should changing attrs after selecting preset but before Add still show preset name? (Currently sends `"custom"`.)

## Recommended Next Steps

| Priority | Action |
| --- | --- |
| 1 | Short browser repro session (D-08 checklist + D-09 variant) — can run in parallel with planning |
| 2 | `/10x-plan task-edit-interaction-fixes` — D-09 oracle revision + guest fix are plan-ready; D-08 scope depends on repro |
| 3 | Implementation order: D-09 (high confidence) → D-08 fixes per repro result |

Suggested D-08 fix bundle if repro is inconclusive: distinct WHEN_POSSIBLE active color + horizon SegmentedControl component test + conditional `overflow-hidden` removal in edit mode + deferred blur commit as belt-and-suspenders.
