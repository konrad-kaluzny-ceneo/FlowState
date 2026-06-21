---
name: FlowState
description: Calm mindful Pomodoro for dynamic knowledge workers
colors:
  shell-top: "#FAF8F5"
  shell-bottom: "#EDEAE4"
  surface-overlay: "#FFFFFF"
  surface-break: "#E8F4F2"
  surface-card: "#FFFFFF"
  surface-card-muted: "#F3F1EC"
  border-subtle: "#E0DDD6"
  border-break: "#3D8F824D"
  text-primary: "#2D2A35"
  text-secondary: "#5C5768"
  text-dimmed: "#9B96A8"
  text-section: "#3D3848"
  scrim: "#F8F6F3B8"
  accent-cta: "#736D62"
  accent-cta-hover: "#635E54"
  on-cta: "#FFFFFF"
  accent-break: "#3D8F82"
  accent-success: "#3A8F65"
  accent-suggestion: "#D4A017CC"
  focus-ring: "#8A8478"
  segment-active: "#736D62"
  segment-inactive: "#E8E5DF"
  card-border: "#E0DDD6"
  card-shadow: "#2D2A3514"
  energy-focused: "#5B7FC4"
  energy-steady: "#736D62"
  energy-fading: "#B26A82"
  worktype-deep-bg: "#3D5A8F1F"
  worktype-deep-text: "#3D5A8F"
  worktype-ops-bg: "#B5822A1F"
  worktype-ops-text: "#8A6520"
  worktype-reactive-bg: "#B2445A1F"
  worktype-reactive-text: "#9E3D52"
typography:
  display:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "3.75rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "normal"
  heading:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
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
    fontWeight: 600
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
    textColor: "{colors.on-cta}"
    rounded: "{rounded.lg}"
    padding: "0.75rem 1.5rem"
  button-primary-hover:
    backgroundColor: "{colors.accent-cta-hover}"
    textColor: "{colors.on-cta}"
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

FlowState is a calm, **light-default** Pomodoro app for interrupt-driven knowledge workers. The visual system prioritizes **focus clarity** over decoration: a linen-to-cool-stone shell gradient, solid white task cards with soft elevation, muted cool-stone beige primary actions, and semantic accents for break (teal), success (green), and suggestion highlight (amber). A **calm dark** variant on `#1E2433` uses desaturated pastels for low-light sessions.

Craft targets are wedge surfaces only — home shell, task list hierarchy, and cycle transition overlays. Implementation uses Tailwind CSS v4 with semantic tokens in `src/styles/globals.css` `@theme { }`; calm dark overrides the same `--color-*` variables under `[data-theme="dark"]` on `<html>`.

## Theme behavior

| Preference | Resolution | Persistence |
| --- | --- | --- |
| Light | `data-theme="light"` | `localStorage` key `flowstate-theme` |
| Dark | `data-theme="dark"` | same |
| System | `matchMedia('(prefers-color-scheme: dark)')` | same |

A blocking inline script in `layout.tsx` `<head>` sets `data-theme` before first paint to prevent FOUC. Default when no preference stored: **light**. Theme toggle lives in the authenticated user menu (Phase 2); logged-out auth pages respect script/system preference without a toggle.

## Colors

### Light-default (canonical)

#### Shell & surfaces

| Token | Value | Usage |
| --- | --- | --- |
| `shell-top` / `shell-bottom` | `#FAF8F5` → `#EDEAE4` | Page background gradient |
| `surface-overlay` | `#FFFFFF` | Modal/overlay card fill |
| `surface-break` | `#E8F4F2` | Break-state overlays and timer tint |
| `surface-card` | `#FFFFFF` | Task rows, nested panels |
| `surface-card-muted` | `#F3F1EC` | Completed rows, subdued panels |
| `border-subtle` / `card-border` | `#E0DDD6` | Cards, inputs, overlay borders |
| `border-break` | `#3D8F82` at 30% | Break-variant overlay border |
| `scrim` | `rgba(248,246,243,0.72)` | Overlay backdrop (mist) |

#### Text hierarchy

| Token | Tailwind | Usage |
| --- | --- | --- |
| Primary | `text-primary` | Headings, task titles, timer |
| Secondary | `text-text-secondary` | Subcopy, overlay descriptions |
| Dimmed | `text-text-dimmed` | Completed tasks, metadata |
| Section | `text-text-section` | "Active" / "Completed" labels |

#### Semantic accents

| Token | Value | Usage |
| --- | --- | --- |
| `accent-cta` | `#736D62` | Primary buttons |
| `accent-cta-hover` | `#635E54` | Primary hover |
| `on-cta` | `#FFFFFF` | Text on filled CTAs |
| `accent-break` | `#3D8F82` | Break timer, break complete |
| `accent-success` | `#3A8F65` | Mark done, completion |
| `accent-suggestion` | `amber` ring | Suggested task row highlight |
| `focus-ring` | `#8A8478` | Selected task focus ring |

**CTA contrast:** Cool-stone CTA requires explicit `text-on-cta` — never `text-primary` on filled buttons.

### Calm dark

| Token | Value | Notes |
| --- | --- | --- |
| Shell | `#1E2433` → `#252B3D` | Subtle gradient, not navy glass |
| `surface-card` | `#2A3142` | Elevated from shell |
| `surface-card-muted` | `#232936` | Completed rows |
| `text-primary` | `#F5F3F0` | Light ink |
| `accent-cta` | `#9A9489` | Desaturated cool stone |
| `accent-break` | `#4A9A8E` | Desaturated teal |
| `accent-success` | `#4A9468` | Desaturated green |
| `scrim` | `rgba(30,36,51,0.78)` | Subdued backdrop |
| `focus-ring` | `#B0AAA0` | Visible on dark cards |

