import type { TrpcClient } from "~/lib/repositories/server-repositories";

type TrpcUtils = {
	client: {
		task: {
			list: { query: TrpcClient["task"]["list"]["fetch"] };
			create: { mutate: TrpcClient["task"]["create"]["mutate"] };
			update: { mutate: TrpcClient["task"]["update"]["mutate"] };
			delete: { mutate: TrpcClient["task"]["delete"]["mutate"] };
			reorder: { mutate: TrpcClient["task"]["reorder"]["mutate"] };
			archiveList: { query: TrpcClient["task"]["archiveList"]["fetch"] };
			restore: { mutate: TrpcClient["task"]["restore"]["mutate"] };
			deleteArchived: {
				mutate: TrpcClient["task"]["deleteArchived"]["mutate"];
			};
		};
		cycle: {
			getActive: { query: TrpcClient["cycle"]["getActive"]["fetch"] };
			create: { mutate: TrpcClient["cycle"]["create"]["mutate"] };
			complete: { mutate: TrpcClient["cycle"]["complete"]["mutate"] };
			interrupt: { mutate: TrpcClient["cycle"]["interrupt"]["mutate"] };
			pause: { mutate: TrpcClient["cycle"]["pause"]["mutate"] };
			resume: { mutate: TrpcClient["cycle"]["resume"]["mutate"] };
		};
		session: {
			getOrCreateActive: {
				mutate: TrpcClient["session"]["getOrCreateActive"]["mutate"];
			};
			end: { mutate: TrpcClient["session"]["end"]["mutate"] };
		};
		recap: {
			getTrendStats: { query: TrpcClient["recap"]["getTrendStats"]["fetch"] };
		};
	};
};

/** Builds the authenticated repository tRPC adapter from React query utils. */
export function createTrpcRepositoryClient(utils: TrpcUtils): TrpcClient {
	return {
		task: {
			list: { fetch: () => utils.client.task.list.query() },
			create: {
				mutate: (input) => utils.client.task.create.mutate(input),
			},
			update: {
				mutate: (input) => utils.client.task.update.mutate(input),
			},
			delete: {
				mutate: (input) => utils.client.task.delete.mutate(input),
			},
			reorder: {
				mutate: (input) => utils.client.task.reorder.mutate(input),
			},
			archiveList: { fetch: () => utils.client.task.archiveList.query() },
			restore: {
				mutate: (input) => utils.client.task.restore.mutate(input),
			},
			deleteArchived: {
				mutate: (input) => utils.client.task.deleteArchived.mutate(input),
			},
		},
		cycle: {
			getActive: {
				fetch: (input) => utils.client.cycle.getActive.query(input),
			},
			create: {
				mutate: (input) => utils.client.cycle.create.mutate(input),
			},
			complete: {
				mutate: (input) => utils.client.cycle.complete.mutate(input),
			},
			interrupt: {
				mutate: (input) => utils.client.cycle.interrupt.mutate(input),
			},
			pause: {
				mutate: (input) => utils.client.cycle.pause.mutate(input),
			},
			resume: {
				mutate: (input) => utils.client.cycle.resume.mutate(input),
			},
		},
		session: {
			getOrCreateActive: {
				mutate: (input) => utils.client.session.getOrCreateActive.mutate(input),
			},
			end: {
				mutate: (input) =>
					utils.client.session.end.mutate({
						closureLine: input?.closureLine ?? undefined,
						lastFocusedTaskId: input?.lastFocusedTaskId ?? undefined,
					}),
			},
		},
		recap: {
			getTrendStats: {
				fetch: (input) => utils.client.recap.getTrendStats.query(input),
			},
		},
	};
}
