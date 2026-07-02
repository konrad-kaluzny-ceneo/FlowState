import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
	type HomeIllustrationState,
	HomeIllustrationVariantProvider,
	useHomeIllustrationVariant,
	usePublishHomeIllustrationVariant,
} from "./home-illustration-variant";

function Publisher({ illustration }: { illustration: HomeIllustrationState }) {
	usePublishHomeIllustrationVariant(illustration);
	return null;
}

function Consumer() {
	const { variant, energyTint } = useHomeIllustrationVariant();
	return (
		<div
			data-energy={energyTint ?? ""}
			data-testid="illustration-consumer"
			data-variant={variant}
		/>
	);
}

describe("home-illustration-variant context", () => {
	it("degrades to the idle baseline without a provider", () => {
		render(<Consumer />);

		const consumer = screen.getByTestId("illustration-consumer");
		expect(consumer.getAttribute("data-variant")).toBe("idle");
		expect(consumer.getAttribute("data-energy")).toBe("");
	});

	it("propagates the published variant to a sibling consumer", () => {
		render(
			<HomeIllustrationVariantProvider>
				<Consumer />
				<Publisher illustration={{ variant: "work", energyTint: "FOCUSED" }} />
			</HomeIllustrationVariantProvider>,
		);

		const consumer = screen.getByTestId("illustration-consumer");
		expect(consumer.getAttribute("data-variant")).toBe("work");
		expect(consumer.getAttribute("data-energy")).toBe("FOCUSED");
	});
});
