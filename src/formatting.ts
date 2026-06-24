export function parseSpan(text: string): { classes: string; inner: string; match: string } | null {
	const re = /^<span\s+class="([^"]*)"\s*>([\s\S]*?)<\/span>$/;
	const m = text.match(re);
	if (!m) return null;
	return { classes: m[1], inner: m[2], match: m[0] };
}

export function splitClasses(c: string): string[] {
	return c.split(/\s+/).filter(Boolean);
}

export function isBoldWrapped(text: string): boolean {
	if (!text.startsWith("**") || !text.endsWith("**") || text.length <= 4) return false;
	return !text.slice(2, -2).includes("**");
}

export function isItalicWrapped(text: string): boolean {
	if (!text.startsWith("*") || !text.endsWith("*") || text.length <= 2) return false;
	if (text.startsWith("**")) return false;
	return !text.slice(1, -1).replace(/\*\*/g, "").includes("*");
}

export function isStrikethroughWrapped(text: string): boolean {
	if (!text.startsWith("~~") || !text.endsWith("~~") || text.length <= 4) return false;
	return !text.slice(2, -2).includes("~~");
}

export function isCodeWrapped(text: string): boolean {
	if (!text.startsWith("`") || !text.endsWith("`") || text.length <= 2) return false;
	return !text.slice(1, -1).includes("`");
}

export function parseMarkdownWrappers(text: string): { inner: string; wrappers: string[] } {
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

export function parseSpanThroughMarkdown(text: string): {
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

export function hasUnderlineClass(text: string): boolean {
	const span = parseSpan(text);
	if (!span) return false;
	return splitClasses(span.classes).includes("rt-underline");
}

export function getClassByPrefix(classes: string, prefix: string): string | null {
	return splitClasses(classes).find((c) => c.startsWith(prefix)) ?? null;
}
