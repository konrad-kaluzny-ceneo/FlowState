---
date: 2026-06-27T13:20:00+02:00
researcher: Konrad Zieliński
git_commit: 94101e1fe4549c31c7259dcdeb8cb49ea44ca0c6
branch: features/product-voice-contract
repository: FlowState
topic: "F-14 product-voice-contract — bilingual EN/PL i18n foundation + product voice contract"
tags: [research, codebase, i18n, copy, voice, localization, F-14]
status: complete
last_updated: 2026-06-27
last_updated_by: Konrad Zieliński
---

# Research: F-14 `product-voice-contract`

**Date**: 2026-06-27T13:20:00+02:00
**Researcher**: Konrad Zieliński
**Git Commit**: 94101e1fe4549c31c7259dcdeb8cb49ea44ca0c6
**Branch**: features/product-voice-contract
**Repository**: FlowState

## Research Question

Research the codebase to support `/10x-plan` for F-14 `product-voice-contract`, covering **both** tracks of the slice:

- **Phase 1 (i18n infrastructure):** current localization state, a full inventory of where user-facing copy lives, language defaulting, and a concrete recommendation for a bilingual EN/PL approach (library vs lightweight dictionary).
- **Phase 2 (voice contract):** the existing shipped voice/tone/copy that should feed `context/foundation/product-voice.md` (promise, tone, vocabulary, copy zones, EN + PL examples/non-examples), plus the constraints prerequisites and downstream slices impose.

## Summary

- **There is no i18n today.** No i18n library in `package.json`, no locale routing in `next.config.js`/`proxy.ts`, `<html lang="en">` is hardcoded (`src/app/layout.tsx:47`), the only locale reference is a hardcoded `en-GB` for time formatting (`daily-recap-panel.tsx:33`), and there is **zero Polish copy** anywhere in `src/`. Phase 1 is genuinely greenfield — nothing to migrate *off of*, so the "lightweight dictionary vs formal i18n library" unknown is fully open.
- **Copy is partially centralized, partially inline.** ~18 copy modules under `src/lib/**` (e.g. `session/transition-copy.ts`, `onboarding/copy.ts`, `scoring/rationale.ts`) are a clean, test-backed migration seam. A large body of inline literals remains in components — concentrated in `task-list.tsx`, `timer-panel.tsx`, `pomodoro-dashboard.tsx`, the overlays, and the auth forms (including many `aria-label`s and `placeholder`s that are easy to miss).
- **The app is overwhelmingly client-rendered** — ~42 components carry `"use client"`. Whatever i18n is chosen must be first-class in client components, not just RSC.
- **Polish needs real plural rules.** Several `count === 1 ? "x" : "xs"` ternaries exist (`guest/merge-copy.ts`, `narrative-builder.ts`, `format-ended-ago.ts`). Polish has 3+ plural forms (one/few/many/other), so an ICU-capable solution is effectively mandatory, plus DB length caps and 120-char closure budgets will be tight because Polish runs longer than English.
- **Recommendation (Phase 1): `next-intl`.** It is App-Router-native, works without locale routing (cookie-based locale — fits this single-domain app), provides ICU MessageFormat (correct Polish plurals/select), typed message keys, and locale-aware date/number formatting. A hand-rolled typed dictionary is the only real alternative but would force hand-rolling Polish plural logic — not worth it. See "i18n approach recommendation".
- **Voice is already consistent and well-defined in practice.** Brand personality is locked in `PRODUCT.md:17` ("**mindful, clear, trustworthy** … a quiet room, not a productivity dashboard"). The signature copy trait is an **em-dash two-clause "fact — reassurance" cadence**, short second-person lines, explicit agency ("you're always in control"), honest non-gamified accounting, and deliberate avoidance of streaks/points/productivity-bro/AI-slop language. Phase 2 mostly needs to *codify* and *translate* what already ships, not invent a voice.
- **Constraint to respect:** the transition-beat rule — **at most one interstitial line + one gate per beat** (`user-flow.md:256`, `prd.md:79`). The voice contract must specify which single line "wins" per beat, not add prose.

## Detailed Findings

### Phase 1 — i18n infrastructure

#### Current state: no i18n (greenfield)

