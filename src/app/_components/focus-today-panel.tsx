"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

import { FocusTip } from "~/app/_components/focus-tip";
import { HomeFocusSummary } from "~/app/_components/home-focus-summary";
import { QuickActions } from "~/app/_components/quick-actions";

type FocusTodayPanelSummaryProps = {
	hasBudget: boolean;
	isLoading: boolean;
	budgetMinutes: number | null;
	remainingMinutes: number | null;
	usedMinutes: number;
	sessionsCompleted?: number;
	tasksDone?: number;
	tasksTotal?: number;
	forceShow?: boolean;
};

type FocusTodayPanelProps = {
	summary: FocusTodayPanelSummaryProps;
	onAddTask?: () => void;
	onStartBreak?: (
		kind: "SHORT_BREAK" | "LONG_BREAK",
		durationSec: number,
	) => Promise<void>;
};

function FocusTodaySection({
	title,
	testId,
	defaultOpen = true,
	children,
}: {
	title: string;
	testId: string;
	defaultOpen?: boolean;
	children: ReactNode;
}) {
	const [open, setOpen] = useState(defaultOpen);
	const sectionId = `${testId}-content`;

	return (
		<div className="border-border-subtle border-t first:border-t-0">
			<button
				aria-controls={sectionId}
				aria-expanded={open}
				className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left transition hover:bg-surface-card-muted/50"
				onClick={() => setOpen((value) => !value)}
				type="button"
			>
				<span className="font-medium text-sm text-text-secondary">{title}</span>
				<ChevronDown
					aria-hidden="true"
					className={`h-4 w-4 shrink-0 text-text-dimmed transition-transform ${open ? "rotate-180" : ""}`}
				/>
			</button>
			{open ? (
				<div className="px-5 pb-5" data-testid={testId} id={sectionId}>
					{children}
				</div>
			) : (
				<div className="hidden" data-testid={testId} id={sectionId}>
					{children}
				</div>
			)}
		</div>
	);
}

export function FocusTodayPanel({
	summary,
	onAddTask,
	onStartBreak,
}: FocusTodayPanelProps) {
	const tPanel = useTranslations("FocusTodayPanel");
	const tSummary = useTranslations("HomeFocusSummary");
	const tTip = useTranslations("FocusTip");
	const tActions = useTranslations("QuickActions");

	return (
		<section
			className="w-full rounded-card border border-card-border bg-surface-card shadow-sm"
			data-testid="focus-today-panel"
		>
			<div className="px-5 py-4">
				<h2 className="font-semibold text-primary text-sm">
					{tPanel("heading")}
				</h2>
			</div>

			<FocusTodaySection
				defaultOpen
				testId="home-focus-summary"
				title={tSummary("heading")}
			>
				<HomeFocusSummary {...summary} variant="embedded" />
			</FocusTodaySection>

			<FocusTodaySection
				defaultOpen={false}
				testId="focus-tip"
				title={tTip("heading")}
			>
				<FocusTip variant="embedded" />
			</FocusTodaySection>

			<FocusTodaySection
				defaultOpen
				testId="quick-actions"
				title={tActions("heading")}
			>
				<QuickActions
					onAddTask={onAddTask}
					onStartBreak={onStartBreak}
					variant="embedded"
				/>
			</FocusTodaySection>
		</section>
	);
}
