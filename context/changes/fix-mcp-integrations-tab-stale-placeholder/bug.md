---
change_id: fix-mcp-integrations-tab-stale-placeholder
kind: bug
verdict: confirmed
reported: 2026-07-29
---

# Bug: Integracje tab shows a stale "MCP coming soon" mock beneath the real, shipped MCP key panel — and gives no usage instructions

## Symptom
On the Settings → Integracje tab, directly below the working "Klucze API" panel (create / reveal-once / revoke API keys), a blurred "Integracja MCP wkrótce" ("MCP integration coming soon") preview block still renders, with a fake "Połącz przez MCP" button that does nothing. This contradicts the fact that MCP integration already shipped and is fully functional. Separately, nothing on the page explains what an API key is for, what endpoint to point an MCP client at, what auth format to use, or what the MCP server lets an agent do — a user can only generate a key with no idea what to do with it.

## Trigger
Authenticated user opens Ustawienia (Settings) → Integracje tab (`resolvedTab === "integrations"`).

## Expected
Once MCP integration is live, the Integracje tab should not show a "coming soon" placeholder for it. It should instead show connection instructions: the MCP endpoint (`/api/mcp`), that it's a Bearer-token-authenticated Streamable HTTP MCP server (use the generated API key as the bearer token), and a short summary of what tools are available (task read/write, session/cycle/day-state read, scored next-task suggestion).

## Confirmation
**Verdict:** confirmed

Trace from trigger to symptom:
- `src/app/_components/ustawienia-view.tsx:449-474` — the `integrations` tab branch renders `<ApiKeysPanel isAuthenticated={isAuthenticated} />` (the real, working key-management UI, `src/app/_components/api-keys-panel.tsx`) immediately followed by:
  ```tsx
  <ComingSoonPreview label={t("mcpComingSoon")} testId="settings-mcp-preview">
    <McpIntegrationMock />
  </ComingSoonPreview>
  ```
- `mcpComingSoon` resolves (via `messages/pl.json:756`) to `"Integracja MCP wkrótce"` ("MCP integration coming soon"); English equivalent in `messages/en.json:756`. `McpIntegrationMock` (`ustawienia-view.tsx:481-500`) renders a static card with a non-functional "Połącz przez MCP" button (`mcpMockConnect`, `pl.json:759`).
- This `ComingSoonPreview`/mock pairing predates the real feature: it was introduced by the `2026-07-05-ui-improvement` slice as a placeholder (`context/archive/2026-07-05-ui-improvement/plan.md:382-412`, explicitly "Mock karty MCP owinięty w ComingSoonPreview (z Fazy 5); brak realnej logiki połączenia"). The real MCP server was then delivered by the `mcp-server-for-agents` slice (archived 2026-07-28, `context/archive/2026-07-24-mcp-server-for-agents/`), which added `ApiKeysPanel` + the live endpoint at `src/app/api/mcp/route.ts` (confirmed: `withMcpAuth`, Bearer-token `verifyApiKey`, stateless Streamable HTTP, `basePath: "/api"` → served at `/api/mcp`), but never removed the now-stale placeholder sitting right below it.
- Confirmed no usage instructions exist: `src/app/_components/api-keys-panel.tsx` only exposes create/name/scope/reveal-once/copy/revoke UI (`api-keys-panel.tsx:1-329`, i18n under `Settings.apiKeys` in `messages/pl.json:760-790`) — no mention of the `/api/mcp` endpoint, bearer-auth format, or tool surface anywhere in the rendered UI or its translation strings.
- Tool surface that should be documented is defined in `context/archive/2026-07-24-mcp-server-for-agents/plan-brief.md:16,25`: tasks read/write, session/cycle/day-state read, scored next-task suggestion (writes gated to `READ_WRITE`-scope keys).

## Suspected cause
`src/app/_components/ustawienia-view.tsx:467-472` — leftover `ComingSoonPreview`/`McpIntegrationMock` block (plus its `mcpComingSoon`/`mcpMockTitle`/`mcpMockDescription`/`mcpMockConnect` i18n keys in `messages/pl.json:756-759` and `messages/en.json:756-759`) that the `mcp-server-for-agents` slice should have removed and replaced with real setup instructions when it shipped `/api/mcp` and `ApiKeysPanel`.
