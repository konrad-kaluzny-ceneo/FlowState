# Implementation Plan: Neon Auth Integration

## Overview

This plan integrates Neon Auth into the FlowState Next.js application, covering SDK setup, auth API routes, middleware-based route protection, sign-up/sign-in/sign-out flows, tRPC session context with a `protectedProcedure`, user-task ownership enforcement, and auth UI pages. Each task builds incrementally so the application remains functional at every checkpoint.

## Tasks

- [x] 1. Install dependencies and configure environment
  - [x] 1.1 Install `@neondatabase/auth` package and add environment variables to schema
    - Run `pnpm add @neondatabase/auth`
    - Add `NEON_AUTH_BASE_URL` (validated as URL starting with `https://`) and `NEON_AUTH_COOKIE_SECRET` (min 32 chars) to the server schema in `src/env.js`
    - Add both variables to the `runtimeEnv` object
    - Update `.env.example` with placeholder entries for the new variables
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 1.7_

  - [x] 1.2 Write property tests for environment schema validation
    - **Property 1: Environment schema validates URL format and secret length**
    - **Validates: Requirements 1.6, 1.7**
    - Use fast-check to generate random strings and verify the schema accepts only `https://` URLs for `NEON_AUTH_BASE_URL` and strings ≥32 chars for `NEON_AUTH_COOKIE_SECRET`

- [x] 2. Create auth server and client instances
  - [x] 2.1 Create auth server instance at `src/lib/auth/server.ts`
    - Import `createNeonAuth` from `@neondatabase/auth/next/server`
    - Configure with `baseUrl` from `process.env.NEON_AUTH_BASE_URL` and `cookies.secret` from `process.env.NEON_AUTH_COOKIE_SECRET`
    - Export the `auth` object
    - _Requirements: 1.2_

  - [x] 2.2 Create auth client instance at `src/lib/auth/client.ts`
    - Add `"use client"` directive
    - Import `createAuthClient` from `@neondatabase/auth/next`
    - Export the `authClient` object
    - _Requirements: 1.3_

  - [x] 2.3 Create auth API catch-all route at `src/app/api/auth/[...path]/route.ts`
    - Import `auth` from `~/lib/auth/server`
    - Export `GET` and `POST` handlers from `auth.handler()`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 3. Implement middleware for route protection
  - [x] 3.1 Create `src/middleware.ts` with session validation and route exclusion
    - Import `auth` from `~/lib/auth/server`
    - Configure `auth.middleware()` with `loginUrl: "/auth/sign-in"`
    - Set the `config.matcher` to exclude `_next/static`, `_next/image`, `favicon.ico`, `api/auth`, and `auth/` paths
    - The SDK handles session validation, token refresh (Req 3.5), refresh failure tolerance (Req 3.6), and `redirectTo` query parameter (Req 3.2)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 3.2 Write property tests for middleware route exclusion logic
    - **Property 3: Middleware route exclusion**
    - **Validates: Requirements 3.4**
    - Use fast-check to generate paths matching exclusion patterns and verify they bypass session validation

