> Detail reference — load on demand. Index: [roadmap.md](../roadmap.md).  
> **Source:** `context/foundation/user-flow.md` (2026-06-13) + code review + logic review.  
> **Do not duplicate** into `roadmap.md` — glance rows + this file only.

# Flow coherence — rekomendacje roadmapy

Poprawki flow aplikacji: spokojne zamknięcie sesji, jeden gate na beat, sensowny powrót po timeout. Guardrail PRD: *at most one interstitial line plus one gate per transition beat*.

## Priorytety (P0–P3)

| P | ID | Pewność usprawnienia flow | Effort | Risk if NOT done |
|---|-----|---------------------------|--------|------------------|
| P0 | B-05 | 92% | S | High |
| P0 | F-07 | 88% | L | High |
| P1 | B-06 | 85% | S | Medium |
| P1 | B-07 | 78% | S | Medium |
| P2 | B-08 | 72% (minimal) / 80% (z S-24) | S/M | Medium |
| P2 | S-11 ext. | 80% | S | Medium |
| P2 | S-21 | 74% | M | Low |
| P2 | S-33 | 68% | M | Low |
| P3 | S-24 | 76% | L | Medium |
| P3 | S-34 + S-35 | 65% | M–L | Low |

## Stream N′ — Flow Conductor (sekwencja ship)

| Faza | Pozycje | Cel |
|------|---------|-----|
| 1 — Hotfix calm closure | B-05 → B-06 | T-01 + T-03 natychmiast |
| 2 — Foundation | F-07 (+ B-07 w tej samej gałęzi) | Orchestrator + wind-down threshold |
| 3 — Mindful beats | S-21 ∥ S-33 | FR-041 + atmosfera przerwy |
| 4 — Onboarding bridge | S-11 ext. post-merge coach | T-05 |
| 5 — Control | S-24 → B-08 (pełny) | FR-042 + graceful end |
| 6 — Perf/trust | S-34 + S-35 | Po stabilnym conductorze |

**Parallel z S-29:** fazy 1–2 tak (osobne pliki); faza 3+ po merge F-07 do main.  
**Nie w jednym PR:** F-07 refactor + S-34 optimistic (wzmacnia race T-01).

## Mapowanie konfliktów user-flow → roadmap

