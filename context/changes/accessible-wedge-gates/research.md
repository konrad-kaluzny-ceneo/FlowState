---
date: 2026-06-26T14:44:00+02:00
researcher: 10x-ship-slice-base (S4 research sub-agent)
git_commit: 643539691274c0afd84f5cdc3a9df5c143e4bf65
branch: features/accessible-wedge-gates
repository: FlowState
topic: "Accessible wedge gates (S-39) — focus, live status, keyboard-first operation across existing wedge gate surfaces"
tags: [research, codebase, accessibility, wedge, overlay-shell, transition-conductor, a11y]
status: complete
last_updated: 2026-06-26
last_updated_by: 10x-ship-slice-base (S4 research sub-agent)
---

# Research: Accessible wedge gates (S-39)

**Date**: 2026-06-26T14:44:00+02:00
**Researcher**: 10x-ship-slice-base (S4 research sub-agent)
**Git Commit**: 643539691274c0afd84f5cdc3a9df5c143e4bf65
**Branch**: features/accessible-wedge-gates
**Repository**: FlowState

## Research Question

Give S-39 (`accessible-wedge-gates`) a concrete codebase basis: inventory each target wedge
gate's current semantic role, focus path, live status, primary keyboard action, and existing
dismiss/test oracle, so the plan can codify a bounded operability contract (focus, announcement,
keyboard-first action) across existing gate surfaces **without** regressing the F-07 one-gate
transition rule or drifting into an app-wide accessibility audit. Scope is bound (per
`change.md` / `frame.md`) to wedge gates: cycle complete, intention/readiness, check-in,
suggestion accept/override, and closure.

## Summary

FlowState already has the right architectural seams for this slice — a single shared overlay
primitive (`OverlayScrim`/`OverlayCard`) and a pure conductor (`resolveWedgeBeat`) that enforces
one blocking gate per beat — but the **accessibility contract is missing at the primitive level**:

1. **No focus management anywhere.** There is zero `autoFocus`, `useRef().focus()` on mount,
   focus trap, or focus restore on close in any wedge overlay or in `overlay-shell.tsx`. The only
   programmatic-focus precedent in the whole UI is roving focus in
   `cycle-audio-preference-control.tsx:44`. Keyboard/screen-reader users can see a gate but are
   not landed in it predictably, and Escape does not dismiss any gate.
2. **Inconsistent modal semantics.** `OverlayScrim` accepts only `role?: "dialog" | "presentation"`
   and defaults to `presentation`; it sets **no** `aria-modal`, `aria-labelledby`, or
   `aria-describedby`. `check-in`, `wind-down`, and `session-closure` overlays pass `role="dialog"`
   but with **unlabeled** headings; `cycle-complete-overlay.tsx` does not even pass `role="dialog"`
   (falls back to `presentation`) — the clearest single inconsistency to fix.
3. **No live-region contract on gate changes.** The reusable `role` + `aria-live` idiom exists
   **only in auth forms**. Every wedge transition status line (in-flow summary, break transition
   line, override acknowledgement) and async gate content (suggestion loading→ready→error) renders
   as plain text with no announcement.
