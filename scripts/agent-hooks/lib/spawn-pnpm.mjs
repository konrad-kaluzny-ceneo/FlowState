import { spawnSync } from "node:child_process";

const PNPM = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

/** Run pnpm without a shell so file paths are passed as literal argv. */
export function spawnPnpm(args, options = {}) {
	return spawnSync(PNPM, args, {
		encoding: "utf8",
		shell: false,
		...options,
	});
}
