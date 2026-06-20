import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GUEST_STORAGE_KEY } from "~/lib/guest/schema";
import { createGuestRepositories } from "~/lib/repositories/guest-repositories";
import { assertRemainingMsWithinTolerance } from "~/test-utils/countdown-tolerance";

vi.mock("~/lib/audio", () => ({
	createAudioManager: () => ({
		unlock: vi.fn().mockResolvedValue(undefined),
		preload: vi.fn().mockResolvedValue(undefined),
		playAlarm: vi.fn().mockResolvedValue(undefined),
		dispose: vi.fn(),
	}),
}));

vi.mock("~/lib/data-mode/data-mode-context", () => ({
	useDataMode: () => "guest",
	useRepositories: () => createGuestRepositories(),
}));

vi.mock("~/trpc/react", () => ({
	api: {
		useUtils: () => ({
			cycle: { getActive: { invalidate: vi.fn() } },
			task: { list: { invalidate: vi.fn() } },
			dayPlan: { getOrCreate: { invalidate: vi.fn() } },
			client: { cycle: { list: { query: vi.fn().mockResolvedValue([]) } } },
		}),
		checkIn: {
			create: {
				useMutation: () => ({
					mutateAsync: vi.fn(),
				}),
			},
		},
		suggestion: {
			next: {
				useMutation: () => ({
					mutateAsync: vi.fn(),
				}),
			},
			recordDecision: {
				useMutation: () => ({
					mutateAsync: vi.fn(),
				}),
			},
		},
		session: {
			getLastEnded: {
				useQuery: vi.fn(() => ({ data: null })),
			},
		},
		task: {
			list: {
				useQuery: vi.fn(() => ({ data: [] })),
			},
		},
	},
}));

class FakeWorker {
	onmessage: ((event: MessageEvent) => void) | null = null;

	postMessage() {}

	terminate() {}
}

vi.stubGlobal("Worker", FakeWorker);

const { usePomodoroCycle, resetActiveCycleRecoveryForTests } = await import(
	"~/hooks/use-pomodoro-cycle"
);

function createWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});

	return function Wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	};
}

describe("usePomodoroCycle guest recovery", () => {
	beforeEach(() => {
		localStorage.clear();
		resetActiveCycleRecoveryForTests();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("recovers running guest cycle with remaining time within tolerance", async () => {
		const { tasks, cycles } = createGuestRepositories();
		const task = await tasks.create({ title: "Guest resume" });
		const cycle = await cycles.create({
			kind: "WORK",
			configuredDurationSec: 900,
			taskId: task.id,
		});

		const endTimeMs =
			cycle.startedAt.getTime() + cycle.configuredDurationSec * 1000;

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("running");
		});

		expect(result.current.focusedTask).toMatchObject({
			title: "Guest resume",
		});
		assertRemainingMsWithinTolerance(result.current.remainingMs, endTimeMs);
	});

	it("marks completed when guest cycle expired before mount", async () => {
		const { tasks, cycles } = createGuestRepositories();
		const task = await tasks.create({ title: "Guest late" });
		const cycle = await cycles.create({
			kind: "WORK",
			configuredDurationSec: 60,
			taskId: task.id,
		});

		const snapshotKey = GUEST_STORAGE_KEY;
		const raw = localStorage.getItem(snapshotKey);
		if (raw == null) {
			throw new Error("expected guest snapshot in localStorage");
		}
		const snapshot = JSON.parse(raw) as {
			cycles: Array<{ id: string; startedAt: string }>;
		};
		const startedAt = new Date(Date.now() - 120_000).toISOString();
		snapshot.cycles = snapshot.cycles.map((c) =>
			c.id === cycle.id ? { ...c, startedAt } : c,
		);
		localStorage.setItem(snapshotKey, JSON.stringify(snapshot));

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("completed");
		});
	});
});

describe("usePomodoroCycle guest catchUp", () => {
	function setVisibilityState(state: DocumentVisibilityState) {
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			get: () => state,
		});
	}

	afterEach(() => {
		vi.useRealTimers();
		setVisibilityState("visible");
	});

	beforeEach(() => {
		localStorage.clear();
		resetActiveCycleRecoveryForTests();
		vi.useRealTimers();
		setVisibilityState("visible");
	});

	it("sets catchUp when guest cycle expires while tab is hidden", async () => {
		vi.stubGlobal(
			"Worker",
			class {
				constructor() {
					throw new Error("Worker blocked");
				}
			},
		);
		setVisibilityState("hidden");

		vi.useFakeTimers();
		try {
			const { tasks } = createGuestRepositories();
			const task = await tasks.create({ title: "Guest hidden tab" });

			const { result } = renderHook(() => usePomodoroCycle(), {
				wrapper: createWrapper(),
			});

			act(() => {
				result.current.selectTask(task.id, {
					id: task.id,
					title: task.title,
				});
			});

			await act(async () => {
				await result.current.start(60);
			});

			await act(async () => {
				vi.advanceTimersByTime(61_000);
			});

			expect(result.current.state).toBe("completed");
			expect(result.current.catchUp).toMatchObject({
				endedWhileHidden: true,
				gate: "WORK_CONFIRM",
			});
			expect(result.current.catchUp?.cycleEndedAtMs).toBeGreaterThan(0);
		} finally {
			vi.useRealTimers();
			vi.stubGlobal("Worker", FakeWorker);
		}
	});

	it("sets catchUp via visibility recalc when guest tab was hidden while running", async () => {
		vi.stubGlobal(
			"Worker",
			class {
				constructor() {
					throw new Error("Worker blocked");
				}
			},
		);

		const durationSec = 60;
		const startMs = Date.now() - 30_000;
		const { tasks, cycles } = createGuestRepositories();
		const task = await tasks.create({ title: "Guest visibility recalc" });
		const cycle = await cycles.create({
			kind: "WORK",
			configuredDurationSec: durationSec,
			taskId: task.id,
		});

		const snapshotKey = GUEST_STORAGE_KEY;
		const raw = localStorage.getItem(snapshotKey);
		if (raw == null) {
			throw new Error("expected guest snapshot in localStorage");
		}
		const snapshot = JSON.parse(raw) as {
			cycles: Array<{ id: string; startedAt: string }>;
		};
		const startedAt = new Date(startMs).toISOString();
		snapshot.cycles = snapshot.cycles.map((entry) =>
			entry.id === cycle.id ? { ...entry, startedAt } : entry,
		);
		localStorage.setItem(snapshotKey, JSON.stringify(snapshot));

		const endTimeMs = startMs + durationSec * 1000;

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("running");
		});

		vi.useFakeTimers();
		vi.setSystemTime(startMs + 30_000);

		try {
			setVisibilityState("hidden");
			await act(async () => {
				document.dispatchEvent(new Event("visibilitychange"));
			});

			vi.setSystemTime(endTimeMs + 5_000);

			setVisibilityState("visible");
			await act(async () => {
				document.dispatchEvent(new Event("visibilitychange"));
			});

			expect(result.current.state).toBe("completed");
			expect(result.current.catchUp).toMatchObject({
				endedWhileHidden: true,
				gate: "WORK_CONFIRM",
				cycleEndedAtMs: endTimeMs,
			});
		} finally {
			vi.useRealTimers();
			vi.stubGlobal("Worker", FakeWorker);
		}
	});
});
