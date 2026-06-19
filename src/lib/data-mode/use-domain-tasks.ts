"use client";

import { useSyncExternalStore } from "react";

import type { DomainTask } from "~/lib/data-mode/types";
import {
	getGuestDayCompletionsStorageKey,
	getGuestDoneForTodayTaskIds,
	subscribeGuestDayCompletions,
} from "~/lib/guest/day-completions";
import { GUEST_STORAGE_KEY } from "~/lib/guest/schema";
import { loadSnapshot, subscribeGuestStore } from "~/lib/guest/store";

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
