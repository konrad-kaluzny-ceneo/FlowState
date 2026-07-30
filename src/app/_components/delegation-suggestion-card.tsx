"use client";

import { useTranslations } from "next-intl";

const DELEGATION_HEADING_ID = "delegation-suggestion-heading";

type DelegationSuggestionCardProps =
	| {
			status: "loading";
			taskTitle?: never;
			rationale?: never;
			onAccept?: never;
			onSkip?: never;
			isAccepting?: never;
			isSkipping?: never;
	  }
	| {
			status: "ready";
			taskTitle: string;
			rationale: string;
			onAccept: () => void;
			onSkip: () => void;
			isAccepting?: boolean;
			isSkipping?: boolean;
	  }
	| {
			status: "empty";
			taskTitle?: never;
			rationale?: never;
			onAccept?: never;
			onSkip?: never;
			isAccepting?: never;
			isSkipping?: never;
	  };

export function DelegationSuggestionCard(props: DelegationSuggestionCardProps) {
	const t = useTranslations("Delegation");

	return (
		<div
			className="w-full rounded-card border border-card-border bg-surface-card px-5 py-4 shadow-sm"
			data-testid="delegation-suggestion-card"
		>
			<section aria-labelledby={DELEGATION_HEADING_ID}>
				<h2
					className="font-semibold text-lg text-primary"
					id={DELEGATION_HEADING_ID}
				>
					{t("heading")}
				</h2>

				{props.status === "loading" && (
					<p
						className="mt-2 text-sm text-text-dimmed"
						data-testid="delegation-loading"
					>
						{t("loading")}
					</p>
				)}

				{props.status === "empty" && (
					<p
						className="mt-2 text-sm text-text-secondary"
						data-testid="delegation-empty"
					>
						{t("empty")}
					</p>
				)}

				{props.status === "ready" && (
					<div className="mt-3 space-y-3">
						<div className="space-y-1">
							<p
								className="overflow-hidden whitespace-pre-wrap break-all font-medium text-primary"
								data-testid="delegation-task-title"
							>
								{props.taskTitle}
							</p>
							<p className="text-sm text-text-secondary">{props.rationale}</p>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<button
								className="rounded-lg bg-accent-cta px-3 py-1.5 font-medium text-on-cta text-sm transition hover:bg-accent-cta-hover disabled:opacity-50"
								data-testid="delegation-accept-btn"
								disabled={props.isAccepting}
								onClick={props.onAccept}
								type="button"
							>
								{props.isAccepting ? t("acceptPending") : t("acceptLabel")}
							</button>
							<button
								className="rounded-lg border border-border-subtle px-3 py-1.5 font-medium text-sm text-text-secondary transition hover:bg-surface-card-muted disabled:opacity-50"
								data-testid="delegation-skip-btn"
								disabled={props.isSkipping}
								onClick={props.onSkip}
								type="button"
							>
								{props.isSkipping ? t("skipPending") : t("skipLabel")}
							</button>
						</div>
					</div>
				)}
			</section>
		</div>
	);
}
