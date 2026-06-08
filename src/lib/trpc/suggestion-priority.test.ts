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

	it("beginSuggestionFetch cleanup is idempotent", () => {
		resetSuggestionFetchPriorityForTests();
		const end = beginSuggestionFetch();
		const second = beginSuggestionFetch();

		end();
		end();
		expect(getSuggestionFetchInFlight()).toBe(true);

		second();
		expect(getSuggestionFetchInFlight()).toBe(false);
	});

	it("waitUntilSuggestionIdle resolves after suggestion fetch ends", async () => {
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
		expect(getSuggestionFetchInFlight()).toBe(false);
	});
});