- No i18n dependency in `package.json:38-58` (no `next-intl`, `i18next`, `react-intl`, `lingui`, `@formatjs/*`). Stack is Next.js 16 App Router + React 19 + T3/tRPC + Prisma 7 + Neon + Tailwind 4 + Biome.
- `next.config.js:8` is an empty config (`const config = {}`). Note: Next 16 App Router dropped the legacy `i18n` config key; routing-based i18n is middleware/segment-based now.
- `proxy.ts:14-35` (Next middleware) handles only Neon auth route protection — no locale detection, no `Accept-Language` handling, no locale redirect.
- `src/app/layout.tsx:44-49` hardcodes `<html lang="en">`; `metadata` (title/description) at `layout.tsx:15-19` is hardcoded EN too.
- The only `locale` reference in the app is `const locale = "en-GB"` for `toLocaleTimeString` in `daily-recap-panel.tsx:33` — formatting, not translation.
- **Zero Polish strings** in `src/` (searched brand terms and Polish diacritics). The F-14 promise string "co teraz" exists only in roadmap/brand docs, not in the product.

#### Centralized copy modules (the clean migration seam)

These already isolate copy; each has a co-located `*.test.ts` that acts as a contract to preserve during migration:

| Module | Surface | Export shape |
| --- | --- | --- |
| `src/lib/onboarding/copy.ts` | first-run, wedge coach, auth value | `getFirstRunCopy(mode)`, coach consts, `getAuthValueCopy(variant)`; `{preset}` token interpolation |
| `src/lib/session/end-session-copy.ts` | end-session confirm | consts + `getEndSessionConfirmCopy(variant,ctx)` |
| `src/lib/session/narrative-copy.ts` | closure/handoff/energy/chips | records + consts |
| `src/lib/session/wind-down-copy.ts` | wind-down gate | 4 consts |
| `src/lib/session/transition-copy.ts` | break start + re-entry | consts + `getBreakStartLine`/`getBreakReentryLine(energy)` |
| `src/lib/session/narrative-builder.ts` | in-flow summary + closure composition | builder fns + embedded literals |
| `src/lib/catch-up/copy.ts` | tab-return catch-up | `getCatchUpCopy(gate,ctx)` |
| `src/lib/guest/merge-copy.ts` | merge success | `buildMergeSuccessCopy(input)` + pluralized counts |
| `src/lib/suggestion/override-ack-copy.ts` | override ack toast | `OVERRIDE_ACK_LINE` |
| `src/lib/scoring/rationale.ts` | suggestion rationale (14 keys) | `buildRationale(key,ctx)` switch |
| `src/lib/scoring/rationale-breakdown.ts` | "Why this?" chips | `FACTOR_CHIP_LABELS` record |
| `src/lib/scoring/persona-trust-clause.ts` | persona trust clause | `PERSONA_TRUST_HINTS` record |
| `src/lib/design/work-type-config.ts` | work-type badges | `WORK_TYPE_CONFIG` — **label coupled with Tailwind classes** |
| `src/lib/task/persona-presets.ts` | preset labels | `TASK_PERSONA_PRESETS` array — **label coupled with scoring attrs** |

> Migration caution: `work-type-config.ts` and `persona-presets.ts` interleave display labels with behavior/config — extraction must decouple label from data.

#### Inline string surfaces (the bulk of Phase 1 effort)

High-density inline literals (approx. counts), to be extracted during Phase 1:

- `src/app/_components/task-list.tsx` — ~20+ (badges, section headers, aria-labels, placeholders).
- `src/app/_components/timer-panel.tsx` — ~20 (states, durations, aria-labels, bounds labels).
- `src/app/_components/task-suggestion-card.tsx` — ~12 (status messages, headings, buttons).
- `src/app/_components/cycle-complete-overlay.tsx` — ~9; `mid-cycle-completion-prompt.tsx` — ~8; `wedge-sync-recovery.tsx` — ~10; `session-steering-card.tsx`, `task-fields-panel.tsx` — ~18 each.
- `src/app/_components/daily-recap-panel.tsx` — ~8 + row formatters.
- `src/app/_components/home-shell.tsx`, `pomodoro-dashboard.tsx`, `empty-active-tasks-guide.tsx`, `guest-banner.tsx`, `user-menu.tsx`, `focus-budget-prompt.tsx`, `break-alerts-permission-prompt.tsx`, `out-of-tab-break-alerts-control.tsx`, `kickoff-duration-chips.tsx`, `duration-picker.tsx`, `energy-selector.tsx`, `check-in-overlay.tsx`, `persona-preset-picker.tsx`.
- **Auth surfaces** (`src/app/auth/**`) — sign-in/up, forgot/reset password forms + pages, Google button, value narrative, plus **server actions** and **Zod schema messages** (`sign-up/schema.ts:6-17`, `reset-password/schema.ts:10`).
- **Server-derived errors surfaced in UI:** `src/hooks/use-pomodoro-cycle.ts` has ~30 inline `setError(...)`/recovery strings; `src/hooks/use-task-mutations.ts:39-41`.

