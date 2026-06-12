# Serene Pastel Well-being Rebrand — Plan Brief

> Full plan: `context/changes/serene-pastel-rebrand/plan.md`
> Research: `context/changes/serene-pastel-rebrand/research.md`

## What & Why

FlowState still presents as dark navy glass — gloomy for a well-being Pomodoro product. F-06 pivots the wedge visual system to **Serene Pastel Well-being** (linen/lavender shell, white cards, muted plum CTAs) as light-default, adds a **calm dark** variant on `#1E2433`, and ships a user-controlled theme toggle so the product feels intentional in any lighting context.

## Starting Point

F-04 locked the dark personality in `DESIGN.md`; S-12/S-13 tokenized ~40% of wedge surfaces via `@theme` in `globals.css`. Auth pages, scrims, focus rings, and ~142 `text-white` usages remain polarity-assumed. Three overlays duplicate hex patterns outside `overlay-shell`. No theme infrastructure exists.

## Desired End State

Users open FlowState to a soft pastel home surface (or calm dark if they prefer), switch themes from the header menu, and every wedge surface — home, tasks, auth, overlays, timer — reads clearly in both modes. CI enforces axe accessibility on wedge surfaces. E2e contracts use semantic `ring-focus` instead of purple-specific classes.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Theme scope | Light-default + calm dark in F-06 | Full dual-theme, not deferred sub-phase | Plan |
| Theme access | User menu toggle (light / dark / system) | Explicit user control over appearance | Plan |
| Focus ring | Semantic `ring-focus` + e2e update in same PR | Aligns tokens with tests; removes purple coupling | Research / Plan |
| Badge tints | Retokenize work-type + energy for both themes | Dark-designed washes fail contrast on light cards | Plan |
| Typography | Soften wedge headings to `font-semibold` | Matches Linear FLO-62 well-being register | Research / Plan |
| Orphan overlays | Migrate all three to `overlay-shell` | Eliminates duplicate hex; low logic risk | Research / Plan |
| Contrast verification | `@axe-core/playwright` in CI | Automated WCAG gate on wedge surfaces | Plan |

## Scope

**In scope:**

- `DESIGN.md` rewrite + Impeccable shape brief
- Dual `@theme` token sets (light default + `[data-theme="dark"]` overrides)
- Theme provider, FOUC script, user-menu toggle
- Home, task list, suggestion card, guest banner, all auth pages
- Overlay shell, wedge overlay consumers, orphan overlay consolidation
- Timer panel, duration picker, segmented controls, pomodoro dashboard
- E2e focus ring migration + axe CI spec

**Out of scope:**

- Calm Garden illustrations (S-28), focus-shell dimming, copy changes, visual regression baselines, non-wedge pages

## Architecture / Approach

Single semantic token layer in `@theme`; calm dark overrides CSS custom properties under `[data-theme="dark"]` on `<html>`. Components keep utilities like `bg-shell-top` and `text-primary` — no per-component `dark:` sprawl. A blocking inline script prevents theme flash; React provider handles toggle persistence and system preference listening. Sequence: spec → infrastructure → home/auth → overlays → timer chrome → tests/axe.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Spec + dual-theme foundation | DESIGN.md, @theme tokens, theme modules | Calm dark accent derivation needs contrast validation |
| 2. Theme toggle | User menu control + layout wiring | FOUC if blocking script missing |
| 3. Home + task + auth remap | Polarity flip across largest surface area | ~142 text-white replacements; easy to miss a file |
| 4. Overlays + orphans | Scrim token + overlay-shell consolidation | Must preserve all data-testid values |
| 5. Timer + segmented chrome | Chip tokens, timer retokenization | Unit test migration from color to aria-pressed |
| 6. Test contracts + axe CI | ring-focus e2e + axe Playwright gate | Axe false positives on auth embeds |

**Prerequisites:** F-04, S-13 merged; Linear FLO-62 palette values available  
**Estimated effort:** ~4–6 implementation sessions across 6 phases

## Open Risks & Assumptions

- Calm dark desaturated accent hex values are not yet in repo — Phase 1 Impeccable shape must derive and validate them
- Auth pages have no theme toggle (logged-out users) — assumes blocking script + system preference is sufficient
- axe scan scope must exclude third-party auth iframes to avoid CI noise
- Preview deploys mid-slice may show mixed old/new styling — promote after Phase 3 minimum

## Success Criteria (Summary)

- Wedge surfaces render correctly in light and dark with readable task hierarchy
- Theme toggle persists across reloads and respects system preference
- `pnpm test`, belt e2e, and axe a11y spec pass in CI
- Zero `ring-purple-500`, `#1a1a2e`, or blue/indigo auth CTAs remain in wedge tree
