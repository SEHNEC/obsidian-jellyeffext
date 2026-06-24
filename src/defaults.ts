export interface RichTextToolbarSettings {
	floatingToolbarEnabled: boolean;
	fixedToolbarEnabled: boolean;
	fixedToolbarPosition: "top" | "bottom";
	fontSizes: number[];
	textColors: [string, string][]; // [name, hex]
	highlightColors: [string, string][]; // [name, hex]
	themeIntegration: boolean;
}

export const DEFAULT_SETTINGS: RichTextToolbarSettings = {
	floatingToolbarEnabled: true,
	fixedToolbarEnabled: false,
	fixedToolbarPosition: "top",
	fontSizes: [12, 14, 16, 18, 20, 24, 32],
	textColors: [
		["black", "#000000"],
		["red", "#e53935"],
		["orange", "#fb8c00"],
		["yellow", "#fdd835"],
		["green", "#43a047"],
		["blue", "#1e88e5"],
		["purple", "#8e24aa"],
		["gray", "#757575"],
	],
	highlightColors: [
		["yellow", "#fff59d"],
		["green", "#c8e6c9"],
		["blue", "#bbdefb"],
		["pink", "#f8bbd0"],
		["purple", "#e1bee7"],
	],
	themeIntegration: true,
};
