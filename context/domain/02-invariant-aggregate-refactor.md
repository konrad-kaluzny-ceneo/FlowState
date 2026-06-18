---
title: "FlowState — niezmiennik beat-mutex i agregat WedgeTransitionBeat"
created: 2026-06-17
type: refactor-plan
---

# Niezmiennik beat-mutex → agregat strażnika (KROK 0–5)

Plan refaktoru domenowego — **bez zmian w kodzie produkcyjnym**. Niezmiennik i agregat **odkryte** z dokumentów i kodu, nie założone z góry. Walidacja: sub-agenci explore (kontekst, invariants w kodzie, klasyfikacja, diagnoza T-01, projekt agregatu) + ręczna weryfikacja cytatów.

**Wybrany niezmiennik #1:** Na każdym przejściu między fazami cyklu (transition beat) widoczna jest **co najwyżej jedna** spokojna linia interstitial **plus** **jeden** blokujący gate.

---

## KROK 0 — Kontekst projektu

### Dokumenty źródłowe

| Dokument | Rola |
|----------|------|
| `context/foundation/prd.md` | US-01 Primary success, guardrails, business logic changes |
| `context/foundation/user-flow.md` | Macierz overlayów, tarcia T-01–T-05 |
| `context/foundation/roadmap-references/flow-coherence-recommendations.md` | Stream N′: B-05 → B-06 → F-07 |
| `context/foundation/test-plan.md` | Ryzyko #8, faza 8 rollout |
| `context/foundation/tech-stack.md` | Warstwy stacku (Next.js 16, tRPC, Prisma) |
| `context/domain/01-domain-distillation.md` | Wcześniejsza destylacja; wskazuje beat-mutex jako priorytet |

### Wizja i sens produktu

> A logged-in user completes a multi-cycle session where wedge transitions (check-in → suggestion → break confirm → optional wind-down) flow without interstitial fatigue — at most one interstitial line plus one gate per transition beat, orchestrated by the transition conductor.  
> — `context/foundation/prd.md:49`

> FlowState ma prowadzić wiedzowego pracownika przez **świadome przejścia** między cyklami pracy — nie maksymalizować throughput.  
> — `context/foundation/user-flow.md:16`

### Warstwy, w których żyje logika biznesowa

| Warstwa | Lokalizacja | Rola względem beat-mutex |
|---------|-------------|--------------------------|
| UI / prezentacja | `src/app/_components/pomodoro-dashboard.tsx`, overlaye (`*-overlay.tsx`) | **Jedyny strażnik dziś** — rozproszone warunki `&&` |
| Orkiestracja klienta | `src/hooks/use-pomodoro-cycle.ts` | ~40 flag `useState`, efekty async (kickoff race) |
| Logika czysta (wzorce) | `src/lib/catch-up/derive-gate.ts`, `src/lib/session/wind-down-nudge.ts` | Mutex częściowy (catch-up, wind-down) |
| API / serwisy | `src/server/api/routers/*.ts` | Persystencja sesji/cyklu — **nie** egzekwuje beat-mutex |
| Persystencja | `prisma/schema.prisma` | Brak modelu „beat” |

**Luka architektoniczna:** `stack-assessment.md` i roadmap F-07 — brak centralnego **transition conductor**; logika rozproszona między hookiem (~2100+ LOC) a dashboardem.

---

## KROK 1 — Niezmienniki biznesowe

Reguły, które w tej domenie **muszą** być zawsze prawdziwe. Źródło: dokument **lub** kod (cytat).

