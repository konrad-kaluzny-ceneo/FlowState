"use client";

import { useEffect, useState } from "react";

const WORK_TYPE_CONFIG = {
	DEEP_WORK: { label: "Deep", bg: "bg-blue-500/20", text: "text-blue-300" },
	OPERATIONAL: { label: "Ops", bg: "bg-amber-500/20", text: "text-amber-300" },
	REACTIVE: { label: "Reactive", bg: "bg-rose-500/20", text: "text-rose-300" },
} as const;

const WEIGHT_LABELS = { 1: "Light", 2: "Medium", 3: "Heavy" } as const;

export type TaskSuggestionData = {
	taskId: number;
	title: string;
	workType: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
	weight: 1 | 2 | 3;
	rationale: string;
};

type TaskSuggestionCardProps =
	| {
			status: "loading";
			onAccept?: never;
			onRetry?: never;
			isAccepting?: never;
	  }
	| {
			status: "ready";
			suggestion: TaskSuggestionData;
			onAccept: () => void;
			onRetry?: never;
			isAccepting?: boolean;
			coachLine?: string;
	  }
	| {
			status: "empty";
			onAccept?: never;
			onRetry?: never;
			isAccepting?: never;
	  }
	| {
			status: "error";
			onAccept?: never;
			onRetry: () => void;
			isAccepting?: never;
	  };

function TaskBadges({
	workType,
	weight,
}: {
	workType: TaskSuggestionData["workType"];
	weight: TaskSuggestionData["weight"];
}) {
	const config = WORK_TYPE_CONFIG[workType];
	return (
		<span className="flex shrink-0 items-center gap-1">
			<span
				className={`rounded-full px-2 py-0.5 font-medium text-xs ${config.bg} ${config.text}`}
			>
				{config.label}
			</span>
			<span className="rounded-full bg-white/10 px-2 py-0.5 font-medium text-white/70 text-xs">
				{WEIGHT_LABELS[weight]}
			</span>
		</span>
	);
}

export function TaskSuggestionCard(props: TaskSuggestionCardProps) {
	const [showSkeleton, setShowSkeleton] = useState(false);
	const [showSlowMessage, setShowSlowMessage] = useState(false);

	useEffect(() => {
		if (props.status !== "loading") {
			setShowSkeleton(false);
			setShowSlowMessage(false);
			return;
		}

		const skeletonTimer = setTimeout(() => setShowSkeleton(true), 300);
		const slowTimer = setTimeout(() => setShowSlowMessage(true), 1000);

		return () => {
			clearTimeout(skeletonTimer);
			clearTimeout(slowTimer);
		};
	}, [props.status]);

	return (
		<div
			className="w-full max-w-lg rounded-xl border border-white/20 bg-[#1a1a2e] p-6 shadow-xl"
			data-testid="task-suggestion-card"
		>
			<h2 className="font-bold text-lg text-white">Suggested next task</h2>
			{props.status === "ready" && props.coachLine != null && (
				<p
					className="mt-1 text-purple-200/70 text-xs"
					data-testid="suggestion-coach-line"
				>
					{props.coachLine}
				</p>
			)}

			{props.status === "loading" && (
				<div className="mt-4 space-y-3">
					{showSkeleton ? (
						<>
							<div className="h-5 w-3/4 animate-pulse rounded bg-white/10" />
							<div className="h-4 w-full animate-pulse rounded bg-white/10" />
							<div className="h-10 w-full animate-pulse rounded-lg bg-white/10" />
						</>
					) : (
						<p className="text-sm text-white/50">Finding a good match…</p>
					)}
					{showSlowMessage && (
						<p className="text-sm text-white/60">Still working on it…</p>
					)}
				</div>
			)}

			{props.status === "ready" && (
				<div className="mt-4 space-y-4">
					<div className="flex items-start justify-between gap-3">
						<p className="font-medium text-white">{props.suggestion.title}</p>
						<TaskBadges
							weight={props.suggestion.weight}
							workType={props.suggestion.workType}
						/>
					</div>
					<p className="text-sm text-white/60">{props.suggestion.rationale}</p>
					<button
						className="w-full rounded-lg bg-purple-600 py-3 font-semibold text-white transition hover:bg-purple-500 disabled:opacity-50"
						data-testid="suggestion-accept-btn"
						disabled={props.isAccepting}
						onClick={props.onAccept}
						type="button"
					>
						{props.isAccepting ? "Focusing…" : "Focus this"}
					</button>
				</div>
			)}

			{props.status === "empty" && (
				<p className="mt-4 text-sm text-white/60">
					No active tasks — add one or end session.
				</p>
			)}

			{props.status === "error" && (
				<div className="mt-4 space-y-3">
					<p className="text-red-200/80 text-sm">
						Could not load a suggestion. Your break is still running.
					</p>
					<button
						className="w-full rounded-lg border border-white/20 py-2 font-medium text-white transition hover:bg-white/10"
						onClick={props.onRetry}
						type="button"
					>
						Retry
					</button>
				</div>
			)}
		</div>
	);
}
