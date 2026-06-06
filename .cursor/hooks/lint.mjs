import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const filePath = input.file_path ?? "";

if (!/\.(ts|tsx|js|jsx|json|css|mdc|md)$/i.test(filePath)) {
	process.exit(0);
}

if (
	filePath.includes("node_modules") ||
	filePath.includes("generated") ||
	filePath.includes("reports/")
) {
	process.exit(0);
}

const cwd = process.env.CURSOR_PROJECT_DIR ?? process.cwd();
const result = spawnSync(
	"pnpm",
	["exec", "biome", "check", "--write", filePath],
	{ encoding: "utf8", shell: true, cwd },
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

process.exit(result.status === 0 ? 0 : 2);
