"use client";

import { useCallback } from "react";

import { useDataMode } from "~/lib/data-mode/data-mode-context";
import type { RouterInputs } from "~/trpc/react";
import { api } from "~/trpc/react";

type CreateBlockInput = Omit<
	RouterInputs["dayPlan"]["createBlock"],
	"localDateKey"
>;
type UpdateBlockInput = RouterInputs["dayPlan"]["updateBlock"];
type SetFocusTaskInput = RouterInputs["dayPlan"]["setBlockFocusTask"];
type SetBatchTasksInput = RouterInputs["dayPlan"]["setBlockBatchTasks"];

/**
 * Auth-only day schedule. Pass `localDateKey` from `useDayPlan()` — do not
 * invent a second date key. Mutations are pessimistic in Phase 2 (invalidate
 * on success); Phase 3 adds optimistic create/move/resize/delete.
 */
export function useDaySchedule(localDateKey: string) {
	const mode = useDataMode();
	const enabled = mode === "authenticated";
	const utils = api.useUtils();

	const blocksQuery = api.dayPlan.listBlocks.useQuery(
		{ localDateKey },
		{ enabled },
	);
	const tagsQuery = api.dayPlan.listContextTags.useQuery(undefined, {
		enabled,
	});

	const createBlockMutation = api.dayPlan.createBlock.useMutation({
		onSuccess: () => {
			void utils.dayPlan.listBlocks.invalidate({ localDateKey });
		},
	});
	const updateBlockMutation = api.dayPlan.updateBlock.useMutation({
		onSuccess: () => {
			void utils.dayPlan.listBlocks.invalidate({ localDateKey });
		},
	});
	const deleteBlockMutation = api.dayPlan.deleteBlock.useMutation({
		onSuccess: () => {
			void utils.dayPlan.listBlocks.invalidate({ localDateKey });
		},
	});
	const setFocusTaskMutation = api.dayPlan.setBlockFocusTask.useMutation({
		onSuccess: () => {
			void utils.dayPlan.listBlocks.invalidate({ localDateKey });
		},
	});
	const setBatchTasksMutation = api.dayPlan.setBlockBatchTasks.useMutation({
		onSuccess: () => {
			void utils.dayPlan.listBlocks.invalidate({ localDateKey });
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
			return createBlockMutation.mutateAsync({ ...input, localDateKey });
		},
		[createBlockMutation, localDateKey],
	);

	const updateBlock = useCallback(
		async (input: UpdateBlockInput) => {
			return updateBlockMutation.mutateAsync(input);
		},
		[updateBlockMutation],
	);

	const deleteBlock = useCallback(
		async (blockId: number) => {
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
