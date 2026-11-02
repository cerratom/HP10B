# HP-10B Web Calculator — Specification

> **Status:** Authoritative specification (v1.0). This document is the single source of
> truth for *what* to build and *how* it behaves. The building agent must read this in
> full before writing code.
>
> **Sources of truth:**
> - Behavior: `Assets/User_Manual.pdf` — HP-10B Owner's Manual, Edition 6 (1994), 72 pp.
> - Appearance: `Assets/HP-10B.jpg` — photograph of the physical unit (verified against
>   this spec's key map, §5).
>
> **Companion docs:** `AGENTS.md` (workflow), `Project_Management/` (progress, decisions,
> issues, changelog).

---

## 1. Overview

### 1.1 What it is

A faithful, browser-based recreation of the **Hewlett-Packard HP-10B Business/Financial
Calculator**. It reproduces the full feature set, the exact key layout, the LCD display,
the annunciators, the number formatting, the state/registry model, and the clearing and
error behavior of the original device — so that any sequence of keypresses on the real
calculator produces the identical sequence of displays here.

### 1.2 Goals

1. **Exact UI fidelity** — the on-screen device looks like the photo: black body, the
   `hp` logo + `10B` + `BUSINESS` markings, green/olive LCD, 5-column keypad plus the
   `Σ+`/`MAR` column, orange SHIFT key, yellow shift labels, white/gray primary labels.
2. **Full feature parity** — every function on the HP-10B (TVM, interest conversion,
   NPV/IRR, business %, statistics & regression, amortization, math functions,
   arithmetic, registers, modes).
3. **Identical behavior** — same display results, same annunciators, same clearing and
   error semantics as the manual describes.
4. **Keyboard-driven** — every on-screen key is reachable from a physical keyboard.
5. **Session persistence** — state survives a page refresh within the same browser tab
   (via `sessionStorage`); power-OFF clears it, faithful to the device's volatile memory.
6. **Zero moving parts** — opens from `index.html`, no build, no server, no dependencies.

### 1.3 Non-goals

- No backend, no API, no network, no accounts, no multi-device sync.
- No mobile-app packaging; it is a responsive web page, not a native app.
- No legacy-browser support (IE, old Safari, etc.).
- No emulation of the physical battery, key travel, or sound.
- No additional financial features beyond the HP-10B (no currency conversion, no
  bond/loan extras not on the device).

---

## 2. Tech Stack & Constraints

| Concern | Requirement |
|---|---|
| Languages | HTML5, CSS3, **vanilla JavaScript (ES2020+)**. No TypeScript, no frameworks. |
| Dependencies | **None.** No npm, no package manager, no CDN, no fonts fetched at runtime. |
| Build step | **None.** The files are the source. |
| Entry point | `index.html` — must work opened directly (`file://`) and from any static host. |
| App files | Exactly three at repo root: `index.html`, `styles.css`, `app.js`. |
| Backend | **None.** All computation in JS. |
| Persistence | `window.sessionStorage` (see §11). |
| Modules | Keep `app.js` as one file with clearly-named sections; only split into ES
  modules if it becomes unmanageable (record a decision in `DECISIONS.md`). |
| Target | Current Chrome, Firefox, Safari, Edge (desktop + mobile). No polyfills. |
| Precision | Use IEEE-754 `number` internally; format for display per §7. Guard against
  floating-point artifacts in the display layer (see §7.6). |

> **Why no backend:** the HP-10B is a self-contained state machine with volatile memory.
> A pure front-end reproduces that exactly. The only "memory" concern is surviving a
> refresh, which `sessionStorage` handles. See `DECISIONS.md` D1–D3.

---

## 3. Source-of-Truth Mapping

- **Behavior** (what each key does, formulas, messages, clearing rules): the manual.
  Where this spec and the manual disagree, **the manual wins** — file an issue and fix
  the spec.
- **Appearance** (layout, colors, fonts, key shapes, labels): the photo. Where this spec
  and the photo disagree, **the photo wins**.
- **Worked examples** (acceptance tests): the manual's at-a-glance pages (see §13).

---

## 4. Device Anatomy (top-level)

The page renders one device, composed of:

1. **Bezel / body** — black, rounded, with the `hp` logo (top-left), `10B` (below logo,
   left) and `BUSINESS` (top-right).
2. **Display** — a single green/olive LCD showing one value (or a message) right-aligned,
   plus an annunciator strip above/within the display (see §6).
3. **Keypad** — the key grid from §5.
4. **Status** — the device is either ON or OFF (§12.4).

The device should be centered and scale to fit the viewport while preserving its
proportions (see §15, Non-functional).

---

## 5. Key Layout & Key Map

### 5.1 Grid

**5 columns × 7 rows, plus a 6th column that exists only in rows 1–2** (`Σ+`/`MAR`).
Verified against `Assets/HP-10B.jpg`.

Each key has a **primary** (white/gray) label and, where present, a **shift** (yellow)
label. Shift functions are reached by first activating SHIFT (orange key) — see §5.3.

### 5.2 Full key map

Legend: `primary` / `⇧ shift`. (Shift labels shown as `⇧`.)

| Row | Col 1 | Col 2 | Col 3 | Col 4 | Col 5 | Col 6 |
|-----|-------|-------|-------|-------|-------|-------|
| 1 | `N` / `⇧×P/YR` | `I/YR` / `⇧NOM %` | `PV` / `⇧EFF %` | `PMT` / `⇧P/YR` | `FV` / `⇧AMORT` | `Σ+` / `⇧Σ−` |
| 2 | `%` / `⇧%CHG` | `RCL` / `⇧STO` | `CFj` / `⇧Nj` | `CST` / `⇧IRR/YR` | `PRC` / `⇧NPV` | `MAR` / `⇧MU` |
| 3 | `INPUT` / `⇧CLEAR ALL` | `→M` / `⇧CL Σ` | `RM` / `⇧(` | `M+` / `⇧)` | `◄` / `⇧RND` | — |
| 4 | `+/−` / `⇧E` | `7` / `⇧x̄,ȳ` | `8` / `⇧Sx,Sy` | `9` / `⇧σx,σy` | `÷` / `⇧1/x` | — |
| 5 | `K` / `⇧SWAP` | `4` / `⇧x̂,r` | `5` / `⇧ŷ,m` | `6` / `⇧x̄w` | `×` / `⇧y^x` | — |
| 6 | **[SHIFT]** (orange) | `1` / `⇧e^x` | `2` / `⇧LN` | `3` / `⇧n!` | `−` / `⇧√x` | — |
| 7 | `C` / `⇧OFF` (label `ON` printed below) | `0` / `⇧BEG/END` | `•` / `⇧•/,` | `=` / `⇧DISP` | `+` / `⇧x²` | — |

> **Notes**
> - The orange key (row 6, col 1) is the **SHIFT** key itself; it has no shift label.
> - `C` (row 7, col 1): primary = `C` (clear), shift = `OFF` (power off). `ON` is printed
>   below the key to indicate "press C to turn on." See §12.4.
> - The body also carries decorative summation-register labels (`n`, `Σx`, `Σy`, `Σx²`,
>   `Σy²`, `Σxy`) near the statistics keys; these are cosmetic and need not be interactive.

### 5.3 SHIFT key behavior (manual p24)

- Pressing the orange SHIFT key **arms** the shifted function of the next key.
- Pressing SHIFT again **disarms** it (toggles off).
- While armed, the annunciator strip shows the **shift arrow `→`** (§6).
- **Hold** SHIFT to perform consecutive shifted operations without re-arming (optional
  nicety; at minimum, re-arming must work).
- After a shifted key is pressed, SHIFT disarms automatically (unless held).

### 5.4 Key styling

- **Primary keys:** dark keys, white/gray labels.
- **Shift labels:** yellow/orange text printed above each key.
- **SHIFT key:** solid orange body.
- **`C` key:** dark key, white label, `OFF` (yellow) above and `ON` (white) below.
- Key shapes: slightly rounded rectangles; the `INPUT` key is wider (spans the col-1
  area) to match the photo. Maintain the exact relative positions from the photo.
- Hover/active/focus states for mouse + keyboard (see §15).

---

## 6. Display & Annunciators

### 6.1 Display

- A single **green/olive LCD** field, dark-on-light (dark segments on a pale green
  background), right-aligned value, seven-segment-style or a clean tabular numeral face
  that reads like the original (see §15 for font guidance).
- Shows up to **12 significant digits** (see §7).
- When a **message** is active (status or error), the display shows the message text
  instead of a value (§12.5).
- A **blinking cursor** appears at the right of the value while the user is entering a
  number (see §6.3).

### 6.2 Annunciators (manual p24)

A strip of small indicators, each shown only when its condition holds:

| Annunciator | Meaning | When shown |
|---|---|---|
| `→` | SHIFT armed | While the orange key is active (next key will be shifted). |
| `:` | Two-number entry / INPUT | After `INPUT` separates two values (e.g. before `%CHG`, two-variable stats). |
| `PEND` | Operator pending | After `+`, `−`, `×`, `÷`, or `%` is entered and awaiting the second operand. |
| `BEGIN` | Begin mode | When cash-flow mode is BEGIN (annuity-due) rather than END. |
| 🔋 (battery) | Low battery | Faithful to the device; in the web app this is **always off** (no battery), or shown only as a static indicator. Do not simulate low-battery behavior. |

### 6.3 Blinking cursor

- While in **entry mode** (user is typing a number), a solid or blinking cursor sits at
  the right of the current entry.
- The cursor disappears when a function/operator is executed or the display shows a
  result/message.

---

## 7. Numeric Model & Formatting

### 7.1 Internal precision (manual p26/28 — IMPORTANT)

- The HP-10B stores a **signed 12-digit mantissa + signed 3-digit exponent** (i.e. a
  12-digit number in scientific form). It is **not** 15 digits.
- Internally we use IEEE-754 `number` (≈15–16 significant digits), which is a superset —
  that is fine. What matters is that the **display** never shows more than 12 digits and
  that rounding/formatting matches the device (§7.2–§7.4).

### 7.2 Display digits (`DISP`)

- `DISP n` (n = 0–9): show **n decimal places** (fixed-point), rounded.
- `DISP [C]` (DISP then C): **full precision** — show all stored digits, no trailing
  zeros.
- `DISP` while holding `C`: temporarily show all 12 digits.
- Default display (freshly powered on): the manual's default (verify: typically a
  fixed format; transcribe the default from the manual during T1.1 and record it).

