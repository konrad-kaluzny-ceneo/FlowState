"use client";

import {
	DndContext,
	type DragEndEvent,
	type DragMoveEvent,
	type DragStartEvent,
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
	useEffect,
	useRef,
	useState,
} from "react";

import { ScheduleBlockEditPanel } from "~/app/_components/schedule-block-edit-panel";
import type { DomainTask } from "~/lib/data-mode/types";
import {
	findNearestOpenSlot,
	findOpenSlot,
	wouldOverlap,
} from "~/lib/schedule/overlap";
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
export const MIN_CHIP_HEIGHT_PX = 22;

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

const LEGEND_TYPES: ScheduleBlockType[] = [
	"FOCUS",
	"MEETING",
	"BREAK",
	"PERSONAL",
	"PLANNING",
	"BATCH",
];

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
	focusTaskId?: number | null;
	batchTaskIds?: number[];
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
	createContextTag?: (label: string) => Promise<DomainContextTag>;
};

type BlockDragData = {
	blockId: number;
	startMinute: number;
	durationMinutes: number;
};

type InteractionPreview = {
	blockId: number;
	startMinute: number;
	durationMinutes: number;
	mode: "drag" | "resize";
	isValid: boolean;
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

function minuteFromAxisY(clientY: number, axisTop: number): number {
	return AXIS_START_MINUTE + (clientY - axisTop) / PIXELS_PER_MINUTE;
}

/** Keep drag on the Y axis only — X is always 0. */
const restrictMoveToAxis: Modifier = ({ transform }) => ({
	...transform,
	x: 0,
});

function localDateKeyToday(): string {
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, "0");
	const d = String(now.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function nowMinuteOfDay(): number {
	const now = new Date();
	return now.getHours() * 60 + now.getMinutes();
}

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
	preview: InteractionPreview | null;
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

	const activePreview = preview?.blockId === block.id ? preview : null;
	// Labels always follow preview (live hours). Layout: during drag keep the
	// committed top + dnd-kit transform so the chip tracks the cursor; after
	// drop / during resize use preview top so there is no snap-back jump.
	const labelStart = activePreview?.startMinute ?? block.startMinute;
	const labelDuration = activePreview?.durationMinutes ?? block.durationMinutes;
	const layoutFromPreview =
		activePreview != null && (activePreview.mode === "resize" || !isDragging);
	const layoutStart = layoutFromPreview
		? activePreview.startMinute
		: block.startMinute;
	const layoutDuration = layoutFromPreview
		? activePreview.durationMinutes
		: block.durationMinutes;
	const isInvalid = activePreview != null && !activePreview.isValid;
	const title =
		block.metaLabel ??
		block.focusTask?.title ??
		t(BLOCK_TYPE_I18N[block.blockType]);
	const timeRange = `${formatAxisTime(labelStart)}–${formatAxisTime(labelStart + labelDuration)}`;
	const compact = labelDuration < 30;
	const chipHeight = Math.max(
		layoutDuration * PIXELS_PER_MINUTE,
		MIN_CHIP_HEIGHT_PX,
	);

	return (
		<li
			aria-label={`${title}, ${timeRange}`}
			className={`pointer-events-auto absolute right-0 left-0 touch-none overflow-hidden rounded-lg ${BLOCK_TYPE_CLASS[block.blockType]} ${
				isDragging || activePreview != null ? "z-10 shadow-sm" : ""
			} ${isInvalid ? "opacity-70 ring-2 ring-red-400" : ""}`}
			data-schedule-block=""
			data-testid={`schedule-block-${block.id}`}
			ref={setNodeRef}
			style={{
				top: (layoutStart - AXIS_START_MINUTE) * PIXELS_PER_MINUTE,
				height: chipHeight,
				transform: CSS.Translate.toString(
					isDragging && transform != null ? { ...transform, x: 0 } : null,
				),
			}}
			title={`${title} · ${timeRange}`}
		>
			<button
				aria-label={t("resizeStartAria")}
				className="absolute inset-x-0 top-0 z-10 h-3 cursor-ns-resize after:absolute after:inset-x-2 after:top-1 after:h-0.5 after:rounded-full after:bg-current after:opacity-0 after:transition-opacity hover:after:opacity-40 focus-visible:after:opacity-40"
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
				{compact ? (
					<p className="truncate font-medium text-[0.65rem] leading-tight">
						{title} · {formatAxisTime(labelStart)}
					</p>
				) : (
					<>
						<p className="truncate font-medium text-xs">{title}</p>
						<p className="truncate text-[0.65rem] opacity-80">{timeRange}</p>
					</>
				)}
			</button>
			<button
				aria-label={t("resizeEndAria")}
				className="absolute inset-x-0 bottom-0 z-10 h-3 cursor-ns-resize after:absolute after:inset-x-2 after:bottom-1 after:h-0.5 after:rounded-full after:bg-current after:opacity-0 after:transition-opacity hover:after:opacity-40 focus-visible:after:opacity-40"
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
	localDateKey,
	isLoading = false,
	error = null,
	createBlock,
	updateBlock,
	deleteBlock,
	createContextTag,
}: DayScheduleTimelineProps) {
	const t = useTranslations("PlanDnia");
	const axisRef = useRef<HTMLButtonElement>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const dragMovedRef = useRef(false);
	const resizedRef = useRef(false);
	const resizeSessionRef = useRef<ResizeSession | null>(null);
	const previewRef = useRef<InteractionPreview | null>(null);
	const [interactionPreview, setInteractionPreview] =
		useState<InteractionPreview | null>(null);
	const [localError, setLocalError] = useState<string | null>(null);
	const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null);
	const [legendOpen, setLegendOpen] = useState(false);
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: { distance: 8 },
		}),
	);

	const displayedError = error ?? localError;
	const isToday = localDateKey === localDateKeyToday();
	const nowMinute = isToday ? nowMinuteOfDay() : null;

	const publishPreview = useCallback((next: InteractionPreview | null) => {
		previewRef.current = next;
		setInteractionPreview(next);
	}, []);

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

	const preferredAddStart = useCallback(() => {
		const viewportCenter =
			scrollRef.current != null && axisRef.current != null
				? minuteFromAxisY(
						scrollRef.current.getBoundingClientRect().top +
							scrollRef.current.clientHeight / 2,
						axisRef.current.getBoundingClientRect().top,
					)
				: AXIS_START_MINUTE + 180;
		const preferred =
			nowMinute != null ? Math.max(nowMinute, viewportCenter) : viewportCenter;
		return Math.min(
			AXIS_END_MINUTE - DEFAULT_BLOCK_DURATION_MINUTES,
			Math.max(AXIS_START_MINUTE, preferred),
		);
	}, [nowMinute]);

	const scrollBlockIntoView = useCallback((startMinute: number) => {
		const scroller = scrollRef.current;
		if (scroller == null || typeof scroller.scrollTo !== "function") {
			return;
		}
		const top = (startMinute - AXIS_START_MINUTE) * PIXELS_PER_MINUTE - 48;
		scroller.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
	}, []);

	const handleAddBlock = useCallback(() => {
		const preferred = preferredAddStart();
		const startMinute =
			findOpenSlot(blocks, DEFAULT_BLOCK_DURATION_MINUTES, preferred) ??
			AXIS_START_MINUTE;
		void runCreate({
			blockType: "FOCUS",
			startMinute,
			durationMinutes: DEFAULT_BLOCK_DURATION_MINUTES,
		});
		scrollBlockIntoView(startMinute);
	}, [blocks, preferredAddStart, runCreate, scrollBlockIntoView]);

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
			if (wouldOverlap(snapped, blocks)) {
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

	const handleDragStart = useCallback(
		(event: DragStartEvent) => {
			const data = event.active.data.current as BlockDragData | undefined;
			if (data == null) {
				return;
			}
			dragMovedRef.current = false;
			publishPreview({
				blockId: data.blockId,
				startMinute: data.startMinute,
				durationMinutes: data.durationMinutes,
				mode: "drag",
				isValid: true,
			});
		},
		[publishPreview],
	);

	const handleDragMove = useCallback(
		(event: DragMoveEvent) => {
			const data = event.active.data.current as BlockDragData | undefined;
			if (data == null) {
				return;
			}
			if (Math.abs(event.delta.y) >= 2) {
				dragMovedRef.current = true;
			}
			const next = snapBlock(
				data.startMinute + event.delta.y / PIXELS_PER_MINUTE,
				data.durationMinutes,
			);
			const isValid = !wouldOverlap(next, blocks, data.blockId);
			publishPreview({
				blockId: data.blockId,
				startMinute: next.startMinute,
				durationMinutes: next.durationMinutes,
				mode: "drag",
				isValid,
			});
		},
		[blocks, publishPreview],
	);

	const handleDragEnd = useCallback(
		(event: DragEndEvent) => {
			const data = event.active.data.current as BlockDragData | undefined;
			const preview = previewRef.current;
			window.setTimeout(() => {
				dragMovedRef.current = false;
			}, 0);
			if (data == null) {
				publishPreview(null);
				return;
			}
			const next =
				preview?.blockId === data.blockId
					? {
							startMinute: preview.startMinute,
							durationMinutes: preview.durationMinutes,
						}
					: snapBlock(
							data.startMinute + event.delta.y / PIXELS_PER_MINUTE,
							data.durationMinutes,
						);

			let target = next;
			if (wouldOverlap(target, blocks, data.blockId)) {
				const snapped = findNearestOpenSlot(
					blocks,
					target.durationMinutes,
					target.startMinute,
					data.blockId,
				);
				if (snapped == null) {
					publishPreview(null);
					setLocalError(t("overlapError"));
					return;
				}
				target = {
					startMinute: snapped,
					durationMinutes: target.durationMinutes,
				};
			}

			// Hold final layout via preview while transform clears — avoids jump.
			publishPreview({
				blockId: data.blockId,
				startMinute: target.startMinute,
				durationMinutes: target.durationMinutes,
				mode: "drag",
				isValid: true,
			});

			if (
				target.startMinute !== data.startMinute ||
				target.durationMinutes !== data.durationMinutes
			) {
				void runUpdate({
					blockId: data.blockId,
					startMinute: target.startMinute,
					durationMinutes: target.durationMinutes,
				}).finally(() => {
					if (previewRef.current?.blockId === data.blockId) {
						publishPreview(null);
					}
				});
				return;
			}
			publishPreview(null);
		},
		[blocks, publishPreview, runUpdate, t],
	);

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
			publishPreview({
				blockId: block.id,
				startMinute: block.startMinute,
				durationMinutes: block.durationMinutes,
				mode: "resize",
				isValid: true,
			});
		},
		[publishPreview],
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
			let next: { startMinute: number; durationMinutes: number };
			if (session.edge === "end") {
				next = snapBlock(
					session.startMinute,
					session.durationMinutes + deltaMinutes,
				);
			} else {
				const endMinute = session.startMinute + session.durationMinutes;
				const nextStart = snapMinute(session.startMinute + deltaMinutes);
				const duration = Math.max(SNAP_MINUTES, endMinute - nextStart);
				next = snapBlock(nextStart, duration);
			}
			const isValid = !wouldOverlap(next, blocks, session.blockId);
			publishPreview({
				blockId: session.blockId,
				startMinute: next.startMinute,
				durationMinutes: next.durationMinutes,
				mode: "resize",
				isValid,
			});
		},
		[blocks, publishPreview],
	);

	const handleResizePointerUp = useCallback(() => {
		const session = resizeSessionRef.current;
		const preview = previewRef.current;
		resizeSessionRef.current = null;
		publishPreview(null);
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
		let target = {
			startMinute: preview.startMinute,
			durationMinutes: preview.durationMinutes,
		};
		if (wouldOverlap(target, blocks, session.blockId)) {
			const snapped = findNearestOpenSlot(
				blocks,
				target.durationMinutes,
				target.startMinute,
				session.blockId,
			);
			if (snapped == null) {
				setLocalError(t("overlapError"));
				return;
			}
			target = {
				startMinute: snapped,
				durationMinutes: target.durationMinutes,
			};
		}
		if (
			target.startMinute === session.startMinute &&
			target.durationMinutes === session.durationMinutes
		) {
			return;
		}
		void runUpdate({
			blockId: session.blockId,
			startMinute: target.startMinute,
			durationMinutes: target.durationMinutes,
		});
	}, [blocks, publishPreview, runUpdate, t]);

	useEffect(() => {
		if (!isToday || nowMinute == null || isLoading) {
			return;
		}
		const clamped = Math.min(
			AXIS_END_MINUTE - 60,
			Math.max(AXIS_START_MINUTE, nowMinute - 60),
		);
		scrollBlockIntoView(clamped);
	}, [isLoading, isToday, nowMinute, scrollBlockIntoView]);

	if (isLoading) {
		return <TimelineSkeleton />;
	}

	const selectedBlock =
		selectedBlockId == null
			? null
			: (blocks.find((block) => block.id === selectedBlockId) ?? null);
	const canEdit = deleteBlock != null && createContextTag != null;
	const showNowLine =
		nowMinute != null &&
		nowMinute >= AXIS_START_MINUTE &&
		nowMinute <= AXIS_END_MINUTE;

	return (
		<>
			<section
				aria-label={t("timelineAria")}
				className="w-full rounded-card border border-card-border bg-surface-card px-5 py-4 shadow-sm"
				data-testid="schedule-timeline"
			>
				<div className="mb-2 flex items-center justify-between gap-3">
					<p className="text-text-dimmed text-xs">{t("timelineHint")}</p>
					<button
						className="shrink-0 rounded-lg border border-border-subtle px-3 py-1.5 text-sm text-text-secondary transition hover:bg-surface-card-muted"
						data-testid="schedule-add-block"
						onClick={handleAddBlock}
						type="button"
					>
						{t("addBlock")}
					</button>
				</div>
				{blocks.length === 0 ? (
					<p
						className="mb-3 text-sm text-text-secondary"
						data-testid="schedule-timeline-empty"
					>
						{t("timelineEmpty")}
					</p>
				) : null}
				{displayedError != null ? (
					<p className="mb-3 text-red-300 text-xs" role="alert">
						{displayedError}
					</p>
				) : null}
				{interactionPreview != null && !interactionPreview.isValid ? (
					<p
						className="mb-2 text-red-300 text-xs"
						data-testid="schedule-overlap-inline"
						role="status"
					>
						{t("overlapInline")}
					</p>
				) : null}
				<div
					className="max-h-[32rem] overflow-y-auto"
					onPointerMove={handleResizePointerMove}
					onPointerUp={handleResizePointerUp}
					ref={scrollRef}
				>
					<DndContext
						modifiers={[restrictMoveToAxis]}
						onDragEnd={handleDragEnd}
						onDragMove={handleDragMove}
						onDragStart={handleDragStart}
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
							{showNowLine && nowMinute != null ? (
								<div
									aria-hidden="true"
									className="pointer-events-none absolute right-0 left-0 z-[5] border-accent-cta border-t border-dashed"
									data-testid="schedule-now-line"
									style={{
										top: (nowMinute - AXIS_START_MINUTE) * PIXELS_PER_MINUTE,
									}}
								>
									<span className="absolute top-[-0.55rem] left-0 -ml-12 w-10 text-right font-medium text-[0.65rem] text-accent-cta">
										{t("timelineNow")}
									</span>
								</div>
							) : null}
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
											if (dragMovedRef.current || resizedRef.current) {
												return;
											}
											if (canEdit && blockId >= 0) {
												setSelectedBlockId(blockId);
											}
										}}
										onResizePointerDown={handleResizePointerDown}
										preview={interactionPreview}
									/>
								))}
							</ul>
						</div>
					</DndContext>
				</div>
				<div className="mt-3 border-border-subtle border-t pt-3">
					<button
						className="text-text-dimmed text-xs hover:text-text-secondary"
						data-testid="schedule-legend-toggle"
						onClick={() => setLegendOpen((open) => !open)}
						type="button"
					>
						{legendOpen ? t("legendHide") : t("legendShow")}
					</button>
					{legendOpen ? (
						<ul
							className="mt-2 flex flex-wrap gap-2"
							data-testid="schedule-legend"
						>
							{LEGEND_TYPES.map((type) => (
								<li
									className={`rounded-md px-2 py-0.5 text-[0.65rem] ${BLOCK_TYPE_CLASS[type]}`}
									key={type}
								>
									{t(BLOCK_TYPE_I18N[type])}
								</li>
							))}
						</ul>
					) : null}
				</div>
			</section>
			{selectedBlock != null &&
			deleteBlock != null &&
			createContextTag != null ? (
				<ScheduleBlockEditPanel
					block={selectedBlock}
					contextTags={contextTags}
					createContextTag={createContextTag}
					deleteBlock={deleteBlock}
					onClose={() => setSelectedBlockId(null)}
					tasks={tasks}
					updateBlock={updateBlock}
				/>
			) : null}
		</>
	);
}
