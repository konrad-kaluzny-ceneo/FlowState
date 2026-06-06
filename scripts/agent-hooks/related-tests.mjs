import { spawnSync } from "node:child_process";
import { finishFailure, finishSuccess } from "./lib/finish-hook.mjs";
import { logHookRun } from "./lib/log-run.mjs";
import {
	getProjectRoot,
	isUnderProjectRoot,
	parseFilePaths,
	readHookInput,
	shouldRunForInput,
} from "./lib/input.mjs";
import { isRiskFile } from "./lib/risk-areas.mjs";

const input = readHookInput();
if (!shouldRunForInput(input)) {
	finishSuccess();
}

const projectRoot = getProjectRoot(input);
const paths = parseFilePaths(input).filter(
	(filePath) =>
		/\.(ts|tsx)$/i.test(filePath) &&
		isUnderProjectRoot(filePath, projectRoot) &&
		isRiskFile(filePath),
);

if (paths.length === 0) {
	finishSuccess();
}

logHookRun("related-tests", { paths, projectRoot }, input);

for (const filePath of paths) {
	const result = spawnSync(
		"pnpm",
		["exec", "vitest", "related", filePath, "--run"],
		{
			encoding: "utf8",
			shell: true,
			cwd: projectRoot,
			env: { ...process.env, AI_AGENT: "1" },
		},
	);
	if (result.status !== 0) {
		finishFailure(result);
	}
}

finishSuccess();
