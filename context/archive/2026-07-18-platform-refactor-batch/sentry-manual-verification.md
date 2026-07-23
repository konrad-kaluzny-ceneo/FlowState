# Phase 3: Sentry Manual Verification Guide

> **Status:** 3.4 / 3.5 są ODŁOŻONE — wymagają konta Sentry i prawdziwego DSN od użytkownika.
> Cała automatyczna weryfikacja (3.1–3.3) przeszła bez DSN.

## Gdzie mieszka konfiguracja

| Plik | Runtime | Rola |
| --- | --- | --- |
| `src/instrumentation.ts` | node + edge | hook Next.js; ładuje configi, eksportuje `onRequestError` |
| `src/instrumentation-client.ts` | przeglądarka | `Sentry.init` klienta + `onRouterTransitionStart` |
| `sentry.server.config.ts` | node | `Sentry.init` serwera |
| `sentry.edge.config.ts` | edge | `Sentry.init` edge |
| `next.config.js` | build | `withSentryConfig` — upload source map tylko przy `SENTRY_AUTH_TOKEN` |

Każdy `Sentry.init` jest bramkowany na `NEXT_PUBLIC_SENTRY_DSN`. Bez DSN nie powstaje transport,
a klientowy kod Sentry jest usuwany przez tree-shaking (potwierdzone: `replayIntegration` nie
występuje w żadnym chunku `.next/static` po `pnpm build` bez DSN).

> **Uwaga:** `NEXT_PUBLIC_*` jest wstrzykiwane w czasie **buildu**. Ustawienie DSN wyłącznie w
> runtime (np. w panelu Vercela bez rebuildu) nie włączy Sentry po stronie klienta — konieczny
> jest ponowny build.

## Krok 1: Utwórz projekt Sentry (jeśli nie masz)

1. Wejdź na [sentry.io](https://sentry.io) → utwórz darmowe konto lub zaloguj się
2. Utwórz nowy projekt: **Platform** → **Next.js**
3. Skopiuj **DSN** (wygląda jak `https://abc123@o123456.ingest.sentry.io/1234567`)

## Krok 2: Ustaw zmienną w `.env.local`

```env
NEXT_PUBLIC_SENTRY_DSN="https://your-key@o123456.ingest.sentry.io/1234567"
```

## Krok 3: Weryfikacja z DSN (test 3.4)

1. Uruchom `pnpm dev`
2. **Test serwera** — dodaj tymczasowo `throw new Error("Sentry server test")` w dowolnym server component lub API route (np. na początku `src/app/api/health/route.ts` w handlerze GET)
3. **Test klienta** — otwórz konsolę przeglądarki na stronie i wpisz:
   ```js
   throw new Error("Sentry client test")
   ```
   Albo dodaj tymczasowy `throw` w dowolnym client component.
4. Sprawdź w Sentry dashboard (Issues) czy oba errory się pojawiły (może zająć ~10-30 sekund)

## Krok 4: Weryfikacja bez DSN (test 3.5)

1. Usuń lub zakomentuj `NEXT_PUBLIC_SENTRY_DSN` w `.env.local`
2. Zrestartuj `pnpm dev`
3. Sprawdź w DevTools → Network, że żadne requesty nie idą do `sentry.io` / `ingest.sentry.io`
4. Dev server bootuje czysto, bez błędów/warningów o Sentry

## Wynik

- [ ] 3.4 — Thrown error pojawia się w Sentry (client + server)
- [ ] 3.5 — DSN unset → dev bootuje czysto, brak Sentry traffic
