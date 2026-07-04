# Task UI Quick Fixes — Plan Brief

> Full plan: `context/changes/task-ui-quick-fixes/plan.md`
> Research: `context/changes/mvp-defect-intake/research.md`

## What & Why

Post-MVP fix wave 1 ships four confirmed UI defects from the defect register: duplicate HTML ids breaking daily-standing edit isolation (D-05), create-form daily checkbox defaulting unchecked instead of checked (D-03), hardcoded English in break-alerts settings (D-11), and an obsolete preset educational banner (D-02). All are small, layout-independent, and binding per product decisions on 2026-07-03.

## Starting Point

`StyledCheckbox` falls back `id` to `data-testid` (`styled-checkbox.tsx:22`), causing composer + edit panels to share `daily-standing-toggle` id. Create form initializes daily standing `false` (`task-list.tsx:608,619`) despite decided default `true`. `OutOfTabBreakAlertsControl` hardcodes four EN strings while `BreakAlerts` i18n namespace exists for the permission overlay only. Preset coach banner still renders via `PersonaPresetPicker` + `usePresetCoachOnboarding`, with e2e dismiss helper in belt path.

## Desired End State

Inline edit daily toggle affects only the edited task. New tasks default to daily standing checked. Break-alerts settings fully localized in PL. Preset picker shows chips only — no coach banner, no e2e dismiss step. Full unit suite and e2e belt green.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| D-05 fix strategy | `useId()` in StyledCheckbox + explicit ids from TaskList | Class fix prevents recurrence; explicit ids aid a11y and test scoping | Research |
| Daily-standing e2e scope | Scope to `task-fields-panel-create` | Avoids Playwright strict mode when edit panel open | Plan |
| D-03 scope | UI default only (`useState` + reset) | Matches defect register; no Prisma migration | Register |
| D-11 scope | All four EN strings in component | Partial i18n leaves PL UI mixed in break settings | Register |
| D-02 cleanup depth | Full UI path removal; dead storage field OK | Remove hook, copy, i18n key, e2e helper; keep `presetCoachDismissed` in schema | Plan |
| Phase order | D-05 → D-03 → D-11 → D-02 | Functional bug first; banner removal last so e2e cleanup is final | Research |
| Out of scope | D-08/D-09, DB default, storage schema migration | Separate change; not required for wave 1 | Register |

## Scope

**In scope:** `StyledCheckbox`, `TaskFieldsPanel`, `TaskList`, `OutOfTabBreakAlertsControl`, `PersonaPresetPicker`, onboarding copy/hook UI paths, `messages/en.json` + `pl.json`, co-located unit tests, e2e helper updates, belt verification.

**Out of scope:** layout/navbar (wave 2 done), task-edit interaction fixes (wave 3), status vocabulary (wave 4), illustration visibility (wave 5), Prisma schema, break-alerts permission overlay (already i18n'd).

## Architecture / Approach

Four sequential phases, each independently green. D-05 fixes the shared checkbox primitive then wires `dailyStandingFieldId` through `TaskFieldsPanel` mirroring `resumeNoteFieldId`. D-03 is a two-line state change. D-11 adds keys to existing `BreakAlerts` namespace. D-02 removes banner props and dead onboarding coach wiring; belt runs at end.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. StyledCheckbox fix (D-05) | Unique ids; edit/composer isolation | Missing e2e scope update → belt strict-mode failure |
| 2. Daily default (D-03) | Create form defaults checked | Test assertion not updated |
| 3. BreakAlerts i18n (D-11) | PL strings in settings control | Tests without IntlTestWrapper |
| 4. Banner removal + belt (D-02) | No preset coach; full belt green | Orphaned imports after cleanup |

**Prerequisites:** None — wave 2 layout already landed; no dependency on wave 3/4/5.
**Estimated effort:** ~1-2 sessions (four small phases; phase 1 is largest due to tests).

## Open Risks & Assumptions

- Assumes `task-fields-panel-create` testid exists on create-mode panel wrapper — verify in `task-fields-panel.tsx` before e2e change.
- Removing context-level preset coach fields requires grep — if other consumers exist, keep context API but stop rendering.
- Belt already unchecks daily default — no belt spec changes expected beyond selector scope.

## Success Criteria (Summary)

- Daily-standing label in inline edit toggles only the edited task's checkbox.
- Create form daily checkbox checked by default; break-alerts settings show PL copy in PL locale.
- No preset coach banner; `pnpm test` and e2e belt pass.
