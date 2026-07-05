"use client";

import type { EnergyLevel } from "@prisma/generated";
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

	const setEnergyMutation = api.dayPlan.setEnergy.useMutation({
		onMutate: async ({ energy }) => {
			await utils.dayPlan.getOrCreate.cancel({ localDateKey });
			const previous = utils.dayPlan.getOrCreate.getData({ localDateKey });
			utils.dayPlan.getOrCreate.setData({ localDateKey }, (current) =>
				current == null ? current : { ...current, energyLevel: energy },
			);
			return { previous };
		},
		onError: (_error, _input, context) => {
			if (context?.previous !== undefined) {
				utils.dayPlan.getOrCreate.setData({ localDateKey }, context.previous);
			}
		},
		onSettled: () => {
			void utils.dayPlan.getOrCreate.invalidate({ localDateKey });
		},
	});

	const setEnergy = useCallback(
		async (energy: EnergyLevel) => {
			await setEnergyMutation.mutateAsync({ localDateKey, energy });
		},
		[localDateKey, setEnergyMutation],
	);

	return {
		localDateKey,
		budgetMinutes: query.data?.focusBudgetMinutes ?? null,
		remainingMinutes: query.data?.remainingFocusMinutes ?? null,
		usedMinutes: query.data?.usedFocusMinutes ?? 0,
		hasBudget: query.data?.focusBudgetMinutes != null,
		energy: query.data?.energyLevel ?? null,
		isLoading: enabled && query.isLoading,
		isSettingBudget: setBudgetMutation.isPending,
		isSettingEnergy: setEnergyMutation.isPending,
		setBudget,
		setEnergy,
	};
}
