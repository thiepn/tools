// HTMLSelectElement has no native readonly state, while the Expert Workspace
// intentionally treats inputs, textareas, and selects as one introspection union.
// Keeping this optional makes the shared `readOnly` guard reflect runtime
// semantics: undefined/false for selects, the native boolean for text inputs.
interface HTMLSelectElement {
  readonly readOnly?: false;
}
