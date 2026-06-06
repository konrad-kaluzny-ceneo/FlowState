import { finishCommand, finishSuccess } from "./lib/finish-hook.mjs";
import {
	getProjectRoot,
	isUnderProjectRoot,
	parseFilePaths,
	readHookInput,
	shouldRunForInput,
} from "./lib/input.mjs";
import { spawnPnpm } from "./lib/spawn-pnpm.mjs";

const TYPECHECK_EXTENSIONS = /\.(ts|tsx|js|jsx|mts|cts)$/i;

const input = readHookInput();
if (!shouldRunForInput(input)) {
	finishSuccess();
}

const projectRoot = getProjectRoot(input);
const paths = parseFilePaths(input);

if (
	paths.length === 0 ||
	!paths.some(
		(p) => TYPECHECK_EXTENSIONS.test(p) && isUnderProjectRoot(p, projectRoot),
	)
) {
	finishSuccess();
}

const result = spawnPnpm(["typecheck"], { cwd: projectRoot });

finishCommand(result);
