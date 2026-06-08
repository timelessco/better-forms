// Bridge so the preview toggle (outside the Plate context) can close the open block menu.
// The portaled block menu lives inside an <Activity> subtree; a reactive subscription there is torn
// down on hide before it can react. Instead the menu registers its close fn while mounted and the
// toggle calls it synchronously, before the editor is hidden. Single editor at a time → one slot.
let closeFn: (() => void) | null = null;

export const registerBlockMenuClose = (fn: () => void): void => {
  closeFn = fn;
};

// Guarded clear: only unregister if still the same fn, so a remount that registers a new fn before
// the old instance's cleanup runs isn't clobbered.
export const unregisterBlockMenuClose = (fn: () => void): void => {
  if (closeFn === fn) closeFn = null;
};

export const closeOpenBlockMenu = (): void => {
  closeFn?.();
};
