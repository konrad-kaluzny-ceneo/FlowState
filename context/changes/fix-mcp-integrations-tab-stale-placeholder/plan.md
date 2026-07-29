# Fix MCP Integrations Tab Stale Placeholder — Implementation Plan

## Overview

The Settings → Integracje tab shows a dead "MCP integration coming soon" mock directly below the real, working API-keys panel, and nothing on the page explains what an API key is for. This plan removes the stale mock and its i18n strings, then adds real MCP setup instructions (endpoint, Bearer auth, tool summary, copyable client config) into the existing `ApiKeysPanel`.

## Current State Analysis

- `src/app/_components/ustawienia-view.tsx:449-474` renders `<ApiKeysPanel isAuthenticated={isAuthenticated} />` (real, working key CRUD) immediately followed by a `ComingSoonPreview`/`McpIntegrationMock` block (`ustawienia-view.tsx:481-500`) — a static card with a non-functional "Połącz przez MCP" button.
- Four dead i18n keys back the mock: `Settings.mcpComingSoon`, `Settings.mcpMockTitle`, `Settings.mcpMockDescription`, `Settings.mcpMockConnect` (`messages/pl.json:756-759`, `messages/en.json:756-759`).
- The real MCP server is live at `/api/mcp` (`src/app/api/mcp/route.ts`): stateless Streamable HTTP, Bearer-token auth via `withMcpAuth` + `verifyApiKey`, using the same key minted by `ApiKeysPanel`.
- The tool surface is fixed in `src/app/api/mcp/mcp-tools.ts:320-434`: 5 read-only tools (`list_tasks`, `get_session_state`, `get_day_stats`, `get_day_plan`, `get_next_suggestion`) and 3 write tools gated to `READ_WRITE` keys (`create_task`, `update_task`, `complete_task`).
- `ApiKeysPanel` (`src/app/_components/api-keys-panel.tsx`) already splits guest (sign-in prompt, `api-keys-panel.tsx:22-52`) vs authenticated (`AuthenticatedApiKeysPanel`, `api-keys-panel.tsx:57-329`) rendering, and owns the `Settings.apiKeys` i18n namespace. It has no test file of its own — it's exercised through `src/app/_components/ustawienia-view.test.tsx`, including one test (`ustawienia-view.test.tsx:212-225`) that currently asserts the stale mock renders.
- `ComingSoonPreview` (`src/app/_components/ui/coming-soon-preview.tsx`) is shared with `podsumowanie-view.tsx` and `plan-dnia-view.tsx` — only its usage in `ustawienia-view.tsx` is removed, not the component itself.

### Key Discoveries:

- No automated locale-parity test exists between `messages/pl.json` and `messages/en.json` — parity must be kept manually.
- `AuthenticatedApiKeysPanel` already has a working clipboard-copy pattern (`handleCopy`, `api-keys-panel.tsx:108-118`) that the new config-copy button should mirror.
- `Settings.apiKeys.copy` / `Settings.apiKeys.copied` already exist and read naturally for a second copy button — no new copy/copied strings needed.

## Desired End State

Opening Settings → Integracje as an authenticated user shows only the real `ApiKeysPanel`: key creation/list/revoke, followed by a setup-instructions block (endpoint, Bearer-auth explanation, grouped read/write tool summary, and a copyable generic MCP client config snippet). No "coming soon" mock or dead button remains anywhere in the tab. Guests still see only the existing sign-in prompt.

**Verify:** `pnpm exec vitest run src/app/_components/ustawienia-view.test.tsx`, `pnpm typecheck`, `pnpm check`, plus manual load of `/ustawienia` → Integracje tab in both `pl` and `en` locales.

## What We're NOT Doing

- Not changing the MCP server, its tools, or the `apiKey` router — the endpoint and tool set are already shipped and correct.
- Not building a per-client (Claude Desktop vs. Cursor vs. other) config generator — one generic `mcpServers`-shaped JSON snippet only.
- Not adding a locale-parity test/lint — out of scope for this bug fix.
- Not showing MCP instructions to guests — guest state stays the existing sign-in prompt.

## Implementation Approach

Two sequential edits to two files: first delete the dead mock and its strings (safe, isolated removal), then add the real instructions block to `ApiKeysPanel` (additive, new i18n keys). Splitting this way means the "remove stale/misleading UI" fix can be verified independently of the "add new content" fix.

## Critical Implementation Details

**Endpoint display avoids a hydration mismatch.** The instructions need the full MCP endpoint (`{origin}/api/mcp`), but `AuthenticatedApiKeysPanel` can be server-rendered before `window` exists. Compute the origin in a `useEffect` into local state (initial value `null`, rendering a lightweight placeholder such as `/api/mcp` on first paint) rather than reading `window.location.origin` directly during render — reading it inline would render `""` on the server and the real origin on the client, mismatching hydration.

