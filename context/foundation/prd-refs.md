---
project: FlowState
version: 1
updated: 2026-06-13
prd_version: 3
---

> PRD reference map — load with `@context/foundation/prd.md` v3. Index: [roadmap.md](roadmap.md).

# PRD reference model (v3)

PRD v3 is **brownfield**: acceptance is framed as **US-01–US-04** and **Scope of Change**, not `FR-NNN` lines. Do not grep `prd.md` for `FR-`.

| US | One-line contract |
| --- | --- |
| US-01 | Orchestrated wedge transitions — max 1 interstitial + 1 gate per beat |
| US-02 | Persona trust — first suggestion rationale cites preset context |
| US-03 | Daily standing + light timing recap (footprint, not dashboard) |
| US-04 | Pause/resume — timer preserved; ~30 min cap → calm session end |

Full scope map: [`roadmap-references/prd-v3-horizon.md`](roadmap-references/prd-v3-horizon.md).

## US → roadmap IDs

| US | Slices / foundations |
| --- | --- |
| US-01 | B-05, B-06, B-07, B-08, **F-07**, S-21, S-33, S-34, S-35 |
| US-02 | **S-29**, **S-32** |
| US-03 | **S-27**, **S-30** |
| US-04 | **S-24**, B-08 (minimal), **B-09**, **S-38** |
| Secondary craft | S-28, S-31 |

## Glance column tags (`roadmap.md`)

| Tag | Meaning |
| --- | --- |
| `US-0N` | PRD v3 must-have user story |
| `preserved` | Shipped MVP/v2 behavior — no regression |
| `modified` | Behavior delta documented in PRD v3 Scope |
| `Secondary` | PRD v3 secondary success / craft |
| `guardrails` | NFR / guardrail-only touch |

## Legacy FR-NNN

`FR-001`…`FR-044` appear in:

- Archived PRD: `foundation/archive/2026-06-12-prd-v1.md`, `foundation/archive/2026-06-13-prd-v2.md`
- Shipped change artifacts under `context/archive/*/`

When a plan or item card cites `FR-004`, treat it as **historical traceability** — map intent to current `prd.md` Scope or the relevant **US**. For new plans on v3 slices, cite **US-0N** and roadmap ID.

## v3 slice quick lookup

| ID | PRD ref |
| --- | --- |
| S-29 | US-02 | [#105](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/105) |
| S-32 | US-02 | [#115](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/115) |
| F-07 | US-01 | [#114](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/114) |
| S-24 | US-04 | [#50](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/50) |
| S-27, S-30 | US-03 | [#80](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/80), [#106](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/106) |
| S-34, S-35 | US-01 | [#116](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/116), [#117](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/117) |
| B-05–B-09 | US-01 / US-04 | [#110](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/110)–[#113](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/113); B-09 TBD |
| S-38 | US-04 | TBD |
| S-28, S-31 | Secondary |