### 7.3 Rounding (`RND`)

- `RND` **rounds the stored value** to the current display precision (not just the
  display) — subsequent computations use the rounded value.
- `RND` is the shift function of `◄`.

### 7.4 Decimal separator (`•/,`)

- `•/,` (shift of `•`) **toggles** between period (`.`) and comma (`,`) as the decimal
  separator in the display.
- The thousands grouping is the opposite symbol (e.g. `1,234.56` ↔ `1.234,56`).
- This is a display-only change; the stored value is unaffected.

### 7.5 Scientific notation (`E`)

- `E` (shift of `+/−`) enters a **scientific-notation exponent** into the current entry.
  Example: `4 [E] [+/−] 12` → `4.00E-12`.
- The display automatically uses scientific notation when the value is too large/small
  for the current fixed format.

### 7.6 Floating-point hygiene (implementation requirement)

- Because we use IEEE-754, guard the **display layer** against artifacts:
  - Round to the display precision before rendering.
  - Normalize `-0` to `0`.
  - For TVM/IRR/percent results, compare against the manual's worked-example values to
    catch drift (see §13).
- Do **not** let intermediate floating-point error leak into the displayed 12-digit value
  in a way that differs from the manual's examples.

---

## 8. State Model

The entire calculator is a single serializable `state` object (the single source of
truth). Every mutation goes through it and triggers a re-render + persistence (§11).

