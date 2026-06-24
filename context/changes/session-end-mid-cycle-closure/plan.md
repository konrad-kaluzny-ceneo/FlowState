# S-38 Session end mid-cycle closure clarity — plan

Copy-only slice (OQ #7): confirm overlay + closure line set expectations when user ends during a running or paused **WORK** block — completed cycles/tasks count; in-progress focus block does not.

**PR:** [#162](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/162)  
**Review source:** Cursor review (github-actions) on PR head, triaged 2026-06-24.

---

## Phase 1: Mid-cycle copy (shipped)

- `end-session-copy.ts` — confirm body references in-progress / paused focus block
- `narrative-builder.ts` — `interruptedMidCycle` flag, `appendMidCycleNote`, zero-completion stats wording
- `use-pomodoro-cycle.ts` — `endSession` sets `interruptedMidCycle` for WORK running/paused
- Unit tests: `end-session-copy.test.ts`, `narrative-builder.test.ts`
- E2E: `session-closure.spec.ts` — end-session confirm + closure `"wasn't counted"`

### Automated

- [x] 1.1 `pnpm check` + `pnpm test`
- [x] 1.2 E2E session-closure mid-cycle path (running WORK → end)

---

## Phase 2: Code review follow-ups (PR #162)

Triage: subagent code-reviewer + orchestrator decision proxy (2026-06-24).

### Must fix (pre-merge)

- [x] 2.1 **Break-cycle confirm copy** — `handleEndSessionClick` opens confirm for any `running`/`paused`, including breaks; body still says “focus block” while `interruptedMidCycle` applies only to `WORK`. Gate S-38 wording on `cycleKind === "WORK"` or add break-neutral / break-specific variant in `getEndSessionConfirmCopy`.
- [x] 2.2 **Dashboard smoke test** — `pomodoro-dashboard.test.tsx`: end-session confirm on `SHORT_BREAK` (or `LONG_BREAK`) does not show focus-block copy.

### Automated (pre-merge)

- [x] 2.3 `pnpm check` + `pnpm test` after 2.1–2.2

### Fast-follow (non-blocking)

- [x] 2.4 **Hook wiring test** — `use-pomodoro-cycle.test.tsx`: `endSession` during running WORK → `sessions.end` receives `closureLine` containing `"wasn't counted"`; break / idle / wind-down omit flag.
- [x] 2.5 **E2E pause-and-end parity** — `session-closure.spec.ts` pause-and-end case: assert `session-closure-line` contains `"wasn't counted"` (and optionally confirm body `"paused focus block"`).
- [x] 2.6 **Test title hygiene** — `narrative-builder.test.ts`: rename timeout case or add explicit `endedBy: "pause_cap"` test (cosmetic).
- [x] 2.7 **Housekeeping** — remove accidental `commit-msg.txt` from branch diff.

### Explicitly out of scope (logged, no action)

- 120-char `appendMidCycleNote` truncation — theoretical edge case; typical lines fit under `max(120)`.
- Pause-cap mid-cycle parity — auto-end uses separate narrative (`endedBy: "pause_cap"`); S-38 is user-initiated end only.
- `cycleKind` vs `activeCycle.kind` — no demonstrated divergence in `endSession`.
- Server `session-end-metadata` fallback — client always supplies `closureLine` today.

---

## Progress

### Phase 1

#### Automated

- [x] 1.1 `pnpm check` + `pnpm test`
- [x] 1.2 E2E session-closure mid-cycle path (running WORK → end)

### Phase 2

#### Must fix (pre-merge)

- [x] 2.1 Break-cycle confirm copy gate / variant
- [x] 2.2 Dashboard smoke test (break confirm copy)

#### Automated (pre-merge)

- [x] 2.3 `pnpm check` + `pnpm test` after 2.1–2.2

#### Fast-follow (non-blocking)

- [x] 2.4 Hook wiring test (`interruptedMidCycle` matrix)
- [x] 2.5 E2E pause-and-end closure assertion
- [x] 2.6 Narrative-builder test title / `pause_cap` case
- [x] 2.7 Remove `commit-msg.txt` from branch
