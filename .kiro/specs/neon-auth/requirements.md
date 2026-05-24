# Requirements Document

## Introduction

This document defines the requirements for integrating Neon Auth into the FlowState application. Neon Auth is Neon's built-in authentication solution based on Better Auth that stores users, sessions, and auth configuration directly in the Neon Postgres database. The integration will provide email/password authentication, session management, route protection, and user-task ownership for the existing task management system.

## Glossary

- **Auth_Server**: The Neon Auth server instance configured for the FlowState Neon project, accessible via `NEON_AUTH_BASE_URL`
- **Auth_SDK**: The `@neondatabase/auth` package providing server and client authentication methods
- **Auth_Instance**: The server-side auth object created by `createNeonAuth()` in `lib/auth/server.ts`
- **Auth_Client**: The client-side auth object created by `createAuthClient()` in `lib/auth/client.ts`
- **Session**: An authenticated user's active login state, cached in a signed HTTP-only cookie
- **Middleware**: The Next.js middleware file that intercepts requests to validate sessions and protect routes
- **Protected_Route**: A route that requires an authenticated session to access
- **Public_Route**: A route accessible without authentication (sign-in, sign-up pages)
- **Task_Owner**: The authenticated user who created a task and has exclusive access to it
- **tRPC_Context**: The server-side context object passed to all tRPC procedures, extended with session data

## Requirements

### Requirement 1: SDK Installation and Configuration

**User Story:** As a developer, I want Neon Auth configured in the FlowState project, so that the application can authenticate users against the Neon database.

#### Acceptance Criteria

1. THE Auth_SDK SHALL be installed as a project dependency via `@neondatabase/auth`
2. THE Auth_Instance SHALL be created in `src/lib/auth/server.ts` using `createNeonAuth()` with `baseUrl` sourced from the `NEON_AUTH_BASE_URL` environment variable and `cookies.secret` sourced from the `NEON_AUTH_COOKIE_SECRET` environment variable
3. THE Auth_Client SHALL be created in `src/lib/auth/client.ts` using `createAuthClient()`
4. IF the `NEON_AUTH_BASE_URL` environment variable is missing or empty, THEN THE application SHALL fail to start with a validation error message that includes the variable name and states it is required
5. IF the `NEON_AUTH_COOKIE_SECRET` environment variable is missing or empty, THEN THE application SHALL fail to start with a validation error message that includes the variable name and states it is required
6. THE environment schema in `src/env.js` SHALL declare `NEON_AUTH_BASE_URL` as a required server-side variable validated as a URL starting with `https://`, and `NEON_AUTH_COOKIE_SECRET` as a required server-side string with a minimum length of 32 characters
7. IF the `NEON_AUTH_BASE_URL` environment variable is present but does not start with `https://`, THEN THE application SHALL fail to start with a validation error message indicating the expected URL format

### Requirement 2: Auth API Route Handler

**User Story:** As a developer, I want a catch-all API route that proxies authentication requests to the Neon Auth server, so that sign-up, sign-in, and session operations work correctly.

#### Acceptance Criteria

1. THE Auth_Instance SHALL expose GET and POST handlers at the `/api/auth/[...path]` route
2. WHEN a sign-up request is received with valid credentials, THE Auth_Server SHALL create a new user record in the Neon database and establish a session for the new user
3. WHEN a sign-in request is received with valid credentials, THE Auth_Server SHALL return a session token via a signed HTTP-only cookie
4. WHEN a sign-in request is received with invalid credentials, THE Auth_Server SHALL return an HTTP 401 response with a generic error indication that does not reveal whether the email exists
5. IF the Auth_Server does not respond within 10 seconds, THEN THE API route handler SHALL return an HTTP 502 response with a machine-readable error code string that remains constant across application releases
6. IF a request is received using an HTTP method other than GET or POST, THEN THE API route handler SHALL return an HTTP 405 response

### Requirement 3: Route Protection via Middleware

**User Story:** As a user, I want protected pages to redirect me to sign-in when I am not authenticated, so that my data remains secure.

