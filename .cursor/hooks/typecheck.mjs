import { spawnSync } from "node:child_process";

const cwd = process.env.CURSOR_PROJECT_DIR ?? process.cwd();
const result = spawnSync("pnpm", ["typecheck"], {
	encoding: "utf8",
	shell: true,
	cwd,
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

process.exit(result.status === 0 ? 0 : 2);