> ~42 `.tsx` files carry `"use client"` — the app is client-dominant. aria-labels and placeholders are a meaningful, easy-to-miss share of the surface.

#### Language defaulting signals (none today, clear hooks available)

- `prisma/schema.prisma`: no `language`/`locale`/`preferences` field. The only prefs model is `UserPreference` (`:177-183`) holding just `cycleEndAudioMode` + `updatedAt` — the natural place to add a `language` column for authed users.
- No `Accept-Language` parsing anywhere; `proxy.ts` is the natural place for a default.
- Guest preference pattern to mirror: theme + audio/break/duration prefs use scoped `localStorage` (`src/lib/*-storage.ts`, `src/lib/onboarding/storage.ts`) and a guest/auth split via `OnboardingScope` (`src/lib/onboarding/types.ts`) and `src/lib/data-mode/`.
- `<html lang>` is a one-line change at `layout.tsx:47`.
- No settings UI for language exists (only theme, cycle audio, break alerts) — placement of a language switch is an open implementer/user decision.

#### Pluralization / interpolation the i18n layer must support

- **Named-token interpolation** (`{token}` via `.replace`): `onboarding/copy.ts:44-47` — the only explicit placeholder convention today.
- **Template-literal interpolation** (pervasive): rationale (`rationale.ts:30,51`), persona clause (`persona-trust-clause.ts:35`), closure/handoff (`narrative-builder.ts:64,130-145`), catch-up (`catch-up/copy.ts:33,38`), suggestion card (`task-suggestion-card.tsx:26,143`), timer (`timer-panel.tsx:206`).
- **Count-based plurals (manual ternaries → must become ICU)**: `guest/merge-copy.ts:61,65,73-76`; `narrative-builder.ts:54,59`; `format-ended-ago.ts:17,21`.
- **Locale-sensitive formatting**: `daily-recap-panel.tsx:27-37` (`toLocaleTimeString("en-GB", …)`) should switch with locale.
- **Length budgets / DB caps that Polish will stress**: `narrative-builder.ts:117` drops a note if `line+note > 120`; `schema.prisma` caps `closureLine`/`resumeNote` at `VarChar(120)` (`:106,:75`) and `intention` at `VarChar(80)` (`:131`). Polish text runs longer — revisit budgets in Phase 1.

### Phase 2 — voice contract source material

The product is **100% English today** but already speaks with a consistent voice. Phase 2 should codify + translate, not invent.

#### Brand identity (locked)

- `PRODUCT.md:17` — personality: "Calm, focused, restrained. Three words: **mindful, clear, trustworthy**. The interface should feel like a quiet room, not a productivity dashboard shouting for attention."
- `PRODUCT.md:9,13` — promise: "answer 'what do I do right now?' and recover context after disruption"; success is "a **calm end-of-day feeling** … not maximum throughput."
- `PRODUCT.md:21-26` — **anti-references (non-examples):** no arcade/surprise delight, no "purple-gradient AI-slop", no dense analytics dashboards, not "throughput-first task managers (Todoist/Asana density)."
- `PRODUCT.md:30,33` — "**Calm over clever — subtract before adding**"; "must read instantly **without reading copy**" (copy supports the decision, never carries it).
- `DESIGN.md:2-3,109` — Serene Pastel / Calm Garden, "calm, light-default … quiet room"; no explicit vocabulary list (that gap is exactly what `product-voice.md` fills).

#### Copy zones with real shipped strings (EN exemplars to anchor the contract)

