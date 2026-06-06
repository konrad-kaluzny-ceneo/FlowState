/** Cursor/VS Code require valid JSON on stdout when exit code is 0. */
export function finishSuccess() {
	process.stdout.write(JSON.stringify({ continue: true }));
	process.exit(0);
}

/** Tool output on stderr for agent context; stdout stays empty on block. */
export function finishFailure(result) {
	const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
	if (output) process.stderr.write(output);
	process.exit(2);
}

export function finishCommand(result) {
	if (result.status === 0) {
		finishSuccess();
	}
	finishFailure(result);
}
