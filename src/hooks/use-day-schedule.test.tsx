import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
	DomainContextTag,
	DomainScheduleBlock,
} from "~/lib/schedule/types";

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
	onSettled?: (
		data?: unknown,
		error?: unknown,
		variables?: TInput,
		context?: TContext,
	) => void;
};

let dataMode: "authenticated" | "guest" = "authenticated";
let blocksCache: DomainScheduleBlock[] | undefined;
let tagsCache: DomainContextTag[] | undefined;
let listBlocksEnabled: boolean | undefined;
let listTagsEnabled: boolean | undefined;

const cancelListBlocks = vi.fn().mockResolvedValue(undefined);
const cancelListTags = vi.fn().mockResolvedValue(undefined);
const invalidateListBlocks = vi.fn();
const invalidateListTags = vi.fn();
const getListBlocksData = vi.fn(() => blocksCache);
const getListTagsData = vi.fn(() => tagsCache);
const setListBlocksData = vi.fn(
	(
		_input: { localDateKey: string },
		updater: (
			old: DomainScheduleBlock[] | undefined,
		) => DomainScheduleBlock[] | undefined,
	) => {
		blocksCache = updater(blocksCache);
	},
);
const setListTagsData = vi.fn(
	(
		_input: undefined,
		updater: (
			old: DomainContextTag[] | undefined,
		) => DomainContextTag[] | undefined,
	) => {
		tagsCache = updater(tagsCache);
	},
);

const createMutateAsync = vi.fn();
const updateMutateAsync = vi.fn();
const deleteMutateAsync = vi.fn();
const setFocusMutateAsync = vi.fn();
const setBatchMutateAsync = vi.fn();
const createTagMutateAsync = vi.fn();
const deleteTagMutateAsync = vi.fn();

const mutationLifecycles: {
	createBlock: MutationLifecycle;
	updateBlock: MutationLifecycle;
	deleteBlock: MutationLifecycle;
	setBlockFocusTask: MutationLifecycle;
	setBlockBatchTasks: MutationLifecycle;
	createContextTag: MutationLifecycle;
	deleteContextTag: MutationLifecycle;
} = {
	createBlock: {},
	updateBlock: {},
	deleteBlock: {},
	setBlockFocusTask: {},
	setBlockBatchTasks: {},
	createContextTag: {},
	deleteContextTag: {},
};

function conflictError() {
	return new TRPCClientError("overlap", {
		result: {
			error: {
				code: "CONFLICT",
				message: "overlap",
				data: { code: "CONFLICT" },
			},
		},
	});
}

