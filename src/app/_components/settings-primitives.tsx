import type { ReactNode } from "react";

type SettingsPanelProps = {
	title: string;
	titleId: string;
	children: ReactNode;
	testId?: string;
	className?: string;
};

export function SettingsPanel({
	title,
	titleId,
	children,
	testId,
	className = "",
}: SettingsPanelProps) {
	return (
		<section
			aria-labelledby={titleId}
			className={`rounded-card border border-card-border bg-surface-card p-6 shadow-sm${className ? ` ${className}` : ""}`}
			data-testid={testId}
		>
			<h2 className="mb-5 font-semibold text-lg text-primary" id={titleId}>
				{title}
			</h2>
			<div className="divide-y divide-border-subtle">{children}</div>
		</section>
	);
}

type SettingsRowProps = {
	label: string;
	description?: string;
	children: ReactNode;
	className?: string;
};

export function SettingsRow({
	label,
	description,
	children,
	className = "",
}: SettingsRowProps) {
	return (
		<div
			className={`flex flex-col gap-3 py-5 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-8${className ? ` ${className}` : ""}`}
		>
			<div className="min-w-0 shrink-0 sm:w-40">
				<p className="font-medium text-primary text-sm">{label}</p>
				{description != null && (
					<p className="mt-0.5 text-text-dimmed text-xs">{description}</p>
				)}
			</div>
			<div className="min-w-0 flex-1 sm:max-w-md sm:self-center">
				{children}
			</div>
		</div>
	);
}
