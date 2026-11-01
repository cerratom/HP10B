# AGENTS.md — How to build the HP-10B Web Calculator

> **You are the agent that builds this app.** Read this file first, then read
> [`specs.md`](specs.md) in full. The spec is the single source of truth for *what*
> and *how*. This file is the short operating manual.

## What you're building

A faithful, web-based recreation of the **HP-10B Business/Financial Calculator**:
full feature parity, pixel-faithful UI, pure vanilla JS, no backend.

- **Source of truth for behavior:** `Assets/User_Manual.pdf` (HP-10B Owner's Manual).
- **Source of truth for appearance:** `Assets/HP-10B.jpg` (photo of the physical unit).
- **Authoritative spec:** [`specs.md`](specs.md).

## Hard constraints (do not deviate without a recorded decision)

1. **Vanilla JS + CSS + HTML only.** No frameworks, no bundler, no package manager,
   no build step, no dependencies.
2. **No backend.** No Python, no server, no API, no network calls. All math in JS.
3. **Entry point is `index.html`** and it must work when opened directly (`file://`)
   as well as from any static host.
4. **Exactly 3 app files at the repo root:** `index.html`, `styles.css`, `app.js`.
   Keep `app.js` organized into clearly-named sections; only split into ES modules if
   it becomes genuinely unmanageable (record a decision if you do).
5. **UI must look like the real calculator** — 5-column keypad (+ the Σ and MAR keys
   in the top-right), black body, green/olive LCD, orange SHIFT key, yellow shift
   labels, white/gray primary labels.
6. **Full feature set** — every HP-10B function in the spec.
7. **Keyboard support** is required in addition to on-screen keys.
8. **Persistence via `sessionStorage`** — save on every mutation, restore on load,
   clear on power-OFF. The JS `state` object is the single source of truth.
9. **Target modern browsers** (current Chrome/Firefox/Safari/Edge). No legacy/polyfills.

## How to run (for testing)

```
# open directly — the app is designed for this
xdg-open index.html        # Linux
open index.html            # macOS

# or any static server (optional)
python3 -m http.server 8000   # → http://localhost:8000/
```

## Workflow (do this after EVERY completed task)

This is a long-lived project. Keep the record-keeping files current:

1. Update **`Project_Management/PROGRESS.md`** — move the relevant task to its new
   status using the vocabulary: `Not Started → In Progress → Done → Verified`, plus
   `Blocked`.
   - `Done` = implemented.
   - `Verified` = implemented **and** its manual worked-example (see
     `specs.md → Testing & Acceptance`) reproduces exactly in a real browser.
2. Append an entry to **`Project_Management/CHANGELOG.md`** (append-only; never edit
   past entries).
3. Made a non-obvious choice? Record it in **`Project_Management/DECISIONS.md`**.
4. Hit or fixed a bug? Record it in **`Project_Management/ISSUES.md`** (symptom, repro,
   root cause, fix, how verified).
5. `git commit` with a clear message (e.g. `T1.6: implement TVM solve`).

## Suggested build order

Follow the phases in `Project_Management/PROGRESS.md`:

- **Phase 0** — scaffold, spec, HTML skeleton, CSS, core state + display, key
  dispatch, keyboard, persistence.
- **Phase 1** — number formatting, arithmetic, math functions, business %,
  interest conversion, TVM, NPV/IRR, statistics, amortization.
- **Phase 2** — registers (business, M, numbered), clearing semantics, SWAP.
- **Phase 3** — annunciators, error messages, cursor, power on/off, visual QA.
- **Phase 4** — acceptance tests, regression suite, cross-browser verification.

## Definition of "shipped"

- Every Phase 1–3 feature is at least `Done`.
- Every feature with a manual worked-example is `Verified`.
- The regression suite passes in all target browsers.

## Pointers

- Full spec: [`specs.md`](specs.md)
- Task board: [`Project_Management/PROGRESS.md`](Project_Management/PROGRESS.md)
- Decisions: [`Project_Management/DECISIONS.md`](Project_Management/DECISIONS.md)
- Issues: [`Project_Management/ISSUES.md`](Project_Management/ISSUES.md)
- History: [`Project_Management/CHANGELOG.md`](Project_Management/CHANGELOG.md)
