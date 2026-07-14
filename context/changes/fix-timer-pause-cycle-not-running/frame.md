# Frame Brief: Pause "fails" — product regression, or e2e fake-clock artifact?

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

> **✅ RESOLVED 2026-07-14 — the reframe was correct.** A runtime probe confirmed
> **D5 (e2e fake-clock artifact)** and disproved the initial framing (D2, "#200/#201
> regression"). On a **real clock** pause works on both 600s and 30s cycles (`cycle.pause`
> → 200). Under the **fake clock**, *no `cycle.pause` request is ever sent* — so neither
> server guard fires and the server is entirely uninvolved. The "Cycle is not running"
> diagnosis had been *inferred* from a generic client toast, never observed.
> Fix is a test change, not a product change. Full evidence: `bug.md` → Correction.
>
> Value of this frame: it withheld the product-bug conclusion at **LOW confidence** and
> demanded runtime evidence — which is exactly what prevented a "perfect fix" being
> planned for a bug that did not exist.

## Reported Observation

In the Playwright spec `e2e/session-closure.spec.ts` ("pause via timer then end
session"), clicking the ⏸ `timer-pause` control ~14s into a **30-second** work cycle
fails: the server `cycle.pause` mutation throws, the client rolls back and shows the
generic toast "Nie udało się wstrzymać cyklu", and `timer-panel-paused` never renders.
Deterministic across two runs. **Never reproduced manually in the real app.**

## Initial Framing (preserved)

- **User's stated cause or approach**: A regression from #200 (`complete-task-mid-cycle-surface`)
  / #201 (`adhoc-rest-time`) left the cycle **not in RUNNING state** server-side at pause
  time, so `cycle.pause`'s `state:"RUNNING"` guard finds `count===0` and throws.
- **User's proposed direction**: Fix cycle-state management so pause works again.
- **Pre-dispatch narrowing**: User selected **"Not sure / haven't checked"** — the failure
  has only ever been observed in the e2e harness, not by hand in a normal-length cycle.

## Dimension Map

1. **Start/create flow** — the cycle is never persisted as RUNNING → pause guard `count===0`.
2. **#200/#201 auto-transition** — a new mid-cycle / ad-hoc-break / overtime transition moves ← initial framing
   a RUNNING work cycle out of RUNNING before the user pauses.
3. **remainingDurationSec > configuredDurationSec** — the *other* `cycle.pause` throw; the
   optimistic remaining trips a boundary guard (clock-skew–leaning).
4. **Client cycle-id resolution** — pause sends a stale/negative/wrong id → `updateMany` no-op.
5. **E2E timer-mode / fake-clock harness artifact** — the failure lives in the Playwright
   `page.clock` ⇄ main-thread-timer ⇄ server-clock interaction, not in the product pause path.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| D1: start doesn't persist RUNNING | `prisma/schema.prisma:132` `state @default(RUNNING)`; `cycle.create` (`cycle.ts:168-179`) never sets state; #200/#201 diffs didn't touch `create`. Optimistic + reconciled client cycle is RUNNING (`use-pomodoro-cycle.ts:1862,1936-1943`). | **NONE** |
| D2: #200/#201 auto-transition (initial framing) | New transitions fire only at cycle **end** (`handleCycleExpired` `:662-682`, guarded `state!=="running"`) or on **breaks** (overtime `:641-660`, break-kind–gated). None fire ~14s into a running WORK cycle. `cycle_one_active_per_user` (#201) guarantees a single active row. | **NONE** |
| D3: boundary guard `remaining>configured` | Two throws exist: `cycle.ts:368-373` (boundary) and `:390-395` (`count===0`). With `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1` (injected by `playwright.config.ts:96`), `endTimeRef` derives from the frozen `page.clock`, so `remaining ≤ configured` always → boundary unreachable. At 14s, `remaining≈16 > 30` is false regardless. Both throws surface the *same* toast, so the prior repro never proved which fired. | **WEAK** |
| D4: client sends wrong/stale id | `resolvePersistedCycleId` (`:1987-2021`) returns only the current `activeCycleRef` positive id or null; nothing repoints it to a stale/other cycle; a wrong id would yield `NOT_FOUND`, not the observed set. | **NONE** |
| D5: e2e timer-mode / fake-clock artifact | `session-closure.spec.ts` is the **only** e2e that asserts `timer-panel-paused` — there is no proven pause-under-fake-clock pattern in the repo. Timer normally runs in a Web Worker (`workers/timer-worker.ts`) that `page.clock` may not control; E2E flips to a main-thread timer via `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1` (`use-pomodoro-cycle.ts:164-165`, comment: "server `startedAt` must not drive break expiry"). `lessons.md` **L-06** explicitly flags "fake-clock/parallel-worker interactions" as a known e2e failure class. The standalone end-session test (no pause, no paused-state dependency) passes. | **STRONG (leading)** |

## Narrowing Signals

- **User has no manual repro** — 100% of the evidence is one e2e test; the "real-app product bug" premise is unverified.
- **Only test that pauses under the fake clock** — no established working pattern exists; the rewrite exercised an unproven interaction (recovered cross-check finding).
- **Countdown showed 00:16 at pause** — rules out the boundary guard *at the observed moment* (16 < 30), pointing the observed throw at `count===0` — i.e. the cycle was **not RUNNING server-side**, which D1/D2 say it should be. That contradiction is unresolved by code alone.
- **Identical toast for both server throws** — the prior repro could not identify the actual `TRPCError`; we are inferring, not observing.

## Cross-System Convention

Timer/clock behavior in this app deliberately diverges between e2e and production (worker vs
main-thread timer, fake vs real clock), and `lessons.md` L-06 already treats fake-clock/worker
timing as a recurring e2e-flakiness source — recommending such logic be proven at the
hook/integration layer rather than trusted to browser clocks. That the *only* failing surface is
the *only* pause-under-fake-clock e2e, while all product-code hypotheses come back NONE, matches
the "harness artifact" convention far better than a silent product regression that no manual use
has surfaced.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: we do **not** yet have evidence that the ⏸ pause is
> broken in the real app — the sole failure is an e2e test that is the only test pausing under
> Playwright's fake clock, and every code-level product-bug hypothesis (D1–D4) is NONE/WEAK. The
> right first move is to **establish, via runtime evidence, whether this is a genuine product bug
> or an e2e timer-mode/fake-clock harness artifact** — not to plan a cycle-state fix on inference.

The initial framing (#200/#201 left the cycle not-RUNNING) is **not supported**: those commits
demonstrably don't transition a running work cycle at 14s, and the cycle is created RUNNING.
The surviving explanation sits at the e2e harness boundary. Planning a product "pause fix" now
risks a perfect fix for a bug that may not exist outside the test.

## Confidence

**LOW at time of framing → resolved to HIGH by the probe (2026-07-14).**

At framing time: evidence was strong that D1/D2/D4 were not the cause and pointed toward D5, but
"e2e artifact" could not be distinguished from a real `count===0` product bug without runtime data.
The verification below was run and **confirmed D5**: pause works on a real clock (30s *and* 600s
cycles, HTTP 200); under the fake clock no `cycle.pause` request is emitted at all. See `bug.md`.

**Verification that was required (and has now been performed):**
1. **Instrumented e2e run** — temporarily surface the exact `TRPCError` message from `cycle.pause`
   and log server `cycle.state` + client `remainingDurationSec`/`configuredDurationSec` at the
   pause click. This names the actual throw (`count===0` vs boundary) and the true cycle state.
2. **Manual reproduction** — in the real app (guest or authed, normal-length cycle), pause mid-cycle
   via ⏸ and watch for the toast; check the DB `flow_state_cycle.state`. If pause works by hand,
   the problem is the test, not the product.

## What Changes for /10x-plan

If verification shows an **e2e artifact / test-authoring gap** → the "fix" is a test change
(correct fake-clock sequencing for the pause step, or demote the pause→end journey to a hook test
per L-06), and the `fix-pause-decouple-end-session` `test.fixme` quarantine can be lifted once the
test is corrected — no product change. If it shows a **real `count===0`** → re-run Step 3 targeting
"what transitions the server cycle out of RUNNING" with the now-known exact error, then plan that.

## References

- Source: `src/server/api/routers/cycle.ts:352-412` (pause; throws at `:368-373` and `:390-395`);
  `src/hooks/use-pomodoro-cycle.ts:2107-2173` (client pause), `:1987-2021` (`resolvePersistedCycleId`),
  `:164-165` (E2E timer flag); `prisma/schema.prisma:132`; `playwright.config.ts:90-96`;
  `e2e/helpers/work-cycle.ts:36-42,159`; `e2e/README.md:118-128`; `context/foundation/lessons.md` (L-06)
- Bug report (original framing): `context/changes/fix-timer-pause-cycle-not-running/bug.md`
- Discovered during: `context/changes/fix-pause-decouple-end-session/` (Phase 2, quarantined `test.fixme`)
- Suspected-but-cleared regressions: #200 (`a824530`), #201 (`1a0f743`)