function sampleBlock(
	overrides: Partial<DomainScheduleBlock> = {},
): DomainScheduleBlock {
	const now = new Date("2026-08-18T10:00:00.000Z");
	return {
		id: 1,
		userId: "user-a",
		localDateKey: "2026-08-18",
		blockType: "FOCUS",
		startMinute: 540,
		durationMinutes: 30,
		metaLabel: null,
		fixedContext: null,
		customContextTagId: null,
		contextLabel: null,
		focusTaskId: null,
		focusTask: null,
		batchTaskIds: [],
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

async function runFailingMutation<TInput>(
	lifecycle: MutationLifecycle<TInput>,
	mutateAsync: typeof createMutateAsync,
	input: TInput,
	err: unknown,
) {
	mutateAsync.mockImplementation(async (mutationInput: TInput) => {
		const context = await lifecycle.onMutate?.(mutationInput);
		try {
			lifecycle.onError?.(err, mutationInput, context);
			throw err;
		} finally {
			lifecycle.onSettled?.(undefined, err, mutationInput, context);
		}
	});
	await expect(mutateAsync(input)).rejects.toBe(err);
}

vi.mock("~/lib/data-mode/data-mode-context", () => ({
	useDataMode: () => dataMode,
}));

vi.mock("~/trpc/react", () => ({
	api: {
		useUtils: () => ({
			dayPlan: {
				listBlocks: {
					invalidate: invalidateListBlocks,
					cancel: cancelListBlocks,
					getData: getListBlocksData,
					setData: setListBlocksData,
				},
				listContextTags: {
					invalidate: invalidateListTags,
					cancel: cancelListTags,
					getData: getListTagsData,
					setData: setListTagsData,
				},
			},
		}),
		dayPlan: {
			listBlocks: {
				useQuery: (
					_input: { localDateKey: string },
					opts?: { enabled?: boolean },
				) => {
					listBlocksEnabled = opts?.enabled;
					if (opts?.enabled === false) {
						return { data: undefined, isLoading: false };
					}
					return { data: blocksCache ?? [], isLoading: false };
				},
			},
			listContextTags: {
				useQuery: (_input: undefined, opts?: { enabled?: boolean }) => {
					listTagsEnabled = opts?.enabled;
					if (opts?.enabled === false) {
						return { data: undefined, isLoading: false };
					}
					return { data: tagsCache ?? [], isLoading: false };
				},
			},
			createBlock: {
				useMutation: (opts: MutationLifecycle) => {
					mutationLifecycles.createBlock = opts;
					return { mutateAsync: createMutateAsync, isPending: false };
				},
			},
			updateBlock: {
				useMutation: (opts: MutationLifecycle) => {
					mutationLifecycles.updateBlock = opts;
					return { mutateAsync: updateMutateAsync, isPending: false };
				},
			},
			deleteBlock: {
				useMutation: (opts: MutationLifecycle) => {
					mutationLifecycles.deleteBlock = opts;
					return { mutateAsync: deleteMutateAsync, isPending: false };
				},
			},
			setBlockFocusTask: {
				useMutation: (opts: MutationLifecycle) => {
					mutationLifecycles.setBlockFocusTask = opts;
					return { mutateAsync: setFocusMutateAsync, isPending: false };
				},
			},
			setBlockBatchTasks: {
				useMutation: (opts: MutationLifecycle) => {
					mutationLifecycles.setBlockBatchTasks = opts;
					return { mutateAsync: setBatchMutateAsync, isPending: false };
				},
			},
			createContextTag: {
				useMutation: (opts: MutationLifecycle) => {
					mutationLifecycles.createContextTag = opts;
					return { mutateAsync: createTagMutateAsync, isPending: false };
				},
			},
			deleteContextTag: {
				useMutation: (opts: MutationLifecycle) => {
					mutationLifecycles.deleteContextTag = opts;
					return { mutateAsync: deleteTagMutateAsync, isPending: false };
				},
			},
		},
	},
}));

const { useDaySchedule } = await import("~/hooks/use-day-schedule");

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

describe("useDaySchedule", () => {
	beforeEach(() => {
		dataMode = "authenticated";
		blocksCache = [sampleBlock()];
		tagsCache = [];
		listBlocksEnabled = undefined;
		listTagsEnabled = undefined;
		vi.clearAllMocks();
	});

	it("enables block and tag queries when authenticated", () => {
		const { result } = renderHook(() => useDaySchedule("2026-08-18"), {
			wrapper: createWrapper(),
		});

		expect(listBlocksEnabled).toBe(true);
		expect(listTagsEnabled).toBe(true);
		expect(result.current.blocks).toEqual(blocksCache);
		expect(result.current.isLoading).toBe(false);
		expect(invalidateListBlocks).toHaveBeenCalledWith({
			localDateKey: "2026-08-18",
		});
	});

	it("does not fetch schedule data in guest mode", () => {
		dataMode = "guest";
		const { result } = renderHook(() => useDaySchedule("2026-08-18"), {
			wrapper: createWrapper(),
		});

		expect(listBlocksEnabled).toBe(false);
		expect(listTagsEnabled).toBe(false);
		expect(result.current.blocks).toEqual([]);
		expect(result.current.isLoading).toBe(false);
		expect(invalidateListBlocks).not.toHaveBeenCalled();
	});

	it("rolls back optimistic create on CONFLICT", async () => {
		blocksCache = [];
		const { result } = renderHook(() => useDaySchedule("2026-08-18"), {
			wrapper: createWrapper(),
		});

		await act(async () => {
			await runFailingMutation(
				mutationLifecycles.createBlock,
				createMutateAsync,
				{
					localDateKey: "2026-08-18",
					blockType: "FOCUS",
					startMinute: 540,
					durationMinutes: 30,
				},
				conflictError(),
			);
		});

		expect(blocksCache).toEqual([]);
		await waitFor(() => {
			expect(result.current.error).toBe(
				"This block overlaps another — pick a different time.",
			);
		});
	});

	it("rolls back optimistic focus attachment on CONFLICT", async () => {
		const { result } = renderHook(() => useDaySchedule("2026-08-18"), {
			wrapper: createWrapper(),
		});

		await act(async () => {
			await runFailingMutation(
				mutationLifecycles.setBlockFocusTask,
				setFocusMutateAsync,
				{ blockId: 1, taskId: 99 },
				conflictError(),
			);
		});

		expect(blocksCache).toEqual([sampleBlock()]);
		await waitFor(() => {
			expect(result.current.error).toBe(
				"This block overlaps another — pick a different time.",
			);
		});
	});

	it("rolls back optimistic batch attachment on CONFLICT", async () => {
		blocksCache = [sampleBlock({ id: 2, blockType: "BATCH" })];
		const { result } = renderHook(() => useDaySchedule("2026-08-18"), {
			wrapper: createWrapper(),
		});

		await act(async () => {
			await runFailingMutation(
				mutationLifecycles.setBlockBatchTasks,
				setBatchMutateAsync,
				{ blockId: 2, taskIds: [10, 11] },
				conflictError(),
			);
		});

		expect(blocksCache).toEqual([sampleBlock({ id: 2, blockType: "BATCH" })]);
		await waitFor(() => {
			expect(result.current.error).toBe(
				"This block overlaps another — pick a different time.",
			);
		});
	});
});
