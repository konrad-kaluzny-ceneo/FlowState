---
date: 2026-06-12T12:00:00+02:00
researcher: ship-slice-orchestrator
git_commit: 753fae8c964e85c2c43887093b9217956d222b89
branch: main
repository: FlowState
topic: "F-06 serene-pastel-rebrand — token pivot, wedge surface remap, e2e contracts"
tags: [research, design-tokens, DESIGN.md, globals.css, home-shell, overlay-shell, task-list, auth, F-06]
status: complete
last_updated: 2026-06-12
last_updated_by: ship-slice-orchestrator
---

# Research: F-06 Serene Pastel Well-being rebrand

**Date**: 2026-06-12  
**Researcher**: ship-slice-orchestrator  
**Git Commit**: `753fae8c964e85c2c43887093b9217956d222b89`  
**Branch**: `main` (feature branch not yet created)  
**Repository**: FlowState

## Research Question

What must change to pivot `DESIGN.md` and `globals.css` `@theme` from dark navy glass to **Serene Pastel Well-being** as the canonical light-default palette, remapping `home-shell`, `overlay-shell` scrims, task cards, and auth CTAs — without breaking e2e contracts?

## Summary

- FlowState still runs on the **dark navy / glass-morphism** system established by F-04, S-12, and S-13. `@theme` in `globals.css` defines 29 color tokens; wedge surfaces use them **partially** (~40% tokenized).
- **Serene Pastel palette is committed in Linear FLO-62 / GitHub #97** but not yet in `DESIGN.md` or `globals.css`. Planning must port the Linear spec into `DESIGN.md` + `@theme` via Impeccable shape.
- **Auth is fully decoupled** from `@theme`: four pages duplicate hardcoded `#1a1a2e`→`#16213e` gradients and use blue/indigo CTAs instead of `accent-cta`.
- **E2E breakage surface is small but critical**: two `@skip-belt` specs assert `ring-purple-500`; one unit test asserts `bg-purple-600`. Belt specs use `data-testid` only — safe across palette change.
- **Orphan overlays** (`first-run-overlay`, `merge-success-overlay`, `tab-return-catchup`) bypass `overlay-shell` with duplicate hex patterns — consolidate during rebrand.
- Recommended plan split: (1) spec + light tokens, (2) home + task + auth, (3) overlay wedge surfaces, (4) e2e contract pass, (5) optional calm dark sub-phase.

## Committed palette (Linear FLO-62 — not yet in repo)

| Role | Value | Replaces |
| --- | --- | --- |
| Shell gradient top | `#FAF8F5` (linen) | `#1a1a2e` |
| Shell gradient bottom | `#F0EBF8` (lavender mist) | `#16213e` |
| Cards | `#FFFFFF` + soft shadow + border `#E5E0EB` | white/10 glass on dark |
| Overlay scrim | `rgba(248,246,243,0.72)` mist | `bg-black/60` |
| CTA | `#5E5290` (muted plum-lavender) | `#9333ea` purple |
| Break accent | `#3D8F82` | `#14b8a6` teal |
| Success accent | `#3A8F65` | `#16a34a` green |
| Typography | Geist retained; soften weights (`font-semibold` vs `font-bold`) | current bold hierarchy |
| Calm dark (optional sub-phase) | `#1E2433` shell + desaturated pastels | current navy |

## Detailed Findings

### Token system (`globals.css` + `DESIGN.md`)

Current `@theme` block (`src/styles/globals.css:3-37`) mirrors `DESIGN.md` frontmatter — all dark-surface values:

| Category | Tokens | Current character |
| --- | --- | --- |
| Shell | `shell-top`, `shell-bottom` | `#1a1a2e` → `#16213e` gradient |
| Surfaces | `surface-overlay`, `surface-break`, `surface-card`, `surface-card-muted`, `surface-panel` | Navy fills + white/alpha glass |
| Text | `text-secondary`, `text-dimmed`, `text-section` | White opacity steps; **no `text-primary` token** — runtime uses raw `text-white` |
| Accents | `accent-cta`, `accent-break`, `accent-success`, `accent-suggestion` | Purple / teal / green / amber |
| Energy | `energy-focused/steady/fading` border/bg | Indigo / purple / rose washes |
| Work type | `worktype-deep/ops/reactive` bg/text | Blue / amber / rose — fully tokenized via `work-type-config.ts` |

**Missing tokens** (hardcoded patterns repeat across files):

- `--color-text-primary` (replaces `text-white`)
- `--color-scrim` (replaces `bg-black/60` in overlay scrims)
- `--color-focus-ring` (DESIGN.md mentions but never defined; e2e uses `ring-purple-500`)
- `--color-segment-active/inactive` (replaces `bg-purple-600` / `bg-white/10` in 4 segmented-control components)

Motion keyframes (`overlay-enter`, `task-complete-delight`) in `globals.css:39-82` are palette-agnostic — carry forward unchanged.

