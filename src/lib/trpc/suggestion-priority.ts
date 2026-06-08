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

function notifyIdleWaiters() {
	if (inFlightSuggestionFetches !== 0) {
		return;
	}
	for (const resolve of idleWaiters.splice(0)) {
		resolve();
	}
}

/** Marks suggestion.next in flight until the returned disposer runs. */
export function beginSuggestionFetch(): () => void {
	inFlightSuggestionFetches += 1;
	notifyInFlightListeners();
	let disposed = false;
	return () => {
		if (disposed) {
			return;
		}
		disposed = true;
		inFlightSuggestionFetches = Math.max(0, inFlightSuggestionFetches - 1);
		notifyInFlightListeners();
		notifyIdleWaiters();
	};
}

export function getSuggestionFetchInFlight(): boolean {
	return inFlightSuggestionFetches > 0;
}

function acquireIdleReservation(): () => void {
	inFlightSuggestionFetches += 1;
	notifyInFlightListeners();
	let released = false;
	return () => {
		if (released) {
			return;
		}
		released = true;
		inFlightSuggestionFetches = Math.max(0, inFlightSuggestionFetches - 1);
		notifyInFlightListeners();
		notifyIdleWaiters();
	};
}

/**
 * Waits for suggestion traffic to finish, then reserves the idle window until
 * the returned release runs so new suggestion fetches cannot interleave.
 */
export function waitUntilSuggestionIdle(): Promise<() => void> {
	if (inFlightSuggestionFetches === 0) {
		return Promise.resolve(acquireIdleReservation());
	}
	return new Promise((resolve) => {
		idleWaiters.push(() => {
			resolve(acquireIdleReservation());
		});
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
