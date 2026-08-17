import type { PrismaClient } from "@prisma/generated";
import { TRPCError } from "@trpc/server";

import { intervalsOverlap } from "~/lib/schedule/overlap";
import type {
	DomainContextTag,
	DomainScheduleBlock,
	GtdFixedContext,
	ScheduleBlockType,
} from "~/lib/schedule/types";
import {
	AXIS_END_MINUTE,
	AXIS_START_MINUTE,
	SNAP_MINUTES,
} from "~/lib/schedule/types";

export const SCHEDULE_OVERLAP_MESSAGE =
	"This block overlaps another — pick a different time.";
export const SCHEDULE_SNAP_MESSAGE =
	"Block times need to land on a 15-minute mark.";
export const SCHEDULE_DURATION_MESSAGE =
	"A block needs to be at least 15 minutes.";
export const SCHEDULE_AXIS_MESSAGE =
	"Blocks need to stay between 06:00 and 22:00.";
export const SCHEDULE_CONTEXT_XOR_MESSAGE =
	"Choose a fixed context or a custom tag — not both.";
export const SCHEDULE_ATTACHMENT_TYPE_MESSAGE =
	"This block type cannot keep those attachments.";
export const SCHEDULE_TASK_ATTACH_MESSAGE =
	"That task cannot be attached to this block.";
export const SCHEDULE_TAG_IN_USE_MESSAGE =
	"This context is still used on a block — remove it there first.";
export const SCHEDULE_TAG_CAP_MESSAGE =
	"You already have 50 context tags — delete one to add another.";
export const SCHEDULE_TAG_EMPTY_MESSAGE = "Enter a short context name.";
export const SCHEDULE_TAG_LENGTH_MESSAGE =
	"Context names can be at most 32 characters.";
export const SCHEDULE_TAG_DUPLICATE_MESSAGE = "That context already exists.";

export const MAX_CONTEXT_TAGS_PER_USER = 50;
export const MAX_CONTEXT_TAG_LABEL_LENGTH = 32;

const ATTACHABLE_TASK_STATUSES = new Set(["active", "planned"]);

const scheduleBlockInclude = {
	customContextTag: { select: { id: true, label: true } },
	focusTask: { select: { id: true, title: true } },
	batchTasks: {
		select: { taskId: true, sortOrder: true },
		orderBy: { sortOrder: "asc" as const },
	},
};

type ScheduleTx = Pick<
	PrismaClient,
	"scheduleBlock" | "scheduleBlockTask" | "userContextTag" | "task"
>;

type ScheduleBlockRow = {
	id: number;
	userId: string;
	localDateKey: string;
	blockType: ScheduleBlockType;
	startMinute: number;
	durationMinutes: number;
	metaLabel: string | null;
	fixedContext: GtdFixedContext | null;
	customContextTagId: number | null;
	focusTaskId: number | null;
	createdAt: Date;
	updatedAt: Date;
	customContextTag?: { id: number; label: string } | null;
	focusTask?: { id: number; title: string } | null;
	batchTasks?: Array<{ taskId: number; sortOrder: number }>;
};

export type CreateScheduleBlockFields = {
	localDateKey: string;
	blockType: ScheduleBlockType;
	startMinute: number;
	durationMinutes: number;
	metaLabel?: string | null;
	fixedContext?: GtdFixedContext | null;
	customContextTagId?: number | null;
};

export type UpdateScheduleBlockFields = {
	blockId: number;
	blockType?: ScheduleBlockType;
	startMinute?: number;
	durationMinutes?: number;
	metaLabel?: string | null;
	fixedContext?: GtdFixedContext | null;
	customContextTagId?: number | null;
};

function isPrismaCode(error: unknown, code: string): boolean {
	return (
		error instanceof Error &&
		"code" in error &&
		(error as { code: string }).code === code
	);
}

function normalizeMetaLabel(value: string | null | undefined): string | null {
	if (value == null) {
		return null;
	}
	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}

export function sanitizeContextLabel(raw: string): string {
	return [...raw]
		.filter((char) => {
			const code = char.codePointAt(0) ?? 0;
			return code > 31 && code !== 127;
		})
		.join("")
		.trim();
}