### 8.1 Registers

**Business registers (10 logical, some shared):**
`N`, `I/YR`/`NOM %` (shared), `PV`, `PMT`, `FV`, `CST`, `PRC`, `MAR`/`MU` (shared),
`P/YR`, `EFF %`.

**General storage:**
- **1 `M` register** — `→M` stores, `RM` recalls, `M+` adds to it.
- **15 numbered registers `R0`–`R.4`** — general storage; also used internally for
  cash-flow memory and summary statistics.

**Cash-flow memory:** a list of `{ CFj, Nj }` entries, built with `CFj`/`Nj` and used by
`NPV`/`IRR/YR`. (Internally stored in the numbered registers; exposed as a list in
`state`.)

**Statistical memory:** the summation registers `n`, `Σx`, `Σy`, `Σx²`, `Σy²`, `Σxy`,
accumulated with `Σ+`/`Σ−`, cleared with `CL Σ`.

### 8.2 Modes

- **Annuity mode:** `END` (default) vs `BEGIN` — toggled by `BEG/END` (shift of `0`).
  Shown by the `BEGIN` annunciator when in BEGIN.
- **Display format:** current `DISP` setting (decimal places / full precision), decimal
  separator (`•` or `,`), and scientific-notation flag.
- **Shift-armed** flag (transient).

