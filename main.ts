import {
	App,
	Editor,
	MarkdownView,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";

// ── Types & Constants ────────────────────────────────────────────────

interface RichTextToolbarSettings {
	floatingToolbarEnabled: boolean;
	fixedToolbarEnabled: boolean;
	fixedToolbarPosition: "top" | "bottom";
	fontSizes: number[];
	textColors: [string, string][]; // [name, hex]
	highlightColors: [string, string][]; // [name, hex]
	themeIntegration: boolean;
}

const DEFAULT_SETTINGS: RichTextToolbarSettings = {
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

// SVG icons (inline for portability)
const ICONS: Record<string, string> = {
	bold: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>`,
	italic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>`,
	underline: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>`,
	strikethrough: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.3 4.9c-2.3-.6-4.4-1-6.2-.9-2.7.1-5.2 2-4.8 5 .4 2.8 3.4 3.2 6.1 3.5"/><line x1="5" y1="12" x2="19" y2="12"/><path d="M18.4 19c-2.2.6-4.4.6-5.9.2-2.2-.7-3.2-2.8-2.5-5"/></svg>`,
	code: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
	clear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
	fontSize: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`,
	textColor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L12 20l-4 1 1-4Z"/></svg>`,
	highlight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h9l3-23"/><path d="M20 3h-6.5"/><line x1="20" y1="8" x2="16" y2="8"/><path d="M14 3h-2.5L8 20"/></svg>`,
};

// ── Dynamic CSS Injection ────────────────────────────────────────────

function buildFormattingCSS(settings: RichTextToolbarSettings): string {
	const rules: string[] = [];

	// Underline
	rules.push(".rt-underline { text-decoration: underline; }");

	// Font sizes
	for (const size of settings.fontSizes) {
		rules.push(`.rt-size-${size} { font-size: ${size}px; }`);
	}

	// Text colors
	for (const [name, hex] of settings.textColors) {
		rules.push(`.rt-color-${name} { color: ${hex}; }`);
	}

	// Highlight colors
	for (const [name, hex] of settings.highlightColors) {
		rules.push(`.rt-bg-${name} { background-color: ${hex}; }`);
	}

	// Dark theme overrides for colors that need adjustment
	rules.push(`
.theme-dark .rt-color-black { color: #e0e0e0; }
.theme-dark .rt-color-yellow { color: #ffee58; }
.theme-dark .rt-color-gray { color: #9e9e9e; }
`);

	return rules.join("\n");
}

// ── Span Formatting Helpers ──────────────────────────────────────────

/**
 * Parse a <span class="...">...</span> from the given text.
 * Returns the classes string, inner text, and the full match.
 */
function parseSpan(text: string): { classes: string; inner: string; match: string } | null {
	const re = /^<span\s+class="([^"]*)"\s*>([\s\S]*?)<\/span>$/;
	const m = text.match(re);
	if (!m) return null;
	return { classes: m[1], inner: m[2], match: m[0] };
}

/** Split a class string into an array, filtering empties. */
function splitClasses(c: string): string[] {
	return c.split(/\s+/).filter(Boolean);
}

/** Check whether text is wrapped in markdown bold syntax. */
function isBoldWrapped(text: string): boolean {
	if (!text.startsWith("**") || !text.endsWith("**") || text.length <= 4) return false;
	return !text.slice(2, -2).includes("**");
}

/** Check whether text is wrapped in markdown italic syntax. */
function isItalicWrapped(text: string): boolean {
	if (!text.startsWith("*") || !text.endsWith("*") || text.length <= 2) return false;
	if (text.startsWith("**")) return false;
	// Strip bold markers from inner before checking for lone *
	return !text.slice(1, -1).replace(/\*\*/g, "").includes("*");
}

/** Check whether text is wrapped in markdown strikethrough syntax. */
function isStrikethroughWrapped(text: string): boolean {
	if (!text.startsWith("~~") || !text.endsWith("~~") || text.length <= 4) return false;
	return !text.slice(2, -2).includes("~~");
}

/** Check whether text is wrapped in markdown inline code syntax. */
function isCodeWrapped(text: string): boolean {
	if (!text.startsWith("`") || !text.endsWith("`") || text.length <= 2) return false;
	return !text.slice(1, -1).includes("`");
}

/** Peel outermost markdown wrappers, returning the inner text and the wrappers in order. */
function parseMarkdownWrappers(text: string): { inner: string; wrappers: string[] } {
	const wrappers: string[] = [];
	let inner = text;
	for (;;) {
		if (isBoldWrapped(inner)) {
			inner = inner.slice(2, -2);
			wrappers.push("**");
		} else if (isStrikethroughWrapped(inner)) {
			inner = inner.slice(2, -2);
			wrappers.push("~~");
		} else if (isItalicWrapped(inner)) {
			inner = inner.slice(1, -1);
			wrappers.push("*");
		} else if (isCodeWrapped(inner)) {
			inner = inner.slice(1, -1);
			wrappers.push("`");
		} else {
			break;
		}
	}
	return { inner, wrappers };
}

