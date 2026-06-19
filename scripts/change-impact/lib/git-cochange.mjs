import { spawnSync } from "node:child_process";

/** Normalize repo-relative paths to forward slashes without leading `./`. */
export function normalizeRepoPath(filePath) {
	if (!filePath || typeof filePath !== "string") return "";
	const trimmed = filePath.trim().replace(/\\/g, "/");
	return trimmed.replace(/^\.\//, "");
}

/**
 * Aggregate co-change counts from commit file lists.
 * Exported for unit tests — no git subprocess.
 */
export function aggregateCommits(commits, targetPath) {
	const normalizedTarget = normalizeRepoPath(targetPath);
	const counts = new Map();

	for (const files of commits) {
		const normalizedFiles = files
			.map(normalizeRepoPath)
			.filter((file) => file.length > 0);

		if (!normalizedFiles.includes(normalizedTarget)) {
			continue;
		}

		for (const file of normalizedFiles) {
			if (file === normalizedTarget) continue;
			counts.set(file, (counts.get(file) ?? 0) + 1);
		}
	}

	return [...counts.entries()]
		.map(([path, count]) => ({ path, count }))
		.sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
}

function filterDisplayRows(rows, { strict = false } = {}) {
	if (strict) {
		return rows.filter(
			(row) =>
				row.path.startsWith("src/") ||
				row.path.startsWith("e2e/") ||
				row.path.startsWith("context/"),
		);
	}

	return rows.filter(
		(row) => row.path.startsWith("src/") || row.path.startsWith("e2e/"),
	);
}

export function runGit(args, root) {
	const result = spawnSync("git", args, {
		cwd: root,
		encoding: "utf8",
		shell: false,
	});

	if (result.error) {
		throw result.error;
	}

	if (result.status !== 0) {
		const message = (result.stderr || result.stdout || "").trim();
		const error = new Error(message || `git ${args.join(" ")} failed`);
		error.exitCode = result.status ?? 2;
		throw error;
	}

	return result.stdout ?? "";
}

function parseCommitHashes(stdout) {
	return stdout
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
}

function parseNameOnlyShow(stdout) {
	return stdout
		.split(/\r?\n/)
		.map(normalizeRepoPath)
		.filter((line) => line.length > 0);
}

/**
 * Collect co-changed paths for a target file since an ISO date.
 */
export async function collectCoChanges({
	root,
	targetPath,
	sinceIsoDate,
	strict = false,
	top = 8,
}) {
	const normalizedTarget = normalizeRepoPath(targetPath);
	const commitHashes = parseCommitHashes(
		runGit(
			[
				"log",
				`--since=${sinceIsoDate}`,
				"--format=%H",
				"--no-merges",
				"--",
				normalizedTarget,
			],
			root,
		),
	);

	const commits = commitHashes.map((sha) =>
		parseNameOnlyShow(
			runGit(["show", "--name-only", "--format=", "--no-renames", sha], root),
		),
	);

	const aggregated = aggregateCommits(commits, normalizedTarget);
	const filtered = filterDisplayRows(aggregated, { strict });
	return filtered.slice(0, top);
}
