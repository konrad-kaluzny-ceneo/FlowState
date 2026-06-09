import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TaskListData } from "~/hooks/use-task-mutations";

type MutationLifecycle<
	TInput = unknown,
	TOutput = unknown,
	TContext = unknown,
> = {
	onMutate?: (
		input: TInput,
	) => Promise<TContext | undefined> | TContext | undefined;
	onError?: (
		err: unknown,
		input: TInput,
		context: TContext | undefined,
	) => void;
	onSuccess?: (
		data: TOutput,
		input: TInput,
		context: TContext | undefined,
	) => void;
	onSettled?: () => void;
};

const cancelTaskList = vi.fn();
let taskListCache: TaskListData | undefined;
const getTaskListData = vi.fn(() => taskListCache);
const setTaskListData = vi.fn(
	(
		_input: undefined,
		updater: (old: TaskListData | undefined) => TaskListData,
	) => {
		taskListCache = updater(taskListCache);
	},
);
const invalidateTaskList = vi.fn();

const taskRepoCreate = vi.fn();
const taskRepoUpdate = vi.fn();
const taskRepoDelete = vi.fn();
const taskRepoReorder = vi.fn();

const createMutateAsync = vi.fn();
const updateMutateAsync = vi.fn();
const deleteMutateAsync = vi.fn();
const reorderMutateAsync = vi.fn();

const mutationLifecycles: {
	create: MutationLifecycle;
	update: MutationLifecycle;
	delete: MutationLifecycle;
	reorder: MutationLifecycle;
} = {
	create: {},
	update: {},
	delete: {},
	reorder: {},
};

let dataMode: "authenticated" | "guest" = "authenticated";

async function runMutationLifecycle<TInput, TOutput, TContext>(
	lifecycle: MutationLifecycle<TInput, TOutput, TContext>,
	mutateAsync: typeof createMutateAsync,
	input: TInput,
	result: TOutput,
): Promise<TOutput> {
	mutateAsync.mockImplementation(async (mutationInput: TInput) => {
		const context = await lifecycle.onMutate?.(mutationInput);
		try {
			lifecycle.onSuccess?.(result, mutationInput, context);
			return result;
		} catch (err) {
			lifecycle.onError?.(err, mutationInput, context);
			throw err;
		} finally {
			lifecycle.onSettled?.();
		}
	});
	return mutateAsync(input);
}

async function runFailingMutationLifecycle<TInput, TContext>(
	lifecycle: MutationLifecycle<TInput, void, TContext>,
	mutateAsync: typeof updateMutateAsync,
	input: TInput,
	err: unknown,
): Promise<void> {
	mutateAsync.mockImplementation(async (mutationInput: TInput) => {
		const context = await lifecycle.onMutate?.(mutationInput);
		try {
			throw err;
		} catch (error) {
			lifecycle.onError?.(error, mutationInput, context);
			throw error;
		} finally {
			lifecycle.onSettled?.();
		}
	});
	await expect(mutateAsync(input)).rejects.toBe(err);
}

vi.mock("~/lib/data-mode/data-mode-context", () => ({
	useDataMode: () => dataMode,
	useRepositories: () => ({
		tasks: {
			create: taskRepoCreate,
			update: taskRepoUpdate,
			delete: taskRepoDelete,
			reorder: taskRepoReorder,
		},
	}),
}));

vi.mock("~/trpc/react", () => ({
	api: {
		useUtils: () => ({
			task: {
				list: {
					cancel: cancelTaskList,
					getData: getTaskListData,
					setData: setTaskListData,
					invalidate: invalidateTaskList,
				},
			},
		}),
		task: {
			create: {
				useMutation: (opts: MutationLifecycle) => {
					mutationLifecycles.create = opts;
					return {
						mutateAsync: createMutateAsync,
						isPending: false,
					};
				},
			},
			update: {
				useMutation: (opts: MutationLifecycle) => {
					mutationLifecycles.update = opts;
					return {
						mutateAsync: updateMutateAsync,
						isPending: false,
					};
				},
			},
			delete: {
				useMutation: (opts: MutationLifecycle) => {
					mutationLifecycles.delete = opts;
					return {
						mutateAsync: deleteMutateAsync,
						isPending: false,
					};
				},
			},
			reorder: {
				useMutation: (opts: MutationLifecycle) => {
					mutationLifecycles.reorder = opts;
					return {
						mutateAsync: reorderMutateAsync,
						isPending: false,
					};
				},
			},
		},
	},
}));

const { useTaskMutations } = await import("~/hooks/use-task-mutations");

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

function makeTask(
	overrides: Partial<TaskListData[number]> = {},
): TaskListData[number] {
	return {
		id: 1,
		userId: "user-1",
		title: "Existing task",
		status: "active",
		workType: "OPERATIONAL",
		weight: 2,
		sortOrder: 0,
		createdAt: new Date("2026-01-01T00:00:00Z"),
		updatedAt: new Date("2026-01-01T00:00:00Z"),
		...overrides,
	};
}

