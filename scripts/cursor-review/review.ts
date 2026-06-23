import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { Agent, CursorAgentError, type SDKMessage } from "@cursor/sdk";
import { config as loadEnv } from "dotenv";
import { buildReviewPrompt } from "./build-prompt.js";
import { REVIEW_COMMENT_MARKER } from "./constants.js";
import { evaluatePass } from "./evaluate-pass.js";
import {
	changeIdFromBranch,
	GitScopeError,
	getCurrentBranch,
	resolveRepoUrl,
} from "./git-scope.js";
import { parseScores } from "./parse-scores.js";

const { values } = parseArgs({
	options: {
		base: { type: "string", default: "main" },
		"change-id": { type: "string" },
		cloud: { type: "boolean", default: false },
		ref: { type: "string" },
		"pr-url": { type: "string" },
		"pr-title": { type: "string" },
		"pr-description": { type: "string" },
		output: { type: "string" },
		resume: { type: "string" },
		"no-sandbox": { type: "boolean", default: false },
		help: { type: "boolean", default: false },
	},
});

if (values.help) {
	console.log(`FlowState Cursor SDK code review

Usage:
  pnpm review [--base main] [--change-id <id>] [--output reports/review.md]
  pnpm review:cloud [--ref <sha-or-branch>] [--pr-url <url>] [--change-id <id>] [--output reports/review.md]

Options:
  --base <branch>           Compare against this branch (default: main)
  --change-id <id>          Load context/changes/<id>/plan.md for plan-drift review
  --cloud                   Run on Cursor cloud VM (requires repo access for API key)
  --ref <sha|branch>        Cloud starting ref — prefer commit SHA (default: current branch)
  --pr-url <url>            Attach cloud agent to an existing GitHub PR (CI use)
  --pr-title <text>         PR title for prompt context (CI use)
  --pr-description <text>   PR description for prompt context (truncated to 2000 chars)
  --output <path>           Save review markdown to file (reports/ is gitignored)
  --resume <agentId>        Continue a previous agent conversation
  --no-sandbox              Disable local SDK sandboxing (use in CI runners where
                            sandboxing is unsupported; review is read-only)
  --help                    Show this help

Requires CURSOR_API_KEY in the environment (see scripts/cursor-review/README.md).
`);
	process.exit(0);
}

loadEnv({ path: join(process.cwd(), ".env.local") });
loadEnv({ path: join(process.cwd(), ".env") });

const apiKey = process.env.CURSOR_API_KEY;
if (!apiKey?.trim()) {
	console.error(
		"Missing CURSOR_API_KEY. Create a key at https://cursor.com/dashboard/integrations",
	);
	process.exit(1);
}

const cwd = process.cwd();
const base = values.base ?? "main";
const useCloud = values.cloud ?? false;
const outputPath = values.output;
const resumeId = values.resume;
const prUrl = values["pr-url"];
const prTitle = values["pr-title"];
const rawPrDescription = values["pr-description"];
const prDescription = rawPrDescription?.slice(0, 2000);
const sandboxEnabled = !values["no-sandbox"];

let startingRef = values.ref;
if (!startingRef && !useCloud) {
	try {
		startingRef = getCurrentBranch(cwd);
	} catch (err) {
		if (err instanceof GitScopeError) {
			console.error(err.message);
			process.exit(1);
		}
		throw err;
	}
}

const changeId =
	values["change-id"] ??
	(startingRef ? changeIdFromBranch(startingRef) : undefined);

let prompt: string;
try {
	prompt = buildReviewPrompt({
		base,
		changeId,
		cwd,
		cloud: useCloud,
		startingRef,
		prTitle,
		prDescription,
	});
} catch (err) {
	if (err instanceof GitScopeError) {
		console.error(err.message);
		process.exit(1);
	}
	throw err;
}

function extractAssistantText(event: SDKMessage): string | undefined {
	if (event.type !== "assistant") {
		return undefined;
	}
	let text = "";
	for (const block of event.message.content) {
		if (block.type === "text") {
			text += block.text;
		}
	}
	return text || undefined;
}

function isCursorAuthFailure(err: CursorAgentError): boolean {
	const message = err.message.toLowerCase();
	return (
		!err.isRetryable &&
		(message.includes("api key") ||
			message.includes("unauthorized") ||
			message.includes("authentication") ||
			message.includes("forbidden") ||
			message.includes("401") ||
			message.includes("403"))
	);
}

function skipReviewForAuthFailure(reason: string): never {
	console.error(`Cursor review skipped: ${reason}`);
	console.error(
		"::notice title=Cursor code review skipped::Invalid or missing CURSOR_API_KEY — advisory review skipped (CI not blocked).",
	);
	process.exit(0);
}

try {
	const agent = resumeId
		? await Agent.resume(resumeId, { apiKey })
		: await Agent.create({
				apiKey,
				model: { id: "composer-2.5" },
				...(useCloud
					? {
							cloud: {
								repos: [
									prUrl
										? {
												url: resolveRepoUrl(cwd),
												prUrl,
											}
										: {
												url: resolveRepoUrl(cwd),
												startingRef: startingRef ?? "HEAD",
											},
								],
								skipReviewerRequest: true,
							},
						}
					: {
							local: {
								cwd,
								settingSources: ["project"],
								autoReview: true,
								sandboxOptions: { enabled: sandboxEnabled },
							},
						}),
			});

	try {
		const run = await agent.send(prompt);
		console.error(`agent=${agent.agentId} run=${run.id}`);

		let reviewText = "";
		for await (const event of run.stream()) {
			const chunk = extractAssistantText(event);
			if (chunk) {
				process.stdout.write(chunk);
				reviewText += chunk;
			}
		}

		const result = await run.wait();
		if (result.status === "error") {
			console.error(`\nRun failed: ${result.id}`);
			process.exit(2);
		}

		if (outputPath) {
			mkdirSync(dirname(outputPath), { recursive: true });
			const header = `${REVIEW_COMMENT_MARKER} agent=${agent.agentId} run=${result.id}\n\n`;
			writeFileSync(outputPath, header + reviewText, "utf8");
			console.error(`\nSaved review to ${outputPath}`);

			const { scores, criticalCount } = parseScores(reviewText);
			const evaluation = evaluatePass({
				scores,
				criticalCount,
				hasPlanContext: Boolean(changeId),
			});
			const jsonPath = /\.md$/i.test(outputPath)
				? outputPath.replace(/\.md$/i, ".json")
				: `${outputPath}.json`;
			writeFileSync(
				jsonPath,
				JSON.stringify(
					{
						version: 1,
						passed: evaluation.passed,
						scores,
						mean: evaluation.mean,
						failReasons: evaluation.failReasons,
						criticalCount,
						agentId: agent.agentId,
						runId: result.id,
					},
					null,
					2,
				),
				"utf8",
			);
			console.error(`Saved review sidecar to ${jsonPath}`);
		}

		if (useCloud) {
			console.error(
				`\nCloud agent dashboard: https://cursor.com/agents (filter Source → SDK)`,
			);
		}
	} finally {
		await agent[Symbol.asyncDispose]();
	}
} catch (err) {
	if (err instanceof CursorAgentError) {
		if (isCursorAuthFailure(err)) {
			skipReviewForAuthFailure(err.message);
		}
		console.error(
			`Startup failed: ${err.message} (retryable=${err.isRetryable})`,
		);
		process.exit(1);
	}
	throw err;
}
