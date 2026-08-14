import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ApiKeyScope } from "@prisma/generated";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	buildMcpContext,
	type VerifiedApiKey,
} from "~/lib/api-keys/verify-token";
import {
	commitmentHorizonSchema,
	energyLevelSchema,
	workTypeSchema,
} from "~/lib/domain";
import { createCaller } from "~/server/api/root";

/**
 * Curated MCP tool implementations for the FlowState agent surface (S-46).
 *
 * Every tool is a thin adapter over the existing tRPC surface: it delegates to
 * `appRouter.createCaller(ctx)`, reusing all business logic and per-user
 * isolation. Tools are factored as standalone `(caller, input, scope)` functions
 * so integration tests exercise them via `createCaller` WITHOUT the HTTP layer
 * (per lessons L-06). `registerMcpTools` is the only HTTP-facing seam.
 */

export type McpCaller = ReturnType<typeof createCaller>;

// --- Result + error helpers ---------------------------------------------------

function ok(data: unknown): CallToolResult {
	// `JSON.stringify(undefined)` returns `undefined` (not a string), which would
	// produce an invalid `CallToolResult` content block. Guard so a void-returning
	// caller can never emit a malformed MCP result.
	const text = JSON.stringify(data, null, 2) ?? "null";
	return { content: [{ type: "text", text }] };
}

function errorResult(message: string): CallToolResult {
	return { content: [{ type: "text", text: message }], isError: true };
}

/** Thrown by `requireWrite` when a read-only key attempts a mutation. */
class McpScopeError extends Error {}

/** Scope gate used by every write tool. */
export function requireWrite(scope: ApiKeyScope): void {
	if (scope !== "READ_WRITE") {
		throw new McpScopeError(
			"This action requires a read-write API key. The current key is read-only.",
		);
	}
}

/**
 * Map a `TRPCError` to a concise, safe tool-error message. Never leaks stack
 * traces or internal detail; only the whitelisted router messages (which are
 * user-facing state descriptions) are surfaced for CONFLICT/BAD_REQUEST.
 */
export function toMcpError(error: TRPCError): string {
	switch (error.code) {
		case "UNAUTHORIZED":
			return "Not authorized to perform this action.";
		case "FORBIDDEN":
			return "This action is not permitted for the current key.";
		case "NOT_FOUND":
			return "The requested item was not found.";
		case "CONFLICT":
			return error.message || "The request conflicts with the current state.";
		case "BAD_REQUEST":
			return error.message || "The request was invalid.";
		default:
			return "The request could not be completed.";
	}
}

/**
 * Run a tool body, translating scope violations and tRPC failures into safe
 * `isError` tool responses. Success serializes the result as JSON text.
 */
async function runTool(fn: () => Promise<unknown>): Promise<CallToolResult> {
	try {
		return ok(await fn());
	} catch (error) {
		if (error instanceof McpScopeError) return errorResult(error.message);
		if (error instanceof TRPCError) return errorResult(toMcpError(error));
		return errorResult("The request could not be completed.");
	}
}

// --- Input schemas (reuse domain Zod enums) ----------------------------------

const localDateKeySchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD local date key");
const localHourSchema = z.number().int().min(0).max(23);
const axisSchema = z.number().int().min(1).max(3);
const effortMinutesSchema = z.number().int().min(5).max(240);
const workTypeZod = z.enum(workTypeSchema);
const commitmentHorizonZod = z.enum(commitmentHorizonSchema);
const energyZod = z.enum(energyLevelSchema);
// "delegated" is intentionally excluded from this write-tool enum: agents must
// not be able to set/unset task delegation themselves. It still flows through
// list_tasks reads automatically once added to DomainTaskStatus.
const taskStatusZod = z.enum(["active", "completed", "planned", "blocked"]);

export const listTasksSchema = z.object({
	localDateKey: localDateKeySchema.optional(),
});

export const dayStatsSchema = z.object({ localDateKey: localDateKeySchema });

export const dayPlanSchema = z.object({ localDateKey: localDateKeySchema });

export const nextSuggestionSchema = z.object({
	localDateKey: localDateKeySchema,
	localHour: localHourSchema,
	energy: energyZod,
});

export const createTaskSchema = z.object({
	title: z.string().min(1).max(256),
	workType: workTypeZod.optional(),
	importance: axisSchema.optional(),
	urgency: axisSchema.optional(),
	weight: axisSchema.optional(),
	effortMinutes: effortMinutesSchema.optional(),
	commitmentHorizon: commitmentHorizonZod.optional(),
	resumeNote: z.string().max(120).optional(),
	project: z.string().max(256).optional(),
	isDailyStanding: z.boolean().optional(),
});

