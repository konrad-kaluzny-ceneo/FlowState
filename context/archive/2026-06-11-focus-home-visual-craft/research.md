---
date: 2026-06-11T16:35:00+00:00
researcher: ship-slice-orchestrator
git_commit: d80a31e
branch: features/focus-home-visual-craft
repository: FlowState
topic: "S-13 focus-home-visual-craft — home shell, task list hierarchy, completion delight"
tags: [research, design-tokens, home-shell, task-list, S-13]
status: complete
last_updated: 2026-06-11
last_updated_by: ship-slice-orchestrator
---

# Research: S-13 focus-home-visual-craft

**Date**: 2026-06-11  
**Branch**: `features/focus-home-visual-craft`  
**Parallel slice**: S-12 (`wedge-overlay-visual-polish`) active in sibling worktree — **do not modify overlay components**; coordinate via shared `globals.css` token names from `DESIGN.md`.

## Research Question

What must change to deliver a cohesive branded home (not T3 boilerplate), clear active/completed task hierarchy, and calm per-task completion delight per FR-016?

## Summary

- Home shell uses hardcoded hex gradient and generic copy; layout metadata still says "Create T3 App".
- Task list already splits active/completed with distinct bg opacity and strikethrough, but colors are inline Tailwind duplicates — not DESIGN.md tokens.
- `globals.css` has only font token; F-04 deferred token migration to S-12/S-13.
- E2E asserts `ring-purple-500` on focused rows — must preserve.
- Auth page alignment is optional unknown — **defer** to avoid scope creep and S-12 parallel conflict.
- Completion delight: CSS keyframe on mark-complete (parallel with optimistic mutation, no await).

## Detailed Findings

### Home shell (`home-shell.tsx`)

- Line 59: `bg-gradient-to-b from-[#1a1a2e] to-[#16213e]` — hardcoded shell colors matching DESIGN.md values but not tokenized.
- Lines 61–62: wordmark + tagline present; craft pass can refine hierarchy and spacing per DESIGN.md typography.

### Layout metadata (`layout.tsx`)

- Lines 13–16: `title: "Create T3 App"` — T3 boilerplate remnant; S-13 scope per F-04 plan.

### Task list (`task-list.tsx`)

- Lines 29–33: `WORK_TYPE_CONFIG` duplicated (also in `task-suggestion-card.tsx` per F-04 research).
- Lines 318–323: active row `bg-white/10`, focus `ring-2 ring-purple-500`, suggestion `ring-amber-400/80`.
- Lines 742–758: completed row `bg-white/5`, title `text-white/50 line-through`.
- No completion delight animation on mark-complete.
- Section headings use `text-white/80 font-semibold text-lg` — aligns with DESIGN.md.

### Guest banner (`guest-banner.tsx`)

- Amber accent styling — within S-13 scope per roadmap risk note (guest banner on home).

### globals.css

- Only `--font-sans` in `@theme` — needs home/task tokens per DESIGN.md § Colors, Task list hierarchy, Motion spec.

### S-12 coordination

- S-12 worktree has same baseline `globals.css` — both slices may add `@theme` tokens. Use canonical names from DESIGN.md; S-13 adds shell/surface/text/CTA/work-type/focus tokens; S-12 owns overlay/energy tokens and overlay component extraction.

## Code References

- `src/app/_components/home-shell.tsx:59-64` — shell gradient + header
- `src/app/layout.tsx:13-16` — metadata boilerplate
- `src/app/_components/task-list.tsx:29-33,318-323,735-758` — badges, rows, completed section
- `src/styles/globals.css:1-7` — minimal theme
- `DESIGN.md:154-161,209-217` — task hierarchy + completion motion spec
- `e2e/task-suggestion.spec.ts:157` — `ring-purple-500` contract

## Architecture Insights

- Tailwind v4 CSS-first: tokens in `@theme { }` become utilities (`bg-shell-top`, `text-dimmed`).
- Preserve e2e class contracts; token alias OK if utility still emits `ring-purple-500`.
- Motion must not block optimistic UI (L-04 / DESIGN.md 200ms rule).

## Open Questions

- Auth page CTA unification: **deferred** (roadmap unknown, non-blocking).
