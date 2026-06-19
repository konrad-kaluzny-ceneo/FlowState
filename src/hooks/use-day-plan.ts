"use client";

import { useCallback } from "react";

import { useDataMode } from "~/lib/data-mode/data-mode-context";
import { formatLocalDateKey } from "~/lib/time/local-date-key";
import { api } from "~/trpc/react";

export function useDayPlan() {
	const mode = useDataMode();
	const localDateKey = formatLocalDateKey();
	const enabled = mode === "authenticated";
	const utils = api.useUtils();

	const query = api.dayPlan.getOrCreate.useQuery({ localDateKey }, { enabled });

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
