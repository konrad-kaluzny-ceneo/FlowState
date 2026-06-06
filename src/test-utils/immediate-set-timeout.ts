/** Replaces setTimeout with immediate execution for tRPC timing middleware in tests. */
export function installImmediateSetTimeout(): void {
	const originalSetTimeout = globalThis.setTimeout;
	globalThis.setTimeout = ((
		handler: TimerHandler,
		_timeout?: number,
		...args: unknown[]
	) => originalSetTimeout(handler, 0, ...args)) as typeof globalThis.setTimeout;
}
