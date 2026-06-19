// @ts-nocheck
/**
 * Map co-changed paths to suggested pnpm test commands for the timer hub.
 */

const HOOK_TEST = "pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx";
const DASHBOARD_TEST =
	"pnpm exec vitest run src/app/_components/pomodoro-dashboard.test.tsx";
const BELT_E2E = "set CI=true && pnpm test:e2e:belt";
const FALLBACK = "pnpm test";

function pathMatches(path, fragment) {
	return path.includes(fragment);
}

/**
 * @param {{ path: string, count: number }[]} coChangeRows
 * @param {string} targetPath
 * @returns {string[]}
 */
export function suggestTestCommands(coChangeRows, targetPath) {
	const commands = new Set();
	const normalizedTarget = targetPath.replace(/\\/g, "/");

	if (pathMatches(normalizedTarget, "use-pomodoro-cycle")) {
		commands.add(HOOK_TEST);
	}

	if (pathMatches(normalizedTarget, "pomodoro-dashboard")) {
		commands.add(DASHBOARD_TEST);
	}

	for (const row of coChangeRows) {
		if (row.path.startsWith("e2e/")) {
			commands.add(BELT_E2E);
		}
		if (pathMatches(row.path, "use-pomodoro-cycle.test")) {
			commands.add(HOOK_TEST);
		}
		if (pathMatches(row.path, "pomodoro-dashboard")) {
			commands.add(DASHBOARD_TEST);
		}
	}

	if (commands.size === 0) {
		commands.add(FALLBACK);
	}

	return [...commands].slice(0, 4);
}
