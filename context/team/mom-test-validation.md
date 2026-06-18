# Mom Test Validation Plan

## Input Idea

**Timer slice change-impact digest** — a read-only script/report that, given a path (e.g. `use-pomodoro-cycle.ts`), joins dependency-cruiser fan-out, git co-change pairs, and a static test catalog to print dependents, historically co-changed files, and recommended test layers before editing the timer hub.

Source: [opportunity-map-automated.md](./opportunity-map-automated.md) (2026-06-18). Chosen as first automated complement over wedge mutex (in-flight F-07), ACL char tests (planned K2), domain glossary diff, and rollout status digest.

## Hypotheses

- **User/role**: Solo maintainer (primary) and any future contributors touching the timer vertical slice — `use-pomodoro-cycle.ts`, `pomodoro-dashboard.tsx`, wedge overlays, hook tests, E2E belt specs.
- **Friction**: Timer hub changes have high blast radius (~19 depcruise dependents, 35 co-change commits with dashboard, 27 with E2E specs per L3 research). Before each edit, the maintainer must remember which seams and test layers to touch; that knowledge lives in research prose and static maps, not in a repeatable pre-change check.
- **Current workaround**: Mental checklist; `context/map/repo-map.md`; architect report; ad-hoc co-change counts in slice research docs; running `pnpm test` / `pnpm test:e2e:belt` after the fact; optional `reports/timer-hub.svg` from depcruise.
- **Proposed solution**: Pre-change digest — input path → short report listing dependents, historical co-changes, and suggested test commands. Later: PR comment or lefthook gate scoped to timer paths.
- **Risky assumptions**:
  - The maintainer skips or forgets the static artifacts *before* editing, not just lacks them entirely.
  - Joining depcruise + git co-change adds signal beyond either source alone.
  - Missed test layers or regressions trace to incomplete pre-change awareness, not to inherent monolith complexity (K1) that a report cannot fix.
  - The digest will be run habitually; otherwise it becomes shelf-ware like repo-map updates.
  - ~50% git activity on the timer slice means frequency justifies tooling, not just one painful refactor episode.
- **Evidence already present** (facts, not guesses):
  - L3 / architect artifacts document 19 fan-out, 9 fan-in, 35 dashboard co-changes, 27 E2E co-changes — verified via depcruise and git.
  - `context/map/repo-map.md` and `context/architect-report.md` already call out timer blast radius as top risk.
  - Refactor research (K1) ranks monolithic hook as #2 priority because of this cost — structural fix is separate from planning-layer digest.
  - Opportunity map explicitly scoped read-only / throwaway-safe validation before CI wiring.

## Critique

**Problem vs solution.** The stated pain is “I might miss a dependent or test layer.” The deeper pain may be “the hook is a 2357 LOC monolith with 63 return fields” (K1). A digest makes the monolith *safer to touch* but does not reduce touch frequency. If the maintainer already runs the full belt after every timer PR and rarely misses layers, the digest is documentation theater — a prettier view of data already in repo-map and research.

**Past behavior vs future intent.** Static maps exist today. The critical unknown is not whether blast-radius *can* be documented, but whether the maintainer *actually consults* them before editing. If the honest answer is “I only read research during `/10x-research`, then code from memory,” the digest has a job. If the answer is “I always run belt E2E and haven’t missed a seam in months,” defer or narrow scope to CI-only (fail when touched paths ≠ co-change set in last N commits).

**Good enough already?** `repo-map.md`, timer-hub SVG, and “run hook tests + dashboard smoke + e2e:belt” may cover 80% of value. Git co-change is the thin complement — depcruise shows structure, git shows *what humans actually change together*. Validate that co-change rows would have changed behavior on the last 3–5 real timer slices.

**What would prove “do not build yet”?** Zero instances in the last 10 timer-related commits where a co-change file or test layer was skipped and caused rework, CI failure, or a follow-up fix commit. Or: digest output duplicates repo-map + a one-liner test command with no new rows.

**What would prove “proceed”?** At least 2 of the last 5 timer slices where pre-change awareness was uncertain, research docs were reopened mid-edit, or a test layer was added only after CI/red review — and co-change data would have listed the missing file upfront.

**Audience note.** With a solo maintainer, “interviews” are structured retrospectives on recent commits, not customer discovery. One optional peer review if another contributor touches the timer slice.

## Interview Guide

*Target: 20–30 minutes. Solo maintainer self-retrospective on recent timer work, or live walkthrough with a contributor who has touched the hub.*

### Context warm-up

1. **Walk me through how often you touch the timer vertical slice** — not in general, but in the last 4 weeks. Which files did you actually open?
   - *Follow-up:* Roughly what share of your FlowState commits were timer-related?

2. **Before your last timer edit, what did you do to understand blast radius?** List every artifact, command, or habit — repo-map, research doc, depcruise, mental model, nothing.
   - *Follow-up:* How long did that prep take vs coding time?

### Recent story (last real occurrence)

3. **Pick the most recent non-trivial change to `use-pomodoro-cycle.ts` or `pomodoro-dashboard.tsx`.** Walk me through it from “I need to change X” to merge — what files did you touch, in what order?
   - *Follow-up:* Was there a moment you thought “I might be missing something”?