### Wedge surfaces — token vs inline inventory

#### Home shell (`home-shell.tsx`)

- Line 59: `from-shell-top to-shell-bottom` — **tokenized** gradient
- Line 61: `text-white` on wordmark — **inline**
- Line 63: `text-text-secondary` — **tokenized**

#### Overlay shell (`overlay-shell.tsx`)

- Card variants use `bg-surface-overlay`, `bg-surface-break`, `border-border-*` — **tokenized**
- Line 39 scrim: `bg-black/60` — **not tokenized**
- `overlayButtonClass`: mix of `accent-*` tokens + inline `hover:bg-green-500`, `hover:bg-teal-500`, `bg-white/5`
- Suggestion variant: `ring-amber-400/20` — inline

**Overlay consumers** (cycle-complete, check-in, kickoff-readiness, mid-cycle, wind-down) inherit shell primitives but add inline teal/purple/red copy colors.

#### Task list (`task-list.tsx`)

- Surfaces, borders, CTA buttons — heavily **tokenized**
- Line 319: `ring-2 ring-purple-500` focus — **e2e contract, inline**
- Line 321: `ring-accent-suggestion` — **tokenized**
- Badges: importance `bg-indigo-500/20`, ASAP `bg-orange-500/25` — inline
- Completion: `animate-task-complete` + green hover/checkbox — inline

#### Auth (`src/app/auth/**`)

Four self-contained pages (no shared layout) with duplicated shell:

```
main: from-[#1a1a2e] to-[#16213e]  (hardcoded hex, not from-shell-top)
card: bg-white/5 backdrop-blur-sm
```

| Surface | CTA | Focus ring |
| --- | --- | --- |
| Sign-in | `bg-blue-600` | `focus:ring-blue-500` |
| Sign-up | `bg-indigo-600` | `focus:ring-indigo-500` |
| Forgot/reset | `bg-blue-600` | blue focus |

Auth does **not** use `accent-cta` despite DESIGN.md line 136 calling for migration.

#### Orphan overlays (bypass `overlay-shell`)

| File | Pattern |
| --- | --- |
| `first-run-overlay.tsx:24-32` | `bg-black/60`, `bg-[#1a1a2e]`, `bg-purple-600` |
| `merge-success-overlay.tsx:72-93` | Same duplicate pattern |
| `tab-return-catchup.tsx:37-38` | `bg-[#1a1a2e]`, `bg-[#1a2e2e]` |

#### Hardcoded-only components (no semantic tokens)

`timer-panel.tsx`, `duration-picker.tsx`, `cycle-audio-preference-control.tsx`, `kickoff-duration-chips.tsx`, `pomodoro-dashboard.tsx`, `user-menu.tsx`, `guest-import-on-mount.tsx`, `empty-active-tasks-guide.tsx`

### E2E and test contracts

| File:line | Assertion | Belt? | Breaks when… |
| --- | --- | --- | --- |
| `e2e/task-suggestion.spec.ts:157` | `/ring-purple-500/` | No (`@skip-belt`) | Focus ring utility renamed |
| `e2e/session-kickoff.spec.ts:165` | `/ring-purple-500/` | No (`@skip-belt`) | Same |
| `duration-picker.test.tsx:49` | `bg-purple-600` | Unit | Chip uses `bg-accent-cta` |
| `overlay-shell.test.tsx:26` | `.bg-surface-break` | Unit | Token utility renamed (not color change) |
| `task-list.test.tsx:191,195` | `animate-task-complete` | Unit | Motion class renamed (not palette) |

Belt merge-gate specs assert `data-testid` and copy — **no color/class checks**. DESIGN.md § E2E contract preservation requires updating tests in same slice if focus ring migrates.

**Recommended strategy:** Introduce semantic `ring-focus` (or `ring-accent-focus`) via `@theme`, update `task-list.tsx` + both e2e specs in same PR. For `duration-picker.test.tsx`, assert `aria-pressed="true"` instead of color class.

### PRD alignment

- **Secondary Success Criteria**: completed/active task split visually clear — satisfied by hierarchy tokens; rebrand must preserve contrast on light surfaces.
- **US-01**: selected task visually highlighted — focus ring contract must survive.
- **NFR 200ms**: motion timing unchanged (`overlay-enter` 200ms).
- **`proposed-FR-visual-design-system`**: cited in roadmap but **absent from `prd.md` body** — palette definition owned by `DESIGN.md` update in this slice.

## Code References

