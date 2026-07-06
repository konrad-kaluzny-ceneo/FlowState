---
name: new-bug
description: Capture, confirm, and file a bug as a change task under context/changes/<id>/. Use when the user reports something misbehaving — types /new-bug, or reports a defect ("błąd", "bug", "nie działa", "nie powinien", "broken", "regression", "shouldn't happen"). Gathers the symptom, CONFIRMS it against the codebase before filing (refuses to file a phantom bug), then creates the change task and points at /10x-plan.
---

# /new-bug — Capture, Confirm, File a Bug

Turn a freeform bug report into a **confirmed** change task. Three phases, in order: **Capture** the report → **Confirm** it against the codebase → **File** the task.

The spine is the confirm gate: a bug report is worth nothing until you have located it in code. Never file a bug you have not confirmed — a phantom bug wastes a planning cycle downstream.

A "bug task" is an ordinary change folder under `context/changes/<change-id>/` (same structure `/10x-new` produces), carrying an extra `bug.md` report.

## Initial Response

- **Argument provided** (e.g. `/new-bug feature 'Sugerowane następne zadanie' nie powinien pokazywać się podczas przerwy`): treat the whole argument as the bug-report seed and go to Phase 1.
- **No argument**: respond with the message below and **STOP**. Wait for the user.

```
Describe the bug and I'll confirm it against the code before filing a task. The more of these you give, the faster the confirm:

  • Symptom — what you see that's wrong
  • Where/when — the screen, action, or state that triggers it
  • Expected — what should happen instead

Example:
  /new-bug feature 'Sugerowane następne zadanie' nie powinien pokazywać się podczas przerwy
```

## Phase 1 — Capture

Distil the report into three lines. Infer what you safely can from the seed; do not interrogate the user for what the code will answer in Phase 2.

- **Symptom** — the wrong behavior the user observes.
- **Trigger** — the screen, action, or app state that surfaces it.
- **Expected** — what should happen instead.

If the **symptom** is missing or too vague to search for, ask ONE round of clarifying questions (your assistant's question-asking feature, 2–4 concrete options each) then proceed. Missing trigger or expected is fine — note it as unknown and let Phase 2 resolve it. Do not ask more than one round; Phase 2 is where ambiguity gets settled by evidence, not by asking.

**Completion criterion:** you can write the Symptom line; Trigger and Expected are written or explicitly marked `unknown`.

## Phase 2 — Confirm

Investigate the codebase and reach a verdict on whether the reported behavior is real. This is `/10x-research` narrowed to one question: *does this bug actually happen, and where?*

1. **Check for a duplicate first.** Scan `context/foundation/roadmap-references/bugs.md`, open change folders under `context/changes/`, and `context/foundation/lessons.md`. If the same defect is already filed or is a known accepted pattern, say so with the reference and **STOP** — do not file a second task (duplicate tasks split effort and, once synced, corrupt downstream Linear/GitHub state — cf. `lessons.md` L-01).
2. **Locate the responsible code.** For a narrow report, read the relevant files directly. For a broad or unfamiliar area, spawn `Explore` / `general-purpose` sub-agents in parallel (one per suspected component) and wait for all to return before judging.
3. **Trace the path** from trigger to symptom. Decide the verdict:
   - **confirmed** — the code path produces the reported behavior; you can point to the exact line(s) that do it.
   - **not-reproduced** — the code already handles this correctly, or the report rests on a misunderstanding. Report what you found with evidence and **STOP** — file nothing.
   - **uncertain** — code alone can't decide it (timing, external service, data-dependent). State precisely what runtime check would settle it, then ask the user whether to file anyway as `status: uncertain` or hold.

**Completion criterion:** a verdict of `confirmed`, `not-reproduced`, or `uncertain`, with a `file:line` citation backing every factual claim about the code. No verdict → no filing.

## Phase 3 — File

Only reached when the verdict is `confirmed` (or `uncertain` and the user chose to file). Mirror `/10x-new`, then add the bug report.

1. **Derive the change-id:** a kebab-case slug describing the fix, `fix-` prefixed by convention (`fix-suggestion-hidden-during-break`). Must match `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`. Must not already exist under `context/changes/` or `context/archive/` — on collision, pick a different slug.
2. **Create** `context/changes/<change-id>/`.
3. **Write** `context/changes/<change-id>/change.md`:

```markdown
---
change_id: <change-id>
title: <one-line, sentence case, ≤80 chars, describes the fix outcome>
status: new
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
archived_at: null
---

## Notes

<the user's original report, verbatim>
```

4. **Write** `context/changes/<change-id>/bug.md`:

```markdown
---
change_id: <change-id>
kind: bug
verdict: confirmed | uncertain
reported: <YYYY-MM-DD>
---

# Bug: <symptom in a few words>

## Symptom
<what the user observes that is wrong>

## Trigger
<screen / action / state that surfaces it — or "unknown">

## Expected
<what should happen instead — or "unknown">

## Confirmation
**Verdict:** confirmed | uncertain
<evidence: the code path from trigger to symptom, with file:line citations. For "uncertain", the runtime check that would settle it.>

## Suspected cause
<the line(s) most likely at fault, file:line — best current read, not a committed fix>
```

`<YYYY-MM-DD>` is today (`date +%Y-%m-%d`).

## Next-step suggestion

After filing, print the next step and copy the command to clipboard.

Default is `/10x-plan <change-id>`. Switch to `/10x-frame <change-id>` when the report bundles a symptom with a self-diagnosed fix ("X is broken, just change Y") — the framing should be challenged before planning.

```bash
NEXT_CMD="/10x-plan <change-id>"   # or /10x-frame <change-id> when a fix was pre-assumed
echo -n "$NEXT_CMD" | pbcopy 2>/dev/null || echo -n "$NEXT_CMD" | clip.exe 2>/dev/null || echo -n "$NEXT_CMD" | xclip -selection clipboard 2>/dev/null || true
```

```powershell
Set-Clipboard $NEXT_CMD
```

Then display:

```
✓ Confirmed and filed context/changes/<change-id>/ (bug.md, change.md — status: new)

Next step:
  → <NEXT_CMD>  (✓ copied to clipboard)

Other option:
  /10x-frame <change-id>   — challenge the framing first (when the report already assumes a fix)
```

## What this skill does NOT do

- Does not file into `context/foundation/roadmap-references/bugs.md` or create Linear/GitHub issues — those promote a task to the roadmap and belong to `/10x-linear-backlog` and the roadmap skills.
- Does not write `plan.md` or fix the code — it stops at a confirmed, filed task and hands off.
- Does not file an unconfirmed bug — a `not-reproduced` verdict ends in a report, not a folder.