function mapToDomain(row: ScheduleBlockRow): DomainScheduleBlock {
	const batchTaskIds = [...(row.batchTasks ?? [])]
		.sort((a, b) => a.sortOrder - b.sortOrder)
		.map((link) => link.taskId);

	return {
		id: row.id,
		userId: row.userId,
		localDateKey: row.localDateKey,
		blockType: row.blockType,
		startMinute: row.startMinute,
		durationMinutes: row.durationMinutes,
		metaLabel: row.metaLabel,
		fixedContext: row.fixedContext,
		customContextTagId: row.customContextTagId,
		contextLabel: row.customContextTag?.label ?? row.fixedContext ?? null,
		focusTaskId: row.focusTaskId,
		focusTask: row.focusTask ?? null,
		batchTaskIds,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

function mapContextTag(row: {
	id: number;
	label: string;
	createdAt: Date;
	updatedAt: Date;
}): DomainContextTag {
	return {
		id: row.id,
		label: row.label,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

export function assertSnappedAndInBounds(
	startMinute: number,
	durationMinutes: number,
): void {
	if (durationMinutes < SNAP_MINUTES) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: SCHEDULE_DURATION_MESSAGE,
		});
	}
	if (
		startMinute % SNAP_MINUTES !== 0 ||
		durationMinutes % SNAP_MINUTES !== 0
	) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: SCHEDULE_SNAP_MESSAGE,
		});
	}
	if (
		startMinute < AXIS_START_MINUTE ||
		startMinute + durationMinutes > AXIS_END_MINUTE
	) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: SCHEDULE_AXIS_MESSAGE,
		});
	}
}

export function assertContextXor(
	fixedContext: GtdFixedContext | null,
	customContextTagId: number | null,
): void {
	if (fixedContext != null && customContextTagId != null) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: SCHEDULE_CONTEXT_XOR_MESSAGE,
		});
	}
}

async function assertNoOverlap(
	tx: ScheduleTx,
	userId: string,
	localDateKey: string,
	candidate: { startMinute: number; durationMinutes: number },
	excludeId?: number,
): Promise<void> {
	const existing = await tx.scheduleBlock.findMany({
		where: {
			userId,
			localDateKey,
			...(excludeId != null ? { id: { not: excludeId } } : {}),
		},
		select: { startMinute: true, durationMinutes: true },
	});

	for (const block of existing) {
		if (intervalsOverlap(candidate, block)) {
			throw new TRPCError({
				code: "CONFLICT",
				message: SCHEDULE_OVERLAP_MESSAGE,
			});
		}
	}
}

async function assertOwnedContextTag(
	tx: ScheduleTx,
	userId: string,
	tagId: number,
): Promise<void> {
	const tag = await tx.userContextTag.findFirst({
		where: { id: tagId, userId },
		select: { id: true },
	});
	if (tag == null) {
		throw new TRPCError({ code: "NOT_FOUND" });
	}
}

async function requireOwnedBlock(
	tx: ScheduleTx,
	userId: string,
	blockId: number,
): Promise<ScheduleBlockRow> {
	const block = await tx.scheduleBlock.findFirst({
		where: { id: blockId, userId },
		include: scheduleBlockInclude,
	});
	if (block == null) {
		throw new TRPCError({ code: "NOT_FOUND" });
	}
	return block;
}

async function loadBlock(
	tx: ScheduleTx,
	userId: string,
	blockId: number,
): Promise<DomainScheduleBlock> {
	const block = await requireOwnedBlock(tx, userId, blockId);
	return mapToDomain(block);
}

async function assertAttachableTask(
	tx: ScheduleTx,
	userId: string,
	taskId: number,
): Promise<void> {
	const task = await tx.task.findFirst({
		where: { id: taskId, userId },
		select: { id: true, status: true },
	});
	if (task == null) {
		throw new TRPCError({ code: "NOT_FOUND" });
	}
	if (!ATTACHABLE_TASK_STATUSES.has(task.status)) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: SCHEDULE_TASK_ATTACH_MESSAGE,
		});
	}
}