### 8.3 Entry / operation context (transient)

- Current entry value (in-progress number), entry-in-progress flag.
- Pending operator (`+`, `−`, `×`, `÷`, `%`) and the first operand.
- The "other" value held for two-number functions (`INPUT`), e.g. the first operand of
  `%CHG` or the second variable in stats.
- Active message (status/error) and its clear behavior.

### 8.4 Shape (suggested)

```js
state = {
  power: true,
  registers: {
    business: { N, IYR, PV, PMT, FV, CST, PRC, MAR, PYR, EFF },
    M: 0,
    numbered: [ /* R0..R.4 */ ],
  },
  cashflows: [ /* { cf, nj } */ ],
  stats: { n, sx, sy, sx2, sy2, sxy },
  modes: { annuity: 'END', disp: 2, sep: '.', sci: false },
  entry: { value: 0, entering: false },
  op: { pending: null, first: null, other: null },
  display: { message: null, cursor: false },
}
```

> Exact field names are an implementation detail; the **semantics** above are normative.

---

## 9. Feature Specifications

> For each feature: inputs, output, and the algorithm/behavior. Worked examples that
> must reproduce exactly are listed in §13.

### 9.1 Time Value of Money (TVM)

- **Registers:** `N` (number of payments), `I/YR` (annual interest %), `PV`, `PMT`,
  `FV`, plus `P/YR` and annuity mode (BEGIN/END).
- **Behavior:** enter any **four** of the five values, then press the key for the fifth
  to **solve** for it. E.g. set `N`, `I/YR`, `PV`, `PMT`, then press `FV` → solves FV.
- **Per-period rate:** `i = (I/YR / 100) / (P/YR)`.
- **Equation** (END mode; BEGIN multiplies the PMT term by `(1+i)`):

  ```
  PV + PMT * ( (1 - (1+i)^-N) / i ) * (BEGIN ? (1+i) : 1) + FV * (1+i)^-N = 0
  ```

- **Solving for `I/YR`:** transcendental — solve numerically (bisection + Newton, or a
  robust bracketing method) over a sensible bracket (e.g. −100% to a large positive
  bound), then report `I/YR = i * P/YR * 100`.
- **Sign convention:** money in vs. out follow the cash-flow sign convention (a loan's
  PV and PMT have opposite signs). Preserve the HP-10B's sign behavior.
- **Edge cases:** `i = 0` (use `PV + PMT*N + FV = 0`), `N = 0`.

### 9.2 Interest Conversion

- **`EFF %`** (effective annual rate from nominal):
  ```
  EFF = ( (1 + (NOM/100) / (P/YR))^(P/YR) - 1 ) * 100
  ```
- **`NOM %`** (nominal from effective):
  ```
  NOM = ( (1 + EFF/100)^(1/(P/YR)) - 1 ) * (P/YR) * 100
  ```
- `I/YR` and `NOM %` share a register; `PV`/`EFF %` sharing is an implementation detail
  to confirm against the manual (record in `DECISIONS.md`).

### 9.3 NPV / IRR (cash flows)

- **Entry:** build the cash-flow list with `CFj` (a cash-flow amount) and `Nj` (how many
  consecutive periods it repeats). The first `CFj` entered is `CF0` (time 0).
- **`NPV`:**
  ```
  r = (1 + I/YR/100)^(1/(P/YR)) - 1          // per-period rate
  NPV = CF0 + Σ_j CFj / (1 + r)^j            // j = cumulative period index
  ```
  (Verify the exact discounting convention — annual vs. per-period — against the manual's
  NPV at-a-glance page during T1.7 and record it.)
- **`IRR/YR`:** solve for the rate `R` such that `NPV(R) = 0`, then report the annual
  rate. Use a robust root-finder (bisection + Newton) with sign-change bracketing;
  handle the case of multiple roots by reporting the smallest positive root consistent
  with the manual's examples.
- **`Nj`:** repeats the preceding `CFj` for `Nj` consecutive periods (e.g. `7000 [CFj]`
  then `2 [Nj]` = 7000 in periods 2 and 3).

