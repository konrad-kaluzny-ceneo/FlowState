import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getChangedFiles, getCurrentBranch, getDiffStat } from "./git-scope.js";

function readOptional(path: string): string | undefined {
	if (!existsSync(path)) {
		return undefined;
	}
	return readFileSync(path, "utf8");
}

export function buildReviewPrompt(options: {
	base: string;
	changeId?: string;
	cwd: string;
}): string {
	const files = getChangedFiles(options.base, options.cwd);
	const stat = getDiffStat(options.base, options.cwd);
	const branch = getCurrentBranch(options.cwd);

	let planContext = "";
	if (options.changeId) {
		const planPath = join(
			options.cwd,
			"context/changes",
			options.changeId,
			"plan.md",
		);
		const changePath = join(
			options.cwd,
			"context/changes",
			options.changeId,
			"change.md",
		);
		const plan = readOptional(planPath);
		const change = readOptional(changePath);
		if (plan || change) {
			planContext = `\n## Change context (${options.changeId})\n`;
			if (change) {
				planContext += `\n### change.md\n${change}\n`;
			}
			if (plan) {
				planContext += `\n### plan.md\n${plan}\n`;
			}
		}
	}

	const fileList =
		files.length > 0
			? files.map((file) => `- ${file}`).join("\n")
			: "- (no diff vs base — review working tree context only)";

	return `Perform a read-only code review for the FlowState repository.

## Review mode (mandatory)

- Do NOT edit, create, or delete files.
- Do NOT run mutating shell commands (commit, install, migrate, format --write, etc.).
- You MAY read files, search the repo, and inspect \`git diff\` output.
- Read @AGENTS.md and @DESIGN.md before judging conventions.
- Delegate deep file analysis to the \`code-reviewer\` subagent when helpful.

## Scope

- Base branch: \`${options.base}\`
- Current branch: \`${branch}\`
- Changed files (${files.length}):
${fileList}

## Diff summary

\`\`\`
${stat || "(empty diff)"}
\`\`\`
${planContext}

## Deliverable

Write the review in the same language as recent commits (Polish or English). Use this structure:

1. **Summary** — 2–3 sentences
2. **Findings** — bullet list with severity (critical/high/medium/low), file path, issue, suggested fix
3. **Strengths** — what was done well
4. **Follow-ups** — optional non-blocking suggestions

Start by running \`git diff $(git merge-base HEAD ${options.base})..HEAD\` to inspect the full patch, then read the highest-risk changed files.`;
}
