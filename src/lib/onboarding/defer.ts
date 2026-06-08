import { hasGuestData } from "~/lib/guest/store";

/**
 * Returns whether first-run overlay should be deferred for higher-priority UI.
 * S-14 will extend this for merge-success modal visibility.
 */
export function shouldDeferFirstRun(): boolean {
	if (typeof window === "undefined") {
		return false;
	}

	// Guest merge/import in flight — first-run must not compete with cycle resume (S-08 / S-14).
	return hasGuestData();
}
