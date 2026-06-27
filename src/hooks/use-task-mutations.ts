"use client";

import { TRPCClientError } from "@trpc/client";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import {
	useDataMode,
	useRepositories,
} from "~/lib/data-mode/data-mode-context";
import type { DomainTaskId } from "~/lib/data-mode/types";
import { formatLocalDateKey } from "~/lib/time/local-date-key";
import { api, type RouterInputs, type RouterOutputs } from "~/trpc/react";

export type TaskListData = RouterOutputs["task"]["list"];

type CreateTaskInput = RouterInputs["task"]["create"];
type UpdateTaskInput = RouterInputs["task"]["update"];
type DeleteTaskInput = RouterInputs["task"]["delete"];

type UpdateTaskArgs = Omit<UpdateTaskInput, "id"> & { id: DomainTaskId };
type DeleteTaskArgs = { id: DomainTaskId };
type ReorderTasksArgs = { orderedIds: DomainTaskId[] };
type MarkDoneForTodayArgs = { id: DomainTaskId; localDateKey?: string };

type TaskListItem = TaskListData[number];

type MutationContext = {
	previousTasks: TaskListData | undefined;
	tempId?: number;
	localDateKey?: string;
};

function currentTaskListInput() {
	return { localDateKey: formatLocalDateKey() };
}

function formatTaskMutationError(
	err: unknown,
	t: (key: "notFound" | "generic") => string,
): string {
	if (err instanceof TRPCClientError && err.shape?.code === "NOT_FOUND") {
		return t("notFound");
	}
	return t("generic");
}

function isTempTaskId(id: number): boolean {
	return id < 0;
}

let nextTempTaskId = 0;

function allocateTempTaskId(): number {
	nextTempTaskId -= 1;
	return nextTempTaskId;
}

function buildOptimisticCreateRow(
	input: CreateTaskInput,
	tempId: number,
	existing: TaskListData | undefined,
): TaskListItem {
	const userId = existing?.[0]?.userId ?? "";
	const now = new Date();
	const maxSortOrder = (existing ?? [])
		.filter((task) => task.status === "active")
		.reduce((max, task) => Math.max(max, task.sortOrder), -1);
	const urgency = (input.urgency ?? input.weight ?? 2) as 1 | 2 | 3;
	return {
		id: tempId,
		title: input.title,
		userId,
		status: "active",
		workType: input.workType ?? "OPERATIONAL",
		weight: urgency,
		importance: (input.importance ?? 2) as 1 | 2 | 3,
		urgency,
		effortMinutes: input.effortMinutes ?? null,
		commitmentHorizon: input.commitmentHorizon ?? "WHEN_POSSIBLE",
		sortOrder: maxSortOrder + 1,
		resumeNote: input.resumeNote ?? null,
		personaPresetId: input.personaPresetId ?? null,
		isDailyStanding: input.isDailyStanding ?? false,
		doneForToday: false,
		archivedAt: null,
		createdAt: now,
		updatedAt: now,
	};
}

function appendTask(
	list: TaskListData | undefined,
	task: TaskListItem,
): TaskListData {
	return [...(list ?? []), task];
}

function patchTask(
	list: TaskListData | undefined,
	id: number,
	patch: Partial<TaskListItem>,
): TaskListData {
	return (list ?? []).map((task) =>
		task.id === id ? { ...task, ...patch } : task,
	);
}

function normalizeUpdatePatch(
	fields: Omit<UpdateTaskInput, "id">,
): Partial<TaskListItem> {
	const { weight, importance, urgency, ...rest } = fields;
	const patch: Partial<TaskListItem> = { ...rest };
	if (weight != null) {
		patch.weight = weight as TaskListItem["weight"];
	}
	if (importance != null) {
		patch.importance = importance as TaskListItem["importance"];
	}
	if (urgency != null) {
		patch.urgency = urgency as TaskListItem["urgency"];
	}
	return patch;
}

function removeTask(list: TaskListData | undefined, id: number): TaskListData {
	return (list ?? []).filter((task) => task.id !== id);
}

function replaceTempTask(
	list: TaskListData | undefined,
	tempId: number,
	serverTask: TaskListItem,
): TaskListData {
	return (list ?? []).map((task) => (task.id === tempId ? serverTask : task));
}

