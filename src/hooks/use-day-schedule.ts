"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDataMode } from "~/lib/data-mode/data-mode-context";
import type {
	DomainContextTag,
	DomainScheduleBlock,
} from "~/lib/schedule/types";
import { isTrpcErrorCode } from "~/lib/trpc/error-code";
import type { RouterInputs } from "~/trpc/react";
import { api } from "~/trpc/react";

type CreateBlockInput = Omit<
	RouterInputs["dayPlan"]["createBlock"],
	"localDateKey"
>;
type UpdateBlockInput = RouterInputs["dayPlan"]["updateBlock"];
type SetFocusTaskInput = RouterInputs["dayPlan"]["setBlockFocusTask"];
type SetBatchTasksInput = RouterInputs["dayPlan"]["setBlockBatchTasks"];

type ListBlocksInput = { localDateKey: string };

type MutationContext = {
	previous: DomainScheduleBlock[] | undefined;
	tempId?: number;
};

type TagMutationContext = {
	previous: DomainContextTag[] | undefined;
	tempId?: number;
};

type PendingTempMutation =
	| { kind: "update"; patch: Omit<UpdateBlockInput, "blockId"> }
	| { kind: "delete" };

let nextTempBlockId = 0;
let nextTempTagId = 0;

function allocateTempBlockId(): number {
	nextTempBlockId -= 1;
	return nextTempBlockId;
}

function isTempBlockId(id: number): boolean {
	return id < 0;
}

function allocateTempTagId(): number {
	nextTempTagId -= 1;
	return nextTempTagId;
}

function sortBlocks(blocks: DomainScheduleBlock[]): DomainScheduleBlock[] {
	return [...blocks].sort((a, b) => {
		if (a.startMinute !== b.startMinute) {
			return a.startMinute - b.startMinute;
		}
		return a.id - b.id;
	});
}

function buildOptimisticBlock(
	input: CreateBlockInput & { localDateKey: string },
	tempId: number,
	existing: DomainScheduleBlock[] | undefined,
): DomainScheduleBlock {
	const now = new Date();
	return {
		id: tempId,
		userId: existing?.[0]?.userId ?? "",
		localDateKey: input.localDateKey,
		blockType: input.blockType,
		startMinute: input.startMinute,
		durationMinutes: input.durationMinutes,
		metaLabel: input.metaLabel ?? null,
		fixedContext: input.fixedContext ?? null,
		customContextTagId: input.customContextTagId ?? null,
		contextLabel: input.fixedContext ?? null,
		focusTaskId: null,
		focusTask: null,
		batchTaskIds: [],
		createdAt: now,
		updatedAt: now,
	};
}

function patchBlock(
	list: DomainScheduleBlock[] | undefined,
	blockId: number,
	patch: Partial<DomainScheduleBlock>,
): DomainScheduleBlock[] {
	return sortBlocks(
		(list ?? []).map((block) =>
			block.id === blockId ? { ...block, ...patch } : block,
		),
	);
}

function replaceBlock(
	list: DomainScheduleBlock[] | undefined,
	updated: DomainScheduleBlock,
): DomainScheduleBlock[] {
	return sortBlocks(
		(list ?? []).map((block) => (block.id === updated.id ? updated : block)),
	);
}

/**
 * Auth-only day schedule. Pass `localDateKey` from `useDayPlan()` — do not
 * invent a second date key. Create/move/resize/delete are optimistic (S-09);
 * attachment and context mutators use the same rollback pattern (L-04).
 */
