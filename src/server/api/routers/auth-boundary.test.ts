import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Feature: auth boundary, Property: unauthenticated callers are rejected
 * Validates: every procedure registered on `appRouter` refuses a caller with no
 * session (`UNAUTHORIZED`) and never reaches the database while doing so.
 *
 * Complements — deliberately does not duplicate:
 * - `src/server/api/protected-procedure.test.ts` — middleware-level property tests
 *   against a synthetic router (missing/empty fields, throwing `getSession()`).
 * - `src/server/api/routers/*-isolation.test.ts` — row scoping for an *authenticated*
 *   caller.
 *
 * Checklist: `context/foundation/auth-boundary.md`.
 */

/** Records every db access; an unauthenticated request must produce none. */
let dbTouches: string[] = [];

vi.mock("~/server/db/index", () => {
	const modelProxy = (model: string) =>
		new Proxy(
			{},
			{
				get:
					(_target, method) =>
					(..._args: unknown[]) => {
						dbTouches.push(`${model}.${String(method)}`);
						return Promise.resolve(null);
					},
			},
		);

	return {
		db: new Proxy({}, { get: (_target, model) => modelProxy(String(model)) }),
	};
});

vi.mock("~/lib/auth/server", () => ({
	auth: { getSession: vi.fn(() => Promise.resolve({ data: null })) },
}));

import { installImmediateSetTimeout } from "~/test-utils/immediate-set-timeout";

installImmediateSetTimeout();

// Import after mocks are set up
const { appRouter, createCaller } = await import("~/server/api/root");
const { createTRPCContext } = await import("~/server/api/trpc");
const { db } = await import("~/server/db/index");

/**
 * Procedures intentionally exempt from the auth boundary, by dot path.
 * Empty on purpose: today every registered procedure is a `protectedProcedure`.
 * Adding an entry here is a deliberate, reviewable security decision — see
 * `context/foundation/auth-boundary.md` §2.
 */
const PUBLIC_PROCEDURE_PATHS: readonly string[] = [];

/** Flat `{ "task.list": procedure }` record that tRPC builds for the merged router. */
const registeredProcedurePaths = Object.keys(
	(appRouter as unknown as { _def: { procedures: Record<string, unknown> } })
		._def.procedures,
).sort();

const protectedProcedurePaths = registeredProcedurePaths.filter(
	(path) => !PUBLIC_PROCEDURE_PATHS.includes(path),
);

/** Context of an anonymous request: no session, real db binding (here, the spy). */
const anonymousContext = () => ({
	db: db as never,
	session: null,
	headers: new Headers(),
});

/** Calls `caller.<a>.<b>(undefined)` for a dot-separated procedure path. */
function callProcedure(caller: object, path: string): Promise<unknown> {
	const segments = path.split(".");
	const key = segments.pop();
	if (key === undefined) {
		throw new Error("Empty procedure path");
	}

	let parent = caller as Record<string, unknown>;
	for (const segment of segments) {
		parent = parent[segment] as Record<string, unknown>;
	}

	const procedure = parent[key];
	if (typeof procedure !== "function") {
		throw new Error(`No caller entry for procedure path "${path}"`);
	}

	return (procedure as (input?: unknown) => Promise<unknown>).call(
		parent,
		undefined,
	);
}

describe("auth boundary: unauthenticated tRPC access", () => {
	beforeEach(() => {
		dbTouches = [];
		vi.clearAllMocks();
	});

	it("sweeps a non-empty set of registered procedures", () => {
		// Guards against a silently-passing suite if the introspection shape changes.
		expect(protectedProcedurePaths.length).toBeGreaterThan(0);
	});

	it("only exempts paths that are actually registered", () => {
		for (const path of PUBLIC_PROCEDURE_PATHS) {
			expect(registeredProcedurePaths).toContain(path);
		}
	});

	it.each(
		protectedProcedurePaths,
	)("%s rejects a caller with no session", async (path) => {
		const caller = createCaller(anonymousContext());

		await expect(callProcedure(caller, path)).rejects.toThrow(TRPCError);
		await expect(callProcedure(caller, path)).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
		expect(dbTouches).toEqual([]);
	});

	it("rejects mutations that carry valid input, so the failure is auth and not validation", async () => {
		const caller = createCaller(anonymousContext());

		await expect(
			caller.task.create({ title: "auth boundary smoke" }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		await expect(
			caller.checkIn.create({ cycleId: 1, energy: "STEADY" }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });

		expect(dbTouches).toEqual([]);
	});

	it("rejects through the production context factory, not just a hand-built context", async () => {
		const caller = createCaller(
			await createTRPCContext({ headers: new Headers() }),
		);

		await expect(caller.task.list()).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
		expect(dbTouches).toEqual([]);
	});
});