function reorderActiveTasks(
	list: TaskListData | undefined,
	orderedIds: number[],
): TaskListData {
	const tasks = list ?? [];
	const sortOrderById = new Map(orderedIds.map((id, index) => [id, index]));
	const updated = tasks.map((task) => {
		const newSortOrder = sortOrderById.get(Number(task.id));
		if (newSortOrder !== undefined) {
			return { ...task, sortOrder: newSortOrder };
		}
		return task;
	});

	return [...updated].sort((a, b) => {
		if (a.sortOrder !== b.sortOrder) {
			return a.sortOrder - b.sortOrder;
		}
		return a.createdAt.getTime() - b.createdAt.getTime();
	});
}

export function useTaskMutations() {
	const tErrors = useTranslations("Errors.task");
	const mode = useDataMode();
	const { tasks: taskRepo } = useRepositories();
	const utils = api.useUtils();
	const [error, setError] = useState<string | null>(null);

	const clearError = useCallback(() => {
		setError(null);
	}, []);

	const handleSettled = useCallback(
		(
			_data: unknown,
			_error: unknown,
			variables: unknown,
			context?: MutationContext,
		) => {
			const variableDateKey =
				variables != null &&
				typeof variables === "object" &&
				"localDateKey" in variables &&
				typeof variables.localDateKey === "string"
					? variables.localDateKey
					: undefined;
			const localDateKey =
				context?.localDateKey ??
				variableDateKey ??
				currentTaskListInput().localDateKey;
			void utils.task.list.invalidate(
				localDateKey ? { localDateKey } : undefined,
			);
			if (localDateKey) {
				void utils.recap.getDaily.invalidate({ localDateKey });
			}
		},
		[utils],
	);

	const handleError = useCallback(
		(err: unknown, _input: unknown, context: MutationContext | undefined) => {
			if (context) {
				const listInput = context.localDateKey
					? { localDateKey: context.localDateKey }
					: currentTaskListInput();
				utils.task.list.setData(listInput, () => context.previousTasks);
			}
			setError(formatTaskMutationError(err, tErrors));
		},
		[utils, tErrors],
	);

	const createMutation = api.task.create.useMutation({
		onMutate: async (input) => {
			const listInput = currentTaskListInput();
			await utils.task.list.cancel(listInput);
			const previousTasks = utils.task.list.getData(listInput);
			const tempId = allocateTempTaskId();
			const optimisticRow = buildOptimisticCreateRow(
				input,
				tempId,
				previousTasks,
			);
			utils.task.list.setData(listInput, (old) =>
				appendTask(old, optimisticRow),
			);
			return { previousTasks, tempId, localDateKey: listInput.localDateKey };
		},
		onError: handleError,
		onSuccess: (serverTask, _input, context: MutationContext | undefined) => {
			const tempId = context?.tempId;
			if (tempId != null) {
				const listInput = context?.localDateKey
					? { localDateKey: context.localDateKey }
					: currentTaskListInput();
				utils.task.list.setData(listInput, (old) =>
					replaceTempTask(old, tempId, {
						...serverTask,
						doneForToday: false,
					}),
				);
			}
		},
		onSettled: handleSettled,
	});

	const updateMutation = api.task.update.useMutation({
		onMutate: async (input) => {
			const listInput = currentTaskListInput();
			await utils.task.list.cancel(listInput);
			const previousTasks = utils.task.list.getData(listInput);
			const { id, ...fields } = input;
			utils.task.list.setData(listInput, (old) =>
				patchTask(old, id, normalizeUpdatePatch(fields)),
			);
			return { previousTasks, localDateKey: listInput.localDateKey };
		},
		onError: handleError,
		onSettled: handleSettled,
	});

	const deleteMutation = api.task.delete.useMutation({
		onMutate: async (input) => {
			const listInput = currentTaskListInput();
			await utils.task.list.cancel(listInput);
			const previousTasks = utils.task.list.getData(listInput);
			utils.task.list.setData(listInput, (old) => removeTask(old, input.id));
			return { previousTasks, localDateKey: listInput.localDateKey };
		},
		onError: handleError,
		onSettled: handleSettled,
	});

	const reorderMutation = api.task.reorder.useMutation({
		onMutate: async (input) => {
			const listInput = currentTaskListInput();
			await utils.task.list.cancel(listInput);
			const previousTasks = utils.task.list.getData(listInput);
			utils.task.list.setData(listInput, (old) =>
				reorderActiveTasks(old, input.orderedIds),
			);
			return { previousTasks, localDateKey: listInput.localDateKey };
		},
		onError: handleError,
		onSettled: handleSettled,
	});

	const markDoneForTodayMutation = api.task.markDoneForToday.useMutation({
		onMutate: async (input) => {
			const localDateKey = input.localDateKey;
			await utils.task.list.cancel({ localDateKey });
			const previousTasks = utils.task.list.getData({ localDateKey });
			utils.task.list.setData({ localDateKey }, (old) =>
				patchTask(old, input.taskId, { doneForToday: true }),
			);
			return { previousTasks, localDateKey };
		},
		onError: (err, _input, context) => {
			if (context?.localDateKey != null) {
				utils.task.list.setData(
					{ localDateKey: context.localDateKey },
					() => context.previousTasks,
				);
			}
			setError(formatTaskMutationError(err, tErrors));
		},
		onSettled: handleSettled,
	});

	const isMutating =
		createMutation.isPending ||
		updateMutation.isPending ||
		deleteMutation.isPending ||
		reorderMutation.isPending ||
		markDoneForTodayMutation.isPending;

	const createTask = useCallback(
		async (input: CreateTaskInput) => {
			clearError();
			if (mode === "guest") {
				return taskRepo.create({
					title: input.title,
					workType: input.workType,
					weight: input.weight as 1 | 2 | 3 | undefined,
					importance: input.importance as 1 | 2 | 3 | undefined,
					urgency: input.urgency as 1 | 2 | 3 | undefined,
					effortMinutes: input.effortMinutes,
					commitmentHorizon: input.commitmentHorizon,
					isDailyStanding: input.isDailyStanding,
				});
			}
			return createMutation.mutateAsync(input);
		},
		[mode, taskRepo, createMutation, clearError],
	);

	const updateTask = useCallback(
		async (input: UpdateTaskArgs) => {
			clearError();
			if (mode === "guest") {
				return taskRepo.update({
					id: input.id,
					title: input.title,
					status: input.status,
					workType: input.workType,
					weight: input.weight as 1 | 2 | 3 | undefined,
					importance: input.importance as 1 | 2 | 3 | undefined,
					urgency: input.urgency as 1 | 2 | 3 | undefined,
					effortMinutes: input.effortMinutes,
					commitmentHorizon: input.commitmentHorizon,
					resumeNote: input.resumeNote,
					isDailyStanding: input.isDailyStanding,
				});
			}
			if (typeof input.id !== "number" || isTempTaskId(input.id)) {
				return;
			}
			return updateMutation.mutateAsync(input as UpdateTaskInput);
		},
		[mode, taskRepo, updateMutation, clearError],
	);

	const deleteTask = useCallback(
		async (input: DeleteTaskArgs) => {
			clearError();
			if (mode === "guest") {
				return taskRepo.delete(input);
			}
			if (typeof input.id !== "number" || isTempTaskId(input.id)) {
				return;
			}
			return deleteMutation.mutateAsync(input as DeleteTaskInput);
		},
		[mode, taskRepo, deleteMutation, clearError],
	);

	const reorderTasks = useCallback(
		async (input: ReorderTasksArgs) => {
			clearError();
			if (mode === "guest") {
				return taskRepo.reorder({ orderedIds: input.orderedIds });
			}
			return reorderMutation.mutateAsync({
				orderedIds: input.orderedIds.filter(
					(id): id is number => typeof id === "number",
				),
			});
		},
		[mode, taskRepo, reorderMutation, clearError],
	);

	const markDoneForToday = useCallback(
		async (input: MarkDoneForTodayArgs) => {
			clearError();
			const localDateKey = input.localDateKey ?? formatLocalDateKey();
			if (mode === "guest") {
				return taskRepo.markDoneForToday({
					id: input.id,
					localDateKey,
				});
			}
			if (typeof input.id !== "number" || isTempTaskId(input.id)) {
				return;
			}
			return markDoneForTodayMutation.mutateAsync({
				taskId: input.id,
				localDateKey,
			});
		},
		[mode, taskRepo, markDoneForTodayMutation, clearError],
	);

	return {
		createTask,
		updateTask,
		deleteTask,
		reorderTasks,
		markDoneForToday,
		isMutating,
		isCreating: createMutation.isPending,
		error,
		clearError,
	};
}
