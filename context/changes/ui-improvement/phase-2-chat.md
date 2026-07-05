I'll start by reading the plan and related context files for the ui-improvement change.


Read 2 files, ran a command
Phase 1 is complete (committed 0a754e3). I'm starting Phase 2. Let me read the lessons and the key source files for Phase 2.


Read 3 files
Phase 2 is complex and high-risk. Let me set up phase tasks and read the remaining key files. First loading the task tool and reading more context.


Read a file, used a tool
This is a deeply interwoven hook. Before touching anything, I need to fully understand how the session steering (energy + focus) connects to the day-start gate and the dashboard. Let me read the remaining key files.


Read 4 files
The steering is complex. Let me read the research decisions and the dashboard to understand how the cards render and how energy flows to suggestions.

Read
research.md
Now I understand the architecture. Note the plan (Phase 1 already done) supersedes the research's "edit today's check-in" decision — energy now lives in DayPlan.energyLevel. Let me examine how the dashboard wires the steering cards and find all references to the focus/intention path.


Searched code, found files
Let me read the Phase 1 hook and the relevant dashboard sections.


Read 3 files
Now let me check the E2E specs and unit tests that touch steering/focus/energy to understand the test contract I must preserve or fix.


Searched code, read 3 files
The E2E completeKickoffSteering helper already tolerates the focus card being absent (line 42-45). The energy card currently completes on immediate select. Let me examine the unit tests that reference the focus/steering symbols so I know exactly what to update.

Searched
Focus|focus|steering|showSessionEnergy|completeSessionEnergy|skipSessionEnergy|sessionIntention|intention
This is a large, careful refactor. Let me view the makieta design references and remaining tests before implementing. Let me check the makiety folder and read the key test files.


Ran a command, read a file
Let me view the makieta for the energy gate and main page. Let me look at flow-pracy.png and main-page-ready.png.


Read 2 files
The makieta confirms a two-step energy gate: select an energy card (highlighted), then a primary "Zapisz i kontynuuj"/"Dalej" CTA, with a hint about changing it later. No focus card, no skip in the mockup — but I'll keep a subtle skip to preserve the E2E dismiss path. Let me set up phase tracking and check remaining intention usages.


Searched code, used 7 tools
resolveIntentionWorkType/getIntentionChipOptions are still used server-side by suggestion.ts — I'll leave narrative-copy.ts untouched (only remove the SessionFocusCard import of it). Let me mark phase status and read the i18n keys.


Searched code, read 2 files, used 2 tools
Now I'll update the i18n. First PL:


Edited 2 files
Now the EnergySelector — add a selectedValue prop for the two-step selection highlight:

Edited
energy-selector.tsx
+34
-17
Now rewrite session-steering-card.tsx — restyle the energy card to the makieta two-step and remove SessionFocusCard:

Updated
session-steering-card.tsx
+59
-100
Now the hook. Let me remove the focus-steering state surgically, one reference at a time.

Edited
use-pomodoro-cycle.ts
+0
-5
Now remove completeSessionFocus and skipSessionFocus callbacks entirely:

Edited
use-pomodoro-cycle.ts
+0
-54
Now the kickoffEligible effect — remove focus from the guards, the arming, and the dep array:

Edited
use-pomodoro-cycle.ts
+2
-5
Now the retryWedgeSync kickoff_session branch and endSession:

Edited
use-pomodoro-cycle.ts
+0
-2
Now the return object — remove showSessionFocus, sessionFocusPending, completeSessionFocus, skipSessionFocus:


Edited a file, searched code
Now home-session-state.ts — remove showSessionFocus:

Edited
home-session-state.ts
+2
-7
Now the dashboard. Let me check how useDayPlan is currently used there so I can wire setEnergy:

Searched
useDayPlan|useDayEnergy|setEnergy|dayPlan\.|const \{.*\} = useDayPlan
dayPlan is in scope in the Body (used at 839-864). Let me confirm the Body receives it as a prop and check its signature:

Read
pomodoro-dashboard.tsx
Confirmed. Now the dashboard edits:

Edited
pomodoro-dashboard.tsx
+2
-7
Now wire setEnergy into handleCompleteEnergy (write to DayPlan) and remove the focus handlers:

Edited
pomodoro-dashboard.tsx
+4
-14
dayPlan.setEnergy can reject (mutateAsync); the write is best-effort at the gate. Let me guard the promise:

Edited
pomodoro-dashboard.tsx
+3
-2
Now the showKickoffCard guard, the homeIa derive call + deps, and the steering JSX:

Edited
pomodoro-dashboard.tsx
+7
-23
Let me verify no stale references remain in non-test source:

Searched
showSessionFocus|SessionFocusCard|completeSessionFocus|skipSessionFocus|handleCompleteFocus|handleSkipFocus|sessionFocusPending
The remaining references are all in tests plus a doc comment. Let me rewrite session-steering-card.test.tsx:

Updated
session-steering-card.test.tsx
+27
-50
Now the home-session-state test:


Read a file, edited a file
Now the dashboard test. Let me read the mock hook shape and the focus-card tests:


Read a file, edited a file
Now remove the two focus-card tests (521-539 and 615-647):

Failed to edit
pomodoro-dashboard.test.tsx
