"use client";

import {
	createContext,
	type ReactNode,
	useContext,
	useMemo,
	useState,
} from "react";

type FocusLandingChromeValue = {
	demotePageHeader: boolean;
	setDemotePageHeader: (value: boolean) => void;
};

const FocusLandingChromeContext = createContext<FocusLandingChromeValue | null>(
	null,
);

export function FocusLandingChromeProvider({
	children,
}: {
	children: ReactNode;
}) {
	const [demotePageHeader, setDemotePageHeader] = useState(false);
	const value = useMemo(
		() => ({ demotePageHeader, setDemotePageHeader }),
		[demotePageHeader],
	);

	return (
		<FocusLandingChromeContext.Provider value={value}>
			{children}
		</FocusLandingChromeContext.Provider>
	);
}

export function useFocusLandingChrome(): FocusLandingChromeValue {
	const ctx = useContext(FocusLandingChromeContext);
	return (
		ctx ?? {
			demotePageHeader: false,
			setDemotePageHeader: () => {},
		}
	);
}
