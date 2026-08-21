"use client";

import { useTranslations } from "next-intl";
import {
	type MouseEvent as ReactMouseEvent,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

import type {
	DomainScheduleBlock,
	ScheduleBlockType,
} from "~/lib/schedule/types";

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

const BLOCK_TYPE_CLASS: Record<ScheduleBlockType, string> = {
	FOCUS: "bg-worktype-deep-bg text-worktype-deep-text",
	MEETING: "bg-worktype-ops-bg text-worktype-ops-text",
	BREAK: "bg-surface-break text-accent-break",
	PERSONAL: "bg-energy-fading-bg text-energy-fading",
	PLANNING: "bg-energy-steady-bg text-energy-steady",
	BATCH: "bg-worktype-reactive-bg text-worktype-reactive-text",
};

const MENU_BLOCK_TYPES: ScheduleBlockType[] = [
	"FOCUS",
	"MEETING",
	"BREAK",
	"PERSONAL",
	"PLANNING",
	"BATCH",
];

export type ScheduleBlockContextMenuState = {
	blockId: number;
	clientX: number;
	clientY: number;
};

type ScheduleBlockContextMenuProps = {
	block: DomainScheduleBlock;
	position: { x: number; y: number };
	onClose: () => void;
	onEdit: () => void;
	onDelete: () => Promise<void>;
	onChangeType: (blockType: ScheduleBlockType) => Promise<void>;
};

export function openScheduleBlockContextMenu(
	event: ReactMouseEvent,
	blockId: number,
	canOpen: boolean,
	onOpen: (state: ScheduleBlockContextMenuState) => void,
): void {
	if (!canOpen || blockId < 0) {
		return;
	}
	event.preventDefault();
	event.stopPropagation();
	onOpen({
		blockId,
		clientX: event.clientX,
		clientY: event.clientY,
	});
}

export function ScheduleBlockContextMenu({
	block,
	position,
	onClose,
	onEdit,
	onDelete,
	onChangeType,
}: ScheduleBlockContextMenuProps) {
	const t = useTranslations("PlanDnia");
	const menuRef = useRef<HTMLDivElement>(null);
	const [clampedPosition, setClampedPosition] = useState(position);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [isBusy, setIsBusy] = useState(false);

	useLayoutEffect(() => {
		const menu = menuRef.current;
		if (menu == null) {
			return;
		}
		const rect = menu.getBoundingClientRect();
		const margin = 8;
		let x = position.x;
		let y = position.y;
		if (x + rect.width > window.innerWidth - margin) {
			x = Math.max(margin, window.innerWidth - rect.width - margin);
		}
		if (y + rect.height > window.innerHeight - margin) {
			y = Math.max(margin, window.innerHeight - rect.height - margin);
		}
		setClampedPosition({ x, y });
	}, [position.x, position.y]);

	useEffect(() => {
		const onPointerDown = (event: PointerEvent) => {
			if (
				menuRef.current != null &&
				!menuRef.current.contains(event.target as Node)
			) {
				onClose();
			}
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onClose();
			}
		};
		const onScroll = () => {
			onClose();
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		window.addEventListener("scroll", onScroll, true);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("scroll", onScroll, true);
		};
	}, [onClose]);

	const menuItemClass =
		"flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-primary transition hover:bg-surface-card-muted disabled:cursor-not-allowed disabled:opacity-40";

	async function handleDeleteClick() {
		if (!confirmDelete) {
			setConfirmDelete(true);
			return;
		}
		setIsBusy(true);
		try {
			await onDelete();
			onClose();
		} finally {
			setIsBusy(false);
		}
	}

	return (
		<div
			className="fixed z-50 min-w-[12rem] rounded-xl border border-card-border bg-surface-card p-1 shadow-md"
			data-testid="schedule-block-context-menu"
			ref={menuRef}
			role="menu"
			style={{ left: clampedPosition.x, top: clampedPosition.y }}
		>
			<button
				className={menuItemClass}
				data-testid="schedule-context-edit"
				disabled={isBusy}
				onClick={() => {
					onEdit();
					onClose();
				}}
				role="menuitem"
				type="button"
			>
				{t("editBlock")}
			</button>
			<div aria-hidden="true" className="my-1 border-border-subtle border-t" />
			<p className="px-2.5 py-1 font-medium text-text-dimmed text-xs">
				{t("blockTypeLabel")}
			</p>
			{MENU_BLOCK_TYPES.map((type) => {
				const isCurrent = block.blockType === type;
				return (
					<button
						aria-checked={isCurrent}
						className={`${menuItemClass} ${isCurrent ? "bg-surface-card-muted" : ""}`}
						data-testid={`schedule-context-type-${type.toLowerCase()}`}
						disabled={isBusy || isCurrent}
						key={type}
						onClick={() => {
							void onChangeType(type).finally(onClose);
						}}
						role="menuitemradio"
						type="button"
					>
						<span
							className={`inline-block h-2 w-2 shrink-0 rounded-full ${BLOCK_TYPE_CLASS[type]}`}
						/>
						<span className="text-xs">{t(BLOCK_TYPE_I18N[type])}</span>
						{isCurrent ? (
							<span className="ml-auto text-text-dimmed text-xs">✓</span>
						) : null}
					</button>
				);
			})}
			<div aria-hidden="true" className="my-1 border-border-subtle border-t" />
			<button
				className={`${menuItemClass} ${
					confirmDelete ? "text-red-300 hover:bg-red-950/20" : ""
				}`}
				data-testid="schedule-context-delete"
				disabled={isBusy}
				onClick={() => void handleDeleteClick()}
				role="menuitem"
				type="button"
			>
				{confirmDelete ? t("confirmDeleteBlock") : t("deleteBlock")}
			</button>
		</div>
	);
}