| ID | Niezmiennik | Źródło |
|----|-------------|--------|
| **I-01** | Na transition beat: ≤1 linia interstitial + ≤1 gate blokujący | `prd.md:62`, `:69–73`, `:149`; `user-flow.md:247` |
| **I-02** | Zalogowany użytkownik: mindful check-in przed przejściem do następnego bloku WORK po ukończeniu WORK | `prd.md:122`; `use-pomodoro-cycle.ts:1924–1935` (guest bypass) |
| **I-03** | Co najwyżej jeden cykl w stanie `RUNNING` na użytkownika | `cycle.ts:116–125`; `guest-repositories.ts:376–380` |
| **I-04** | Co najwyżej jedna sesja `ACTIVE` na użytkownika (auth) | `migration.sql:90–93`; `session.ts:27–29` |
| **I-05** | Przerwanie timera (`interrupt`) ≠ inkrementacja `interruptionCount`; przełączenie zadania w trakcie WORK = przerwanie sesji | `cycle.ts:297–327` vs `:288`; `use-pomodoro-cycle.ts:2067–2068` |
| **I-06** | Dane użytkownika nie giną pośrednio (refresh, crash, guest merge) | `prd.md:60`, `:121` |
| **I-07** | Skonfigurowany cykl Pomodoro nie dryfuje > ±2 s | `prd.md:61`; `countdown-tolerance.ts:31–39` (test oracle) |
| **I-08** | Sugestia `post_check_in` wymaga zapisanego check-in dla cyklu | `suggestion.ts:142–146`; `schema.prisma:135` (`cycleId @unique`) |
| **I-09** | Gość: węższy trial — bez pełnego stosu wedge (check-in, kickoff, wind-down) | `prd.md:57`, `:135`; `pomodoro-dashboard.tsx:485–515` |
| **I-10** | Sesja auth wygasa po 4 h nieaktywności | `active-session.ts:7`, `:25–35`; `user-flow.md:32` |
| **I-11** | Wind-down: energia `FADING` + (≥3 ukończone WORK **lub** ≥2 przerwania sesji), nie odrzucone w sesji | `wind-down-nudge.ts:13–18`; `use-pomodoro-cycle.ts:1977–1997` |
| **I-12** | Long break co 4. ukończony blok WORK | `use-pomodoro-cycle.ts:1588–1596`; `user-flow.md:127` |
| **I-13** | Start WORK wymaga wybranego zadania i stanu `idle` | `use-pomodoro-cycle.ts:1299–1308` |
| **I-14** | Handoff powrotny tylko po ≥8 h od `endedAt` ostatniej sesji | `narrative-builder.ts:10`, `:142–143` |
| **I-15** | Pause zawiesza timer bez liczenia jako interruption; cap ~30 min → spokojne zakończenie sesji | `prd.md:54`, `:104`, `:151` — **BRAK w kodzie** (`CycleState` bez `PAUSED`) |

---

## KROK 2 — Klasyfikacja i wybór #1

### Oś (a) — rdzeniowość dla sensu produktu

| ID | Ocena | Uzasadnienie |
|----|-------|--------------|
| **I-01** | **Najwyższa** | US-01 Primary success (`prd.md:49`); bez spokojnych przejść produkt = „kolejny timer z modalami” |
| I-02 | Wysoka | Rdzeń wedge, ale już egzekwowany w hooku |
| I-03, I-04 | Wysoka | Fundament timera/sesji — dobrze ograniczony w routerach |
| I-06 | Wysoka | Guardrail, ale częściowo wdrożony (merge, recovery) |
| I-07 | Średnia | NFR, nie definicja wedge |
| I-15 | Średnia | Planowany (S-24), jeszcze nie istnieje w kodzie |

### Oś (b) — rozsmarowanie po warstwach

| ID | Pliki / warstwy | Rozsmarowanie |
|----|-----------------|---------------|
| **I-01** | **~16 plików `src/`**, 4 warstwy (UI 9 overlayów + dashboard, hook 2, lib/catch-up 2, testy 3); **0 warstwa serwerowa** | **Maksymalne** |
| I-02 | ~9 plików, 3 warstwy | Wysokie |
| I-03 | 11 plików, 4 warstwy | Średnie — scentralizowane w `cycle.ts` |
| I-07 | 7 plików, głównie worker + testy | Niskie rozproszenie, brak runtime guard |

### Oś (c) — egzekwowanie

| Klasa | Invariants |
|-------|------------|
| **Naruszalny (aktywny bug)** | **I-01** — T-01: closure + kickoff readiness |
| Zadeklarowany tylko (docs/testy) | I-07 |
| Częściowo egzekwowany | I-06 |
| Egzekwowany | I-02, I-03, I-04, I-05, I-08, I-09, I-10 |

### Wybór: **I-01 — beat-mutex**

