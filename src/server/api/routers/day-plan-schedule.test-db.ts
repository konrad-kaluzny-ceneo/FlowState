import { vi } from "vitest";

export type ScheduleBlockRow = {
	id: number;
	userId: string;
	localDateKey: string;
	blockType: string;
	startMinute: number;
	durationMinutes: number;
	metaLabel: string | null;
	fixedContext: string | null;
	customContextTagId: number | null;
	focusTaskId: number | null;
	createdAt: Date;
	updatedAt: Date;
};

export type ContextTagRow = {
	id: number;
	userId: string;
	label: string;
	createdAt: Date;
	updatedAt: Date;
};

export type BatchLinkRow = {
	id: number;
	scheduleBlockId: number;
	taskId: number;
	sortOrder: number;
};

export type ScheduleTaskRow = {
	id: number;
	userId: string;
	title: string;
	status: string;
};

let blocks: ScheduleBlockRow[] = [];
let tags: ContextTagRow[] = [];
let links: BatchLinkRow[] = [];
let tasks: ScheduleTaskRow[] = [];
let nextBlockId = 1;
let nextTagId = 1;
let nextLinkId = 1;

export function resetScheduleTestDb(): void {
	blocks = [];
	tags = [];
	links = [];
	tasks = [];
	nextBlockId = 1;
	nextTagId = 1;
	nextLinkId = 1;
}

export function seedScheduleTask(row: ScheduleTaskRow): void {
	tasks.push(row);
}

export function seedScheduleBlock(
	row: Omit<ScheduleBlockRow, "createdAt" | "updatedAt"> &
		Partial<Pick<ScheduleBlockRow, "createdAt" | "updatedAt">>,
): void {
	blocks.push({
		createdAt: row.createdAt ?? new Date(),
		updatedAt: row.updatedAt ?? new Date(),
		id: row.id,
		userId: row.userId,
		localDateKey: row.localDateKey,
		blockType: row.blockType,
		startMinute: row.startMinute,
		durationMinutes: row.durationMinutes,
		metaLabel: row.metaLabel,
		fixedContext: row.fixedContext,
		customContextTagId: row.customContextTagId,
		focusTaskId: row.focusTaskId,
	});
	if (row.id >= nextBlockId) {
		nextBlockId = row.id + 1;
	}
}

export function seedContextTag(
	row: Omit<ContextTagRow, "createdAt" | "updatedAt"> &
		Partial<Pick<ContextTagRow, "createdAt" | "updatedAt">>,
): void {
	tags.push({
		createdAt: row.createdAt ?? new Date(),
		updatedAt: row.updatedAt ?? new Date(),
		id: row.id,
		userId: row.userId,
		label: row.label,
	});
	if (row.id >= nextTagId) {
		nextTagId = row.id + 1;
	}
}

function hydrateBlock(block: ScheduleBlockRow) {
	const tag =
		block.customContextTagId == null
			? null
			: (tags.find((row) => row.id === block.customContextTagId) ?? null);
	const focusTask =
		block.focusTaskId == null
			? null
			: (tasks.find((row) => row.id === block.focusTaskId) ?? null);
	const batchTasks = links
		.filter((link) => link.scheduleBlockId === block.id)
		.sort((a, b) => a.sortOrder - b.sortOrder)
		.map((link) => ({ taskId: link.taskId, sortOrder: link.sortOrder }));

	return {
		...block,
		customContextTag: tag == null ? null : { id: tag.id, label: tag.label },
		focusTask:
			focusTask == null ? null : { id: focusTask.id, title: focusTask.title },
		batchTasks,
	};
}

