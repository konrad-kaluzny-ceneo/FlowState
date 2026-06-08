import { hasGuestData } from "~/lib/guest/store";

const listeners = new Set<() => void>();

let importInFlight = false;
let mergeSuccessVisible = false;

function notifyListeners() {
	for (const listener of listeners) {
		listener();
	}
}

export function setImportInFlight(inFlight: boolean): void {
	if (importInFlight === inFlight) {
		return;
	}

	importInFlight = inFlight;
	notifyListeners();
}

export function setMergeSuccessVisible(visible: boolean): void {
	if (mergeSuccessVisible === visible) {
		return;
	}

	mergeSuccessVisible = visible;
	notifyListeners();
}

export function subscribeDeferState(onStateChange: () => void): () => void {
	listeners.add(onStateChange);
	return () => {
		listeners.delete(onStateChange);
	};
}

/** Test-only reset — clears in-memory defer flags between cases. */
export function resetDeferStateForTests(): void {
	importInFlight = false;
	mergeSuccessVisible = false;
}

/**
 * Returns whether first-run overlay should be deferred for higher-priority UI.
 * Defers while guest data exists, import is in-flight, or merge-success is visible.
 */
export function shouldDeferFirstRun(): boolean {
	if (typeof window === "undefined") {
		return false;
	}

	return hasGuestData() || importInFlight || mergeSuccessVisible;
}
