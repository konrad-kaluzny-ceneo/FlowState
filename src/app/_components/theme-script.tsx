import { THEME_STORAGE_KEY } from "~/lib/design/theme";

const themeScript = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var p=localStorage.getItem(k);var t="light";if(p==="dark"){t="dark";}else if(p==="system"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.dataset.theme=t;}catch(e){}})();`;

export function ThemeScript() {
	return (
		<script
			// biome-ignore lint/security/noDangerouslySetInnerHtml: blocking FOUC prevention requires synchronous inline script before paint
			dangerouslySetInnerHTML={{ __html: themeScript }}
		/>
	);
}
