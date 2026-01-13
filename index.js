// Wrapping the whole extension in a JS function
// (ensures all global variables set in this extension cannot be referenced outside its scope)
(async function(codioIDE, window) {

  // Use a very specific button ID to avoid any clashes with other extensions
  codioIDE.coachBot.register(
    "jupyterHintsWithSolution",
    "Provide a hint on what to do next",
    onButtonPress
  )

  // --- NEW: helper to detect active cell index from the JupyterLab DOM ---
  function getActiveCellIndexFromDom() {
    try {
      // Common JupyterLab markers for the active/selected cell
      const activeCellEl =
        document.querySelector(".jp-Notebook .jp-Cell.jp-mod-active") ||
        document.querySelector(".jp-Notebook .jp-Cell.jp-mod-selected") ||
        document.querySelector(".jp-Notebook-cell.jp-mod-active") ||
        document.querySelector(".jp-Notebook-cell.jp-mod-selected") ||
        document.querySelector(".jp-Cell.jp-mod-active") ||
        document.querySelector(".jp-Cell.jp-mod-selected")

      if (!activeCellEl) return null

      // Prefer narrowing to the nearest notebook container
      const notebookEl =
        activeCellEl.closest(".jp-Notebook") ||
        activeCellEl.closest(".jp-NotebookPanel") ||
        document.querySelector(".jp-Notebook")

      // Collect all cell nodes in that notebook
      const cellEls = notebookEl
        ? Array.from(notebookEl.querySelectorAll(".jp-Cell, .jp-Notebook-cell"))
        : Array.from(document.querySelectorAll(".jp-Cell, .jp-Notebook-cell"))

      if (!cellEls.length) return null

      const idx = cellEls.indexOf(activeCellEl)
      return idx >= 0 ? idx : null
    } catch (e) {
      console.warn("Failed to detect active cell from DOM:", e)
      return null
    }
  }

  // function called when the button is pressed
  async function onButtonPress() {
    try {
      // automatically collects all available context
      const context = await codioIDE.coachBot.getContext()

      // Check if jupyter context exists
      if (!context.jupyterContext || context.jupyterContext.length === 0) {
        codioIDE.coachBot.write("No Jupyter notebook is currently open.")
        codioIDE.coachBot.showMenu()
        return
      }

      // select open jupyterlab notebook related context
      const openJupyterFileContext = context.jupyterContext[0]
      const jupyterFileContent = openJupyterFileContext.content

      // filter and map cell indices of code and markdown cells into a new array
      const markdownAndCodeCells = jupyterFileContent
        .map(({ id, ...rest }, index) => ({
          cell: index,
          ...rest
        }))
        .filter(obj => obj.type === 'markdown' || obj.type === 'code')

      // --- NEW: detect focused/active cell index at click time (DOM-based) ---
      const activeCellIndex = getActiveCellIndexFromDom()

      // Map active index back to the JSON cell object (if possible)
      const activeCellObj =
        (activeCellIndex !== null)
          ? (markdownAndCodeCells.find(c => c.cell === activeCellIndex) || null)
          : null

      // --- NEW: deterministic test banner (NOT AI-generated) ---
      const focusLabel = (() => {
        if (activeCellIndex === null) return "UNKNOWN (could not detect focused cell)"
        if (!activeCellObj) return `Cell ${activeCellIndex} (detected in DOM, but not mapped to notebook JSON)`

        // Try the most likely fields where Codio stores cell text
        const raw =
          (activeCellObj.content ??
           activeCellObj.source ??
           activeCellObj.text ??
           "").toString()

        const firstLine = raw.split("\n").find(l => l.trim().length > 0) || ""
        const preview = firstLine.trim().slice(0, 80)

        return `Cell ${activeCellIndex} (${activeCellObj.type})${preview ? `: "${preview}"` : ""}`
      })()

      codioIDE.coachBot.write(`🧪 This is a test bot for cell focus. The cell in focus is ${focusLabel}.`)

      // --- OPTIONAL: reduce context to focused cell + neighbors to encourage cell-specific hints ---
      // If you want the full notebook, set contextSlice = markdownAndCodeCells
      let contextSlice = markdownAndCodeCells
      if (activeCellIndex !== null) {
        const neighborWindow = 1 // change to 0 for only the focused cell, 2 for a wider local window
        contextSlice = markdownAndCodeCells.filter(c => Math.abs(c.cell - activeCellIndex) <= neighborWindow)
      }

      // Serialize notebook context to send into the VARIABLE in the Codio prompt template
      const notebookJson = JSON.stringify(contextSlice)

      // Also provide focused cell context explicitly (even if you don't change the prompt yet)
      const activeCellJson = JSON.stringify(activeCellObj)

      // Reference the Codio Prompt Management template by ID
      const userPrompt = "{% prompt 'JUPYTER_HINTS_WITH_SOLUTION' %}"

      // Ask CoachBot using the managed prompt.
      const result = await codioIDE.coachBot.ask({
        userPrompt: userPrompt,
        vars: {
          "JUPYTER_NOTEBOOK": notebookJson,
          "ACTIVE_CELL_INDEX": activeCellIndex,
          "ACTIVE_CELL_JSON": activeCellJson
        }
      })

      // In some Codio examples, ask() returns a string; in others, an object.
      // Handle both but ONLY write when we actually have content.
      let answer = null

      if (typeof result === "string") {
        answer = result
      } else if (result && typeof result.response === "string") {
        answer = result.response
      }

      if (answer) {
        codioIDE.coachBot.write(answer)
      }

      codioIDE.coachBot.showMenu()

    } catch (error) {
      codioIDE.coachBot.write("An unexpected error occurred.")
      codioIDE.coachBot.showMenu()
      // Optional: log to browser console for debugging
      console.error("CoachBot error in CODIO_AI_TEST_PROMPT_customHintsJupyter:", error)
    }
  }

})(window.codioIDE, window)