- **Suggestion + rationale** (`task-suggestion-card.tsx`, `scoring/rationale.ts:23-55`): heading "Suggested next task"; calm one-liners e.g. "Quick win — fits your fading energy", "Deep work — you're focused with few interruptions", default "Next up based on your energy and task mix". Override ack (`override-ack-copy.ts:2`): "Your pick is noted — we'll use it for the next suggestion."
- **Recap / day memory closure** (`narrative-builder.ts:53-145`, `narrative-copy.ts:11-21`): e.g. "Session complete — 3 cycles, 1 task done. Feeling focused."; honest non-events "no finished cycles yet", "This focus block wasn't counted."; handoff prefixes "Left off:" / "Continue:".
- **Wedge transitions** (`transition-copy.ts:5-18`): the strongest positive exemplar set — "A brief pause — let your mind reset.", "Ready when you are — your focus is still here.", "Whenever you're ready — no rush.", neutral "Break complete — ready for the next cycle."
- **Wind-down gate** (`wind-down-copy.ts:2-9`): "Ready to wrap up?" / "You've been at it a while — ending now is a valid choice, or you can keep going." Buttons "Keep going" / "End session".
- **End-session confirm** (`end-session-copy.ts`): "End this session?" with non-punitive bodies; "Keep going" / "Stay paused".
- **Onboarding** (`onboarding/copy.ts:9-80`): "Welcome to FlowState"; recurring agency phrase "you're always in control"/"choose any task"; recurring promise verb "**unlock**"; guest→auth merge "Your trial work is saved".
- **Persona presets** (`persona-presets.ts:44`): short noun/verb labels — Focus, Synchro, Firefight, Warm up, Meeting, Plan, Research, Quick.
- **Empty states + headers**: home tagline "Manage your tasks. Stay in flow." (`home-shell.tsx:97`); empty guide "No active tasks yet — add one to start a focus cycle." (`empty-active-tasks-guide.tsx:11`); energy options Focused/Steady/Fading (`energy-selector.tsx:18-37`).

#### Observed tone patterns (the de-facto contract)