### 9.4 Business Percent (%, %CHG, MAR, MU, CST, PRC)

- **`%` (percent of / add / subtract percent):**
  - `A [%]` → A as a percentage (used with a pending operator to add/subtract a percent
    of the first operand).
  - `A [+ B [%]` → `A + (B% of A)`; `A [− B [%]` → `A − (B% of A)`.
  - `A [INPUT] B [%]` → what percent B is of A.
  - Transcribe the manual's exact percent examples (simple interest, add/subtract %) and
    match them during T1.4.
- **`%CHG` (percent change):** `A [INPUT] B [%CHG]` → `(B − A) / A * 100`.
  - Example: `17 [INPUT] 29 [%CHG]` → **70.59**.
- **`MAR` (margin) / `MU` (markup):** with `CST` (cost) and `PRC` (price):
  ```
  MAR = (PRC - CST) / PRC * 100
  MU  = (PRC - CST) / CST * 100
  ```
  Example: `CST=255, PRC=300` → `MAR` = **15.00** (and `MU` ≈ 17.65).
- **`CST` / `PRC`:** given any two of {`CST`, `PRC`, `MAR`/`MU`}, solve for the third.

### 9.5 Statistics & Regression

- **Accumulate** two-variable data with `Σ+` (add) and `Σ−` (subtract); `CL Σ` clears.
  Each `Σ+`/`Σ−` expects `x [INPUT] y` (or a single `x`).
- **Summation registers:** `n`, `Σx`, `Σy`, `Σx²`, `Σy²`, `Σxy`.
- **Functions (shift of digit keys):**
  - `x̄, ȳ` (shift `7`): means `Σx/n`, `Σy/n`.
  - `Sx, Sy` (shift `8`): **sample** standard deviations.
  - `σx, σy` (shift `9`): **population** standard deviations.
  - `x̂, r` (shift `4`): predicted-x and correlation coefficient.
  - `ŷ, m` (shift `5`): predicted-y and slope.
  - `x̄w` (shift `6`): weighted mean.
- **Formulas:**
  ```
  x̄ = Σx/n                         ȳ = Σy/n
  Sx  = sqrt( (Σx² - (Σx)²/n) / (n-1) )      // sample
  σx  = sqrt( (Σx² - (Σx)²/n) / n )          // population
  r   = (nΣxy - ΣxΣy) / sqrt( (nΣx² - (Σx)²)(nΣy² - (Σy)²) )
  m   = (nΣxy - ΣxΣy) / (nΣx² - (Σx)²)        // slope
  a   = ȳ - m*x̄                              // intercept
  x̂   = (y - a) / m                           // inverse regression, y from current entry
  ŷ   = a + m*x                                // x from current entry
  ```
  (Confirm the exact argument each function takes — current entry vs. mean — against the
  manual during acceptance review.)

### 9.6 Amortization (`AMORT`)

- With a TVM set up, `AMORT` (shift of `FV`) computes, for a given number of periods:
  total **interest**, total **principal**, and remaining **balance**.
- Per-period interest = balance × `i`; principal = `PMT` − interest; balance decreases.
- Confirm the exact input (number of periods to amortize) and output order against the
  manual's amortization section during T1.9.

### 9.7 Math Functions

| Key | Shift function | Behavior |
|---|---|---|
| `+/−` | `E` | negate sign / enter scientific exponent |
| `÷` | `1/x` | reciprocal |
| `×` | `y^x` | power (base from first operand, exponent from second) |
| `−` | `√x` | square root |
| `+` | `x²` | square |
| `1` | `e^x` | natural exponential |
| `2` | `LN` | natural log |
| `3` | `n!` | factorial (integer; error for non-integer/negative per manual) |
| `K` | `SWAP` | exchange the last two numbers / x↔y in stats (§9.8) |

- Unary math functions operate on the current entry/display value.
- `y^x` is binary (needs two operands, e.g. via `INPUT` or a pending operator).

### 9.8 SWAP (`K`)

- Exchanges the **last two numbers** entered, or the hidden result of a two-value
  function, or `x`↔`y` in statistics (manual p25).
- Transcribe the manual's SWAP examples and match during T2.3.

### 9.9 Arithmetic & Two-Number Functions (`INPUT`)

