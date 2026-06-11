# Product

## Register

product

## Users

Dynamic knowledge workers — developers, analysts, team contributors — whose workday is structurally interrupt-driven. They use FlowState during focus gaps between interruptions, not to capture more tasks but to answer "what do I do right now?" and recover context after disruption. Sessions are short-burst Pomodoro cycles linked to a single selected task.

## Product Purpose

FlowState enforces mindful Pomodoro cycles bound to tasks and, after each cycle, suggests the next task with a one-line rationale the user can accept or override. Success is a calm end-of-day feeling — clear separation of completed vs. remaining work — not maximum throughput. The wedge is session-aware next-task suggestion with rationale; without it, FlowState is a generic task list.

## Brand Personality

Calm, focused, restrained. Three words: **mindful**, **clear**, **trustworthy**. The interface should feel like a quiet room, not a productivity dashboard shouting for attention. Visual craft supports focus; it never competes with the timer or the next decision.

## Anti-references

- Arcade or surprise completion animations (FR-016 rejects "surprise arcade")
- Purple-gradient AI-slop hero patterns and glassmorphism for decoration alone
- Dense analytics dashboards, charts, or trend visualizations (out of MVP scope)
- Throughput-first task managers (Todoist/Asana density as aesthetic target)
- Bolder/expressive motion that delays perceived interaction (violates 200ms NFR)
- Inconsistent primary accents across surfaces (current blue/indigo auth vs purple home — unify at token level)

## Design Principles

1. **Calm over clever** — every visual element earns its place; subtract before adding.
2. **Wedge surfaces first** — home shell, task list hierarchy, cycle transition overlays carry the brand; settings and edge flows inherit tokens.
3. **State before decoration** — color and motion convey energy, focus, and completion; not wallpaper.
4. **Trust through clarity** — active vs. completed tasks, selected focus task, and overlay gates must read instantly without reading copy.
5. **Instant acknowledgement** — interactive surfaces respond within 200ms perceived latency; motion never blocks the first feedback frame.

## Accessibility & Inclusion

- Target WCAG 2.1 AA for contrast on primary text and CTAs against dark shell surfaces.
- Respect `prefers-reduced-motion`: skip overlay translate/scale; keep opacity-only or instant transitions.
- Energy states (Focused/Steady/Fading) must not rely on color alone — label + optional icon per state.
- Focus rings remain visible for keyboard navigation; preserve existing e2e focus-ring class contract until S-12 updates tests alongside visual restyle.
