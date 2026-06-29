/**
 * tRPC seed helpers for E2E scenarios that would otherwise require long UI setup loops.
 *
 * Wind-down fatigue (S-16): requires an active session with ≥3 completed WORK cycles,
 * a RUNNING WORK cycle on the target task, and FADING check-in on completion to trigger
 * the wind-down gate. Belt tests call `seedWindDownFatigueScenario` instead of 3× UI cycles.
 */
import { expect, type Page } from "@playwright/test";
import { MIN_WORK_DURATION_SEC } from "../../src/lib/duration-bounds";
import { STALE_TASK_ARCHIVE_DAYS } from "../../src/lib/task/stale-task-archive";
import { rehydrateFatigueSeedState } from "./cycle-recovery";
import { dismissKickoffReadinessIfVisible } from "./idle-cycle";
import { expectTaskListVisible } from "./task-list-locator";
import { forgetFakeClock, resetFakeClock } from "./work-cycle";

const FATIGUE_COMPLETED_WORK_CYCLES = 3;

type TrpcEnvelope<T> = {
	result?: { data?: { json?: T } };
	error?: { json?: { message?: string } };
};

function isTransientTrpcError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return /ECONNRESET|ECONNREFUSED|ETIMEDOUT|socket hang up/i.test(message);
}

async function withTrpcRetry<T>(
	label: string,
	run: () => Promise<T>,
	attempts = 3,
): Promise<T> {
	let lastError: unknown;
	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			return await run();
		} catch (error) {
			lastError = error;
			if (!isTransientTrpcError(error) || attempt === attempts) {
				throw error;
			}
			await new Promise((resolve) => setTimeout(resolve, attempt * 250));
		}
	}
	throw new Error(`tRPC ${label} failed after ${attempts} attempts`, {
		cause: lastError,
	});
}

async function trpcMutation<TInput, TResult>(
	page: Page,
	procedure: string,
	input: TInput,
): Promise<TResult> {
	return withTrpcRetry(procedure, async () => {
		const response = await page.request.post(`/api/trpc/${procedure}`, {
			data: { json: input },
		});
		const body = (await response.json()) as TrpcEnvelope<TResult>;
		if (!response.ok() || body.error != null) {
			const message =
				body.error?.json?.message ??
				(await response.text().catch(() => response.statusText()));
			throw new Error(`tRPC ${procedure} failed: ${message}`);
		}
		const json = body.result?.data?.json;
		if (json === undefined) {
			throw new Error(`tRPC ${procedure} returned no data`);
		}
		return json;
	});
}

async function trpcQuery<TResult>(
	page: Page,
	procedure: string,
	input: Record<string, unknown> = {},
): Promise<TResult> {
	return withTrpcRetry(procedure, async () => {
		const encoded = encodeURIComponent(JSON.stringify({ json: input }));
		const response = await page.request.get(
			`/api/trpc/${procedure}?input=${encoded}`,
		);
		const body = (await response.json()) as TrpcEnvelope<TResult>;
		if (!response.ok() || body.error != null) {
			const message =
				body.error?.json?.message ??
				(await response.text().catch(() => response.statusText()));
			throw new Error(`tRPC ${procedure} failed: ${message}`);
		}
		const json = body.result?.data?.json;
		if (json === undefined) {
			throw new Error(`tRPC ${procedure} returned no data`);
		}
		return json;
	});
}

async function endActiveSessionIfAny(page: Page) {
	try {
		await trpcMutation(page, "session.end", {});
	} catch {
		// No active session — expected on a clean worker.
	}
}

/** Interrupt every RUNNING cycle until getActive is null (retries races with UI sync). */
async function drainActiveCycles(page: Page, timeoutMs = 15_000) {
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		const active = await trpcQuery<{ id: number } | null>(
			page,
			"cycle.getActive",
		);
		if (active == null) {
			return;
		}
		try {
			await trpcMutation(page, "cycle.interrupt", { cycleId: active.id });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const isRace =
				isTransientTrpcError(error) ||
				/not found|already completed|no active cycle|not running or paused/i.test(
					message,
				);
			if (!isRace) {
				throw error;
			}
			// Stale read or concurrent completion — retry until deadline.
		}
		await new Promise((resolve) => setTimeout(resolve, 100));
	}

	const remaining = await trpcQuery<{ id: number } | null>(
		page,
		"cycle.getActive",
	);
	if (remaining != null) {
		throw new Error(
			`cycle.getActive still returned id ${remaining.id} after drain`,
		);
	}
}

