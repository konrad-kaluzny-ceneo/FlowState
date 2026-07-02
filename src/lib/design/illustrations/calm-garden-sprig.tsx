import type { IllustrationVariant } from "~/lib/design/illustration-variant";

const SPRIG_POSE: Record<IllustrationVariant, string> = {
	idle: "rotate-0",
	energy_choice: "-rotate-3",
	work: "scale-105",
	break: "rotate-3 opacity-80",
	return: "-rotate-6",
	closure: "scale-95 opacity-75",
};

type CalmGardenSprigProps = {
	variant: IllustrationVariant;
	className?: string;
	"data-testid"?: string;
};

/** Single-weight botanical line-art sprig. */
export function CalmGardenSprig({
	variant,
	className = "",
	"data-testid": testId,
}: CalmGardenSprigProps) {
	return (
		<svg
			aria-hidden="true"
			className={`transition duration-200 motion-reduce:transition-none ${SPRIG_POSE[variant]} ${className}`}
			data-illustration-variant={variant}
			data-testid={testId}
			fill="none"
			stroke="var(--illustration-sprig-stroke, var(--color-accent-break))"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth="1.5"
			viewBox="0 0 48 48"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path d="M24 40V22" />
			<path d="M24 30c-6-4-10-8-12-14" />
			<path d="M24 26c5-3 9-7 11-13" />
			<path d="M24 34c-4 2-7 5-9 9" />
			<path d="M24 32c4 1 8 4 10 8" />
			<ellipse
				cx="24"
				cy="18"
				fill="var(--illustration-sprig-stroke, var(--color-accent-break))"
				rx="2"
				ry="3"
				stroke="none"
			/>
		</svg>
	);
}