export const updateTaskSchema = z.object({
	id: z.number().int(),
	title: z.string().min(1).max(256).optional(),
	status: taskStatusZod.optional(),
	workType: workTypeZod.optional(),
	importance: axisSchema.optional(),
	urgency: axisSchema.optional(),
	effortMinutes: effortMinutesSchema.optional(),
	commitmentHorizon: commitmentHorizonZod.optional(),
	resumeNote: z.string().max(120).optional(),
	project: z.string().max(256).optional(),
	isDailyStanding: z.boolean().optional(),
});

export const completeTaskSchema = z.object({ id: z.number().int() });

export type ListTasksInput = z.infer<typeof listTasksSchema>;
export type DayStatsInput = z.infer<typeof dayStatsSchema>;
export type DayPlanInput = z.infer<typeof dayPlanSchema>;
export type NextSuggestionInput = z.infer<typeof nextSuggestionSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CompleteTaskInput = z.infer<typeof completeTaskSchema>;
export const getSessionStateSchema = z.object({
	localDateKey: localDateKeySchema.optional(),
	timeZone: z.string().min(1).optional(),
});

export type GetSessionStateInput = z.infer<typeof getSessionStateSchema>;

// --- Shared context resolution -----------------------------------------------

/** Return the id of the caller's currently ACTIVE session, or null if none. */
async function resolveActiveSessionId(
	caller: McpCaller,
): Promise<number | null> {
	const sessions = await caller.session.list();
	const active = sessions.find((s) => s.state === "ACTIVE");
	return active?.id ?? null;
}

// --- READ tools (any scope) --------------------------------------------------

export function listTasks(
	caller: McpCaller,
	input: ListTasksInput,
	_scope: ApiKeyScope,
): Promise<CallToolResult> {
	return runTool(() => caller.task.list(input));
}

export function getSessionState(
	caller: McpCaller,
	input: GetSessionStateInput,
	_scope: ApiKeyScope,
): Promise<CallToolResult> {
	return runTool(async () => {
		const localDateKey =
			input.localDateKey ?? new Date().toISOString().slice(0, 10);
		const activeCycle = await caller.cycle.getActive({
			localDateKey,
			timeZone: input.timeZone,
		});
		const sessionId =
			activeCycle?.sessionId ?? (await resolveActiveSessionId(caller));

		const completedWorkCycles =
			sessionId != null
				? await caller.cycle.countCompletedWork({ sessionId })
				: 0;
		const latestCheckInEnergy =
			sessionId != null
				? await caller.cycle.getLatestCheckInEnergy({ sessionId })
				: null;

		return {
			hasActiveSession: sessionId != null,
			sessionId,
			activeCycle,
			completedWorkCycles,
			latestCheckInEnergy,
		};
	});
}

export function getDayStats(
	caller: McpCaller,
	input: DayStatsInput,
	_scope: ApiKeyScope,
): Promise<CallToolResult> {
	return runTool(() => {
		// MCP callers have no browser-local timezone to reference, so the
		// requested localDateKey is treated as a UTC calendar day.
		const rangeStart = new Date(`${input.localDateKey}T00:00:00.000Z`);
		const rangeEnd = new Date(rangeStart.getTime() + 24 * 60 * 60 * 1000);
		return caller.recap.getDayStats({ rangeStart, rangeEnd });
	});
}

export function getDayPlan(
	caller: McpCaller,
	input: DayPlanInput,
	_scope: ApiKeyScope,
): Promise<CallToolResult> {
	return runTool(() => caller.dayPlan.getOrCreate(input));
}

export function getNextSuggestion(
	caller: McpCaller,
	input: NextSuggestionInput,
	_scope: ApiKeyScope,
): Promise<CallToolResult> {
	return runTool(async () => {
		const sessionId = await resolveActiveSessionId(caller);
		if (sessionId == null) {
			return {
				status: "no_active_session",
				message:
					"No active focus session. Start a session in FlowState to get a next-task suggestion.",
			};
		}

		const suggestion = await caller.suggestion.next({
			context: "kickoff",
			sessionId,
			localHour: input.localHour,
			localDateKey: input.localDateKey,
			energy: input.energy,
		});

		if (suggestion == null) {
			return {
				status: "no_suggestion",
				message: "No eligible task to suggest right now.",
			};
		}

		return { status: "ok", suggestion };
	});
}

// --- WRITE tools (READ_WRITE only) -------------------------------------------

export function createTask(
	caller: McpCaller,
	input: CreateTaskInput,
	scope: ApiKeyScope,
): Promise<CallToolResult> {
	return runTool(() => {
		requireWrite(scope);
		return caller.task.create(input);
	});
}

export function updateTask(
	caller: McpCaller,
	input: UpdateTaskInput,
	scope: ApiKeyScope,
): Promise<CallToolResult> {
	return runTool(() => {
		requireWrite(scope);
		return caller.task.update(input);
	});
}

