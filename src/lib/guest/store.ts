import {
	createEmptyGuestSnapshot,
	GUEST_STORAGE_KEY,
	type GuestSnapshotV1,
	parseGuestSnapshot,
	serializeGuestSnapshot,
} from "~/lib/guest/schema";

const listeners = new Set<() => void>();

function notifyListeners() {
	for (const listener of listeners) {
		listener();
	}
}

export function subscribeGuestStore(onStoreChange: () => void): () => void {
	listeners.add(onStoreChange);
	return () => {
		listeners.delete(onStoreChange);
	};
}

export function loadSnapshot(): GuestSnapshotV1 {
	if (typeof window === "undefined") {
		return createEmptyGuestSnapshot();
	}

	try {
		return parseGuestSnapshot(localStorage.getItem(GUEST_STORAGE_KEY));
	} catch {
		return createEmptyGuestSnapshot();
	}
}

export function saveSnapshot(snapshot: GuestSnapshotV1): string | null {
	if (typeof window === "undefined") {
		return null;
	}

	try {
		localStorage.setItem(GUEST_STORAGE_KEY, serializeGuestSnapshot(snapshot));
		notifyListeners();
		return null;
	} catch {
		return "Could not save your work locally. Check browser storage settings and try again.";
	}
}

export function clearGuestSnapshot(): void {
	if (typeof window === "undefined") {
		return;
	}

	try {
		localStorage.removeItem(GUEST_STORAGE_KEY);
		notifyListeners();
	} catch {
		// ignore
	}
}

export function hasGuestData(): boolean {
	const snapshot = loadSnapshot();
	return (
		snapshot.tasks.length > 0 ||
		snapshot.sessions.length > 0 ||
		snapshot.cycles.length > 0
	);
}

export function mutateSnapshot(
	mutator: (snapshot: GuestSnapshotV1) => GuestSnapshotV1,
): { snapshot: GuestSnapshotV1; error: string | null } {
	const current = loadSnapshot();
	const next = mutator(structuredClone(current));
	const error = saveSnapshot(next);
	return { snapshot: next, error };
}
