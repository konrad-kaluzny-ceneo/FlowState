"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";

import type { DataMode, Repositories } from "~/lib/data-mode/types";
import { createGuestRepositories } from "~/lib/repositories/guest-repositories";
import {
	createServerCycleRepository,
	createServerSessionRepository,
	createServerTaskRepository,
} from "~/lib/repositories/server-repositories";
import { api } from "~/trpc/react";

type DataModeContextValue = Repositories & {
	refreshKey: number;
	refreshGuest: () => void;
};

const DataModeContext = createContext<DataModeContextValue | null>(null);

export function DataModeProvider({
	mode,
	children,
}: {
	mode: DataMode;
	children: ReactNode;
}) {
	const utils = api.useUtils();
	const [refreshKey, setRefreshKey] = useState(0);
	const refreshGuest = useCallback(() => {
		setRefreshKey((key) => key + 1);
	}, []);
	const guestRepositories = useMemo(() => createGuestRepositories(), []);

	const value = useMemo<DataModeContextValue>(() => {
		if (mode === "guest") {
			return {
				mode,
				...guestRepositories,
				refreshKey,
				refreshGuest,
			};
		}

		const client = {
			task: {
				list: { fetch: () => utils.client.task.list.query() },
				create: {
					mutate: (
						input: Parameters<typeof utils.client.task.create.mutate>[0],
					) => utils.client.task.create.mutate(input),
				},
				update: {
					mutate: (
						input: Parameters<typeof utils.client.task.update.mutate>[0],
					) => utils.client.task.update.mutate(input),
				},
				delete: {
					mutate: (
						input: Parameters<typeof utils.client.task.delete.mutate>[0],
					) => utils.client.task.delete.mutate(input),
				},
				reorder: {
					mutate: (
						input: Parameters<typeof utils.client.task.reorder.mutate>[0],
					) => utils.client.task.reorder.mutate(input),
				},
				archiveList: { fetch: () => utils.client.task.archiveList.query() },
				restore: {
					mutate: (
						input: Parameters<typeof utils.client.task.restore.mutate>[0],
					) => utils.client.task.restore.mutate(input),
				},
				deleteArchived: {
					mutate: (
						input: Parameters<
							typeof utils.client.task.deleteArchived.mutate
						>[0],
					) => utils.client.task.deleteArchived.mutate(input),
				},
			},
			cycle: {
				getActive: { fetch: () => utils.client.cycle.getActive.query() },
				create: {
					mutate: (
						input: Parameters<typeof utils.client.cycle.create.mutate>[0],
					) => utils.client.cycle.create.mutate(input),
				},
				complete: {
					mutate: (
						input: Parameters<typeof utils.client.cycle.complete.mutate>[0],
					) => utils.client.cycle.complete.mutate(input),
				},
				interrupt: {
					mutate: (
						input: Parameters<typeof utils.client.cycle.interrupt.mutate>[0],
					) => utils.client.cycle.interrupt.mutate(input),
				},
				pause: {
					mutate: (
						input: Parameters<typeof utils.client.cycle.pause.mutate>[0],
					) => utils.client.cycle.pause.mutate(input),
				},
				resume: {
					mutate: (
						input: Parameters<typeof utils.client.cycle.resume.mutate>[0],
					) => utils.client.cycle.resume.mutate(input),
				},
			},
			session: {
				getOrCreateActive: {
					mutate: () => utils.client.session.getOrCreateActive.mutate(),
				},
				end: {
					mutate: (input?: {
						closureLine?: string | null;
						lastFocusedTaskId?: number;
					}) =>
						utils.client.session.end.mutate({
							closureLine: input?.closureLine ?? undefined,
							lastFocusedTaskId: input?.lastFocusedTaskId ?? undefined,
						}),
				},
			},
		};

		return {
			mode,
			tasks: createServerTaskRepository(client),
			cycles: createServerCycleRepository(client),
			sessions: createServerSessionRepository(client),
			refreshKey,
			refreshGuest,
		};
	}, [mode, guestRepositories, refreshGuest, refreshKey, utils]);

	return (
		<DataModeContext.Provider value={value}>
			{children}
		</DataModeContext.Provider>
	);
}

export function useRepositories(): DataModeContextValue {
	const context = useContext(DataModeContext);
	if (context == null) {
		throw new Error("useRepositories must be used within DataModeProvider");
	}
	return context;
}

export function useDataMode(): DataMode {
	return useRepositories().mode;
}
