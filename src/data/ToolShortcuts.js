// Single-key tool shortcuts (no modifiers). Used by the App key handler and
// shown as hints in the Toolbar tools dropdown.
export const TOOL_SHORTCUTS = {
  v: 'select',
  h: 'pan',
  k: 'token',
  o: 'pointer',
  l: 'ruler',
  r: 'rectangle',
  t: 'text',
  p: 'draw',
  e: 'eraser',
};

export const SHORTCUT_FOR_TOOL = Object.fromEntries(
  Object.entries(TOOL_SHORTCUTS).map(([key, tool]) => [tool, key.toUpperCase()])
);
