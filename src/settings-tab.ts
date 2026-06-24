import { App, PluginSettingTab, Setting } from "obsidian";
import type RichTextToolbarPlugin from "./main";

export class RichTextToolbarSettingTab extends PluginSettingTab {
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
			.setDesc("Comma-separated list of name:hex pairs (e.g. red:#e53935,blue:#1e88e5).")
			.addTextArea((text) => {
				text.setPlaceholder("red:#e53935, blue:#1e88e5")
					.setValue(
						this.plugin.settings.textColors
							.map(([n, h]) => `${n}:${h}`)
							.join(", ")
					)
					.onChange(async (value) => {
						const colors: [string, string][] = [];
						for (const pair of value.split(",")) {
							const [name, hex] = pair.split(":").map((s) => s.trim());
							if (name && hex) colors.push([name, hex]);
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
			.setDesc("Comma-separated list of name:hex pairs (e.g. yellow:#fff59d,green:#c8e6c9).")
			.addTextArea((text) => {
				text.setPlaceholder("yellow:#fff59d, green:#c8e6c9")
					.setValue(
						this.plugin.settings.highlightColors
							.map(([n, h]) => `${n}:${h}`)
							.join(", ")
					)
					.onChange(async (value) => {
						const colors: [string, string][] = [];
						for (const pair of value.split(",")) {
							const [name, hex] = pair.split(":").map((s) => s.trim());
							if (name && hex) colors.push([name, hex]);
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
			.setDesc("Adjust formatting colors for dark/light themes automatically.")
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
