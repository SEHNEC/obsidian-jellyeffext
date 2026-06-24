import type { RichTextToolbarSettings } from "./defaults";
import { ICONS } from "./icons";

export interface IToolbarOwner {
	settings: RichTextToolbarSettings;
	applyFontSize(size: number): void;
	showCustomSizeDialog(): void;
	applyTextColor(name: string): void;
	removeTextColor(): void;
	showTextColorPicker(): void;
	applyHighlightColor(name: string): void;
	removeHighlightColor(): void;
	showHighlightPicker(): void;
	clearFormatting(): void;
}

export interface ToolbarAction {
	type: "button";
	id: string;
	icon?: string;
	label?: string;
	title: string;
	checkActive?: () => boolean;
	action: () => void;
}

export interface ToolbarSeparator {
	type: "separator";
}

export interface ToolbarFontSize {
	type: "fontSize";
}

export interface ToolbarTextColor {
	type: "textColor";
}

export interface ToolbarHighlightColor {
	type: "highlightColor";
}

export interface ToolbarClear {
	type: "clear";
}

export type ToolbarItem =
	| ToolbarAction
	| ToolbarSeparator
	| ToolbarFontSize
	| ToolbarTextColor
	| ToolbarHighlightColor
	| ToolbarClear;

export class Toolbar {
	private wrapper: HTMLElement;
	private toolbar: HTMLElement;
	private items: ToolbarItem[] = [];
	owner: IToolbarOwner;

	constructor(owner: IToolbarOwner) {
		this.owner = owner;
		this.wrapper = document.body.createDiv("rt-toolbar-wrapper");
		this.toolbar = this.wrapper.createDiv("rt-toolbar");
		this.toolbar.addEventListener("mousedown", (e) => {
			const target = e.target as HTMLElement;
			if (!target.closest(".rt-select-wrap")) {
				this.closeDropdowns();
			}
		});
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
		const btn = wrap.createEl("button", { cls: "rt-select-btn", text: "Size" });
		const dropdown = wrap.createDiv("rt-select-dropdown");
		dropdown.style.display = "none";

		const options = [
			...this.owner.settings.fontSizes.map((s) => ({ label: `${s}px`, value: String(s) })),
			{ label: "Custom...", value: "custom" },
		];

		for (const opt of options) {
			const item = dropdown.createDiv({ cls: "rt-select-option", text: opt.label });
			item.addEventListener("mousedown", (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.closeDropdowns();
				if (opt.value === "custom") {
					this.owner.showCustomSizeDialog();
				} else {
					this.owner.applyFontSize(parseInt(opt.value, 10));
				}
			});
		}

		btn.addEventListener("mousedown", (e) => {
			e.preventDefault();
			e.stopPropagation();
			const isOpen = dropdown.style.display !== "none";
			this.closeDropdowns();
			if (!isOpen) dropdown.style.display = "block";
		});
	}

	private closeDropdowns(): void {
		this.toolbar.querySelectorAll<HTMLElement>(".rt-select-dropdown").forEach((d) => {
			d.style.display = "none";
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

		const none = group.createDiv({ cls: "rt-color-swatch rt-color-none", attr: { title: "Remove color" } });
		none.addEventListener("mousedown", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.owner.removeTextColor();
		});

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

		const none = group.createDiv({ cls: "rt-color-swatch rt-color-none", attr: { title: "Remove highlight" } });
		none.addEventListener("mousedown", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.owner.removeHighlightColor();
		});

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
		this.closeDropdowns();
		this.wrapper.removeClass("rt-visible");
	}

	isVisible(): boolean {
		return this.wrapper.hasClass("rt-visible");
	}

	setPosition(anchor: { top: number; bottom: number; centerX: number }): void {
		const rect = this.toolbar.getBoundingClientRect();
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const gap = 8;
		const margin = 4;

		// Prefer placing above the selection's top; fall back to below its bottom.
		let finalTop = anchor.top - rect.height - gap;
		if (finalTop < margin) finalTop = anchor.bottom + gap;
		if (finalTop + rect.height > vh - margin) finalTop = vh - rect.height - margin;
		if (finalTop < margin) finalTop = margin;

		let finalLeft = anchor.centerX - rect.width / 2;
		if (finalLeft < margin) finalLeft = margin;
		if (finalLeft + rect.width > vw - margin) finalLeft = vw - rect.width - margin;

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
