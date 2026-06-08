/**
 * Coordinates tRPC traffic so preference.get/set never runs concurrently with
 * suggestion.next — both share httpBatchStreamLink and can stall each other on CI.
 */

let suggestionFetchCount = 0;
const idleWaiters: Array<() => void> = [];
const inFlightListeners = new Set<(inFlight: boolean) => void>();

function notifyInFlightListeners() {
	const inFlight = suggestionFetchCount > 0;
	for (const listener of inFlightListeners) {
		listener(inFlight);
	}
}

function notifyIdleWaiters() {
	if (suggestionFetchCount !== 0) {
		return;
	}
	for (const resolve of idleWaiters.splice(0)) {
		resolve();
	}
}

/** Marks suggestion.next in flight until the returned disposer runs. */
export function beginSuggestionFetch(): () => void {
	suggestionFetchCount += 1;
	notifyInFlightListeners();
	let disposed = false;
	return () => {
		if (disposed) {
			return;
		}
		disposed = true;
		suggestionFetchCount = Math.max(0, suggestionFetchCount - 1);
		notifyInFlightListeners();
		notifyIdleWaiters();
	};
}

export function getSuggestionFetchInFlight(): boolean {
	return suggestionFetchCount > 0;
}

/** Resolves once no suggestion.next fetch is in flight. */
export function waitUntilSuggestionIdle(): Promise<void> {
	if (suggestionFetchCount === 0) {
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
	suggestionFetchCount = 0;
	idleWaiters.length = 0;
	notifyInFlightListeners();
}
