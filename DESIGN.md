---
name: FlowState
description: Calm mindful Pomodoro for dynamic knowledge workers
colors:
  shell-top: "#1a1a2e"
  shell-bottom: "#16213e"
  surface-overlay: "#1a1a2e"
  surface-break: "#1a2e2e"
  surface-card: "#ffffff1a"
  border-subtle: "#ffffff33"
  border-break: "#2dd4bf4d"
  text-primary: "#ffffff"
  text-secondary: "#ffffff99"
  text-dimmed: "#ffffff66"
  accent-cta: "#9333ea"
  accent-cta-hover: "#a855f7"
  accent-break: "#14b8a6"
  accent-success: "#16a34a"
  accent-suggestion: "#fbbf24"
  energy-focused: "#6366f1"
  energy-steady: "#9333ea"
  energy-fading: "#f472b6"
  worktype-deep-bg: "#3b82f633"
  worktype-deep-text: "#93c5fd"
  worktype-ops-bg: "#f59e0b33"
  worktype-ops-text: "#fcd34d"
  worktype-reactive-bg: "#f43f5e33"
  worktype-reactive-text: "#fda4af"
typography:
  display:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "3.75rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "normal"
  heading:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "normal"
  body:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  timer:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "3.75rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "normal"
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.75rem"
  xl: "0.75rem"
spacing:
  overlay-padding: "2rem"
  row-padding-x: "1rem"
  row-padding-y: "0.75rem"
  section-gap: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.accent-cta}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "0.75rem 1.5rem"
  button-primary-hover:
    backgroundColor: "{colors.accent-cta-hover}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "0.75rem 1.5rem"
  button-secondary:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "0.75rem 1.5rem"
  overlay-card:
    backgroundColor: "{colors.surface-overlay}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    padding: "{spacing.overlay-padding}"
  badge-worktype-deep:
    backgroundColor: "{colors.worktype-deep-bg}"
    textColor: "{colors.worktype-deep-text}"
    rounded: "{rounded.sm}"
    padding: "0.125rem 0.5rem"
---

## Overview

FlowState is a calm, dark-surface Pomodoro app for interrupt-driven knowledge workers. The visual system prioritizes **focus clarity** over decoration: a navy gradient shell, glass-morphism task surfaces, purple primary actions, and semantic accents for break (teal), success (green), and suggestion highlight (amber). Craft targets are wedge surfaces only — home shell, task list hierarchy, and cycle transition overlays.

Implementation uses Tailwind CSS v4 with tokens mapped to `src/styles/globals.css` `@theme { }` in S-12/S-13. This document is the canonical spec; F-04 does not migrate inline utilities.

## Colors

### Shell & surfaces

| Token | Value | Usage |
| --- | --- | --- |
| `shell-top` / `shell-bottom` | `#1a1a2e` → `#16213e` | Page background gradient (home, auth) |
| `surface-overlay` | `#1a1a2e` | Modal/overlay card fill |
| `surface-break` | `#1a2e2e` | Break-state overlays and timer tint |
| `surface-card` | `white/10` | Task rows, nested panels |
| `border-subtle` | `white/20` | Cards, inputs, overlay borders |
| `border-break` | `teal-400/30` | Break-variant overlay border |

### Text hierarchy

| Token | Tailwind | Usage |
| --- | --- | --- |
| Primary | `text-white` | Headings, task titles, timer |
| Secondary | `text-white/60` | Subcopy, overlay descriptions |
| Dimmed | `text-white/40` | Completed tasks, metadata |
| Coach | `text-purple-200/70 text-xs` | Inline coach lines |

### Semantic accents

| Token | Value | Usage |
| --- | --- | --- |
| `accent-cta` | `purple-600` | Primary buttons (timer, task actions, overlays) |
| `accent-cta-hover` | `purple-500` | Primary hover |
| `accent-break` | `teal-500` | Break timer, break complete states |
| `accent-success` | `green-600` | Mark done, completion actions |
| `accent-suggestion` | `amber-400/80` ring | Suggested task row highlight |

**Auth unification (S-13 implements):** Sign-in (`blue-600`) and sign-up (`indigo-600`) today diverge from home purple. Migrate both to `accent-cta` / `accent-cta-hover` tokens.

### Energy identity (S-12 implements)

| State | Border tint | Background wash | Icon (optional) |
| --- | --- | --- | --- |
| Focused | `indigo-400/50` | `indigo-500/15` | Spark / target |
| Steady | `purple-400/50` | `purple-500/15` | Balance / dash |
| Fading | `rose-400/40` | `rose-500/10` | Moon / rest |

### Work-type badge palette (single source — replace duplicated `WORK_TYPE_CONFIG`)