export function completeTask(
	caller: McpCaller,
	input: CompleteTaskInput,
	scope: ApiKeyScope,
): Promise<CallToolResult> {
	return runTool(() => {
		requireWrite(scope);
		return caller.task.update({ id: input.id, status: "completed" });
	});
}

// --- HTTP-facing registration ------------------------------------------------

/** Resolve a validated `AuthInfo` into a per-user caller + scope. */
function resolveAuth(
	authInfo: AuthInfo | undefined,
): { caller: McpCaller; scope: ApiKeyScope } | null {
	const extra = authInfo?.extra as Partial<VerifiedApiKey> | undefined;
	if (
		extra?.userId == null ||
		extra.userEmail == null ||
		extra.userName == null ||
		extra.scope == null
	) {
		return null;
	}
	const ctx = buildMcpContext(extra as VerifiedApiKey);
	return { caller: createCaller(ctx), scope: extra.scope };
}

function unauthorizedResult(): CallToolResult {
	return errorResult("Authentication is required.");
}

/**
 * Register the curated FlowState tool surface onto an MCP server. Each handler
 * resolves the per-request identity from `extra.authInfo`, builds a caller, and
 * delegates to the standalone tool functions above.
 */
export function registerMcpTools(server: McpServer): void {
	server.registerTool(
		"list_tasks",
		{
			description:
				"List the user's active tasks (optionally including tasks done for a given local date).",
			inputSchema: listTasksSchema.shape,
			annotations: { readOnlyHint: true },
		},
		(args, extra) => {
			const auth = resolveAuth(extra.authInfo);
			if (auth == null) return unauthorizedResult();
			return listTasks(auth.caller, args, auth.scope);
		},
	);

	server.registerTool(
		"get_session_state",
		{
			description:
				"Read the current focus-session state: active cycle/task, completed work cycles, and latest check-in energy.",
			inputSchema: getSessionStateSchema.shape,
			annotations: { readOnlyHint: true },
		},
		(args, extra) => {
			const auth = resolveAuth(extra.authInfo);
			if (auth == null) return unauthorizedResult();
			return getSessionState(auth.caller, args, auth.scope);
		},
	);

	server.registerTool(
		"get_day_stats",
		{
			description:
				"Read the user's rolling 24h focus statistics (completed cycles, focused minutes, undone tasks).",
			inputSchema: dayStatsSchema.shape,
			annotations: { readOnlyHint: true },
		},
		(args, extra) => {
			const auth = resolveAuth(extra.authInfo);
			if (auth == null) return unauthorizedResult();
			return getDayStats(auth.caller, args, auth.scope);
		},
	);

	server.registerTool(
		"get_day_plan",
		{
			description:
				"Read the user's plan for a local date: focus budget, used and remaining focus minutes, and planned energy.",
			inputSchema: dayPlanSchema.shape,
			annotations: { readOnlyHint: true },
		},
		(args, extra) => {
			const auth = resolveAuth(extra.authInfo);
			if (auth == null) return unauthorizedResult();
			return getDayPlan(auth.caller, args, auth.scope);
		},
	);

	server.registerTool(
		"get_next_suggestion",
		{
			description:
				"Get FlowState's scored next-task suggestion and its rationale for the active session. Read-only: records no decision and never starts a session.",
			inputSchema: nextSuggestionSchema.shape,
			annotations: { readOnlyHint: true },
		},
		(args, extra) => {
			const auth = resolveAuth(extra.authInfo);
			if (auth == null) return unauthorizedResult();
			return getNextSuggestion(auth.caller, args, auth.scope);
		},
	);

	server.registerTool(
		"create_task",
		{
			description:
				"Create a new task for the user. Requires a read-write API key.",
			inputSchema: createTaskSchema.shape,
			annotations: { readOnlyHint: false },
		},
		(args, extra) => {
			const auth = resolveAuth(extra.authInfo);
			if (auth == null) return unauthorizedResult();
			return createTask(auth.caller, args, auth.scope);
		},
	);

	server.registerTool(
		"update_task",
		{
			description:
				"Update a task's title, status, or attributes. Requires a read-write API key.",
			inputSchema: updateTaskSchema.shape,
			annotations: { readOnlyHint: false },
		},
		(args, extra) => {
			const auth = resolveAuth(extra.authInfo);
			if (auth == null) return unauthorizedResult();
			return updateTask(auth.caller, args, auth.scope);
		},
	);

	server.registerTool(
		"complete_task",
		{
			description: "Mark a task as completed. Requires a read-write API key.",
			inputSchema: completeTaskSchema.shape,
			annotations: { readOnlyHint: false },
		},
		(args, extra) => {
			const auth = resolveAuth(extra.authInfo);
			if (auth == null) return unauthorizedResult();
			return completeTask(auth.caller, args, auth.scope);
		},
	);
}
