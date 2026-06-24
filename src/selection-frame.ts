import { StateField, StateEffect } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";

// ── Persistent frame after formatting ─────────────────────────────

export const setFrameEffect = StateEffect.define<{ from: number; to: number } | null>();

const frameField = StateField.define<DecorationSet>({
	create() {
		return Decoration.none;
	},
	update(deco, tr) {
		for (const effect of tr.effects) {
			if (effect.is(setFrameEffect)) {
				if (!effect.value) return Decoration.none;
				const { from, to } = effect.value;
				return Decoration.set([
					Decoration.mark({ class: "rt-selection-frame" }).range(from, to),
				]);
			}
		}
		if (tr.docChanged) return Decoration.none;
		return deco.map(tr.changes);
	},
	provide: (f) => EditorView.decorations.from(f),
});

export function registerSelectionFrame(cm: EditorView): void {
	cm.dispatch({
		effects: StateEffect.appendConfig.of([frameField]),
	});
}

export function showFrame(cm: EditorView, from: number, to: number): void {
	cm.dispatch({ effects: setFrameEffect.of({ from, to }) });
	setTimeout(() => {
		cm.dispatch({ effects: setFrameEffect.of(null) });
	}, 2000);
}

export function clearFrame(cm: EditorView): void {
	cm.dispatch({ effects: setFrameEffect.of(null) });
}

// ── Auto-select span on click ──────────────────────────────────────

export function tryAutoSelectSpan(cm: EditorView): void {
	const sel = cm.state.selection.main;
	if (!sel.empty) return; // Already has a real selection

	const pos = sel.head;
	const doc = cm.state.doc.toString();

	// Walk backwards to find the nearest opening <span with rt- class
	let searchFrom = pos;
	while (searchFrom >= 0) {
		const spanStart = doc.lastIndexOf("<span", searchFrom);
		if (spanStart === -1) return;

		const tagClose = doc.indexOf(">", spanStart);
		if (tagClose === -1) return;

		const tag = doc.slice(spanStart, tagClose + 1);

		// Only care about our rt- spans
		if (tag.includes("rt-")) {
			// Cursor must be after the closing > of the opening tag
			if (pos > tagClose) {
				const spanEnd = doc.indexOf("</span>", tagClose);
				if (spanEnd === -1) return;
				// Cursor must be before </span>
				if (pos <= spanEnd) {
					// Select the full span including tags so formatting ops can parse it
					const from = spanStart;
					const to = spanEnd + 7; // length of </span>
					cm.dispatch({ selection: { anchor: from, head: to } });
				}
			}
			return;
		}

		// Not our span, keep searching further back
		searchFrom = spanStart - 1;
	}
}
