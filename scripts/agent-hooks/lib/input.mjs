import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

const FILE_EDIT_TOOLS =
	/^(Write|Edit|StrReplace|create_file|replace_string_in_file|editFiles|createFile|multi_replace_string_in_file)$/i;

export function readHookInput() {
	try {
		const raw = readFileSync(0, "utf8").trim();
		if (!raw) return {};
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

/** Cursor on Windows may send `/d:/repo/...` — normalize to `D:/repo/...`. */
export function normalizePath(filePath) {
	if (!filePath || typeof filePath !== "string") return "";
	const trimmed = filePath.trim();
	const driveMatch = trimmed.match(/^\/([a-zA-Z]):\//);
	if (driveMatch) {
		return `${driveMatch[1].toUpperCase()}:${trimmed.slice(3)}`;
	}
	return trimmed;
}

export function getProjectRoot(input) {
	const roots = input.workspace_roots;
	if (Array.isArray(roots) && roots[0]) {
		return normalizePath(roots[0]);
	}
	for (const key of ["CURSOR_PROJECT_DIR", "CLAUDE_PROJECT_DIR"]) {
		if (process.env[key]) return process.env[key];
	}
	return process.cwd();
}

export function isFileEditTool(toolName) {
	return FILE_EDIT_TOOLS.test(toolName ?? "");
}

/** Cursor afterFileEdit + VS Code/Copilot/Claude PostToolUse. */
export function parseFilePaths(input) {
	const paths = new Set();

	if (typeof input.file_path === "string" && input.file_path) {
		paths.add(normalizePath(input.file_path));
	}
	if (typeof input.filePath === "string" && input.filePath) {
		paths.add(normalizePath(input.filePath));
	}

	const toolInput = input.tool_input;
	if (toolInput && typeof toolInput === "object") {
		if (typeof toolInput.file_path === "string" && toolInput.file_path) {
			paths.add(normalizePath(toolInput.file_path));
		}
		if (typeof toolInput.filePath === "string" && toolInput.filePath) {
			paths.add(normalizePath(toolInput.filePath));
		}
		if (typeof toolInput.path === "string" && toolInput.path) {
			paths.add(normalizePath(toolInput.path));
		}
		if (Array.isArray(toolInput.files)) {
			for (const file of toolInput.files) {
				if (typeof file === "string" && file) paths.add(normalizePath(file));
			}
		}
	}

	if (typeof process.env.TOOL_INPUT_FILE_PATH === "string") {
		for (const file of process.env.TOOL_INPUT_FILE_PATH.split(";")) {
			if (file.trim()) paths.add(normalizePath(file.trim()));
		}
	}

	return [...paths];
}

export function isUnderProjectRoot(filePath, projectRoot) {
	if (!filePath || !projectRoot) return false;
	const absFile = resolve(filePath);
	const absRoot = resolve(projectRoot);
	if (!isAbsolute(absFile)) return false;
	const rel = relative(absRoot, absFile);
	return rel !== "" && !rel.startsWith("..") && !rel.startsWith("...");
}

export function shouldLintFile(filePath, projectRoot) {
	if (!/\.(ts|tsx|js|jsx|json|css|mdc)$/i.test(filePath)) return false;
	if (
		filePath.includes("node_modules") ||
		filePath.includes("generated") ||
		filePath.includes("reports/")
	) {
		return false;
	}
	if (!isUnderProjectRoot(filePath, projectRoot)) return false;
	return existsSync(filePath);
}

/** VS Code PostToolUse fires on every tool — skip non-file edits. */
export function shouldRunForInput(input) {
	const toolName = input.tool_name ?? input.toolName ?? "";
	return !toolName || isFileEditTool(toolName);
}