4. **Tell me about the last time a timer change caused rework** — CI failure, missed E2E spec, dashboard regression, or a fix-up commit the same day.
   - *Follow-up:* What file or test layer was missed? Would co-change history have listed it?

5. **When did you last re-open `repo-map.md`, architect report, or slice research *during* an edit** (not during `/10x-research`)?
   - *Follow-up:* What question were you trying to answer?

### Current workaround

6. **If you had to explain “what to run before merging a timer PR” to future-you in one minute,** what would you say today — exact commands and files?
   - *Follow-up:* Do you always follow that, or only when you remember?

7. **Have you used `reports/timer-hub.svg` or depcruise output in the last 3 months?** When and why?
   - *Follow-up:* Did it change which files you edited?

### Cost of pain

8. **What did a missed seam cost you recently** — time, context switch, failed CI run, E2E debug session, or delayed slice?
   - *Follow-up:* Was that a one-off or a recurring pattern?

### Existing alternatives

9. **What would you use instead of a new script** — always run full belt, extend repo-map, add a PR template checkbox, or rely on lefthook’s existing gates?
   - *Follow-up:* Why hasn’t that been enough?

### Decision signal

10. **What would have to be true for a pre-change report to be worth maintaining** — frequency, new information, or CI promotion?
    - *Follow-up:* Would you run it manually before every timer touch, or only if wired into CI/hooks?

### Closing ask

11. **Can we walk through the last 5 timer-related commits together** and mark each: “digest would have added rows I didn’t already know” vs “no new signal”?
    - *Permission:* OK to log anonymized commit SHAs and digest delta in this validation doc.

## Survey

*Self-audit over the last 10 timer-hub commits (or 8 weeks, whichever is smaller). Answer from git history, not memory.*

**Screener**

1. In the last 8 weeks, did you merge at least one PR that touched `use-pomodoro-cycle.ts`, `pomodoro-dashboard.tsx`, or `src/lib/wedge/`?
   - [ ] Yes → continue
   - [ ] No → stop; digest validates later when timer churn resumes

**Frequency & prep**

2. How many commits touched the timer hub files above in that window?
   - [ ] 0  [ ] 1–3  [ ] 4–10  [ ] 11+

3. Before those edits, how often did you consult `repo-map.md`, architect report, or slice research?
   - [ ] Every time  [ ] Most times  [ ] Rarely  [ ] Never

4. How often did you run `pnpm test:e2e:belt` (or full E2E) before merging timer changes?
   - [ ] Every time  [ ] Most times  [ ] Only when CI failed locally  [ ] Relied on CI only

**Incidents (behavior, not hypotheticals)**

5. How many timer PRs required a same-day or next-day fix commit for a missed file or test?
   - [ ] 0  [ ] 1  [ ] 2–3  [ ] 4+

6. How many CI failures on timer PRs were due to a test layer you knew about but skipped vs one you had not considered?
   - [ ] No CI failures  [ ] Knew but skipped  [ ] Had not considered  [ ] Both happened

**Open — recent example**

7. *Describe the last timer change where you were unsure about blast radius.* What did you do, and what happened? (2–4 sentences)

8. *If a report listed depcruise dependents + top 5 git co-changed files + “run: hook tests + belt E2E” before your last timer edit,* would any row have been **new** information not already in your head or repo-map?
   - [ ] Yes — specify which rows in Q7 follow-up
   - [ ] No — all redundant
   - [ ] Unsure — need to replay last commit with draft output

## Decision Criteria

- **Proceed** if:
  - At least **3 of last 5** timer-hub commits show **new signal** from co-change rows (file you did not plan to touch but historically co-changes, or test layer not in mental checklist).
  - At least **2 incidents** in 8 weeks where pre-change uncertainty caused rework, extra research doc lookup, or known-but-skipped test layer with CI cost.
  - Manual dry-run of draft digest on last commit takes **< 30 seconds** and output fits one screen.

- **Narrow scope** if:
  - Depcruise + test catalog duplicate repo-map; **only git co-change** adds value → ship minimal `git log` co-change script, skip full joiner.
  - Habit is strong (always full belt) but **CI promotion** still wanted → skip CLI habit test; prototype PR-comment only on paths under `src/hooks/use-pomodoro-cycle.ts`.
  - Timer churn drops below 1 touch per month → park until next K1/F-07 slice cluster.

- **Do not build yet** if:
  - **0 of 5** replayed commits gain new rows from co-change data.
  - Last 10 timer PRs had **zero** missed-layer rework and maintainer consults repo-map or runs belt every time.
  - Pain is acknowledged but prep cost is already < 5 minutes and stable — opportunity cost beats tooling.

- **Try existing tool/process first** if:
  - PR template checkbox + link to repo-map timer section + documented command block (`pnpm test` + `pnpm test:e2e:belt`) closes the gap without new code.
  - Extending `repo-map.md` with a frozen co-change table (updated quarterly) matches actual consult frequency — maintain map before building generator.

---

**Next handoff (from opportunity map):** `/10x-shape` — scope the digest MVP (inputs, output format, one reference path) using thresholds above.
