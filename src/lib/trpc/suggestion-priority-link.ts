import type { TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";

import type { AppRouter } from "~/server/api/root";

import { waitUntilSuggestionIdle } from "./suggestion-priority";

/**
 * Delays preference.* tRPC ops until suggestion.next is idle so they never
 * share an httpBatchStreamLink batch (CI stalls when both are in-flight).
 */
export const suggestionPriorityLink: TRPCLink<AppRouter> = () => {
	return ({ op, next }) => {
		if (!op.path.startsWith("preference.")) {
			return next(op);
		}

		return observable((observer) => {
			let unsubscribe: (() => void) | undefined;
			let cancelled = false;

			void waitUntilSuggestionIdle().then(() => {
				if (cancelled) {
					return;
				}
				const subscription = next(op).subscribe(observer);
				unsubscribe = () => subscription.unsubscribe();
			});

			return () => {
				cancelled = true;
				unsubscribe?.();
			};
		});
	};
};