**Uzasadnienie:** Jednocześnie najbardziej rdzeniowy (Primary success US-01, guardrail `prd.md:62`) i najsłabiej egzekwowany — reguła jest **dokumentowana i częściowo imitowana** przez rozproszone `&&` w dashboardzie, ale **aktywnie naruszalna** (T-01). Roadmap już wskazuje B-05 → F-07 jako P0. Inne kandydaty (I-03, I-04) są dobrze ograniczone w agregatach serwerowych — słabszy ROI refaktoru. I-07 ma słabszą egzekucję runtime, ale niższą centralność produktową (NFR timera, nie „świadome przejścia”).

---

## KROK 3 — Diagnoza I-01

### Definicja operacyjna

**Transition beat** = moment graniczny między fazami cyklu (ukończenie WORK/BREAK, koniec sesji, powrót po ukrytej karcie, kickoff po przerwie). Na beat widoczne mogą być:

- **Interstitial** — spokojna linia (closure, narracja in-flow, override ack, banner catch-up)
- **Gate** — blokujący overlay wymagający decyzji (check-in, wind-down, kickoff readiness, sugestia, cycle complete confirm)

PRD dopuszcza **jedną linię + jeden gate** razem; zabrania **dwóch linii** lub **dwóch gate'ów**.

### Gdzie reguła żyje dziś

#### Warstwa specyfikacji — DEKLARACJA + przyznanie naruszenia

```247:247:context/foundation/user-flow.md
**Zasada PRD (guardrail):** „At most one interstitial line plus one gate per transition beat” — w praktyce **closure + kickoff readiness mogą się nałożyć** (patrz: znane tarcia).
```

```253:261:context/foundation/user-flow.md
### T-01: Closure vs kickoff readiness / check-in
// ...
- `pomodoro-dashboard.tsx` renderuje `SessionClosureOverlay` bez warunku `!awaitingKickoffReadiness` / `!pendingClosureLine` w kickoff guard
// ...
- **Race:** async `getOrCreateActive()` w kickoff effect może rozwiązać się **po** `endSession()` i ponownie otworzyć readiness nad closure
```

#### Warstwa UI — JEDYNY strażnik (rozproszony, niespójny)

**Kickoff readiness — brak guarda closure (T-01):**

```371:375:src/app/_components/pomodoro-dashboard.tsx
			{enableSuggestionGate &&
				pomodoro.awaitingKickoffReadiness &&
				!pomodoro.awaitingCheckIn &&
				!pomodoro.awaitingWindDown &&
				!pomodoro.isPostCheckInTransitioning && (
```

**Closure — render bez mutual exclusion:**

```390:395:src/app/_components/pomodoro-dashboard.tsx
			{pomodoro.pendingClosureLine != null && (
				<SessionClosureOverlay
					closureLine={pomodoro.pendingClosureLine}
					onDismiss={pomodoro.dismissSessionClosure}
				/>
			)}
```

**Z-index potwierdza wizualne przykrycie (kickoff wygrywa):**

```23:23:src/app/_components/session-closure-overlay.tsx
		<OverlayScrim role="dialog" testId="session-closure-overlay" zIndex={58}>
```

```25:25:src/app/_components/kickoff-readiness-overlay.tsx
		<OverlayScrim role="dialog" testId="kickoff-readiness-overlay" zIndex={60}>
```

**Częściowy mutex T-02 (cycle-complete vs check-in) — UI:**

```353:355:src/app/_components/pomodoro-dashboard.tsx
			{!pomodoro.awaitingCheckIn &&
				!pomodoro.awaitingWindDown &&
				!pomodoro.isPostCheckInTransitioning && (
```

**Częściowy mutex narracji in-flow — UI + hook (bez closure):**

```145:153:src/app/_components/pomodoro-dashboard.tsx
	const showInFlowSummary =
		pomodoro.inFlowSummaryLine != null &&
		!showSuggestionCard &&
		!showKickoffCard &&
		!pomodoro.awaitingCheckIn &&
		!pomodoro.awaitingWindDown &&
		!pomodoro.isPostCheckInTransitioning &&
		!pomodoro.awaitingKickoffReadiness &&
		!pomodoro.awaitingCycleIntention;
```