- Basic `+ − × ÷` with a pending-operator model (see §8.3). `=` executes the pending
  operation and, if a new operator follows, chains (e.g. `6.9 [5] [35] [=]` → 36.92 →
  `.91 [=]` → 40.57; `4 [+ 9 [× 3 [=]` → 39.00).
- **`INPUT`** separates two numbers for two-number functions (`%CHG`, two-variable
  stats, `y^x`, etc.). Shows the `:` annunciator. `C` erases the separation.
  - Pattern: `number1 [INPUT] number2 [function]`.
- **Chaining & precedence:** follow the manual's immediate-execution (RPN-like) model —
  operators execute in the order entered, not by algebraic precedence, unless the manual
  states otherwise. Verify against the chaining examples in §13.

---

## 10. Clearing Semantics (manual p23)

| Action | Effect |
|---|---|
| `◄` (backspace) | If a cursor is active (entry in progress), erase the last digit. Otherwise clear the display / cancel the current calculation. Also clears error messages. |
| `C` | Clears the current entry to zero, or cancels the current calculation. Clears error messages. |
| `CLEAR ALL` (shift `INPUT`) | Clears **all memory** (registers, cash flows, statistical memory). Does **not** reset modes. |
| `CL Σ` (shift `→M`) | Clears statistical memory only. |
| `OFF` (shift `C`) | Powers off — clears all volatile state and (in the web app) the session state (§11). |

> **Modes** (`BEG/END`, `P/YR`, display format) are **not** cleared by `CLEAR ALL`.

---

## 11. Persistence Model

- **Mechanism:** `window.sessionStorage` under a single namespaced key, e.g.
  `h10b.state.v1`.
- **Save:** serialize the `state` object (JSON) on **every mutation** (after each key
  action that changes state).
- **Restore:** on page load, if a saved state exists, deserialize and restore; otherwise
  start from the powered-on defaults (§12.4).
- **Scope:** `sessionStorage` is per-tab and cleared when the tab closes — a faithful
  analog of the device's volatile memory (power off / session end → state gone).
- **Clear:** on `OFF`, remove the key from `sessionStorage` and reset to defaults.
- **Versioning:** include a schema version in the stored object; on mismatch, discard and
  start fresh (record a decision if you add migrations).
- **Guards:** wrap `sessionStorage` access in try/catch (it can throw in private-browsing
  or file:// contexts); if unavailable, degrade gracefully to in-memory-only (record a
  decision).

---

## 12. Display Messages, Power, and Errors

### 12.1 Status messages

- Certain operations show a **status message** in the display (e.g. after a solve, a
  mode change, or a register operation). `C` or `◄` dismisses it.

### 12.2 Error messages

- Invalid operations produce an **error message** (e.g. divide by zero, domain error for
  `√` of a negative, `LN` of a non-positive, `n!` of a non-integer, no root for IRR).
- `C` or `◄` clears the error and returns to a usable state.
- **Error messages (manual pp. 133–135):**
  - `Error - Func`: divide by zero; invalid factorial; LN of zero/negative; 0⁰ or 0 to a negative power; negative base to non-integer power; square root of a negative.
  - `Error - Full`: more than five pending operations or more than 15 cash-flow groups.
  - `Error - Int`: periodic interest rate is ≤ −100%.
  - `Error - n`: solve for I/YR with N ≤ 0.99999 or N ≥ 1E10.
  - `Error - P Yr`: invalid P/YR or attempt to solve P/YR.
  - `Error - PEr`: invalid Nj (not an integer from 1 to 99).
  - `Error - Soln`: no solution for IRR/YR or I/YR.
  - `Error - StAt`: invalid statistical calculation (empty/insufficient data, zero variance or denominator).
  - `OFLO`: overflow; display briefly, then show the overflow value. Intermediate TVM/cash-flow overflow leaves the message displayed.
  - `UFLO`: intermediate TVM result is too small to process.
- Status labels include `ALL CLr`, `bAL`, `CF<j>`, `Int`, and `n<j>`.

### 12.3 Overflow / underflow

- Values beyond the representable range produce the device's overflow message/behavior
  (transcribe from the manual).

### 12.4 Power ON / OFF

- **OFF** (shift `C`): power off — clear all volatile state + session storage; the
  display goes blank.