- [x] 4. Extend tRPC context with session and create protectedProcedure
  - [x] 4.1 Add session to tRPC context in `src/server/api/trpc.ts`
    - Import `auth` from `~/lib/auth/server`
    - In `createTRPCContext`, call `auth.getSession()` once, wrap in try/catch
    - Map the result to `{ user: { id, email, name } } | null` in the context
    - If `getSession()` throws or returns incomplete data, set session to `null`
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 4.2 Create `protectedProcedure` in `src/server/api/trpc.ts`
    - Add `enforceAuth` middleware that checks `ctx.session?.user` has non-null `id`, `email`, and `name`
    - Throw `TRPCError({ code: "UNAUTHORIZED" })` if any check fails
    - Export `protectedProcedure` using `timingMiddleware` then `enforceAuth`
    - Ensure TypeScript types guarantee non-nullable user properties in the procedure context
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 4.3 Write property tests for tRPC context session mapping
    - **Property 7: tRPC context session mapping**
    - **Validates: Requirements 7.1, 7.2, 7.4**
    - Use fast-check to generate various `getSession()` return shapes and verify correct context mapping

  - [x] 4.4 Write property tests for protectedProcedure enforcement
    - **Property 8: protectedProcedure enforcement**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
    - Use fast-check to generate context states with various session shapes and verify allow/throw behavior

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Add userId column to tasks table and update task router
  - [x] 6.1 Add `userId` column and index to the tasks schema in `src/server/db/schema.ts`
    - Add `userId: varchar("user_id", { length: 255 }).notNull()` to the tasks table
    - Add `index("task_user_id_idx").on(t.userId)` to the table indexes
    - Run `pnpm db:generate` to create the migration
    - Note: The migration for existing data (making nullable first, backfilling, then NOT NULL) should be handled as a custom SQL step per the design's migration strategy
    - _Requirements: 9.1, 9.7_

  - [x] 6.2 Update task router to use `protectedProcedure` and enforce ownership
    - Change all procedures in `src/server/api/routers/task.ts` from `publicProcedure` to `protectedProcedure`
    - **list**: Filter by `eq(tasks.userId, ctx.session.user.id)`
    - **create**: Include `userId: ctx.session.user.id` in the insert values
    - **update**: Add `and(eq(tasks.id, id), eq(tasks.userId, ctx.session.user.id))` to the where clause; throw `NOT_FOUND` if no rows affected
    - **delete**: Add `and(eq(tasks.id, id), eq(tasks.userId, ctx.session.user.id))` to the where clause; throw `NOT_FOUND` if no rows affected
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 6.3 Write property tests for task creation ownership
    - **Property 9: Task creation ownership**
    - **Validates: Requirements 9.2**
    - Use fast-check to generate user IDs and task titles, verify the created task always has the correct userId

  - [x] 6.4 Write property tests for task query isolation
    - **Property 10: Task query isolation**
    - **Validates: Requirements 9.3**
    - Use fast-check to generate multi-user task sets, verify each user only sees their own tasks

  - [x] 6.5 Write property tests for task mutation ownership
    - **Property 11: Task mutation ownership with NOT_FOUND on failure**
    - **Validates: Requirements 9.4, 9.5**
    - Use fast-check to generate user/task ownership combinations, verify success only when userId matches and NOT_FOUND otherwise

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement auth UI pages
  - [x] 8.1 Create sign-up page at `src/app/auth/sign-up/page.tsx` with server action
    - Create a form with name (1–100 chars), email (valid format, max 254 chars), and password (8–128 chars) fields
    - Use `useActionState` (React 19) for pending state and error handling
    - Implement client-side Zod validation: reject empty/whitespace-only names, invalid emails, and passwords outside 8–128 chars
    - Call `auth.signUp.email()` in the server action; on success redirect to `/`
    - Handle duplicate email error by displaying message and preserving form data
    - Handle network errors with a user-friendly retry message, preserving form data
    - Include a link to `/auth/sign-in`
    - Use Tailwind CSS, responsive from 320px to 1920px
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 8.2 Create sign-in page at `src/app/auth/sign-in/page.tsx` with server action
    - Create a form with email (max 254 chars) and password (max 128 chars) fields
    - Use `useActionState` (React 19) for pending state and error handling
    - Implement client-side validation: reject empty email or password fields
    - Call `auth.signIn.email()` in the server action; on success redirect to `/`
    - Handle invalid credentials with a generic error message, preserving email
    - Handle network errors with a user-friendly retry message, preserving form data
    - Include a link to `/auth/sign-up`
    - Use Tailwind CSS, responsive from 320px to 1920px
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 10.1, 10.3, 10.4, 10.5, 10.6_

  - [x] 8.3 Write property tests for sign-up client-side validation
    - **Property 4: Sign-up client-side validation rejects invalid input**
    - **Validates: Requirements 4.4**
    - Use fast-check to generate invalid names (empty/whitespace) and invalid emails, verify form shows errors and does not submit

  - [x] 8.4 Write property tests for password length boundary validation
    - **Property 5: Password length boundary validation**
    - **Validates: Requirements 4.5**
    - Use fast-check to generate passwords of varying lengths, verify rejection below 8 and above 128, acceptance between 8–128

  - [x] 8.5 Write property tests for sign-in client-side validation
    - **Property 6: Sign-in client-side validation rejects empty fields**
    - **Validates: Requirements 5.6**
    - Use fast-check to generate empty/non-empty field combinations, verify validation behavior

- [x] 9. Implement sign-out functionality
  - [x] 9.1 Create a sign-out UI component and wire into the app layout
    - Create a `UserMenu` component (or similar) that displays the user's name and a sign-out button
    - On sign-out click, call `authClient.signOut()` from the client SDK
    - On success: clear React Query cache, redirect to `/auth/sign-in`
    - On failure: display an error toast/message, retain user on current page
    - Render the component in the app layout for all protected routes
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 9.2 Write property tests for error clearing on new submission
    - **Property 12: Error clearing on new submission**
    - **Validates: Requirements 10.5**
    - Use fast-check to generate error states and new submissions, verify all previous errors are cleared

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The migration strategy for existing tasks (Req 9.7) requires a custom SQL step — generate the migration with `pnpm db:generate`, then manually adjust the generated SQL to add the column as nullable first, backfill, then alter to NOT NULL
- Run `pnpm db:migrate` to apply migrations after generation
- All auth pages use `useActionState` (React 19) for form state management — no additional form libraries needed

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3", "3.1"] },
    { "id": 3, "tasks": ["3.2", "4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3"] },
    { "id": 5, "tasks": ["4.4", "6.1"] },
    { "id": 6, "tasks": ["6.2"] },
    { "id": 7, "tasks": ["6.3", "6.4", "6.5", "8.1", "8.2"] },
    { "id": 8, "tasks": ["8.3", "8.4", "8.5", "9.1"] },
    { "id": 9, "tasks": ["9.2"] }
  ]
}
```
