import { spawnSync } from "node:child_process";
import { finishCommand, finishSuccess } from "./lib/finish-hook.mjs";
import { logHookRun } from "./lib/log-run.mjs";
import {
	getProjectRoot,
	parseFilePaths,
	readHookInput,
	shouldRunForInput,
} from "./lib/input.mjs";

const TYPECHECK_EXTENSIONS = /\.(ts|tsx|js|jsx|mts|cts)$/i;

const input = readHookInput();
if (!shouldRunForInput(input)) {
	finishSuccess();
}

const projectRoot = getProjectRoot(input);
const paths = parseFilePaths(input);

logHookRun("typecheck", { paths, projectRoot }, input);

if (paths.length === 0 || !paths.some((p) => TYPECHECK_EXTENSIONS.test(p))) {
	finishSuccess();
}

const result = spawnSync("pnpm", ["typecheck"], {
	encoding: "utf8",
	shell: true,
	cwd: projectRoot,
});

finishCommand(result);
