/**
 * tRPC seed helpers for E2E scenarios that would otherwise require long UI setup loops.
 *
 * Wind-down fatigue (S-16): requires an active session with ≥3 completed WORK cycles,
 * a RUNNING WORK cycle on the target task, and FADING check-in on completion to trigger
 * the wind-down gate. Belt tests call `seedWindDownFatigueScenario` instead of 3× UI cycles.
 */
import { expect, type Page } from "@playwright/test";

import { MIN_WORK_DURATION_SEC } from "../../src/lib/duration-bounds";

async function dismissKickoffReadinessIfVisible(page: Page) {
	const overlay = page.getByTestId("kickoff-readiness-overlay");
	if (await overlay.isVisible().catch(() => false)) {
		await page.getByTestId("kickoff-readiness-skip-btn").click();
		await expect(overlay).toBeHidden({ timeout: 5_000 });
	}
}

const FATIGUE_COMPLETED_WORK_CYCLES = 3;

type TrpcEnvelope<T> = {
	result?: { data?: { json?: T } };
	error?: { json?: { message?: string } };
};

async function trpcMutation<TInput, TResult>(
	page: Page,
	procedure: string,
	input: TInput,
): Promise<TResult> {
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
}

async function trpcQuery<TResult>(
	page: Page,
	procedure: string,
	input: Record<string, unknown> = {},
): Promise<TResult> {
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
}

async function endActiveSessionIfAny(page: Page) {
	try {
		await trpcMutation(page, "session.end", {});
	} catch {
		// No active session — expected on a clean worker.
	}
}

/** Clears pooled-worker DB session/cycle state before UI idle cleanup. */
export async function resetWorkerSessionViaApi(page: Page) {
	await interruptActiveCycleIfRunning(page);
	await endActiveSessionIfAny(page);
}

async function interruptActiveCycleIfRunning(page: Page) {
	const active = await trpcQuery<{ id: number } | null>(
		page,
		"cycle.getActive",
	);
	if (active == null) {
		return;
	}
	try {
		await trpcMutation(page, "cycle.interrupt", { cycleId: active.id });
	} catch {
		// Cycle may have completed between getActive and interrupt.
	}
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

	const getActiveAfterReload = page.waitForResponse(
		(response) => response.url().includes("cycle.getActive") && response.ok(),
		{ timeout: 20_000 },
	);
	await page.reload();
	await getActiveAfterReload;
	await expect(page.getByTestId("task-list")).toBeVisible();
	await dismissKickoffReadinessIfVisible(page);
	await expect(page.getByTestId("timer-panel-running")).toBeVisible({
		timeout: 15_000,
	});

	return {
		taskId: task.id,
		taskTitle,
		sessionId: session.id,
		runningCycleId: running.id,
	};
}
