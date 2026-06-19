"use client";

import { useCallback, useEffect, useState } from "react";

import { useDataMode } from "~/lib/data-mode/data-mode-context";
import { formatLocalDateKey } from "~/lib/time/local-date-key";
import { api } from "~/trpc/react";

export function useDayPlan() {
	const mode = useDataMode();
	const [localDateKey, setLocalDateKey] = useState(() => formatLocalDateKey());
	const enabled = mode === "authenticated";
	const utils = api.useUtils();

	const query = api.dayPlan.getOrCreate.useQuery({ localDateKey }, { enabled });

	useEffect(() => {
		if (!enabled) {
			return;
		}

		const syncLocalDateKey = () => {
			const nextKey = formatLocalDateKey();
			setLocalDateKey((current) => {
				if (current === nextKey) {
					return current;
				}
				void utils.dayPlan.getOrCreate.invalidate({ localDateKey: nextKey });
				void utils.task.list.invalidate({ localDateKey: nextKey });
				return nextKey;
			});
		};

		syncLocalDateKey();
		document.addEventListener("visibilitychange", syncLocalDateKey);
		return () => {
			document.removeEventListener("visibilitychange", syncLocalDateKey);
		};
	}, [enabled, utils]);

	const setBudgetMutation = api.dayPlan.setBudget.useMutation({
		onSuccess: () => {
			void utils.dayPlan.getOrCreate.invalidate({ localDateKey });
		},
	});

	const setBudget = useCallback(
		async (focusBudgetMinutes: number) => {
			await setBudgetMutation.mutateAsync({
				localDateKey,
				focusBudgetMinutes,
			});
		},
		[localDateKey, setBudgetMutation],
	);

	return {
		localDateKey,
		budgetMinutes: query.data?.focusBudgetMinutes ?? null,
		remainingMinutes: query.data?.remainingFocusMinutes ?? null,
		usedMinutes: query.data?.usedFocusMinutes ?? 0,
		hasBudget: query.data?.focusBudgetMinutes != null,
		isLoading: enabled && query.isLoading,
		isSettingBudget: setBudgetMutation.isPending,
		setBudget,
	};
}