function matchesBlockWhere(
	block: ScheduleBlockRow,
	where:
		| {
				userId?: string;
				localDateKey?: string;
				id?: number | { not?: number };
				customContextTagId?: number;
		  }
		| undefined,
): boolean {
	if (where?.userId != null && block.userId !== where.userId) {
		return false;
	}
	if (
		where?.localDateKey != null &&
		block.localDateKey !== where.localDateKey
	) {
		return false;
	}
	if (
		where?.customContextTagId != null &&
		block.customContextTagId !== where.customContextTagId
	) {
		return false;
	}
	if (where?.id != null) {
		if (typeof where.id === "number") {
			return block.id === where.id;
		}
		if (where.id.not != null && block.id === where.id.not) {
			return false;
		}
	}
	return true;
}

export const scheduleTestDb = {
	scheduleBlock: {
		findMany: vi.fn(
			(args: {
				where?: {
					userId?: string;
					localDateKey?: string;
					id?: number | { not?: number };
					customContextTagId?: number;
				};
				orderBy?: { startMinute?: "asc" | "desc" };
				include?: unknown;
				select?: unknown;
			}) => {
				const matches = blocks.filter((block) =>
					matchesBlockWhere(block, args.where),
				);
				if (args.orderBy?.startMinute === "asc") {
					matches.sort((a, b) => a.startMinute - b.startMinute);
				}
				if (args.select != null) {
					return Promise.resolve(matches);
				}
				return Promise.resolve(matches.map(hydrateBlock));
			},
		),
		findFirst: vi.fn(
			(args: {
				where?: { id?: number; userId?: string };
				include?: unknown;
			}) => {
				const row = blocks.find((block) =>
					matchesBlockWhere(block, args.where),
				);
				return Promise.resolve(row == null ? null : hydrateBlock(row));
			},
		),
		create: vi.fn(
			(args: {
				data: {
					userId: string;
					localDateKey: string;
					blockType: string;
					startMinute: number;
					durationMinutes: number;
					metaLabel?: string | null;
					fixedContext?: string | null;
					customContextTagId?: number | null;
					focusTaskId?: number | null;
				};
				include?: unknown;
			}) => {
				const now = new Date();
				const row: ScheduleBlockRow = {
					id: nextBlockId++,
					userId: args.data.userId,
					localDateKey: args.data.localDateKey,
					blockType: args.data.blockType,
					startMinute: args.data.startMinute,
					durationMinutes: args.data.durationMinutes,
					metaLabel: args.data.metaLabel ?? null,
					fixedContext: args.data.fixedContext ?? null,
					customContextTagId: args.data.customContextTagId ?? null,
					focusTaskId: args.data.focusTaskId ?? null,
					createdAt: now,
					updatedAt: now,
				};
				blocks.push(row);
				return Promise.resolve(hydrateBlock(row));
			},
		),
		update: vi.fn(
			(args: {
				where: { id: number };
				data: Partial<
					Pick<
						ScheduleBlockRow,
						| "blockType"
						| "startMinute"
						| "durationMinutes"
						| "metaLabel"
						| "fixedContext"
						| "customContextTagId"
						| "focusTaskId"
					>
				>;
				include?: unknown;
			}) => {
				const row = blocks.find((block) => block.id === args.where.id);
				if (row == null) {
					throw new Error("Schedule block not found");
				}
				Object.assign(row, args.data);
				row.updatedAt = new Date();
				return Promise.resolve(hydrateBlock(row));
			},
		),
		delete: vi.fn((args: { where: { id: number } }) => {
			const index = blocks.findIndex((block) => block.id === args.where.id);
			if (index < 0) {
				throw new Error("Schedule block not found");
			}
			const [removed] = blocks.splice(index, 1);
			if (removed == null) {
				throw new Error("Schedule block not found");
			}
			links = links.filter((link) => link.scheduleBlockId !== removed.id);
			return Promise.resolve(hydrateBlock(removed));
		}),
		count: vi.fn(
			(args: { where?: { userId?: string; customContextTagId?: number } }) =>
				Promise.resolve(
					blocks.filter((block) => matchesBlockWhere(block, args.where)).length,
				),
		),
	},
	scheduleBlockTask: {
		deleteMany: vi.fn((args: { where: { scheduleBlockId: number } }) => {
			const before = links.length;
			links = links.filter(
				(link) => link.scheduleBlockId !== args.where.scheduleBlockId,
			);
			return Promise.resolve({ count: before - links.length });
		}),
		createMany: vi.fn(
			(args: {
				data: Array<{
					scheduleBlockId: number;
					taskId: number;
					sortOrder: number;
				}>;
			}) => {
				for (const row of args.data) {
					links.push({
						id: nextLinkId++,
						scheduleBlockId: row.scheduleBlockId,
						taskId: row.taskId,
						sortOrder: row.sortOrder,
					});
				}
				return Promise.resolve({ count: args.data.length });
			},
		),
	},
	userContextTag: {
		findMany: vi.fn(
			(args: {
				where?: { userId?: string };
				orderBy?: { label?: "asc" | "desc" };
			}) => {
				const matches = tags.filter((tag) =>
					args.where?.userId == null ? true : tag.userId === args.where.userId,
				);
				if (args.orderBy?.label === "asc") {
					matches.sort((a, b) => a.label.localeCompare(b.label));
				}
				return Promise.resolve(matches);
			},
		),
		findFirst: vi.fn(
			(args: {
				where?: { id?: number; userId?: string };
				select?: unknown;
			}) => {
				const row = tags.find(
					(tag) =>
						(args.where?.id == null || tag.id === args.where.id) &&
						(args.where?.userId == null || tag.userId === args.where.userId),
				);
				return Promise.resolve(row ?? null);
			},
		),
		create: vi.fn((args: { data: { userId: string; label: string } }) => {
			const duplicate = tags.find(
				(tag) =>
					tag.userId === args.data.userId && tag.label === args.data.label,
			);
			if (duplicate != null) {
				const error = new Error("Unique constraint failed");
				(error as Error & { code: string }).code = "P2002";
				return Promise.reject(error);
			}
			const now = new Date();
			const row: ContextTagRow = {
				id: nextTagId++,
				userId: args.data.userId,
				label: args.data.label,
				createdAt: now,
				updatedAt: now,
			};
			tags.push(row);
			return Promise.resolve(row);
		}),
		delete: vi.fn((args: { where: { id: number } }) => {
			const index = tags.findIndex((tag) => tag.id === args.where.id);
			if (index < 0) {
				throw new Error("Context tag not found");
			}
			const [removed] = tags.splice(index, 1);
			return Promise.resolve(removed);
		}),
		count: vi.fn((args: { where?: { userId?: string } }) =>
			Promise.resolve(
				tags.filter((tag) =>
					args.where?.userId == null ? true : tag.userId === args.where.userId,
				).length,
			),
		),
	},
	task: {
		findFirst: vi.fn(
			(args: {
				where?: { id?: number; userId?: string };
				select?: unknown;
			}) => {
				const row = tasks.find(
					(task) =>
						(args.where?.id == null || task.id === args.where.id) &&
						(args.where?.userId == null || task.userId === args.where.userId),
				);
				return Promise.resolve(row ?? null);
			},
		),
		findMany: vi.fn(
			(args: {
				where?: { userId?: string; id?: { in?: number[] }; status?: unknown };
			}) => {
				const matches = tasks.filter((task) => {
					if (args.where?.userId != null && task.userId !== args.where.userId) {
						return false;
					}
					if (
						args.where?.id?.in != null &&
						!args.where.id.in.includes(task.id)
					) {
						return false;
					}
					return true;
				});
				return Promise.resolve(matches);
			},
		),
	},
	$transaction: vi.fn(
		async (arg: Promise<unknown>[] | ((tx: unknown) => unknown)) => {
			if (Array.isArray(arg)) {
				return Promise.all(arg);
			}
			return arg(scheduleTestDb);
		},
	),
};
