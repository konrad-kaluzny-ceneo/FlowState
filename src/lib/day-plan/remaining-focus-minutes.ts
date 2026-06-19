export function remainingFocusMinutes(
	focusBudgetMinutes: number,
	usedFocusMinutes: number,
): number {
	return Math.max(0, focusBudgetMinutes - usedFocusMinutes);
}
