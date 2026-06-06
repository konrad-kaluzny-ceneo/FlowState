import { spawnSync } from "node:child_process";
import { finishCommand, finishSuccess } from "./lib/finish-hook.mjs";
import { logHookRun } from "./lib/log-run.mjs";
import {
	getProjectRoot,
	normalizePath,
	readHookInput,
} from "./lib/input.mjs";
import { isRiskFile } from "./lib/risk-areas.mjs";

const input = readHookInput();
const filePath = normalizePath(
	input.tool_input?.file_path ?? input.tool_input?.filePath ?? "",
);

if (!/\.(ts|tsx)$/i.test(filePath) || !isRiskFile(filePath)) {
	finishSuccess();
}

const projectRoot = getProjectRoot(input);
logHookRun("related-tests-claude", { filePath, projectRoot }, input);

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

finishCommand(result);
