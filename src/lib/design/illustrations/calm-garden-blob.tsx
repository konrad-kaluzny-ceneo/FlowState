type CalmGardenBlobProps = {
	className?: string;
	"data-testid"?: string;
};

/** Soft pastel blob backdrop for Calm Garden compositions. */
export function CalmGardenBlob({
	className = "",
	"data-testid": testId,
}: CalmGardenBlobProps) {
	return (
		<svg
			aria-hidden="true"
			className={className}
			data-testid={testId}
			fill="none"
			viewBox="0 0 120 80"
			xmlns="http://www.w3.org/2000/svg"
		>
			<ellipse
				cx="60"
				cy="42"
				fill="var(--color-surface-break)"
				opacity="0.55"
				rx="52"
				ry="34"
			/>
			<ellipse
				cx="44"
				cy="36"
				fill="var(--color-energy-steady-bg)"
				opacity="0.7"
				rx="28"
				ry="20"
			/>
			<ellipse
				cx="78"
				cy="48"
				fill="var(--color-accent-break)"
				opacity="0.12"
				rx="32"
				ry="22"
			/>
		</svg>
	);
}
