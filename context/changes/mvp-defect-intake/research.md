---
date: 2026-07-04T12:13:00+02:00
researcher: Cursor Agent
git_commit: 021c4e027aeae498af46395a64b82615b3c99306
branch: features/mvp-defect-intake
repository: FlowState
topic: "Jak rozwiązać znalezione błędy z rejestru mvp-defect-intake (D-01…D-11)"
tags: [research, codebase, mvp-defect-intake, task-ui, layout, i18n, illustrations]
status: complete
last_updated: 2026-07-04
last_updated_by: Cursor Agent
---

# Research: Jak rozwiązać znalezione błędy z rejestru mvp-defect-intake

**Date**: 2026-07-04T12:13:00+02:00  
**Researcher**: Cursor Agent  
**Git Commit**: `021c4e027aeae498af46395a64b82615b3c99306`  
**Branch**: `features/mvp-defect-intake`  
**Repository**: [konrad-kaluzny-ceneo/FlowState](https://github.com/konrad-kaluzny-ceneo/FlowState)

## Research Question

Sprawdź jak rozwiązać znalezione błędy z rejestru `mvp-defect-intake` (D-01…D-11) — ścieżki kodu, podejścia do naprawy, zależności między falami poprawek.

## Summary

Z 11 usterek **wave 2 (D-01, D-06, D-07) jest już zaimplementowana** w change `fix-home-layout-spacing` (wszystkie 4 fazy planu oznaczone `[x]`, commit na `main` = `021c4e0`). Pozostałe usterki wymagają **4 osobnych change'ów** zgodnie z tabelą „Fix waves” w `change.md`:

| Wave | Change-id | Defekty | Status na `021c4e0` |
| --- | --- | --- | --- |
| 1 | `task-ui-quick-fixes` | D-02, D-03, D-05, D-11 | **Do zrobienia** — potwierdzone w kodzie |
| 2 | `fix-home-layout-spacing` | D-01, D-06, D-07 | **Zrobione** |
| repro | sesja przeglądarkowa | D-08, D-09 | **Przed wave 3** |
| 3 | `task-edit-interaction-fixes` | D-08, D-09 | Zależne od repro |
| 4 | `status-vocabulary-unification` | D-10 | Do zrobienia (kontrakt + i18n) |
| 5 | `illustration-visibility` | D-04 | Do zrobienia po wave 2 (layout już stabilny) |

**Rekomendowana kolejność dalszej pracy:** wave 1 (szybkie, niezależne) → repro D-08/D-09 → wave 3 → wave 4 ∥ wave 5.

---

## Detailed Findings

### Wave 1 — `task-ui-quick-fixes` (D-02, D-03, D-05, D-11)

#### D-02: Usunąć baner presetów

**Przyczyna:** Baner edukacyjny renderowany w `PersonaPresetPicker` gdy `shouldShowPresetCoach` jest true.

| Plik | Linie | Rola |
| --- | --- | --- |
| [persona-preset-picker.tsx](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/021c4e027aeae498af46395a64b82615b3c99306/src/app/_components/persona-preset-picker.tsx#L104-L121) | 104–121 | Baner `preset-coach` + przycisk „Rozumiem" |
| [task-list.tsx](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/021c4e027aeae498af46395a64b82615b3c99306/src/app/_components/task-list.tsx#L572-L573) | 572–573 | Hook `usePresetCoachOnboarding` |
| [task-list.tsx](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/021c4e027aeae498af46395a64b82615b3c99306/src/app/_components/task-list.tsx#L939-L944) | 939–944 | Przekazanie `coachLine` / `onDismissCoach` |
| [messages/pl.json](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/021c4e027aeae498af46395a64b82615b3c99306/messages/pl.json#L46) | 46 | Copy PL |

**Naprawa:** Usunąć props banera z `PersonaPresetPicker` i wywołania w `task-list.tsx`. Opcjonalnie wyczyścić `getPresetCoachLine`, klucz `Onboarding.coach.preset`, helper e2e `dismissPresetCoachIfVisible`.

**Testy:** `task-list.test.tsx:517-528` (usunąć), `e2e/helpers/onboarding.ts`, `e2e/helpers/work-cycle.ts`.

**Ryzyko:** Niskie — czysto edukacyjny UI.

---

#### D-03: „Uwzględnij w Daily" domyślnie zaznaczone

**Przyczyna:** Domyślna wartość `false` w stanie formularza tworzenia.

| Plik | Linie | Wartość |
| --- | --- | --- |
| [task-list.tsx](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/021c4e027aeae498af46395a64b82615b3c99306/src/app/_components/task-list.tsx#L608) | 608 | `useState(false)` |
| [task-list.tsx](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/021c4e027aeae498af46395a64b82615b3c99306/src/app/_components/task-list.tsx#L619) | 619 | `resetCreateFormState()` → `false` |

**Naprawa:** Zmienić oba miejsca na `true`. Tryb edycji (`editIsDailyStanding`) — bez zmian.

**Testy:** `task-list.test.tsx:687-690` — oczekiwanie `.toBe(true)`. E2E `uncheckDailyStandingDefault` nadal działa.

**Ryzyko:** Niskie — tylko domyślny stan UI tworzenia; DB default pozostaje `false`.

---

#### D-05: Duplicate HTML `id` na checkboxie Daily

**Przyczyna:** `StyledCheckbox` używa `data-testid` jako fallback `id`; composer i panel edycji współdzielą `data-testid="daily-standing-toggle"`.

| Plik | Linie | Problem |
| --- | --- | --- |
| [styled-checkbox.tsx](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/021c4e027aeae498af46395a64b82615b3c99306/src/app/_components/styled-checkbox.tsx#L22) | 22 | `const inputId = id ?? dataTestId` |
| [task-fields-panel.tsx](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/021c4e027aeae498af46395a64b82615b3c99306/src/app/_components/task-fields-panel.tsx#L260-L265) | 260–265 | Brak unikalnego `id` |
| [task-list.tsx](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/021c4e027aeae498af46395a64b82615b3c99306/src/app/_components/task-list.tsx#L911-L917) | 911–917 | Create form (zawsze zamontowany) |
| [task-list.tsx](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/021c4e027aeae498af46395a64b82615b3c99306/src/app/_components/task-list.tsx#L416-L421) | 416–421 | Edit panel (aktywne taski) |

**Naprawa (warstwowa):**

1. **Wymagane:** `useId()` w `StyledCheckbox` — `id` nigdy nie pochodzi z `data-testid`.
2. **Zalecane:** Unikalne `id` per instancja (wzór: `task-resume-note-edit-${task.id}`).
3. **E2E:** Scope do `task-fields-panel-create` w `work-cycle.ts:64`.

**Testy:** Nowy `styled-checkbox.test.tsx`; zaktualizować `task-list.test.tsx`, `task-fields-panel.test.tsx`.

**Ryzyko:** Średnie — Playwright strict mode przy 2 elementach z tym samym testid podczas edycji.

---

#### D-11: Nieprzetłumaczony label BreakAlerts

**Przyczyna:** Hardcode EN w komponencie; brak klucza w messages.

| Plik | Linie | Problem |
| --- | --- | --- |
| [out-of-tab-break-alerts-control.tsx](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/021c4e027aeae498af46395a64b82615b3c99306/src/app/_components/out-of-tab-break-alerts-control.tsx#L46) | 46 | Hardcoded EN label |
| [out-of-tab-break-alerts-control.tsx](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/021c4e027aeae498af46395a64b82615b3c99306/src/app/_components/out-of-tab-break-alerts-control.tsx#L52-L68) | 52–68 | Pozostałe stringi też EN |
| [messages/pl.json](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/021c4e027aeae498af46395a64b82615b3c99306/messages/pl.json#L536-L541) | 536–541 | Namespace `BreakAlerts` bez klucza toggle |

**Naprawa:** Dodać klucze (`settingsToggleLabel`, hinty) w `en.json` + `pl.json`; `useTranslations("BreakAlerts")` w komponencie (wzór: `break-alerts-permission-prompt.tsx:23`).

**Testy:** `out-of-tab-break-alerts-control.test.tsx` — wrap w `IntlTestWrapper`.

**Kolejność w wave 1:** D-05 → D-03 → D-11 → D-02.

---

### Wave 2 — `fix-home-layout-spacing` (D-01, D-06, D-07) — **DONE**

Zaimplementowane na `021c4e0`. Plan: [fix-home-layout-spacing/plan.md](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/021c4e027aeae498af46395a64b82615b3c99306/context/changes/fix-home-layout-spacing/plan.md) — wszystkie fazy `[x]`.

| Defekt | Co zostało zrobione | Kluczowe pliki |
| --- | --- | --- |
| **D-06** Navbar z logo → `/` na wszystkich stronach | `AppNavbar` w root layout, auth pages `flex-1` | [layout.tsx](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/021c4e027aeae498af46395a64b82615b3c99306/src/app/layout.tsx), [app-navbar.tsx](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/021c4e027aeae498af46395a64b82615b3c99306/src/app/_components/app-navbar.tsx) |
| **D-07** Usunięcie hero | `h1.sr-only` zamiast widocznego hero | [home-shell.tsx](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/021c4e027aeae498af46395a64b82615b3c99306/src/app/_components/home-shell.tsx) |
| **D-01** Kontrakt kompozycji | Token `--spacing-section`, warunkowe regiony, zone-owned widths | [globals.css](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/021c4e027aeae498af46395a64b82615b3c99306/src/styles/globals.css#L10), [pomodoro-dashboard.tsx](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/021c4e027aeae498af46395a64b82615b3c99306/src/app/_components/pomodoro-dashboard.tsx) |

**Pozostałe follow-upy z impl-review (nie blokują zamknięcia wave 2):**

- Guest-home geometry oracle w `layout-rhythm.spec.ts`
- Martwy klucz `purposeHeader` w `home-session-state.ts`
- Pokrycie testami pełnej macierzy stanów regionów

---

### D-08 + D-09 — wymagają reprodukcji przed wave 3

#### D-08: „Gdy się da" nieklikalne

**Wiring statycznie poprawny** — wszystkie 3 wartości horizon w `task-fields-panel.tsx:10-14, 88-96, 148-159`; brak `disabled`.

| Hipoteza | Werdykt | Proponowana naprawa |
| --- | --- | --- |
| `overflow-hidden` na wierszu taska (`task-list.tsx:338`) | Plausible — długi label może być przycięty | Usunąć `overflow-hidden` w trybie edycji |
| Blur-save przed click (`task-list.tsx:407-411`) | Częściowo odrzucona (S-04 fix), ale Safari `relatedTarget=null` | Defer commit na blur; test horizon click |
| Słaby active-state WHEN_POSSIBLE (`task-fields-panel.tsx:149-153`) | Potwierdzona — `bg-surface-panel` ≈ inactive | Distinct active color jak ASAP/THIS_WEEK |
| Domyślnie już WHEN_POSSIBLE (`types.ts:20`) | UX — klik „nic nie robi" | Rozróżnić w repro |

**Repro checklist:** inline edit z ASAP → click „Gdy się da"; create custom panel; ~320px viewport; Safari iOS.

---

#### D-09: Nazwa presetu na utworzonym tasku

**Potwierdzona przyczyna post-edit:** `getTaskBadgeDisplayMode` w [persona-presets.ts](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/021c4e027aeae498af46395a64b82615b3c99306/src/lib/task/persona-presets.ts#L176-L198) zwraca `"custom-detail"` (plakietka „Własny") gdy atrybuty ≠ preset bundle (z `ignoreEffort: true`). To było **zamierzone w S-36**, koliduje z decyzją D-09.

**Dodatkowy bug (guest):** `use-task-mutations.ts:496-506` nie przekazuje `personaPresetId` przy tworzeniu w trybie gościa.

**Proponowana naprawa wave 3:**

1. Zrewidować oracle — `"persona"` gdy `personaPresetId` jest valid catalog id, niezależnie od divergence atrybutów (lub preset label + Eisenhower detail).
2. Guest parity — forward `personaPresetId` w guest create.
3. Test: create firefight → edit urgency → nadal „Gaszenie".

---

### Wave 4 — `status-vocabulary-unification` (D-10)

**Decyzja:** Jedna terminologia w całej aplikacji — `Ukończone` / `Aktywne` / `Zarchiwizowane`.

| Plik / klucz | Obecna wartość | Docelowa |
| --- | --- | --- |
| `product-voice.md:133-147` | Strefowane słownictwo S-42 | Poprawka kontraktu |
| `DayMemory.sectionDone` (pl.json:332) | Domknięte | Ukończone |
| `DayMemory.sectionRemains` (:333) | Zostaje | Aktywne |
| `DayMemory.collapsedLine` (:335) | Zrobione:… | Ukończone:… |
| `DayMemory.remainingCount` (:338) | otwarte/otwartych | aktywne/aktywnych |
| `Recap.todayDoneTag` (:381) | Zrobione dziś | Ukończone dziś |
| `HomeFocusSummary.standingOpen/Done` | otwarte/domknięte | aktywne/ukończone |
| `Recap.markedDone`, `Session.narrative.taskDone` | zrobione | ukończone |

**Runtime:** i18n-driven — `narrative-copy.ts`, `format-day-memory.ts`, `day-memory-line.tsx`, `daily-recap-panel.tsx`, `home-focus-summary.tsx`.

**Testy:** `acceptance-copy.test.ts:68-84`, `format-day-memory.test.ts` (exact-string assertions).

**Zależność:** Po stabilizacji UI wave 2; niezależna od wave 3/5.

---

### Wave 5 — `illustration-visibility` (D-04)

Ilustracje są podłączone (inline SVG), ale **niewidoczne przez warstwowe subtelności** — nie brak plików.

| Warstwa | Plik | Parametry do rewizji |
| --- | --- | --- |
| Rozmiar rail | `home-hero-sprig.tsx:20` | `h-12 w-20`, `opacity-90`, `scale-90` |
| Navbar mark | `app-navbar.tsx:33` | `h-6 w-6` (24px) |
| Blob fills | `calm-garden-blob.tsx:38-54` | opacity 0.55/0.7/0.12 |
| Sprig stroke | `calm-garden-sprig.tsx:34` | `strokeWidth="1.5"` |
| CSS tokens | `globals.css:188-236` | `--color-energy-*-bg` ~8–12% alpha |

**Powierzchnie po D-07:** navbar (static), desktop rail (`pomodoro-dashboard.tsx:891-896`), empty-tasks guide. Hero usunięty.

**Opcjonalnie:** S-28 faza 2 scrimy na `overlay-shell.tsx` — nowa praca, nie param tweak.

**Zależność:** Strictly po wave 2 (layout stabilny).

---

## Code References

- `src/app/_components/styled-checkbox.tsx:22` — root cause D-05 (id fallback)
- `src/app/_components/task-list.tsx:608,619` — root cause D-03 (default false)
- `src/app/_components/persona-preset-picker.tsx:104-121` — D-02 baner
- `src/app/_components/out-of-tab-break-alerts-control.tsx:46` — D-11 hardcode EN
- `src/lib/task/persona-presets.ts:176-198` — D-09 badge oracle
- `src/app/_components/task-fields-panel.tsx:149-153` — D-08 weak WHEN_POSSIBLE styling
- `src/styles/globals.css:10` — D-01 spacing token (wired)
- `src/app/_components/app-navbar.tsx` — D-06 navbar (done)
- `messages/pl.json:332-338,381` — D-10 klucze do zmiany

## Architecture Insights

1. **Fale poprawek, nie monolit** — rejestr już grupuje usterki; wave 2 jako jeden change był słuszny (D-01+D-06+D-07 sprzężone).
2. **Klasa bugów StyledCheckbox** — `id = data-testid` to systemowy antywzorzec; naprawa klasy + audyt wszystkich użyć (tylko 2 call sites dziś).
3. **Badge preset vs atrybuty** — logika S-36 (divergence → „Własny") koliduje z nową decyzją produktową D-09; wymaga świadomej rewizji oracle, nie patcha w UI.
4. **Testy strukturalne nie łapią regresji wizualnych** — D-01/D-04 wymagają geometry oracle (Playwright) lub parametrów design tokenów; jsdom niewystarczający (potwierdzone w S-41 archive).
5. **Guest vs auth parity** — D-09 ujawnia lukę w guest create (`personaPresetId` dropped).

## Historical Context (from prior changes)

- [fix-home-layout-spacing/frame.md](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/021c4e027aeae498af46395a64b82615b3c99306/context/changes/fix-home-layout-spacing/frame.md) — 3 hipotezy STRONG dla D-01
- [fix-home-layout-spacing/research.md](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/021c4e027aeae498af46395a64b82615b3c99306/context/changes/fix-home-layout-spacing/research.md) — pre-fix line refs
- `context/archive/2026-06-12-fix-task-edit-blur-save/` — wzorzec blur-save dla D-08
- `context/archive/2026-06-14-persona-presets-v2/` — reguła preset→Własny (D-09)
- `context/archive/2026-06-29-desktop-calm-workbench/research.md` — brak geometry testów
- `context/archive/2026-06-30-mindful-day-memory/` — S-42 strefowane słownictwo (D-10 do unieważnienia)

## Related Research

- `context/changes/fix-home-layout-spacing/research.md` — szczegóły D-01/D-06/D-07 (pre/post fix)
- `context/changes/mvp-defect-intake/change.md` — rejestr i fix waves

## Open Questions

1. **D-08:** Która hipoteza potwierdza się w przeglądarce? (overflow vs blur vs UX-only)
2. **D-09:** Czy użytkownik widział brak plakietki od razu po create (guest?) czy dopiero po edycji?
3. **D-10:** Czy secondary keys (`HomeFocusSummary`, `Session.narrative`) wchodzą w wave 4, czy osobny follow-up?
4. **D-04:** Docelowe wymiary hero/rail/navbar — czy DESIGN.md wymaga aktualizacji tokenów przed implementacją?

## Recommended Next Steps

| Krok | Akcja |
| --- | --- |
| 1 | `/10x-new task-ui-quick-fixes` → `/10x-plan` (wave 1; research opcjonalny — ścieżki znane) |
| 2 | Sesja repro D-08/D-09 w przeglądarce (checklist powyżej) |
| 3 | `/10x-new task-edit-interaction-fixes` po repro |
| 4 | `/10x-new status-vocabulary-unification` (wave 4) |
| 5 | `/10x-new illustration-visibility` (wave 5) |
| 6 | Zamknąć `mvp-defect-intake` po rozdysponowaniu wszystkich wave'ów do osobnych change'ów |
