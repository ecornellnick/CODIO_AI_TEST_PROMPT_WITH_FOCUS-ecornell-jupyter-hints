# CODIO_AI_TEST_PROMPT_ecornell-jupyter-hints

This repository contains a **test Codio Coach extension** for providing Jupyter notebook hints with **cell-focus awareness**.

The goal of this implementation is to evaluate whether we can reliably detect **which Jupyter notebook cell a student is actively focused on at the time they request a hint**, and pass that context to the Codio AI Coach.

> NOTE: This is an exploratory/test implementation. The AI prompt itself is intentionally left unchanged for now.

---

## High-level behavior

When a student clicks the Coach hint button:

1. The extension collects the open Jupyter notebook context from Codio.
2. The extension attempts to detect the currently focused notebook cell using the JupyterLab DOM.
3. A deterministic test message is written to the Coach UI indicating which cell is detected as active.
4. A reduced, cell-local notebook context is passed to the Coach prompt.
5. The Coach responds using the existing managed prompt.

---

## Cell focus detection (test implementation)

Cell focus is detected using **DOM-based inspection** of the JupyterLab UI:

- JupyterLab marks the active/selected cell with CSS classes such as `.jp-mod-active` and `.jp-mod-selected`.
- The extension queries the DOM for these markers and computes the active cell’s index within the notebook.
- That index is mapped back to the notebook JSON provided by Codio.

If a focused cell cannot be detected, the extension falls back gracefully and reports the focus as `UNKNOWN`.

A deterministic test banner is always written to the Coach output, for example:

> 🧪 This is a test bot for cell focus. The cell in focus is Cell 3 (code): "for i in range(n):"

This banner is **not AI-generated**, allowing focus detection to be validated independently of model behavior.

---

## Notebook context passed to the Coach

### Passing markdown and code cell types
- The open notebook is accessed via `context.jupyterContext[0].content`.
- Only `markdown` and `code` cell types are included.
- Each cell is annotated with its original notebook index.

### Focused context window
- When a focused cell is detected, only the focused cell and its immediate neighbors are passed to the Coach.
- This encourages cell-specific hints during testing and avoids whole-notebook responses.

---

## Prompt usage

The Coach prompt is loaded from Codio Prompt Management:

```js
const userPrompt = "{% prompt 'JUPYTER_HINTS_WITH_SOLUTION' %}"