#### Acceptance Criteria

1. THE Middleware SHALL validate session cookies on every request matching protected route patterns by verifying the cookie is present, not expired, and has a valid signature
2. WHEN an unauthenticated user requests a Protected_Route, THE Middleware SHALL redirect the user to the `/auth/sign-in` page with a `redirectTo` query parameter containing the originally requested path
3. WHEN an authenticated user requests a Protected_Route, THE Middleware SHALL allow the request to proceed
4. THE Middleware SHALL exclude Public_Routes (`/auth/sign-in`, `/auth/sign-up`), static assets (`_next/static`, `_next/image`, `favicon.ico`), and the auth API route (`/api/auth`) from session validation
5. WHEN a session token is within 20% of its total lifetime from expiration, THE Middleware SHALL refresh the session token and attach the updated cookie to the response
6. IF session token refresh fails, THEN THE Middleware SHALL allow the current request to proceed with the existing valid token and not interrupt the user's navigation
7. IF session validation encounters an unexpected error (e.g., malformed cookie, cryptographic verification failure), THEN THE Middleware SHALL treat the request as unauthenticated and redirect to `/auth/sign-in`

### Requirement 4: User Sign-Up

**User Story:** As a new user, I want to create an account with my name, email, and password, so that I can access FlowState.

#### Acceptance Criteria

1. THE sign-up page SHALL be accessible at `/auth/sign-up` without authentication
2. WHEN a user submits valid sign-up credentials (name between 1 and 100 characters, email in valid format up to 254 characters, password between 8 and 128 characters), THE Auth_Instance SHALL create the user account and redirect to the home page
3. WHEN a user submits an email that is already registered, THE Auth_Instance SHALL display an error message indicating the email is already associated with an existing account and SHALL preserve the entered form data (name and email fields)
4. IF a user submits a name that is empty or contains only whitespace, or an email that does not conform to a valid email format, THEN THE sign-up page SHALL display a validation error identifying the invalid field and SHALL not submit the form to the server
5. WHEN a user submits a password shorter than 8 characters or longer than 128 characters, THE Auth_Instance SHALL return a validation error indicating the password must be between 8 and 128 characters
6. IF the sign-up request fails due to a network error, THEN THE sign-up page SHALL display a non-technical error message indicating the request could not be completed, prompt the user to retry, and SHALL preserve all entered form data

### Requirement 5: User Sign-In

**User Story:** As a returning user, I want to sign in with my email and password, so that I can access my tasks.

#### Acceptance Criteria

1. THE sign-in page SHALL be accessible at `/auth/sign-in` without authentication
2. THE sign-in page SHALL present a form with an email field (maximum 254 characters) and a password field (maximum 128 characters)
3. WHEN a user submits valid sign-in credentials, THE Auth_Instance SHALL create a session and redirect to `/`
4. WHEN a user submits invalid credentials, THE Auth_Instance SHALL return a generic error message indicating the credentials are invalid without revealing which field is incorrect, and SHALL preserve the entered email address in the form
5. IF the sign-in request fails due to a network error, THEN THE sign-in page SHALL display an error message indicating the request could not be completed and suggesting the user try again, and SHALL preserve all entered form data
6. IF a user submits the sign-in form with an empty email or empty password field, THEN THE sign-in page SHALL display a validation error indicating which fields are required without submitting the request to the server

### Requirement 6: User Sign-Out

**User Story:** As an authenticated user, I want to sign out of FlowState, so that my session is terminated securely.

#### Acceptance Criteria

1. WHEN a user triggers sign-out, THE Auth_Instance SHALL clear the session cookie and invalidate the server-side session
2. WHEN sign-out completes, THE application SHALL redirect the user to the `/auth/sign-in` page
3. THE sign-out action SHALL be accessible from a UI element visible on all Protected_Routes
4. IF the sign-out request fails due to a network error, THEN THE application SHALL display an error message indicating the sign-out was unsuccessful and retain the user on the current page
5. WHEN sign-out completes, THE application SHALL clear any client-side cached authenticated state before redirecting

