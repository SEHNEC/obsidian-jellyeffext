import { Editor, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, RichTextToolbarSettings } from "./defaults";
import { ICONS } from "./icons";
import { buildFormattingCSS } from "./dynamic-css";
import { getEditor, getCodeMirrorView } from "./editor";
import {
	isBoldWrapped,
	isItalicWrapped,
	isStrikethroughWrapped,
	isCodeWrapped,
	parseMarkdownWrappers,
	parseSpan,
	parseSpanThroughMarkdown,
	splitClasses,
} from "./formatting";

import { Toolbar, ToolbarItem } from "./toolbar";
import { RichTextToolbarSettingTab } from "./settings-tab";
import { registerSelectionFrame, showFrame, clearFrame, tryAutoSelectSpan } from "./selection-frame";

export default class RichTextToolbarPlugin extends Plugin {
	settings: RichTextToolbarSettings;
	private toolbar: Toolbar | null = null;
	private dynamicStyleEl: HTMLStyleElement | null = null;
	private savedSelection: { from: number; to: number } | null = null;

	// ── Lifecycle ─────────────────────────────────────────────────

	async onload(): Promise<void> {
		await this.loadSettings();

		this.injectDynamicCSS();

		this.toolbar = new Toolbar(this);
		this.buildToolbarItems();

		this.registerCommands();
		this.registerKeyboardShortcuts();

		this.registerDomEvent(document, "mouseup", () => {
			setTimeout(() => {
				const editor = this.getEditor();
				if (editor) {
					const cm = this.getCodeMirrorView(editor);
					if (cm) tryAutoSelectSpan(cm);
				}
				this.onSelectionChanged();
			}, 50);
		});

		this.registerDomEvent(document, "keyup", (e: KeyboardEvent) => {
			if (
				e.shiftKey ||
				e.key === "ArrowLeft" || e.key === "ArrowRight" ||
				e.key === "ArrowUp" || e.key === "ArrowDown" ||
				e.key === "Home" || e.key === "End" ||
				(e.ctrlKey && e.key === "a") || (e.metaKey && e.key === "a")
			) {
				setTimeout(() => this.onSelectionChanged(), 50);
			}
		});

		this.registerDomEvent(document, "mousedown", (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (this.toolbar?.isVisible()) {
				const toolbarEl = this.toolbar.getElement();
				if (!toolbarEl.contains(target) && !target.closest(".rt-picker-overlay")) {
					this.toolbar.hide();
				}
			}
		});

		this.registerDomEvent(document, "scroll", () => {
			this.toolbar?.hide();
		}, { capture: true });

		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				this.toolbar?.hide();
				this.updateFixedToolbar();
				this.tryRegisterSelectionFrame();
			})
		);

		this.tryRegisterSelectionFrame();
		this.addSettingTab(new RichTextToolbarSettingTab(this.app, this));
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
			{ type: "button", id: "bold", icon: ICONS.bold, title: "Bold (Ctrl+B)", action: () => this.toggleBold() },
			{ type: "button", id: "italic", icon: ICONS.italic, title: "Italic (Ctrl+I)", action: () => this.toggleItalic() },
			{ type: "button", id: "underline", icon: ICONS.underline, title: "Underline (Ctrl+U)", action: () => this.toggleUnderline() },
			{ type: "button", id: "strikethrough", icon: ICONS.strikethrough, title: "Strikethrough", action: () => this.toggleStrikethrough() },
			{ type: "button", id: "code", icon: ICONS.code, title: "Inline Code", action: () => this.toggleCode() },
			{ type: "fontSize" },
			{ type: "textColor" },
			{ type: "highlightColor" },
			{ type: "clear" },
		];

		this.toolbar.setItems(items);
	}

	// ── Commands ──────────────────────────────────────────────────

	private registerCommands(): void {
		this.addCommand({ id: "toggle-bold", name: "Toggle Bold", editorCallback: () => this.toggleBold() });
		this.addCommand({ id: "toggle-italic", name: "Toggle Italic", editorCallback: () => this.toggleItalic() });
		this.addCommand({ id: "toggle-underline", name: "Toggle Underline", editorCallback: () => this.toggleUnderline() });
		this.addCommand({ id: "toggle-strikethrough", name: "Toggle Strikethrough", editorCallback: () => this.toggleStrikethrough() });
		this.addCommand({ id: "toggle-inline-code", name: "Toggle Inline Code", editorCallback: () => this.toggleCode() });
		this.addCommand({ id: "clear-formatting", name: "Clear Formatting", editorCallback: () => this.clearFormatting() });
	}

	private registerKeyboardShortcuts(): void {
		for (const size of [12, 14, 16, 18, 20, 24, 32]) {
			this.addCommand({
				id: `font-size-${size}`,
				name: `Set font size: ${size}px`,
				editorCallback: () => this.applyFontSize(size),
			});
		}
	}

	// ── Editor Helpers ────────────────────────────────────────────

	private tryRegisterSelectionFrame(): void {
		const editor = this.getEditor();
		if (!editor) return;
		const cm = this.getCodeMirrorView(editor);
		if (cm) registerSelectionFrame(cm);
	}

	private flashFrame(): void {
		if (!this.savedSelection) return;
		const editor = this.getEditor();
		if (!editor) return;
		const cm = this.getCodeMirrorView(editor);
		if (cm) showFrame(cm, this.savedSelection.from, this.savedSelection.to);
	}

	private clearFrameNow(): void {
		const editor = this.getEditor();
		if (!editor) return;
		const cm = this.getCodeMirrorView(editor);
		if (cm) clearFrame(cm);
	}

	// Expands selection to enclosing rt-span if current selection doesn't already contain one
	private expandSelectionToSpan(editor: Editor): string {
		const sel = editor.getSelection();
		if (parseSpan(sel)) return sel; // already a full span

		const cm = this.getCodeMirrorView(editor);
		if (!cm) return sel;

		const pos = editor.posToOffset(editor.getCursor("from"));
		const doc: string = cm.state.doc.toString();

		// Try rt- span
		let searchFrom = pos;
		while (searchFrom >= 0) {
			const spanStart = doc.lastIndexOf("<span", searchFrom);
			if (spanStart === -1) break;
			const tagClose = doc.indexOf(">", spanStart);
			if (tagClose === -1) break;
			const tag = doc.slice(spanStart, tagClose + 1);
			if (tag.includes("rt-")) {
				if (pos > tagClose) {
					const spanEnd = doc.indexOf("</span>", tagClose);
					if (spanEnd !== -1 && pos <= spanEnd) {
						const from = editor.offsetToPos(spanStart);
						const to = editor.offsetToPos(spanEnd + 7);
						editor.setSelection(from, to);
						return editor.getSelection();
					}
				}
				break;
			}
			searchFrom = spanStart - 1;
		}

		// Try markdown wrappers on same line
		const lineStart = doc.lastIndexOf("\n", pos - 1) + 1;
		const lineEndRaw = doc.indexOf("\n", pos);
		const lineEnd = lineEndRaw === -1 ? doc.length : lineEndRaw;
		const line = doc.slice(lineStart, lineEnd);
		const localPos = pos - lineStart;

		for (const m of ["**", "~~", "`", "*"]) {
			const openIdx = line.lastIndexOf(m, localPos - 1);
			if (openIdx === -1) continue;
			if (m === "*" && (line[openIdx - 1] === "*" || line[openIdx + 1] === "*")) continue;
			const closeIdx = line.indexOf(m, localPos);
			if (closeIdx === -1 || closeIdx === openIdx) continue;
			if (m === "*" && (line[closeIdx - 1] === "*" || line[closeIdx + 1] === "*")) continue;
			const from = editor.offsetToPos(lineStart + openIdx);
			const to = editor.offsetToPos(lineStart + closeIdx + m.length);
			editor.setSelection(from, to);
			return editor.getSelection();
		}

		return sel;
	}

	private getEditor(): Editor | null {
		return getEditor(this.app);
	}

	private getCodeMirrorView(editor: Editor): any {
		return getCodeMirrorView(editor);
	}

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

	private getSelectionWithFallback(editor: Editor): string {
		const sel = editor.getSelection();
		if (sel) return sel;
		if (this.savedSelection) {
			const from = editor.offsetToPos(this.savedSelection.from);
			const to = editor.offsetToPos(this.savedSelection.to);
			editor.setSelection(from, to);
			return editor.getSelection();
		}
		return "";
	}

	// ── Selection Change Handler ───────────────────────────────────

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

		if (!this.settings.floatingToolbarEnabled || this.settings.fixedToolbarEnabled) {
			return;
		}

		this.saveCurrentSelection(editor);

		const cm = this.getCodeMirrorView(editor);
		if (!cm || typeof cm.coordsAtPos !== "function") return;

		const fromOffset = editor.posToOffset(editor.getCursor("from"));
		const toOffset = editor.posToOffset(editor.getCursor("to"));
		const fromCoords = cm.coordsAtPos(fromOffset);
		const toCoords = cm.coordsAtPos(toOffset);
		if (!fromCoords || !toCoords) return;

		const sameLine = Math.abs(fromCoords.top - toCoords.top) < 2;
		const centerX = sameLine
			? (fromCoords.left + toCoords.left) / 2
			: fromCoords.left;

		this.toolbar?.setPosition({
			top: fromCoords.top,
			bottom: toCoords.bottom,
			centerX,
		});
		this.toolbar?.show();
	}

	// ── Fixed Toolbar ──────────────────────────────────────────────

	private fixedToolbarInserted = false;

	private updateFixedToolbar(): void {
		if (!this.toolbar) return;
		this.removeFixedToolbar();
		if (!this.settings.fixedToolbarEnabled) return;

		const editor = this.getEditor();
		if (!editor) return;

		const cm = this.getCodeMirrorView(editor);
		if (!cm?.dom) return;

		const scrollDom = cm.dom as HTMLElement;
		const wrapper = this.toolbar.getElement();

		wrapper.addClass(this.settings.fixedToolbarPosition === "top" ? "rt-fixed-top" : "rt-fixed-bottom");
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
			editor.replaceSelection(selection.slice(2, -2));
		} else {
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
		const selection = this.expandSelectionToSpan(editor);
		if (!selection) return;
		const parsed = parseSpanThroughMarkdown(selection);
		if (!parsed) return;
		const { span, wrappers } = parsed;
		const classes = splitClasses(span.classes).filter((c) => !c.startsWith("rt-color-"));
		this.replaceWithSpanWrapped(editor, span.inner, classes, wrappers);
		this.afterFormat(editor);
		this.clearFrameNow();
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
		const selection = this.expandSelectionToSpan(editor);
		if (!selection) return;
		const parsed = parseSpanThroughMarkdown(selection);
		if (!parsed) return;
		const { span, wrappers } = parsed;
		const classes = splitClasses(span.classes).filter((c) => !c.startsWith("rt-bg-"));
		this.replaceWithSpanWrapped(editor, span.inner, classes, wrappers);
		this.afterFormat(editor);
		this.clearFrameNow();
	}

	// ── Formatting: Clear ─────────────────────────────────────────

	clearFormatting(): void {
		const editor = this.getEditor();
		if (!editor) return;
		const selection = this.expandSelectionToSpan(editor);
		if (!selection) return;
		const { inner } = parseMarkdownWrappers(selection);
		const span = parseSpan(inner);
		editor.replaceSelection(span ? span.inner : inner);
		this.afterFormat(editor);
		this.clearFrameNow();
	}

	// ── Color Picker Dialogs ──────────────────────────────────────

	showTextColorPicker(): void {
		this.showColorPicker("Choose text color", (hex) => {
			const name = "custom-" + hex.replace("#", "");
			if (!this.settings.textColors.some(([n]) => n === name)) {
				this.settings.textColors.push([name, hex]);
				this.saveSettings();
			}
			const editor = this.getEditor();
			if (!editor) return;
			const selection = this.getSelectionWithFallback(editor);
			if (!selection) return;
			const parsed = parseSpanThroughMarkdown(selection);
			const classes = parsed ? splitClasses(parsed.span.classes).filter((c) => !c.startsWith("rt-color-")) : [];
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
			if (!this.settings.highlightColors.some(([n]) => n === name)) {
				this.settings.highlightColors.push([name, hex]);
				this.saveSettings();
			}
			const editor = this.getEditor();
			if (!editor) return;
			const selection = this.getSelectionWithFallback(editor);
			if (!selection) return;
			const parsed = parseSpanThroughMarkdown(selection);
			const classes = parsed ? splitClasses(parsed.span.classes).filter((c) => !c.startsWith("rt-bg-")) : [];
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
		const cancelBtn = actions.createEl("button", { text: "Cancel", cls: "rt-picker-cancel" });
		const applyBtn = actions.createEl("button", { text: "Apply", cls: "rt-picker-apply" });

		const close = () => overlay.remove();

		cancelBtn.addEventListener("click", close);
		overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

		applyBtn.addEventListener("click", () => {
			const val = parseInt(input.value, 10);
			if (val && val > 0 && val <= 200) this.applyFontSize(val);
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

		const colorInput = dialog.createEl("input", { attr: { type: "color", value: "#000000" } });

		const actions = dialog.createDiv("rt-picker-actions");
		const cancelBtn = actions.createEl("button", { text: "Cancel", cls: "rt-picker-cancel" });
		const applyBtn = actions.createEl("button", { text: "Apply", cls: "rt-picker-apply" });

		const close = () => overlay.remove();

		cancelBtn.addEventListener("click", close);
		overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
		applyBtn.addEventListener("click", () => { onChoose(colorInput.value); close(); });
		colorInput.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
	}

	// ── Helpers ───────────────────────────────────────────────────

	private replaceWithSpan(editor: Editor, innerText: string, classes: string[]): void {
		this.replaceWithSpanWrapped(editor, innerText, classes, []);
	}

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

	private afterFormat(editor: Editor): void {
		editor.focus();
		this.toolbar?.hide();
		this.flashFrame();
	}
}
