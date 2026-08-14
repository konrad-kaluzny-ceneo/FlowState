type FocusPagePrefetchApi = {
	task: {
		list: { prefetch: () => Promise<void> | void };
	};
	cycle: {
		getActive: {
			prefetch: (input: {
				localDateKey: string;
				timeZone?: string;
			}) => Promise<void> | void;
		};
	};
	recap: {
		getDaily: {
			prefetch: (input: { localDateKey: string }) => Promise<void> | void;
		};
	};
};

export async function prefetchFocusPageData(
	api: FocusPagePrefetchApi,
	input: { localDateKey: string; timeZone?: string },
): Promise<void> {
	await Promise.all([
		api.task.list.prefetch(),
		api.cycle.getActive.prefetch({
			localDateKey: input.localDateKey,
			timeZone: input.timeZone,
		}),
		api.recap.getDaily.prefetch({ localDateKey: input.localDateKey }),
	]);
}
