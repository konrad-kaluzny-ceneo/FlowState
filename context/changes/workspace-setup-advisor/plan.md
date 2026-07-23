# Workspace Setup Advisor Implementation Plan

## Overview

Ship a bilingual, coaching-only workspace tip library as a checklist in a new Settings **Workspace** tab, with optional outbound doc links, local-only done-state (guest + auth), and a one-time first-visit Settings nudge. No OS/API integrations; Integracje / MCP coming-soon stays untouched.

## Current State Analysis

- Settings live at `/settings` via `UstawieniaView` with tabs `general` | `focus` | `breaks` | `appearance` | `energy` (auth-only) | `integrations` (`ComingSoonPreview` for MCP / S-46).
- Closest tip UI is `FocusTip` (day-rotated copy on Fokus) — not a browsable checklist.
- Local preference pattern to mirror: break-alerts (`OnboardingScope` + scoped `localStorage` + thin hook).
- `api.preference` today only covers `cycleEndAudioMode` and `language` — no tip checklist field (server sync deferred).
- No dedicated Settings e2e specs today; Vitest coverage in `ustawienia-view.test.tsx`.
- Product voice has no Settings copy zone yet — tip + nudge copy must still pass F-14 locale parity and calm tone.

## Desired End State

A guest or signed-in user opening **Ustawienia** sees a calm one-time nudge pointing at **Workspace / Środowisko**. On that tab they browse categorized setup tips (agents, chat DND, notifications, email/phone/OS Focus), mark tips done, and optionally open official guide links in a new tab. Done marks persist across reload in the same browser scope (guest vs userId). Integracje still shows only MCP “coming soon.”

### Key Discoveries:

- Additive tab via `SettingsTab` + `TAB_DEFS` + render branch — do not merge tips into integrations `ComingSoonPreview` (`ustawienia-view.tsx` integrations branch).
- Store **stable tip ids**, never i18n key paths — filter unknown ids on read (persona-presets pattern).
- Reuse `OnboardingScope` from `~/lib/onboarding/types`; keep checklist state in a dedicated `workspace-setup-advisor` module, not `OnboardingState` booleans.
- Nudge dismiss = forever flag in the same local module (not day-scoped `sessionStorage`).

## What We're NOT Doing

- OS-level DND, site blockers, or any physical restriction of notifications
- Slack / Teams / Cursor / Claude API integrations or OAuth
- Server sync of done tips via `api.preference` / Prisma (document as follow-up)
- Stuffing tips into Integracje or blurring them behind `ComingSoonPreview`
- Timer-hub / transition-gate overlays for the advisor (no F-07 conductor involvement)
- Extending first-run overlay with a workspace step
- Net-new product settings controls (theme, durations, etc.) beyond advisory content

## Implementation Approach

Content-first slice: TypeScript tip catalog (structure + stable ids) + i18n copy/links → local checklist storage + hook → Settings Workspace tab UI with checkboxes → first-visit Settings banner → Vitest + one light guest e2e.

## Critical Implementation Details

**Guest vs auth isolation:** checklist and nudge keys must follow `flowstate:workspaceSetupAdvisor:guest` vs `:${userId}`; empty auth `userId` → defaults / no-op writes (same pitfall as onboarding keys).

**SSR / private mode:** reads default when `window` is undefined; swallow localStorage quota errors so Settings never crashes.

**Transition beat budget:** nudge is Settings-page only — never mount on Fokus timer overlays.

## Phase 1: Tip Catalog + Local Checklist Storage

### Overview

Define the broad tip library (stable ids + categories), EN/PL copy with optional guide URLs, and scoped localStorage + hook for `doneTipIds` and nudge dismiss.

### Changes Required:

#### 1. Tip catalog module

**File**: `src/lib/workspace-setup-advisor/tips.ts` (+ `types.ts`, `keys.ts` as needed)

**Intent**: Export a readonly catalog of workspace tips with stable ids and categories covering the broad v1 set (Cursor agents, Claude agents, Slack DND, Teams Focus, browser notifications, email batching, phone DND, OS Focus). Structure only — no user-facing strings in this module.

**Contract**: `WorkspaceTipId` union from const array; each tip `{ id, category }` where category is one of `editor` | `chat` | `notifications` | `device`. Helper `isWorkspaceTipId(value: string): value is WorkspaceTipId`. Target ~1–2 tips per theme (roughly 8–16 tips total) — prefer fewer well-written tips over filler.

#### 2. Checklist + nudge storage

**File**: `src/lib/workspace-setup-advisor/storage.ts` (+ co-located `storage.test.ts`)

**Intent**: Persist `{ v, doneTipIds, nudgeDismissed }` per `OnboardingScope`, mirroring break-alerts scoping and silent failure handling. Filter unknown tip ids on read so removed tips do not poison state; new tips start unchecked.

**Contract**: `readWorkspaceSetupState(scope)`, `writeDoneTipIds(scope, ids)`, `toggleDoneTip(scope, id)`, `writeNudgeDismissed(scope, boolean)` (or equivalent patch API). Keys: `flowstate:workspaceSetupAdvisor:guest` | `flowstate:workspaceSetupAdvisor:${userId}`.

