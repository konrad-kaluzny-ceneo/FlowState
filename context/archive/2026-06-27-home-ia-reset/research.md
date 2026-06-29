---
date: 2026-06-27T18:30:00+02:00
researcher: Cursor (S4 research, /10x-ship-slice-base)
git_commit: fd8936df070244821570edf18a9ee2cc84c198f8
branch: features/home-ia-reset
repository: FlowState
topic: "S-40 Home IA reset — home answers 'Co teraz?' with one dominant next-focus, recap collapsed, inventory secondary"
tags: [research, codebase, home-ia, pomodoro-dashboard, product-voice, session-state]
status: complete
last_updated: 2026-06-27
last_updated_by: Cursor (S4 research)
---

# Research: S-40 Home IA reset

**Date**: 2026-06-27T18:30:00+02:00
**Researcher**: Cursor (S4 research, `/10x-ship-slice-base`)
**Git Commit**: fd8936df070244821570edf18a9ee2cc84c198f8
**Branch**: features/home-ia-reset
**Repository**: FlowState

## Research Question

Produce the research baseline for S-40 (`home-ia-reset`). Outcome: home reads as a calm decision
screen — **"Co teraz?"** is primary; one next-focus suggestion + one dominant CTA above the fold;
task list demoted to inventory; daily recap collapsed to context only. Acceptance asks for a **pure
session-state derivation** (`idle / steering / active_work / break / returning`) feeding a
**module priority matrix** (`primary / secondary / hidden`), with the recap collapsed on first paint
and the timer as hero during active work. Ground everything in current code + F-14 voice contract.

## Summary

- **There is no single home/IA owner today.** The home is a flat vertical stack assembled in two
  files: `src/app/_components/home-shell.tsx` (page chrome: hero illustration, `appName`, `tagline`,
  guest banner, offline banner) and `src/app/_components/pomodoro-dashboard.tsx` →
  `PomodoroDashboardBody` (everything else, in fixed JSX order). Module visibility is computed inline
  via ~15 boolean flags scattered through `PomodoroDashboardBody`. **No session-state enum and no
  module-priority matrix exist.** S-40's core engineering work is to extract a pure derivation
  (mirroring the existing pure helpers `resolveWedgeBeat`, `shouldShowWorkFocusShell`,
  `shouldShowBreakAtmosphere`) and reorder/regroup the stack accordingly — **without** changing the
  cycle hook's behavior or the wedge gate mutex.
- **The "Co teraz?" header already has a catalog key** shipped by F-14: `Home.purposeHeader`
  ("A calm answer to: what to do next?" / "Spokojna odpowiedź na: co teraz?"). It is **not rendered
  anywhere yet** — `home-shell.tsx` still renders only `appName` + `tagline`. Wiring `purposeHeader`
  as the dominant idle/returning header is the cheapest half of S-40's copy work; no new keys are
  required for the header.
- **Recap is currently always-on and expanded-by-default**, rendered between the focus-budget prompt
  and the task list (`pomodoro-dashboard.tsx:663`). `DailyRecapPanel` defaults both sections to
  expanded (`daily-recap-panel.tsx:75-76`). S-40 must make it **collapsed on first paint** and
  **hidden during active work** — this is a presentation change to the panel/its host, not a data
  change. Do **not** introduce `DayMemory.*` strings here (that is S-42; recap and day-memory stay
  separate per the voice contract).
- **The five session states already exist as latent conditions** in `PomodoroDashboardBody`; S-40
  formalizes them. Mapping is documented in §"Session-state derivation" below. The "returning" state
  is the S-17 post-session design: **no top banner** (it was deliberately removed —
  `e2e/session-return-handoff.spec.ts:71` asserts `return-handoff-banner` count 0), surfaced instead
  as a `continue-here-row` on the last-focused task + session-steering cards + kickoff suggestion.
- **Highest planning risk is regression, not new behavior.** S-40 must reorder/regroup a file that
  owns active task CRUD, archive entry, the timer hub, all wedge overlays, and recap dismiss — all
  guarded by lessons L-04 and "Test every wedge transition before shipping transition logic changes",
  and by AGENTS.md wedge-domain rules. The safe shape is: **add a pure derivation module + a
  presentational layout/region wrapper; keep `usePomodoroCycle`, `resolveWedgeBeat`, and every
  overlay handler untouched.**
