import { spawnSync } from "node:child_process";
import { finishFailure, finishSuccess } from "./lib/finish-hook.mjs";
import { logHookRun } from "./lib/log-run.mjs";
import {
	getProjectRoot,
	parseFilePaths,
	readHookInput,
	shouldLintFile,
	shouldRunForInput,
} from "./lib/input.mjs";

const input = readHookInput();
if (!shouldRunForInput(input)) {
	finishSuccess();
}

const projectRoot = getProjectRoot(input);
const paths = parseFilePaths(input).filter((filePath) =>
	shouldLintFile(filePath, projectRoot),
);

logHookRun("lint", { paths, projectRoot }, input);

if (paths.length === 0) {
	finishSuccess();
}

for (const filePath of paths) {
	const result = spawnSync(
		"pnpm",
		["exec", "biome", "check", "--write", filePath],
		{ encoding: "utf8", shell: true, cwd: projectRoot },
	);
	if (result.status !== 0) {
		finishFailure(result);
	}
}

finishSuccess();