/** Marks the last ended session handoff dismissed so pol-10 does not block kickoff in belt setup. */
async function dismissEndedSessionHandoffInStorage(page: Page) {
	try {
		const lastEnded = await trpcQuery<{ id: number } | null>(
			page,
			"session.getLastEnded",
		);
		if (lastEnded?.id != null) {
			await page.evaluate((sessionId: number) => {
				localStorage.setItem(
					`flowstate:handoff-dismissed:${String(sessionId)}`,
					"1",
				);
			}, lastEnded.id);
		}
	} catch {
		// Best effort — belt hygiene when localStorage unavailable
	}
}

/** Clears pooled-worker DB session/cycle state before UI idle cleanup. */
export async function resetWorkerSessionViaApi(page: Page) {
	await drainActiveCycles(page);
	await endActiveSessionIfAny(page);
	await dismissEndedSessionHandoffInStorage(page);
	const tasks = await trpcQuery<Array<{ id: number }>>(page, "task.list");
	for (const task of tasks) {
		try {
			await trpcMutation(page, "task.delete", { id: task.id });
		} catch (error) {
			// Idempotent cleanup: the row may already be gone between list and
			// delete (concurrent reset / cascade). tRPC surfaces this as NOT_FOUND,
			// and Prisma's underlying P2025 message ("No record was found for a
			// delete.") — swallow both so seed reset stays deterministic.
			const message = error instanceof Error ? error.message : String(error);
			const isAlreadyDeleted = /NOT_FOUND|No record was found|P2025/i.test(
				message,
			);
			if (!isAlreadyDeleted) {
				throw error;
			}
		}
	}
	await drainActiveCycles(page);
}

async function createCompletedWorkCycle(
	page: Page,
	sessionId: number,
	taskId: number,
) {
	const created = await trpcMutation<
		{
			sessionId?: number;
			kind: string;
			configuredDurationSec: number;
			taskId?: number;
		},
		{ id: number }
	>(page, "cycle.create", {
		sessionId,
		kind: "WORK",
		configuredDurationSec: MIN_WORK_DURATION_SEC,
		taskId,
	});
	await trpcMutation(page, "cycle.complete", { cycleId: created.id });
}

export type WindDownFatigueSeed = {
	taskId: number;
	taskTitle: string;
	sessionId: number;
	runningCycleId: number;
};

/**
 * Seeds session fatigue preconditions: 3 completed WORK cycles + 1 RUNNING WORK cycle.
 * Caller should reload the page, install fake clock, advance through work duration, then
 * submit a FADING check-in to trigger wind-down.
 */
export async function seedWindDownFatigueScenario(
	page: Page,
	taskTitle: string,
	workDurationSec = MIN_WORK_DURATION_SEC,
): Promise<WindDownFatigueSeed> {
	await resetWorkerSessionViaApi(page);

	const task = await trpcMutation<{ title: string }, { id: number }>(
		page,
		"task.create",
		{ title: taskTitle },
	);

	const session = await trpcMutation<Record<string, never>, { id: number }>(
		page,
		"session.getOrCreateActive",
		{},
	);

	for (let i = 0; i < FATIGUE_COMPLETED_WORK_CYCLES; i++) {
		await createCompletedWorkCycle(page, session.id, task.id);
	}

	const running = await trpcMutation<
		{
			sessionId: number;
			kind: string;
			configuredDurationSec: number;
			taskId: number;
		},
		{ id: number }
	>(page, "cycle.create", {
		sessionId: session.id,
		kind: "WORK",
		configuredDurationSec: workDurationSec,
		taskId: task.id,
	});

	await forgetFakeClock(page);
	const getActiveAfterReload = page.waitForResponse(
		(response) => response.url().includes("cycle.getActive") && response.ok(),
		{ timeout: 20_000 },
	);
	await page.reload();
	await getActiveAfterReload;
	await expectTaskListVisible(page);
	await dismissKickoffReadinessIfVisible(page);
	await rehydrateFatigueSeedState(page, session.id);
	await resetFakeClock(page);
	await expect(page.getByTestId("timer-panel-running")).toBeVisible({
		timeout: 15_000,
	});

	const completedWorkCount = await trpcQuery<number>(
		page,
		"cycle.countCompletedWork",
		{ sessionId: session.id },
	);
	expect(completedWorkCount).toBeGreaterThanOrEqual(
		FATIGUE_COMPLETED_WORK_CYCLES,
	);

	return {
		taskId: task.id,
		taskTitle,
		sessionId: session.id,
		runningCycleId: running.id,
	};
}

