# CHANGELOG — HP-10B Web Calculator

Append-only history of changes. **Never edit or delete past entries** — add new ones
at the top (or bottom) of the "Releases / entries" section.

Format (keep it consistent):

```
### <date> — <short title>
- What changed (1–3 bullets).
- Related: T# task IDs, issue IDs, decision IDs.
```

---

## Entries

### 2026-11-01 — Amortization and business percentage functions

- Added AMORT cycles that display accumulated interest, principal, and remaining balance.
- Added margin/markup calculations and CST/PRC solve paths, completed percent-of with INPUT, and connected parenthesis shift keys.
- Updated task statuses for completed handlers; manual worked-example verification remains outstanding.
- Related: T0.6, T1.4, T1.9, T2.1, T2.4, T2.5 (`Done`).

### 2026-11-01 — Statistics and regression functions

- Implemented Σ+/Σ− accumulation, means, sample and population deviations, correlation, regression prediction, slope, weighted mean, and SWAP result toggling.
- Clarified inverse regression formula for x̂ in the spec; key argument behavior still needs manual verification.
- Related: T1.8 (`Done`), D14.

### 2026-11-01 — NPV and IRR cash flow functions

- Added CFj cash-flow groups, Nj repetition counts, NPV per-period discounting, and an IRR root finder.
- IRR reports the annual effective rate and selects the smallest positive root when multiple roots are found.
- Related: T1.7 (`Done`).

### 2026-11-01 — Interest conversion and TVM solve

- Implemented nominal/effective conversion using P/YR, with shared I/YR/NOM storage.
- Implemented TVM solves for N, I/YR, PV, PMT, and FV, including BEGIN timing and zero-interest cases.
- Corrected the BEGIN factor in the spec equation and added business-register recall through RCL.
- Related: T1.5 and T1.6 (`Done`), D13, I3.

### 2026-11-01 — Extend key handlers and keyboard access

- Added basic business and memory registers, display settings, percentage functions, factorial, and clearing handlers.
- Added keyboard shortcuts and row/column sequences for every physical key; documented them in README.
- Related: T0.6 (`In Progress`), T0.7 (`Done`), T0.8 (`Done`).

### 2026-11-01 — Connect core display and button dispatch

- Connected the serializable state and LCD renderer to the HTML display, cursor, annunciators, and keypad clicks.
- Corrected decimal rounding carry and added dispatch for entry, arithmetic, basic shifted math, modes, and power.
- Related: T0.5 (`Done`), T0.6 (`In Progress`).

### 2026-11-01 — app.js updated: exponent parsing, sign handling, parseEntry improvements (T0.5 In Progress)

- Added robust exponent entry logic to `pressDigit` and `pressE`, allowing up to three digits after the exponent marker.
- Implemented sign toggling for both base numbers and exponents in `pressSign`.
- Updated `parseEntry` to handle incomplete exponent strings (`4e-`) gracefully during typing, preserving display accuracy.
- Fixed parsing of negative zero and leading zeros across entry modes.
- Related: T0.5 (Core state model + display rendering), I1 (JSON payload size issue).

### 2026-11-01 — HTML + CSS created (T0.3, T0.4 → Done)

- Created `index.html` (220 lines): full HP-10B layout — 5×7 keypad grid with 6th column
  in rows 1–2, LCD display area, annunciator line (shift, INPUT, PEND, BEGIN, battery),
  HP branding. All keys have `data-key` attributes for JS dispatch.
- Created `styles.css` (370 lines): exact HP-10B visual match — black body, green/olive
  LCD background, dark gray keys with white labels, yellow shift labels, orange SHIFT key,
  responsive breakpoints for mobile/tablet/deskop.
- Logged issue I1: large `replace_file` payloads cause JSON parse errors in the Bionic
  tool-call layer. Workaround: use `shell_command` heredocs or smaller chunked writes.
- **Not yet committed** at time of logging; commit follows.
- Related: T0.3, T0.4, I1.

### 2026-11-01 — specs.md authored (T0.2 → Done)

- Wrote the full authoritative `specs.md` (17 sections + 2 appendices): overview, tech
  stack, key map (verified against `Assets/HP-10B.jpg`), display/annunciators, state
  model, feature specs (TVM, interest conversion, NPV/IRR, business %, statistics,
  amortization, math, arithmetic), numeric formatting, clearing, persistence
  (`sessionStorage`), messages/errors/power, acceptance tests, keyboard mapping,
  non-functional requirements, file structure, workflow.
- Corrected key-map ambiguity: `OFF`/`ON` sit on the `C` key; the orange key is the
  bare SHIFT key. 6th column confirmed as `Σ+`/`Σ−` (row 1) and `MAR`/`MU` (row 2).
- Open items to confirm against the manual are tracked in `specs.md → Appendix B`.
- Related: T0.2.

### 2026-11-01 — v0.1.0 — Specification & project scaffolding

- Initialized git repository (branch `main`).
- Created `README.md`, `.gitignore`, and the `Project_Management/` folder holding
  `PROGRESS.md`, `CHANGELOG.md`, `DECISIONS.md`, `ISSUES.md` (admin files grouped
  apart from the app code at the repo root).
- Created `AGENTS.md` — the entry-point instruction file for the building agent.
- Locked in core decisions (see `DECISIONS.md`): JS-only (no backend), `index.html`
  entry point, `sessionStorage` persistence, 3-file app structure.
- **Pending:** `specs.md` (the authoritative specification) — the main deliverable.
- Related: T0.1, T0.2.