```2234:2241:src/hooks/use-pomodoro-cycle.ts
		if (
			awaitingCheckIn ||
			awaitingWindDown ||
			isPostCheckInTransitioning ||
			awaitingKickoffReadiness ||
			awaitingCycleIntention
		) {
			return null;
```

**Brak guarda:** `overrideAcknowledgement` (dashboard ~296–303) — może współistnieć z kartami sugestii bez centralnego mutexu.

#### Warstwa hooka — CZĘŚCIOWO + race async

**`kickoffEligible` — nie wyklucza closure:**

```1070:1080:src/hooks/use-pomodoro-cycle.ts
	const kickoffEligible =
		mode === "authenticated" &&
		state === "idle" &&
		cycleKind === null &&
		focusedTaskId === null &&
		!awaitingCheckIn &&
		!awaitingWindDown &&
		!isPostCheckInTransitioning &&
		pendingSuggestion.status === "idle" &&
		hasActiveTasks &&
		(sessionStartIdleFlag || postBreakIdleFlag);
```

**Kickoff effect — race po `endSession()`, błąd połykany:**

```1101:1108:src/hooks/use-pomodoro-cycle.ts
		void (async () => {
			try {
				const session = await sessions.getOrCreateActive();
				setActiveSessionId(session.id);
				setAwaitingKickoffReadiness(true);
			} catch {
				setPendingKickoffSuggestion({ status: "error" });
			}
		})();
```

**`endSession` — prezentuje closure, czyści flagi, ale nie unieważnia async:**

```2113:2140:src/hooks/use-pomodoro-cycle.ts
		if (endingSessionId != null) {
			presentClosureOverlay(closureLine, endingSessionId);
		}
		// ... reset stanu ...
		clearSuggestion();
		clearKickoffSuggestion();
		clearKickoffIdleFlags();
```

**Przerwanie cyklu przy end session — best-effort (połknięty błąd):**

```2098:2102:src/hooks/use-pomodoro-cycle.ts
				try {
					await cycles.interrupt({ cycleId });
				} catch {
					// Best effort — continue ending session
				}
```

**Wind-down fetch failure — kontynuacja zamiast fail-fast:**

```1976:2001:src/hooks/use-pomodoro-cycle.ts
					} catch {
						// Wind-down is optional; never block check-in → break transition.
					}
```

#### Warstwa czystej logiki — wzorzec do naśladowania

`deriveCatchUpGate` — **jedno wejście → jeden gate** (mutex w funkcji czystej):

```16:40:src/lib/catch-up/derive-gate.ts
export function deriveCatchUpGate(
	snapshot: CatchUpGateSnapshot,
): CatchUpGate | null {
	if (snapshot.awaitingCheckIn) {
		return "CHECK_IN";
	}
	// ... priorytetowa kolejność ...
	return null;
}
```

#### Warstwa serwera / DB — **NIE egzekwuje** I-01

tRPC routers persystują sesję, cykl, check-in — nie modelują „aktywnego beatu”. Beat-mutex to **wyłącznie concern klienta** (do czasu ewentualnego server-push w przyszłości).

#### Testy — **brak oracle beat-mutex**

| Plik | Co testuje | Mutex? |
|------|------------|--------|
| `use-pomodoro-cycle.test.tsx` ~1142–1175 | `pendingClosureLine` po `endSession` | Nie — brak combo z kickoff |
| `pomodoro-dashboard.test.tsx` ~305–314 | Closure render smoke | Izolowany — bez `awaitingKickoffReadiness` |
| `e2e/session-closure.spec.ts` | End session → dismiss | Belt maskuje T-01 (`dismissKickoffReadinessIfVisible` przed end) |

`test-plan.md:80` — ryzyko #8; faza 8 „PRD v3 wedge coherence” = `not started`.

### Mapa egzekucji

| Warstwa | Rola względem I-01 | Problem |
|---------|-------------------|---------|
| PRD / user-flow | Deklaruje + dokumentuje T-01 | — |
| Dashboard | Jedyny strażnik | Rozproszone `&&`; T-01 aktywny |
| Hook | Ustawia flagi kandydatów | Race async; brak centralnego mutexu |
| `derive-gate.ts` | Mutex catch-up | Wzorzec, nie obejmuje closure/kickoff |
| Server / DB | Brak | — |
| Testy | Brak oracle | Regresja niewidoczna |