| Konflikt | Opis | Roadmap fix |
|----------|------|-------------|
| T-01 | Closure (z=58) przykryte przez kickoff/check-in (z=60); race async po `endSession()` | B-05 → F-07 |
| T-02 | Cycle complete flash po check-in | B-04 done; regresja w F-07 e2e |
| T-03 | Timeout closure dopiero przy starcie cyklu, nie on load | B-06 |
| T-04 | End session disabled gdy timer running | B-08; pełny po S-24 |
| T-05 | Guest→auth shock (gęstość gate'ów) | S-11 ext. (nie nowy slice) |
| T-06 | Return handoff (≥8h) równoległy z kickoff readiness | F-07 (pol-10); kickoff dopiero po dismiss handoff |

## F-07 expand vs bug split

| Expand F-07 | Split jako bugi (ship wcześniej) |
|-------------|----------------------------------|
| Centralny conductor, macierz priorytetów, OQ2, e2e parity | B-05 closure mutex + async race |
| Integracja S-17/S-16/S-22/S-25 gate'ów | B-06 timeout closure on load |
| Session lifecycle gates (closure, timeout, kickoff) | B-07 wind-down cycle threshold |
| | B-08 graceful end while running (minimal bez S-24) |

Copy (S-21), wizualia break (S-33), pause DB (S-24), optimistic UI (S-34) — **poza** F-07; tylko hooki w conductorze.

## Szczegóły pozycji

### B-05 — `fix-closure-kickoff-mutex` (P0, 92%)

**Problem:** T-01 — naruszenie guardrailu interstitial fatigue; FR-040 calm closure psute.

**Outcome:** user can dismiss session closure in peace — no energy popup on top or immediately after closure on the same visit.

**Scope:**
- Guard w `pomodoro-dashboard`: nie renderuj kickoff readiness / check-in gdy `pendingClosureLine` / closure visible
- Anulowanie / ignorowanie pending kickoff po `endSession()` (abort async race w kickoff effect)
- Closure w macierzy mutual exclusion (jak first-run, wind-down)
- Vitest + e2e: end session → idle bez reopen readiness

**Prerequisites:** — · **Parallel:** S-29 · **Ship before:** S-21, F-07 pełny refactor opcjonalnie po hotfixie

---

### F-07 — `wedge-transition-conductor` (P0, 88%)

**Problem:** brak centralnej reguły priorytetów; overlaye konkurują (T-01 systemowo, OQ2).

**Outcome:** (foundation) every transition shows at most one calm interstitial line and one blocking gate — coordinated priority, no stacking regressions.

**Scope:**
- Moduł/hook conductor'a: **return handoff (undismissed) > closure > wind-down > check-in > suggestion > kickoff readiness > narrative line**
- `kickoffEligible` wyklucza aktywny return handoff banner (pol-10) — nie tylko `pendingClosureLine` (B-05)
- Jedna macierz `isGateActive` zamiast rozproszonych warunków w dashboardzie
- Mapowanie gate'ów S-12, S-16, S-17, S-19, S-22, S-25, S-17 return handoff
- E2E belt parity: happy path + closure + wind-down + kickoff + **handoff → dismiss → kickoff**
- Rozstrzygnięcie OQ2 w planie

**Prerequisites:** B-05 (done), B-06 (active), S-12, S-19 (done) · **Blocks:** S-21, S-34, S-35, S-11 ext.

---

### B-06 — `fix-timeout-closure-on-load` (P1, 85%)

**Problem:** T-03 — `maybePresentTimeoutClosure` przy starcie cyklu; kickoff bez kontekstu wygasłej sesji.

**Outcome:** user sees timeout closure as first beat after return — before kickoff or task selection.

**Scope:**
- Timeout closure w initial session hydrate (`home-shell` / recovery), nie dopiero w `start()`
- Conductor priorytet: timeout closure przed kickoff eligibility
- Copy: explicit end vs timeout (S-17 unknown)
- E2E: inactivity → reload → closure → idle

**Prerequisites:** B-05 zalecany · **Parallel:** S-29

---

### B-07 — `fix-wind-down-cycle-threshold` (P1, 78%)

**Problem:** `completedWorkCycles` inkrementowane przed break — wind-down przy Fading + „≥3 cykle” realnie po 4. WORK; rozjazd z happy path popołudniowym.

**Outcome:** wind-down nudge when session fatigue matches product intent — after third completed work cycle with Fading, not one cycle late.

**Scope:**
- Ujednolicenie progu w `wind-down-nudge.ts` vs intencja produktowa
- Test jednostkowy: 3 cykle / 2 przerwania
- Aktualizacja rationale copy jeśli threshold się zmieni

**Prerequisites:** — · **Ship with:** F-07 faza 2 (wind-down w conductorze)

---

### B-08 — `fix-graceful-session-end-while-running` (P2, 72–80%)

**Problem:** T-04 — „End session” disabled during running.

**Outcome:** user can end session calmly while a cycle is running — without waiting full cycle or raw interrupt.

**Scope minimal:** confirm → interrupt path → closure (bez break).  
**Scope full:** „Pause & end session” → **B-09** (after B-08 minimal).  
**Closure expectations:** mid-cycle end copy → **S-38** (OQ #7; may fold thin copy into B-08).

**Prerequisites:** F-07 (guard); S-24 dla wariantu pełnego · **Effort:** S minimal / M full (B-09)

---

### S-11 ext. — post-merge wedge coach (P2, 80%) — **active extension**

**Problem:** T-05 / event storming hot-1 — gość bez wedge stacku; po merge gęstość gate'ów bez mostu.

**Outcome:** user understands why check-in and suggestion appear after signup merge — inline subcopy on first authenticated check-in and first suggestion only (no new overlay).

**Scope:** flag `hasSeenAuthenticatedWedge`; subcopy w CheckInOverlay + TaskSuggestionCard; extend S-11 / S-14 acceptance — **not** a new slice. Promoted P-GAP-102 / P-106 from parked (event storming 2026-06-18).

**Prerequisites:** S-08, S-11 (done); **F-07** (stable gate ordering) · **Parallel:** S-32 · **Ship:** Stream N′ Phase 4

---

### S-21, S-33, S-24, S-34+S-35

Bez zmian outcome w glance — **sequencing + S-24 scope update (event storming):**

- **S-21:** blocked until F-07 merge; 74% confidence without conductor drops (stacking risk)
- **S-33:** pair with S-21; po F-07
- **S-24:** P3; **pol-12** suppress wedge gates while PAUSED; **pol-8** ~30 min cap → calm closure; hybrid PAUSED schema; enables B-08 full
- **S-34 + S-35:** bundle; revise until F-07 complete; 65% — perf/trust, not T-01 fix

## Odrzuć / odłożyć

| Propozycja | Powód |
|------------|-------|
| S-34/35 przed F-07 | Wzmacnia race kickoff/closure |
| Osobny slice post-merge coach | Wystarczy S-11 ext. |
| Trzeci completion moment (P-207) | Duplikat S-13 + S-17 |
| Guest wedge (check-in dla gościa) | FR-003b świadomie węższy |
| S-24 bez OQ3 | Pause vs 4h timeout nierozstrzygnięte |
| Promote S-34 przed F-07 | Roadmap revise — scope races |

## Pliki implementacyjne (orientacyjnie)

- `src/app/_components/pomodoro-dashboard.tsx` — render guards
- `src/hooks/use-pomodoro-cycle.ts` — kickoff effect race, endSession, timeout closure
- `src/app/_components/home-shell.tsx` — hydrate timeout closure
- `src/lib/session/wind-down-nudge.ts` — B-07 threshold
- `context/foundation/user-flow.md` — mapa flow + T-01–T-05