export function useDaySchedule(localDateKey: string) {
	const t = useTranslations("PlanDnia");
	const mode = useDataMode();
	const enabled = mode === "authenticated";
	const utils = api.useUtils();
	const [error, setError] = useState<string | null>(null);
	const pendingByTempIdRef = useRef(new Map<number, PendingTempMutation[]>());
	const updateMutateAsyncRef = useRef<
		((input: UpdateBlockInput) => Promise<DomainScheduleBlock>) | null
	>(null);
	const deleteMutateAsyncRef = useRef<
		((input: { blockId: number }) => Promise<unknown>) | null
	>(null);
	const listInput = useMemo<ListBlocksInput>(
		() => ({ localDateKey }),
		[localDateKey],
	);

	useEffect(() => {
		if (!enabled) {
			return;
		}
		void utils.dayPlan.listBlocks.invalidate({ localDateKey });
	}, [enabled, localDateKey, utils]);

	const blocksQuery = api.dayPlan.listBlocks.useQuery(listInput, { enabled });
	const tagsQuery = api.dayPlan.listContextTags.useQuery(undefined, {
		enabled,
	});

	const scheduleErrorMessage = useCallback(
		(err: unknown) => {
			if (isTrpcErrorCode(err, "CONFLICT")) {
				return t("overlapError");
			}
			return t("scheduleSaveError");
		},
		[t],
	);

	const rollbackList = useCallback(
		(err: unknown, _input: unknown, context: MutationContext | undefined) => {
			if (context) {
				utils.dayPlan.listBlocks.setData(listInput, () => context.previous);
			}
			setError(scheduleErrorMessage(err));
		},
		[listInput, scheduleErrorMessage, utils],
	);

	const resyncListOnError = useCallback(
		(_data: unknown, error: unknown) => {
			if (error != null) {
				void utils.dayPlan.listBlocks.invalidate(listInput);
			}
		},
		[listInput, utils],
	);

	const resyncTagsOnError = useCallback(
		(_data: unknown, error: unknown) => {
			if (error != null) {
				void utils.dayPlan.listContextTags.invalidate();
			}
		},
		[utils],
	);

	const createBlockMutation = api.dayPlan.createBlock.useMutation({
		onMutate: async (input) => {
			await utils.dayPlan.listBlocks.cancel(listInput);
			const previous = utils.dayPlan.listBlocks.getData(listInput);
			const tempId = allocateTempBlockId();
			utils.dayPlan.listBlocks.setData(listInput, (old) =>
				sortBlocks([...(old ?? []), buildOptimisticBlock(input, tempId, old)]),
			);
			return { previous, tempId } satisfies MutationContext;
		},
		onError: rollbackList,
		onSuccess: (created, _input, context) => {
			if (context?.tempId == null) {
				return;
			}
			utils.dayPlan.listBlocks.setData(listInput, (old) =>
				sortBlocks(
					(old ?? []).map((block) =>
						block.id === context.tempId ? created : block,
					),
				),
			);
			const pending = pendingByTempIdRef.current.get(context.tempId) ?? [];
			pendingByTempIdRef.current.delete(context.tempId);
			for (const item of pending) {
				if (item.kind === "delete") {
					void deleteMutateAsyncRef.current?.({ blockId: created.id });
					break;
				}
				void updateMutateAsyncRef.current?.({
					blockId: created.id,
					...item.patch,
				});
			}
		},
		onSettled: resyncListOnError,
	});
	const updateBlockMutation = api.dayPlan.updateBlock.useMutation({
		onMutate: async (input) => {
			await utils.dayPlan.listBlocks.cancel(listInput);
			const previous = utils.dayPlan.listBlocks.getData(listInput);
			const nextContextLabel =
				input.fixedContext != null
					? input.fixedContext
					: input.customContextTagId != null
						? (utils.dayPlan.listContextTags
								.getData()
								?.find((tag) => tag.id === input.customContextTagId)?.label ??
							null)
						: input.fixedContext === null || input.customContextTagId === null
							? null
							: undefined;
			utils.dayPlan.listBlocks.setData(listInput, (old) =>
				patchBlock(old, input.blockId, {
					...(input.blockType != null ? { blockType: input.blockType } : {}),
					...(input.startMinute != null
						? { startMinute: input.startMinute }
						: {}),
					...(input.durationMinutes != null
						? { durationMinutes: input.durationMinutes }
						: {}),
					...(input.metaLabel !== undefined
						? { metaLabel: input.metaLabel ?? null }
						: {}),
					...(input.fixedContext !== undefined
						? { fixedContext: input.fixedContext }
						: {}),
					...(input.customContextTagId !== undefined
						? { customContextTagId: input.customContextTagId }
						: {}),
					...(nextContextLabel !== undefined
						? { contextLabel: nextContextLabel }
						: {}),
					...(input.blockType != null && input.blockType !== "FOCUS"
						? { focusTaskId: null, focusTask: null }
						: {}),
					...(input.blockType != null && input.blockType !== "BATCH"
						? { batchTaskIds: [], metaLabel: null }
						: {}),
					...(input.focusTaskId !== undefined
						? {
								focusTaskId: input.focusTaskId,
								focusTask:
									input.focusTaskId == null
										? null
										: (old ?? []).find((block) => block.id === input.blockId)
													?.focusTask?.id === input.focusTaskId
											? ((old ?? []).find((block) => block.id === input.blockId)
													?.focusTask ?? null)
											: null,
							}
						: {}),
					...(input.batchTaskIds !== undefined
						? { batchTaskIds: input.batchTaskIds }
						: {}),
				}),
			);
			return { previous } satisfies MutationContext;
		},
		onError: rollbackList,
		onSuccess: (updated) => {
			utils.dayPlan.listBlocks.setData(listInput, (old) =>
				replaceBlock(old, updated),
			);
		},
		onSettled: resyncListOnError,
	});
	const deleteBlockMutation = api.dayPlan.deleteBlock.useMutation({
		onMutate: async (input) => {
			await utils.dayPlan.listBlocks.cancel(listInput);
			const previous = utils.dayPlan.listBlocks.getData(listInput);
			utils.dayPlan.listBlocks.setData(listInput, (old) =>
				(old ?? []).filter((block) => block.id !== input.blockId),
			);
			return { previous } satisfies MutationContext;
		},
		onError: rollbackList,
		onSettled: resyncListOnError,
	});
	const setFocusTaskMutation = api.dayPlan.setBlockFocusTask.useMutation({
		onMutate: async (input) => {
			await utils.dayPlan.listBlocks.cancel(listInput);
			const previous = utils.dayPlan.listBlocks.getData(listInput);
			utils.dayPlan.listBlocks.setData(listInput, (old) =>
				patchBlock(old, input.blockId, {
					focusTaskId: input.taskId,
					focusTask:
						input.taskId == null
							? null
							: (old ?? []).find((block) => block.id === input.blockId)
										?.focusTask?.id === input.taskId
								? ((old ?? []).find((block) => block.id === input.blockId)
										?.focusTask ?? null)
								: null,
				}),
			);
			return { previous } satisfies MutationContext;
		},
		onError: rollbackList,
		onSuccess: (updated) => {
			utils.dayPlan.listBlocks.setData(listInput, (old) =>
				replaceBlock(old, updated),
			);
		},
		onSettled: resyncListOnError,
	});
	const setBatchTasksMutation = api.dayPlan.setBlockBatchTasks.useMutation({
		onMutate: async (input) => {
			await utils.dayPlan.listBlocks.cancel(listInput);
			const previous = utils.dayPlan.listBlocks.getData(listInput);
			utils.dayPlan.listBlocks.setData(listInput, (old) =>
				patchBlock(old, input.blockId, { batchTaskIds: input.taskIds }),
			);
			return { previous } satisfies MutationContext;
		},
		onError: rollbackList,
		onSuccess: (updated) => {
			utils.dayPlan.listBlocks.setData(listInput, (old) =>
				replaceBlock(old, updated),
			);
		},
		onSettled: resyncListOnError,
	});
	const createTagMutation = api.dayPlan.createContextTag.useMutation({
		onMutate: async (input) => {
			await utils.dayPlan.listContextTags.cancel();
			const previous = utils.dayPlan.listContextTags.getData();
			const tempId = allocateTempTagId();
			const now = new Date();
			utils.dayPlan.listContextTags.setData(undefined, (old) => [
				...(old ?? []),
				{
					id: tempId,
					label: input.label.trim(),
					createdAt: now,
					updatedAt: now,
				},
			]);
			return { previous, tempId } satisfies TagMutationContext;
		},
		onError: (_err, _input, context) => {
			if (context) {
				utils.dayPlan.listContextTags.setData(undefined, context.previous);
			}
		},
		onSuccess: (created, _input, context) => {
			utils.dayPlan.listContextTags.setData(undefined, (old) =>
				(old ?? []).map((tag) => (tag.id === context?.tempId ? created : tag)),
			);
		},
		onSettled: resyncTagsOnError,
	});
	const deleteTagMutation = api.dayPlan.deleteContextTag.useMutation({
		onMutate: async (input) => {
			await utils.dayPlan.listContextTags.cancel();
			const previous = utils.dayPlan.listContextTags.getData();
			utils.dayPlan.listContextTags.setData(undefined, (old) =>
				(old ?? []).filter((tag) => tag.id !== input.tagId),
			);
			return { previous } satisfies TagMutationContext;
		},
		onError: (_err, _input, context) => {
			if (context) {
				utils.dayPlan.listContextTags.setData(undefined, context.previous);
			}
		},
		onSettled: resyncTagsOnError,
	});

	const createBlock = useCallback(
		async (input: CreateBlockInput) => {
			setError(null);
			return createBlockMutation.mutateAsync({ ...input, localDateKey });
		},
		[createBlockMutation, localDateKey],
	);

	updateMutateAsyncRef.current = updateBlockMutation.mutateAsync;
	deleteMutateAsyncRef.current = deleteBlockMutation.mutateAsync;

	const updateBlock = useCallback(
		async (input: UpdateBlockInput) => {
			setError(null);
			if (isTempBlockId(input.blockId)) {
				const { blockId, ...patch } = input;
				utils.dayPlan.listBlocks.setData(listInput, (old) =>
					patchBlock(old, blockId, {
						...(patch.blockType != null ? { blockType: patch.blockType } : {}),
						...(patch.startMinute != null
							? { startMinute: patch.startMinute }
							: {}),
						...(patch.durationMinutes != null
							? { durationMinutes: patch.durationMinutes }
							: {}),
						...(patch.metaLabel !== undefined
							? { metaLabel: patch.metaLabel ?? null }
							: {}),
						...(patch.fixedContext !== undefined
							? { fixedContext: patch.fixedContext }
							: {}),
						...(patch.customContextTagId !== undefined
							? { customContextTagId: patch.customContextTagId }
							: {}),
						...(patch.focusTaskId !== undefined
							? {
									focusTaskId: patch.focusTaskId,
									focusTask: null,
								}
							: {}),
						...(patch.batchTaskIds !== undefined
							? { batchTaskIds: patch.batchTaskIds }
							: {}),
					}),
				);
				const queue = pendingByTempIdRef.current.get(blockId) ?? [];
				queue.push({ kind: "update", patch });
				pendingByTempIdRef.current.set(blockId, queue);
				return;
			}
			return updateBlockMutation.mutateAsync(input);
		},
		[listInput, updateBlockMutation, utils],
	);

	const deleteBlock = useCallback(
		async (blockId: number) => {
			setError(null);
			if (isTempBlockId(blockId)) {
				utils.dayPlan.listBlocks.setData(listInput, (old) =>
					(old ?? []).filter((block) => block.id !== blockId),
				);
				const queue = pendingByTempIdRef.current.get(blockId) ?? [];
				queue.push({ kind: "delete" });
				pendingByTempIdRef.current.set(blockId, queue);
				return;
			}
			await deleteBlockMutation.mutateAsync({ blockId });
		},
		[deleteBlockMutation, listInput, utils],
	);

	const setBlockFocusTask = useCallback(
		async (input: SetFocusTaskInput) => {
			return setFocusTaskMutation.mutateAsync(input);
		},
		[setFocusTaskMutation],
	);

	const setBlockBatchTasks = useCallback(
		async (input: SetBatchTasksInput) => {
			return setBatchTasksMutation.mutateAsync(input);
		},
		[setBatchTasksMutation],
	);

	const createContextTag = useCallback(
		async (label: string) => {
			return createTagMutation.mutateAsync({ label });
		},
		[createTagMutation],
	);

	const deleteContextTag = useCallback(
		async (tagId: number) => {
			await deleteTagMutation.mutateAsync({ tagId });
		},
		[deleteTagMutation],
	);

	return {
		blocks: blocksQuery.data ?? [],
		isLoading: enabled && blocksQuery.isLoading,
		error,
		createBlock,
		updateBlock,
		deleteBlock,
		setBlockFocusTask,
		setBlockBatchTasks,
		contextTags: tagsQuery.data ?? [],
		createContextTag,
		deleteContextTag,
	};
}
