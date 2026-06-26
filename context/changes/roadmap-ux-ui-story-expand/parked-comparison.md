# Parked comparison — UX/UI story roadmap expand

Date: 2026-06-26  
Source batch: `context/changes/roadmap-ux-ui-story-expand/batch-7-ux-ui-story-chapter.md`

## Purpose

Compare the proposed UX/UI story chapter against existing shipped slices and parked items before writing new roadmap rows. Focus: avoid duplicating S-30/S-28 scope and preserve S-39 gate accessibility — not MVP-era product scope limits.

## Merge relationships (primary)

| Shipped / parked item | Relationship for this expand |
| --- | --- |
| S-30 daily timing recap | S-42 is **phase 2** — presentation/formatter over existing recap data, not a new data pipeline |
| S-28 Calm Garden phase 2 | S-43 **absorbs** deferred overlay + state-bound hero/rail variants |
| S-39 accessible wedge gates | S-43 illustrations on hero/rail only — never on gate controls |
| P-104 session reconnect calm banner | Remains **parked** separately — do not fold into S-40/S-42 |

## Proposed items — scope notes

### Product Voice Contract (`product-voice-contract`)

Foundation doc only (`product-voice.md`). De-risks copy consistency across S-40, S-41, S-42. Safe to promote first.

### Home IA Reset (`home-ia-reset`)

Novelty is hierarchy: "Co teraz?" primary, task list inventory, recap collapsed context. Touches shipped S-13/S-15/S-27/S-30/S-31 surfaces — composition refactor, not new wedge mechanic.

**Risk to manage:** recap or task inventory becomes co-primary with next-focus.

### Desktop Calm Workbench (`desktop-calm-workbench`)

Phase 2 after S-40. Three-zone layout at lg≥1024; rail capped at 3 blocks; decision column primary.

**Risk to manage:** context rail steals focus from decision column.

### Mindful Day Memory (`mindful-day-memory`)

S-30 phase 2 — narrative formatter (`Domknięte / Zostaje / Wróć tutaj`) over existing `DailyRecap`.

**Risk to manage:** duplicate S-30 substrate or new server queries.

### Stateful Illustration System (`stateful-illustration-system`)

S-28 phase 2 absorption + six-state variant map on hero/rail.

**Risk to manage:** decorative art on S-39 gate controls; motion delaying S-34 optimistic path.

## Recommended roadmap write stance

| Proposal | Roadmap stance |
| --- | --- |
| `product-voice-contract` | New foundation row (F-08) |
| `home-ia-reset` | New slice row (S-40) |
| `desktop-calm-workbench` | New slice row (S-41), hard dependency on S-40 |
| `mindful-day-memory` | New slice row (S-42), explicit S-30 phase 2 |
| `stateful-illustration-system` | New slice row (S-43), explicit S-28 phase 2 |
