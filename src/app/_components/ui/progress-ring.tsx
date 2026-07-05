import type { ReactNode } from "react";

type ProgressRingProps = {
	progress: number;
	size?: number;
	strokeWidth?: number;
	trackClassName?: string;
	progressClassName?: string;
	children?: ReactNode;
};

export function ProgressRing({
	progress,
	size = 240,
	strokeWidth = 12,
	trackClassName = "stroke-border-subtle",
	progressClassName = "stroke-accent-cta",
	children,
}: ProgressRingProps) {
	const clampedProgress = Math.min(1, Math.max(0, progress));
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const dashOffset = circumference * (1 - clampedProgress);

	return (
		<div
			className="relative inline-flex items-center justify-center"
			style={{ height: size, width: size }}
		>
			<svg
				aria-hidden="true"
				className="-rotate-90 transform"
				height={size}
				width={size}
			>
				<circle
					className={trackClassName}
					cx={size / 2}
					cy={size / 2}
					fill="none"
					r={radius}
					stroke="currentColor"
					strokeWidth={strokeWidth}
				/>
				<circle
					className={progressClassName}
					cx={size / 2}
					cy={size / 2}
					fill="none"
					r={radius}
					stroke="currentColor"
					strokeDasharray={circumference}
					strokeDashoffset={dashOffset}
					strokeLinecap="round"
					strokeWidth={strokeWidth}
					style={{ transition: "stroke-dashoffset 1s linear" }}
				/>
			</svg>
			{children != null && (
				<div className="absolute inset-0 flex items-center justify-center">
					{children}
				</div>
			)}
		</div>
	);
}
