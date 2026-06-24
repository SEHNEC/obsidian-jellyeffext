import type { RichTextToolbarSettings } from "./defaults";

export function buildFormattingCSS(settings: RichTextToolbarSettings): string {
	const rules: string[] = [];

	rules.push(".rt-underline { text-decoration: underline; }");

	for (const size of settings.fontSizes) {
		rules.push(`.rt-size-${size} { font-size: ${size}px; }`);
	}

	for (const [name, hex] of settings.textColors) {
		rules.push(`.rt-color-${name} { color: ${hex}; }`);
	}

	for (const [name, hex] of settings.highlightColors) {
		rules.push(`.rt-bg-${name} { background-color: ${hex}; }`);
	}

	if (settings.themeIntegration) {
		rules.push(`
.theme-dark .rt-color-black { color: #e0e0e0; }
.theme-dark .rt-color-yellow { color: #ffee58; }
.theme-dark .rt-color-gray { color: #9e9e9e; }
`);
	}

	return rules.join("\n");
}
