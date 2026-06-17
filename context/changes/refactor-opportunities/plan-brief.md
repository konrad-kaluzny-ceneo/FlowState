# Refactor opportunities — Plan Brief

> Full plan: `context/changes/refactor-opportunities/plan.md`
> Research: `context/changes/refactor-opportunities/research.md`

## What & Why

Repo-map analysis surfaced structural debt across the Pomodoro timer hub. Research ranked five candidates and proposed top-3 refactors. This plan turns that ranking into a **sequenced rollout** of child changes — without implementing refactors inside the meta `refactor-opportunities` folder itself.

## Starting Point

Verified research (V1–V30): monolithic hook (2357 LOC, 63 return fields), ad-hoc overlay mutex (T-01 bug), dual client data-access paths, and zero `data-mode-context` tests. Roadmap Stream N already lists B-05 → B-06 → F-07 as top blocker. No child change folders exist yet for B-05 or F-07.

## Desired End State

Child changes ship in order: calm closure hotfixes → wedge conductor foundation → ACL test net + task-read unification → hook pure extracts. Each has its own branch and plan. `rollout.md` tracks status; roadmap items S-21/S-34/S-35 unblock after F-07.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| This change scope | Meta rollout only — no `src/` edits here | Research separated exploration from implementation; each refactor has distinct blast radius | Plan |
| Implementation order | B-05 → B-06 → F-07 → K2 ACL → K1 extracts | Matches research ranking #1–#3 and roadmap Stream N | Research / Roadmap |
| F-07 conductor location | `src/lib/wedge/transition-conductor.ts` (pure) | Mirrors `derive-gate` pattern; hook keeps state, conductor owns priority | Plan |
| B-05 kickoff abort | `kickoffFetchGenRef` generation token | Matches existing in-flight guard style; scopes async race without F-07 | Plan |
| K2 path | Path C (`useDomainTasks`) before Path A (extend repos) | Fixes dual task read with lower blast radius than full repo extension | Research |
| OQ2 beat priority | closure > wind-down > check-in > suggestion > kickoff > narrative | Aligns F-07 scope with PRD guardrail and flow-coherence | Plan / F-07 |
| K4 sign-in schema | Optional parallel — not in critical path | Quick win (V17–V19) but low timer impact | Research |
| K3 guest merge | Deferred | Core consolidated; ~3% churn; not blocking wedge flow | Research |

## Scope

**In scope:**

- `rollout.md` child-change registry
- Handoff checkpoints for B-05, B-06, F-07, `data-mode-acl-hardening`, `cycle-hook-pure-extracts`
- Decision log for conductor placement, OQ2, K2 path

**Out of scope:**

- Direct code changes under `refactor-opportunities/`
- Path B full React Query unification
- Guest merge consolidation (K3)
- B-08 graceful session end while running (Stream N; after S-24 full)
- Splitting 63-field hook API into multiple public hooks
- `refreshGuest` behavior change

## Architecture / Approach

```
refactor-opportunities (meta)
  ├─ rollout.md ──tracks──► fix-closure-kickoff-mutex (B-05)
  │                          fix-timeout-closure-on-load (B-06)
  │                          wedge-transition-conductor (F-07)
  │                          data-mode-acl-hardening (K2)
  │                          cycle-hook-pure-extracts (K1)
  └─ optional parallel ──► sign-in-schema-extract (K4)
```

Each child change: `/10x-new` → research → plan → implement on `features/<change-id>`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Rollout manifest | `rollout.md` + frozen decisions | Wrong change-id breaks handoff chain |
| 2. B-05 handoff | T-01 hotfix merged | E2E belt masks bug today — must fix spec |
| 3. B-06 handoff | T-03 timeout closure on load | Depends on B-05 mutex patterns |
| 4. F-07 handoff | Conductor + B-07 wind-down + dashboard integration | `data-testid` / belt parity |
| 5. K2 ACL handoff | `data-mode-context` tests + Path C | Concurrent hook churn if before F-07 |
| 6. K1 extracts handoff | Pure modules, stable hook API | Scope creep into API split |
| 7. Rollout closure | All rows merged or deferred | K3 left open indefinitely |

**Prerequisites:** Verified `research.md`; roadmap B-05/F-07 entries current

**Estimated effort:** ~6–8 sessions across 7 phases (mostly child changes; Phase 1 ≈ 1 session)

## Open Risks & Assumptions

- B-05 without F-07 may leave other stacking pairs (wind-down + suggestion) — acceptable per B-05.md scope
- F-07 touches belt specs — behavior-parity tests required before merge
- `data-mode-acl-hardening` must not start until F-07 merges (no parallel with K1)
- K1 further decomposition (timer engine module) is out of scope until pure extracts prove stable

## Success Criteria (Summary)

- Top-3 research ranking executed via merged child changes or documented deferral
- T-01 and T-03 fixed before full conductor refactor
- `data-mode-context` has characterization tests before ACL shape changes
- Hook return API unchanged through K1 extract phase
