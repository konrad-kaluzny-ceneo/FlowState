import { describe, expect, it } from "vitest";

import {
	beginSuggestionFetch,
	getSuggestionFetchInFlight,
	resetSuggestionFetchPriorityForTests,
	waitUntilSuggestionIdle,
} from "~/lib/trpc/suggestion-priority";

describe("suggestion-priority", () => {
	it("tracks in-flight suggestion fetches", () => {
		resetSuggestionFetchPriorityForTests();
		expect(getSuggestionFetchInFlight()).toBe(false);

		const end = beginSuggestionFetch();
		expect(getSuggestionFetchInFlight()).toBe(true);

		end();
		expect(getSuggestionFetchInFlight()).toBe(false);
	});

	it("waitUntilSuggestionIdle resolves when the last fetch ends", async () => {
		resetSuggestionFetchPriorityForTests();
		const end = beginSuggestionFetch();

		const idlePromise = waitUntilSuggestionIdle();
		let resolved = false;
		void idlePromise.then(() => {
			resolved = true;
		});

		await Promise.resolve();
		expect(resolved).toBe(false);

		end();
		await idlePromise;
		expect(resolved).toBe(true);
	});
});