describe("useTaskMutations", () => {
	beforeEach(() => {
		dataMode = "authenticated";
		taskListCache = [makeTask()];
		vi.clearAllMocks();
		mutationLifecycles.create = {};
		mutationLifecycles.update = {};
		mutationLifecycles.delete = {};
		mutationLifecycles.reorder = {};
		cancelTaskList.mockResolvedValue(undefined);
	});

	it("optimistically appends on create and invalidates on settle", async () => {
		const serverTask = makeTask({ id: 42, title: "New task" });

		const { result } = renderHook(() => useTaskMutations(), {
			wrapper: createWrapper(),
		});

		let context:
			| { previousTasks: TaskListData | undefined; tempId: number }
			| undefined;
		await act(async () => {
			context = (await mutationLifecycles.create.onMutate?.({
				title: "New task",
			})) as typeof context;
		});

		expect(cancelTaskList).toHaveBeenCalled();
		expect(setTaskListData).toHaveBeenCalled();
		expect(taskListCache).toHaveLength(2);
		expect(taskListCache?.[1]?.title).toBe("New task");
		expect(taskListCache?.[1]?.id).toBeLessThan(0);

		await act(async () => {
			mutationLifecycles.create.onSuccess?.(
				serverTask,
				{ title: "New task" },
				context,
			);
			mutationLifecycles.create.onSettled?.();
		});

		expect(taskListCache?.[1]?.id).toBe(42);
		expect(invalidateTaskList).toHaveBeenCalled();
		expect(result.current.error).toBeNull();
	});

	it("optimistically patches task fields on update", async () => {
		const { result } = renderHook(() => useTaskMutations(), {
			wrapper: createWrapper(),
		});

		await act(async () => {
			await runMutationLifecycle(
				mutationLifecycles.update,
				updateMutateAsync,
				{ id: 1, title: "Renamed", workType: "DEEP_WORK", weight: 3 },
				undefined,
			);
		});

		expect(cancelTaskList).toHaveBeenCalled();
		const updated = taskListCache?.[0];
		expect(updated?.title).toBe("Renamed");
		expect(updated?.workType).toBe("DEEP_WORK");
		expect(updated?.weight).toBe(3);
		expect(invalidateTaskList).toHaveBeenCalled();
		expect(result.current.error).toBeNull();
	});

	it("optimistically patches status on complete/revert", async () => {
		const { result } = renderHook(() => useTaskMutations(), {
			wrapper: createWrapper(),
		});

		await act(async () => {
			await runMutationLifecycle(
				mutationLifecycles.update,
				updateMutateAsync,
				{ id: 1, status: "completed" },
				undefined,
			);
		});

		expect(taskListCache?.[0]?.status).toBe("completed");

		await act(async () => {
			await runMutationLifecycle(
				mutationLifecycles.update,
				updateMutateAsync,
				{ id: 1, status: "active" },
				undefined,
			);
		});

		expect(taskListCache?.[0]?.status).toBe("active");
		expect(result.current.error).toBeNull();
	});

	it("optimistically removes task on delete", async () => {
		taskListCache = [
			makeTask({ id: 1 }),
			makeTask({ id: 2, title: "Keep me" }),
		];

		const { result } = renderHook(() => useTaskMutations(), {
			wrapper: createWrapper(),
		});

		await act(async () => {
			await runMutationLifecycle(
				mutationLifecycles.delete,
				deleteMutateAsync,
				{ id: 1 },
				undefined,
			);
		});

		expect(cancelTaskList).toHaveBeenCalled();
		expect(taskListCache).toEqual([makeTask({ id: 2, title: "Keep me" })]);
		expect(invalidateTaskList).toHaveBeenCalled();
		expect(result.current.error).toBeNull();
	});

	it("restores empty cache on failed create", async () => {
		taskListCache = undefined;

		const { result } = renderHook(() => useTaskMutations(), {
			wrapper: createWrapper(),
		});

		await act(async () => {
			await runFailingMutationLifecycle(
				mutationLifecycles.create,
				createMutateAsync,
				{ title: "Broken" },
				new Error("Create failed"),
			).catch(() => {});
		});

		await waitFor(() => {
			expect(result.current.error).toBe(
				"Something went wrong. Please try again.",
			);
		});

		expect(taskListCache).toBeUndefined();
		expect(invalidateTaskList).toHaveBeenCalled();
	});

	it("restores snapshot and exposes error on mutation failure", async () => {
		const previous = [makeTask()];
		taskListCache = previous;

		const notFound = new TRPCClientError("Task not found", {
			result: {
				error: {
					code: "NOT_FOUND",
					message: "Task not found",
					data: { code: "NOT_FOUND" },
				},
			},
		});

		const { result } = renderHook(() => useTaskMutations(), {
			wrapper: createWrapper(),
		});

		await act(async () => {
			await runFailingMutationLifecycle(
				mutationLifecycles.update,
				updateMutateAsync,
				{ id: 1, title: "Broken" },
				notFound,
			).catch(() => {});
		});

		await waitFor(() => {
			expect(result.current.error).toBe("Task not found");
		});

		expect(taskListCache).toEqual(previous);
		expect(invalidateTaskList).toHaveBeenCalled();
	});

	it("delegates to repository in guest mode without cache helpers", async () => {
		dataMode = "guest";
		taskRepoCreate.mockResolvedValue(makeTask({ id: 99 }));

		const { result } = renderHook(() => useTaskMutations(), {
			wrapper: createWrapper(),
		});

		await act(async () => {
			await result.current.createTask({ title: "Guest task" });
		});

		expect(taskRepoCreate).toHaveBeenCalledWith({ title: "Guest task" });
		expect(cancelTaskList).not.toHaveBeenCalled();
		expect(setTaskListData).not.toHaveBeenCalled();
		expect(createMutateAsync).not.toHaveBeenCalled();
	});

	it("clears error via clearError", async () => {
		const notFound = new TRPCClientError("Task not found", {
			result: {
				error: {
					code: "NOT_FOUND",
					message: "Task not found",
					data: { code: "NOT_FOUND" },
				},
			},
		});

		const { result } = renderHook(() => useTaskMutations(), {
			wrapper: createWrapper(),
		});

		await act(async () => {
			await runFailingMutationLifecycle(
				mutationLifecycles.delete,
				deleteMutateAsync,
				{ id: 1 },
				notFound,
			).catch(() => {});
		});

		await waitFor(() => {
			expect(result.current.error).toBe("Task not found");
		});

		act(() => {
			result.current.clearError();
		});

		expect(result.current.error).toBeNull();
	});

	it("optimistically reorders active tasks before resolve", async () => {
		taskListCache = [
			makeTask({ id: 1, title: "First", sortOrder: 0 }),
			makeTask({ id: 2, title: "Second", sortOrder: 1 }),
			makeTask({ id: 3, title: "Third", sortOrder: 2 }),
		];

		const { result } = renderHook(() => useTaskMutations(), {
			wrapper: createWrapper(),
		});

		await act(async () => {
			await runMutationLifecycle(
				mutationLifecycles.reorder,
				reorderMutateAsync,
				{ orderedIds: [3, 1, 2] },
				undefined,
			);
		});

		expect(cancelTaskList).toHaveBeenCalled();
		expect(taskListCache?.map((task) => task.id)).toEqual([3, 1, 2]);
		expect(taskListCache?.map((task) => task.sortOrder)).toEqual([0, 1, 2]);
		expect(invalidateTaskList).toHaveBeenCalled();
		expect(result.current.error).toBeNull();
	});

	it("restores snapshot on failed reorder", async () => {
		const previous = [
			makeTask({ id: 1, sortOrder: 0 }),
			makeTask({ id: 2, title: "Second", sortOrder: 1 }),
		];
		taskListCache = previous;

		const { result } = renderHook(() => useTaskMutations(), {
			wrapper: createWrapper(),
		});

		await act(async () => {
			await runFailingMutationLifecycle(
				mutationLifecycles.reorder,
				reorderMutateAsync,
				{ orderedIds: [2, 1] },
				new Error("Reorder failed"),
			).catch(() => {});
		});

		await waitFor(() => {
			expect(result.current.error).toBe(
				"Something went wrong. Please try again.",
			);
		});

		expect(taskListCache).toEqual(previous);
		expect(invalidateTaskList).toHaveBeenCalled();
	});

	it("delegates reorder to repository in guest mode without cache helpers", async () => {
		dataMode = "guest";
		taskRepoReorder.mockResolvedValue(undefined);

		const { result } = renderHook(() => useTaskMutations(), {
			wrapper: createWrapper(),
		});

		await act(async () => {
			await result.current.reorderTasks({ orderedIds: [2, 1] });
		});

		expect(taskRepoReorder).toHaveBeenCalledWith({ orderedIds: [2, 1] });
		expect(cancelTaskList).not.toHaveBeenCalled();
		expect(setTaskListData).not.toHaveBeenCalled();
		expect(reorderMutateAsync).not.toHaveBeenCalled();
	});

	it("skips server update/delete for temp negative ids", async () => {
		const { result } = renderHook(() => useTaskMutations(), {
			wrapper: createWrapper(),
		});

		await act(async () => {
			await result.current.updateTask({ id: -99, title: "Temp" });
			await result.current.deleteTask({ id: -99 });
		});

		expect(updateMutateAsync).not.toHaveBeenCalled();
		expect(deleteMutateAsync).not.toHaveBeenCalled();
	});
});