**Config snippet always uses a redacted placeholder, never the live revealed key.** Even when `revealedKey` is currently set (right after creating a key), the config snippet's `Authorization` value stays the literal placeholder `YOUR_API_KEY`. The reveal panel is a separate, dismissible, security-conscious surface (`api-keys-panel.tsx:145-196`); binding the snippet to that transient state would either go stale the moment the user dismisses it or make it too easy to copy a live secret into a snippet that gets pasted elsewhere.

## Phase 1: Remove stale MCP mock

### Overview

Delete the dead "coming soon" block and its backing i18n keys from both locales; update the one test that currently depends on it.

### Changes Required:

#### 1. Settings view — remove the mock

**File**: `src/app/_components/ustawienia-view.tsx`

**Intent**: Remove the `ComingSoonPreview`/`McpIntegrationMock` block rendered after `<ApiKeysPanel />` in the `integrations` tab branch, and remove the now-unused `McpIntegrationMock` function and `ComingSoonPreview` import (confirm no other usage in this file before removing the import).

**Contract**: `ustawienia-view.tsx:449-474` integrations branch renders only `<ApiKeysPanel isAuthenticated={isAuthenticated} />` inside the existing `<section>`; the `McpIntegrationMock` function (`ustawienia-view.tsx:481-500`) is deleted entirely.

#### 2. Locale files — remove dead keys

**File**: `messages/pl.json`, `messages/en.json`

**Intent**: Remove the four now-unused keys that only backed the mock.

**Contract**: Delete `Settings.mcpComingSoon`, `Settings.mcpMockTitle`, `Settings.mcpMockDescription`, `Settings.mcpMockConnect` from both files (`pl.json:756-759`, `en.json:756-759`), keeping `Settings.integrationsBody` and the `Settings.apiKeys` block untouched.

#### 3. Settings view test — drop the stale assertion

**File**: `src/app/_components/ustawienia-view.test.tsx`

**Intent**: Remove the test that asserts the stale mock renders (`ustawienia-view.test.tsx:212-225`, `"renders MCP coming soon preview on integrations tab"`) — it will be superseded by the Phase 2 test for the real instructions block.