/**
 * Parse a span that may be wrapped in markdown syntax.
 * Returns the span, any markdown wrappers that were peeled, or null if no span found.
 */
function parseSpanThroughMarkdown(text: string): {
	span: { classes: string; inner: string; match: string };
	wrappers: string[];
} | null {
	const direct = parseSpan(text);
	if (direct) return { span: direct, wrappers: [] };
	const { inner, wrappers } = parseMarkdownWrappers(text);
	if (wrappers.length === 0) return null;
	const span = parseSpan(inner);
	if (!span) return null;
	return { span, wrappers };
}

/** Check whether the selection contains a span with an underline class. */
function hasUnderlineClass(text: string): boolean {
	const span = parseSpan(text);
	if (!span) return false;
	return splitClasses(span.classes).includes("rt-underline");
}

/** Get the first class matching a given prefix from a class string. */
function getClassByPrefix(classes: string, prefix: string): string | null {
	return splitClasses(classes).find((c) => c.startsWith(prefix)) ?? null;
}

// ── Toolbar Component ─────────────────────────────────────────────────

interface ToolbarAction {
	type: "button";
	id: string;
	icon?: string;
	label?: string;
	title: string;
	checkActive?: () => boolean;
	action: () => void;
}

interface ToolbarSeparator {
	type: "separator";
}

interface ToolbarFontSize {
	type: "fontSize";
}

interface ToolbarTextColor {
	type: "textColor";
}

interface ToolbarHighlightColor {
	type: "highlightColor";
}

interface ToolbarClear {
	type: "clear";
}

type ToolbarItem =
	| ToolbarAction
	| ToolbarSeparator
	| ToolbarFontSize
	| ToolbarTextColor
	| ToolbarHighlightColor
	| ToolbarClear;

class Toolbar {
	private wrapper: HTMLElement;
	private toolbar: HTMLElement;
	private items: ToolbarItem[] = [];
	private selectionHandler: (() => void) | null = null;
	owner: RichTextToolbarPlugin;

	constructor(owner: RichTextToolbarPlugin) {
		this.owner = owner;
		this.wrapper = document.body.createDiv("rt-toolbar-wrapper");
		this.toolbar = this.wrapper.createDiv("rt-toolbar");
		this.hide();
	}

	setItems(items: ToolbarItem[]): void {
		this.items = items;
		this.render();
	}

	private render(): void {
		this.toolbar.empty();

		for (let i = 0; i < this.items.length; i++) {
			const item = this.items[i];

			// Add divider between groups (before non-first items after a logical break)
			if (i > 0) {
				const prev = this.items[i - 1];
				if (prev.type !== item.type || item.type === "separator") {
					if (prev.type !== "separator" && item.type !== "separator") {
						this.toolbar.createDiv("rt-toolbar-divider");
					}
				}
			}

			switch (item.type) {
				case "button":
					this.renderButton(item);
					break;
				case "separator":
					this.toolbar.createDiv("rt-toolbar-divider");
					break;
				case "fontSize":
					this.renderFontSize();
					break;
				case "textColor":
					this.renderTextColor();
					break;
				case "highlightColor":
					this.renderHighlightColor();
					break;
				case "clear":
					this.renderClear();
					break;
			}
		}
	}

	private renderButton(item: ToolbarAction): void {
		const btn = this.toolbar.createEl("button", {
			cls: "rt-btn",
			attr: { "data-action": item.id, title: item.title },
		});

		if (item.icon) {
			btn.innerHTML = item.icon;
		} else if (item.label) {
			btn.setText(item.label);
		}

		btn.addEventListener("mousedown", (e) => {
			e.preventDefault();
			e.stopPropagation();
			if (item.checkActive) {
				btn.toggleClass("rt-active", item.checkActive());
			}
			item.action();
		});
	}

	private renderFontSize(): void {
		const wrap = this.toolbar.createDiv("rt-select-wrap");
		const select = wrap.createEl("select", { cls: "rt-select" });

		// Placeholder option
		select.createEl("option", { text: "Size", attr: { value: "", disabled: "true", selected: "true" } });

		for (const size of this.owner.settings.fontSizes) {
			select.createEl("option", { text: `${size}px`, attr: { value: String(size) } });
		}

		select.createEl("option", { text: "Custom...", attr: { value: "custom" } });

		select.addEventListener("mousedown", (e) => e.stopPropagation());

		select.addEventListener("change", () => {
			const val = select.value;
			select.selectedIndex = 0; // reset
			if (val === "custom") {
				this.owner.showCustomSizeDialog();
			} else if (val) {
				this.owner.applyFontSize(parseInt(val, 10));
			}
		});
	}

