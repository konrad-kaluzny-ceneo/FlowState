import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TimerWorkerInbound } from "~/workers/timer-worker-logic";

const mutateGetOrCreate = vi.fn();
const mutateCreate = vi.fn();
const mutateComplete = vi.fn();
const mutateInterrupt = vi.fn();
const invalidateGetActive = vi.fn();
const invalidateTaskList = vi.fn();

let getActiveData: {
	id: number;
	startedAt: Date;
	configuredDurationSec: number;
	taskId: number | null;
	task: { id: number; title: string } | null;
} | null = null;

const fakeWorkers: FakeWorker[] = [];

class FakeWorker {
	onmessage: ((event: MessageEvent) => void) | null = null;
	private endTime: number | null = null;
	private stopped = false;

	constructor() {
		fakeWorkers.push(this);
	}

	postMessage(message: TimerWorkerInbound) {
		if (message.type === "stop") {
			this.stopped = true;
			this.endTime = null;
			return;
		}
		if (message.type === "start") {
			this.stopped = false;
			this.endTime = message.endTime;
			this.emitTick();
		}
	}

	emitTick() {
		if (this.stopped || this.endTime == null || !this.onmessage) {
			return;
		}
		const remaining = this.endTime - Date.now();
		if (remaining <= 0) {
			this.onmessage({ data: { type: "complete" } } as MessageEvent);
			return;
		}
		this.onmessage({
			data: { type: "tick", remaining },
		} as MessageEvent);
	}

	terminate() {}
}

vi.mock("~/lib/audio", () => ({
	createAudioManager: () => ({
		unlock: vi.fn().mockResolvedValue(undefined),
		preload: vi.fn().mockResolvedValue(undefined),
		playAlarm: vi.fn().mockResolvedValue(undefined),
		dispose: vi.fn(),
	}),
}));

vi.mock("~/trpc/react", () => ({
	api: {
		useUtils: () => ({
			cycle: { getActive: { invalidate: invalidateGetActive } },
			task: { list: { invalidate: invalidateTaskList } },
		}),
		cycle: {
			getActive: {
				useQuery: () => ({ data: getActiveData }),
			},
			create: {
				useMutation: () => ({ mutateAsync: mutateCreate }),
			},
			complete: {
				useMutation: () => ({ mutateAsync: mutateComplete }),
			},
			interrupt: {
				useMutation: () => ({ mutateAsync: mutateInterrupt }),
			},
		},
		session: {
			getOrCreateActive: {
				useMutation: () => ({ mutateAsync: mutateGetOrCreate }),
			},
		},
	},
}));

vi.stubGlobal("Worker", FakeWorker);

const { usePomodoroCycle } = await import("./use-pomodoro-cycle");

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

describe("usePomodoroCycle", () => {
	beforeEach(() => {
		getActiveData = null;
		fakeWorkers.length = 0;
		vi.clearAllMocks();
		mutateGetOrCreate.mockResolvedValue({ id: 1 });
		mutateCreate.mockImplementation(async () => ({
			id: 42,
			startedAt: new Date(),
			configuredDurationSec: 60,
			taskId: 7,
			state: "RUNNING",
		}));
		mutateComplete.mockResolvedValue({ id: 42, state: "COMPLETED" });
		mutateInterrupt.mockResolvedValue({ id: 42, state: "INTERRUPTED" });
	});

	it("starts idle and transitions to running on start()", async () => {
		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("idle");
		});

		act(() => {
			result.current.selectTask(7, { id: 7, title: "Write tests" });
		});

		await act(async () => {
			await result.current.start(60);
		});

		expect(mutateGetOrCreate).toHaveBeenCalled();
		expect(mutateCreate).toHaveBeenCalledWith({
			kind: "WORK",
			configuredDurationSec: 60,
			taskId: 7,
		});
		expect(result.current.state).toBe("running");
	});

	it("transitions to completed when worker completes", async () => {
		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		act(() => {
			result.current.selectTask(7, { id: 7, title: "Write tests" });
		});

		await act(async () => {
			await result.current.start(60);
		});

		const worker = fakeWorkers[fakeWorkers.length - 1];
		expect(worker).toBeDefined();

		act(() => {
			worker?.onmessage?.({ data: { type: "complete" } } as MessageEvent);
		});

		expect(result.current.state).toBe("completed");
	});

	it("resumes running state from getActive on mount", async () => {
		const startedAt = new Date();
		getActiveData = {
			id: 99,
			startedAt,
			configuredDurationSec: 120,
			taskId: 3,
			task: { id: 3, title: "Resume me" },
		};

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("running");
		});

		expect(result.current.focusedTask).toMatchObject({
			id: 3,
			title: "Resume me",
		});
		expect(result.current.remainingMs).toBeGreaterThan(0);
	});

	it("calls interrupt mutation and returns to idle", async () => {
		getActiveData = {
			id: 10,
			startedAt: new Date(),
			configuredDurationSec: 300,
			taskId: 2,
			task: { id: 2, title: "Focus" },
		};

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("running");
		});

		await act(async () => {
			await result.current.interrupt();
		});

		expect(mutateInterrupt).toHaveBeenCalledWith({ cycleId: 10 });
		expect(result.current.state).toBe("idle");
	});

	it("confirmComplete calls complete mutation and resets to idle", async () => {
		getActiveData = {
			id: 11,
			startedAt: new Date(),
			configuredDurationSec: 300,
			taskId: 4,
			task: { id: 4, title: "Ship" },
		};

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("running");
		});

		act(() => {
			fakeWorkers[fakeWorkers.length - 1]?.onmessage?.({
				data: { type: "complete" },
			} as MessageEvent);
		});

		await act(async () => {
			await result.current.confirmComplete(true);
		});

		expect(mutateComplete).toHaveBeenCalledWith({
			cycleId: 11,
			markTaskDone: true,
		});
		expect(result.current.state).toBe("idle");
		expect(invalidateTaskList).toHaveBeenCalled();
	});
});