- **Em-dash two-clause cadence** = signature trait: `fact — reassurance/instruction`.
- **Short**, one sentence; second person, present tense, gentle imperatives (ease, step away, return when ready).
- **Explicit agency + reassurance**: "you're always in control", "ending now is a valid choice", "no rush", "Take a breath."
- **Honest, non-gamified accounting**: bare facts, no celebration/scores/pressure.
- **Promise framing = "what to do next"** (the implicit answer to F-14's "co teraz / what now?").
- **Deliberately avoided**: streaks, points, badges, "crush/beat/smash", urgency-shaming, hype exclamations, generic wellness platitudes. Energy named neutrally (Focused/Steady/Fading), never judgmentally.
- **Typographic drift to normalize in the contract**: dominant Unicode ellipsis `…` vs residual ASCII `...` in "Starting..." / "Creating account..."; `·` middle-dot is the standard separator.

### Prerequisites & downstream constraints

- **S-21 (mindful transition copy)** — already ships a **fixed copy library keyed to last check-in energy** (`transition-copy.ts:5-18`); F-14 must absorb these into the i18n structure + contract, not reinvent. Re-entry must not duplicate S-16 wind-down preachiness; guest re-entry is neutral-only.
- **S-30 (daily recap, done)** — the **data substrate** S-42 formats over; F-14 defines recap closure vocabulary (done/remains/return-to) without changing the substrate. Keep recap (list) vs S-17 narrative (prose) zones distinct.
- **F-04 (impeccable design foundation)** — locked *visual* identity; its risk note ("shape discovery stalls without a locked product voice") is F-14's reason to exist (locks the *verbal* identity).
- **F-06 (Serene Pastel rebrand)** — **copy was explicitly out of scope**; F-14 owns the first verbal-voice decisions. F-06 set the "well-being register" the voice should match.
- **Downstream consumers (copy zones F-14 must supply):**
  - **S-40 home-ia-reset**: primary "Co teraz?" heading, next-focus suggestion + rationale, one dominant CTA. Open unknown: interim `home-voice.ts` vs waiting for F-14 — F-14 should provide authoritative home voice so S-40 doesn't fork one. Shares the 5-second purpose test.
  - **S-41 desktop-calm-workbench**: context-rail copy (≤3 blocks) for authed + guest (sign-in value prop, activation/merge hint, empty-state guidance).
  - **S-42 mindful-day-memory**: Polish narrative section labels **Domknięte / Zostaje / Wróć tutaj** (done/remains/return-to) + narrative sentence templates EN + PL — maps directly onto F-14 Phase 2's closure-language acceptance.
- **PRD voice rules**: one-line rationale + override freedom (`prd.md:50`); US-03 = "light narrative footprint only" (`prd.md:195`); tone "calm, not punitive; no streak shaming" (`prd.md:268`); guest narrative shortened vs full post-merge (`prd.md:145,165`).
- **Transition-beat budget**: at most one interstitial line + one gate per beat (`user-flow.md:256`, `prd.md:79`). Note: `context/foundation/user-flow.md` is itself authored **in Polish** — precedent that PL is already a first-class authoring language in this repo.

### i18n approach recommendation

**Recommendation: adopt `next-intl`** (checked: 2026-06-27) for Phase 1.

Why it fits FlowState:

- **App-Router-native, works without locale routing.** next-intl supports a single-domain setup where the locale is stored in a **cookie** (no `/en` `/pl` URL segments) — appropriate here since there's no SEO/multi-domain requirement and the app is one authenticated surface.
- **ICU MessageFormat** → correct **Polish plural categories** (one/few/many/other) and `select` for gender/variant — directly replaces the manual `=== 1 ? …` ternaries that would be wrong in Polish.
- **First-class in client components** via `NextIntlClientProvider` + `useTranslations` — essential given ~42 `"use client"` components. Messages can be scoped per subtree to limit client bundle.
- **Type-safe message keys** (autocomplete + compile-time typo checks) — aligns with the repo's strict-typed, Biome-gated conventions and preserves the "copy as contract" property the co-located copy tests already enforce.
- **Locale-aware date/number formatting** — replaces the hardcoded `en-GB` in `daily-recap-panel.tsx`.

Alternative considered — **lightweight typed dictionary** (`messages/en.ts` + `messages/pl.ts` with a tiny `t()` helper): minimal deps and full control, and the existing centralized copy modules make it tempting. Rejected as the primary path because it forces **hand-rolling Polish plural rules** and interpolation/formatting that ICU gives for free, and would re-implement a worse version of what next-intl provides. Keep it as a fallback only if the team wants zero new runtime deps.

Suggested Phase 1 shape (for the planner, not prescriptive):

1. Add `next-intl`; wrap `RootLayout` with `NextIntlClientProvider`; set `<html lang>` from the active locale.
2. Establish `messages/en.json` + `messages/pl.json` with a namespace per copy zone (suggestion, recap, transitions, onboarding, auth, errors, …).
3. Cookie-based locale + default policy; add `UserPreference.language` for authed users; mirror scoped-localStorage for guests; optional `Accept-Language` default in `proxy.ts`.
4. Migrate the ~18 `src/lib/**` copy modules first (lowest risk, test-backed), then component inline literals + aria/placeholders, then `use-pomodoro-cycle.ts` errors and auth/Zod messages. **Preserve EN wording exactly** (per `F-14.md:19`); PL is added as the second catalog.
5. Revisit length budgets / DB `VarChar` caps for Polish.

> Phase 1 introduces the infrastructure and the EN catalog (migration). Phase 2 authors `product-voice.md` and the **target PL wording** — keeping the two tracks separate per F-14's mandate. The PL catalog keys can exist in Phase 1 (possibly EN-fallback placeholders) but target PL copy decisions belong to Phase 2.

## Code References

- `src/app/layout.tsx:44-49` — hardcoded `<html lang="en">`; metadata EN at `:15-19`.
- `next.config.js:8` — empty config (no i18n).
- `proxy.ts:14-35` — auth middleware, no locale handling.
- `prisma/schema.prisma:177-183` — `UserPreference` (only `cycleEndAudioMode`); add `language` here.
- `src/app/_components/daily-recap-panel.tsx:33` — hardcoded `en-GB` time locale.
- `src/lib/session/transition-copy.ts:5-18` — energy-keyed transition copy (positive voice exemplar).
- `src/lib/scoring/rationale.ts:23-55` — 14 calm rationale strings.
- `src/lib/session/narrative-builder.ts:53-145` — closure/handoff composition + 120-char budget.
- `src/lib/onboarding/copy.ts:9-80` — onboarding/coach/auth value copy + `{preset}` interpolation.
- `src/lib/guest/merge-copy.ts:61,65,73-76` — manual count pluralization.
- `src/lib/session/narrative-builder.ts:54,59` & `src/lib/utils/format-ended-ago.ts:17,21` — more manual plurals.
- `src/hooks/use-pomodoro-cycle.ts` — ~30 inline user-facing error/recovery strings.
- `src/app/auth/sign-up/schema.ts:6-17`, `src/app/auth/reset-password/schema.ts:10` — Zod validation messages.
- `PRODUCT.md:9-33` — promise, personality, anti-references, principles.
- `DESIGN.md:2-3,109` — Serene Pastel / Calm Garden identity.
- `context/foundation/roadmap-references/items/F-14.md:5-32` — slice definition (two phases).
- `context/foundation/user-flow.md:256` — one-interstitial-line + one-gate budget (PL-authored doc).

## Architecture Insights

- **Copy-as-contract is already a repo convention.** Centralized `*-copy.ts` modules with co-located tests mean i18n should preserve that test-backed contract; the migration's "no wording change" rule is mechanically checkable against existing copy tests.
- **Client-dominant app** shifts the i18n design toward client-provider + scoped messages rather than RSC-only patterns.
- **Decoupling label from data** is a recurring migration hazard (`work-type-config.ts`, `persona-presets.ts` mix display strings with behavior/config).
- **Polish is a long-text, multi-plural language** colliding with existing 120-char/`VarChar` budgets and manual `=== 1` ternaries — the strongest technical risk in Phase 1.
- **The voice already exists implicitly**; Phase 2's job is to make it explicit (vocabulary list, copy zones, examples/non-examples) and bilingual, plus an acceptance checklist future slices cite — turning a de-facto style into an enforceable contract.

## Historical Context (from prior changes)

- `context/changes/roadmap-ux-ui-story-expand/` — F-14's origin (expand batch 7, score 9.6); recommends F-14 as first `/10x-plan` target. See `batch-7-ux-ui-story-chapter.md` (PL example strings at lines 190-193: header "Spokojna odpowiedź na: co teraz?", suggestion/recap templates), `parked-comparison.md:21-23`.
- `context/archive/2026-06-21-mindful-transition-copy/` (S-21) — shipped the energy-keyed transition copy library; locked guest-neutral re-entry; recommended a central tone contract (F-14's home).
- `context/archive/2026-06-12-session-narrative-summary/` (S-17) — in-flow summary strip + closure overlay; reaffirmed the one-interstitial-line + one-gate rule.
- `context/archive/2026-06-08-mindful-session-wind-down/` (S-16) — wind-down prompt; "don't duplicate preachiness" constraint.
- `context/archive/2026-06-12-serene-pastel-rebrand/` (F-06) — copy explicitly out of scope; F-14 owns first verbal-voice decisions.

## Related Research

- `context/changes/roadmap-ux-ui-story-expand/research.md` — feasibility + roadmap-patch locations for the UX/UI story chapter that introduced F-14.

## Open Questions

1. **Locale defaulting policy** — default to EN, or detect via `Accept-Language` (then fall back to EN)? Where does the language switch live (user menu vs settings)? Owner: implementer/user. (Non-blocking per `F-14.md:28`.)
2. **next-intl vs lightweight dictionary** — recommendation is next-intl; confirm the team accepts a new runtime dependency vs hand-rolled dictionary. Owner: implementer during plan. (Non-blocking per `F-14.md:29`.)
3. **Phase split for PL wording** — Phase 1 creates the PL catalog structure with EN-fallback placeholders; Phase 2 fills target PL copy. Confirm this boundary so no target wording is "smuggled" into Phase 1 (`F-14.md:19`).
4. **Length budgets for Polish** — do we relax the 120-char closure cap and `VarChar` limits, or constrain PL copy to fit? Affects `narrative-builder.ts` and `schema.prisma`.
5. **Label/data decoupling scope** — how far to refactor `work-type-config.ts` / `persona-presets.ts` to separate translatable labels from scoring/config in Phase 1.