export type TaskTimestampSeed = {
	createdAt?: Date;
	updatedAt?: Date | null;
	status?: string;
	archivedAt?: Date | null;
	isDailyStanding?: boolean;
};

function staleTouchDate(now = new Date()): Date {
	const touch = new Date(now);
	touch.setDate(touch.getDate() - (STALE_TASK_ARCHIVE_DAYS + 1));
	return touch;
}

async function patchTaskTimestamps(taskId: number, patch: TaskTimestampSeed) {
	const { db } = await import("../../src/server/db/index");
	await db.task.update({
		where: { id: taskId },
		data: {
			...(patch.createdAt != null ? { createdAt: patch.createdAt } : {}),
			...(patch.updatedAt !== undefined ? { updatedAt: patch.updatedAt } : {}),
			...(patch.status != null ? { status: patch.status } : {}),
			...(patch.archivedAt !== undefined
				? { archivedAt: patch.archivedAt }
				: {}),
			...(patch.isDailyStanding != null
				? { isDailyStanding: patch.isDailyStanding }
				: {}),
		},
	});
}

/** Create a task via tRPC, then set row timestamps/status for stale-archive scenarios. */
export async function createTaskWithTimestamps(
	page: Page,
	input: {
		title: string;
		workType?: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
		weight?: number;
		importance?: number;
		isDailyStanding?: boolean;
	},
	timestamps: TaskTimestampSeed,
): Promise<{ id: number; title: string }> {
	const task = await trpcMutation<typeof input, { id: number; title: string }>(
		page,
		"task.create",
		{
			title: input.title,
			...(input.workType != null ? { workType: input.workType } : {}),
			...(input.weight != null ? { weight: input.weight } : {}),
			...(input.importance != null ? { importance: input.importance } : {}),
			...(input.isDailyStanding != null
				? { isDailyStanding: input.isDailyStanding }
				: {}),
		},
	);
	if (Object.keys(timestamps).length > 0) {
		await patchTaskTimestamps(task.id, timestamps);
	}
	return { id: task.id, title: input.title };
}

export type StaleArchiveSeed = {
	staleTasks: Array<{ id: number; title: string }>;
	freshTask: { id: number; title: string };
};

/** Seeds two stale active tasks and one fresh active task for S-44 archive e2e. */
export async function seedStaleArchiveScenario(
	page: Page,
	options: {
		staleTitles: [string, string];
		freshTitle: string;
	},
): Promise<StaleArchiveSeed> {
	await resetWorkerSessionViaApi(page);
	const touchDate = staleTouchDate();

	const staleTasks: Array<{ id: number; title: string }> = [];
	for (const title of options.staleTitles) {
		staleTasks.push(
			await createTaskWithTimestamps(
				page,
				{ title, isDailyStanding: false },
				{
					createdAt: touchDate,
					updatedAt: touchDate,
					status: "active",
					archivedAt: null,
				},
			),
		);
	}

	const freshTask = await createTaskWithTimestamps(
		page,
		{
			title: options.freshTitle,
			workType: "DEEP_WORK",
			weight: 3,
			importance: 3,
			isDailyStanding: false,
		},
		{},
	);

	return { staleTasks, freshTask };
}
