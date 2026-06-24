type CalmGardenSprigProps = {
	className?: string;
	"data-testid"?: string;
};

/** Single-weight botanical line-art sprig. */
export function CalmGardenSprig({
	className = "",
	"data-testid": testId,
}: CalmGardenSprigProps) {
	return (
		<svg
			aria-hidden="true"
			className={`text-accent-break ${className}`}
			data-testid={testId}
			fill="none"
			stroke="currentColor"
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
				fill="currentColor"
				rx="2"
				ry="3"
				stroke="none"
			/>
		</svg>
	);
}
