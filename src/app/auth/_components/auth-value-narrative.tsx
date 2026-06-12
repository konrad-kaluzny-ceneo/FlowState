import { type AuthPageVariant, getAuthValueCopy } from "~/lib/onboarding/copy";

type AuthValueNarrativeProps = {
	variant: AuthPageVariant;
};

export function AuthValueNarrative({ variant }: AuthValueNarrativeProps) {
	const copy = getAuthValueCopy(variant);

	if (variant === "sign-in" && copy.subtitle) {
		return (
			<p className="mb-6 text-center text-sm text-text-secondary">
				{copy.subtitle}
			</p>
		);
	}

	if (variant === "sign-up" && copy.valueBlock) {
		return (
			<div className="mb-6 text-center">
				<h2 className="font-medium text-sm text-text-section">
					{copy.valueBlock.heading}
				</h2>
				<ul className="mt-3 space-y-2 text-sm text-text-secondary">
					{copy.valueBlock.lines.map((line) => (
						<li key={line}>{line}</li>
					))}
				</ul>
			</div>
		);
	}

	return null;
}
