import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyGardenBed } from "./empty-garden-bed";

describe("EmptyGardenBed", () => {
	it("renders decorative garden bed illustration", () => {
		render(<EmptyGardenBed />);
		expect(screen.getByTestId("empty-garden-bed")).toBeTruthy();
	});
});