export async function listBlocksForDay(
	database: ScheduleTx,
	userId: string,
	localDateKey: string,
): Promise<DomainScheduleBlock[]> {
	const rows = await database.scheduleBlock.findMany({
		where: { userId, localDateKey },
		orderBy: { startMinute: "asc" },
		include: scheduleBlockInclude,
	});
	return rows.map(mapToDomain);
}

export async function createBlock(
	database: PrismaClient,
	userId: string,
	input: CreateScheduleBlockFields,
): Promise<DomainScheduleBlock> {
	assertSnappedAndInBounds(input.startMinute, input.durationMinutes);
	assertContextXor(
		input.fixedContext ?? null,
		input.customContextTagId ?? null,
	);

	const metaLabel = normalizeMetaLabel(input.metaLabel);
	if (input.blockType !== "BATCH" && metaLabel != null) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: SCHEDULE_ATTACHMENT_TYPE_MESSAGE,
		});
	}

	return database.$transaction(async (tx) => {
		if (input.customContextTagId != null) {
			await assertOwnedContextTag(tx, userId, input.customContextTagId);
		}

		await assertNoOverlap(tx, userId, input.localDateKey, {
			startMinute: input.startMinute,
			durationMinutes: input.durationMinutes,
		});

		const created = await tx.scheduleBlock.create({
			data: {
				userId,
				localDateKey: input.localDateKey,
				blockType: input.blockType,
				startMinute: input.startMinute,
				durationMinutes: input.durationMinutes,
				metaLabel: input.blockType === "BATCH" ? metaLabel : null,
				fixedContext: input.fixedContext ?? null,
				customContextTagId: input.customContextTagId ?? null,
			},
			include: scheduleBlockInclude,
		});

		return mapToDomain(created);
	});
}

export async function updateBlock(
	database: PrismaClient,
	userId: string,
	input: UpdateScheduleBlockFields,
): Promise<DomainScheduleBlock> {
	return database.$transaction(async (tx) => {
		const existing = await requireOwnedBlock(tx, userId, input.blockId);
		const nextType = input.blockType ?? existing.blockType;
		const nextStart = input.startMinute ?? existing.startMinute;
		const nextDuration = input.durationMinutes ?? existing.durationMinutes;
		const nextFixed =
			input.fixedContext !== undefined
				? input.fixedContext
				: existing.fixedContext;
		const nextCustom =
			input.customContextTagId !== undefined
				? input.customContextTagId
				: existing.customContextTagId;

		assertSnappedAndInBounds(nextStart, nextDuration);
		assertContextXor(nextFixed, nextCustom);

		if (nextType !== "BATCH" && input.metaLabel != null) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: SCHEDULE_ATTACHMENT_TYPE_MESSAGE,
			});
		}

		if (nextCustom != null) {
			await assertOwnedContextTag(tx, userId, nextCustom);
		}

		await assertNoOverlap(
			tx,
			userId,
			existing.localDateKey,
			{ startMinute: nextStart, durationMinutes: nextDuration },
			existing.id,
		);

		if (nextType !== "BATCH") {
			await tx.scheduleBlockTask.deleteMany({
				where: { scheduleBlockId: existing.id },
			});
		}

		const nextMeta =
			nextType === "BATCH"
				? input.metaLabel !== undefined
					? normalizeMetaLabel(input.metaLabel)
					: existing.metaLabel
				: null;
		const nextFocus = nextType === "FOCUS" ? existing.focusTaskId : null;

		const updated = await tx.scheduleBlock.update({
			where: { id: existing.id },
			data: {
				blockType: nextType,
				startMinute: nextStart,
				durationMinutes: nextDuration,
				metaLabel: nextMeta,
				fixedContext: nextFixed,
				customContextTagId: nextCustom,
				focusTaskId: nextFocus,
			},
			include: scheduleBlockInclude,
		});

		return mapToDomain(updated);
	});
}

export async function deleteBlock(
	database: PrismaClient,
	userId: string,
	blockId: number,
): Promise<void> {
	await database.$transaction(async (tx) => {
		await requireOwnedBlock(tx, userId, blockId);
		await tx.scheduleBlock.delete({ where: { id: blockId } });
	});
}

