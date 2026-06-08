# Persistent Quiet Cycle Audio (S-20) — Plan Brief

> Full plan: `context/changes/persistent-quiet-cycle-audio/plan.md`
> Research: `context/changes/persistent-quiet-cycle-audio/research.md`

## What & Why

Users need to mute or soften the cycle-end chime without losing mindful transition cues. FlowState will persist a tri-state audio preference (server for logged-in users, localStorage for guests), keep visual gates authoritative (FR-014), and add a calm title pulse when work ends in a backgrounded tab with audio muted or softened — pairing with shipped S-22 catch-up.

## Starting Point

`createAudioManager().playAlarm()` always plays at full volume from two call sites in `use-pomodoro-cycle`. No `UserPreference` model or preference tRPC router exists. Guest UX already uses `flowstate:*` localStorage scoping. S-22 catch-up (`tab-return-catchup`) is live for hidden expiry.

## Desired End State

A user sets Normal / Soft / Muted before starting a cycle; the choice survives refresh and (when logged in) syncs across devices. At work-end, `normal`/`soft` play audio per mode; `muted` skips sound. Hidden-tab work-end still shows S-22 catch-up; muted/soft users also get a subtle title pulse until they return. Break-end pulse and volume sliders remain out of scope.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|----------|--------|------------------|--------|
| Audio control shape | Tri-state `normal` \| `soft` \| `muted` | Maps roadmap "mute or soften" without slider UX/a11y cost | Research |
| Auth persistence | Prisma `UserPreference` + tRPC `preference.get` / `set` | First true server profile preference; roadmap requires cross-session sync | Research |
| Guest persistence | `flowstate:cycleEndAudio:guest` | Matches existing guest localStorage patterns | Research |
| Auth cache | `flowstate:cycleEndAudio:{userId}` optimistic cache | Prevents flash-of-loud-alarm before tRPC hydrates | Research |
| Soft level | 0.25 gain/volume constant | Single tunable constant; no schema change | Research |
| Title pulse scope | Work-end only when `muted` or `soft` + tab hidden | Roadmap minimum; catch-up stays primary visual | Research |
| Reduced motion | Title prefix only; skip favicon animation | Calm adjunct without motion fatigue | Research |
| S-22 coordination | No alarm replay on focus; catch-up always for hidden expiry | S-22 shipped policy; pulse is adjunct while tab hidden | Research |
| Guest → auth merge | Client migrates guest localStorage on first auth `preference.set` | Low-risk continuity without extending `guest.import` | Research / Plan |

## Scope

**In scope:** Prisma enum + migration; preference router; client storage + hook; `playAlarm({ mode })`; hook wiring; `TimerPanel` tri-state UI; title pulse module; auth + guest e2e; test-plan §6.3 cookbook note.

**Out of scope:** Volume slider; break-end pulse; alarm replay on tab return; native push; `guest.import` preference migration; favicon animation under `prefers-reduced-motion: reduce`.

## Architecture / Approach

```
TimerPanel (tri-state UI)
    → useCycleEndAudioPreference (localStorage + tRPC)
        → cycleEndAudioModeRef
            → use-pomodoro-cycle.handleCycleExpired / resumeFromActiveCycle
                → playAlarm({ mode })  [audio.ts]
                → setCatchUp (S-22, unchanged)
                → startCycleEndTabPulse (work + hidden + not normal)
```

Server: `UserPreference.userId` PK stores `cycleEndAudioMode`. Client reads localStorage first, reconciles with server on auth mount.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|------------------|----------|
| 1. Schema and Migration | `CycleEndAudioMode` + `UserPreference` table | Migration on shared Neon branch |
| 2. tRPC Preference Router | `preference.get` / `set` + isolation tests | Cross-user leakage if ownership omitted |
| 3. Client Preference Storage | localStorage helpers + `useCycleEndAudioPreference` | Hydration race plays loud alarm before load |
| 4. Audio Manager Extension | `playAlarm({ mode })` + unit tests | Web Audio gain path diverges from HTML fallback |
| 5. Hook Integration | Mode at both alarm call sites | Miss second call site in expired recovery |
| 6. UI Control | Segmented control in `TimerPanel` | Control visible during running states |
| 7. Title Pulse | `cycle-end-tab-pulse.ts` + lifecycle | Aggressive flashing feels alarming |
| 8. E2E + Cookbook | `quiet-cycle-audio` specs + test-plan §6.3 | Headless cannot assert audio — visual/tab only |

**Prerequisites:** S-01 (audio + cycle hook), S-22 shipped (catch-up e2e baseline), feature branch `features/persistent-quiet-cycle-audio`.

**Estimated effort:** ~2–3 implementation sessions across 8 phases.

## Open Risks & Assumptions

- Autoplay may block even `soft` when tab hidden — accepted; catch-up + title pulse cover FR-013 visually.
- Exact UI labels (Normal/Soft/Muted) may refine when S-12 polish lands — testids stable regardless.
- Neon Auth `userId` stability assumed for cross-device sync (research open question #4).
- Favicon pulse asset may ship as minimal static alternate under `public/` — optional behind reduced-motion guard.

## Success Criteria (Summary)

- User can mute or soften cycle-end audio with preference that persists (guest localStorage, auth server).
- Visual transition and S-22 catch-up remain authoritative; muted hidden work-end still surfaces catch-up on return.
- E2e proves muted + hidden work expiry → catch-up visible + title pulse while hidden.
- `pnpm check`, `pnpm test`, and targeted e2e pass; test-plan cookbook documents the pattern.
