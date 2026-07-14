---
change_id: fix-timer-pause-cycle-not-running
kind: bug
verdict: disproven-as-product-bug
reported: 2026-07-13
resolved: 2026-07-14
---

# Bug: "Pause fails with Cycle is not running" — DISPROVEN as a product bug

> **RESOLUTION (2026-07-14): the ⏸ pause control is NOT broken.** The originally stated
> cause below was an *inference*, not an observation, and a runtime probe disproved it.
> The real defect is in the e2e test. Kept in full for the record — see **Correction**.

## Symptom (real, still accurate)

The Playwright test `e2e/session-closure.spec.ts` → "pause via timer then end session"
fails deterministically: ~14s into a 30-second work cycle, clicking ⏸ (`timer-pause`) leaves
the timer running, an error toast "Nie udało się wstrzymać cyklu. Spróbuj ponownie." appears,
and `timer-panel-paused` never renders.

## Originally suspected cause (WRONG — preserved verbatim)

> The server `cycle.pause` mutation rejects the request. Its guard
> `updateMany({ where: { id, userId, state: "RUNNING" } })` returns `count === 0` and throws
> `BAD_REQUEST "Cycle is not running"` (`src/server/api/routers/cycle.ts:377-395`), implying a
> cycle-state regression from #200 / #201.

## Correction — what a runtime probe actually showed (2026-07-14)

A diagnostic probe ran the pause journey in three variants against the real server:

| Variant | Clock | Cycle length | Result |
| --- | --- | --- | --- |
| A | **real** | 600 s | ✅ pause works — server returns **200**, `remainingDurationSec: 590` |
| B | **real** | **30 s** | ✅ pause works — server returns **200**, `remainingDurationSec: 20` |
| C | **fake** (`page.clock.install()`) | 30 s | ❌ pause fails — *exact replication of the failing test* |

**Decisive finding: under the fake clock, no `cycle.pause` request is ever sent.** Zero
requests leave the browser after the ⏸ click — not a 400, not a 500. Other tRPC calls
(`task.create`, `session.getOrCreateActive`, `cycle.create`, `cycle.list`) go out normally.

Therefore **neither server guard fires**. Both `cycle.ts:368-373` (boundary) and
`cycle.ts:390-395` (state) are innocent; the server is uninvolved. The "Cycle is not running"
diagnosis was inferred from the client's *generic* error toast — the client catch
(`use-pomodoro-cycle.ts:2160-2172`) shows the same message for **any** rejection, so the toast
never identified a server error at all.

Variant B is the clincher: a 30-second cycle pauses fine on a real clock. The culprit is the
**fake clock specifically**, not the short cycle.

## Actual mechanism

`page.clock.install()` freezes the page's timers and the failing test never advances them
(no `runFor`/`fastForward`). The pause mutation's dispatch depends on a timer callback
(batch/debounce/scheduler tick) that a frozen clock never runs: the click lands, the request is
scheduled, and the schedule never executes. The client then rolls back its optimistic pause
state and shows the generic toast.

The precise starved callback inside the tRPC link / hook was not pinned down — it does not
change the verdict (the server is uninvolved), but it is the one open thread if a exact
root-cause line is ever wanted.

## Impact (revised)

**No product impact.** The ⏸ control works for work cycles, on both long and short cycles.
Priority drops from "core control broken" to routine test hygiene.

The real cost was coverage: the pause→end journey was quarantined (`test.fixme`) in
`fix-pause-decouple-end-session` on the strength of this phantom bug.

## Correct fix

In the test, not the product: drive the pause journey on a **real clock** (a pause test needs
no time to pass, so the fake clock buys nothing and breaks everything), then lift the
`test.fixme` quarantine.

## Lesson

Do not promote an inferred cause to "confirmed" without observing it. A generic client-side
error toast is not evidence of a server rejection. See `context/foundation/lessons.md` L-06
(fake-clock/worker interactions are a known e2e failure class in this repo).

## References
- Probe evidence: three-variant runtime reproduction (2026-07-14), documented above
- Frame that correctly withheld the product-bug conclusion: `frame.md` (dimension D5)
- Quarantined test: `e2e/session-closure.spec.ts` ("pause via timer then end session")
- Cleared (wrongly suspected): #200 (`a824530`), #201 (`1a0f743`)