#### 3. Preference hook

**File**: `src/hooks/use-workspace-setup-checklist.ts` (+ test if non-trivial)

**Intent**: React state over storage — expose done set, toggle, nudgeDismissed, dismissNudge; re-read when `scope` changes; use `scopeRef` for writes (break-alerts hook pattern).

**Contract**: Same call shape as `useOutOfTabBreakAlertsPreference(scope)` — sync local state after each write.

#### 4. i18n copy + guide links

**File**: `messages/en.json`, `messages/pl.json`

**Intent**: Add `WorkspaceSetup` namespace (or nested under `Settings` if preferred — prefer dedicated `WorkspaceSetup` for tip bodies) with tab chrome keys under `Settings` (`sectionWorkspace`, `tabWorkspaceDesc`, nudge strings) and per-tip `title`, `body`, optional `guideUrl` / `guideLabel`. Cite `product-voice.md` — mindful / clear / trustworthy; no hustle. Add a **Settings** row to `product-voice.md` §Copy zones mapping Settings chrome + WorkspaceSetup tips.

**Contract**: Locale parity — every EN key has a PL sibling with matching structure. Guide URLs may differ by locale when official docs exist; otherwise share one stable URL. Empty/`omit` guide fields when no trustworthy link exists for that tip.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/lib/workspace-setup-advisor/storage.test.ts` passes (guest/auth isolation, unknown-id filter, SSR default, toggle)
- `pnpm typecheck` passes for new modules
- `pnpm check` clean on touched files

#### Manual Verification:

- Spot-read EN + PL tip bodies for calm voice (no streak/urgency language)
- Confirm each `guideUrl` opens a sensible official doc (or is omitted)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Settings Workspace Tab UI

### Overview

Add a guest-visible `workspace` Settings tab and render an accessible tip checklist; leave Integracje / MCP unchanged.

### Changes Required:

#### 1. Tab registration

**File**: `src/app/_components/ustawienia-view.tsx`

**Intent**: Extend `SettingsTab` and `TAB_DEFS` with `workspace` (icon e.g. `ListChecks` / `MonitorSmartphone` — not `Plug`). Place the tab **before** `integrations`. Wire `useWorkspaceSetupChecklist(scope)` and render the checklist panel when `resolvedTab === "workspace"`.

**Contract**: Test ids `settings-tab-workspace`, `settings-workspace-section`. Do not edit the integrations `ComingSoonPreview` branch. Existing MCP test must remain green.

#### 2. Checklist component

**File**: `src/app/_components/workspace-setup-checklist.tsx` (+ `workspace-setup-checklist.test.tsx`)

**Intent**: Present tips grouped by category inside `SettingsPanel` / list structure. Each tip: checkbox (mark done), title, body, optional “Open guide” link (`target="_blank"` `rel="noopener noreferrer"`). Calm, non-punitive — no progress gamification copy.

**Contract**: Native checkbox (or equivalent accessible control) with name derived from tip title; list semantics (`ul`/`li` or fieldset). `data-testid` per tip e.g. `workspace-tip-${id}` and done state assertable.

#### 3. Settings tests

**File**: `src/app/_components/ustawienia-view.test.tsx`

**Intent**: Assert Workspace tab visible for guest + auth; switching shows checklist; Integrations MCP coming-soon still present and unchanged.

**Contract**: Mirror existing `IntlTestWrapper` + mocked preference hooks pattern; mock `useWorkspaceSetupChecklist`.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/app/_components/ustawienia-view.test.tsx src/app/_components/workspace-setup-checklist.test.tsx` passes
- `pnpm check` / `pnpm typecheck` pass

#### Manual Verification:

- Guest and auth: open Settings → Workspace → mark a tip done → UI updates immediately
- Integracje still shows blurred MCP preview only
- Keyboard: tab to checkboxes, toggle with Space; guide link opens new tab

---

## Phase 3: First-Visit Settings Nudge

### Overview

Show a dismissible calm banner once on the Settings page pointing users to the Workspace tab; persist dismiss in the workspace-setup-advisor local state.

### Changes Required:

#### 1. Nudge UI in Settings

**File**: `src/app/_components/ustawienia-view.tsx` and/or `src/app/_components/workspace-setup-nudge.tsx`

**Intent**: When `!nudgeDismissed`, show a soft banner above the settings nav/panel with one calm line + dismiss control. Optional primary action focuses/switches to the `workspace` tab. Do not show if stacking would confuse with unrelated overlays (Settings page only — safe).

**Contract**: Dismiss calls storage write; never reappears for that scope after dismiss. `data-testid="settings-workspace-nudge"`. Aria-label on dismiss. Copy under `Settings` or `WorkspaceSetup` (EN/PL).

#### 2. Nudge tests

**File**: co-located component/view tests

**Intent**: Assert nudge visible by default, hidden after dismiss, and remains hidden after re-render with mocked dismissed state.

**Contract**: Guest vs auth scopes do not share dismiss (covered primarily in storage tests; view test can use mock).

