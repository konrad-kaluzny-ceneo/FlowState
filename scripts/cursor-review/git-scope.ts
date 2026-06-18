import { execSync } from "node:child_process";

function git(args: string, cwd: string): string {
	return execSync(`git ${args}`, { cwd, encoding: "utf8" }).trim();
}

export function resolveRepoUrl(cwd: string): string {
	const remote = git("remote get-url origin", cwd);
	if (remote.startsWith("git@")) {
		const match = /^git@([^:]+):(.+)\.git$/.exec(remote);
		if (match) {
			return `https://${match[1]}/${match[2]}`;
		}
	}
	return remote.replace(/\.git$/, "");
}

export function getMergeBase(base: string, cwd: string): string {
	return git(`merge-base HEAD ${base}`, cwd);
}

export function getChangedFiles(base: string, cwd: string): string[] {
	const mergeBase = getMergeBase(base, cwd);
	return git(`diff --name-only ${mergeBase}..HEAD`, cwd)
		.split("\n")
		.filter(Boolean);
}

export function getDiffStat(base: string, cwd: string): string {
	const mergeBase = getMergeBase(base, cwd);
	return git(`diff --stat ${mergeBase}..HEAD`, cwd);
}

export function getCurrentBranch(cwd: string): string {
	return git("rev-parse --abbrev-ref HEAD", cwd);
}
