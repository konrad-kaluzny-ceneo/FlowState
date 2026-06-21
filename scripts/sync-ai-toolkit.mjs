#!/usr/bin/env node
/**
 * Syncs `.cursor/` from optional @kaluzny-konrad/ai-toolkit-kk when installed locally.
 * Skips in CI/Vercel — those environments use committed `.cursor/` files instead.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const PACKAGE_SYNC_SCRIPT = join(
	"node_modules",
	"@kaluzny-konrad",
	"ai-toolkit-kk",
	"scripts",
	"sync-to-project.mjs",
);

const isAutomatedEnvironment = Boolean(process.env.CI || process.env.VERCEL);
const requirePackage = process.argv.includes("--require");

function printMissingPackageHelp() {
	console.error(
		[
			"[ai-toolkit] @kaluzny-konrad/ai-toolkit-kk is not installed.",
			"Local dev: npm login --registry=https://npm.pkg.github.com --scope=@kaluzny-konrad",
			"Then: pnpm install && pnpm sync:ai-toolkit",
			"CI/Vercel: use .cursor/ files committed in git (no registry token needed).",
		].join("\n"),
	);
}

if (isAutomatedEnvironment && !requirePackage) {
	process.exit(0);
}

if (!existsSync(PACKAGE_SYNC_SCRIPT)) {
	if (requirePackage) {
		printMissingPackageHelp();
		process.exit(1);
	}

	console.log(
		"[ai-toolkit] Optional package not installed — using .cursor/ from git.",
	);
	process.exit(0);
}

execSync(`node ${PACKAGE_SYNC_SCRIPT}`, { stdio: "inherit" });
