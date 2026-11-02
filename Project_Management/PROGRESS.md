# PROGRESS — HP-10B Web Calculator

Live task board. Update this **every** time a task changes state.

## Status vocabulary

| Status        | Meaning |
|---------------|---------|
| `Not Started` | Not yet begun. |
| `In Progress` | Actively being worked on. |
| `Done`        | Implemented; not yet confirmed against a manual worked-example. |
| `Verified`    | `Done` **and** passed its acceptance test(s) from the HP-10B manual. |
| `Blocked`     | Cannot proceed — a note in the task explains why. |

> **Rule:** a task only reaches `Verified` when its worked-example test case (see
> `specs.md → Testing & Acceptance`) passes in a real browser.

## Legend / counts

- Total tasks: see table below.
- `Verified` = green (definition of "shipped" for a feature).

---

## Phase 0 — Foundation & scaffolding

| ID    | Task | Status | Notes |
|-------|------|--------|-------|
| T0.1  | Project scaffolding (git, docs, workflow) | `Done` | git repo + README/AGENTS/specs + `Project_Management/` (PROGRESS/CHANGELOG/DECISIONS/ISSUES). |
| T0.2  | Authoritative specification (`specs.md`) | `Done` | Full spec authored; key map verified against `Assets/HP-10B.jpg`; open items tracked in `specs.md → Appendix B`. |
| T0.3  | HTML skeleton (`index.html`) | `Done` | 220 lines: 5×7 keypad grid (6th col rows 1–2), LCD display, annunciator line, HP branding. Awaiting visual QA (T3.5). |
| T0.4  | CSS layout & exact styling (`styles.css`) | `Done` | 370 lines: black body, green/olive LCD, dark keys, yellow shift labels, orange SHIFT, responsive breakpoints. Awaiting visual QA (T3.5). |
| T0.5  | Core state model + display rendering (`app.js`) | `Done` | State, LCD rendering, annunciators, entry cursor, and decimal rounding integrated. Manual verification remains. |
| T0.6  | Key dispatch / input state machine | `Done` | Keypad dispatch connected across implemented calculator functions; worked-example verification remains. |
| T0.7  | Keyboard mapping | `Done` | Direct shortcuts plus `;` row/column sequence reach every physical key; documented in README. |
| T0.8  | Persistence (`sessionStorage` save/restore) | `Done` | Restore on load, save on key mutations, clear on OFF; guarded for storage access failures. |

## Phase 1 — Core math & functions

| ID    | Task | Status | Notes |
|-------|------|--------|-------|
| T1.1  | Number formatting (DISP, RND, period/comma, scientific) | `Done` | Grouped output respects the 12-character limit; scientific formatting rounds to DISP precision. Manual verification remains. |
| T1.2  | Arithmetic (chained, two-number INPUT functions) | `Done` | Chained operators, percent functions, parentheses, INPUT pairs, and y^x are implemented; manual examples remain to verify. |
| T1.3  | Math functions (x², √x, 1/x, y^x, e^x, LN, n!, E) | `Done` | Unary math, factorial, scientific exponent entry, and both y^x input paths implemented; manual examples remain to verify. |
| T1.4  | Business percentages (`%`, `%CHG`, `MAR`, `MU`, `CST`, `PRC`) | `Done` | Percent, percent change, margin, markup, and CST/PRC solve paths implemented. |
| T1.5  | Interest conversion (`NOM%` ↔ `EFF%`) | `Done` | Both directions and P/YR implemented; manual example A1 awaits real-browser verification. |
| T1.6  | TVM (`N`, `I/YR`, `PV`, `PMT`, `FV`, `P/YR`, `BEG/END`) | `Done` | Solve all five variables, including numerical I/YR and BEGIN timing; manual example A12 awaits real-browser verification. |
| T1.7  | NPV / IRR (cash flows, `Nj`) | `Done` | CF0 + up to 14 groups, repeat counts 1–99, NPV and annualized IRR implemented; manual example remains to verify. |
| T1.8  | Statistics & regression (`Σ+`/`Σ−`, means, Sx/Sy, σx/σy, r, x̂/ŷ, m, x̄w) | `Done` | Summation, inverse regression, prediction, standard deviations, correlation, and weighted mean implemented; manual verification remains. |
| T1.9  | Amortization (`AMORT`) | `Done` | Repeated AMORT cycles report interest, principal, and balance for entered periods; verify sequence against manual. |

## Phase 2 — Memory, registers & clearing