---

## KROK 4 — Projekt agregatu-strażnika

### Kontekst ograniczony i agregat

| Element | Nazwa | Umiejscowienie |
|---------|-------|----------------|
| **Bounded context** | Wedge Flow Orchestration | `src/lib/wedge/` (obok `src/lib/catch-up/`) |
| **Aggregate root** | `WedgeTransitionBeat` | Jedna granica spójności na aktywny beat |
| **Domain service** | `resolveWedgeBeat` (`TransitionConductor`) | Czysta funkcja — wzorzec `deriveCatchUpGate` |
| **Port** | `WedgeBeatRepository` | Implementacja w `usePomodoroCycle` (infrastruktura) |
| **ACL** | `BeatSnapshotMapper` | Mapowanie flag hooka ↔ `BeatSnapshot` |

### Model wartości (skrót)

```typescript
type WedgeGateKind =
  | "SESSION_CLOSURE" | "TIMEOUT_CLOSURE" | "WIND_DOWN" | "CHECK_IN"
  | "SUGGESTION_ACCEPT" | "KICKOFF_READINESS" | "CYCLE_INTENTION" | "CATCH_UP_GATE";

type InterstitialKind =
  | "CLOSURE_LINE" | "IN_FLOW_NARRATIVE" | "OVERRIDE_ACK" | "CATCH_UP_BANNER";

type BeatSnapshot = {
  phase: "idle" | "active" | "resolving";
  candidates: { /* flagi z hooka: closure, kickoff, check-in, ... */ };
  suppress: { kickoffWhileClosure: boolean; checkInWhileClosure: boolean; gatesWhilePaused: boolean; kickoffWhileHandoff: boolean };
  asyncGeneration: { kickoffEligibility: number };
};

type BeatResolution = {
  interstitial: { kind: InterstitialKind; text: string } | null;
  gate: { kind: WedgeGateKind; generation: number } | null;
  suppressed: Array<{ kind: string; reason: string }>;
};
```

**Priorytet OQ2** (`flow-coherence-recommendations.md:84`):  
`return handoff (undismissed) > closure > wind-down > check-in > suggestion accept > kickoff readiness > in-flow narrative > catch-up overlay`.

### Błędy domenowe (fail-fast)

```typescript
abstract class WedgeDomainError extends Error {
  abstract readonly code: string;
}

class InterstitialSlotOccupiedError extends WedgeDomainError { code = "INTERSTITIAL_SLOT_OCCUPIED"; }
class GateSlotOccupiedError extends WedgeDomainError { code = "GATE_SLOT_OCCUPIED"; }
class GatePrioritySuppressedError extends WedgeDomainError { code = "GATE_PRIORITY_SUPPRESSED"; }
class StaleBeatGenerationError extends WedgeDomainError { code = "STALE_BEAT_GENERATION"; }
class BeatNotActiveError extends WedgeDomainError { code = "BEAT_NOT_ACTIVE"; }
class BeatInvariantViolation extends WedgeDomainError { code = "BEAT_INVARIANT_VIOLATION"; }
```

**Polityka:** Nielegalna mutacja **rzuca** — nie aktualizuje stanu po cichu. `StaleBeatGenerationError` na granicy infra = no-op (zamierzone unieważnienie async po `endSession`).

### Metody agregatu (sygnatury + pseudokod)

```typescript
class WedgeTransitionBeat {
  static idle(): WedgeTransitionBeat;

  beginBeat(): WedgeTransitionBeat;
  // PRE: phase !== "active" (inaczej BeatNotActiveError)

  assignInterstitial(slot: InterstitialSlot): WedgeTransitionBeat;
  // PRE: phase === "active" && interstitial === null
  // POST: jedna linia; inaczej InterstitialSlotOccupiedError

  openGate(slot: GateSlot): WedgeTransitionBeat;
  // PRE: phase === "active" && gate === null
  // POST: jeden gate; inaczej GateSlotOccupiedError

  applyResolution(resolution: BeatResolution): WedgeTransitionBeat;
  // Atomowo: beginBeat → assignInterstitial? → openGate? → assertInvariant()

  dismissGate(kind: WedgeGateKind): WedgeTransitionBeat;
  dismissInterstitial(kind: InterstitialKind): WedgeTransitionBeat;
  completeBeat(): WedgeTransitionBeat;
  bumpAsyncGeneration(): WedgeTransitionBeat;
  // Wywoływane w batch z endSession — unieważnia pending kickoff effect

  toResolution(): BeatResolution;
}
```

