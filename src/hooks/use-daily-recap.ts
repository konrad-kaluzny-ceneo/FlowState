"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { useDataMode } from "~/lib/data-mode/data-mode-context";
import {
	getGuestDayCompletionsStorageKey,
	getGuestDoneForTodayTaskIds,
	subscribeGuestDayCompletions,
} from "~/lib/guest/day-completions";
import { buildGuestDailyRecap } from "~/lib/guest/recap";
import { GUEST_STORAGE_KEY } from "~/lib/guest/schema";
import { loadSnapshot, subscribeGuestStore } from "~/lib/guest/store";
import type { DailyRecap } from "~/lib/recap/types";
import { formatLocalDateKey } from "~/lib/time/local-date-key";
import { api } from "~/trpc/react";

const emptyGuestRecap: DailyRecap = {
	last24Hours: [],
	todayPlan: [],
	footprints: {},
};

let cachedGuestRecapKey: string | undefined;
let cachedGuestRecap: DailyRecap = emptyGuestRecap;

function getGuestRecapSnapshot(localDateKey: string): DailyRecap {
	if (typeof window === "undefined") {
		return emptyGuestRecap;
	}

	const storageValue = localStorage.getItem(GUEST_STORAGE_KEY);
	const dayCompletionsValue = localStorage.getItem(
		getGuestDayCompletionsStorageKey(),
	);
	const cacheKey = `${localDateKey}|${storageValue ?? ""}|${dayCompletionsValue ?? ""}`;
	if (cacheKey === cachedGuestRecapKey) {
		return cachedGuestRecap;
	}

	cachedGuestRecapKey = cacheKey;
	cachedGuestRecap = buildGuestDailyRecap(
		loadSnapshot(),
		localDateKey,
		getGuestDoneForTodayTaskIds(),
	);
	return cachedGuestRecap;
}

function getGuestRecapServerSnapshot(): DailyRecap {
	return emptyGuestRecap;
}

function subscribeGuestRecap(onStoreChange: () => void): () => void {
	const unsubscribeStore = subscribeGuestStore(onStoreChange);
	const unsubscribeDayCompletions = subscribeGuestDayCompletions(onStoreChange);
	return () => {
		unsubscribeStore();
		unsubscribeDayCompletions();
	};
}

export function useDailyRecap() {
	const mode = useDataMode();
	const [localDateKey, setLocalDateKey] = useState(() => formatLocalDateKey());
	const authEnabled = mode === "authenticated";
	const utils = api.useUtils();

	const authQuery = api.recap.getDaily.useQuery(
		{ localDateKey },
		{ enabled: authEnabled },
	);

	const guestRecap = useSyncExternalStore(
		subscribeGuestRecap,
		() => getGuestRecapSnapshot(localDateKey),
		getGuestRecapServerSnapshot,
	);

	useEffect(() => {
		const syncLocalDateKey = () => {
			const nextKey = formatLocalDateKey();
			setLocalDateKey((current) => {
				if (current === nextKey) {
					return current;
				}
				if (authEnabled) {
					void utils.recap.getDaily.invalidate({ localDateKey: nextKey });
					void utils.task.list.invalidate({ localDateKey: nextKey });
				}
				cachedGuestRecapKey = undefined;
				return nextKey;
			});
		};

		syncLocalDateKey();
		document.addEventListener("visibilitychange", syncLocalDateKey);
		return () => {
			document.removeEventListener("visibilitychange", syncLocalDateKey);
		};
	}, [authEnabled, utils]);

	return {
		localDateKey,
		recap: authEnabled ? (authQuery.data ?? emptyGuestRecap) : guestRecap,
		isLoading: authEnabled && authQuery.isLoading,
	};
}
