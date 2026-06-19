#!/usr/bin/env node

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { getDepcruiseFanOut } from "./lib/depcruise-fanout.mjs";
import { formatReport } from "./lib/format-report.mjs";
import { collectCoChanges, normalizeRepoPath } from "./lib/git-cochange.mjs";
import { resolveProjectRoot } from "./lib/project-root.mjs";
import { suggestTestCommands } from "./lib/test-catalog.mjs";

const DEFAULT_PATH = "src/hooks/use-pomodoro-cycle.ts";
const DEFAULT_SINCE = "2026-04-01";

function printUsage() {
	console.log(`Usage: pnpm change-impact [--since YYYY-MM-DD] [--top N] [--strict] [--] [path]

Read-only maintainer CLI: ranked git co-changed paths and suggested test commands.

Options:
  --since   Start date for git log (default: ${DEFAULT_SINCE})
  --top     Max rows to print (default: 8, 15 with --strict)
  --strict  Include context/ rows, raise default top to 15, label e2e co-change rows
  --help    Show this help

Default path: ${DEFAULT_PATH}

v1 --strict: expanded table only — no staged-diff quiet mode (see AGENTS.md).`);
}

function parseArgs(argv) {
	const options = {
		since: DEFAULT_SINCE,
		top: 8,
		strict: false,
		path: DEFAULT_PATH,
		help: false,
		topExplicit: false,
	};

	const positional = [];

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === "--help" || arg === "-h") {
			options.help = true;
			continue;
		}
		if (arg === "--strict") {
			options.strict = true;
			continue;
		}
		if (arg === "--since") {
			const value = argv[i + 1];
			if (!value) {
				throw new Error("--since requires a YYYY-MM-DD value");
			}
			options.since = value;
			i += 1;
			continue;
		}
		if (arg === "--top") {
			const value = Number(argv[i + 1]);
			if (!Number.isFinite(value) || value <= 0) {
				throw new Error("--top requires a positive number");
			}
			options.top = value;
			options.topExplicit = true;
			i += 1;
			continue;
		}
		if (arg === "--") {
			positional.push(...argv.slice(i + 1));
			break;
		}
		if (arg.startsWith("-")) {
			throw new Error(`Unknown flag: ${arg}`);
		}
		positional.push(arg);
	}

	if (positional.length > 0) {
		options.path = positional.join(" ");
	}

	if (options.strict && !options.topExplicit) {
		options.top = 15;
	}

	return options;
}

async function main() {
	let options;
	try {
		options = parseArgs(process.argv.slice(2));
	} catch (error) {
		console.error(error.message);
		printUsage();
		process.exit(1);
	}

	if (options.help) {
		printUsage();
		process.exit(0);
	}

	let root;
	try {
		root = resolveProjectRoot();
	} catch (error) {
		console.error(error.message);
		process.exit(2);
	}

	const targetPath = normalizeRepoPath(options.path);
	const absoluteTarget = resolve(root, targetPath);

	if (!existsSync(absoluteTarget)) {
		console.error(`Path not found: ${targetPath}`);
		process.exit(1);
	}

	let rows;
	try {
		rows = await collectCoChanges({
			root,
			targetPath,
			sinceIsoDate: options.since,
			strict: options.strict,
			top: options.top,
		});
	} catch (error) {
		console.error(error.message || "git log failed");
		process.exit(error.exitCode === 1 ? 1 : 2);
	}

	const testCommands = suggestTestCommands(rows, targetPath);
	const { fanOutCount, label: fanOutLabel } = getDepcruiseFanOut(
		root,
		targetPath,
	);
	const report = formatReport({
		targetPath,
		since: options.since,
		rows,
		testCommands,
		fanOutCount,
		fanOutLabel,
		strict: options.strict,
	});

	console.log(report);
}

main();
