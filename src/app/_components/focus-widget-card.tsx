import type { ReactNode } from "react";

type FocusWidgetCardProps = {
	title: string;
	children: ReactNode;
	testId: string;
	icon?: ReactNode;
	className?: string;
};

export function FocusWidgetCard({
	title,
	children,
	testId,
	icon,
	className = "",
}: FocusWidgetCardProps) {
	return (
		<section
			className={`w-full rounded-card border border-card-border bg-surface-card p-5 shadow-sm${className ? ` ${className}` : ""}`}
			data-testid={testId}
		>
			<div className="mb-3 flex items-center gap-2">
				{icon}
				<h2 className="font-semibold text-primary text-sm">{title}</h2>
			</div>
			{children}
		</section>
	);
}