	private renderTextColor(): void {
		const group = this.toolbar.createDiv("rt-color-group");

		for (const [name, hex] of this.owner.settings.textColors) {
			const swatch = group.createDiv("rt-color-swatch");
			swatch.style.backgroundColor = hex;
			swatch.setAttr("title", `Text: ${name}`);
			swatch.addEventListener("mousedown", (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.owner.applyTextColor(name);
			});
		}

		// "None" swatch to remove color
		const none = group.createDiv({ cls: "rt-color-swatch rt-color-none", attr: { title: "Remove color" } });
		none.addEventListener("mousedown", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.owner.removeTextColor();
		});

		// Color picker trigger
		const more = group.createDiv({ cls: "rt-color-swatch rt-color-more", attr: { title: "Custom color..." } });
		more.addEventListener("mousedown", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.owner.showTextColorPicker();
		});
	}

	private renderHighlightColor(): void {
		const group = this.toolbar.createDiv("rt-color-group");

		for (const [name, hex] of this.owner.settings.highlightColors) {
			const swatch = group.createDiv("rt-color-swatch");
			swatch.style.backgroundColor = hex;
			swatch.setAttr("title", `Highlight: ${name}`);
			swatch.addEventListener("mousedown", (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.owner.applyHighlightColor(name);
			});
		}

		// "None" swatch
		const none = group.createDiv({ cls: "rt-color-swatch rt-color-none", attr: { title: "Remove highlight" } });
		none.addEventListener("mousedown", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.owner.removeHighlightColor();
		});

		// Color picker trigger
		const more = group.createDiv({ cls: "rt-color-swatch rt-color-more", attr: { title: "Custom highlight..." } });
		more.addEventListener("mousedown", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.owner.showHighlightPicker();
		});
	}

	private renderClear(): void {
		const btn = this.toolbar.createEl("button", {
			cls: "rt-btn",
			attr: { "data-action": "clear", title: "Clear formatting" },
		});
		btn.innerHTML = ICONS.clear;
		btn.addEventListener("mousedown", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.owner.clearFormatting();
		});
	}

	show(): void {
		this.wrapper.addClass("rt-visible");
	}

	hide(): void {
		this.wrapper.removeClass("rt-visible");
	}

	isVisible(): boolean {
		return this.wrapper.hasClass("rt-visible");
	}

	setPosition(top: number, left: number): void {
		// Clamp to viewport
		const rect = this.toolbar.getBoundingClientRect();
		const vw = window.innerWidth;
		const vh = window.innerHeight;

		// Default: above selection
		let finalTop = top - rect.height - 8;

		// If not enough space above, position below
		if (finalTop < 8) {
			finalTop = top + 24;
		}

		// Clamp top
		if (finalTop < 4) finalTop = 4;
		if (finalTop + rect.height > vh - 4) finalTop = vh - rect.height - 4;

		// Center horizontally on the coordinate
		let finalLeft = left - rect.width / 2;

		// Clamp left
		if (finalLeft < 4) finalLeft = 4;
		if (finalLeft + rect.width > vw - 4) finalLeft = vw - rect.width - 4;

		this.wrapper.style.top = `${finalTop}px`;
		this.wrapper.style.left = `${finalLeft}px`;
	}

	getElement(): HTMLElement {
		return this.wrapper;
	}

	destroy(): void {
		this.wrapper.remove();
	}
}

// ── Main Plugin ──────────────────────────────────────────────────────

export default class RichTextToolbarPlugin extends Plugin {
	settings: RichTextToolbarSettings;
	private toolbar: Toolbar | null = null;
	private dynamicStyleEl: HTMLStyleElement | null = null;
	private savedSelection: { from: number; to: number } | null = null;

	// ── Lifecycle ─────────────────────────────────────────────────

