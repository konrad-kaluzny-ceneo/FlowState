import { GUEST_STORAGE_KEY } from "~/lib/guest/schema";
import { hasGuestData, loadSnapshot } from "~/lib/guest/store";

export const GUEST_IMPORT_DONE_KEY = "flowstate:guest-import-done";
export const GUEST_IMPORT_ATTEMPTED_KEY = "flowstate:guest-import-attempted";

export function getGuestSnapshotStorageKey(): string | null {
	if (typeof window === "undefined") {
		return null;
	}

	return localStorage.getItem(GUEST_STORAGE_KEY);
}

export function shouldRunGuestImport(): boolean {
	if (!hasGuestData()) {
		return false;
	}

	const storageKey = getGuestSnapshotStorageKey();
	if (storageKey == null) {
		return false;
	}

	if (sessionStorage.getItem(GUEST_IMPORT_DONE_KEY) === storageKey) {
		return false;
	}

	if (sessionStorage.getItem(GUEST_IMPORT_ATTEMPTED_KEY) === storageKey) {
		return false;
	}

	return true;
}

export function markGuestImportAttempted(): void {
	const storageKey = getGuestSnapshotStorageKey();
	if (storageKey != null) {
		sessionStorage.setItem(GUEST_IMPORT_ATTEMPTED_KEY, storageKey);
	}
}

export function markGuestImportDone(): void {
	const storageKey = getGuestSnapshotStorageKey();
	if (storageKey != null) {
		sessionStorage.setItem(GUEST_IMPORT_DONE_KEY, storageKey);
		sessionStorage.removeItem(GUEST_IMPORT_ATTEMPTED_KEY);
	}
}

export function loadGuestSnapshotForImport() {
	return loadSnapshot();
}
