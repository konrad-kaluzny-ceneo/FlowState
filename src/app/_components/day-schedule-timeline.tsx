"use client";

import {
	DndContext,
	type DragEndEvent,
	type Modifier,
	PointerSensor,
	useDraggable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import {
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useRef,
	useState,
} from "react";

import { ScheduleBlockEditPanel } from "~/app/_components/schedule-block-edit-panel";
import type { DomainTask } from "~/lib/data-mode/types";
import { intervalsOverlap } from "~/lib/schedule/overlap";
import { snapMinute } from "~/lib/schedule/snap";
import type {
	DomainContextTag,
	DomainScheduleBlock,
	ScheduleBlockType,
} from "~/lib/schedule/types";
import {
	AXIS_END_MINUTE,
	AXIS_START_MINUTE,
	SNAP_MINUTES,
} from "~/lib/schedule/types";
import { isTrpcErrorCode } from "~/lib/trpc/error-code";

export const SCHEDULE_HOUR_HEIGHT_PX = 56;
export const DEFAULT_BLOCK_DURATION_MINUTES = 30;

const PIXELS_PER_MINUTE = SCHEDULE_HOUR_HEIGHT_PX / 60;
const AXIS_HOUR_COUNT = (AXIS_END_MINUTE - AXIS_START_MINUTE) / 60;
const AXIS_HEIGHT_PX = AXIS_HOUR_COUNT * SCHEDULE_HOUR_HEIGHT_PX;
const AXIS_HOURS = Array.from(
	{ length: AXIS_HOUR_COUNT },
	(_, index) => 6 + index,
);

const BLOCK_TYPE_CLASS: Record<ScheduleBlockType, string> = {
	FOCUS: "bg-worktype-deep-bg text-worktype-deep-text",
	MEETING: "bg-worktype-ops-bg text-worktype-ops-text",
	BREAK: "bg-surface-break text-accent-break",
	PERSONAL: "bg-energy-fading-bg text-energy-fading",
	PLANNING: "bg-energy-steady-bg text-energy-steady",
	BATCH: "bg-worktype-reactive-bg text-worktype-reactive-text",
};

const BLOCK_TYPE_I18N: Record<
	ScheduleBlockType,
	| "blockFocus"
	| "blockMeeting"
	| "blockBreak"
	| "blockPersonal"
	| "blockPlanning"
	| "blockBatch"
> = {
	FOCUS: "blockFocus",
	MEETING: "blockMeeting",
	BREAK: "blockBreak",
	PERSONAL: "blockPersonal",
	PLANNING: "blockPlanning",
	BATCH: "blockBatch",
};

type CreateBlockInput = {
	blockType: ScheduleBlockType;
	startMinute: number;
	durationMinutes: number;
};

type UpdateBlockInput = {
	blockId: number;
	blockType?: ScheduleBlockType;
	startMinute?: number;
	durationMinutes?: number;
	metaLabel?: string | null;
	fixedContext?: "PHONE" | "COMPUTER" | "OFFICE" | "ERRANDS" | null;
	customContextTagId?: number | null;
};

export type DayScheduleTimelineProps = {
	blocks: DomainScheduleBlock[];
	tasks?: DomainTask[];
	contextTags?: DomainContextTag[];
	localDateKey: string;
	isLoading?: boolean;
	error?: string | null;
	createBlock: (input: CreateBlockInput) => Promise<unknown>;
	updateBlock: (input: UpdateBlockInput) => Promise<unknown>;
	deleteBlock?: (blockId: number) => Promise<unknown>;
	setBlockFocusTask?: (input: {
		blockId: number;
		taskId: number | null;
	}) => Promise<unknown>;
	setBlockBatchTasks?: (input: {
		blockId: number;
		taskIds: number[];
	}) => Promise<unknown>;
	createContextTag?: (label: string) => Promise<DomainContextTag>;
};

type BlockDragData = {
	blockId: number;
	startMinute: number;
	durationMinutes: number;
};

type ResizePreview = {
	blockId: number;
	startMinute: number;
	durationMinutes: number;
};

type ResizeSession = {
	blockId: number;
	edge: "start" | "end";
	originY: number;
	startMinute: number;
	durationMinutes: number;
};

function formatHourLabel(hour: number): string {
	return `${String(hour).padStart(2, "0")}:00`;
}

function formatAxisTime(minute: number): string {
	const hours = Math.floor(minute / 60);
	const minutes = minute % 60;
	return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function snapDuration(minutes: number): number {
	const snapped = Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
	return Math.max(SNAP_MINUTES, snapped);
}

function snapBlock(
	startMinute: number,
	durationMinutes: number,
): { startMinute: number; durationMinutes: number } {
	const duration = snapDuration(durationMinutes);
	const maxStart = AXIS_END_MINUTE - duration;
	const start = Math.min(maxStart, snapMinute(startMinute));
	return { startMinute: start, durationMinutes: duration };
}

function findOpenSlot(
	blocks: DomainScheduleBlock[],
	durationMinutes: number,
): number | null {
	for (
		let start = AXIS_START_MINUTE;
		start + durationMinutes <= AXIS_END_MINUTE;
		start += SNAP_MINUTES
	) {
		const candidate = { startMinute: start, durationMinutes };
		if (!blocks.some((block) => intervalsOverlap(block, candidate))) {
			return start;
		}
	}
	return null;
}

function minuteFromAxisY(clientY: number, axisTop: number): number {
	return AXIS_START_MINUTE + (clientY - axisTop) / PIXELS_PER_MINUTE;
}

const restrictMoveToAxis: Modifier = ({ transform, active }) => {
	const data = active?.data.current as BlockDragData | undefined;
	const snappedY =
		Math.round(transform.y / (SNAP_MINUTES * PIXELS_PER_MINUTE)) *
		SNAP_MINUTES *
		PIXELS_PER_MINUTE;
	if (data == null) {
		return { ...transform, x: 0, y: snappedY };
	}
	const minY = (AXIS_START_MINUTE - data.startMinute) * PIXELS_PER_MINUTE;
	const maxY =
		(AXIS_END_MINUTE - data.durationMinutes - data.startMinute) *
		PIXELS_PER_MINUTE;
	return {
		...transform,
		x: 0,
		y: Math.min(maxY, Math.max(minY, snappedY)),
	};
};

function TimelineSkeleton() {
	const t = useTranslations("PlanDnia");

	return (
		<div
			aria-busy="true"
			className="w-full rounded-card border border-card-border bg-surface-card px-5 py-4 shadow-sm"
			data-testid="schedule-timeline-skeleton"
		>
			<p className="sr-only">{t("loading")}</p>
			<div className="ml-12 space-y-2">
				{AXIS_HOURS.slice(0, 6).map((hour) => (
					<div
						className="h-10 animate-pulse rounded-lg bg-surface-card-muted"
						key={hour}
					/>
				))}
			</div>
		</div>
	);
}

function ScheduleBlockChip({
	block,
	preview,
	onResizePointerDown,
	onOpen,
}: {
	block: DomainScheduleBlock;
	preview: ResizePreview | null;
	onResizePointerDown: (
		block: DomainScheduleBlock,
		edge: "start" | "end",
		event: ReactPointerEvent<HTMLButtonElement>,
	) => void;
	onOpen: (blockId: number) => void;
}) {
	const t = useTranslations("PlanDnia");
	const { attributes, listeners, setNodeRef, transform, isDragging } =
		useDraggable({
			id: String(block.id),
			data: {
				blockId: block.id,
				startMinute: block.startMinute,
				durationMinutes: block.durationMinutes,
			} satisfies BlockDragData,
		});

	const startMinute =
		preview?.blockId === block.id ? preview.startMinute : block.startMinute;
	const durationMinutes =
		preview?.blockId === block.id
			? preview.durationMinutes
			: block.durationMinutes;
	const title =
		block.metaLabel ??
		block.focusTask?.title ??
		t(BLOCK_TYPE_I18N[block.blockType]);
	const timeRange = `${formatAxisTime(startMinute)}–${formatAxisTime(startMinute + durationMinutes)}`;

	return (
		<li
			aria-label={`${title}, ${timeRange}`}
			className={`pointer-events-auto absolute right-0 left-0 touch-none overflow-hidden rounded-lg ${BLOCK_TYPE_CLASS[block.blockType]} ${
				isDragging ? "z-10 shadow-sm" : ""
			}`}
			data-schedule-block=""
			data-testid={`schedule-block-${block.id}`}
			ref={setNodeRef}
			style={{
				top: (startMinute - AXIS_START_MINUTE) * PIXELS_PER_MINUTE,
				height: durationMinutes * PIXELS_PER_MINUTE,
				transform: CSS.Translate.toString(
					transform ? { ...transform, x: 0 } : null,
				),
			}}
		>
			<button
				aria-label={t("resizeStartAria")}
				className="absolute inset-x-0 top-0 z-10 h-1.5 cursor-ns-resize"
				onPointerDown={(event) => onResizePointerDown(block, "start", event)}
				type="button"
			/>
			<button
				className="flex h-full w-full cursor-grab flex-col justify-center px-3 py-0.5 text-left active:cursor-grabbing"
				onClick={() => onOpen(block.id)}
				type="button"
				{...listeners}
				{...attributes}
			>
				<p className="truncate font-medium text-xs">{title}</p>
				{durationMinutes >= 30 ? (
					<p className="truncate text-[0.65rem] opacity-80">{timeRange}</p>
				) : null}
			</button>
			<button
				aria-label={t("resizeEndAria")}
				className="absolute inset-x-0 bottom-0 z-10 h-1.5 cursor-ns-resize"
				onPointerDown={(event) => onResizePointerDown(block, "end", event)}
				type="button"
			/>
		</li>
	);
}

export function DayScheduleTimeline({
	blocks,
	tasks = [],
	contextTags = [],
	isLoading = false,
	error = null,
	createBlock,
	updateBlock,
	deleteBlock,
	setBlockFocusTask,
	setBlockBatchTasks,
	createContextTag,
}: DayScheduleTimelineProps) {
	const t = useTranslations("PlanDnia");
	const axisRef = useRef<HTMLButtonElement>(null);
	const dragMovedRef = useRef(false);
	const resizedRef = useRef(false);
	const resizeSessionRef = useRef<ResizeSession | null>(null);
	const resizePreviewRef = useRef<ResizePreview | null>(null);
	const [resizePreview, setResizePreview] = useState<ResizePreview | null>(
		null,
	);
	const [localError, setLocalError] = useState<string | null>(null);
	const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null);
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: { distance: 8 },
		}),
	);

	const displayedError = error ?? localError;

	const reportMutationError = useCallback(
		(err: unknown) => {
			setLocalError(
				isTrpcErrorCode(err, "CONFLICT")
					? t("overlapError")
					: t("scheduleSaveError"),
			);
		},
		[t],
	);

	const runCreate = useCallback(
		async (input: CreateBlockInput) => {
			setLocalError(null);
			try {
				await createBlock(input);
			} catch (err) {
				reportMutationError(err);
			}
		},
		[createBlock, reportMutationError],
	);

	const runUpdate = useCallback(
		async (input: UpdateBlockInput) => {
			setLocalError(null);
			try {
				await updateBlock(input);
			} catch (err) {
				reportMutationError(err);
			}
		},
		[reportMutationError, updateBlock],
	);

	const handleAddBlock = useCallback(() => {
		const startMinute =
			findOpenSlot(blocks, DEFAULT_BLOCK_DURATION_MINUTES) ?? AXIS_START_MINUTE;
		void runCreate({
			blockType: "FOCUS",
			startMinute,
			durationMinutes: DEFAULT_BLOCK_DURATION_MINUTES,
		});
	}, [blocks, runCreate]);

	const handleAxisDoubleClick = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>) => {
			if (dragMovedRef.current || resizedRef.current) {
				return;
			}
			if (
				event.target instanceof Element &&
				event.target.closest("[data-schedule-block]")
			) {
				return;
			}
			const axisTop =
				axisRef.current?.getBoundingClientRect().top ??
				event.currentTarget.getBoundingClientRect().top;
			const snapped = snapBlock(
				minuteFromAxisY(event.clientY, axisTop),
				DEFAULT_BLOCK_DURATION_MINUTES,
			);
			if (blocks.some((block) => intervalsOverlap(block, snapped))) {
				setLocalError(t("overlapError"));
				return;
			}
			void runCreate({
				blockType: "FOCUS",
				startMinute: snapped.startMinute,
				durationMinutes: snapped.durationMinutes,
			});
		},
		[blocks, runCreate, t],
	);

	const handleDragEnd = useCallback(
		(event: DragEndEvent) => {
			const data = event.active.data.current as BlockDragData | undefined;
			if (data == null) {
				dragMovedRef.current = false;
				return;
			}
			if (Math.abs(event.delta.y) >= 2) {
				dragMovedRef.current = true;
			}
			const next = snapBlock(
				data.startMinute + event.delta.y / PIXELS_PER_MINUTE,
				data.durationMinutes,
			);
			if (
				next.startMinute !== data.startMinute ||
				next.durationMinutes !== data.durationMinutes
			) {
				void runUpdate({
					blockId: data.blockId,
					startMinute: next.startMinute,
					durationMinutes: next.durationMinutes,
				});
			}
			window.setTimeout(() => {
				dragMovedRef.current = false;
			}, 0);
		},
		[runUpdate],
	);

	const publishResizePreview = useCallback((next: ResizePreview | null) => {
		resizePreviewRef.current = next;
		setResizePreview(next);
	}, []);

	const handleResizePointerDown = useCallback(
		(
			block: DomainScheduleBlock,
			edge: "start" | "end",
			event: ReactPointerEvent<HTMLButtonElement>,
		) => {
			event.stopPropagation();
			event.preventDefault();
			event.currentTarget.setPointerCapture(event.pointerId);
			resizedRef.current = false;
			resizeSessionRef.current = {
				blockId: block.id,
				edge,
				originY: event.clientY,
				startMinute: block.startMinute,
				durationMinutes: block.durationMinutes,
			};
		},
		[],
	);

	const handleResizePointerMove = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			const session = resizeSessionRef.current;
			if (session == null) {
				return;
			}
			const deltaMinutes =
				(event.clientY - session.originY) / PIXELS_PER_MINUTE;
			if (Math.abs(deltaMinutes) >= 1) {
				resizedRef.current = true;
			}
			if (session.edge === "end") {
				publishResizePreview({
					blockId: session.blockId,
					...snapBlock(
						session.startMinute,
						session.durationMinutes + deltaMinutes,
					),
				});
				return;
			}
			const endMinute = session.startMinute + session.durationMinutes;
			const nextStart = snapMinute(session.startMinute + deltaMinutes);
			const duration = Math.max(SNAP_MINUTES, endMinute - nextStart);
			publishResizePreview({
				blockId: session.blockId,
				...snapBlock(nextStart, duration),
			});
		},
		[publishResizePreview],
	);

	const handleResizePointerUp = useCallback(() => {
		const session = resizeSessionRef.current;
		const preview = resizePreviewRef.current;
		resizeSessionRef.current = null;
		publishResizePreview(null);
		window.setTimeout(() => {
			resizedRef.current = false;
		}, 0);
		if (
			session == null ||
			preview == null ||
			preview.blockId !== session.blockId
		) {
			return;
		}
		if (
			preview.startMinute === session.startMinute &&
			preview.durationMinutes === session.durationMinutes
		) {
			return;
		}
		void runUpdate({
			blockId: session.blockId,
			startMinute: preview.startMinute,
			durationMinutes: preview.durationMinutes,
		});
	}, [publishResizePreview, runUpdate]);

	if (isLoading) {
		return <TimelineSkeleton />;
	}

	const selectedBlock =
		selectedBlockId == null
			? null
			: (blocks.find((block) => block.id === selectedBlockId) ?? null);
	const canEdit =
		deleteBlock != null &&
		setBlockFocusTask != null &&
		setBlockBatchTasks != null &&
		createContextTag != null;

	return (
		<>
			<section
				aria-label={t("timelineAria")}
				className="w-full rounded-card border border-card-border bg-surface-card px-5 py-4 shadow-sm"
				data-testid="schedule-timeline"
			>
				<div className="mb-3 flex items-center justify-end">
					<button
						className="rounded-lg border border-border-subtle px-3 py-1.5 text-sm text-text-secondary transition hover:bg-surface-card-muted"
						data-testid="schedule-add-block"
						onClick={handleAddBlock}
						type="button"
					>
						{t("addBlock")}
					</button>
				</div>
				{displayedError != null ? (
					<p className="mb-3 text-red-300 text-xs" role="alert">
						{displayedError}
					</p>
				) : null}
				<div
					className="max-h-[32rem] overflow-y-auto"
					onPointerMove={handleResizePointerMove}
					onPointerUp={handleResizePointerUp}
				>
					<DndContext
						modifiers={[restrictMoveToAxis]}
						onDragEnd={handleDragEnd}
						sensors={sensors}
					>
						<div className="relative ml-12 min-h-[22rem] select-none">
							{AXIS_HOURS.map((hour) => (
								<div
									className="flex items-start border-border-subtle/60 border-t first:border-t-0"
									key={hour}
									style={{ height: SCHEDULE_HOUR_HEIGHT_PX }}
								>
									<span className="-ml-12 w-10 shrink-0 text-right text-text-dimmed text-xs">
										{formatHourLabel(hour)}
									</span>
								</div>
							))}
							<div className="flex items-start border-border-subtle/60 border-t">
								<span className="-ml-12 w-10 shrink-0 text-right text-text-dimmed text-xs">
									{formatHourLabel(22)}
								</span>
							</div>
							<button
								aria-label={t("addBlockDoubleClickAria")}
								className="absolute inset-x-0 top-0"
								data-testid="schedule-timeline-axis"
								onDoubleClick={handleAxisDoubleClick}
								ref={axisRef}
								style={{ height: AXIS_HEIGHT_PX }}
								type="button"
							/>
							<ul
								className="pointer-events-none absolute inset-x-0 top-0 m-0 list-none p-0"
								style={{ height: AXIS_HEIGHT_PX }}
							>
								{blocks.map((block) => (
									<ScheduleBlockChip
										block={block}
										key={block.id}
										onOpen={(blockId) => {
											if (canEdit && blockId >= 0) {
												setSelectedBlockId(blockId);
											}
										}}
										onResizePointerDown={handleResizePointerDown}
										preview={resizePreview}
									/>
								))}
							</ul>
						</div>
					</DndContext>
				</div>
			</section>
			{selectedBlock != null &&
			deleteBlock != null &&
			setBlockFocusTask != null &&
			setBlockBatchTasks != null &&
			createContextTag != null ? (
				<ScheduleBlockEditPanel
					block={selectedBlock}
					contextTags={contextTags}
					createContextTag={createContextTag}
					deleteBlock={deleteBlock}
					onClose={() => setSelectedBlockId(null)}
					setBlockBatchTasks={setBlockBatchTasks}
					setBlockFocusTask={setBlockFocusTask}
					tasks={tasks}
					updateBlock={updateBlock}
				/>
			) : null}
		</>
	);
}
