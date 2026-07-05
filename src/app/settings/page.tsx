"use client";

import { useAppUser } from "~/app/_components/app-user-context";
import { UstawieniaView } from "~/app/_components/ustawienia-view";

export default function SettingsPage() {
	const { scope, userName } = useAppUser();

	return <UstawieniaView scope={scope} userName={userName} />;
}
