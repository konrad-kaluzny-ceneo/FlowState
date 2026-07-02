import type { IllustrationVariant } from "~/lib/design/illustration-variant";

const BLOB_POSE: Record<IllustrationVariant, string> = {
	idle: "opacity-100",
	energy_choice: "opacity-95",
	work: "opacity-100",
	break: "opacity-80",
	return: "opacity-90",
	closure: "opacity-70",
};

type CalmGardenBlobProps = {
	variant: IllustrationVariant;
	className?: string;
	"data-testid"?: string;
};

/** Soft pastel blob backdrop for Calm Garden compositions. */
export function CalmGardenBlob({
	variant,
	className = "",
	"data-testid": testId,
}: CalmGardenBlobProps) {
	return (
		<svg
			aria-hidden="true"
			className={`transition duration-200 motion-reduce:transition-none ${BLOB_POSE[variant]} ${className}`}
			data-illustration-variant={variant}
			data-testid={testId}
			fill="none"
			viewBox="0 0 120 80"
			xmlns="http://www.w3.org/2000/svg"
		>
			<ellipse
				cx="60"
				cy="42"
				fill="var(--illustration-blob-outer, var(--color-surface-break))"
				opacity="0.55"
				rx="52"
				ry="34"
			/>
			<ellipse
				cx="44"
				cy="36"
				fill="var(--illustration-blob-inner, var(--color-energy-steady-bg))"
				opacity="0.7"
				rx="28"
				ry="20"
			/>
			<ellipse
				cx="78"
				cy="48"
				fill="var(--illustration-blob-accent, var(--color-accent-break))"
				opacity="0.12"
				rx="32"
				ry="22"
			/>
		</svg>
	);
}
