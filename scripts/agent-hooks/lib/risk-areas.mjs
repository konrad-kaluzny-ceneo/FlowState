/** Risk dirs from context/foundation/test-plan.md §2. */
export const RISK_PATTERNS = [
	/(^|[\\/])src[\\/]hooks[\\/]/,
	/(^|[\\/])src[\\/]workers[\\/]/,
	/(^|[\\/])src[\\/]server[\\/]api[\\/]routers[\\/]/,
	/(^|[\\/])src[\\/]lib[\\/]repositories[\\/]/,
	/(^|[\\/])src[\\/]app[\\/]_components[\\/]/,
];

export function isRiskFile(filePath) {
	return RISK_PATTERNS.some((pattern) => pattern.test(filePath));
}
