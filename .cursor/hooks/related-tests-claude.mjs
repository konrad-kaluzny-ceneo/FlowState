import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** Claude Code PostToolUse: stdin uses tool_input.file_path (snake_case). */
const RISK_PATTERNS = [
	/[\\/]src[\\/]hooks[\\/]/,
	/[\\/]src[\\/]workers[\\/]/,
	/[\\/]src[\\/]server[\\/]api[\\/]routers[\\/]/,
	/[\\/]src[\\/]lib[\\/]repositories[\\/]/,
	/[\\/]src[\\/]app[\\/]_components[\\/]/,
];

const input = JSON.parse(readFileSync(0, "utf8"));
const filePath = input.tool_input?.file_path ?? "";

if (!/\.(ts|tsx)$/i.test(filePath)) {
	process.exit(0);
}

if (!RISK_PATTERNS.some((pattern) => pattern.test(filePath))) {
	process.exit(0);
}

const cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const result = spawnSync(
	"pnpm",
	["exec", "vitest", "related", filePath, "--run"],
	{
		encoding: "utf8",
		shell: true,
		cwd,
		env: { ...process.env, AI_AGENT: "1" },
	},
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

process.exit(result.status === 0 ? 0 : 2);
