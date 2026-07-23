# Product voice contract

> **Lineage:** F-14 `product-voice-contract` · [FLO-93](https://linear.app/flowstate-10xdev/issue/FLO-93) / [#171](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/171)  
> **North star:** [`PRODUCT.md`](../../PRODUCT.md) — mindful, clear, trustworthy; a quiet room, not a productivity dashboard.

FlowState speaks in **English** and **Polish** with one voice. Copy helps the user decide **what to do next** (*co teraz*) — it never competes with the timer, the task list, or overlay gates.

---

## Promise

| | EN | PL |
| --- | --- | --- |
| **Core** | Answer "what do I do right now?" and recover context after disruption. | Odpowiedź na: **co teraz?** — i spokojne odzyskanie kontekstu po przerwaniu. |
| **Success** | A calm end-of-day feeling — clear separation of done vs. remains — not maximum throughput. | Spokojne domknięcie dnia — wiadomo, co ukończone, a co aktywne — nie maksymalna wydajność. |
| **Wedge** | Session-aware next-task suggestion with a one-line rationale the user can accept or override. | Sugestia następnego zadania po cyklu z jednym zdaniem „dlaczego" — akceptujesz lub wybierasz inne. |

---

## Tone

Three words: **mindful**, **clear**, **trustworthy**.

| Trait | Do | Don't |
| --- | --- | --- |
| **Mindful** | Short lines; space to breathe; honest accounting | Urgency shaming, streak language, celebration hype |
| **Clear** | One idea per line; facts before reassurance | Stacked explanations, rationale + narrative + gate on one beat |
| **Trustworthy** | Explicit agency; non-punitive exits | Hidden defaults, guilt trips, fake personalization |

**Signature cadence:** `fact — reassurance` (em dash). Example: *Your pick is noted — we'll use it for the next suggestion.* / *Twój wybór zapisany — uwzględnimy go przy następnej sugestii.*

**Register:** second person, present tense, gentle imperatives (*ease back in*, *take a breath*, *wróć spokojnie*).

---

## Preferred vocabulary

| Concept | EN | PL | Notes |
| --- | --- | --- | --- |
| Purpose / now | what to do next | co teraz | 5-second purpose test anchor |
| Calm framing | calm, quiet, valid choice | spokojny, spokojnie, ważny wybór | Not *relaksujący wellness* |
| Agency | you're always in control; your pick | zawsze Ty decydujesz; Twój wybór | Every suggestion surface |
| Energy | focused / steady / fading | skupiony / stabilny / słabnący | Neutral, never judgmental |
| Session end | session complete; wrap up | sesja zakończona; domknij | Not *crushed it* |
| Day memory — done | Done | Ukończone | section label; aligned with `Tasks.sectionCompleted` |
| Day memory — remains | Remains | Aktywne | open work honestly; aligned with `Tasks.sectionActive` |
| Day memory — return | Return to / Wróć tutaj | names last focus after interruption |
| Override | noted; continuing that thread | zapisany; kontynuujemy ten wątek | Acknowledge without penalizing |

---

## Avoided vocabulary (non-examples)

| Category | EN non-example | PL non-example | Why |
| --- | --- | --- | --- |
| Gamification | streak, points, level up, crush it | seria, punkty, awans | PRD: no streak shaming |
| Productivity-bro | hustle, grind, deep work mode activated | zrób progres, ogarnij wszystko | Throughput-first tone |
| AI-slop | unlock your potential, supercharge focus | odblokuj swój potencjał, AI-powered | Generic wellness / purple-gradient voice |
| Punitive | you failed to finish; only X left | nie dokończyłeś; zostało Ci tylko | Calm accounting, not shame |
| Urgency | act now!, last chance | działaj teraz!, ostatnia szansa | Violates quiet-room register |

---

## Copy zones

Map user-facing strings to zones before editing. Each zone has a message namespace (or copy module) owner.

| Zone | Purpose | Catalog / module | F-14 acceptance |
| --- | --- | --- | --- |
| **Home purpose header** | *(removed 2026-07-03 per D-07 — hero deleted; the idle home's first card now carries the purpose test; navbar carries brand via `Navbar.brand`)* | ~~`Home.purposeHeader`~~ (deleted) | Superseded |
| **Suggestion rationale** | One calm line why this task | `Scoring.rationale.*` | Yes — `default`, `kickoff_fresh`, `low_effort_fit` |
| **Day memory closure** | Done / remains / return-to on home recap | `DayMemory.*` | Yes — section labels + collapsed line |
| **Wedge transitions** | One interstitial line per beat | `Session.transition.*` | Voice exemplar; migrate only |
| **Session narrative** | In-flow summary + closure overlay | `Session.narrative.*`, `narrative-builder.ts` | Infrastructure copy; distinct from day memory |
| **Onboarding / auth value** | First-run promise | `Onboarding.*`, `Auth.*` | Cite voice; no rewrite in F-14 |
| **Settings / workspace tips** | Settings chrome + coaching checklist for environment setup | `Settings.*` (tab/nudge), `WorkspaceSetup.*` (tips) | Cite voice; locale parity; no hustle / streak language |
| **Errors / recovery** | Calm retry, no blame | `Errors.*` | Cite voice |

**Recap vs. narrative:** S-30 daily recap (timing log) and S-17 session narrative (prose closure) stay separate. S-42 day memory uses **DayMemory** vocabulary — not session closure strings.

---

## 5-second purpose test

**Maintainer script:** Open home in idle state. Within 5 seconds ask: *What does this app help me decide?*

| Pass answer | EN | PL |
| --- | --- | --- |
| Required | what to do next | co teraz |

**How the test is answered** (amended 2026-07-03 per D-07, `fix-home-layout-spacing`):

The hero section — and with it the explicit purpose header (`Home.purposeHeader`, deleted) — was removed by product decision D-07 (defect register `mvp-defect-intake`). The navbar carries brand only (`Navbar.brand`). The 5-second test is now answered by the **interface itself**: the idle home opens directly on the primary region's first card (energy question / day memory / kickoff suggestion), which asks or answers *co teraz* without a headline. Any change to the idle home must keep that first card decision-shaped — if the maintainer script fails, restore an explicit purpose line rather than a hero.

Visual hierarchy and one dominant CTA remain S-40's job.

---

## Transition beat rule

Per PRD v3 and `user-flow.md`: **at most one interstitial line + one gate** per transition beat.

| Beat | Winning interstitial (example) | Gate |
| --- | --- | --- |
| Break start | *A brief pause — let your mind reset.* | Timer / break controls |
| Break re-entry (fading) | *Whenever you're ready — no rush.* | Energy check-in or continue |
| Wind-down | *Ready to wrap up?* (title only) | Keep going / End session |

**Copy constraint:** Choose the single winning line per beat. Do not add stacked reassurance, rationale, narrative, and gate copy on the same beat. If two lines compete, delete one — do not concatenate.

---

## F-14 acceptance examples

Canonical strings guarded by tests. Future slices may reuse or adapt; changing these requires citing this contract.

### Home purpose header

See §5-second purpose test.

### First suggestion rationale

One line; calm; preserves override freedom (`Suggestion.overrideAck`).

| Key | EN | PL |
| --- | --- | --- |
| `default` | Next up based on your energy and task mix | Kolejny krok — zgodnie z energią i zadaniami na dziś |
| `kickoff_fresh` | Fresh session — here's a strong starting point | Nowa sesja — sensowny punkt startowy |
| `low_effort_fit` | Quick win — fits your fading energy | Szybki krok — pasuje przy słabnącej energii |

### Day memory closure (done / remains / return-to)

> **PL status vocabulary (amended 2026-07-04, D-10):** Done/remains labels use **Ukończone** / **Aktywne** app-wide — unified with task-list section headers. S-42 zoned vocabulary (Domknięte / Zostaje / Zrobione) is unieważnione.

| Role | EN label | PL label | Message key |
| --- | --- | --- | --- |
| Done | Done | Ukończone | `DayMemory.sectionDone` |
| Remains | Remains | Aktywne | `DayMemory.sectionRemains` |
| Return-to | Return to | Wróć tutaj | `DayMemory.sectionReturnTo` |

**Collapsed one-line** (home, S-42):

| Locale | Template | Key |
| --- | --- | --- |
| EN | Done: {done}. Remains: {remaining}. Return calmly to: {next}. | `DayMemory.collapsedLine` |
| PL | Ukończone: {done}. Aktywne: {remaining}. Wróć spokojnie do: {next}. | `DayMemory.collapsedLine` |

---

## Examples and non-examples

### Rationale

| | Copy |
| --- | --- |
| ✓ EN | Quick win — fits your fading energy |
| ✓ PL | Szybki krok — pasuje przy słabnącej energii |
| ✗ EN | You're losing steam — finish something easy to get back on track! |
| ✗ PL | Tracisz energię — zrób coś łatwego, żeby wrócić do gry! |

### Day memory

| | Copy |
| --- | --- |
| ✓ PL | Ukończone: 2 zadania. Aktywne: 3 zadania. Wróć spokojnie do: API review. |
| ✗ PL | Świetna robota! 2/5 ukończone — zostało tylko 3! |

### Transition

| | Copy |
| --- | --- |
| ✓ EN | Ready when you are — your focus is still here. |
| ✗ EN | Great job on that cycle! Ready to keep your streak alive? |

---

## Future-slice acceptance checklist

**Before changing user-facing copy**, future slices (S-40, S-41, S-42, …) must cite this document and confirm:

- [ ] **Locale parity** — new keys exist in `messages/en.json` and `messages/pl.json` with matching structure.
- [ ] **Copy zone** — change maps to a zone in §Copy zones; no orphan strings in components.
- [ ] **5-second purpose test** — home/entry changes still answer *what to do next / co teraz*.
- [ ] **One-line rationale** — suggestion rationale stays one calm line; override freedom preserved.
- [ ] **Day memory vocabulary** — done/remains/return-to use `DayMemory` labels (Ukończone / Aktywne / Wróć tutaj in PL).
- [ ] **Transition beat budget** — at most one interstitial line + one gate; no stacked copy.
- [ ] **Non-examples avoided** — no streaks, productivity-bro, AI-slop, or punitive tone (§Avoided vocabulary).
- [ ] **Length budgets** — closure/resume lines respect 120-character caps unless schema follow-up is documented.
- [ ] **Tests** — copy-contract tests updated when acceptance examples change.

---

## References

- [`PRODUCT.md`](../../PRODUCT.md) — personality and anti-references
- [`context/foundation/prd.md`](prd.md) — rationale, narrative footprint, transition beats
- [`context/foundation/user-flow.md`](user-flow.md) — T-01–T-05 mutex / one gate
- [`context/foundation/roadmap-references/items/F-14.md`](roadmap-references/items/F-14.md) — slice acceptance
- Expand batch 7 PL exemplars: [`expand-batches/batch-7-ux-ui-story-chapter.md`](roadmap-references/expand-batches/batch-7-ux-ui-story-chapter.md)
