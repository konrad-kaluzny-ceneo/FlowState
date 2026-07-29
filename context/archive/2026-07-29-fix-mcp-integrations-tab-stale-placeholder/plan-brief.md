# Fix MCP Integrations Tab Stale Placeholder — Plan Brief

> Full plan: `context/changes/fix-mcp-integrations-tab-stale-placeholder/plan.md`

## What & Why

The Settings → Integracje tab still shows a dead "Integracja MCP wkrótce" (coming soon) mock directly below the real, working API-keys panel, even though MCP shipped weeks ago — and nothing on the page tells a user what an API key actually connects to or what an agent can do with it. This plan removes the stale mock and adds real setup instructions.

## Starting Point

`ApiKeysPanel` (key create/reveal-once/revoke) is real and working. `/api/mcp` is a live, Bearer-token-authenticated MCP server with 8 tools (5 read, 3 write). Right below the working panel, `ustawienia-view.tsx` still renders a leftover `ComingSoonPreview`/`McpIntegrationMock` block from before the real feature shipped, with a button that does nothing.

## Desired End State

Opening Integracje as a signed-in user shows only the real key panel, now followed by setup instructions: the live endpoint, the Bearer-auth format, a short read/write tool summary, and a copyable generic MCP client config snippet. No dead "coming soon" UI remains anywhere in the tab.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Instruction placement | Inside `ApiKeysPanel`, below the key list | Key creation and "what do I do with it" read as one panel, no new top-level component | Plan |
| Tool detail depth | Short grouped read/write summary, no per-tool list | Answers "what does it allow" without hand-maintaining an 8-tool list in two locales | Plan |
| Guest visibility | Authenticated only | Instructions reference a concrete key/endpoint flow meaningless without a key; matches existing guest gating | Plan |
| Client config | Include one generic `mcpServers` JSON snippet | Copy-paste is the fastest path from "I have a key" to "it's connected" | Plan |
| Endpoint origin | Computed via `useEffect` + `window.location.origin`, not read inline | Reading `window` during render would mismatch SSR/client hydration | Plan |
| Secret handling | Snippet always shows `YOUR_API_KEY` placeholder, never the live revealed key | Avoids binding a static snippet to a transient, dismissible reveal state | Plan |

## Scope

**In scope:**
- Delete `ComingSoonPreview`/`McpIntegrationMock` block and its 4 dead i18n keys (both locales)
- Add setup-instructions block to `AuthenticatedApiKeysPanel`: endpoint, Bearer-auth line, grouped tool summary, copyable JSON config snippet
- New/updated i18n keys under `Settings.apiKeys` (PL + EN)
- Update `ustawienia-view.test.tsx` (remove stale assertion, add coverage for the new block)

**Out of scope:**
- Any change to the MCP server, its tools, or the `apiKey` router
- Per-client (Claude Desktop / Cursor / etc.) config generators — one generic snippet only
- Locale-parity automated tooling
- Guest-visible MCP explainer content

## Architecture / Approach

Pure client-side UI change across 3 files (`ustawienia-view.tsx`, `api-keys-panel.tsx`, two locale JSONs) plus their test file. No server, router, or data-model changes — the endpoint and tools already exist and are correct; this only fixes what the Settings UI tells the user about them.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Remove stale MCP mock | Dead placeholder + i18n keys gone; stale test updated | Missing a lingering reference (test id, i18n key) elsewhere — mitigated by repo-wide grep in success criteria |
| 2. Add MCP setup instructions | Real endpoint/auth/tool-summary/config-snippet block in `ApiKeysPanel` | Hydration mismatch if origin is read directly during render instead of via `useEffect` |

**Prerequisites:** None — MCP server and API-keys panel are already shipped and merged.
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- Assumes no other surface (e2e specs, other components) references the removed test ids or i18n keys — confirmed via repo-wide grep during research, but re-verify after the edit.
- Assumes a single generic `mcpServers` JSON shape is understood well enough by users to adapt to their specific client; if user feedback says otherwise, a follow-up could add per-client variants.

## Success Criteria (Summary)

- No "coming soon" MCP card or non-functional button anywhere on the Integracje tab.
- A signed-in user can read the endpoint, auth format, and tool summary, and copy a working config snippet, without leaving Settings.
- Guests see unchanged behavior (sign-in prompt only, no instructions).