4. **Controls are already keyboard-operable.** Almost every gate action is a native `<button>`
   (Enter/Space work). So "keyboard-first" means labeling + focus order + reliable focus entry,
   **not** a new single-key accelerator system (confirms the frame's WEAK hypothesis).
5. **A11y test infra partly exists but does not cover gates.** `@axe-core/playwright` + an E2E
   spec (`e2e/accessibility.spec.ts`, `pnpm test:e2e:a11y`, from F-06) scan **only the home
   task-list**. No unit/component/hook test asserts any `role`/`aria-*`/focus. Phase 8 of the
   test plan owns the wedge-coherence + dismiss-oracle matrix this slice should extend.

**Confidence for planning: 86/100.** The codebase evidence strongly matches the frame's reframed
problem; remaining unknowns are planning-level choices (exact focus-entry target per gate,
live-region copy wording, modal-vs-inline focus policy split), not framing blockers.

## Detailed Findings

### Area 1 — Shared overlay primitive (`overlay-shell.tsx`)

`OverlayScrim` is the single shared modal wrapper for every conductor gate
([overlay-shell.tsx:30-47](src/app/_components/overlay-shell.tsx)):

- Props: `zIndex` (50/58/60), `role?: "dialog" | "presentation"` defaulting to `"presentation"`
  ([overlay-shell.tsx:26,34](src/app/_components/overlay-shell.tsx)), `testId`, `cycleId`.
- Renders a fixed full-screen scrim `<div role={role}>` — **no** `aria-modal`, `aria-labelledby`,
  `aria-describedby`, no `tabIndex`, no focus capture, no Escape handler, no focus restore.
- `OverlayCard` ([overlay-shell.tsx:58-76](src/app/_components/overlay-shell.tsx)) is a plain
  styled `<div>` with no semantic role.
- Shared button class tokens ([overlay-shell.tsx:78-93](src/app/_components/overlay-shell.tsx)) —
  all consumers use native `<button>`.
- Existing test: `overlay-shell.test.tsx:7` asserts only "renders scrim with test id, dialog role,
  and bg-scrim token" via `getByRole("dialog")` (`:15`) — and that test **passes `role="dialog"`
  explicitly**, so the default-`presentation` path is untested for a11y.

> This is the highest-leverage place to add the contract: centralize `aria-modal`, label/description
> wiring, initial-focus, focus-trap, and focus-restore on `OverlayScrim` once, then opt each modal
> gate in. Inline cards need a separate (lighter) treatment.

### Area 2 — Modal gate inventory (operability matrix)

| Gate | Component | `role` passed | Heading assoc. | aria-modal / labelledby | Focus mgmt | Live region | Controls | Co-located test |
|------|-----------|---------------|----------------|-------------------------|-----------|-------------|----------|-----------------|
| Cycle complete | `cycle-complete-overlay.tsx` (`:49`,`:98`) | **none → presentation** | `<h*>` not id-linked | none | none | none | native `<button>` | `cycle-complete-overlay.test.tsx` (visibility/dismiss only) |
| Check-in | `check-in-overlay.tsx:28` | `dialog` | unlabeled | none | none | none | native `<button>` (energy chips) | backfill component test |
| Wind-down | `wind-down-overlay.tsx:29` | `dialog` | unlabeled | none | none | none | native `<button>` | backfill component test |
| Session closure | `session-closure-overlay.tsx:23` | `dialog` | unlabeled | none | none | none | native `<button>` ("Got it") | belt `session-closure.spec.ts` |
| End-session confirm | `end-session-confirm-overlay.tsx:33` | `dialog` | unlabeled | none | none | none | native `<button>` | — |
| Mid-cycle prompt | `mid-cycle-completion-prompt.tsx:38` | **presentation** | unlabeled | none | none | none | native `<button>` | `mid-cycle-completion-prompt.test.tsx` |
| First-run | `first-run-overlay.tsx` (via `home-shell.tsx:80`) | (verify) | unlabeled | none | none | none | native `<button>` | component test (Phase 7 backfill) |

Notes:
- **`kickoff-readiness-overlay.tsx` and `cycle-intention-prompt.tsx` do not exist** as files. The
  S-25 readiness and intention beats are now **inline cards** (`SessionEnergyCard` /
  `SessionFocusCard` in `session-steering-card.tsx`) gated by `showSessionEnergy` /
  `showSessionFocus` — confirmed by `pomodoro-dashboard.test.tsx:455-456` asserting
  `kickoff-readiness-overlay` / `cycle-intention-prompt` are **absent**. This matches user-flow
  T-06 (overlay readiness replaced by inline steering).
- The single clearest defect: `cycle-complete-overlay.tsx` behaves as a modal gate but omits
  `role="dialog"` (defaults to `presentation`).

### Area 3 — Inline (non-modal) gate surfaces

- **Suggestion card** `task-suggestion-card.tsx`: wrapped in `OverlayCard` (plain div), inner
  `<div data-testid="task-suggestion-card">` (`:215`) with no `role`/`aria-label`; `<h2>` (`:216`)
  not linked. Accept button native (`:167-175`). "Why this?" expander has `aria-expanded` (`:128`)
  — the one good affordance — but no `aria-controls` to its panel (`:137-140`). Status transitions
  loading→ready→empty→error (`:228-276`) swap content with **no `aria-live`**; error is a plain
  `<p>` (`:265`) (unlike auth forms' `role="alert"`).
- **Steering cards** `session-steering-card.tsx`: `SessionEnergyCard` (`:24-43`) and
  `SessionFocusCard` (`:74-125`) are plain `<div>`s, headings unlinked, chips native buttons. The
  custom focus `<input>` (`:98-106`) has **no `<label>`/`aria-label`** (placeholder only).
- **Energy chips** `energy-selector.tsx`: chip row is a bare `<div>` (`:130`) — **no
  `role="radiogroup"`/`group` and no `aria-label`**; chips native buttons (`:132-146`) with no
  `aria-pressed`/selected state surfaced; icons correctly `aria-hidden`.
- **Timer panel** `timer-panel.tsx`: running/paused `<section>` (`:123-130`) without
  `aria-label`; countdown `<p>` (`:145-152`) has **no `aria-live`** (in scope only insofar as
  start/interrupt are gate-adjacent — primary controls already have good `aria-label`s at
  `:154-182`; idle Start button `:232-239` lacks `aria-label`).
- **Override acknowledgement**: not a component — rendered in dashboard as plain
  `<p data-testid="suggestion-override-ack">` (`pomodoro-dashboard.tsx:625-632`), copy from
  `src/lib/suggestion/override-ack-copy.ts`, auto-dismissed after 3s
  (`use-pomodoro-cycle.ts:1167-1169`). A **polite** live region must announce it before it
  disappears.

### Area 4 — Conductor wiring & the one-gate invariant (must not regress)

- `resolveWedgeBeat` ([transition-conductor.ts:105-130](src/lib/wedge/transition-conductor.ts))
  enforces the one-gate rule purely: from `GATE_PRIORITY = [session_closure, wind_down, check_in,
  cycle_complete]` (`:53-58`) exactly one boolean is true. `cyclePaused` suppresses all gates
  (`:63-70`, pol-12).
- **Only those 4 overlays are gated by `wedgeBeat.*`** in the dashboard:
  `CycleCompleteOverlay` (`:702-730`), `SessionClosureOverlay` (`:738-743`), `CheckInOverlay`
  (`:745-769`), `WindDownOverlay` (`:771-778`).
- Everything else is gated by inline booleans that read `wedgeGateActive =
  wedgeBeat.activeGate !== "none"` (`pomodoro-dashboard.tsx:385`) to self-suppress — so coexistence
  is coordinated even though those surfaces are not conductor beats: steering cards (`:473-487`),
  in-flow summary (`:489-496`), break transition line (`:498-507`), suggestion cards
  (`:546-623`), catch-up banners (`:690-700`,`:747-757`,`:551-557`), mid-cycle prompt (`:673-688`).
- Hook dismiss/clear paths for every gate are catalogued (see Code References) — e.g. check-in
  cleared by `submitCheckIn`→`continueAfterCheckIn` (`use-pomodoro-cycle.ts:2702-2755`), closure by
  `dismissSessionClosure` (`:3520-3522`), cycle-complete by `onCycleCompleteConfirm` (`:3082`).

> **Implication:** the accessibility contract should attach to the overlay components / shared
> primitive and to the inline cards — **not** add a new conductor gate. Focus changes must keep the
> inline booleans honoring `wedgeGateActive`, and any focus-trap must release cleanly so the next
> beat's gate can take focus.

### Area 5 — Test surface & a11y infra

- **Conductor**: `transition-conductor.test.ts` (7 `resolveWedgeBeat` + 3 `computeKickoffEligible`
  + 1 `effectiveWorkCyclesAtCheckIn` cases) — pure logic, **no a11y assertions**.
- **Hook**: `use-pomodoro-cycle.test.tsx` — rich dismiss/gate/optimistic/recovery coverage
  (e.g. `dismissSessionClosure clears pending closure overlay` `:1401`; check-in suppression;
  S-34/S-35 paths) — **no a11y/focus assertions**.
- **Dashboard**: `pomodoro-dashboard.test.tsx` overlay visibility matrix (`:154+`) — uses
  `getByTestId`/`queryByTestId`; only incidental `getByRole("button", {name})` selectors, **no
  `aria-*`/focus assertions**.
- **A11y infra present (E2E only):** `@axe-core/playwright` (`package.json:60`), script
  `test:e2e:a11y` (`package.json:23`), `e2e/accessibility.spec.ts` — one test scoped to
  `[data-testid="task-list"]` with `wcag2a`/`wcag2aa`, filtering critical/serious (F-06). **Does
  not exercise any wedge overlay.**
- **Absent:** `jest-axe`/`toHaveNoViolations`, any `src/test-utils/` a11y helper, any `aria-modal`/
  `aria-labelledby`/focus-trap/`autoFocus` in source.

## Code References

- `src/app/_components/overlay-shell.tsx:30-47` — shared `OverlayScrim`; default `role="presentation"`, no aria-modal/label/focus
- `src/app/_components/overlay-shell.tsx:58-76` — `OverlayCard` plain div, no role
- `src/app/_components/cycle-complete-overlay.tsx:49,98` — modal gate WITHOUT `role="dialog"` (presentation fallback) — primary fix target
- `src/app/_components/check-in-overlay.tsx:28` — `role="dialog"`, unlabeled heading
- `src/app/_components/wind-down-overlay.tsx:29` — `role="dialog"`, unlabeled heading
- `src/app/_components/session-closure-overlay.tsx:23` — `role="dialog"`, unlabeled heading
- `src/app/_components/end-session-confirm-overlay.tsx:33` — `role="dialog"`, unlabeled
- `src/app/_components/mid-cycle-completion-prompt.tsx:38` — `presentation`, unlabeled
- `src/app/_components/task-suggestion-card.tsx:128,137-140,167-175,215-216,265` — inline card; `aria-expanded` only; no `aria-live` on status/error
- `src/app/_components/session-steering-card.tsx:24-43,74-125,98-106` — inline steering cards; unlabeled custom input
- `src/app/_components/energy-selector.tsx:130,132-146` — chip row without `role=group`/`radiogroup`; no `aria-pressed`
- `src/app/_components/timer-panel.tsx:123-152,154-182,232-239` — sections without `aria-label`; countdown no `aria-live`; idle Start no `aria-label`
- `src/app/_components/pomodoro-dashboard.tsx:385` — `wedgeGateActive` coordination flag
- `src/app/_components/pomodoro-dashboard.tsx:489-496,498-507,625-632` — plain-text status lines (in-flow summary, break transition line, override ack) needing live-region wrapping
- `src/app/_components/pomodoro-dashboard.tsx:702-778` — the 4 conductor-gated overlays
- `src/lib/wedge/transition-conductor.ts:53-130` — one-gate priority matrix (do not regress)
- `src/hooks/use-pomodoro-cycle.ts:2702-2755,3082,3108,3520-3522` — gate dismiss/clear handlers
- `src/app/auth/sign-in/sign-in-form.tsx:80-83` — reusable `role="alert"` + `aria-live="assertive"` pattern (model for S-39 live regions)
- `src/app/_components/cycle-audio-preference-control.tsx:44` — only roving-focus precedent (reuse candidate for chip groups)
- `src/app/_components/wedge-sync-recovery.tsx:46` — `role="alert"` (only wedge-adjacent live role today)
- `e2e/accessibility.spec.ts:1-33` — axe scan, home task-list only (F-06)
- `package.json:23,60` — `test:e2e:a11y` script + `@axe-core/playwright`

## Architecture Insights

- **Two-tier accessibility contract** maps cleanly to the existing UI split:
  - *Modal gates* (cycle complete, check-in, wind-down, closure, end-session-confirm) → centralize
    `role="dialog"` + `aria-modal` + `aria-labelledby`/`describedby` (heading id wiring) + initial
    focus + focus trap + focus restore on `OverlayScrim`, opt-in per gate.
  - *Inline gates* (steering cards, suggestion card, energy chips) → labeled region/group, normal
    tab order, `aria-pressed`/`aria-expanded` for selected/expand state, `<label>` for the custom
    focus input, and **polite** `aria-live` only where content changes without focus moving
    (suggestion loading→ready→error; override ack).
- **Reuse, don't invent.** The auth-form `role`+`aria-live` idiom and the
  `cycle-audio-preference-control` roving-focus idiom are the in-repo precedents; S-39 should lift
  these rather than add new libraries (no focus-trap dependency present, and none needed for a few
  bounded overlays).
- **Conductor is sacrosanct.** The one-gate rule lives entirely in `resolveWedgeBeat`. Accessibility
  work must not add a gate to `GATE_PRIORITY`; focus-trap teardown must be reliable so successive
  beats can each receive focus.
- **Keyboard-first ≈ already done at the control level.** Native buttons everywhere → no accelerator
  system needed (frame WEAK hypothesis confirmed). The gap is *entry focus, labels, announcement*.

## Risks & Test Implications

| Risk | Detail | Mitigation / test layer |
|------|--------|-------------------------|
| **R1 — Focus trap breaks the one-gate flow** | A trap that doesn't release on close could prevent the next beat's gate from receiving focus, or strand focus after dismiss. High impact (dead-end gate, Risk #12). | Hook/component dismiss oracles per §6.10 matrix; assert focus restored to a sensible anchor on close and that the next gate receives focus. Add focus-restore assertions to `pomodoro-dashboard.test.tsx`. |
| **R2 — Live-region chattiness reintroduces interstitial fatigue** | Over-eager `aria-live="assertive"` or announcing every tick violates PRD US-01 guardrail (one interstitial + one gate per beat). | Use **polite** regions scoped to gate-change content only; do NOT wrap the ticking countdown. Component smoke asserting a single live node per beat. |
| **R3 — Scope drift into app-wide a11y audit** | The existing axe scan (task-list) could tempt a broad sweep. Change note + frame explicitly forbid this. | Keep deliverable to the bounded gate matrix; if extending `accessibility.spec.ts`, scope `.include()` to wedge overlay testids only. |
| **R4 — `role="dialog"` without label fails axe** | Adding dialog semantics without `aria-labelledby` can trade one violation for another. | Wire heading `id` → `aria-labelledby` in the same change; verify with a scoped axe assertion on each overlay. |
| **R5 — Regressing visibility matrix** | `use-pomodoro-cycle.ts`/`pomodoro-dashboard.tsx` are top co-changed hot-spots (change-impact: 43/32 co-changes). Touching them risks gate-visibility regressions. | Run advisory test set: `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx src/app/_components/pomodoro-dashboard.test.tsx src/lib/wedge/transition-conductor.test.ts`; then `set CI=true && pnpm test:e2e:belt`. |
| **R6 — `cyclePaused` / catch-up surfaces lose focus contract** | pol-12 suppresses gates; catch-up banners are non-conductor. Focus logic keyed only on conductor gates could miss these. | Cover paused + catch-up in dismiss/focus tests. |

**Test-plan alignment (Phase 8 — `testing-prd-v3-wedge-coherence`, risks #8/#9/#10/#11/#12):**
S-39 should extend the §6.10 per-gate dismiss matrix with accessibility assertions (role, label,
focus-entry, focus-restore, single polite live node) at the **hook/component layer first**
(per §1 principle #5), adding a belt/axe row only where a component test cannot observe the
behavior. Reference locations: `transition-conductor.test.ts`, `use-pomodoro-cycle.test.tsx`,
`pomodoro-dashboard.test.tsx`, and optionally a wedge-scoped extension of
`e2e/accessibility.spec.ts`.

## Suggested Plan Direction (inputs for /10x-plan)

A narrow, primitive-first operability slice, roughly:

1. **Shared modal a11y contract** — extend `OverlayScrim` (and a small focus hook, e.g.
   `useOverlayFocus`) to provide `aria-modal`, `aria-labelledby`/`describedby` wiring, initial
   focus, focus trap, Escape-to-dismiss (optional, where a dismiss handler exists), and focus
   restore. Opt each modal gate in; fix `cycle-complete-overlay` to pass `role="dialog"`. Component
   tests per overlay.
2. **Labels + heading association** — give each modal gate a heading `id` linked via
   `aria-labelledby`; label inline regions/groups (energy chips `role="group"` + `aria-label`;
   custom focus input `<label>`; chip selected state via `aria-pressed`).
3. **Polite live status** — wrap gate-change/status text (suggestion loading→ready→error, override
   ack, and per-gate status copy) in a single polite live region per beat; reuse the auth-form
   idiom. Decide live-region copy (frame unknown) via decision proxy, defaulting to existing visible
   copy with no new interstitial line.
4. **Keyboard-first verification** — confirm Enter/Space + tab order on every gate action; add the
   idle Start `aria-label`. Do **not** add single-key accelerators.
5. **Phase-8 oracles** — extend the §6.10 dismiss matrix with focus/label/live assertions; scoped
   axe extension only if needed. Update test-plan §6.10 / §3 Phase 8 cookbook entry.

Sequence as hook/component-first phases with a final optional belt/axe extension; keep each phase
behind `pnpm check` + `pnpm test`, with the advisory test set as the regression guard.

## Open Questions (planning-level, non-blocking)

1. **Initial focus target per gate** — heading, first interactive control, or the primary CTA?
   (Convention: focus the first meaningful interactive element or the dialog container with a
   labelled heading.) Owner: implementer at plan time.
2. **Live-region copy + politeness** — exact wording and whether any gate needs `assertive`
   (default to polite; reuse visible copy). Owner: implementer; respect US-01 guardrail.
3. **Escape-to-dismiss policy** — only for gates with a non-destructive dismiss (closure "Got it",
   cycle-complete "Continue later") vs gates that require a choice (check-in). Owner: implementer.
4. **Focus restore anchor** — where focus returns after a gate closes mid-flow (timer panel? task
   list? next gate?). Tie to the conductor's next beat.
5. **Axe at component layer** — adopt `jest-axe`/`vitest-axe` for per-overlay unit scans, or rely on
   a wedge-scoped extension of the existing Playwright axe spec? (Cost × signal; default to
   component assertions + existing E2E axe extension, no new heavy dep.)

## Historical Context (from prior changes)

- `context/changes/accessible-wedge-gates/frame.md` — S3 frame; reframed problem = bounded gate
  operability contract for focus/announcement/keyboard preserving F-07 one-gate rule; WEAK
  hypothesis = broad accelerator system not needed; confidence 87/100.
- `context/changes/accessible-wedge-gates/change.md:12-16` — scope bound to wedge gates; explicit
  "do not expand into a broad accessibility audit"; pair with test-plan Phase 8.
- `context/foundation/lessons.md` — *"Test every wedge transition before shipping transition logic
  changes"* (dead-end gate regressions in `session-entry-wedge-bugs`); L-04 (per-surface latency
  oracle).
- `context/foundation/roadmap-references/flow-coherence-recommendations.md` — F-07 conductor scope
  and the closure/kickoff mutex history (T-01); S-39 sits after F-07/S-21/S-28 landed.
- `context/foundation/user-flow.md:153-296` — gate beats, overlay z-index matrix, T-01–T-06 frictions
  (T-06 readiness overlay replaced by inline steering — confirms no readiness/intention overlay file).
- Prior accessibility precedent: **F-06** introduced `e2e/accessibility.spec.ts` + axe dep (home
  task-list scope only).

## Related Research

- None prior for this change; `frame.md` is the only preceding artifact.

## Advisory (change-impact)

`pnpm change-impact` (target `src/hooks/use-pomodoro-cycle.ts`, since 2026-04-01) top co-changed paths:
`use-pomodoro-cycle.test.tsx` (43), `pomodoro-dashboard.tsx` (32), `task-list.tsx` (12),
`cycle.ts` (12), `cycle.test.ts` (11), `pomodoro-dashboard.test.tsx` (10),
`server-repositories.ts` (9), `e2e/helpers/work-cycle.ts` (8). Suggested guards:
`pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx`,
`pnpm exec vitest run src/app/_components/pomodoro-dashboard.test.tsx`,
`set CI=true && pnpm test:e2e:belt`. Advisory only.
