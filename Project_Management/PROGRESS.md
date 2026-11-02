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
| T0.6  | Key dispatch / input state machine | `In Progress` | Button delegation wired for entry, arithmetic, and several shifted math keys; feature handlers remain. |
| T0.7  | Keyboard mapping | `Done` | Direct shortcuts plus `;` row/column sequence reach every physical key; documented in README. |
| T0.8  | Persistence (`sessionStorage` save/restore) | `Done` | Restore on load, save on key mutations, clear on OFF; guarded for storage access failures. |

## Phase 1 — Core math & functions

| ID    | Task | Status | Notes |
|-------|------|--------|-------|
| T1.1  | Number formatting (DISP, RND, period/comma, scientific) | `In Progress` | Display settings wired; scientific and full-precision behavior still needs manual review. |
| T1.2  | Arithmetic (chained, two-number INPUT functions) | `In Progress` | Basic operators, INPUT, percent, and percent change implemented; chaining needs manual review. |
| T1.3  | Math functions (x², √x, 1/x, y^x, e^x, LN, n!, E) | `In Progress` | Core handlers added; manual behavior and edge cases remain. |
| T1.4  | Business percentages (`%`, `%CHG`, `MAR`, `MU`, `CST`, `PRC`) | `Not Started` | Margin/markup pair shares a register. |
| T1.5  | Interest conversion (`NOM%` ↔ `EFF%`) | `Done` | Both directions and P/YR implemented; manual example A1 awaits real-browser verification. |
| T1.6  | TVM (`N`, `I/YR`, `PV`, `PMT`, `FV`, `P/YR`, `BEG/END`) | `Done` | Solve all five variables, including numerical I/YR and BEGIN timing; manual example A12 awaits real-browser verification. |
| T1.7  | NPV / IRR (cash flows, `Nj`) | `Done` | CF0 + up to 14 groups, repeat counts 1–99, NPV and annualized IRR implemented; manual example remains to verify. |
| T1.8  | Statistics & regression (`Σ+`/`Σ−`, means, Sx/Sy, σx/σy, r, x̂/ŷ, m, x̄w) | `Not Started` | Summation registers n,Σx,Σy,Σx²,Σy²,Σxy. |
| T1.9  | Amortization (`AMORT`) | `Not Started` | Periodic principal/interest breakdown. |

## Phase 2 — Memory, registers & clearing

| ID    | Task | Status | Notes |
|-------|------|--------|-------|
| T2.1  | Business registers (N, I/YR, PV, PMT, FV, CST, PRC, MAR/MU, P/YR, EFF%) | `In Progress` | Basic store/recall handlers added; financial solve semantics remain. |
| T2.2  | `M` register (`→M`, `RM`, `M+`) | `Done` | Three memory handlers implemented; manual verification remains. |
| T2.3  | Numbered registers `R0`–`R.4` (`STO`/`RCL`) | `Done` | 15 slots with two-step selection implemented; manual verification remains. |
| T2.4  | Clearing semantics (`C`, `◄`, `CLEAR ALL`, `CL Σ`) | `In Progress` | Handlers present; exact manual clearing behavior needs review. |
| T2.5  | `SWAP` | `Not Started` | Swap last two entries / hidden result / x↔y. |

## Phase 3 — Fidelity & polish

| ID    | Task | Status | Notes |
|-------|------|--------|-------|
| T3.1  | Annunciators (shift, `:`, PEND, BEGIN, low-battery) | `Not Started` | See `specs.md → Annunciators`. |
| T3.2  | Error messages | `Not Started` | List from manual p133; clear with `C`/`◄`. |
| T3.3  | Blinking entry cursor | `Not Started` | `_` while entering a number. |
| T3.4  | Power on/off (`OFF`/`ON`) | `Not Started` | OFF clears all memory (volatile model). |
| T3.5  | Visual QA against `Assets/HP-10B.jpg` | `Not Started` | Side-by-side pixel comparison. |

## Phase 4 — Testing & verification

| ID    | Task | Status | Notes |
|-------|------|--------|-------|
| T4.1  | Acceptance tests (manual worked examples) | `Not Started` | See `specs.md → Testing & Acceptance`. |
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
