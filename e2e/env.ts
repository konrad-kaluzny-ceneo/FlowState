/** Shared E2E env helpers — single source for playwright.config.ts and global-setup.ts */

export const AUTH_POOL_SIZE = 4;

export function getE2ePort(): string {
	return process.env.E2E_PORT ?? "3001";
}

export function getE2eBaseUrl(): string {
	return `http://localhost:${getE2ePort()}`;
}

/** GitHub Actions or local `E2E_PRODUCTION_SERVER=1` → `next start` (not `next dev`). */
export function isProductionE2eServer(): boolean {
	return (
		process.env.E2E_PRODUCTION_SERVER === "1" || !!process.env.GITHUB_ACTIONS
	);
}

/** Reuse manual dev server locally; never on GitHub Actions. */
export function shouldReuseExistingServer(): boolean {
	return process.env.E2E_REUSE_SERVER === "1" && !process.env.GITHUB_ACTIONS;
}

export function getE2eWorkerCount(): number {
	if (!process.env.E2E_WORKERS) {
		return AUTH_POOL_SIZE;
	}
	const parsed = Number.parseInt(process.env.E2E_WORKERS, 10);
	if (!Number.isFinite(parsed) || parsed < 1) {
		return AUTH_POOL_SIZE;
	}
	return Math.min(parsed, AUTH_POOL_SIZE);
}

export function getE2eStartupTimeoutMs(): number {
	return isProductionE2eServer() ? 300_000 : 120_000;
}
