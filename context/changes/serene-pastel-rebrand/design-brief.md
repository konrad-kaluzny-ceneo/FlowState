# Serene Pastel Well-being — Design Brief

> Impeccable shape output for F-06 Phase 1. Ports committed Linear FLO-62 palette; derives calm dark accents against `#1E2433`.

## 1. Feature Summary

FlowState's wedge visual system pivots from dark navy glass to **Serene Pastel Well-being** as the canonical **light-default** palette, with a **calm dark** variant for low-light sessions. The rebrand covers home shell, task hierarchy, cycle overlays, auth, and timer chrome — visual-only, preserving all `data-testid` contracts and 200ms motion timing.

Audience: interrupt-driven knowledge workers using FlowState in short focus bursts between meetings. Success means the product feels like a quiet room in daylight (or a calm evening desk) — hierarchy reads instantly without decorative noise.

## 2. Primary User Action

Glance at the home wedge and immediately distinguish **active vs completed tasks**, **selected focus task**, and **primary CTA** — in either theme, without squinting.

## 3. Design Direction

**Color strategy:** Restrained — tinted linen/lavender neutrals carry ~85% of surface area; muted plum-lavender CTA (`#5E5290`) is the single committed accent at ≤15% coverage. Semantic greens/teals/amber appear only on break, success, and suggestion states.

**Theme scene sentence (light-default):** A knowledge worker opens FlowState at a bright desk by a window in late morning — soft natural light, linen notebook, lavender mug steam — needing calm clarity, not dashboard urgency.

**Theme scene sentence (calm dark):** The same worker returns after dinner in a dim home office — warm desk lamp off, monitor glow only — wanting the same hierarchy without harsh contrast or saturated neon accents.

**Anchor references:**

1. **Headspace** (2019–2022 product UI) — pastel wellness without illustration dependency
2. **Things 3** — white card elevation on soft neutral shell; typographic hierarchy over chrome
3. **Linear** (light mode) — restrained ink-on-surface contrast, single accent discipline

**Calm dark derivation:** Shell anchors at `#1E2433`; accents desaturate ~25% and lift luminance ~15% vs light counterparts so CTAs remain AA on dark cards without glowing neon.

## 4. Scope

| Dimension | Value |
| --- | --- |
| Fidelity | Production-ready tokens + spec (component remap in Phases 3–5) |
| Breadth | Full wedge surface family |
| Interactivity | Theme toggle (Phase 2); Phase 1 ships infrastructure only |
| Time intent | Ship-quality spec; contrast validated at token level |

## 5. Layout Strategy

Unchanged information architecture — shell gradient → task list column → timer/overlay focal points. Elevation shifts from glass opacity stacks to **solid white cards + soft border + subtle shadow** on light; dark retains flat elevated surfaces without glass blur. Timer remains visual hero; task rows are secondary raised surfaces.

## 6. Key States

| State | Light | Dark |
| --- | --- | --- |
| Default home | Linen→lavender gradient, dark ink on white cards | `#1E2433` shell, light ink on `#2A3142` cards |
| Active task row | White card, `text-primary` | Elevated card, `text-primary` |
| Completed row | Muted card, `text-dimmed` + strikethrough | Same hierarchy, desaturated |
| Selected/focus | `ring-2 ring-focus` | Same semantic ring, lighter plum |
| Overlay | Mist scrim `rgba(248,246,243,0.72)` | Subdued scrim `rgba(30,36,51,0.78)` |
| Break overlay | Soft teal tint surface | Desaturated teal on dark break surface |
| Empty / guest | Amber warning on light card tokens | Amber retained, readable on dark card |

## 7. Interaction Model

Phase 1: no UI toggle yet. Theme infrastructure supports `data-theme="light"|"dark"` on `<html>`. Phase 2 adds user-menu radiogroup (Light / Dark / System) with `localStorage` persistence and blocking script for FOUC prevention.

Motion unchanged: overlay-enter 200ms, task-complete 400ms, reduced-motion respected.

## 8. Content Requirements

No copy changes. Typography softens wedge headings from `font-bold` to `font-semibold` (wordmark, overlay headings, timer). Geist Sans retained throughout.

## 9. Recommended References

- `reference/product.md` — app register, calm-over-clever
- `reference/typeset.md` — heading weight softening
- `reference/colorize.md` — dual-theme accent derivation

## 10. Token Contract (both themes)

### Light-default (FLO-62 committed)

| Role | Hex / value |
| --- | --- |
| Shell top | `#FAF8F5` |
| Shell bottom | `#F0EBF8` |
| Card surface | `#FFFFFF` |
| Card border | `#E5E0EB` |
| Card shadow | `rgba(45, 42, 53, 0.08)` |
| Scrim | `rgba(248, 246, 243, 0.72)` |
| Text primary | `#2D2A35` |
| Text secondary | `#5C5768` |
| Text dimmed | `#9B96A8` |
| CTA | `#5E5290` |
| CTA hover | `#6E619F` |
| On CTA | `#FFFFFF` |
| Break | `#3D8F82` |
| Success | `#3A8F65` |
| Focus ring | `#7C6EAD` |
| Segment active | `#5E5290` |
| Segment inactive | `#E8E4EF` |

### Calm dark (derived)

| Role | Hex / value |
| --- | --- |
| Shell top / bottom | `#1E2433` → `#252B3D` |
| Card surface | `#2A3142` |
| Card border | `rgba(255, 255, 255, 0.1)` |
| Scrim | `rgba(30, 36, 51, 0.78)` |
| Text primary | `#F5F3F0` |
| CTA | `#9B8FC4` |
| CTA hover | `#A99DC8` |
| Break | `#4A9A8E` |
| Success | `#4A9468` |
| Focus ring | `#A99DC8` |

### Contrast targets

- Body text (`text-primary`) ≥ 4.5:1 on shell and card surfaces (both themes)
- CTA label (`on-cta` on `accent-cta`) ≥ 4.5:1 (both themes)
- Focus ring visible ≥ 3:1 against card background

## Open Questions

None — FLO-62 hex values are committed; calm dark derived values validated at token level in Phase 1 manual check (devtools `data-theme` toggle).
