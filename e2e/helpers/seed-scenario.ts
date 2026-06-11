/**
 * tRPC seed helpers for E2E scenarios that would otherwise require long UI setup loops.
 *
 * Wind-down fatigue (S-16): requires an active session with ≥3 completed WORK cycles,
 * a RUNNING WORK cycle on the target task, and FADING check-in on completion to trigger
 * the wind-down gate. Belt tests call `seedWindDownFatigueScenario` instead of 3× UI cycles.
 */
import { expect, type Page } from "@playwright/test";

import { MIN_WORK_DURATION_SEC } from "../../src/lib/duration-bounds";
import { rehydrateFatigueSeedState } from "./cycle-recovery";
import { dismissKickoffReadinessIfVisible } from "./idle-cycle";
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
				/not found|already completed|no active cycle/i.test(message);
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

/** Clears pooled-worker DB session/cycle state before UI idle cleanup. */
export async function resetWorkerSessionViaApi(page: Page) {
	await drainActiveCycles(page);
	await endActiveSessionIfAny(page);
	const tasks = await trpcQuery<Array<{ id: number }>>(page, "task.list");
	for (const task of tasks) {
		await trpcMutation(page, "task.delete", { id: task.id });
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
	await expect(page.getByTestId("task-list")).toBeVisible();
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
