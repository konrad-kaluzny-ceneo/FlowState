# Shape Brief — Impeccable Design Foundation

**Date:** 2026-06-11  
**Change:** impeccable-design-foundation (F-04)  
**Personality:** Calm / minimal mindfulness  
**Source:** `/10x-plan` planning session + codebase wedge audit

## Personality Statement

FlowState's visual voice is **calm, focused, and restrained** — a quiet room for Pomodoro work, not a productivity dashboard. Palette stays cool navy with purposeful purple accent; whitespace is generous; motion is sub-second and state-conveying only. Delight is restrained (FR-016): a brief completion acknowledgment, never arcade celebration.

## Wedge Surface Inventory

### In scope (S-12 / S-13 craft targets)

| Surface | Components | Craft owner |
| --- | --- | --- |
| Home shell | `home-shell.tsx`, wordmark, guest banner | S-13 |
| Task list | `task-list.tsx` — active/completed hierarchy, focus ring, work-type badges, drag handles | S-13 |
| Timer / controls | `timer-panel.tsx`, `duration-picker.tsx`, `cycle-audio-preference-control.tsx` | S-13 (shell) / shared tokens |
| Cycle overlays | `check-in-overlay.tsx`, `cycle-complete-overlay.tsx`, `task-suggestion-card.tsx`, `wind-down-overlay.tsx`, `mid-cycle-completion-prompt.tsx`, `kickoff-readiness-overlay.tsx`, `tab-return-catchup.tsx`, `first-run-overlay.tsx`, `merge-success-overlay.tsx` | S-12 |
| Energy selector | `energy-selector.tsx` — needs distinct Focused/Steady/Fading identity | S-12 |

### Token-only (no craft in F-04)

| Surface | Notes |
| --- | --- |
| Auth pages | Unified `cta-primary` token; visual craft deferred to S-13 |

### Out of scope

- Focus-shell dimming during WORK (future pattern note in DESIGN.md)
- Copy/voice modules (S-19, S-21, S-17)
- Layout metadata (`"Create T3 App"`) — S-13
- Analytics, settings, non-wedge routes

## Energy Identity Direction

Today all three energy buttons share identical styling. S-12 must differentiate:

| State | Visual direction | Rationale |
| --- | --- | --- |
| **Focused** | Cool violet-blue tint, slightly sharper border, optional focus icon | Peak capacity — crisp, forward |
| **Steady** | Neutral purple (current accent family), balanced | Default middle state |
| **Fading** | Warm muted rose/amber tint, softer border, optional rest icon | Fatigue signal — gentle, not alarming |

All states: same button size and layout; differentiation via border tint, background wash, and optional 16px icon — not color alone.

## Color Personality

- **Shell:** Deep navy gradient (`#1a1a2e` → `#16213e`) — keep as foundation, refine stops in S-13
- **Surfaces:** Glass-morphism cards (`bg-white/10`, `border-white/20`) — calm, not frosted blur slop
- **Primary accent:** Purple family (`purple-600` CTA) — unify auth CTAs to same token
- **Semantic:** Teal for break/rest, green for mark-done, amber for suggestion highlight
- **Text hierarchy:** White primary, `white/60` secondary, `white/40` dimmed

## Motion Principles

- **Overlay enter:** 200ms opacity fade + 8px upward translate (ease-out)
- **Overlay exit:** 150ms opacity fade (ease-in)
- **Completion delight (S-13):** ≤400ms total — opacity pulse + 1.02 scale on completed row, then settle; no confetti, no bounce
- **Interactive rule (L-04):** First visual feedback frame within 200ms; animations run in parallel, never gate optimistic UI
- **Reduced motion:** Opacity-only or instant; no translate/scale

## Component Patterns to Spec

1. **Overlay primitive** — scrim `bg-black/60` + card `rounded-xl border border-white/20 bg-shell p-8 shadow-xl`
2. **Segmented control** — duration picker, audio preference (purple active chip)
3. **Badge chips** — work-type (Deep/Ops/Reactive) single palette source
4. **Primary / secondary CTA** — purple filled vs ghost `border-white/20`
5. **Focus ring** — `ring-purple-500` class preserved for e2e until S-12 coordinates test update

## Anti-patterns to Avoid

- Bolder/expressive palette shifts mid-wedge
- Per-overlay one-off card colors without token
- Motion that blocks 200ms acknowledgement
- Removing or renaming `data-testid` values
- Auth blue/indigo divergence from home purple (token unification required)

## Approval

Planning session locked calm/minimal direction (2026-06-11). Product owner decisions: repo-root DESIGN.md, auth tokens-only, motion spec now, focus-shell as future note.