	async onload(): Promise<void> {
		await this.loadSettings();

		// Inject dynamic CSS
		this.injectDynamicCSS();

		// Build toolbar
		this.toolbar = new Toolbar(this);
		this.buildToolbarItems();

		// Register commands
		this.registerCommands();

		// Register keyboard shortcuts
		this.registerKeyboardShortcuts();

		// Track selection via mouseup/keyup events on the document
		this.registerDomEvent(document, "mouseup", () => {
			// Small delay to let the selection settle
			setTimeout(() => this.onSelectionChanged(), 50);
		});

		this.registerDomEvent(document, "keyup", (e: KeyboardEvent) => {
			// Only respond to keys that could change the selection
			if (e.shiftKey || e.key === "ArrowLeft" || e.key === "ArrowRight" ||
				e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Home" ||
				e.key === "End" || (e.ctrlKey && e.key === "a") || (e.metaKey && e.key === "a")) {
				setTimeout(() => this.onSelectionChanged(), 50);
			}
		});

		// Hide toolbar when clicking outside
		this.registerDomEvent(document, "mousedown", (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (this.toolbar?.isVisible()) {
				const toolbarEl = this.toolbar.getElement();
				if (!toolbarEl.contains(target) && !target.closest(".rt-picker-overlay")) {
					this.toolbar.hide();
				}
			}
		});

		// Hide toolbar on scroll
		this.registerDomEvent(document, "scroll", () => {
			this.toolbar?.hide();
		}, { capture: true });

		// Handle layout changes (tab switches, mode changes)
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				this.toolbar?.hide();
				this.updateFixedToolbar();
			})
		);

		// Add settings tab
		this.addSettingTab(new RichTextToolbarSettingTab(this.app, this));

		// Initial fixed toolbar setup
		this.updateFixedToolbar();

		console.log("Rich Text Toolbar plugin loaded");
	}

	onunload(): void {
		this.removeFixedToolbar();
		this.toolbar?.destroy();
		this.removeDynamicCSS();
		console.log("Rich Text Toolbar plugin unloaded");
	}

	// ── Settings ──────────────────────────────────────────────────

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.injectDynamicCSS();
		this.toolbar?.setItems([]);
		this.buildToolbarItems();
		this.updateFixedToolbar();
	}

	// ── Dynamic CSS ───────────────────────────────────────────────

	private injectDynamicCSS(): void {
		this.removeDynamicCSS();
		this.dynamicStyleEl = document.head.createEl("style", {
			attr: { id: "rt-dynamic-css" },
			text: buildFormattingCSS(this.settings),
		});
	}

	private removeDynamicCSS(): void {
		document.getElementById("rt-dynamic-css")?.remove();
		this.dynamicStyleEl = null;
	}

	// ── Toolbar Item Construction ─────────────────────────────────

	private buildToolbarItems(): void {
		if (!this.toolbar) return;

		const items: ToolbarItem[] = [
			// Group 1: Text formatting
			{
				type: "button",
				id: "bold",
				icon: ICONS.bold,
				title: "Bold (Ctrl+B)",
				action: () => this.toggleBold(),
			},
			{
				type: "button",
				id: "italic",
				icon: ICONS.italic,
				title: "Italic (Ctrl+I)",
				action: () => this.toggleItalic(),
			},
			{
				type: "button",
				id: "underline",
				icon: ICONS.underline,
				title: "Underline (Ctrl+U)",
				action: () => this.toggleUnderline(),
			},
			{
				type: "button",
				id: "strikethrough",
				icon: ICONS.strikethrough,
				title: "Strikethrough",
				action: () => this.toggleStrikethrough(),
			},
			{
				type: "button",
				id: "code",
				icon: ICONS.code,
				title: "Inline Code",
				action: () => this.toggleCode(),
			},
			// Group 2: Font size
			{ type: "fontSize" },
			// Group 3: Text color
			{ type: "textColor" },
			// Group 4: Highlight
			{ type: "highlightColor" },
			// Group 5: Clear
			{ type: "clear" },
		];

		this.toolbar.setItems(items);
	}

	// ── Commands ──────────────────────────────────────────────────

	private registerCommands(): void {
		this.addCommand({
			id: "toggle-bold",
			name: "Toggle Bold",
			editorCallback: () => this.toggleBold(),
		});
		this.addCommand({
			id: "toggle-italic",
			name: "Toggle Italic",
			editorCallback: () => this.toggleItalic(),
		});
		this.addCommand({
			id: "toggle-underline",
			name: "Toggle Underline",
			editorCallback: () => this.toggleUnderline(),
		});
		this.addCommand({
			id: "toggle-strikethrough",
			name: "Toggle Strikethrough",
			editorCallback: () => this.toggleStrikethrough(),
		});
		this.addCommand({
			id: "toggle-inline-code",
			name: "Toggle Inline Code",
			editorCallback: () => this.toggleCode(),
		});
		this.addCommand({
			id: "clear-formatting",
			name: "Clear Formatting",
			editorCallback: () => this.clearFormatting(),
		});
	}

	// ── Keyboard Shortcuts ────────────────────────────────────────

	private registerKeyboardShortcuts(): void {
		// Note: Obsidian manages hotkeys via the settings UI.
		// We use addCommand which allows users to customize shortcuts.
		// Default hotkeys are set via the commands above — users can
		// assign Ctrl+B, Ctrl+I, Ctrl+U etc. through Obsidian's hotkey settings.

		// Font size shortcuts
		const sizeHotkeys = [12, 14, 16, 18, 20, 24, 32];

		for (const size of sizeHotkeys) {
			this.addCommand({
				id: `font-size-${size}`,
				name: `Set font size: ${size}px`,
				editorCallback: () => this.applyFontSize(size),
			});
		}
	}

	// ── Selection & Editor Helpers ──────────────────────────────────

	/**
	 * Get the active editor instance. Returns null in reading mode.
	 */
	private getEditor(): Editor | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return null;

		// Only work in source mode and live preview (not reading mode)
		const state = (view as any).getMode?.() ?? "source";
		if (state === "preview") return null;

		return view.editor;
	}

	/**
	 * Get the CodeMirror EditorView instance from an Obsidian Editor, if available.
	 */
	private getCodeMirrorView(editor: Editor): any {
		return (editor as any).cm ?? null;
	}

	/**
	 * Save the current editor selection for toolbar operations.
	 * Called when the toolbar is about to be shown.
	 */
	private saveCurrentSelection(editor: Editor): void {
		const selection = editor.getSelection();
		if (!selection) {
			this.savedSelection = null;
			return;
		}

		const from = editor.getCursor("from");
		const to = editor.getCursor("to");
		this.savedSelection = {
			from: editor.posToOffset(from),
			to: editor.posToOffset(to),
		};
	}

	/**
	 * Get the current selection from the editor. If the selection is empty
	 * (e.g. because the user clicked the toolbar and the editor lost focus),
	 * attempt to restore from the saved selection.
	 */
	private getSelectionWithFallback(editor: Editor): string {
		const sel = editor.getSelection();
		if (sel) return sel;

		// Try to restore from saved state
		if (this.savedSelection) {
			const from = editor.offsetToPos(this.savedSelection.from);
			const to = editor.offsetToPos(this.savedSelection.to);
			editor.setSelection(from, to);
			return editor.getSelection();
		}

		return "";
	}

	// ── Selection Change Handler ───────────────────────────────────

	/**
	 * Called on mouseup / keyup. Shows/hides the floating toolbar
	 * depending on whether text is selected.
	 */
	private onSelectionChanged(): void {
		const editor = this.getEditor();
		if (!editor) {
			this.toolbar?.hide();
			return;
		}

		const selection = editor.getSelection();
		if (!selection || selection.trim().length === 0) {
			this.toolbar?.hide();
			this.savedSelection = null;
			return;
		}

		// Only show floating toolbar (not in fixed mode)
		if (!this.settings.floatingToolbarEnabled || this.settings.fixedToolbarEnabled) {
			return;
		}

		this.saveCurrentSelection(editor);

		// Get coordinates from CodeMirror
		const cm = this.getCodeMirrorView(editor);
		if (!cm || typeof cm.coordsAtPos !== "function") {
			return;
		}

		// Position at the end of the selection (use offset for CodeMirror)
		const offset = editor.posToOffset(editor.getCursor("to"));
		const coords = cm.coordsAtPos(offset);
		if (!coords) return;

		this.toolbar?.setPosition(coords.top, coords.left);
		this.toolbar?.show();
	}

	// ── Fixed Toolbar ──────────────────────────────────────────────

	private fixedToolbarInserted = false;

	/**
	 * Insert or remove the fixed toolbar into the active editor's DOM.
	 */
	private updateFixedToolbar(): void {
		if (!this.toolbar) return;

		// Remove from any existing parent
		this.removeFixedToolbar();

		if (!this.settings.fixedToolbarEnabled) return;

		const editor = this.getEditor();
		if (!editor) return;

		const cm = this.getCodeMirrorView(editor);
		if (!cm?.dom) return;

		const scrollDom = cm.dom as HTMLElement;
		const wrapper = this.toolbar.getElement();

		wrapper.addClass(
			this.settings.fixedToolbarPosition === "top"
				? "rt-fixed-top"
				: "rt-fixed-bottom"
		);
		wrapper.addClass("rt-visible");

		if (this.settings.fixedToolbarPosition === "top") {
			scrollDom.parentElement?.insertBefore(wrapper, scrollDom);
		} else {
			scrollDom.parentElement?.appendChild(wrapper);
		}

		this.fixedToolbarInserted = true;
	}

	private removeFixedToolbar(): void {
		if (!this.toolbar || !this.fixedToolbarInserted) return;

		const wrapper = this.toolbar.getElement();
		// Move back to body for floating mode
		document.body.appendChild(wrapper);
		wrapper.removeClass("rt-fixed-top");
		wrapper.removeClass("rt-fixed-bottom");
		wrapper.removeClass("rt-visible");
		this.toolbar.hide();
		this.fixedToolbarInserted = false;
	}

	// ── Formatting: Bold ──────────────────────────────────────────

	toggleBold(): void {
		const editor = this.getEditor();
		if (!editor) return;

		const selection = this.getSelectionWithFallback(editor);
		if (!selection) return;

		if (isBoldWrapped(selection)) {
			// Remove bold
			editor.replaceSelection(selection.slice(2, -2));
		} else {
			// Apply bold
			editor.replaceSelection(`**${selection}**`);
		}

		this.afterFormat(editor);
	}

	// ── Formatting: Italic ────────────────────────────────────────

	toggleItalic(): void {
		const editor = this.getEditor();
		if (!editor) return;

		const selection = this.getSelectionWithFallback(editor);
		if (!selection) return;

		if (isItalicWrapped(selection)) {
			editor.replaceSelection(selection.slice(1, -1));
		} else {
			editor.replaceSelection(`*${selection}*`);
		}

		this.afterFormat(editor);
	}

	// ── Formatting: Underline ─────────────────────────────────────

	toggleUnderline(): void {
		const editor = this.getEditor();
		if (!editor) return;

		const selection = this.getSelectionWithFallback(editor);
		if (!selection) return;

		const parsed = parseSpanThroughMarkdown(selection);
		if (parsed) {
			const { span, wrappers } = parsed;
			const classes = splitClasses(span.classes);
			if (classes.includes("rt-underline")) {
				this.replaceWithSpanWrapped(editor, span.inner, classes.filter((c) => c !== "rt-underline"), wrappers);
			} else {
				classes.push("rt-underline");
				this.replaceWithSpanWrapped(editor, span.inner, classes, wrappers);
			}
		} else {
			this.replaceWithSpan(editor, selection, ["rt-underline"]);
		}

		this.afterFormat(editor);
	}

	// ── Formatting: Strikethrough ─────────────────────────────────

	toggleStrikethrough(): void {
		const editor = this.getEditor();
		if (!editor) return;

		const selection = this.getSelectionWithFallback(editor);
		if (!selection) return;

		if (isStrikethroughWrapped(selection)) {
			editor.replaceSelection(selection.slice(2, -2));
		} else {
			editor.replaceSelection(`~~${selection}~~`);
		}

		this.afterFormat(editor);
	}

	// ── Formatting: Inline Code ───────────────────────────────────

	toggleCode(): void {
		const editor = this.getEditor();
		if (!editor) return;

		const selection = this.getSelectionWithFallback(editor);
		if (!selection) return;

		if (isCodeWrapped(selection)) {
			editor.replaceSelection(selection.slice(1, -1));
		} else {
			editor.replaceSelection("`" + selection + "`");
		}

		this.afterFormat(editor);
	}

	// ── Formatting: Font Size ─────────────────────────────────────

	applyFontSize(size: number): void {
		const editor = this.getEditor();
		if (!editor) return;

		const selection = this.getSelectionWithFallback(editor);
		if (!selection) return;

		const targetClass = `rt-size-${size}`;
		const parsed = parseSpanThroughMarkdown(selection);

		if (parsed) {
			const { span, wrappers } = parsed;
			const classes = splitClasses(span.classes).filter((c) => !c.startsWith("rt-size-"));
			classes.push(targetClass);
			this.replaceWithSpanWrapped(editor, span.inner, classes, wrappers);
		} else {
			this.replaceWithSpan(editor, selection, [targetClass]);
		}

		this.afterFormat(editor);
	}

	// ── Formatting: Text Color ────────────────────────────────────

	applyTextColor(colorName: string): void {
		const editor = this.getEditor();
		if (!editor) return;

		const selection = this.getSelectionWithFallback(editor);
		if (!selection) return;

		const targetClass = `rt-color-${colorName}`;
		const parsed = parseSpanThroughMarkdown(selection);

		if (parsed) {
			const { span, wrappers } = parsed;
			const classes = splitClasses(span.classes).filter((c) => !c.startsWith("rt-color-"));
			classes.push(targetClass);
			this.replaceWithSpanWrapped(editor, span.inner, classes, wrappers);
		} else {
			this.replaceWithSpan(editor, selection, [targetClass]);
		}

		this.afterFormat(editor);
	}

	removeTextColor(): void {
		const editor = this.getEditor();
		if (!editor) return;

		const selection = this.getSelectionWithFallback(editor);
		if (!selection) return;

		const parsed = parseSpanThroughMarkdown(selection);
		if (!parsed) return;

		const { span, wrappers } = parsed;
		const classes = splitClasses(span.classes).filter((c) => !c.startsWith("rt-color-"));
		this.replaceWithSpanWrapped(editor, span.inner, classes, wrappers);
		this.afterFormat(editor);
	}

	// ── Formatting: Highlight Color ───────────────────────────────

	applyHighlightColor(colorName: string): void {
		const editor = this.getEditor();
		if (!editor) return;

		const selection = this.getSelectionWithFallback(editor);
		if (!selection) return;

		const targetClass = `rt-bg-${colorName}`;
		const parsed = parseSpanThroughMarkdown(selection);

		if (parsed) {
			const { span, wrappers } = parsed;
			const classes = splitClasses(span.classes).filter((c) => !c.startsWith("rt-bg-"));
			classes.push(targetClass);
			this.replaceWithSpanWrapped(editor, span.inner, classes, wrappers);
		} else {
			this.replaceWithSpan(editor, selection, [targetClass]);
		}

		this.afterFormat(editor);
	}

	removeHighlightColor(): void {
		const editor = this.getEditor();
		if (!editor) return;

		const selection = this.getSelectionWithFallback(editor);
		if (!selection) return;

		const parsed = parseSpanThroughMarkdown(selection);
		if (!parsed) return;

		const { span, wrappers } = parsed;
		const classes = splitClasses(span.classes).filter((c) => !c.startsWith("rt-bg-"));
		this.replaceWithSpanWrapped(editor, span.inner, classes, wrappers);
		this.afterFormat(editor);
	}

	// ── Formatting: Clear ─────────────────────────────────────────

	clearFormatting(): void {
		const editor = this.getEditor();
		if (!editor) return;

		const selection = this.getSelectionWithFallback(editor);
		if (!selection) return;

		// Peel all markdown wrappers, then strip any inner span
		const { inner } = parseMarkdownWrappers(selection);
		const span = parseSpan(inner);
		editor.replaceSelection(span ? span.inner : inner);
		this.afterFormat(editor);
	}

	// ── Color Picker Dialogs ──────────────────────────────────────

	showTextColorPicker(): void {
		this.showColorPicker("Choose text color", (hex) => {
			const name = "custom-" + hex.replace("#", "");

			// Persist custom color so it survives restarts
			if (!this.settings.textColors.some(([n]) => n === name)) {
				this.settings.textColors.push([name, hex]);
				this.saveSettings();
			}

			const editor = this.getEditor();
			if (!editor) return;

			const selection = this.getSelectionWithFallback(editor);
			if (!selection) return;

			const parsed = parseSpanThroughMarkdown(selection);
			const classes = parsed
				? splitClasses(parsed.span.classes).filter((c) => !c.startsWith("rt-color-"))
				: [];
			classes.push(`rt-color-${name}`);

			const innerText = parsed ? parsed.span.inner : selection;
			const wrappers = parsed ? parsed.wrappers : [];
			this.replaceWithSpanWrapped(editor, innerText, classes, wrappers);
			this.afterFormat(editor);
		});
	}

	showHighlightPicker(): void {
		this.showColorPicker("Choose highlight color", (hex) => {
			const name = "custom-" + hex.replace("#", "");

			// Persist custom color so it survives restarts
			if (!this.settings.highlightColors.some(([n]) => n === name)) {
				this.settings.highlightColors.push([name, hex]);
				this.saveSettings();
			}

			const editor = this.getEditor();
			if (!editor) return;

			const selection = this.getSelectionWithFallback(editor);
			if (!selection) return;

			const parsed = parseSpanThroughMarkdown(selection);
			const classes = parsed
				? splitClasses(parsed.span.classes).filter((c) => !c.startsWith("rt-bg-"))
				: [];
			classes.push(`rt-bg-${name}`);

			const innerText = parsed ? parsed.span.inner : selection;
			const wrappers = parsed ? parsed.wrappers : [];
			this.replaceWithSpanWrapped(editor, innerText, classes, wrappers);
			this.afterFormat(editor);
		});
	}

	showCustomSizeDialog(): void {
		const overlay = document.body.createDiv("rt-picker-overlay");
		const dialog = overlay.createDiv("rt-picker-dialog");

		dialog.createEl("h4", { text: "Custom font size" });

		const row = dialog.createDiv("rt-custom-size");
		const input = row.createEl("input", {
			attr: { type: "number", min: "1", max: "200", placeholder: "e.g. 48", value: "16" },
		});
		row.createEl("span", { text: "px" });

		const actions = dialog.createDiv("rt-picker-actions");
		const cancelBtn = actions.createEl("button", {
			text: "Cancel",
			cls: "rt-picker-cancel",
		});
		const applyBtn = actions.createEl("button", {
			text: "Apply",
			cls: "rt-picker-apply",
		});

		const close = () => overlay.remove();

		cancelBtn.addEventListener("click", close);
		overlay.addEventListener("click", (e) => {
			if (e.target === overlay) close();
		});

		applyBtn.addEventListener("click", () => {
			const val = parseInt(input.value, 10);
			if (val && val > 0 && val <= 200) {
				this.applyFontSize(val);
			}
			close();
		});

		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") applyBtn.click();
			if (e.key === "Escape") close();
		});

		input.focus();
	}

	private showColorPicker(title: string, onChoose: (hex: string) => void): void {
		const overlay = document.body.createDiv("rt-picker-overlay");
		const dialog = overlay.createDiv("rt-picker-dialog");

		dialog.createEl("h4", { text: title });

		const colorInput = dialog.createEl("input", {
			attr: { type: "color", value: "#000000" },
		});

		const actions = dialog.createDiv("rt-picker-actions");
		const cancelBtn = actions.createEl("button", {
			text: "Cancel",
			cls: "rt-picker-cancel",
		});
		const applyBtn = actions.createEl("button", {
			text: "Apply",
			cls: "rt-picker-apply",
		});

		const close = () => overlay.remove();

		cancelBtn.addEventListener("click", close);
		overlay.addEventListener("click", (e) => {
			if (e.target === overlay) close();
		});

		applyBtn.addEventListener("click", () => {
			onChoose(colorInput.value);
			close();
		});

		colorInput.addEventListener("keydown", (e) => {
			if (e.key === "Escape") close();
		});
	}

	// ── Helpers ───────────────────────────────────────────────────

	private replaceWithSpan(editor: Editor, innerText: string, classes: string[]): void {
		this.replaceWithSpanWrapped(editor, innerText, classes, []);
	}

	/** Replace selection with a span (or plain text), then re-wrap in any peeled markdown. */
	private replaceWithSpanWrapped(
		editor: Editor,
		innerText: string,
		classes: string[],
		wrappers: string[]
	): void {
		const valid = classes.filter(Boolean);
		let result = valid.length === 0
			? innerText
			: `<span class="${valid.join(" ")}">${innerText}</span>`;
		for (let i = wrappers.length - 1; i >= 0; i--) {
			result = wrappers[i] + result + wrappers[i];
		}
		editor.replaceSelection(result);
	}

	/**
	 * Called after any formatting operation — refocuses editor and hides toolbar.
	 */
	private afterFormat(editor: Editor): void {
		editor.focus();
		this.toolbar?.hide();
	}
}