| Type | Label | Background | Text |
| --- | --- | --- | --- |
| DEEP_WORK | Deep | `blue-500/20` | `blue-300` |
| OPERATIONAL | Ops | `amber-500/20` | `amber-300` |
| REACTIVE | Reactive | `rose-500/20` | `rose-300` |

### Task list hierarchy (S-13 implements)

| State | Background | Text | Other |
| --- | --- | --- | --- |
| Active row | `bg-white/10` | `text-white` | Standard weight |
| Completed row | `bg-white/5` | `text-white/40` | `line-through` |
| Selected/focused | — | — | **`ring-purple-500`** (e2e contract — preserve class name until tests updated) |
| Section headings | — | `text-white/80 font-semibold` | "Active" vs "Completed" labels |

## Typography

| Role | Classes | Usage |
| --- | --- | --- |
| Page wordmark | `text-4xl font-bold` | Home header |
| Overlay heading | `text-2xl font-bold text-white` | Check-in, cycle complete |
| Timer display | `font-mono text-6xl font-bold` | Countdown |
| Body | `text-sm text-white/60` | Descriptions, coach copy |
| Label / badge | `text-xs font-semibold` | Work-type chips, metadata |
| Button | `font-semibold` | CTAs, energy options |

Font stack: Geist Sans via `next/font/google` (`--font-geist-sans`). No display/body pairing — one family throughout (product register).

## Elevation

| Level | Treatment | Usage |
| --- | --- | --- |
| Base | Shell gradient | Page background |
| Raised | `bg-white/10 border border-white/20` | Task rows, inline panels |
| Overlay scrim | `fixed inset-0 bg-black/60 z-50–z-65` | All modal overlays |
| Overlay card | `rounded-xl border border-white/20 bg-[#1a1a2e] p-8 shadow-xl` | Overlay content |
| Floating | `shadow-xl` on overlay cards only | No drop shadows on list rows |

No blur/backdrop-filter on cards — glass effect is opacity-based only.

## Components

### Overlay primitive (S-12 extracts shared pattern)

```
Scrim: fixed inset-0 bg-black/60 flex items-center justify-center p-4
Card:  w-full max-w-md rounded-xl border border-white/20 bg-shell p-8 text-center shadow-xl
```

Variants: break card uses `surface-break` + `border-break`. All overlays preserve existing `data-testid` values.

### Segmented control

Active chip: `bg-purple-600 text-white`. Inactive: `bg-white/10 text-white/70 hover:bg-white/15`. Used in duration picker and audio preference.

### Primary / secondary CTA

- **Primary:** `bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg px-6 py-3`
- **Secondary:** `border border-white/20 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-lg px-6 py-3`
- **Destructive/interrupt:** `bg-red-600 hover:bg-red-500` (timer interrupt only)

### Motion spec (S-12/S-13 implement; F-04 documents)

| Interaction | Duration | Easing | Notes |
| --- | --- | --- | --- |
| Overlay enter | 200ms | ease-out | opacity 0→1 + translateY 8px→0 |
| Overlay exit | 150ms | ease-in | opacity 1→0 |
| Completion delight | 400ms max | ease-out | completed row: opacity pulse + scale 1→1.02→1; no bounce |
| Chip/tab switch | 150ms | ease | background color only |
| Reduced motion | 0–50ms | — | opacity-only or instant |

**200ms rule (L-04):** Optimistic UI and hover states must show first frame within 200ms. Motion runs in parallel — never `await` animation before showing interaction feedback.

### E2E contract preservation

Until S-12 coordinates test updates, preserve:

- All existing `data-testid` attributes on wedge components
- Focus ring class `ring-purple-500` on selected task rows (asserted in `e2e/task-suggestion.spec.ts`, `e2e/session-kickoff.spec.ts`)

Token name for focus ring may be `--color-focus-ring` in `@theme`; Tailwind utility must still emit `ring-purple-500` or tests must update in same PR.

### Future patterns (not implemented)

**Focus-shell dimming during WORK:** When a work cycle is active, optionally dim task list chrome (opacity ~0.5) to keep timer as hero. Parked roadmap item — spec only, no F-04/S-12 implementation.

## Do's and Don'ts

### Do

- Use semantic tokens from this doc; map to `@theme` in `globals.css` during S-12/S-13
- Keep active/completed task distinction readable at a glance (opacity + weight + strikethrough)
- Differentiate energy states with tint + label (+ optional icon)
- Unify auth CTAs to `accent-cta` when S-13 touches auth pages
- Respect `prefers-reduced-motion`
- Preserve `data-testid` contracts

### Don't

- Add decorative motion unrelated to state change
- Introduce shadcn/Radix or `cn()` unless a future slice explicitly adopts them
- Use blue/indigo auth accents after token migration
- Ship surprise/arcade completion animations (FR-016)
- Rename e2e-tested classes without updating Playwright specs in the same slice
- Scope creep into non-wedge surfaces during S-12/S-13 craft passes