Work-type and energy badge tokens retokenize per theme — dark-designed washes fail contrast on light `#FFFFFF` cards.

### Energy identity

| State | Light border/bg | Dark border/bg |
| --- | --- | --- |
| Focused | indigo wash | desaturated indigo |
| Steady | stone wash | desaturated stone |
| Fading | rose wash | desaturated rose |

Each state uses `energy-*-border` + `energy-*-bg` token pairs. Label + optional icon required — color alone is insufficient.

### Work-type badge palette (`work-type-config.ts`)

| Type | Light bg/text | Dark bg/text |
| --- | --- | --- |
| DEEP_WORK | `#3D5A8F` wash | `#93c5fd` on indigo wash |
| OPERATIONAL | amber wash | `#fcd34d` on amber wash |
| REACTIVE | rose wash | `#fda4af` on rose wash |

### Task list hierarchy

| State | Background | Text | Other |
| --- | --- | --- | --- |
| Active row | `bg-surface-card` | `text-primary` | Standard weight |
| Completed row | `bg-surface-card-muted` | `text-text-dimmed` | checkmark + dim text (no strikethrough) |
| Selected/focused | — | — | `ring-2 ring-focus` |
| Section headings | — | `text-text-section font-semibold` | "Active" vs "Completed" |

## Typography

| Role | Classes | Usage |
| --- | --- | --- |
| Page wordmark | `text-4xl font-semibold` | Home header |
| Overlay heading | `text-2xl font-semibold text-primary` | Check-in, cycle complete |
| Timer display | `font-mono text-6xl font-semibold` | Countdown |
| Body | `text-sm text-text-secondary` | Descriptions, coach copy |
| Label / badge | `text-xs font-semibold` | Work-type chips, metadata |
| Button | `font-semibold` | CTAs, energy options |

Font stack: Geist Sans via `next/font/google` (`--font-geist-sans`). Wedge headings softened from `font-bold` to `font-semibold` per well-being register.

## Elevation

| Level | Light treatment | Dark treatment |
| --- | --- | --- |
| Base | Linen/lavender shell gradient | `#1E2433` shell |
| Raised | `bg-surface-card border border-card-border shadow-sm` | `bg-surface-card border border-border-subtle` |
| Overlay scrim | `fixed inset-0 bg-scrim` | Same token, dark value |
| Overlay card | `rounded-xl border bg-surface-overlay p-8 shadow-xl` | Elevated dark card |
| Floating | `shadow-xl` on overlay cards only | No row drop shadows |

No glassmorphism or backdrop-blur on cards — solid surfaces with border + soft shadow (light) or flat elevation (dark).

## Components

### Overlay primitive

```
Scrim: fixed inset-0 bg-scrim flex items-center justify-center p-4
Card:  w-full max-w-md rounded-xl border border-border-subtle bg-surface-overlay p-8 text-center shadow-xl
```

Variants: break card uses `surface-break` + `border-break`. All overlays preserve existing `data-testid` values.

### Segmented control

Active chip: `bg-segment-active text-on-cta`. Inactive: `bg-segment-inactive text-text-secondary`. Used in duration picker and audio preference.

### Primary / secondary CTA

- **Primary:** `bg-accent-cta hover:bg-accent-cta-hover text-on-cta font-semibold rounded-lg px-6 py-3`
- **Secondary:** `border border-border-subtle bg-surface-card hover:bg-surface-card-muted text-primary font-semibold rounded-lg px-6 py-3`
- **Destructive/interrupt:** `bg-red-600 hover:bg-red-500 text-on-cta` (timer interrupt only)

### Motion spec

| Interaction | Duration | Easing | Notes |
| --- | --- | --- | --- |
| Overlay enter | 200ms | ease-out | opacity 0→1 + translateY 8px→0 |
| Overlay exit | 150ms | ease-in | opacity 1→0 |
| Completion delight | 400ms max | ease-out | completed row: opacity pulse + scale 1→1.02→1; no bounce |
| Chip/tab switch | 150ms | ease | background color only |
| Reduced motion | 0–50ms | — | opacity-only or instant |

**200ms rule (L-04):** Optimistic UI and hover states must show first frame within 200ms. Motion runs in parallel — never `await` animation before showing interaction feedback.

### E2E contract preservation

Preserve all existing `data-testid` attributes on wedge components.

Focus ring: semantic utility `ring-2 ring-focus` on selected/focused task rows. Asserted in `e2e/task-suggestion.spec.ts` and `e2e/session-kickoff.spec.ts` (`@skip-belt`).

Accessibility: `e2e/accessibility.spec.ts` scans the authenticated task list wedge via `@axe-core/playwright`. CI runs `pnpm test:e2e:a11y` after the belt; fails on `critical` or `serious` violations.

### Future patterns (not implemented)

**Focus-shell dimming during WORK:** When a work cycle is active, optionally dim task list chrome (opacity ~0.5) to keep timer as hero. Parked roadmap item — spec only.

## Do's and Don'ts

### Do

- Use semantic tokens from this doc; map to `@theme` in `globals.css`
- Keep active/completed task distinction readable at a glance
- Use `text-on-cta` on filled primary buttons
- Differentiate energy states with tint + label (+ optional icon)
- Unify auth CTAs to `accent-cta` / `accent-cta-hover`
- Respect `prefers-reduced-motion` and theme preference
- Preserve `data-testid` contracts

### Don't

- Add decorative motion unrelated to state change
- Introduce shadcn/Radix or `cn()` unless a future slice adopts them
- Use blue/indigo auth accents
- Ship surprise/arcade completion animations (FR-016)
- Use `text-white` or polarity-assuming opacity utilities on wedge surfaces
- Assume dark-surface contrast ratios on light cards
- Rename e2e-tested classes without updating Playwright specs in the same slice