**Contract**: Delete the `it("renders MCP coming soon preview on integrations tab", ...)` block; no other test in this file references `settings-mcp-preview` or `mcpComingSoon` afterward (confirmed via repo-wide grep in research).

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `pnpm exec vitest run src/app/_components/ustawienia-view.test.tsx`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm check`
- Repo-wide grep confirms no remaining references: no matches for `mcpComingSoon|mcpMock|McpIntegrationMock|settings-mcp-preview` under `src/`, `messages/`

#### Manual Verification:

- Load `/ustawienia`, open Integracje tab as an authenticated user — no blurred "coming soon" card or "Połącz przez MCP" button appears below the API keys panel
- Same check in English locale

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Add MCP setup instructions to ApiKeysPanel

### Overview

Add a setup-instructions block to `AuthenticatedApiKeysPanel`, below the existing key list, covering the endpoint, Bearer-auth format, a short grouped tool summary, and a copyable generic client config snippet.

### Changes Required:

#### 1. ApiKeysPanel — origin state + instructions block

**File**: `src/app/_components/api-keys-panel.tsx`

**Intent**: In `AuthenticatedApiKeysPanel`, add local state for the resolved origin (populated from `window.location.origin` in a `useEffect`, per Critical Implementation Details) and a new state + handler for copying the config snippet, mirroring the existing `handleCopy`/`copied` pattern. Render a new instructions section after the key-list `<div>` (`api-keys-panel.tsx:249-326`), inside the same `<section>`: a heading, one intro line, the endpoint shown as inline `<code>` (styled like `api-key-reveal-value`), the Bearer-auth line, two grouped tool-summary lines (read / write), and a `<pre><code>` block with the JSON config snippet plus a copy button reusing `t("copy")`/`t("copied")`.

**Contract**: JSON snippet shape (origin substituted, key placeholder fixed):
```json
{
  "mcpServers": {
    "flowstate": {
      "url": "<origin>/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```
New test ids: `mcp-setup-section`, `mcp-setup-endpoint`, `mcp-setup-config`, `mcp-setup-copy-config`.

#### 2. Locale files — new instruction keys

**File**: `messages/pl.json`, `messages/en.json`

**Intent**: Add setup-instruction copy under `Settings.apiKeys`, following the product voice contract (calm, factual, second person, no gamification) — see `context/foundation/product-voice.md`.

**Contract**: New keys inside `Settings.apiKeys` (same nesting level as `title`/`body`): `setupTitle`, `setupIntro`, `endpointLabel`, `authLabel`, `toolsReadLabel`, `toolsWriteLabel`, `configLabel`. Reuse existing `copy`/`copied` for the new copy button — no new copy/copied strings.

EN values:
- `setupTitle`: "Connect an AI agent"
- `setupIntro`: "Point your MCP client at this endpoint and use your key above as the Bearer token."
- `endpointLabel`: "Endpoint"
- `authLabel`: "Authorization: Bearer <your API key>"
- `toolsReadLabel`: "Read access: tasks, session state, day stats and plan, next-task suggestion."
- `toolsWriteLabel`: "Write access (read-write keys only): create, update, and complete tasks."
- `configLabel`: "Client config"

PL values:
- `setupTitle`: "Połącz agenta AI"
- `setupIntro`: "Wskaż ten punkt końcowy w swoim kliencie MCP i użyj klucza powyżej jako tokenu Bearer."
- `endpointLabel`: "Punkt końcowy"
- `authLabel`: "Autoryzacja: Bearer <Twój klucz API>"
- `toolsReadLabel`: "Odczyt: zadania, stan sesji, statystyki i plan dnia, sugestia następnego zadania."
- `toolsWriteLabel`: "Zapis (tylko klucze do odczytu i zapisu): tworzenie, aktualizacja i ukończanie zadań."
- `configLabel`: "Konfiguracja klienta"

#### 3. Settings view test — cover the new instructions

**File**: `src/app/_components/ustawienia-view.test.tsx`

**Intent**: Add a test replacing the removed Phase 1 assertion: on the integrations tab, the instructions block renders with the expected endpoint text and a working copy button; guests still see no instructions (only the existing sign-in prompt).

**Contract**: New `it(...)` block(s) asserting `screen.getByTestId("mcp-setup-section")` renders for an authenticated user, `screen.getByTestId("mcp-setup-endpoint")` contains `/api/mcp`, clicking `mcp-setup-copy-config` calls a stubbed `navigator.clipboard.writeText`, and `screen.queryByTestId("mcp-setup-section")` is null for `scope={{ mode: "guest" }}`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `pnpm exec vitest run src/app/_components/ustawienia-view.test.tsx`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm check`

#### Manual Verification:

- Load `/ustawienia` → Integracje as an authenticated user: instructions block shows the real endpoint (matching the browser's current origin + `/api/mcp`), Bearer-auth line, read/write tool summary, and a config snippet
- Click the config-snippet copy button — clipboard receives the JSON with the correct origin and `YOUR_API_KEY` placeholder (paste to confirm)
- Toggle language switch between PL/EN — all new strings translate correctly, no missing-key fallback text
- Guest (unauthenticated) view of the Integracje tab still shows only the existing sign-in prompt, no instructions block

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Phase 1: no stale mock/test ids remain; existing integrations-tab render tests still pass.
- Phase 2: instructions render for authenticated users with correct endpoint text; hidden for guests; copy button invokes `navigator.clipboard.writeText` with the expected JSON string.

### Integration Tests:

- None needed — this is a pure client-rendering change with no server/router surface touched.

### Manual Testing Steps:

1. Sign in, open Settings → Integracje, confirm no "coming soon" card renders below the API keys panel.
2. Confirm the new instructions block shows the correct live endpoint, Bearer-auth line, and grouped tool summary.
3. Click "Copy" on the config snippet, paste elsewhere, confirm it's valid JSON with the real origin and a `YOUR_API_KEY` placeholder (not a real secret).
4. Switch language to English and back to Polish — verify all new strings translate with no fallback/raw-key text.
5. Log out (or open in a guest/incognito context) and confirm the Integracje tab shows only the existing sign-in prompt — no instructions block.

## Performance Considerations

None — static text plus one `useEffect` reading `window.location.origin` once on mount; no new network calls.

## Migration Notes

Not applicable — no data model or persisted-state changes.

## References

- Bug confirmation: `context/changes/fix-mcp-integrations-tab-stale-placeholder/bug.md`
- MCP server plan brief: `context/archive/2026-07-24-mcp-server-for-agents/plan-brief.md`
- MCP tool registry: `src/app/api/mcp/mcp-tools.ts:320-434`
- Product voice contract: `context/foundation/product-voice.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Remove stale MCP mock

#### Automated

- [x] 1.1 Unit tests pass: `pnpm exec vitest run src/app/_components/ustawienia-view.test.tsx`
- [x] 1.2 Type checking passes: `pnpm typecheck`
- [x] 1.3 Linting passes: `pnpm check`
- [x] 1.4 Repo-wide grep confirms no remaining references to the stale mock

#### Manual

- [x] 1.5 No "coming soon" card/button on Integracje tab (authenticated, PL)
- [x] 1.6 Same check in English locale

### Phase 2: Add MCP setup instructions to ApiKeysPanel

#### Automated

- [ ] 2.1 Unit tests pass: `pnpm exec vitest run src/app/_components/ustawienia-view.test.tsx`
- [ ] 2.2 Type checking passes: `pnpm typecheck`
- [ ] 2.3 Linting passes: `pnpm check`

#### Manual

- [ ] 2.4 Instructions block shows correct live endpoint, Bearer-auth line, tool summary
- [ ] 2.5 Copy button copies correct JSON (real origin, placeholder key)
- [ ] 2.6 PL/EN toggle shows correct translations, no missing-key fallback
- [ ] 2.7 Guest view still shows only the sign-in prompt, no instructions block