- `src/styles/globals.css:3-37` — canonical `@theme` token block (remap target)
- `DESIGN.md:98-102` — current dark-surface overview (full rewrite needed)
- `DESIGN.md:221-228` — e2e contract preservation section
- `src/app/_components/home-shell.tsx:59` — shell gradient (tokenized)
- `src/app/_components/overlay-shell.tsx:39` — scrim `bg-black/60` (not tokenized)
- `src/app/_components/task-list.tsx:318-321` — focus ring + suggestion highlight
- `src/lib/design/work-type-config.ts` — fully tokenized work-type badges
- `src/app/auth/sign-in/page.tsx:7-8` — hardcoded auth shell gradient
- `src/app/auth/sign-in/sign-in-form.tsx:135` — blue CTA diverging from wedge
- `context/foundation/roadmap.md:201-216` — F-06 outcome, unknowns, risks

## Architecture Insights

1. **Single `@theme` source of truth** — Tailwind v4 CSS-first; changing token values propagates to all `bg-*`, `text-*`, `border-*`, `ring-*` utilities. Prefer **value swap** over class renames where semantics map 1:1.
2. **Polarity flip** — light-default pastel implies dark text on light surfaces. Cannot be a pure value swap; `text-white` → `text-primary` migration is required across ~30 components.
3. **Surface ownership pattern from S-12/S-13** — home/task surfaces and overlay surfaces were parallel slices sharing `globals.css`. F-06 touches both in one foundation slice — no worktree split needed, but plan should sequence home → overlays to manage risk.
4. **Scrim + card primitive** — `overlay-shell.tsx` centralizes wedge overlay styling; orphan overlays should migrate to shared primitive during rebrand.
5. **Dual-theme consideration** — roadmap optional calm dark on `#1E2433` suggests planning for two theme sets (`@theme` light + `[data-theme=dark]` or sub-phase) rather than destructive in-place swap.

## Historical Context (from prior changes)

- **F-04** (`context/archive/2026-06-11-impeccable-design-foundation/`): documentation-only; locked dark navy personality; deferred token migration to S-12/S-13.
- **S-13** (`context/archive/2026-06-11-focus-home-visual-craft/`): added home `@theme` tokens; bound scope to home-shell + task-list; deferred auth; preserved `ring-purple-500` e2e contract.
- **S-12** (`context/archive/2026-06-11-wedge-overlay-visual-polish/`): added overlay/energy tokens + `overlay-shell` primitive; visual-only; preserved all `data-testid` contracts.
- **Wellness batch** (`roadmap.md` L697-711): P-101 Serene Pastel (75/90) → F-06; calm-dark-mode-option (42/90) merged as optional sub-phase; P-103 wedge garden craft not committed.

## Related Research

- `context/archive/2026-06-11-impeccable-design-foundation/research.md` — pre-rebrand palette audit
- `context/archive/2026-06-11-focus-home-visual-craft/research.md` — home token migration pattern
- `context/archive/2026-06-11-wedge-overlay-visual-polish/research.md` — overlay primitive extraction

## Open Questions

| Question | Options | Recommendation |
| --- | --- | --- |
| Light-only vs calm dark in DESIGN.md | Ship light-default only; or spec + implement calm dark on `#1E2433` | **Light-default only in main phases**; calm dark as optional phase 5 (roadmap default bias) |
| E2e focus ring migration | Preserve `ring-purple-500` alias vs semantic utility + test update | **Semantic `ring-focus` + update e2e in same PR** (aligns with F-06 risk note) |
| Serene Pastel hex palette | Committed in Linear FLO-62; absent from `DESIGN.md`/`globals.css` | **Plan phase ports Linear spec → `DESIGN.md` + `@theme`** via Impeccable shape |
| Timer/segmented controls scope | In or out of F-06 wedge boundary | **In** — `bg-purple-600` active chips are user-visible on home wedge; tokenize to `accent-cta` |
| Orphan overlays | Migrate to `overlay-shell` in F-06 or defer | **In** — eliminates duplicate hex; low logic risk |

## Recommended plan phases (for `/10x-plan`)

| Phase | Scope | Files (primary) |
| --- | --- | --- |
| 1 | Impeccable shape + `DESIGN.md` rewrite + `@theme` light-default values | `DESIGN.md`, `globals.css` |
| 2 | Home + task + auth remap | `home-shell.tsx`, `task-list.tsx`, `src/app/auth/**`, `layout.tsx` user menu |
| 3 | Overlay wedge surfaces + orphan consolidation | `overlay-shell.tsx`, overlay consumers, `first-run-overlay.tsx`, `merge-success-overlay.tsx` |
| 4 | Segmented controls + timer chrome tokenization | `timer-panel.tsx`, `duration-picker.tsx`, `cycle-audio-preference-control.tsx`, `kickoff-duration-chips.tsx` |
| 5 | E2e + unit test contract updates | `e2e/task-suggestion.spec.ts`, `e2e/session-kickoff.spec.ts`, `duration-picker.test.tsx` |
| 6 (optional) | Calm dark variant on `#1E2433` | `DESIGN.md` dark section + `@theme` dark overrides |

**Explicitly out of scope:** Calm Garden illustrations (S-28), P-103 wedge garden craft, focus-shell dimming, copy/voice modules, visual regression test infrastructure.
