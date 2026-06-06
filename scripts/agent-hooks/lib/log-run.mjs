import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { getProjectRoot } from "./input.mjs";

export function logHookRun(hookName, details = {}, input) {
	try {
		const logPath = join(
			getProjectRoot(input ?? {}),
			"scripts/agent-hooks/run.log",
		);
		mkdirSync(dirname(logPath), { recursive: true });
		appendFileSync(
			logPath,
			`${new Date().toISOString()}\t${hookName}\t${JSON.stringify(details)}\n`,
		);
	} catch {
		// Logging must not break the hook.
	}
}