export async function setBlockFocusTask(
	database: PrismaClient,
	userId: string,
	blockId: number,
	taskId: number | null,
): Promise<DomainScheduleBlock> {
	return database.$transaction(async (tx) => {
		const existing = await requireOwnedBlock(tx, userId, blockId);
		if (existing.blockType !== "FOCUS") {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: SCHEDULE_ATTACHMENT_TYPE_MESSAGE,
			});
		}

		if (taskId != null) {
			await assertAttachableTask(tx, userId, taskId);
		}

		const updated = await tx.scheduleBlock.update({
			where: { id: existing.id },
			data: { focusTaskId: taskId },
			include: scheduleBlockInclude,
		});
		return mapToDomain(updated);
	});
}

export async function setBlockBatchTasks(
	database: PrismaClient,
	userId: string,
	blockId: number,
	taskIds: number[],
): Promise<DomainScheduleBlock> {
	if (new Set(taskIds).size !== taskIds.length) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: SCHEDULE_TASK_ATTACH_MESSAGE,
		});
	}

	return database.$transaction(async (tx) => {
		const existing = await requireOwnedBlock(tx, userId, blockId);
		if (existing.blockType !== "BATCH") {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: SCHEDULE_ATTACHMENT_TYPE_MESSAGE,
			});
		}

		for (const taskId of taskIds) {
			await assertAttachableTask(tx, userId, taskId);
		}

		await tx.scheduleBlockTask.deleteMany({
			where: { scheduleBlockId: existing.id },
		});

		if (taskIds.length > 0) {
			await tx.scheduleBlockTask.createMany({
				data: taskIds.map((taskId, sortOrder) => ({
					scheduleBlockId: existing.id,
					taskId,
					sortOrder,
				})),
			});
		}

		return loadBlock(tx, userId, existing.id);
	});
}

export async function listContextTags(
	database: ScheduleTx,
	userId: string,
): Promise<DomainContextTag[]> {
	const rows = await database.userContextTag.findMany({
		where: { userId },
		orderBy: { label: "asc" },
	});
	return rows.map(mapContextTag);
}

export async function createContextTag(
	database: PrismaClient,
	userId: string,
	rawLabel: string,
): Promise<DomainContextTag> {
	const label = sanitizeContextLabel(rawLabel);
	if (label.length === 0) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: SCHEDULE_TAG_EMPTY_MESSAGE,
		});
	}
	if (label.length > MAX_CONTEXT_TAG_LABEL_LENGTH) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: SCHEDULE_TAG_LENGTH_MESSAGE,
		});
	}

	try {
		return await database.$transaction(async (tx) => {
			const count = await tx.userContextTag.count({ where: { userId } });
			if (count >= MAX_CONTEXT_TAGS_PER_USER) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: SCHEDULE_TAG_CAP_MESSAGE,
				});
			}

			const created = await tx.userContextTag.create({
				data: { userId, label },
			});
			return mapContextTag(created);
		});
	} catch (error) {
		if (error instanceof TRPCError) {
			throw error;
		}
		if (isPrismaCode(error, "P2002")) {
			throw new TRPCError({
				code: "CONFLICT",
				message: SCHEDULE_TAG_DUPLICATE_MESSAGE,
			});
		}
		throw error;
	}
}

export async function deleteContextTag(
	database: PrismaClient,
	userId: string,
	tagId: number,
): Promise<void> {
	await database.$transaction(async (tx) => {
		const tag = await tx.userContextTag.findFirst({
			where: { id: tagId, userId },
			select: { id: true },
		});
		if (tag == null) {
			throw new TRPCError({ code: "NOT_FOUND" });
		}

		const inUse = await tx.scheduleBlock.count({
			where: { userId, customContextTagId: tagId },
		});
		if (inUse > 0) {
			throw new TRPCError({
				code: "CONFLICT",
				message: SCHEDULE_TAG_IN_USE_MESSAGE,
			});
		}

		await tx.userContextTag.delete({ where: { id: tagId } });
	});
}
