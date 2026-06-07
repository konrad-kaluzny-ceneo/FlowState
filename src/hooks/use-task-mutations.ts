"use client";

import { TRPCClientError } from "@trpc/client";
import { useCallback, useState } from "react";

import {
	useDataMode,
	useRepositories,
} from "~/lib/data-mode/data-mode-context";
import type { DomainTaskId } from "~/lib/data-mode/types";
import { api, type RouterInputs, type RouterOutputs } from "~/trpc/react";

export type TaskListData = RouterOutputs["task"]["list"];

type CreateTaskInput = RouterInputs["task"]["create"];
type UpdateTaskInput = RouterInputs["task"]["update"];
type DeleteTaskInput = RouterInputs["task"]["delete"];

type UpdateTaskArgs = Omit<UpdateTaskInput, "id"> & { id: DomainTaskId };
type DeleteTaskArgs = { id: DomainTaskId };

type TaskListItem = TaskListData[number];

type MutationContext = {
	previousTasks: TaskListData | undefined;
	tempId?: number;
};

function formatTaskMutationError(err: unknown): string {
	if (err instanceof TRPCClientError && err.shape?.code === "NOT_FOUND") {
		return "Task not found";
	}
	return "Something went wrong. Please try again.";
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
	return {
		id: tempId,
		title: input.title,
		userId,
		status: "active",
		workType: input.workType ?? "OPERATIONAL",
		weight: input.weight ?? 2,
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

export function useTaskMutations() {
	const mode = useDataMode();
	const { tasks: taskRepo } = useRepositories();
	const utils = api.useUtils();
	const [error, setError] = useState<string | null>(null);

	const clearError = useCallback(() => {
		setError(null);
	}, []);

	const handleSettled = useCallback(() => {
		void utils.task.list.invalidate();
	}, [utils]);

	const handleError = useCallback(
		(err: unknown, _input: unknown, context: MutationContext | undefined) => {
			if (context?.previousTasks !== undefined) {
				utils.task.list.setData(undefined, () => context.previousTasks);
			}
			setError(formatTaskMutationError(err));
		},
		[utils],
	);

	const createMutation = api.task.create.useMutation({
		onMutate: async (input) => {
			await utils.task.list.cancel();
			const previousTasks = utils.task.list.getData();
			const tempId = allocateTempTaskId();
			const optimisticRow = buildOptimisticCreateRow(
				input,
				tempId,
				previousTasks,
			);
			utils.task.list.setData(undefined, (old) =>
				appendTask(old, optimisticRow),
			);
			return { previousTasks, tempId };
		},
		onError: handleError,
		onSuccess: (serverTask, _input, context: MutationContext | undefined) => {
			const tempId = context?.tempId;
			if (tempId != null) {
				utils.task.list.setData(undefined, (old) =>
					replaceTempTask(old, tempId, serverTask),
				);
			}
		},
		onSettled: handleSettled,
	});

	const updateMutation = api.task.update.useMutation({
		onMutate: async (input) => {
			await utils.task.list.cancel();
			const previousTasks = utils.task.list.getData();
			const { id, ...fields } = input;
			utils.task.list.setData(undefined, (old) => patchTask(old, id, fields));
			return { previousTasks };
		},
		onError: handleError,
		onSettled: handleSettled,
	});

	const deleteMutation = api.task.delete.useMutation({
		onMutate: async (input) => {
			await utils.task.list.cancel();
			const previousTasks = utils.task.list.getData();
			utils.task.list.setData(undefined, (old) => removeTask(old, input.id));
			return { previousTasks };
		},
		onError: handleError,
		onSettled: handleSettled,
	});

	const isMutating =
		createMutation.isPending ||
		updateMutation.isPending ||
		deleteMutation.isPending;

	const createTask = useCallback(
		async (input: CreateTaskInput) => {
			clearError();
			if (mode === "guest") {
				return taskRepo.create({
					...input,
					weight: input.weight as 1 | 2 | 3 | undefined,
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
					...input,
					weight: input.weight as 1 | 2 | 3 | undefined,
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

	return {
		createTask,
		updateTask,
		deleteTask,
		isMutating,
		isCreating: createMutation.isPending,
		error,
		clearError,
	};
}
