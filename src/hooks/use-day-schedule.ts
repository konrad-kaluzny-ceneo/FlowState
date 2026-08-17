"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useDataMode } from "~/lib/data-mode/data-mode-context";
import type { DomainScheduleBlock } from "~/lib/schedule/types";
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

let nextTempBlockId = 0;

function allocateTempBlockId(): number {
	nextTempBlockId -= 1;
	return nextTempBlockId;
}

function isTempBlockId(id: number): boolean {
	return id < 0;
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

/**
 * Auth-only day schedule. Pass `localDateKey` from `useDayPlan()` — do not
 * invent a second date key. Create/move/resize/delete are optimistic (S-09);
 * attachment and context-tag mutators stay pessimistic until Phase 4.
 */
export function useDaySchedule(localDateKey: string) {
	const t = useTranslations("PlanDnia");
	const mode = useDataMode();
	const enabled = mode === "authenticated";
	const utils = api.useUtils();
	const [error, setError] = useState<string | null>(null);
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

	const settleList = useCallback(() => {
		void utils.dayPlan.listBlocks.invalidate(listInput);
	}, [listInput, utils]);

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
		},
		onSettled: settleList,
	});
	const updateBlockMutation = api.dayPlan.updateBlock.useMutation({
		onMutate: async (input) => {
			await utils.dayPlan.listBlocks.cancel(listInput);
			const previous = utils.dayPlan.listBlocks.getData(listInput);
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
				}),
			);
			return { previous } satisfies MutationContext;
		},
		onError: rollbackList,
		onSettled: settleList,
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
		onSettled: settleList,
	});
	const setFocusTaskMutation = api.dayPlan.setBlockFocusTask.useMutation({
		onSuccess: () => {
			void utils.dayPlan.listBlocks.invalidate(listInput);
		},
	});
	const setBatchTasksMutation = api.dayPlan.setBlockBatchTasks.useMutation({
		onSuccess: () => {
			void utils.dayPlan.listBlocks.invalidate(listInput);
		},
	});
	const createTagMutation = api.dayPlan.createContextTag.useMutation({
		onSuccess: () => {
			void utils.dayPlan.listContextTags.invalidate();
		},
	});
	const deleteTagMutation = api.dayPlan.deleteContextTag.useMutation({
		onSuccess: () => {
			void utils.dayPlan.listContextTags.invalidate();
		},
	});

	const createBlock = useCallback(
		async (input: CreateBlockInput) => {
			setError(null);
			return createBlockMutation.mutateAsync({ ...input, localDateKey });
		},
		[createBlockMutation, localDateKey],
	);

	const updateBlock = useCallback(
		async (input: UpdateBlockInput) => {
			setError(null);
			if (isTempBlockId(input.blockId)) {
				return;
			}
			return updateBlockMutation.mutateAsync(input);
		},
		[updateBlockMutation],
	);

	const deleteBlock = useCallback(
		async (blockId: number) => {
			setError(null);
			if (isTempBlockId(blockId)) {
				return;
			}
			await deleteBlockMutation.mutateAsync({ blockId });
		},
		[deleteBlockMutation],
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
