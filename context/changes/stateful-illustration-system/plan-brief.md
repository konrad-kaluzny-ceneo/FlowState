# Stateful Illustration System (S-43) — Plan Brief

> Full plan: `context/changes/stateful-illustration-system/plan.md`
> Research: `context/changes/stateful-illustration-system/research.md`

## What & Why

Bind the static Calm Garden illustration (`HomeHeroSprig`) that currently renders identically everywhere to the app's live session state, so users recognize app mode at a glance from the home hero and desktop rail — a state cue, not decoration. Six variants: `idle`, `energy_choice`, `work`, `break`, `return`, `closure`.

## Starting Point

`HomeHeroSprig` (S-28 phase 1) is a zero-prop component composing `CalmGardenBlob` + `CalmGardenSprig`, rendered unchanged in the home hero (`home-shell.tsx:98`) and the desktop rail's reserved slot (`pomodoro-dashboard.tsx:807-811`, S-41's slot, never wired to state). `deriveHomeSessionState()` already computes a 5-value session state (`idle | steering | active_work | break | returning`) once per render; wedge gates (7 files, S-39) have zero illustration imports today, but nothing enforces that boundary.

## Desired End State

The hero and rail illustration crossfades (≤200ms, instant under reduced motion) between six tint/pose variants as the user moves through idle, energy check-in, active work, break, return-to-idle, and post-closure — with an automated test permanently guaranteeing illustrations never appear on any of the four wedge gates.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| 6th variant (`closure`) source | New transient `recentlyClosedSession` flag, not a 6th `HomeSessionState` value | Keeps one source of truth for module-priority logic; mirrors existing `showBreakTransitionLine`/`showInFlowSummary` transient-flag pattern | Research |
| Energy tint scope | `work`/`energy_choice` only, via already-exposed `narrativeLatestEnergy` | Avoids inventing a new energy-derivation path; other variants stay neutral/pastel | Research |
| Guest rail scope | Hero only, no rail illustration for guests | `GuestContextRail` has no illustration slot; adding one is unscoped UI work | Research |
| Crossfade mechanism | CSS `transition-colors`/`transition-opacity` + `motion-reduce:transition-none` | Reuses the exact idiom already in `home-shell.tsx:92` and the S-31/S-33 "shell wash via data-attribute + CSS tokens" precedent; zero new dependencies | Plan |
| Variant artwork scope | Tint/pose-only reuse of `CalmGardenBlob`/`CalmGardenSprig` via a `variant` prop, no new SVG art | Matches "formatter only" / absorption framing used for other phase-2 slices (S-42); keeps scope bounded | Plan |
| Gate boundary enforcement | New static-import-scan test over the 7 gate files | Today's "zero illustration imports" boundary holds by omission only; a test makes it durable | Plan |

## Scope

**In scope:** pure `resolveIllustrationVariant()` derivation; `variant` prop on `HomeHeroSprig`/`CalmGardenBlob`/`CalmGardenSprig`; CSS tint tokens; wiring both hero and rail render sites from one shared derivation; `recentlyClosedSession` transient flag; gate-import guardrail test; E2E state-transition + accessibility verification.

**Out of scope:** new SVG artwork; guest rail illustration slot; energy tinting outside `work`/`energy_choice`; any change to the 7 wedge gate files themselves; Framer Motion or animation libraries; Phase A overlay-scrim work beyond hero/rail.

## Architecture / Approach

One new pure module (`src/lib/design/illustration-variant.ts`) mirrors the existing `work-focus-shell.ts`/`break-atmosphere.ts` pattern — pure function, `wedgeGateActive`-aware, co-located Vitest test. `PomodoroDashboardBody` computes the variant once (alongside its existing `deriveHomeSessionState()` `useMemo`) and passes it to both the hero and rail illustration sites, so there's a single source of truth rather than two independent derivations. CSS carries the crossfade via a `data-illustration-variant` attribute, the same convention S-31/S-33 established for shell-wash effects.

## Phases at a Glance

| Phase | What it delivers | Key risk | Routing |
| --- | --- | --- | --- |
| 1. Pure illustration-variant derivation | `resolveIllustrationVariant()` + `recentlyClosedSession` input, fully unit-tested | Getting the `closure` transient-flag lifecycle wrong (sticky instead of self-clearing) | tdd |
| 2. Component wiring | `variant` prop threaded through SVG primitives + both render sites + CSS tokens | Two independent derivations drifting out of sync between hero and rail | implement |
| 3. Gate guardrail | Automated test asserting zero illustration imports in the 7 gate files | False confidence if the scan is too narrow (misses a barrel re-export path) | tdd |
| 4. E2E verification | Browser-level state-transition + `aria-hidden` + axe checks | Flaky state-transition timing in Playwright without proper wait conditions | e2e |

**Prerequisites:** S-28 phase 1 (done), F-06 Serene Pastel tokens (done), F-07 conductor (done), S-39 accessible wedge gates (done) — all satisfied.
**Estimated effort:** ~4 phases across 1-2 sessions; small-to-medium blast radius (3 illustration files, 2 render-site files, 1 new pure module, 1 new guardrail test, 1 new E2E spec).

## Open Risks & Assumptions

- Resolved during plan review: `home-shell.tsx`'s `HomeShellContent` and `PomodoroDashboardBody` are **siblings** (both rendered inside `HomeShellContent`, not parent/child) — `PomodoroDashboardBody` cannot own the single derivation as originally drafted. Plan now specifies `HomeShellContent` as the derivation owner, with `narrativeLatestEnergy`/`recentlyClosedSession` surfaced up to it via the shared provider/hook layer.
- CSS token additions in `globals.css` should reuse existing `--color-*` tokens where a variant's mood already has one (e.g. `break` reuses `--color-surface-break`) to avoid token sprawl.

## Success Criteria (Summary)

- Hero and rail illustration visibly and correctly reflects `idle`/`energy_choice`/`work`/`break`/`return`/`closure` in a live session, crossfading ≤200ms (instant under reduced motion).
- An automated test fails the build if any wedge gate file ever imports the illustration component.
- Axe accessibility scan and the E2E belt suite remain green after the change.
