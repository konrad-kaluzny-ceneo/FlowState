import { finishFailure, finishSuccess } from "./lib/finish-hook.mjs";
import {
	getProjectRoot,
	parseFilePaths,
	readHookInput,
	shouldLintFile,
	shouldRunForInput,
} from "./lib/input.mjs";
import { spawnPnpm } from "./lib/spawn-pnpm.mjs";

const input = readHookInput();
if (!shouldRunForInput(input)) {
	finishSuccess();
}

const projectRoot = getProjectRoot(input);
const paths = parseFilePaths(input).filter((filePath) =>
	shouldLintFile(filePath, projectRoot),
);

if (paths.length === 0) {
	finishSuccess();
}

for (const filePath of paths) {
	const result = spawnPnpm(["exec", "biome", "check", "--write", filePath], {
		cwd: projectRoot,
	});
	if (result.status !== 0) {
		finishFailure(result);
	}
}

finishSuccess();
