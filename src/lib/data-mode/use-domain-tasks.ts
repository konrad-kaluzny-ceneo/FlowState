"use client";

import { useSyncExternalStore } from "react";

import type { DomainTask } from "~/lib/data-mode/types";
import { GUEST_STORAGE_KEY } from "~/lib/guest/schema";
import { loadSnapshot, subscribeGuestStore } from "~/lib/guest/store";

function mapSnapshotToTasks(): DomainTask[] {
	return loadSnapshot().tasks.map((task) => ({
		id: task.id,
		title: task.title,
		status: task.status,
		userId: "guest",
		createdAt: task.createdAt,
		updatedAt: task.updatedAt,
		workType: task.workType,
		weight: task.weight,
	}));
}

let cachedStorageValue: string | null | undefined;
let cachedTasks: DomainTask[] = [];

function getGuestTasksSnapshot(): DomainTask[] {
	if (typeof window === "undefined") {
		return [];
	}

	const storageValue = localStorage.getItem(GUEST_STORAGE_KEY);
	if (storageValue === cachedStorageValue) {
		return cachedTasks;
	}

	cachedStorageValue = storageValue;
	cachedTasks = mapSnapshotToTasks();
	return cachedTasks;
}

export function useGuestDomainTasks(): {
	tasks: DomainTask[];
	refresh: () => Promise<void>;
} {
	const tasks = useSyncExternalStore(
		subscribeGuestStore,
		getGuestTasksSnapshot,
		() => [],
	);

	return {
		tasks,
		refresh: async () => {},
	};
}
