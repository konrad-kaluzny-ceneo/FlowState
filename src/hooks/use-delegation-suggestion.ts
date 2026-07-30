"use client";

import { useCallback, useEffect, useState } from "react";

import { useDataMode } from "~/lib/data-mode/data-mode-context";
import { formatLocalDateKey } from "~/lib/time/local-date-key";
import { api, type RouterOutputs } from "~/trpc/react";

type DelegationCandidate = Extract<
	RouterOutputs["dayPlan"]["getDelegationSuggestion"],
	{ status: "ok" }
>["task"];

export function useDelegationSuggestion() {
	const mode = useDataMode();
	const [localDateKey, setLocalDateKey] = useState(() => formatLocalDateKey());
	const enabled = mode === "authenticated";
	const utils = api.useUtils();

	const query = api.dayPlan.getDelegationSuggestion.useQuery(
		{ localDateKey },
		{ enabled },
	);

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
				void utils.dayPlan.getDelegationSuggestion.invalidate({
					localDateKey: nextKey,
				});
				return nextKey;
			});
		};

		syncLocalDateKey();
		document.addEventListener("visibilitychange", syncLocalDateKey);
		return () => {
			document.removeEventListener("visibilitychange", syncLocalDateKey);
		};
	}, [enabled, utils]);

	const skipMutation = api.dayPlan.skipDelegationSuggestion.useMutation({
		onSuccess: () => {
			void utils.dayPlan.getDelegationSuggestion.invalidate({ localDateKey });
		},
	});

	const skip = useCallback(async () => {
		const data = query.data;
		if (data == null || data.status !== "ok") {
			return;
		}
		await skipMutation.mutateAsync({
			localDateKey,
			taskId: Number(data.task.id),
		});
	}, [localDateKey, query.data, skipMutation]);

	const status: "loading" | "ready" | "empty" =
		enabled && query.isLoading
			? "loading"
			: query.data?.status === "ok"
				? "ready"
				: "empty";

	const candidate: DelegationCandidate | null =
		query.data?.status === "ok" ? query.data.task : null;

	return {
		localDateKey,
		status,
		candidate,
		rationale: query.data?.status === "ok" ? query.data.rationale : null,
		skip,
		isSkipping: skipMutation.isPending,
	};
}
