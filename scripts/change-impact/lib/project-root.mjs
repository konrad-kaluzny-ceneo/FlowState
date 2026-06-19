import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

function normalizePath(value) {
	if (!value || typeof value !== "string") return "";
	const trimmed = value.trim();
	const driveMatch = trimmed.match(/^\/([a-zA-Z]):\//);
	if (driveMatch) {
		return `${driveMatch[1].toUpperCase()}:${trimmed.slice(3)}`;
	}
	return trimmed;
}

function isGitWorkTree(dir) {
	return existsSync(resolve(dir, ".git"));
}

/**
 * Resolve repository root by walking up from cwd for `.git`.
 * Falls back to agent-hook env vars when cwd is outside the work tree.
 */
export function resolveProjectRoot(cwd = process.cwd()) {
	let current = resolve(normalizePath(cwd));

	while (true) {
		if (isGitWorkTree(current)) {
			return current;
		}
		const parent = dirname(current);
		if (parent === current) {
			break;
		}
		current = parent;
	}

	for (const key of ["CURSOR_PROJECT_DIR", "CLAUDE_PROJECT_DIR"]) {
		const envRoot = normalizePath(process.env[key]);
		if (envRoot && isGitWorkTree(envRoot)) {
			return resolve(envRoot);
		}
	}

	throw new Error(
		"Not inside a git work tree — run from the FlowState repo root.",
	);
}
