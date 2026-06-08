/**
 * Coordinates tRPC traffic so preference.get/set never runs concurrently with
 * suggestion.next — both share httpBatchStreamLink and can stall each other on CI.
 */

let inFlightSuggestionFetches = 0;
const idleWaiters: Array<() => void> = [];
const inFlightListeners = new Set<(inFlight: boolean) => void>();

function notifyInFlightListeners() {
	const inFlight = inFlightSuggestionFetches > 0;
	for (const listener of inFlightListeners) {
		listener(inFlight);
	}
}

/** Marks suggestion.next in flight until the returned disposer runs. */
export function beginSuggestionFetch(): () => void {
	inFlightSuggestionFetches += 1;
	notifyInFlightListeners();
	return () => {
		inFlightSuggestionFetches = Math.max(0, inFlightSuggestionFetches - 1);
		notifyInFlightListeners();
		if (inFlightSuggestionFetches === 0) {
			for (const resolve of idleWaiters.splice(0)) {
				resolve();
			}
		}
	};
}

export function getSuggestionFetchInFlight(): boolean {
	return inFlightSuggestionFetches > 0;
}

export function waitUntilSuggestionIdle(): Promise<void> {
	if (inFlightSuggestionFetches === 0) {
		return Promise.resolve();
	}
	return new Promise((resolve) => {
		idleWaiters.push(resolve);
	});
}

export function subscribeSuggestionFetchInFlight(
	listener: (inFlight: boolean) => void,
): () => void {
	inFlightListeners.add(listener);
	return () => {
		inFlightListeners.delete(listener);
	};
}

/** @internal Test-only reset */
export function resetSuggestionFetchPriorityForTests(): void {
	inFlightSuggestionFetches = 0;
	idleWaiters.length = 0;
	notifyInFlightListeners();
}
