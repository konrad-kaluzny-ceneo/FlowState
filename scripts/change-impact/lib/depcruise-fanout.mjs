// @ts-nocheck

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const TIMEOUT_MS = 10_000;

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveDepcruiseCli(root) {
	const cliPath = resolve(
		root,
		"node_modules/dependency-cruiser/bin/dependency-cruise.mjs",
	);
	return existsSync(cliPath) ? cliPath : null;
}

function countDirectDependents(modules, targetPath) {
	const normalized = targetPath.replace(/\\/g, "/");
	const pattern = new RegExp(`${escapeRegExp(normalized)}$`);
	let count = 0;

	for (const moduleInfo of modules) {
		const dependencies = moduleInfo.dependencies ?? [];
		for (const dependency of dependencies) {
			const resolved =
				typeof dependency.resolved === "string"
					? dependency.resolved.replace(/\\/g, "/")
					: "";
			if (pattern.test(resolved)) {
				count += 1;
				break;
			}
		}
	}

	return count;
}

/**
 * Optional depcruise direct-dependent count for the target module.
 * Never throws — returns null fanOutCount on failure or timeout.
 */
export function getDepcruiseFanOut(root, targetPath) {
	const depcruiseCli = resolveDepcruiseCli(root);
	if (!depcruiseCli) {
		return { fanOutCount: null, label: "" };
	}

	const result = spawnSync(
		process.execPath,
		[depcruiseCli, "src", "--output-type", "json", "--output-to", "-"],
		{
			cwd: root,
			encoding: "utf8",
			shell: false,
			timeout: TIMEOUT_MS,
			maxBuffer: 50 * 1024 * 1024,
		},
	);

	if (result.error || result.status !== 0) {
		return { fanOutCount: null, label: "" };
	}

	try {
		const graph = JSON.parse(result.stdout);
		const modules = graph.modules ?? [];
		const normalizedTarget = targetPath.replace(/\\/g, "/");
		const fanOutCount = countDirectDependents(modules, normalizedTarget);
		return {
			fanOutCount,
			label: `Direct dependents (depcruise): ${fanOutCount} — see repo-map §4 for architect fan-out`,
		};
	} catch {
		return { fanOutCount: null, label: "" };
	}
}
