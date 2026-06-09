"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";

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
	const guestRepositories = useMemo(() => createGuestRepositories(), []);

	const value = useMemo<DataModeContextValue>(() => {
		if (mode === "guest") {
			return {
				mode,
				...guestRepositories,
				refreshKey: 0,
				refreshGuest: () => {},
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
				rebindTask: {
					mutate: (
						input: Parameters<typeof utils.client.cycle.rebindTask.mutate>[0],
					) => utils.client.cycle.rebindTask.mutate(input),
				},
			},
			session: {
				getOrCreateActive: {
					mutate: () => utils.client.session.getOrCreateActive.mutate(),
				},
				end: {
					mutate: () => utils.client.session.end.mutate(),
				},
			},
		};

		return {
			mode,
			tasks: createServerTaskRepository(client),
			cycles: createServerCycleRepository(client),
			sessions: createServerSessionRepository(client),
			refreshKey: 0,
			refreshGuest: () => {},
		};
	}, [mode, guestRepositories, utils]);

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