**Conductor (czysta funkcja):**

```typescript
function resolveWedgeBeat(snapshot: BeatSnapshot): BeatResolution {
  const suppressed: BeatResolution["suppressed"] = [];
  let gate: GateSlot = null;
  let interstitial: InterstitialSlot = null;

  for (const kind of GATE_PRIORITY) {
    if (!isGateEligible(kind, snapshot)) continue;
    if (isGateBlockedByClosure(kind, snapshot)) {
      suppressed.push({ kind, reason: "T-01 closure mutex" });
      continue;
    }
    gate = { kind, generation: pickGeneration(kind, snapshot) };
    break;
  }

  interstitial = pickInterstitial(snapshot, gate, suppressed);
  return { interstitial, gate, suppressed };
}

function isGateBlockedByClosure(kind: WedgeGateKind, s: BeatSnapshot): boolean {
  const closureActive = s.candidates.sessionClosure ?? s.candidates.timeoutClosure;
  if (!closureActive) return false;
  if (kind === "KICKOFF_READINESS" && s.suppress.kickoffWhileClosure) return true;
  if (kind === "CHECK_IN" && s.suppress.checkInWhileClosure) return true;
  return false;
}

function isGateBlockedByHandoff(kind: WedgeGateKind, s: BeatSnapshot): boolean {
  if (kind !== "KICKOFF_READINESS") return false;
  return s.candidates.returnHandoffVisible && !s.candidates.handoffDismissed;
}

function isGateBlockedByPause(kind: WedgeGateKind, s: BeatSnapshot): boolean {
  if (!s.candidates.cyclePaused) return false;
  return s.suppress.gatesWhilePaused;
}
```

### Repozytorium i atomowość

Beat-mutex nie wymaga transakcji DB. Atomowość = **jeden batch React** (`useReducer`):

```typescript
interface WedgeBeatRepository {
  load(): WedgeTransitionBeat;
  captureSnapshot(): BeatSnapshot;
  save(command: BeatCommand | BeatCommand[]): void; // fail-fast na WedgeDomainError
}

type BeatCommand =
  | { type: "RESOLVE_FROM_SNAPSHOT"; snapshot: BeatSnapshot }
  | { type: "DISMISS_GATE"; kind: WedgeGateKind }
  | { type: "DISMISS_INTERSTITIAL"; kind: InterstitialKind }
  | { type: "END_SESSION_BUMP_GENERATION" }
  | { type: "COMPLETE_BEAT" };
```

**`endSession` — docelowy batch:**

```typescript
repo.save([
  { type: "END_SESSION_BUMP_GENERATION" },
  { type: "RESOLVE_FROM_SNAPSHOT", snapshot: captureAfterClosure({ closureLine }) },
]);
// kickoff effect: jeśli generation !== snapshot.asyncGeneration.kickoffEligibility → StaleBeatGenerationError → no-op
```

### Cienkie API (klient)

| Warstwa | Rola |
|---------|------|
| **Dashboard** | Read-only: `const { interstitial, gate } = repo.load().toResolution()` — **zero** rozproszonych `show*` booleanów |
| **Hook** | Jedyny writer: `repo.save(...)` po każdej zmianie eligibility |
| **tRPC** | Bez zmian dla I-01 — dostarcza dane (closure line, session), nie orkiestruje beatu |

Mapowanie błędów (dev: throw; prod: telemetry dla `BEAT_INVARIANT_VIOLATION` — UI po F-07 nie powinno wywoływać nielegalnych mutacji).

---

## KROK 5 — Before/after, plan faz, testy

### Before/after — miejsca reguły dziś