- **ON:** press `C` when off (the `ON` label) to power back on to defaults.
- **Defaults on power-on:** display `0.00000` (or the manual's default), END mode,
  default display format, all registers zeroed. Confirm the exact default display format
  from the manual during T1.1.

---

## 13. Testing & Acceptance (worked examples)

> These are **acceptance tests**. A feature is `Verified` only when its example
> reproduces **exactly** in a real browser. Transcribe any missing expected values from
> the manual's at-a-glance pages (scratchpad `hi-10`, `hi-13`, `hi-17`, `hi-18`) during
> the relevant task.

| # | Sequence | Expected | Feature |
|---|----------|----------|---------|
| A1 | `10 [NOM %]`, `12 [P/YR]`, `[EFF %]` | **10.47** | Interest conversion |
| A2 | `200 [=]`, `25 [%]` → then `[=]` | **50.00** | Percent of |
| A3 | `200 [−]`, `25 [%]` → then `[=]` | **150.00** | Subtract percent |
| A4 | `1250 [×] 7 [%]` → then `[=]` | **87.50** → **1,337.50** | Simple interest |
| A5 | `291.7 [INPUT] 316.8 [%CHG]` | **8.60** | Percent change |
| A6 | `12 [5] [INPUT] 65 [18] [%CHG]` | **38.33** | Percent change |
| A7 | `17 [INPUT] 29 [%CHG]` | **70.59** | Two-number %CHG |
| A8 | `255 [CST]`, `300 [PRC]`, `[MAR]` | **15.00** | Margin |
| A9 | `6.9 [5] [35] [=]` → `.91 [=]` | **36.92** → **40.57** | Chaining |
| A10 | `4 [+ 9 [× 3 [=]` | **39.00** | Chaining/precedence |
| A11 | `CLEAR ALL`, `12 [P/YR]`, `40000 [+/−] [CFj]`, `4700 [CFj]`, `7000 [CFj]`, `2 [Nj]`, then `[IRR/YR]` and `[NPV]` | values from manual `hi-13` | NPV/IRR |
| A12 | TVM solve (e.g. set N, I/YR, PV, PMT → solve FV) | value from a manual TVM example | TVM |
| A13 | Stats: enter a small two-variable data set via `Σ+`, then `x̄`, `Sx`, `r` | values from a manual stats example | Statistics |

> **Note:** A2–A4 percent sequences are as best transcribed; **verify the exact key
> order against the manual** during T1.4 and correct the table if the manual differs.

### 13.1 Regression suite (Phase 4)

- Encode every row above as an automated check (a small, dependency-free test harness in
  JS, runnable in the browser or via a headless check). A feature is `Verified` when its
  row passes.

---

## 14. Keyboard Mapping

Every on-screen key must be reachable from a physical keyboard. Suggested mapping
(adjust for usability, but keep it discoverable and documented in a small on-screen hint
or the README):

| Physical key(s) | Action |
|---|---|
| `0`–`9` | digit entry |
| `.` | decimal point (`•`) |
| `+` `-` `*` `/` | arithmetic operators |
| `Enter` | `=` (execute) |
| `Backspace` | `◄` (backspace / clear entry) |
| `Escape` | `C` (clear) |
| `Shift` (hold) | arm SHIFT (orange key) |
| `%` | `%` |
| `!` | `n!` |
| `^` | `y^x` |
| `e` | `e^x` |
| `l` / `ln` | `LN` |
| `s` | `√x` (or `r`) |
| `q` | `x²` |
| `n` | `N` |
| `i` | `I/YR` |
| `p` | `PV` |
| `m` | `PMT` |
| `f` | `FV` |
| `c` | `CST` |
| `r` | `RCL` |
| `t` | `P/T` … (as needed) |
| `a` | `AMORT` |
| `g` | `SWAP` |
| `v` | `INPUT` |
| `x` | `Σ+` (and `X`/`shift+x` → `Σ−`) |
| `y` | `MAR` (and `shift+y` → `MU`) |

> The exact letter assignments are an implementation choice; **the requirement is that
> 100% of keys are keyboard-reachable** and the mapping is documented. Record the final
> mapping in `DECISIONS.md`.

---

## 15. Non-functional Requirements

- **Browsers:** current Chrome, Firefox, Safari, Edge (desktop + mobile). No polyfills.
- **Performance:** instant response to keypresses; no perceptible lag; rendering must be
  cheap (re-render only the display + annunciators on state change, not the whole keypad).
- **No network:** the app must run fully offline from `file://`.
- **Accessibility:**
  - Visible focus states for keyboard navigation of keys.
  - `aria-label`s on every key describing primary + shift function.
  - Sufficient color contrast for the LCD and labels.
  - Keyboard fully operable (no mouse required).
- **Responsiveness:** the device scales to fit the viewport, preserving proportions;
  remains usable on a phone screen.
- **Visual fidelity:** match the photo's colors (black body, green/olive LCD, orange
  SHIFT, yellow shift labels, white/gray primary labels), key shapes, and the `hp` /
  `10B` / `BUSINESS` markings. Use a clean tabular/monospace numeral face for the LCD;
  a humanist sans for key labels. No external font downloads.
