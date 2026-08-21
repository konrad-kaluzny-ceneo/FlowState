# UI polish for calm, cohesive styling like promo-header — Plan Brief

> Full plan: `context/changes/improve-styles/plan.md`

## What & Why

Full-app visual polish to reduce “chaos” and align the live UI with `promo-header.png`: one dominant sage accent, desaturated pastels for categories, airy spacing, and clearer hierarchy where the timer stays hero. Tokens and `DESIGN.md` already describe the target language — this slice fixes **composition** (too many competing hues, badge stacking, inconsistent elevation) across all five routes plus auth/settings edge surfaces.

## Starting Point

`globals.css` `@theme` defines sage CTA, off-white cards, work-type/energy pastels, and calm dark overrides. Prior slices (`ui-refactor`, `focus-home-visual-craft`, `wedge-overlay-visual-polish`) built the token layer and overlay primitive. Live wedge surfaces still render **8+ hue families** on one screen, task rows carry 5–8 chrome elements, Focus uses a dense 2-col workbench, and ~25 files bypass tokens with raw `amber-*` / `sky-*` / `red-*` utilities.

## Desired End State

Every main route feels like the promo mock: **calm cream shell**, sage for primary actions, pastel washes for categories only, muted metadata pills, icon-based status actions without colored rings, softened photo/atmosphere scrims, and Plan/Summary that **keep their functionality** but present data with less dashboard noise. Light and dark themes stay in parity. Playwright screenshot baselines guard regressions on Focus, Tasks, Plan, and Summary.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Slice scope | Full app polish | User wants end-to-end cohesion, not wedge-only islands | Plan |
| Plan + Summary | Keep functionality, calm presentation | Preserve charts/timeline power-user value while desaturating layout and charts | Plan |
| Focus atmosphere | Soften scrims/saturation, keep break identity | Retains break-restoration atmosphere without full-bleed visual weight | Plan |
| Task row chrome | Muted metadata pills + icon status actions | Cuts rainbow chips while keeping metadata reachable | Plan |
| Accent budget | Sage actions + desaturated pastels | Categories stay readable; action color stays singular | Plan |
| Dark theme | Light + dark parity per change | One slice, one token contract — avoids theme drift | Plan |
| Focus layout | Keep 2-col workbench, soften rail | Preserves desktop productivity; combines rail widgets into one calm card | Plan |
| Verification | Manual promo compare + screenshot baselines | Catches subtle color/spacing regressions CI unit tests miss | Plan |
| Impeccable workflow | `/impeccable quieter`, `polish`, `layout`, `colorize` per phase | Product register + promo target = subtract noise before adding | Plan |

## Scope

**In scope:** token retint (pastels, warn/info/delegated), shell gradient + nav pill active state, atmosphere scrim softening, Focus rail consolidation + timer hero polish, task row diet, Plan timeline pastel rows + desaturated legend, Summary calm default with charts retained but monochrome, auth/settings/guest banner token pass, Playwright screenshot baselines (light/dark), a11y belt.

**Out of scope:** new features (calendar, MCP), data model/API changes, shadcn/Radix adoption, removing break atmosphere entirely, removing Plan/Summary charts or timeline interactions, focus-shell dimming (DESIGN.md future pattern), Impeccable skill update to v4.1.1.

## Architecture / Approach

Work **tokens first** (Phase 1) so every component pass inherits desaturated pastels and semantic warn/info/delegated tokens. **Shell second** (Phase 2) for cross-route cohesion. **Wedge surfaces third** (Phases 3–5) in Focus → Tasks → Plan/Summary order of daily-loop impact. **Edge surfaces** (Phase 6) mop hardcoded Tailwind colors. **Verification last** (Phase 7) once visuals stabilize. Each implementation phase starts with `/impeccable quieter` on the target surface, ends with `/impeccable polish`. Preserve all `data-testid` contracts and focus-ring e2e classes.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Token foundation | Desaturated pastels, warn/info tokens, segment-active alignment, dark parity | Contrast regression on badges — run a11y |
| 2. Shell + atmosphere | Global shell gradient, nav pill active, softened photo/scrim | Break identity too weak if over-softened |
| 3. Focus wedge | Softer context rail, timer hero, overlay radius, idle ring | `pomodoro-dashboard` blast radius — run `change-impact` |
| 4. Tasks diet | Muted row metadata, icon actions, toolbar calm | Action discoverability drops — keep overflow menu |
| 5. Plan + Summary calm | Pastel timeline rows, monochrome charts, calm summary default | Users expect colorful charts — keep expand/detail |
| 6. Edge surfaces | Auth, settings, guest banners on semantic tokens | Low visibility but easy to miss in manual QA |
| 7. Visual verification | Playwright screenshots + a11y belt | Screenshot flakiness — pin viewport/theme |

**Prerequisites:** feature branch `features/improve-styles`; `promo-header.png` at repo root; `DESIGN.md` + `PRODUCT.md` loaded; dev server for manual compare.
**Estimated effort:** ~6–8 sessions across 7 phases (Phase 3 highest blast radius).

## Open Risks & Assumptions

- Desaturating work-type/energy tokens may reduce category scan speed — mitigated by keeping labels + optional icons (DESIGN.md requirement).
- Screenshot baselines need stable auth seed and fixed viewport — use existing e2e worker pool patterns.
- `pomodoro-dashboard.tsx` + `use-pomodoro-cycle.ts` coupling — run `pnpm change-impact` before Phase 3 edits.
- Promo mock shows sidebar nav; live app uses `AppShell` — align **visual language** (pill active, cream shell), not pixel-perfect layout clone.

## Success Criteria (Summary)

- Side-by-side with `promo-header.png`: Focus, Tasks, Plan, Summary feel stonowane — one sage accent, no rainbow row chrome, timer reads as hero.
- All functionality preserved on Plan/Summary; no regression in task actions, timeline drag, or chart data.
- `pnpm check`, `pnpm test`, `pnpm test:e2e:a11y` green; new screenshot specs pass light + dark.
