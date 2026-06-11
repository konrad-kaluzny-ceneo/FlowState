---
date: 2026-06-11T00:00:00+02:00
researcher: Cursor Agent
git_commit: 548fdbb878837a11001ebdd2af779d1324a8bda6
branch: main
repository: FlowState
topic: "What must F-04 (impeccable-design-foundation) produce, and what is the current visual baseline for wedge surfaces?"
tags: [research, design-system, impeccable, tailwind, wedge-ui, F-04, S-12, S-13]
status: complete
last_updated: 2026-06-11
last_updated_by: Cursor Agent
---

# Research: Impeccable design foundation (F-04)

**Date**: 2026-06-11
**Researcher**: Cursor Agent
**Git Commit**: [`548fdbb`](https://github.com/konrad-kaluzny-ceneo/FlowState/commit/548fdbb878837a11001ebdd2af779d1324a8bda6)
**Branch**: main
**Repository**: [konrad-kaluzny-ceneo/FlowState](https://github.com/konrad-kaluzny-ceneo/FlowState)

## Research Question

What is the current visual/styling baseline in FlowState, which wedge surfaces must F-04 scope to, what does the Impeccable workflow expect, and what constraints must `DESIGN.md` satisfy so S-12 and S-13 can ship craft without breaking behavior or tests?

## Summary

FlowState has **no design system today**. Styling is ad-hoc Tailwind 4 utilities with one font token in [`globals.css`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/548fdbb878837a11001ebdd2af779d1324a8bda6/src/styles/globals.css). A dark navy gradient shell (`#1a1a2e` → `#16213e`), glass-morphism cards (`bg-white/10`, `border-white/20`), and purple primary CTAs repeat across 25+ components — but accent colors diverge (purple home, blue sign-in, indigo sign-up, teal break, green mark-done, amber suggestion highlight). **No `DESIGN.md` exists**; F-04 is the documented gate.

F-04 should produce `DESIGN.md` via Impeccable **shape → document**, scoped to wedge surfaces per roadmap risk mitigation: **home shell, task list (active/completed hierarchy), cycle transitions/overlays**. Downstream S-12 owns overlay craft; S-13 owns home shell + task-list clarity. Prerequisite S-09 is **done** — F-04 is unblocked.

Key planning constraints:

1. **PRD must-haves**: active/completed split visually clear (Secondary Success Criteria, FR-008); selected task highlighted during cycle (US-01); 200ms acknowledgement NFR applies to interactive surfaces (L-04).
2. **Preserve `data-testid` contracts** — S-12 polish is visual-only; e2e asserts overlay visibility and `ring-purple-500` on focused rows.
3. **No shadcn/Radix** — hand-rolled components under `src/app/_components/`; tokens should land in `globals.css` `@theme` (Tailwind v4 CSS-first config).
4. **Open decisions for `/10x-plan`**: calm/minimal vs bolder personality (user); `DESIGN.md` at repo root vs `context/foundation/` (implementer); auth page alignment in F-04 vs defer to S-13.

## Detailed Findings

### Styling stack (Tailwind 4, no config file)

| Layer | Location | Notes |
|-------|----------|-------|
| PostCSS | [`postcss.config.js`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/548fdbb878837a11001ebdd2af779d1324a8bda6/postcss.config.js) | `@tailwindcss/postcss` only |
| Global CSS | [`src/styles/globals.css`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/548fdbb878837a11001ebdd2af779d1324a8bda6/src/styles/globals.css) | `@import "tailwindcss"` + `@theme { --font-sans }` |
| Font | [`src/app/layout.tsx`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/548fdbb878837a11001ebdd2af779d1324a8bda6/src/app/layout.tsx) | Geist via `next/font/google`; `--font-geist-sans` on `<html>` |
| Component lib | — | **None** — no shadcn, Radix, `cn()`, `clsx`, or `cva` in `src/` |

Tailwind v4 uses CSS-first configuration — there is no `tailwind.config.*`. All color, spacing, radius, and shadow values are inline utility strings duplicated per component.

### Current color / surface vocabulary (implicit, not tokenized)

**Shell gradient** (home + auth):

```59:59:src/app/_components/home-shell.tsx
			<main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#1a1a2e] to-[#16213e] text-white">
```

**Overlay card recipe** (repeated ~8×):

- Scrim: `fixed inset-0 … bg-black/60`
- Card: `rounded-xl border border-white/20 bg-[#1a1a2e] p-8 shadow-xl`
- Break variant: `bg-[#1a2e2e] border-teal-400/30`

**Semantic accents** (inconsistent):

| Role | Classes | Example |
|------|---------|---------|
| Primary CTA | `bg-purple-600 hover:bg-purple-500` | timer, task list, overlays |
| Auth sign-in | `bg-blue-600` | `sign-in-form.tsx` |
| Auth sign-up | `bg-indigo-600` | `sign-up-form.tsx` |
| Break / rest | `teal-*` | `cycle-complete-overlay.tsx`, `timer-panel.tsx` |
| Mark done | `bg-green-600` | `cycle-complete-overlay.tsx` |
| Suggestion highlight | `ring-amber-400/80` | `task-list.tsx` |
| Guest alert | amber strip | `guest-banner.tsx` |

**Domain color maps** duplicated in two files:

```29:33:src/app/_components/task-list.tsx
const WORK_TYPE_CONFIG = {
	DEEP_WORK: { label: "Deep", bg: "bg-blue-500/20", text: "text-blue-300" },
	OPERATIONAL: { label: "Ops", bg: "bg-amber-500/20", text: "text-amber-300" },
	REACTIVE: { label: "Reactive", bg: "bg-rose-500/20", text: "text-rose-300" },
} as const;
```

Same structure in `task-suggestion-card.tsx:8-12` — must stay in sync manually.

### Wedge surfaces — current state vs F-04 scope

Roadmap risk: scope discovery to **wedge surfaces only** (home, task list, cycle transitions).

#### 1. Home + task list (S-13 primary)

| Component | Path | Polish level |
|-----------|------|--------------|
| Home shell | `src/app/_components/home-shell.tsx` | T3 boilerplate — generic gradient + wordmark |
| Task list | `src/app/_components/task-list.tsx` | Functional — active `bg-white/10`, completed `bg-white/5` + `line-through` |
| Layout metadata | `src/app/layout.tsx:13-16` | Still `"Create T3 App"` / T3 description |
| Empty guide | `src/app/_components/empty-active-tasks-guide.tsx` | Plain text, no craft |

**Active vs completed** distinction today: opacity + strikethrough only — meets FR-008 structurally but not Secondary Success Criteria "visually clear at a glance" intent.

#### 2. Timer / cycle controls (shared S-12/S-13)

| Component | Path | Notes |
|-----------|------|-------|
| Timer panel | `src/app/_components/timer-panel.tsx` | Large mono countdown; break vs work teal tint |
| Duration picker | `src/app/_components/duration-picker.tsx` | Purple active chips |
| Audio prefs | `src/app/_components/cycle-audio-preference-control.tsx` | Segmented control pattern |

#### 3. Cycle transition overlays (S-12 primary)

| Overlay | Path | Gap |
|---------|------|-----|
| Check-in | `check-in-overlay.tsx` + `energy-selector.tsx` | Three energy options identical styling — no Focused/Steady/Fading identity |
| Cycle complete | `cycle-complete-overlay.tsx` | Work (green) vs break (teal) split; no transition motion |
| Suggestion | `task-suggestion-card.tsx` | Functional card; override ack is flat purple strip in dashboard |
| Wind-down | `wind-down-overlay.tsx` | Same shell as others |
| Mid-cycle | `mid-cycle-completion-prompt.tsx` | Task picker in overlay |
| Kickoff readiness | `kickoff-readiness-overlay.tsx` | Reuses energy selector |
| Tab catch-up | `tab-return-catchup.tsx` | Top banner paired with overlays |
| First-run / merge | `first-run-overlay.tsx`, `merge-success-overlay.tsx` | Same overlay recipe |

**Orchestration**: `pomodoro-dashboard.tsx` gates overlay visibility; z-index range `z-50`–`z-65`.

#### 4. Auth pages (defer or S-13)

Same gradient shell as home but **blue/indigo** submit buttons vs home **purple**. S-14 shipped value narrative; visual system not aligned. Roadmap lists auth alignment as open unknown for S-13.

### Impeccable workflow (from roadmap Stream F)

```
S-09 → F-04 → (S-12 ∥ S-13)
```

Impeccable chain: **[shape → DESIGN.md → craft/polish](https://impeccable.style/docs/)**

| Phase | Skill | F-04 role |
|-------|-------|-----------|
| Discovery | `/impeccable shape` | Lock product voice, personality, wedge surface inventory |
| Document | `/impeccable document` | Write `DESIGN.md` — tokens, typography, color, motion, component patterns |
| Implement | `/impeccable craft` / `polish` | **S-12/S-13**, not F-04 |

F-04 is **documentation-only** — no component refactors in this slice. Output is `DESIGN.md` that downstream craft slices consume.

### PRD / NFR requirements upstream

| Requirement | Source | F-04 implication |
|-------------|--------|------------------|
| Active/completed visually clear | PRD Secondary Success Criteria L37, FR-008 | Token hierarchy for list sections and row states |
| Selected task highlighted | US-01 acceptance | Focus ring token (`ring-purple-500` today) |
| 200ms acknowledgement | NFR L133, L-04 | Motion tokens must not block perceived instant feedback |
| Completion delight | FR-016 nice-to-have | Motion section can spec delight; implementation deferred to S-13 |
| `proposed-FR-visual-design-system` | Roadmap only | Not in `prd.md` body — treat as roadmap expansion intent |

### Test constraints (preserve during craft)

E2E asserts **behavior**, not design:

| Assertion | File |
|-----------|------|
| Overlay `data-testid` visibility | `e2e/pomodoro-cycle.spec.ts`, `e2e/task-suggestion.spec.ts`, etc. |
| `Completed` heading after mark-done | `e2e/pomodoro-cycle.spec.ts` |
| Focused row `ring-purple-500` | `e2e/task-suggestion.spec.ts`, `e2e/session-kickoff.spec.ts` |

**Gaps** (no visual regression): no `toHaveCSS`, screenshot, or token assertions. `test-plan.md` §7 defers FR-016 delight; no Phase row for design QA yet.

**Contracts to preserve** (from archived first-run research):

`first-run-overlay`, `first-run-dismiss-btn`, `check-in-overlay`, `task-suggestion-card`, `suggestion-accept-btn`, `cycle-complete-overlay`, `empty-active-tasks-guide`, etc.

### Recommended `DESIGN.md` contents (planning input)

Based on codebase audit, `DESIGN.md` should at minimum define:

1. **Color tokens** — shell gradient, surface (`card`, `overlay`, `break`), text hierarchy (`primary`, `muted`, `dimmed`), semantic accents (`cta`, `destructive`, `success`, `break`, `suggestion-highlight`)
2. **Typography scale** — page title, overlay heading, timer display (`font-mono text-6xl`), labels, coach copy
3. **Spacing / radius** — card padding (`p-8`), row padding (`px-4 py-3`), `rounded-xl` vs `rounded-lg`
4. **Component patterns** — overlay scrim+card primitive, segmented control, badge chips, primary/secondary CTA
5. **Motion** — overlay enter/exit, state transitions, FR-016 completion delight spec (even if implementation is S-13)
6. **Energy identity** — Focused/Steady/Fading color/icon treatment (S-12 blocker today)
7. **Work-type badge palette** — single source of truth replacing duplicated `WORK_TYPE_CONFIG`
8. **Accent unification** — resolve purple vs blue vs indigo primary split

### `DESIGN.md` placement options

| Location | Pros | Cons |
|----------|------|------|
| Repo root `DESIGN.md` | Impeccable default; agents see it immediately | Mixes product docs with code |
| `context/foundation/DESIGN.md` | Consistent with PRD/roadmap/test-plan | Less discoverable for craft tools |

Recommend **repo root** — Impeccable `craft`/`polish` and agent onboarding (AGENTS.md) can reference `@DESIGN.md` directly. Non-blocking per roadmap.

## Code References

- `src/styles/globals.css:1-7` — sole design token (`--font-sans`)
- `src/app/layout.tsx:13-16` — T3 metadata leak
- `src/app/_components/home-shell.tsx:59` — shell gradient
- `src/app/_components/task-list.tsx:29-33` — work-type color map (duplicated)
- `src/app/_components/task-list.tsx:679-782` — active vs completed sections
- `src/app/_components/check-in-overlay.tsx:25-44` — check-in overlay shell
- `src/app/_components/energy-selector.tsx:54-66` — undifferentiated energy buttons
- `src/app/_components/task-suggestion-card.tsx:199-261` — suggestion card
- `src/app/_components/cycle-complete-overlay.tsx:40-118` — work vs break complete
- `src/app/_components/timer-panel.tsx:97-231` — timer states
- `src/app/auth/sign-in/sign-in-form.tsx:135` — blue CTA divergence
- `postcss.config.js:1-5` — Tailwind 4 PostCSS plugin

## Architecture Insights

1. **CSS-first Tailwind v4** — tokens belong in `globals.css` `@theme { }`, not a JS config file.
2. **No class-merge utility** — conditional classes use template literals; `DESIGN.md` should document patterns without requiring `cn()` adoption.
3. **Overlay duplication** — eight near-identical modal implementations; `DESIGN.md` should spec a shared primitive pattern (implementation in S-12, not F-04).
4. **Functional-first shipping** — six archived slices explicitly deferred visual polish to F-04/S-12/S-13; craft debt is intentional and documented.
5. **Wedge orchestration is stable** — `pomodoro-dashboard.tsx` gate logic should not change in F-04; S-12 is visual-only.

## Historical Context (from prior changes)

| Archive slice | Deferred visual work | Reference |
|---------------|---------------------|-----------|
| first-run-wedge-onboarding (S-11) | Overlay polish → S-12 | `context/archive/2026-06-07-first-run-wedge-onboarding/plan.md` |
| mindful-session-wind-down (S-16) | Design-token pass → S-12 | `context/archive/2026-06-08-mindful-session-wind-down/research.md` |
| auth-merge-first-impression (S-14) | Auth page craft → S-12 or follow-up | `context/archive/2026-06-08-auth-merge-first-impression/plan.md` |
| suggestion-rationale-expander (S-23) | Card restyle → S-12 | `context/archive/2026-06-10-suggestion-rationale-expander/plan-brief.md` |
| persistent-quiet-cycle-audio (S-20) | UI labels refine at S-12 | `context/archive/2026-06-08-persistent-quiet-cycle-audio/plan-brief.md` |
| eisenhower-effort-task-attributes (F-05) | `DESIGN.md` polish explicitly out of scope | `context/archive/2026-06-11-eisenhower-effort-task-attributes/plan-brief.md` |
| task-attributes-for-scoring (S-04) | Documented glass-morphism + purple accent baseline | `context/archive/2026-05-30-task-attributes-for-scoring/plan.md` |

Roadmap orchestration note (`roadmap.md` ~L700): calm voice copy module should unify S-19, S-21, S-17 — **defer copy finalization until `DESIGN.md`**.

## Related Research

- No prior `research.md` for design/visual slices in `context/changes/` or `context/archive/`
- `.kiro/specs/neon-auth/design.md` — auth infra spec, not UI design system

## Open Questions

1. **Personality direction** — calm/minimal vs bolder: user decision required before `/impeccable shape` (roadmap unknown).
2. **`DESIGN.md` location** — repo root (recommended) vs `context/foundation/` (implementer decision).
3. **Auth pages in F-04 scope** — include accent unification in shape discovery, or defer to S-13?
4. **FR-016 motion spec** — document completion delight in `DESIGN.md` now even though implementation is S-13?
5. **Impeccable CLI availability** — no repo-local Impeccable Cursor skill; verify CLI is installed and workflow is understood before plan phase.
6. **Focus shell dimming** — parked in roadmap (dim task chrome during WORK); out of F-04 scope or note as future pattern?
