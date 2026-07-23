"use client";

type WorkspaceSetupNudgeProps = {
	body: string;
	actionLabel: string;
	dismissLabel: string;
	onOpenWorkspace: () => void;
	onDismiss: () => void;
};

export function WorkspaceSetupNudge({
	body,
	actionLabel,
	dismissLabel,
	onOpenWorkspace,
	onDismiss,
}: WorkspaceSetupNudgeProps) {
	return (
		<aside
			aria-label={body}
			className="mb-6 flex flex-col gap-3 rounded-card border border-border-subtle bg-surface-card-muted/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
			data-testid="settings-workspace-nudge"
		>
			<p className="text-sm text-text-secondary leading-relaxed">{body}</p>
			<div className="flex shrink-0 flex-wrap items-center gap-2">
				<button
					className="rounded-control bg-accent-cta px-3 py-1.5 font-medium text-on-cta text-sm transition-opacity hover:opacity-90"
					data-testid="settings-workspace-nudge-action"
					onClick={onOpenWorkspace}
					type="button"
				>
					{actionLabel}
				</button>
				<button
					aria-label={dismissLabel}
					className="rounded-control border border-border-subtle bg-surface-card px-3 py-1.5 font-medium text-primary text-sm transition-colors hover:bg-surface-card-muted"
					data-testid="settings-workspace-nudge-dismiss"
					onClick={onDismiss}
					type="button"
				>
					{dismissLabel}
				</button>
			</div>
		</aside>
	);
}
