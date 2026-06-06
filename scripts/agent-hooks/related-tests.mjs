import { finishFailure, finishSuccess } from "./lib/finish-hook.mjs";
import {
	getProjectRoot,
	isUnderProjectRoot,
	parseFilePaths,
	readHookInput,
	shouldRunForInput,
} from "./lib/input.mjs";
import { isRiskFile } from "./lib/risk-areas.mjs";
import { spawnPnpm } from "./lib/spawn-pnpm.mjs";

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

for (const filePath of paths) {
	const result = spawnPnpm(["exec", "vitest", "related", filePath, "--run"], {
		cwd: projectRoot,
		env: { ...process.env, AI_AGENT: "1" },
	});
	if (result.status !== 0) {
		finishFailure(result);
	}
}

finishSuccess();
