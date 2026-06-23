import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getChangedFiles, getCurrentBranch, getDiffStat } from "./git-scope.js";

function readOptional(path: string): string | undefined {
	if (!existsSync(path)) {
		return undefined;
	}
	return readFileSync(path, "utf8");
}

function buildPlanContext(changeId: string, cwd: string): string {
	const planPath = join(cwd, "context/changes", changeId, "plan.md");
	const changePath = join(cwd, "context/changes", changeId, "change.md");
	const plan = readOptional(planPath);
	const change = readOptional(changePath);
	if (!plan && !change) {
		return "";
	}

	let planContext = `\n## Change context (${changeId})\n`;
	if (change) {
		planContext += `\n### change.md\n${change}\n`;
	}
	if (plan) {
		planContext += `\n### plan.md\n${plan}\n`;
	}
	return planContext;
}

function buildPrMetadataBlock(
	prTitle?: string,
	prDescription?: string,
): string {
	if (!prTitle && !prDescription) {
		return "";
	}
	let block = "\n## Pull request context\n";
	if (prTitle) {
		block += `- Title: ${prTitle}\n`;
	}
	if (prDescription) {
		block += `- Description:\n${prDescription}\n`;
	}
	return block;
}

function buildDeliverableBlock(hasPlanContext: boolean): string {
	const c5Line = hasPlanContext
		? "- C5: Plan alignment — drift, missing items, scope creep\n"
		: "- C5: omit (no plan context for this review)\n";

	return `Write the review in the same language as recent commits (Polish or English). Use this structure:

1. **Summary** — 2–3 sentences
2. **Scores** — one line per criterion (\`C1: N/10 — brief rationale\`):
   - C1: Correctness — logic bugs, stale state, race conditions
   - C2: Security — authn/authz, XSS, injection, secrets, guest vs auth paths
   - C3: Reliability — error handling, session recovery, optimistic rollback
   - C4: Conventions — AGENTS.md, DESIGN.md, Biome, Prisma \`@@map\`, tRPC registration
${c5Line}   - C6: Tests — missing coverage on risky paths in the diff
3. **Findings** — bullet list with severity (\`critical\` / \`high\` / \`medium\` / \`low\`), **Location** as \`path:line\` or \`path:start-end\`, issue, suggested fix
4. **Strengths** — what was done well
5. **Follow-ups** — optional non-blocking suggestions`;
}

export function buildReviewPrompt(options: {
	base: string;
	changeId?: string;
	cwd: string;
	cloud?: boolean;
	startingRef?: string;
	prTitle?: string;
	prDescription?: string;
}): string {
	const hasPlanContext = Boolean(options.changeId);
	const planContext = options.changeId
		? buildPlanContext(options.changeId, options.cwd)
		: "";
	const prMetadata = buildPrMetadataBlock(
		options.prTitle,
		options.prDescription,
	);
	const deliverable = buildDeliverableBlock(hasPlanContext);

	if (options.cloud) {
		const branch = options.startingRef ?? "HEAD";
		return `Perform a read-only code review for the FlowState repository.

## Review mode (mandatory)

- Do NOT edit, create, or delete files.
- Do NOT run mutating shell commands (commit, install, migrate, format --write, etc.).
- You MAY read files, search the repo, and inspect \`git diff\` output.
- Read @AGENTS.md and @DESIGN.md before judging conventions.
- Delegate deep file analysis to the \`code-reviewer\` subagent when helpful.

## Scope

You are in a cloud VM checked out at branch/ref \`${branch}\`.
- Base branch: \`${options.base}\`
- Compute the review scope yourself (do not trust any precomputed file list):
  1. \`git fetch origin ${options.base}\`
  2. \`git diff $(git merge-base HEAD origin/${options.base})..HEAD\`
  3. List changed files and read the highest-risk ones.
${planContext}${prMetadata}
## Deliverable

${deliverable}`;
	}

	const files = getChangedFiles(options.base, options.cwd);
	const stat = getDiffStat(options.base, options.cwd);
	const branch = getCurrentBranch(options.cwd);

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
${planContext}${prMetadata}
## Deliverable

${deliverable}

Start by running \`git diff $(git merge-base HEAD ${options.base})..HEAD\` to inspect the full patch, then read the highest-risk changed files.`;
}
