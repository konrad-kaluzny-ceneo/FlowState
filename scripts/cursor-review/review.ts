import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { Agent, CursorAgentError, type SDKMessage } from "@cursor/sdk";
import { buildReviewPrompt } from "./build-prompt.js";
import {
	changeIdFromBranch,
	GitScopeError,
	getCurrentBranch,
	resolveRepoUrl,
} from "./git-scope.js";

const { values } = parseArgs({
	options: {
		base: { type: "string", default: "main" },
		"change-id": { type: "string" },
		cloud: { type: "boolean", default: false },
		ref: { type: "string" },
		output: { type: "string" },
		resume: { type: "string" },
		help: { type: "boolean", default: false },
	},
});

if (values.help) {
	console.log(`FlowState Cursor SDK code review

Usage:
  pnpm review [--base main] [--change-id <id>] [--output reports/review.md]
  pnpm review:cloud [--ref <branch>] [--change-id <id>] [--output reports/review.md]

Options:
  --base <branch>     Compare against this branch (default: main)
  --change-id <id>    Load context/changes/<id>/plan.md for plan-drift review
  --cloud             Run on Cursor cloud VM (requires repo access for API key)
  --ref <branch>      Cloud starting ref (default: current branch)
  --output <path>     Save review markdown to file (reports/ is gitignored)
  --resume <agentId>  Continue a previous agent conversation
  --help              Show this help

Requires CURSOR_API_KEY in the environment (see scripts/cursor-review/README.md).
`);
	process.exit(0);
}

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
									{
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
								sandboxOptions: { enabled: true },
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
			const header = `<!-- cursor-review agent=${agent.agentId} run=${result.id} -->\n\n`;
			writeFileSync(outputPath, header + reviewText, "utf8");
			console.error(`\nSaved review to ${outputPath}`);
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
		console.error(
			`Startup failed: ${err.message} (retryable=${err.isRetryable})`,
		);
		process.exit(1);
	}
	throw err;
}