### Requirement 7: Session Access in tRPC Context

**User Story:** As a developer, I want the authenticated user's session available in tRPC procedures, so that I can implement user-scoped data access.

#### Acceptance Criteria

1. IF a valid session exists (the Auth_Instance `getSession()` returns a non-null session object), THEN THE tRPC_Context SHALL include a session object containing the user's ID (string), email (string), and name (string or null)
2. IF no valid session exists (the Auth_Instance `getSession()` returns null or the session token is missing, expired, or unverifiable), THEN THE tRPC_Context SHALL include a null session value
3. THE tRPC_Context creation SHALL call the Auth_Instance `getSession()` method exactly once per incoming request and reuse the returned result for all tRPC procedures executed within that same request
4. IF the Auth_Instance `getSession()` call fails due to an unexpected error (network failure, internal exception), THEN THE tRPC_Context SHALL treat the session as null rather than propagating the error to the procedure

### Requirement 8: Protected tRPC Procedures

**User Story:** As a developer, I want a reusable `protectedProcedure` that enforces authentication, so that I can secure tRPC endpoints without repeating auth checks.

#### Acceptance Criteria

1. THE `protectedProcedure` SHALL verify that a non-null session object containing a non-null user property exists in the tRPC context before executing the procedure handler
2. IF the session is null or the session's user property is null, THEN THE `protectedProcedure` SHALL throw a tRPC error with code UNAUTHORIZED before the procedure handler executes
3. THE `protectedProcedure` SHALL make the authenticated user's ID, email, and name available in the procedure context typed as non-nullable strings (guaranteed non-null at the TypeScript level)
4. IF the session exists but any of the required user properties (ID, email, or name) are null or undefined, THEN THE `protectedProcedure` SHALL throw a tRPC error with code UNAUTHORIZED
5. THE `protectedProcedure` SHALL be exported from `src/server/api/trpc.ts` alongside `publicProcedure` and SHALL include the existing timing middleware

### Requirement 9: User-Task Ownership

**User Story:** As a user, I want my tasks to be private to my account, so that other users cannot see or modify them.

#### Acceptance Criteria

1. THE task database table SHALL include a non-nullable `userId` column of type `varchar(255)` referencing the authenticated user's ID, with a database index on the `userId` column
2. WHEN a new task is created, THE task router SHALL associate the task with the authenticated user's ID extracted from the session context
3. WHEN tasks are queried, THE task router SHALL return only tasks where the `userId` column matches the authenticated user's ID
4. WHEN a task update or delete is requested, THE task router SHALL verify that the task's `userId` matches the authenticated user's ID before performing the operation
5. IF a user attempts to access, update, or delete a task that does not exist or is owned by another user, THEN THE task router SHALL return a NOT_FOUND error without distinguishing between non-existent and unauthorized tasks
6. THE task router SHALL use a protected procedure requiring authentication for all task operations (list, create, update, delete), returning an UNAUTHORIZED error if no valid session is present
7. WHEN a database migration adds the `userId` column, THE migration SHALL assign existing tasks without a `userId` to the user who is authenticated at the time of migration or delete orphaned tasks, ensuring no task row has a null `userId` after migration completes

### Requirement 10: Auth UI Layout

**User Story:** As a user, I want a consistent authentication experience with clear navigation between sign-in and sign-up, so that I can easily access my account.

#### Acceptance Criteria

1. THE sign-in page SHALL include a visible link that navigates to the /auth/sign-up page
2. THE sign-up page SHALL include a visible link that navigates to the /auth/sign-in page
3. WHILE a form submission is in progress, THE auth pages SHALL display a loading indicator and disable the submit button until the server responds or the request times out after 30 seconds
4. WHEN a validation or server error occurs, THE auth pages SHALL display the error message adjacent to the relevant form field or at the top of the form within 200ms of receiving the error response
5. WHEN a new form submission is initiated, THE auth pages SHALL clear any previously displayed error messages
6. THE auth pages SHALL use the existing Tailwind CSS design system and render correctly on viewports from 320px to 1920px wide