| Lokalizacja | Before (dziś) | After (docelowo) |
|-------------|---------------|------------------|
| `pomodoro-dashboard.tsx:371–395` | Kickoff i closure renderują się niezależnie (`&&`) | Dashboard czyta `BeatResolution`; kickoff niewidoczny gdy conductor wybiera `SESSION_CLOSURE` |
| `pomodoro-dashboard.tsx:145–153` | `showInFlowSummary` — duplikat mutexu | `interstitial.kind === "IN_FLOW_NARRATIVE"` z conductora |
| `pomodoro-dashboard.tsx:353–369` | T-02 guard lokalny | `gate.kind === "CYCLE_COMPLETE"` lub brak gate w resolution |
| `use-pomodoro-cycle.ts:1070–1109` | `kickoffEligible` + async effect bez abort | `captureSnapshot()` → `resolveWedgeBeat`; `END_SESSION_BUMP_GENERATION` w batch |
| `use-pomodoro-cycle.ts:2113–2140` | `presentClosureOverlay` + clear flags, race możliwy | Batch: bump generation + resolve z `sessionClosure` candidate |
| `use-pomodoro-cycle.ts:2230–2248` | `inFlowSummaryLine` — częściowy mutex | Conductor `pickInterstitial` z priorytetem poniżej closure |
| `derive-gate.ts` | Mutex tylko catch-up | `CATCH_UP_GATE` jako najniższy priorytet w `GATE_PRIORITY` |
| Brak modułu | 15+ niezależnych flag | `src/lib/wedge/transition-conductor.ts` + testy macierzy |

### Plan faz refaktoru

| Faza | Change ID | Cel | Test-first? | Zależności |
|------|-----------|-----|-------------|------------|
| **0** | — | Characterization tests dokumentujące T-01 (fail until fix) | **Tak** — Vitest | — |
| **1** | **B-05** `fix-closure-kickoff-mutex` | Hotfix: predicate `!pendingClosureLine`, `kickoffFetchGenRef`, dashboard guard | **Tak** — testy z fazy 0 przechodzą | P0, parallel S-29 |
| **2** | **B-06** `timeout-closure-on-load` | T-03: closure po timeout na load, nie przy starcie cyklu | Test-first (hook hydrate) | Po B-05 |
| **3a** | **F-07** commit 1 | `resolveWedgeBeat` + `transition-conductor.test.ts` (macierz parity z dashboardem) | **Tak** — pure function | B-05 merged |
| **3b** | **F-07** commit 2 | `WedgeTransitionBeat` + `WedgeBeatRepository` w hooku; dashboard enforcement | Test-first (reducer + integration hook) | 3a |
| **4** | **B-07** | Wind-down threshold w `candidates.windDown` | Rozszerzenie testów conductora | F-07 3a |
| **5** | test-plan faza 8 | Belt e2e: closure → dismiss → brak kickoff; pary gate'ów | E2e po F-07 | F-07 3b |
| **6** | S-34 + S-35 | Optimistic wedge | **Nie** przed F-07 — wzmacnia race T-01 | F-07 complete |

**Dyscyplina testowa projektu:** Vitest (`pnpm test`), belt e2e (`pnpm test:e2e:belt`). Fazy 0–3b = test-first zgodnie z `refactor-opportunities/plan.md` i `test-plan.md:80`.

### Przypadki testowe dla I-01

**Legalne (musi przejść):**

| # | Scenariusz | Oczekiwany `BeatResolution` |
|---|------------|----------------------------|
| L1 | `endSession` → closure line, brak innych kandydatów | `interstitial: CLOSURE_LINE`, `gate: null` |
| L2 | Po WORK complete (auth) → check-in | `gate: CHECK_IN`, brak drugiego gate |
| L3 | FADING + fatigue → wind-down przed break | `gate: WIND_DOWN` (wyższy priorytet niż check-in jeśli oba — według macierzy) |
| L4 | Break running + suggestion ready | `gate: SUGGESTION_ACCEPT` |
| L5 | Idle + kickoff eligible, brak closure | `gate: KICKOFF_READINESS` |
| L6 | Closure line + dismiss-only (calm closure FR-040) | jedna linia, dismiss → `completeBeat` |
| L7 | Catch-up CHECK_IN + awaitingCheckIn | `gate: CATCH_UP_GATE` lub `CHECK_IN` (companion banner w slocie interstitial) |
| L8 | T-02: post-check-in transitioning | cycle-complete **suppressed** |
| L9 | `CycleState.PAUSED` (S-24) | all wedge gates in `suppressed`; timer frozen |
| L10 | Return handoff undismissed (T-06 / pol-10) | kickoff in `suppressed`; handoff dismiss → kickoff eligible |

