/**
 * Build stdout report for the change-impact digest.
 */

const MAX_DEFAULT_LINES = 40;

function e2eLabel(path, strict) {
	if (!path.startsWith("e2e/")) return "";
	return strict ? " (co-change — not in depcruise graph)" : "";
}

/**
 * @param {{
 *   targetPath: string,
 *   since: string,
 *   rows: { path: string, count: number }[],
 *   testCommands: string[],
 *   fanOutCount?: number | null,
 *   fanOutLabel?: string,
 *   strict: boolean,
 * }} input
 */
export function formatReport({
	targetPath,
	since,
	rows,
	testCommands,
	fanOutCount = null,
	fanOutLabel = "",
	strict,
}) {
	const lines = [
		"Timer change-impact digest",
		`Target: ${targetPath}`,
		`Since: ${since}`,
		"",
		"Co-changed paths (count):",
	];

	if (rows.length === 0) {
		lines.push("  (none in src/, e2e/, or context/)");
	} else {
		for (const row of rows) {
			const suffix = e2eLabel(row.path, strict);
			lines.push(
				`  ${row.count.toString().padStart(3)}  ${row.path}${suffix}`,
			);
		}
	}

	lines.push("");
	lines.push("Suggested test commands:");
	for (const command of testCommands) {
		lines.push(`  ${command}`);
	}

	if (strict) {
		lines.push("");
		lines.push(
			"Note: e2e/ rows are git co-change only — not in depcruise graph.",
		);
	}

	if (fanOutCount !== null && fanOutLabel) {
		lines.push("");
		lines.push(fanOutLabel);
	}

	lines.push("");
	lines.push("Advisory only — see context/map/repo-map.md");

	if (strict && lines.length > MAX_DEFAULT_LINES) {
		lines.push(
			"Expanded (--strict) — see context/map/repo-map.md for full blast radius",
		);
	}

	return lines.join("\n");
}

export function countReportLines(report) {
	return report.split("\n").length;
}