| ID    | Task | Status | Notes |
|-------|------|--------|-------|
| T2.1  | Business registers (N, I/YR, PV, PMT, FV, CST, PRC, MAR/MU, P/YR, EFF%) | `Done` | Store, recall, and applicable solve operations implemented. |
| T2.2  | `M` register (`→M`, `RM`, `M+`) | `Done` | Three memory handlers implemented; manual verification remains. |
| T2.3  | Numbered registers `R0`–`R.4` (`STO`/`RCL`) | `Done` | 15 slots with two-step selection implemented; manual verification remains. |
| T2.4  | Clearing semantics (`C`, `◄`, `CLEAR ALL`, `CL Σ`) | `Done` | Clear current entry/calculation, all memory, and statistics handlers implemented. |
| T2.5  | `SWAP` | `Done` | Swaps pending values and toggles hidden two-result outputs. |

## Phase 3 — Fidelity & polish

| ID    | Task | Status | Notes |
|-------|------|--------|-------|
| T3.1  | Annunciators (shift, `:`, PEND, BEGIN, low-battery) | `Done` | Shift, input, pending, and BEGIN indicators reflect state; low-battery remains off as specified. |
| T3.2  | Error messages | `Done` | Manual error strings and triggers transcribed; distinct function, interest, period, statistics, solve, and overflow messages wired. |
| T3.3  | Blinking entry cursor | `Done` | Cursor appears during entry and hides on operation/message. |
| T3.4  | Power on/off (`OFF`/`ON`) | `Done` | OFF clears session memory; C restores a fresh powered-on state. |
| T3.5  | Visual QA against `Assets/HP-10B.jpg` | `In Progress` | Corrected logo, typography, left-to-right digits, fixed LCD width/height; browser screenshot comparison remains. |

## Phase 4 — Testing & verification

| ID    | Task | Status | Notes |
|-------|------|--------|-------|
| T4.1  | Acceptance tests (manual worked examples) | `In Progress` | Added optional `?test=1` browser runner for A1, A7, A8, A10; remaining examples need known answers and browser run. |
| T4.2  | Regression test suite | `Not Started` | Re-run all `Verified` cases after each change. |
| T4.3  | Cross-browser verification | `Not Started` | Chrome, Firefox, Safari, Edge (modern). |

---

## Definition of "shipped"

The calculator is considered **shipped** when:

- Every Phase 1–3 feature is at least `Done`.
- Every feature with a manual worked-example is `Verified`.
- `T4.2` (regression suite) passes in all target browsers (`T4.3`).

## Change log of this board

| Date | Change |
|------|--------|
| 2026-11-01 | Board created. T0.1 `Done`, T0.2 `In Progress`, all else `Not Started`. |
| 2026-11-01 | T0.2 → `Done`. T0.3 → `Done` (index.html created, 220 lines). T0.4 → `Done` (styles.css created, 370 lines). T0.5–T0.8 remain `Not Started`. |
| 2026-11-01 | T0.5 → `Done`; T0.6 → `In Progress`. Connected state/rendering to the DOM and began button dispatch. |
| 2026-11-01 | T0.7 and T0.8 → `Done`; T0.6 remains `In Progress`. Added keyboard access and connected existing persistence to UI actions. |
| 2026-11-01 | T1.1–T1.3, T2.1, T2.4 → `In Progress`; T2.2 and T2.3 → `Done` as their handlers were wired. |
| 2026-11-01 | T1.5 and T1.6 → `Done`. Added interest conversion and all five TVM solves. |
| 2026-11-01 | T1.7 → `Done`. Added cash-flow entry, Nj repeat counts, NPV, and IRR/YR solver. |
| 2026-11-01 | T1.8 → `Done`. Added Σ+/Σ− accumulation and shifted statistics/regression functions. |
| 2026-11-01 | T0.6, T1.4, T1.9, T2.1, T2.4, T2.5 → `Done`. Added business percentage solves, amortization, complete mapped dispatch, and finalized clear/SWAP handlers. |
| 2026-11-01 | T3.1, T3.3, T3.4 → `Done`; T3.2 → `In Progress`. Fixed C power-on after OFF and recorded I4. |
| 2026-11-01 | T3.2 → `Done`. Transcribed manual message appendix and wired distinct calculator errors and ALL CLr status. |
| 2026-11-01 | T4.1 → `In Progress`. Added optional in-browser acceptance checks for explicit worked examples. |
| 2026-11-01 | T1.1 → `Done`. Scientific display and grouped output now observe DISP precision and the 12-character display limit. |
| 2026-11-01 | T1.2 and T1.3 → `Done`. Completed the INPUT-powered y^x path; all listed arithmetic and math handlers are connected. |
| 2026-11-01 | T3.5 → `In Progress`. Adjusted badge shape/color, printed typography, and LCD digit alignment against the reference photo. |