- **Robustness:** no uncaught exceptions on any key sequence; invalid input yields the
  device's error message, not a crash.

---

## 16. File Structure

```
H10B_Calculator/
├── index.html              # app markup (device, display, keypad)
├── styles.css              # all styling (device, LCD, keys, responsive)
├── app.js                  # all logic (state, key dispatch, features, persistence)
├── specs.md                # this document
├── AGENTS.md               # entry point + workflow for the building agent
├── README.md               # human-facing overview + how to run
├── .gitignore
├── Assets/
│   ├── HP-10B.jpg          # appearance source of truth
│   └── User_Manual.pdf     # behavior source of truth
└── Project_Management/
    ├── PROGRESS.md         # task board (status per task)
    ├── DECISIONS.md        # decision log (D1..Dn)
    ├── ISSUES.md           # bug/issue log (symptom, repro, root cause, fix, verify)
    └── CHANGELOG.md        # append-only change history
```

---

## 17. Project Workflow (for the building agent)

After **every completed task**:

1. Update `Project_Management/PROGRESS.md` — move the task to its new status.
   Vocabulary: `Not Started → In Progress → Done → Verified`, plus `Blocked`.
   - `Done` = implemented.
   - `Verified` = implemented **and** its §13 worked-example reproduces exactly in a
     real browser.
2. Append to `Project_Management/CHANGELOG.md` (append-only; never edit past entries).
3. Non-obvious choice? Record it in `Project_Management/DECISIONS.md`.
4. Bug found/fixed? Record it in `Project_Management/ISSUES.md`.
5. `git commit` with a clear message (e.g. `T1.6: implement TVM solve`).

**Build order:** follow the phases in `Project_Management/PROGRESS.md`
(scaffold → formatting/arithmetic → math/business% → TVM → NPV/IRR → stats → amortization
→ registers/clearing/SWAP → annunciators/errors/power → visual QA → acceptance/regression).

**Definition of shipped:** every Phase 1–3 feature is at least `Done`; every feature
with a §13 worked-example is `Verified`; the regression suite passes in all target
browsers.

---

## Appendix A — Glossary

| Term | Meaning |
|---|---|
| TVM | Time Value of Money (N, I/YR, PV, PMT, FV). |
| `NOM %` / `EFF %` | Nominal / effective annual interest rate. |
| `P/YR` | Payments (periods) per year. |
| `CFj` / `Nj` | j-th cash-flow amount / its repeat count. |
| `CST` / `PRC` | Cost / Price. |
| `MAR` / `MU` | Margin / Markup. |
| `Σ+` / `Σ−` | Add / subtract a data point to statistical memory. |
| `CL Σ` | Clear statistical memory. |
| `SWAP` | Exchange the last two values / x↔y. |
| `INPUT` | Separate two values for a two-number function. |
| `DISP` | Set display decimal places / full precision. |
| `RND` | Round the stored value to display precision. |
| `•/,` | Toggle period/comma decimal separator. |
| `E` | Enter scientific-notation exponent. |

## Appendix B — Open items to confirm against the manual during build

1. Default display format on power-on (T1.1).
2. Exact percent (`%`) key-order semantics for A2–A4 (T1.4).
3. NPV/IRR discounting convention (annual vs. per-period) (T1.7).
4. Exact argument each statistics function takes (current entry vs. mean) (T1.8).
5. Amortization input/output order (T1.9).
6. Full error/status message list and exact wording (T3.2).
7. `PV`/`EFF %` register-sharing detail (record in `DECISIONS.md`).

> Resolve each by transcribing the manual's relevant page, updating this spec (or the
> relevant feature section), and recording a decision.