### Success Criteria:

#### Automated Verification:

- Vitest: nudge show / dismiss / stay dismissed
- `pnpm check` / `pnpm typecheck` pass

#### Manual Verification:

- Fresh guest profile: open `/settings` → see nudge → dismiss → reload → gone
- Nudge does not appear on Fokus / other routes

---

## Phase 4: Light E2E + Hardening

### Overview

Add one fast guest Playwright smoke for Settings checklist persistence; keep under ~15s (L-06). Final quality gate.

### Changes Required:

#### 1. Guest e2e smoke

**File**: `e2e/workspace-setup-advisor.spec.ts` (or similar)

**Intent**: Guest opens `/settings`, opens Workspace tab, marks one tip done, reloads, asserts tip still done. Optionally assert nudge dismiss persistence in the same or a sibling test — keep total runtime low; tag `@skip-belt` if too slow or flaky for the CI belt.

**Contract**: Use `getByRole` / `getByLabel` / `getByText` first; no `waitForTimeout`. Independent setup (unique guest storage context via fresh browser context). Do not install fake clock.

#### 2. Final gate

**File**: n/a (commands)

**Intent**: Run targeted vitest + the new e2e spec; confirm Integracje MCP tests still green.

**Contract**: `pnpm check`, `pnpm typecheck`, targeted vitest, `pnpm exec playwright test e2e/workspace-setup-advisor.spec.ts` (with project E2E env as needed).

### Success Criteria:

#### Automated Verification:

- New e2e spec passes standalone
- `pnpm check` + `pnpm typecheck` + related vitest green

#### Manual Verification:

- Walkthrough: nudge → Workspace checklist → guide link → Integracje still MCP-only
- PL locale: tab label + one tip body readable and calm

---

## Testing Strategy

### Unit Tests:

- Storage: isolation guest/auth, unknown id filter, toggle, nudge flag, SSR default
- Tip id guard: `isWorkspaceTipId`
- Checklist component: render categories, toggle calls hook, guide link attrs

### Integration Tests:

- `ustawienia-view`: tab presence, panel switch, MCP regression, nudge wiring (mocked hook)

### Manual Testing Steps:

1. Guest: Settings → nudge → Workspace → check tip → reload → still checked
2. Sign in (separate scope): checklist starts empty; nudge may show again for auth scope
3. Open a guide link; confirm new tab + official docs
4. Integracje unchanged
5. Switch EN ↔ PL; labels and tip bodies present

## Performance Considerations

Static tip catalog and localStorage only — negligible cost. Avoid re-creating large arrays on each render (stable catalog import). No network calls in v1.

## Migration Notes

No Prisma migration. Existing users get empty `doneTipIds` and `nudgeDismissed: false`. Removing a tip id in a later release is safe (filtered on read). Server sync of done tips is an explicit follow-up (extend `UserPreference` / `preferenceRouter`) — out of this plan.

## References

- Roadmap: `context/foundation/roadmap.md` (S-49, Stream W)
- Issue: https://github.com/konrad-kaluzny-ceneo/FlowState/issues/194
- Voice: `context/foundation/product-voice.md`
- Patterns: `src/lib/break-out-of-tab-alert/storage.ts`, `src/hooks/use-out-of-tab-break-alerts-preference.ts`, `src/app/_components/ustawienia-view.tsx`
- Lessons: L-06 (e2e length), F-14 locale parity

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Tip Catalog + Local Checklist Storage

#### Automated

- [x] 1.1 Vitest storage tests pass (`workspace-setup-advisor/storage.test.ts`) — a39612b
- [x] 1.2 Typecheck passes for new modules — a39612b
- [x] 1.3 Biome check clean on touched files — a39612b

#### Manual

- [ ] 1.4 Spot-read EN/PL tip bodies for calm voice
- [ ] 1.5 Confirm guide URLs are sensible or omitted

### Phase 2: Settings Workspace Tab UI

#### Automated

- [x] 2.1 Vitest ustawienia-view + workspace-setup-checklist tests pass — 05d4615
- [x] 2.2 Biome check and typecheck pass — 05d4615

#### Manual

- [ ] 2.3 Guest and auth: mark tip done updates UI
- [ ] 2.4 Integracje MCP preview unchanged
- [ ] 2.5 Keyboard: checkbox + guide link accessible

### Phase 3: First-Visit Settings Nudge

#### Automated

- [x] 3.1 Vitest nudge show / dismiss / stay dismissed — 05d4615
- [x] 3.2 Biome check and typecheck pass — 05d4615

#### Manual

- [ ] 3.3 Fresh guest: nudge once, gone after dismiss + reload
- [ ] 3.4 Nudge absent on Fokus and other routes

### Phase 4: Light E2E + Hardening

#### Automated

- [x] 4.1 Playwright workspace-setup-advisor spec passes standalone
- [x] 4.2 pnpm check + typecheck + related vitest green — ffccde7

#### Manual

- [ ] 4.3 Full Settings walkthrough (nudge, checklist, guide, Integracje)
- [ ] 4.4 PL locale smoke for tab + tip body