- **Cheapest test layer is component + the existing pure-helper unit pattern.** A new
  `home-session-state.ts` pure module gets exhaustive Vitest unit coverage; layout/copy/priority gets
  component tests on the dashboard (`pomodoro-dashboard.test.tsx` matrix) + `home-shell.test.tsx`.
  **No new belt e2e is justified** (test-plan §1 #5, §6.9): existing belt seeds already exercise the
  underlying flows; S-40 is layout/copy/priority over unchanged behavior.

## Detailed Findings

### Home / dashboard IA and component ownership

- **Route entry**: `src/app/page.tsx` — server component. Resolves auth, and when authenticated
  prefetches `task.list`, `cycle.getActive`, `recap.getDaily` (`page.tsx:21-28`) before rendering
  `HomeShell`. `dynamic = "force-dynamic"`.
- **Page chrome owner**: `src/app/_components/home-shell.tsx`.
  - `HomeShell` wraps `OnboardingProvider` → `GuestMergeUiProvider` → `HomeShellContent`
    (`home-shell.tsx:112-124`).
  - `HomeShellContent` renders, inside `<main id="home-shell-main">` (`home-shell.tsx:91-107`):
    offline banner → `<header>` with `HomeHeroSprig` + `appName` (h1) + `tagline` (p)
    (`home-shell.tsx:97-103`) → guest banner (guest only) → `<PomodoroDashboard/>`.
  - Onboarding/merge overlays (`FirstRunOverlay`, `MergeSuccessOverlayMount`) and `DataModeProvider`
    are mounted here. **This is where the `Home.purposeHeader` belongs** — the existing `<header>`
    block is the natural host for the dominant "Co teraz?" line.
- **Everything-else owner**: `src/app/_components/pomodoro-dashboard.tsx`.
  - `PomodoroDashboard` (`:911`) branches on `useDataMode()` → `GuestPomodoroDashboard` (`:894`) or
    `AuthenticatedPomodoroDashboard` (`:845`, Suspense-wrapped). Both render the shared
    `PomodoroDashboardBody` (`:69`) with different gate flags: authenticated enables
    `enableCheckInGate / enableSuggestionGate / enableWindDownGate` (`:877-879`); guest enables none.
  - `PomodoroDashboardBody` returns a single `flex-col gap-8 max-w-lg` column (`:456`) with a **fixed
    JSX order** (this is the current "IA"):
    1. wedge sync recovery / error banner (`:458-484`)
    2. session steering: `SessionEnergyCard` / `SessionFocusCard` (`:486-500`)
    3. in-flow summary line (`:502-511`)
    4. break transition line (`:513-524`)
    5. kickoff duration chips (`:526-541`)
    6. `TimerPanel` (`:543-561`) — gated by `showTimer` (`:316-320`)
    7. suggestion card (break) (`:563-605`)
    8. kickoff card (idle) (`:607-640`)
    9. override acknowledgement (`:642-651`)
    10. `FocusBudgetPrompt` (`:653-661`)
    11. **`DailyRecapPanel`** (`:663-667`) — always rendered
    12. **`TaskList` / `TaskArchiveView`** toggle (`:669-698`) via `taskInventoryView` state (`:183`)
    13. mid-cycle completion prompt (`:700-715`)
    14. overlays: cycle-complete (`:729-757`), break-alerts permission (`:759-763`), session closure
        (`:765-770`), check-in (`:772-796`), wind-down (`:798-805`), end-session confirm (`:807-815`)
    15. end-session buttons (`:817-840`)
- **Conclusion**: S-40 should introduce (a) a session-state + module-priority derivation module, and
  (b) a thin layout/region structure that groups modules into primary/secondary/hidden zones. The
  individual components (timer, suggestion, recap, task list, overlays) are reusable as-is; only their
  **placement, grouping, and visibility-by-state** change. The wedge overlays (item 14) are
  fixed/absolute-positioned and must stay owned by the conductor — do not fold them into the new zones.

### Where each module renders today (task inventory, sessions, recap, focus shell)

- **Task inventory (active + completed + archive entry)**: `src/app/_components/task-list.tsx`.
  - Active tasks: filtered `status === "active"` (`task-list.tsx:659`), drag-sortable
    (`:996-1052`); completed: `status === "completed"` (`:660`, rendered `:1056-1171`); archive entry
    button `task-archive-entry` (`:1173-1187`) calls `onOpenArchive`.
  - Create form + persona presets at top (`:858-984`); empty state `EmptyActiveTasksGuide` (`:991`).
  - **Cycle-aware locking**: `cycleLocked / focusLocked / markCompleteLocked / dragDisabled`
    (`:661-681`) derive from `cycleState` + `cycleKind` — these gates are how the inventory behaves
    during active work; S-40 must preserve them when demoting the list.
  - Focus footprint rows `task-footprint-{id}` (S-30) render only on focused/editing rows
    (`:333-334`, `:534-548`).
- **Archive view**: `src/app/_components/task-archive-view.tsx`, swapped in for the task list when
  `taskInventoryView === "archive"` (`pomodoro-dashboard.tsx:669-674`). Entry placement is explicitly
  shared with S-44 (`roadmap.md:123,159`). S-40 owns nav placement; do not regress
  `task-archive-entry` → `task-archive-back` round-trip.
- **Timer / session kickoff**: `TimerPanel` (`pomodoro-dashboard.tsx:543`) gated by `showTimer`
  (`:316`); kickoff suggestion card (`:607`) + kickoff duration chips (`:526`); session start runs
  through `handleStartWithPermission` (`:211`) → optional break-alerts permission prompt →
  `pomodoro.start`.
- **Daily recap**: `DailyRecapPanel` (`daily-recap-panel.tsx`). Dismiss is per-date in
  `sessionStorage` (`:9,17-26,111-120`); returns `null` when dismissed or loading (`:122-124`). Both
  "Last 24 hours" and "Today" sections **default to expanded** (`:75-76`). Data via
  `useDailyRecap()` (`pomodoro-dashboard.tsx:133-137`); footprints flow into `TaskList`
  (`:682`).
- **Focus shell / break atmosphere** (the existing pure derivations to mirror):
  - `shouldShowWorkFocusShell` (`src/lib/design/work-focus-shell.ts`) → true only for WORK
    running/paused with no wedge gate; synced via `useSyncWorkFocusShell`
    (`pomodoro-dashboard.tsx:408-413`); dims task-list chrome (`task-list.tsx:831-833`).
  - `shouldShowBreakAtmosphere` (`src/lib/design/break-atmosphere.ts`) → true only for break
    running/paused with no gate and no suggestion card; synced via `useSyncBreakAtmosphere`
    (`:400-406`). `HOME_SHELL_MAIN_ID = "home-shell-main"` lives here (`break-atmosphere.ts:24`).

### Session-state derivation (latent today → formalize in S-40)

The five acceptance states already exist as inline conditions; the mapping the plan should formalize:

| S-40 state | Existing signal(s) | Source |
|---|---|---|
| `idle` | `state === "idle"` && `focusedTaskId == null` && kickoff eligible | `pomodoro-dashboard.tsx:336-344`; `computeKickoffEligible` (`transition-conductor.ts:132-152`) |
| `steering` | `pomodoro.showSessionEnergy` \|\| `pomodoro.showSessionFocus` | `pomodoro-dashboard.tsx:486-500` |
| `active_work` | `workFocusShellActive` (WORK running/paused, no gate) | `work-focus-shell.ts:7-19` |
| `break` | `isBreakRunning` / `breakAtmosphereActive` | `pomodoro-dashboard.tsx:322-325, 400-406` |
| `returning` | post-session: `continueTaskId` set + steering + kickoff (no banner) | `e2e/session-return-handoff.spec.ts:71-88`; `resolveContinueTaskId` (`src/lib/session/return-handoff.ts`) |

- **Pause** is orthogonal (`cyclePaused`, `:327`) and suppresses gates (`transition-conductor.ts:63-70`);
  the derivation must treat paused-work as still `active_work` (timer hero), not a sixth state — this
  is the S-40 "pause edge case" unknown from the item card.
- **`returning` has no top banner by design** — S-17 removed it. The continue affordance is the
  `continue-here-row` (`task-list.tsx:472-480`) on the row whose id equals `pomodoro.continueTaskId`
  (`:677`, highlighted via `highlightedTaskId`/`isContinueRow` `:330-331`). S-40 must keep that row
  visible even while demoting the inventory, because it is the returning-state next-focus signal.

### F-14 product-voice / i18n contracts that constrain wording

- **Catalog**: `messages/en.json` + `messages/pl.json` (locale parity required —
  `product-voice.md:181`). Relevant namespaces already shipped:
  - `Home.purposeHeader` (`en.json:320` / `pl.json:320`) — **the** 5-second-purpose-test string;
    EN "A calm answer to: what to do next?", PL "Spokojna odpowiedź na: co teraz?". Currently unused.
  - `Home.appName` / `Home.tagline` / `Home.offlineBanner` (`en/pl.json:317-319`).
  - `DayMemory.*` (`:322-326`) — **reserved for S-42, do NOT use in S-40** (voice contract
    §"Recap vs. narrative": S-30 recap and S-42 day-memory stay separate;
    `product-voice.md:78`).
  - `Recap.*` (`:365-374`) — S-30 daily recap labels (already in use by `DailyRecapPanel`).
  - Suggestion rationale keys `Scoring.rationale.*` (contract `product-voice.md:127-131`) — already
    wired through the suggestion card; S-40 must not rewrite rationale copy.
- **Voice constraints binding S-40** (`product-voice.md`):
  - "The header supports the test — it is **not** a hero rewrite. Visual hierarchy and one dominant
    CTA remain S-40's job." (`:97`) — i.e. S-40 owns layout/CTA dominance, reuses the shipped header
    string.
  - One dominant CTA above the fold (idle/returning); calm register; no streak/urgency/AI-slop/
    punitive copy (`product-voice.md:52-61`).
  - Future-slice acceptance checklist (`product-voice.md:179-189`): locale parity, copy-zone mapping,
    5-second purpose test, one-line rationale, transition-beat budget (≤1 interstitial + 1 gate),
    length budgets, copy-contract tests. S-40 should cite this checklist in its plan.
- **If new strings are needed** (e.g. a zone label or "inventory" heading), add to both `Home`
  (or a new namespace) in `en.json` and `pl.json` with matching structure; prefer reusing existing
  keys. The interim-`home-voice.ts`-vs-F-14 unknown from the item card is **resolved**: F-14 shipped,
  so no interim module is needed — consume `Home.purposeHeader` directly.

### Data and state dependencies (guest/auth, filtering, archive, suggestions, recap)

- **Data-mode split**: `DataModeProvider` (set in `home-shell.tsx:79`) + `useDataMode()`. Guest path
  reads `localStorage` via `useGuestDomainTasks` (`use-domain-tasks.ts:82-96`,
  `useSyncExternalStore`); auth path uses tRPC suspense `task.list` + day-status query
  (`:98-143`). The dashboard branches at `PomodoroDashboard` (`pomodoro-dashboard.tsx:911-929`) so
  guest vs auth differences are already isolated — S-40's derivation must accept `mode` as input and
  must **not** assume gates (steering/kickoff/suggestion/check-in) exist in guest mode.
- **Task filtering**: active/completed split is in `TaskList` (`task-list.tsx:659-660`); archived
  tasks come from a separate `useArchiveTasks` hook inside `TaskArchiveView`
  (`task-archive-view.tsx:33`). `activeTaskIds` (`pomodoro-dashboard.tsx:119-122`) feeds the cycle
  hook and mid-cycle logic — keep this wiring intact.
- **Stale archive / S-44 overlap**: archive entry placement is explicitly shared with S-44
  (`roadmap.md:123,159`). S-40 decides nav placement only; it should not implement stale-task
  archiving. Conservative decision: keep the existing `task-archive-entry` affordance reachable from
  the demoted inventory zone.
- **Suggestions / kickoff**: `pomodoro.pendingSuggestion` (break) and
  `pomodoro.pendingKickoffSuggestion` (idle) drive `showSuggestionCard` (`:329-334`) and
  `showKickoffCard` (`:336-344`). These are the "one next-focus suggestion" the primary zone must
  feature in idle/returning/break. They are auth-only (`enableSuggestionGate`).
- **Recap data**: `useDailyRecap()` (`:133`) → `recap`, `recapLoading`, `localDateKey`; footprints
  passed to the list (`:682`). Prefetch happens in `page.tsx:26`. Dismiss is sessionStorage per-date
  (`daily-recap-panel.tsx:17-26`). S-40 changes default collapse + visibility-by-state; it must not
  alter dismiss semantics or footprint wiring.

### Risks & regressions S-40 must not introduce

- **Active task CRUD** (Risk #1/#3 surfaces; L-04): create/edit/complete/reorder/delete live in
  `task-list.tsx`; inline-edit commit-on-blur + pointerdown-outside (`:773-829`) and the
  `<input>`-vs-`<textarea>` title concern (L-04) are fragile. Demoting the list must keep
  `task-list` testid, edit commit paths, and cycle-locking (`:661-681`) intact.
- **Archive entry** (S-44 overlap): `task-archive-entry` → `TaskArchiveView` → `task-archive-back`
  round-trip via `taskInventoryView` (`pomodoro-dashboard.tsx:183,669-698`).
- **Timer hub / wedge gates** (AGENTS.md wedge-domain rules; lesson "Test every wedge transition…";
  test-plan Risks #8/#12): `usePomodoroCycle`, `resolveWedgeBeat`, and all overlay handlers
  (`:700-815`) must stay behaviorally unchanged. S-40 is layout/priority only. Per AGENTS.md, run
  `pnpm change-impact` before editing `pomodoro-dashboard.tsx` / the cycle hook, and add no ad-hoc
  overlay stacks.
- **Recap dismiss / footprint** (S-30): default-collapsed must not break the dismiss test
  (`daily-recap-panel.test.tsx`) or the belt `daily-work-timing-recap` spec
  (test-plan §6.11); footprint rows must still render on focused tasks.

## Code References

- `src/app/page.tsx:21-28` — auth-gated prefetch of `task.list` / `cycle.getActive` / `recap.getDaily`
- `src/app/_components/home-shell.tsx:97-105` — page header (`appName`+`tagline`) + dashboard mount; host for `purposeHeader`
- `src/app/_components/pomodoro-dashboard.tsx:69-105` — `PomodoroDashboardBody` props/contract
- `src/app/_components/pomodoro-dashboard.tsx:316-454` — inline visibility flags (latent session states)
- `src/app/_components/pomodoro-dashboard.tsx:663-698` — recap (always-on) + task-list/archive toggle
- `src/app/_components/pomodoro-dashboard.tsx:845-929` — guest vs auth dashboard branching + gate flags
- `src/app/_components/daily-recap-panel.tsx:75-76,122-124` — sections default expanded; dismiss/loading return null
- `src/app/_components/task-list.tsx:659-681` — active/completed split + cycle-aware locking
- `src/app/_components/task-list.tsx:472-480,1173-1187` — continue-here row + archive entry
- `src/lib/wedge/transition-conductor.ts:105-152` — `resolveWedgeBeat` + `computeKickoffEligible` (pure-derivation pattern to mirror)
- `src/lib/design/work-focus-shell.ts:7-19`, `src/lib/design/break-atmosphere.ts:8-22` — focus/break pure derivations
- `messages/en.json:316-374` / `messages/pl.json:316-374` — `Home` / `DayMemory` / `Recap` namespaces (incl. `purposeHeader`)
- `e2e/session-return-handoff.spec.ts:71-88` — returning state = no banner; continue-row + steering + kickoff
- `src/app/_components/home-shell.test.tsx` / `pomodoro-dashboard.test.tsx` — existing component-test patterns to extend

## Architecture Insights

- **Pure-derivation + sync-hook pattern is the house style.** Visibility logic is repeatedly factored
  into a pure function in `src/lib/...` (`resolveWedgeBeat`, `shouldShowWorkFocusShell`,
  `shouldShowBreakAtmosphere`), unit-tested in isolation, then consumed by the dashboard. S-40's
  session-state + module-priority derivation should follow this exact pattern (e.g.
  `src/lib/home/home-session-state.ts` returning `{ state, modules: { ...: "primary"|"secondary"|"hidden" } }`),
  keeping the dashboard a thin renderer over the derivation.
- **The dashboard is a god-component (930 lines).** S-40 should resist adding more inline conditions;
  push the priority decisions into the pure module and (optionally) introduce small presentational
  zone wrappers. This is also a maintainability lever called out by the roadmap's UX/UI chapter.
- **Wedge overlays are a separate, conductor-owned layer** (fixed/absolute, priority-mutexed). They
  must remain outside the new primary/secondary/hidden zone layout — the matrix governs the inline
  modules (header, timer, suggestion/kickoff, recap, inventory), not the gate overlays.
- **Bilingual is structural, not optional.** Every visible string flows through `next-intl`
  namespaces with EN/PL parity; S-40 reuses `Home.purposeHeader` and adds keys only in pairs.

## Historical Context (from prior changes)

- `context/foundation/roadmap-references/items/S-40.md` — outcome, acceptance (session-state matrix,
  one primary CTA, recap collapsed, timer hero, 5-second test), unknowns (interim voice module
  [resolved: F-14 shipped]; pause/closure edge cases), risk (recap/inventory becoming co-primary).
- `context/foundation/product-voice.md` (F-14) — copy zones, `Home.purposeHeader` target strings,
  "header is not a hero rewrite — hierarchy + dominant CTA are S-40's job" (`:97`), future-slice
  acceptance checklist (`:179-189`), recap-vs-day-memory separation (`:78`).
- `context/archive/2026-06-12-session-narrative-summary/` and
  `context/archive/2026-06-18-wedge-transition-conductor/` — prior decisions behind the returning
  state (no banner) and the conductor mutex S-40 must not disturb.
- `context/changes/roadmap-ux-ui-story-expand/research.md` — S-40 lineage (expand batch 7 / P-701).

## Related Research

- `context/changes/roadmap-ux-ui-story-expand/research.md` — Stream R UX/UI story chapter source.
- `context/foundation/test-plan.md` §1, §6.9, §6.10, §6.11 — belt-vs-component decision tree, wedge
  transition oracle rules, recap test cookbook.

## Test Strategy Candidates (tied to test-plan cookbook)

- **Pure derivation (cheapest, highest signal)** — new `home-session-state.ts` (and module-priority
  matrix): exhaustive Vitest unit tests covering all five states + pause edge + guest-vs-auth, in the
  style of `src/lib/wedge/transition-conductor.test.ts` and `work-focus-shell` math. Cookbook: §6.1.
- **Layout / copy / priority** — component tests:
  - `home-shell.test.tsx` extension: `purposeHeader` rendered as dominant header in idle/returning.
  - `pomodoro-dashboard.test.tsx` extension (existing overlay-visibility matrix): assert
    primary/secondary/hidden placement per state — exactly one primary CTA above the fold in
    idle/returning; recap **collapsed on first paint**; recap hidden during `active_work`; timer hero
    during `active_work`. Cookbook: §6.9 (mock hooks at nearest boundary).
  - `daily-recap-panel.test.tsx`: assert default-collapsed first paint (new oracle) without breaking
    existing dismiss/`aria-expanded` tests.
- **No new belt e2e** (test-plan §1 #5, §7 negative space): S-40 is layout/copy/priority over
  unchanged behavior; existing belt seeds (`seed`, `session-kickoff`, `task-suggestion`,
  `daily-work-timing-recap`, `session-return-handoff` full-catalog) already exercise the flows.
  Only add/adjust a belt row if a layout regression cannot be observed at the component layer
  (apply §6.10 belt-extension rule). Re-confirm during planning.
- **Mandatory wedge guard**: per lesson + AGENTS.md, if any change reaches into overlay sequencing,
  add dismiss oracles for affected gates (`transition-conductor.test.ts`,
  `use-pomodoro-cycle.test.tsx`); the safe S-40 design avoids this by not touching gate logic.

## Open Questions

1. **Module-priority matrix shape** — does S-40 ship a literal `primary/secondary/hidden` map per
   state (declarative), or per-module booleans? Recommended (conservative): a single pure function
   returning a typed matrix keyed by module, mirroring `resolveWedgeBeat`'s output shape. Decide in
   `/10x-plan`.
2. **Layout wrapper vs. in-place reorder** — introduce small zone wrapper components, or just reorder
   JSX + conditionally render in `PomodoroDashboardBody`? Both are viable; wrapper improves
   testability of "above the fold / one primary CTA". Owner: implementer; not blocking.
3. **Pause-as-active_work confirmation** — confirm derivation keeps paused WORK in `active_work`
   (timer hero) rather than a distinct state; cross-check against `cyclePaused` gate suppression
   (`transition-conductor.ts:63-70`). Verify with a hook/component test in plan.
4. **Desktop layout** — S-41 (`desktop-calm-workbench`, hard dep on S-40) owns the lg≥1024 three-zone
   workbench. S-40 should keep the derivation layout-agnostic so S-41 can reuse the same matrix.
   Confirm S-40 stays mobile/single-column.
5. **`return-handoff-banner` testid** — present only in e2e/test-plan/archive, not in `src`
   (asserted absent by design). Confirm no live banner component needs removal; the returning state
   relies on the continue-row, not a banner.
