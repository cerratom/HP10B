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
| T0.3  | HTML skeleton (`index.html`) | `Not Started` | 5×7 keypad grid + display + annunciator line. |
| T0.4  | CSS layout & exact styling (`styles.css`) | `Not Started` | Match `Assets/HP-10B.jpg` (colors, bevel, fonts, LCD). |
| T0.5  | Core state model + display rendering (`app.js`) | `Not Started` | Single `state` object; render loop; number formatting. |
| T0.6  | Key dispatch / input state machine | `Not Started` | entry vs. pending-operator vs. result states. |
| T0.7  | Keyboard mapping | `Not Started` | Physical keys → actions (see `specs.md → Keyboard Mapping`). |
| T0.8  | Persistence (`sessionStorage` save/restore) | `Not Started` | Serialize `state`; restore on load; clear on OFF. |

## Phase 1 — Core math & functions

| ID    | Task | Status | Notes |
|-------|------|--------|-------|
| T1.1  | Number formatting (DISP, RND, period/comma, scientific) | `Not Started` | 12-digit internal; 0–9 decimal places; E notation. |
| T1.2  | Arithmetic (chained, two-number INPUT functions) | `Not Started` | `+ − × ÷`, `INPUT`, `%`, `%CHG`. |
| T1.3  | Math functions (x², √x, 1/x, y^x, e^x, LN, n!, E) | `Not Started` | One- and two-number functions. |
| T1.4  | Business percentages (`%`, `%CHG`, `MAR`, `MU`, `CST`, `PRC`) | `Not Started` | Margin/markup pair shares a register. |
| T1.5  | Interest conversion (`NOM%` ↔ `EFF%`) | `Not Started` | Uses `P/YR`; NOM% shares I/YR register. |
| T1.6  | TVM (`N`, `I/YR`, `PV`, `PMT`, `FV`, `P/YR`, `BEG/END`) | `Not Started` | Solve for any of the 5 given the other 4. |
| T1.7  | NPV / IRR (cash flows, `Nj`) | `Not Started` | CF0 + up to 14 groups, ≤99 repetitions each. |
| T1.8  | Statistics & regression (`Σ+`/`Σ−`, means, Sx/Sy, σx/σy, r, x̂/ŷ, m, x̄w) | `Not Started` | Summation registers n,Σx,Σy,Σx²,Σy²,Σxy. |
| T1.9  | Amortization (`AMORT`) | `Not Started` | Periodic principal/interest breakdown. |

## Phase 2 — Memory, registers & clearing

| ID    | Task | Status | Notes |
|-------|------|--------|-------|
| T2.1  | Business registers (N, I/YR, PV, PMT, FV, CST, PRC, MAR/MU, P/YR, EFF%) | `Not Started` | 10 business registers. |
| T2.2  | `M` register (`→M`, `RM`, `M+`) | `Not Started` | 3-key memory. |
| T2.3  | Numbered registers `R0`–`R.4` (`STO`/`RCL`) | `Not Started` | 15 general registers. |
| T2.4  | Clearing semantics (`C`, `◄`, `CLEAR ALL`, `CL Σ`) | `Not Started` | See `specs.md → Clearing`. |
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
