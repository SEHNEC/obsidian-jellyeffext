import { App, Editor, MarkdownView } from "obsidian";

export function getEditor(app: App): Editor | null {
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	if (!view) return null;
	const state = (view as any).getMode?.() ?? "source";
	if (state === "preview") return null;
	return view.editor;
}

export function getCodeMirrorView(editor: Editor): any {
	return (editor as any).cm ?? null;
}
