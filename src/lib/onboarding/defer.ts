/**
 * Returns whether first-run overlay should be deferred for higher-priority UI.
 * S-14 will return `true` while the merge-success modal is visible.
 */
export function shouldDeferFirstRun(): boolean {
	return false;
}
