"use client";

import { useCallback, useEffect, useState } from "react";

import { useRepositories } from "~/lib/data-mode/data-mode-context";
import type { DomainTask } from "~/lib/data-mode/types";
import { api } from "~/trpc/react";

export function useArchiveTasks(options?: { enabled?: boolean }): {
	tasks: DomainTask[];
	isLoading: boolean;
	refresh: () => Promise<void>;
} {
	const { mode, tasks: taskRepo, refreshKey } = useRepositories();
	const utils = api.useUtils();
	const enabled = options?.enabled !== false;

	const authQuery = api.task.archiveList.useQuery(undefined, {
		enabled: mode === "authenticated" && enabled,
	});

	const [guestTasks, setGuestTasks] = useState<DomainTask[]>([]);
	const [guestLoading, setGuestLoading] = useState(mode === "guest" && enabled);

	useEffect(() => {
		if (mode !== "guest" || !enabled) {
			return;
		}

		// Re-fetch when guest mutations bump refreshKey.
		void refreshKey;

		let cancelled = false;
		setGuestLoading(true);
		taskRepo
			.listArchived()
			.then((tasks) => {
				if (!cancelled) {
					setGuestTasks(tasks);
				}
			})
			.catch(() => {
				// Calm fallback: show an empty archive rather than a hard error.
				if (!cancelled) {
					setGuestTasks([]);
				}
			})
			.finally(() => {
				if (!cancelled) {
					setGuestLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [mode, taskRepo, refreshKey, enabled]);

	const refresh = useCallback(async () => {
		if (mode === "guest") {
			try {
				const tasks = await taskRepo.listArchived();
				setGuestTasks(tasks);
			} catch {
				// Preserve the currently shown list on a failed manual refresh.
			}
			return;
		}
		await utils.task.archiveList.invalidate();
	}, [mode, taskRepo, utils]);

	return {
		tasks: mode === "guest" ? guestTasks : (authQuery.data ?? []),
		isLoading: mode === "guest" ? guestLoading : authQuery.isLoading,
		refresh,
	};
}
