import type { Page } from "@playwright/test";

type TrpcEnvelope<T> = {
	result?: { data?: { json?: T } };
	error?: { json?: { message?: string } };
};

type DayPlanSnapshot = {
	localDateKey: string;
	focusBudgetMinutes: number | null;
	usedFocusMinutes: number;
	remainingFocusMinutes: number | null;
};

type CreatedTask = {
	id: number;
	title: string;
	isDailyStanding: boolean;
};

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
			const message = error instanceof Error ? error.message : String(error);
			if (
				!/ECONNRESET|ECONNREFUSED|ETIMEDOUT|socket hang up/i.test(message) ||
				attempt === attempts
			) {
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

/** Browser-local YYYY-MM-DD — matches suggestion mutations and day-plan hooks. */
export async function getBrowserLocalDateKey(page: Page): Promise<string> {
	return page.evaluate(() => {
		const date = new Date();
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	});
}

/** Sets budget so remaining minutes equals target regardless of prior used minutes. */
export async function ensureRemainingFocusMinutes(
	page: Page,
	remainingMinutes: number,
) {
	const localDateKey = await getBrowserLocalDateKey(page);
	const current = await trpcQuery<DayPlanSnapshot>(
		page,
		"dayPlan.getOrCreate",
		{
			localDateKey,
		},
	);
	const used = current.usedFocusMinutes ?? 0;
	await trpcMutation(page, "dayPlan.setBudget", {
		localDateKey,
		focusBudgetMinutes: used + remainingMinutes,
	});
}

export async function createTaskViaApi(
	page: Page,
	input: {
		title: string;
		workType?: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
		weight?: number;
		importance?: number;
		urgency?: number;
		effortMinutes?: number | null;
		isDailyStanding?: boolean;
	},
): Promise<CreatedTask> {
	return trpcMutation(page, "task.create", input);
}

export async function seedCapacitySuggestionScenario(
	page: Page,
	options: {
		standingTitle: string;
		longTaskTitle: string;
		remainingMinutes?: number;
		standingEffortMinutes?: number;
		longEffortMinutes?: number;
	},
) {
	const remainingMinutes = options.remainingMinutes ?? 30;
	await ensureRemainingFocusMinutes(page, remainingMinutes);

	const standing = await createTaskViaApi(page, {
		title: options.standingTitle,
		workType: "OPERATIONAL",
		weight: 2,
		importance: 2,
		urgency: 2,
		effortMinutes: options.standingEffortMinutes ?? 20,
		isDailyStanding: true,
	});

	const longTask = await createTaskViaApi(page, {
		title: options.longTaskTitle,
		workType: "DEEP_WORK",
		weight: 2,
		importance: 2,
		urgency: 2,
		effortMinutes: options.longEffortMinutes ?? 120,
		isDailyStanding: false,
	});

	return { standing, longTask, remainingMinutes };
}

export async function markStandingDoneForToday(page: Page, taskTitle: string) {
	const row = page.getByRole("listitem").filter({ hasText: taskTitle }).first();
	await row.getByTestId("task-complete-button").click();
}