**Nielegalne (musi fail-fast lub suppress):**

| # | Scenariusz | Oczekiwane zachowanie |
|---|------------|----------------------|
| I1 | `pendingClosureLine` + `awaitingKickoffReadiness` (T-01) | Conductor: kickoff w `suppressed`; **nigdy** oba overlaye |
| I2 | `endSession` + async kickoff effect resolves później | `StaleBeatGenerationError` → no-op |
| I3 | Drugi `openGate` bez dismiss | `GateSlotOccupiedError` |
| I4 | Druga `assignInterstitial` | `InterstitialSlotOccupiedError` |
| I5 | Kickoff readiness + check-in jednocześnie | Conductor wybiera wyższy priorytet; drugi w `suppressed` |
| I6 | Narrative + closure line | Conductor: jedna interstitial (closure wygrywa) |

**Characterization (B-05, fail → pass):**

```typescript
// pomodoro-dashboard.test.tsx — oracle T-01
it("does not render kickoff readiness when pendingClosureLine is set", () => {
  renderDashboard({ pendingClosureLine: "Session complete.", awaitingKickoffReadiness: true });
  expect(screen.queryByTestId("kickoff-readiness-overlay")).not.toBeInTheDocument();
  expect(screen.getByTestId("session-closure-overlay")).toBeInTheDocument();
});
```

### Load-bearing names (rejestr kontraktów)

Projekt nie prowadzi formalnego rejestru kontraktów; poniższe nazwy powinny trafić do `context/domain/` lub nagłówka modułu F-07 oraz `test-plan.md` §6 (cookbook wedge):

| Nazwa | Warstwa | Opis |
|-------|---------|------|
| `WedgeTransitionBeat` | aggregate root | Granica spójności beatu |
| `BeatSnapshot` | value object | Wejście conductora z hooka |
| `BeatResolution` | value object | Wyjście conductora → dashboard |
| `resolveWedgeBeat` | domain service | Czysta funkcja priorytetów OQ2 |
| `WedgeBeatRepository` | port | Load/save agregatu w hooku |
| `GATE_PRIORITY` | policy constant | Kolejność OQ2 |
| `WedgeDomainError` | error base | Fail-fast |
| `StaleBeatGenerationError` | domain error | Abort async kickoff (T-01 race) |
| `INTERSTITIAL_SLOT_OCCUPIED` | error code | Drugi interstitial |
| `GATE_SLOT_OCCUPIED` | error code | Drugi gate |
| `BEAT_INVARIANT_VIOLATION` | error code | Naruszenie US-01 |

---

## Podsumowanie

Odkryto 15 niezmienników biznesowych FlowState; najbardziej rdzeniowy i jednocześnie najsłabiej egzekwowany jest **beat-mutex** (≤1 interstitial + ≤1 gate na transition beat) — Primary success US-01 i aktywny bug T-01 (closure przykryte przez kickoff readiness, z-index 60 > 58). Reguła żyje dziś jako rozproszone warunki `&&` w `pomodoro-dashboard.tsx` i flagi w `use-pomodoro-cycle.ts`, bez modułu conductora (F-07 proposed) i bez testów oracle. Projektowany agregat **`WedgeTransitionBeat`** w kontekście Wedge Flow Orchestration (`src/lib/wedge/`) z czystym **`resolveWedgeBeat`** i portem **`WedgeBeatRepository`** w hooku zastąpi ad-hoc mutex jednym `BeatResolution` na batch React. Rollout: test-first characterization → **B-05** hotfix → **F-07** conductor → belt e2e faza 8; S-34 dopiero po F-07. Fail-fast: nielegalne przejścia rzucają `WedgeDomainError`, async race po `endSession` kończy się `StaleBeatGenerationError` zamiast ponownego otwarcia kickoff.
