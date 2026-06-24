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

// ── Auto-select formatted range on click ──────────────────────────

export function tryAutoSelectSpan(cm: EditorView): void {
	const sel = cm.state.selection.main;
	if (!sel.empty) return;

	const pos = sel.head;
	const doc = cm.state.doc.toString();

	// 1. Try rt- span
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
					cm.dispatch({ selection: { anchor: spanStart, head: spanEnd + 7 } });
					return;
				}
			}
			break;
		}
		searchFrom = spanStart - 1;
	}

	// 2. Try markdown wrappers — check on the same line only
	const lineStart = doc.lastIndexOf("\n", pos - 1) + 1;
	const lineEndRaw = doc.indexOf("\n", pos);
	const lineEnd = lineEndRaw === -1 ? doc.length : lineEndRaw;
	const line = doc.slice(lineStart, lineEnd);
	const localPos = pos - lineStart;

	// Order matters: check ** before * to avoid partial match
	const markers = ["**", "~~", "`", "*"];
	for (const m of markers) {
		const openIdx = line.lastIndexOf(m, localPos - 1);
		if (openIdx === -1) continue;

		// For single *, ensure it's not part of **
		if (m === "*") {
			if (line[openIdx - 1] === "*" || line[openIdx + 1] === "*") continue;
		}

		const closeIdx = line.indexOf(m, localPos);
		if (closeIdx === -1 || closeIdx === openIdx) continue;

		// For single *, ensure close is not part of **
		if (m === "*") {
			if (line[closeIdx - 1] === "*" || line[closeIdx + 1] === "*") continue;
		}

		const from = lineStart + openIdx;
		const to = lineStart + closeIdx + m.length;
		cm.dispatch({ selection: { anchor: from, head: to } });
		return;
	}
}
