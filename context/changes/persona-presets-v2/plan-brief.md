# Plan brief: persona-presets-v2

## Executive summary

S-29 shipped a **create-only F-05 pre-fill shortcut** (3 personas, no persistence). User feedback and US-02 require a **persona identity layer**: a broader catalog (≥8), human-readable task chrome (persona label + effort), effort tunable on the preset path without demotion to Custom, and a persisted `personaPresetId` so rows and S-32 can trust what the user picked.

This slice adds nullable `personaPresetId` on `Task` (and guest blob), expands the catalog to **10 draft personas** (frame brief — **user approval gate before Phase 2 locks bundles**), rewires create UX and `TaskBadges`, and threads the field through tRPC + data-mode repos. Inline edit stays attribute-panel-only (S-29 scope preserved).

## Relationship to S-32

| Topic | S-29 v1 | persona-presets-v2 | S-32 (create-wedge-trust-bridge) |
| --- | --- | --- | --- |
| Persona on task | Not stored | `personaPresetId` nullable string | Reads stored id → rationale clause with **preset label** |
| Row chrome | F-05 jargon (`Ops`, `U:`, `I:`) | Persona label + effort badge | Unchanged card; benefits from readable rows |
| Infer vs store | Deferred | **Store** (resolves S-32 unknown) | No inference from F-05 tuple |
| Effort override | Flips to Custom | Effort-only override keeps persona | Rationale can cite persona even if effort differs |

S-32 prerequisites (S-29, F-05, S-06) remain; this slice is the **missing persistence prerequisite** S-29 explicitly deferred. Optional Phase 6 exports label lookup + documents S-32 contract — does not ship rationale text.

## Phases outline

1. **Schema + migration** — `personaPresetId` on Prisma `Task`; guest schema + import; `DomainTask` + tRPC create/update; repos.
2. **Catalog** — 10 personas (draft table from frame); pure helpers: `getPresetById`, `taskAttributesMatchPreset` (effort excluded), label lookup; Lucide icons; **user sign-off on names/bundles**.
3. **Create UX** — Always-visible effort when a preset is selected; effort change does **not** call `markCreateFormCustom()`; `createTask` sends `personaPresetId`; picker layout for 10 chips (+ Custom).
4. **Row badges** — Replace default `TaskBadges` with persona + effort; Custom/F-05 detail only on Custom create or non-effort divergence; legacy `null` → existing F-05 chrome.
5. **Tests** — Vitest: catalog helpers, badge display modes, create payload, effort-only override; guest schema/import; update `task-list.test.tsx`; note e2e helper stability.
6. **Optional S-32 prep** — Export `getPersonaPresetLabel(id)`; stub note in S-32 item for rationale template input.

## Key decisions (locked for planning)

### Nullable `personaPresetId`

- **Type:** `String?` `@map("persona_preset_id")` `@db.VarChar(32)` on `Task` — not a Prisma enum (catalog ids evolve).
- **Create:** Set when user adds via preset chip (including effort-only override). Set `null` when user chose Custom or no preset selected.
- **Update (inline edit):** Out of scope to re-pick presets; **do not clear** `personaPresetId` on edit — display uses live attribute comparison; S-32 may still cite create-time persona.
- **Migration:** Add column nullable, no backfill. Existing rows `null` → **legacy display** (current F-05 badges).

### Row display rules

| Condition | Row badges |
| --- | --- |
| `personaPresetId == null` | Legacy: work type + `U:`/`I:` (+ ASAP) — same as today |
| `personaPresetId` set, non-effort attrs match preset bundle | **Persona label** (work-type color) + **effort badge** (`{n}m` or hidden if no effort) |
| User chose Custom at create (`personaPresetId == null` after custom create) | **Custom** label + simplified F-05 (work type + `U:`/`I:`) |
| `personaPresetId` set but workType/urgency/importance/horizon ≠ preset bundle | **Custom** + F-05 detail (persona label hidden — attrs no longer “that persona”) |

Effort mismatch alone **never** triggers Custom/F-05 detail mode.

### Effort on create path

- On preset select: apply bundle including default effort to state.
- Show compact effort input **below preset row** whenever `selectedPresetId` is a preset id (not `custom`, not `null`).
- `onEffortMinutesChange` updates effort only — **no** `markCreateFormCustom()`.

## Risks

| Risk | Mitigation |
| --- | --- |
| 10 chips crowd mobile create form | Horizontal scroll or two-row wrap in `PersonaPresetPicker`; keep chip labels short (frame draft). |
| Catalog approval delays implementation | Phase 2 manual gate; bundles table in plan is draft until user approves. |
| Guest merge drops persona | Extend `guestTaskSchema`, guest repo create/update, `import-guest-snapshot.ts`, `use-domain-tasks` map. |
| e2e `addTaskWithAttributes` regression | Helper already opens Custom panel — **belt specs unchanged**; document optional `addTaskViaPreset(page, title, presetId)` for future S-32 e2e. |
| Divergence logic drift | Pure `taskAttributesMatchPreset` in `persona-presets.ts` — single oracle for UI + tests. |
| Invalid stored id | `getPresetById` returns undefined → treat as legacy F-05 display (defensive). |

## Out of scope

- S-32 rationale implementation, kickoff/post-check-in scope choice, “first suggestion” semantics.
- Inline edit preset picker.
- Scorer / suggestion ranking changes.
- Belt e2e for persona picker (Vitest-first, per S-29 precedent).
- Renaming or remapping S-29 ids on old tasks (none stored yet).

## Success criteria (slice)

- User picks any of ≥8 approved personas, tweaks effort only, adds task → row shows **persona label + effort**, not `U:`/`I:`.
- Custom create or non-effort override → Custom + F-05 detail.
- Guest and auth create/list/update paths carry `personaPresetId`.
- `pnpm check`, `pnpm typecheck`, `pnpm test` green; `task-list.test.tsx` updated.

## Next handoff

After plan review: `/10x-implement persona-presets-v2 phase 1` (or `/10x-tdd` for test-first phases).
