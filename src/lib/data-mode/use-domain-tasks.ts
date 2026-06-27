"use client";

import { useMemo, useSyncExternalStore } from "react";

import type { DataMode, DomainTask } from "~/lib/data-mode/types";
import {
	getGuestDayCompletionsStorageKey,
	getGuestDoneForTodayTaskIds,
	subscribeGuestDayCompletions,
} from "~/lib/guest/day-completions";
import { GUEST_STORAGE_KEY } from "~/lib/guest/schema";
import { loadSnapshot, subscribeGuestStore } from "~/lib/guest/store";
import { api } from "~/trpc/react";

function mapSnapshotToTasks(): DomainTask[] {
	const doneTodayIds = getGuestDoneForTodayTaskIds();
	return [...loadSnapshot().tasks]
		.sort((a, b) => {
			if (a.sortOrder !== b.sortOrder) {
				return a.sortOrder - b.sortOrder;
			}
			return a.createdAt.getTime() - b.createdAt.getTime();
		})
		.map((task) => ({
			id: task.id,
			title: task.title,
			status: task.status,
			userId: "guest",
			createdAt: task.createdAt,
			updatedAt: task.updatedAt,
			workType: task.workType,
			weight: task.weight as 1 | 2 | 3,
			importance: task.importance,
			urgency: task.urgency,
			effortMinutes: task.effortMinutes,
			commitmentHorizon: task.commitmentHorizon,
			sortOrder: task.sortOrder,
			resumeNote: task.resumeNote ?? null,
			personaPresetId: task.personaPresetId ?? null,
			isDailyStanding: task.isDailyStanding ?? false,
			archivedAt: task.archivedAt ?? null,
			doneForToday: doneTodayIds.has(task.id),
		}));
}

let cachedStorageValue: string | null | undefined;
let cachedTasks: DomainTask[] = [];
const emptyGuestTasks: DomainTask[] = [];

function getGuestTasksSnapshot(): DomainTask[] {
	if (typeof window === "undefined") {
		return emptyGuestTasks;
	}

	const storageValue = localStorage.getItem(GUEST_STORAGE_KEY);
	const dayCompletionsValue = localStorage.getItem(
		getGuestDayCompletionsStorageKey(),
	);
	const cacheKey = `${storageValue ?? ""}|${dayCompletionsValue ?? ""}`;
	if (cacheKey === cachedStorageValue) {
		return cachedTasks;
	}

	cachedStorageValue = cacheKey;
	cachedTasks = mapSnapshotToTasks();
	return cachedTasks;
}

function getGuestTasksServerSnapshot(): DomainTask[] {
	return emptyGuestTasks;
}

function subscribeGuestTasks(onStoreChange: () => void): () => void {
	const unsubscribeStore = subscribeGuestStore(onStoreChange);
	const unsubscribeDayCompletions = subscribeGuestDayCompletions(onStoreChange);
	return () => {
		unsubscribeStore();
		unsubscribeDayCompletions();
	};
}

export function useGuestDomainTasks(): {
	tasks: DomainTask[];
	refresh: () => Promise<void>;
} {
	const tasks = useSyncExternalStore(
		subscribeGuestTasks,
		getGuestTasksSnapshot,
		getGuestTasksServerSnapshot,
	);

	return {
		tasks,
		refresh: async () => {},
	};
}

export function useAuthenticatedDomainTasks(options?: {
	localDateKey?: string;
	enabled?: boolean;
}): {
	tasks: DomainTask[];
	refresh: () => Promise<void>;
} {
	const [baseTasks] = api.task.list.useSuspenseQuery();
	const { data: tasksWithDayStatus = baseTasks } = api.task.list.useQuery(
		{ localDateKey: options?.localDateKey ?? "" },
		{
			enabled:
				options?.enabled === true &&
				options.localDateKey != null &&
				options.localDateKey.length > 0,
		},
	);
	const utils = api.useUtils();

	const tasks = useMemo(
		() =>
			(options?.enabled ? tasksWithDayStatus : baseTasks).map((task) => ({
				...task,
				weight: task.weight as 1 | 2 | 3,
				importance: task.importance as 1 | 2 | 3,
				urgency: task.urgency as 1 | 2 | 3,
			})),
		[baseTasks, options?.enabled, tasksWithDayStatus],
	);

	return {
		tasks,
		refresh: async () => {
			await Promise.all([
				utils.task.list.invalidate(),
				...(options?.localDateKey
					? [
							utils.task.list.invalidate({
								localDateKey: options.localDateKey,
							}),
						]
					: []),
			]);
		},
	};
}

export function useDomainTasks(
	mode: DataMode,
	options?: {
		localDateKey?: string;
		hasMounted?: boolean;
	},
): {
	tasks: DomainTask[];
	refresh: () => Promise<void>;
} {
	const guest = useGuestDomainTasks();
	const auth = useAuthenticatedDomainTasks({
		localDateKey: options?.localDateKey,
		enabled: options?.hasMounted === true,
	});

	return mode === "guest" ? guest : auth;
}
