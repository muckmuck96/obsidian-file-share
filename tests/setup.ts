// Obsidian exposes `activeWindow` / `activeDocument` globals that point at the
// currently focused (possibly popped-out) window/document. They don't exist in
// jest's plain Node environment, so provide sensible fallbacks for tests.
const globalScope = globalThis as unknown as {
	activeWindow?: unknown;
	activeDocument?: unknown;
	window?: Window;
	document?: Document;
};

if (typeof globalScope.activeWindow === "undefined") {
	globalScope.activeWindow = globalScope.window ?? globalThis;
}

if (
	typeof globalScope.activeDocument === "undefined" &&
	typeof globalScope.document !== "undefined"
) {
	globalScope.activeDocument = globalScope.document;
}

export {};
