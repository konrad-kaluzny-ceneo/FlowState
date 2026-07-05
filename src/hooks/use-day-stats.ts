"use client";

import { useDataMode } from "~/lib/data-mode/data-mode-context";
import { formatLocalDateKey } from "~/lib/time/local-date-key";
import { api } from "~/trpc/react";

export function useDayStats() {
	const mode = useDataMode();
	const localDateKey = formatLocalDateKey();
	const isAuthenticated = mode === "authenticated";

	const query = api.recap.getDayStats.useQuery(
		{ localDateKey },
		{ enabled: isAuthenticated },
	);

	return {
		stats: isAuthenticated ? (query.data ?? null) : null,
		isLoading: isAuthenticated && query.isLoading,
		isGuest: !isAuthenticated,
	};
}
