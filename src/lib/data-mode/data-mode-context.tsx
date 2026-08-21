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
	createServerRecapRepository,
	createServerScheduleRepository,
	createServerSessionRepository,
	createServerTaskRepository,
} from "~/lib/repositories/server-repositories";
import { createTrpcRepositoryClient } from "~/lib/repositories/trpc-repository-client";
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

		const client = createTrpcRepositoryClient(utils);

		return {
			mode,
			tasks: createServerTaskRepository(client),
			cycles: createServerCycleRepository(client),
			sessions: createServerSessionRepository(client),
			recap: createServerRecapRepository(client),
			schedule: createServerScheduleRepository(client),
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
