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

### 2026-11-02 — Cross-browser verification: Chromium, Chrome, Firefox, Edge

- User ran `index.html?test=1` and reported all checks PASS in **Chromium**, **Chrome**,
  **Firefox** and **Edge**. (The "real browser (Edge)" phrasing in the entry below should
  read Chromium — the user's local browser is Chromium on Linux.)
- Re-confirmed 15/15 in the headless Node harness against the current on-disk `app.js`.
- **Board:** T4.3 (cross-browser verification) moved `In Progress → Blocked`: Safari cannot
  be tested locally and requires a deployment. T1.6–T1.8 notes now name the actual browsers.
- Related: T4.1–T4.3.

### 2026-11-02 — All 15 acceptance checks pass in browser

- User reports every `?test=1` check (A1–A15, including new A9/A11–A15) PASS in a real browser.
- Marked TVM (T1.6), NPV/IRR (T1.7), and statistics/regression (T1.8) `Verified`.
- Related: T4.1, T4.2 (`In Progress`), T4.3 (other browsers remain).

### 2026-11-02 — Expand acceptance runner to A9 and A11–A15; fix NPV/IRR and stats input

- Transcribed the scanned manual's worked examples (pp. 13, 17–18, 22, 89–92) and added A9,
  A11, A12, A13, A14, A15 to the `?test=1` runner with exact manual expected values
  (IRR/YR 15.96, NPV 622.85, PMT −122.86, σ pair 5.80/4.71, mean/Sx 3.50/0.85, b/m/r 376.25/425.88/0.90).
- Fixed NPV/IRR to the manual's nominal convention (`r = I/YR ÷ P/YR`; D15, I9); fixed
  `statFunction` to commit the pending entry (I10); fixed the runner's shifted-digit dispatch (I11).
- All 15 checks pass in a headless Node harness; real-browser (Edge) confirmation still required before `Verified`.
- Related: T1.6, T1.7, T1.8, T4.1, T4.2; D15, D16, I9–I11.

### 2026-11-01 — Record expanded Edge acceptance results

- User reports all current `?test=1` cases pass in Edge, including new A2–A6 cases.
- Marked arithmetic `Verified`; broader acceptance coverage and other browser checks remain open.
- Related: T1.2, T4.1–T4.3.

### 2026-11-01 — Match percent handling to manual examples

- Used scanned manual pp. 31–32 to correct A4/A6 key sequences and added both to the acceptance runner.
- Percent now divides by 100 for multiply, while add/subtract percent uses a percent of the pending base; percent-change preserves and resolves the INPUT base across an addition.
- Related: T1.2, T4.1, T4.2 (`In Progress`).

### 2026-11-01 — Add percent-of acceptance example

- Corrected A2 to `200 × 25 % =` (50.00) and included it in the browser runner.
- Related: T4.1, T4.2 (`In Progress`).

### 2026-11-01 — Extend acceptance runner with percent examples

- Added A3 subtract-percent and A5 percent-change examples to the browser runner.
- Related: T4.1, T4.2 (`In Progress`).

### 2026-11-01 — Record Edge acceptance checks

- User reports PASS for runner cases A1, A7, A8, and A10 in Edge.
- Marked interest conversion and exercised business percentage examples `Verified`; Edge is recorded as the first cross-browser check.
- Related: T1.4, T1.5, T4.1–T4.3.

### 2026-11-01 — Visual QA confirmed in Edge

- User confirmed that the calculator looks and functions correctly in Edge, including fixed LCD width and geometry.
- Marked T0.3, T0.4, and T3.5 `Verified`.

### 2026-11-01 — Keep LCD height fixed while power changes

- Set fixed LCD heights and line-height so empty, powered-off, and powered-on displays keep the same geometry.
- Related: T3.5, I8.

### 2026-11-01 — Align LCD digits from left to right

- Removed the flexible gap that pushed the displayed value to the right; LCD digits now start at the left edge.
- Related: T3.5, I7.

### 2026-11-01 — Add browser acceptance check runner

- Added `?test=1` mode that runs explicit manual examples A1, A7, A8, and A10 and displays pass/fail results.
- Related: T4.1 (`In Progress`).

### 2026-11-01 — Complete arithmetic and math handler implementation

- Marked arithmetic and math handlers implemented, including INPUT-based y^x and chained calculations; manual examples remain unverified.
- Related: T1.2 and T1.3 (`Done`), I6.

### 2026-11-01 — Use INPUT pair for y^x

- y^x now consumes the base held by INPUT and the current exponent.
- Related: T1.2, T1.3, I6.

### 2026-11-01 — Finish display width and scientific formatting

- Scientific notation now rounds to the active display precision; grouping separators count toward the 12-character LCD limit.
- RND now rounds values that are stored in scientific notation.
- Related: T1.1 (`Done`).

### 2026-11-01 — Fix body width independently of LCD contents

- Set the calculator to a fixed 320px width and flex basis, matching its original minimum size; gave the page an explicit viewport width.
- Repro from user: `98765431 × 9`. The body dimensions no longer depend on the LCD's intrinsic text width.
- Related: T3.5, I5.

### 2026-11-01 — Preserve original calculator width

- Restored the device's original `width: 100%`, 420px maximum, and 320px minimum sizing; long LCD contents remain constrained within the LCD.
- Updated I5 to describe the LCD-only fix without changing the calculator's default size.
- Related: T3.5, I5.

### 2026-11-01 — Keep long display values inside the calculator

- Constrained the calculator body to the viewport and allowed the LCD value to shrink and clip within the display.
- Logged the layout defect as I5; browser resize comparison remains part of visual QA.
- Related: T3.5, I5.

### 2026-11-01 — Match calculator error messages to the manual

- Read the scanned message appendix (manual pp. 133–135), transcribed error strings and triggers into the spec, and replaced generic errors at relevant calculation paths.
- CLEAR ALL now displays `ALL CLr`; overflow results report `OFLO`.
- Related: T3.2 (`Done`).

### 2026-11-01 — Refine calculator appearance against reference photo

- Changed the HP badge to a beige square, italicized the 10B and BUSINESS markings, and left-aligned LCD digits to match the physical unit.
- Related: T3.5 (`In Progress`).

### 2026-11-01 — Restore power-on behavior

- Added the missing powerOn routine so C after OFF restores a fresh powered calculator state.
- Updated fidelity task statuses for annunciators, cursor, power, and error messages.
- Related: T3.1, T3.3, T3.4 (`Done`), T3.2 (`In Progress`), I4.

### 2026-11-01 — Separate fixed zero decimals from full precision

- `DISP 0` now renders zero decimal places; full precision is selected with `DISP` then `C`.
- Related: T1.1 (`In Progress`).

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