// ── Settings Tab ──────────────────────────────────────────────────────

class RichTextToolbarSettingTab extends PluginSettingTab {
	plugin: RichTextToolbarPlugin;

	constructor(app: App, plugin: RichTextToolbarPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Rich Text Toolbar Settings" });

		// ── Toolbar Mode ──────────────────────────────────────────

		containerEl.createEl("h3", { text: "Toolbar Mode" });

		new Setting(containerEl)
			.setName("Enable floating toolbar")
			.setDesc("Show the formatting toolbar as a floating popup when text is selected.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.floatingToolbarEnabled)
					.onChange(async (value) => {
						this.plugin.settings.floatingToolbarEnabled = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Enable fixed toolbar")
			.setDesc("Always show the toolbar at a fixed position in the editor. Overrides floating mode.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.fixedToolbarEnabled)
					.onChange(async (value) => {
						this.plugin.settings.fixedToolbarEnabled = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Fixed toolbar position")
			.setDesc("Position of the toolbar when fixed mode is enabled.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("top", "Top")
					.addOption("bottom", "Bottom")
					.setValue(this.plugin.settings.fixedToolbarPosition)
					.onChange(async (value: "top" | "bottom") => {
						this.plugin.settings.fixedToolbarPosition = value;
						await this.plugin.saveSettings();
					})
			);

		// ── Font Sizes ────────────────────────────────────────────

		containerEl.createEl("h3", { text: "Font Sizes" });

		new Setting(containerEl)
			.setName("Font size presets")
			.setDesc("Comma-separated list of font sizes in pixels (e.g. 12,14,16,18,20,24,32).")
			.addText((text) =>
				text
					.setPlaceholder("12,14,16,18,20,24,32")
					.setValue(this.plugin.settings.fontSizes.join(","))
					.onChange(async (value) => {
						const sizes = value
							.split(",")
							.map((s) => parseInt(s.trim(), 10))
							.filter((n) => !isNaN(n) && n > 0);
						if (sizes.length > 0) {
							this.plugin.settings.fontSizes = sizes;
							await this.plugin.saveSettings();
						}
					})
			);

		// ── Text Colors ───────────────────────────────────────────

		containerEl.createEl("h3", { text: "Text Colors" });

		new Setting(containerEl)
			.setName("Text color presets")
			.setDesc(
				"Comma-separated list of name:hex pairs (e.g. red:#e53935,blue:#1e88e5)."
			)
			.addTextArea((text) => {
				text.setPlaceholder("red:#e53935, blue:#1e88e5")
					.setValue(
						this.plugin.settings.textColors
							.map(([n, h]) => `${n}:${h}`)
							.join(", ")
					)
					.onChange(async (value) => {
						const colors: [string, string][] = [];
						const pairs = value.split(",");
						for (const pair of pairs) {
							const [name, hex] = pair.split(":").map((s) => s.trim());
							if (name && hex) {
								colors.push([name, hex]);
							}
						}
						if (colors.length > 0) {
							this.plugin.settings.textColors = colors;
							await this.plugin.saveSettings();
						}
					});
				text.inputEl.style.minHeight = "60px";
			});

		// ── Highlight Colors ──────────────────────────────────────

		containerEl.createEl("h3", { text: "Highlight Colors" });

		new Setting(containerEl)
			.setName("Highlight color presets")
			.setDesc(
				"Comma-separated list of name:hex pairs (e.g. yellow:#fff59d,green:#c8e6c9)."
			)
			.addTextArea((text) => {
				text.setPlaceholder("yellow:#fff59d, green:#c8e6c9")
					.setValue(
						this.plugin.settings.highlightColors
							.map(([n, h]) => `${n}:${h}`)
							.join(", ")
					)
					.onChange(async (value) => {
						const colors: [string, string][] = [];
						const pairs = value.split(",");
						for (const pair of pairs) {
							const [name, hex] = pair.split(":").map((s) => s.trim());
							if (name && hex) {
								colors.push([name, hex]);
							}
						}
						if (colors.length > 0) {
							this.plugin.settings.highlightColors = colors;
							await this.plugin.saveSettings();
						}
					});
				text.inputEl.style.minHeight = "60px";
			});

		// ── Theme ─────────────────────────────────────────────────

		containerEl.createEl("h3", { text: "Theme" });

		new Setting(containerEl)
			.setName("Theme integration")
			.setDesc(
				"Adjust formatting colors for dark/light themes automatically."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.themeIntegration)
					.onChange(async (value) => {
						this.plugin.settings.themeIntegration = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
