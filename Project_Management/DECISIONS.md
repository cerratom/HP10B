# DECISIONS — HP-10B Web Calculator

Decision log. Record **why** a choice was made so future sessions don't re-litigate it.

Format:

```
## D<id> — <title>
- **Date:** YYYY-MM-DD
- **Status:** Proposed | Accepted | Superseded by D<id>
- **Decision:** <the choice>
- **Context / why:** <the reasoning, trade-offs considered>
- **Alternatives rejected:** <what we said no to, and why>
```

---

## D1 — Pure vanilla JS, no backend, no build step
- **Date:** 2026-11-01
- **Status:** Accepted
- **Decision:** Implement the entire calculator in vanilla JavaScript + CSS + HTML.
  No framework, no bundler, no package manager, no Python/server, no REST API.
- **Context / why:** The HP-10B is a self-contained state machine with no I/O beyond
  the display. All math is deterministic and fits comfortably in IEEE-754 doubles
  (≈15–16 significant digits; the HP-10B stores 12). There is nothing to "serve" —
  the least moving parts is a static page that opens from `index.html`.
- **Alternatives rejected:**
  - Python backend + API — rejected: adds a process, a port, CORS, and a deploy
    target for zero functional benefit.
  - Framework (React/Vue) — rejected: the app is a single component; a framework
    adds build complexity and weight with no payoff.
  - Web Worker for math — rejected for v1: calculations are trivially fast; revisit
    only if IRR iteration ever feels slow (it won't).

## D2 — Entry point is `index.html` (must work over `file://`)
- **Date:** 2026-11-01
- **Status:** Accepted
- **Decision:** The app must load by opening `index.html` directly, with no server.
- **Context / why:** User requirement — "load it just using index.html", "runs fast on
  the web", "least moving parts". A static page satisfies this and is trivial to host.
- **Alternatives rejected:** SPA router / multi-page — unnecessary for a single-screen app.

## D3 — Persistence via `sessionStorage` (Option B)
- **Date:** 2026-11-01
- **Status:** Accepted
- **Decision:** Serialize the single `state` object to `sessionStorage` on every
  mutation; restore on page load. Clear on power-OFF.
- **Context / why:** The HP-10B has **volatile** memory — power off clears everything.
  `sessionStorage` is the faithful web analog: it survives a refresh (like leaving the
  calculator on) but is wiped when the tab/browser closes (like power off). The JS
  `state` object remains the **single source of truth**; `sessionStorage` is only a
  snapshot.
- **Alternatives rejected:**
  - `localStorage` (Option A) — rejected: would persist across browser restarts, which
    does NOT match the calculator's volatile-memory behavior.
  - `IndexedDB` — rejected: overkill for a small serializable state object.
  - No persistence — rejected: user explicitly wants refresh to keep state.

## D4 — App structure: exactly 3 code files
- **Date:** 2026-11-01
- **Status:** Accepted
- **Decision:** `index.html` + `styles.css` + `app.js`. No subfolders, no modules.
- **Context / why:** Keeps the project dead simple and easy to reason about. `app.js`
  is organized internally into clearly-named sections (state, formatting, engines,
  keyboard, persistence) rather than split across files. If it grows large, splitting
  into ES modules is a later, reversible step.
- **Alternatives rejected:** ES modules / many files — deferred; adds complexity before
  we know we need it.

## D5 — UI fidelity: exact match to the physical HP-10B
- **Date:** 2026-11-01
- **Status:** Accepted
- **Decision:** The UI must look the same as the original (5×7 keypad, black body,
  green/olive LCD, orange SHIFT key, yellow shift labels, white/gray key labels).
- **Context / why:** User requirement — "everything should look the same as the
  original model"; the photo and manual are the source of truth.
- **Alternatives rejected:** A "modernized" UI — rejected; fidelity is the point.

## D6 — Full feature parity
- **Date:** 2026-11-01
- **Status:** Accepted
- **Decision:** Implement every HP-10B feature: TVM, interest conversion, NPV/IRR,
  business percentages, statistics & regression, amortization, math functions, and all
  memory/clearing behavior.
- **Context / why:** User requirement — "full set of features".
- **Alternatives rejected:** A subset / MVP — rejected; scope is the full calculator.

## D7 — Keyboard support is required
- **Date:** 2026-11-01
- **Status:** Accepted
- **Decision:** Full keyboard mapping in addition to the on-screen keys.
- **Context / why:** User requirement — "keyboard must be supported".
- **Alternatives rejected:** Mouse-only — rejected.

## D8 — Manual worked-examples are the acceptance tests
- **Date:** 2026-11-01
- **Status:** Accepted
- **Decision:** Use the HP-10B manual's worked examples as the acceptance test suite;
  a feature is `Verified` only when its example reproduces exactly.
- **Context / why:** User requirement — "use the test cases"; the manual is the
  behavioral source of truth and gives concrete, verifiable numbers.
- **Alternatives rejected:** Invented test vectors — rejected in favor of the
  manufacturer's own examples (more authoritative).

## D9 — Target: modern browsers, use modern web platform
- **Date:** 2026-11-01
- **Status:** Accepted
- **Decision:** Target current Chrome/Firefox/Safari/Edge. Use modern CSS/JS
  (grid, custom properties, `sessionStorage`, `Math`, `Number`, etc.). No legacy
  (IE) support, no polyfills.
- **Context / why:** User requirement — "any modern browser, not too worry about
  legacy, use all the technology available to a modern browser".
- **Alternatives rejected:** IE11 / old-Safari support — rejected.

## D10 — Record-keeping system (long-lived project)
- **Date:** 2026-11-01
- **Status:** Accepted
- **Decision:** Maintain git + `PROGRESS.md` (task board) + `CHANGELOG.md` (history)
  + `DECISIONS.md` (this log) + `ISSUES.md` (bugs). Status vocabulary:
  `Not Started → In Progress → Done → Verified` plus `Blocked`.
- **Context / why:** User wants durable progress records and a way to track done vs.
  pending across many sessions. "Verified" = passed its manual worked-example.
- **Alternatives rejected:** External tracker (Jira/Trello) — rejected; keep it in-repo
  so it travels with the code and is greppable.

## D11 — Internal numeric precision: 12 significant digits
- **Date:** 2026-11-01
- **Status:** Accepted
- **Decision:** Model the HP-10B's "signed 12-digit number with a signed 3-digit
  exponent" storage. Compute in IEEE-754 doubles; round to the display format for
  output; `RND` commits rounding into the stored value.
- **Context / why:** Manual (p.26) states numbers are stored as 12-digit numbers.
  Doubles give more than enough headroom; we emulate the 12-digit behavior for
  fidelity (display, rounding, scientific-notation thresholds).
- **Alternatives rejected:** Arbitrary-precision (BigInt/decimal) — rejected; not
  needed for fidelity and adds complexity.

## D12 — Keyboard access by row and column
- **Date:** 2026-11-01
- **Status:** Accepted
- **Decision:** `;` followed by row and column invokes any physical key; common keys also have direct shortcuts.
- **Context / why:** The complete keypad exceeds the number of convenient one-letter shortcuts. Row and column sequences give every button a stable keyboard path without conflicting with digit entry.

## D13 — BEGIN timing in the TVM equation
- **Date:** 2026-11-01
- **Status:** Accepted
- **Decision:** Multiply the payment annuity factor by `(1+i)` in BEGIN mode; keep PV and EFF in separate registers.
- **Context / why:** Payments at the beginning of each period accrue one additional period of interest. The spec prose stated this but its displayed equation accidentally doubled the payment factor. The state model already defines EFF independently from PV; the scanned manual needs visual confirmation during acceptance review.

## D14 — Interpret x̂ as inverse regression
- **Date:** 2026-11-01
- **Status:** Accepted pending manual review
- **Decision:** Use current display as y and compute x̂ = (y − intercept) / slope; use current display as x for ŷ = intercept + slope × x.
- **Context / why:** The previous spec duplicated the ŷ equation under x̂. Inverse regression follows the named function and avoids returning the same prediction for both keys. Confirm the manual's exact input convention during acceptance verification.

## D15 — NPV/IRR use the nominal annual convention
- **Date:** 2026-11-02
- **Status:** Accepted
- **Decision:** `NPV` discounts cash flows at the per-period rate `r = (I/YR/100) / (P/YR)`;
  `IRR/YR` reports the solved per-period root multiplied by `P/YR` (nominal annual).
- **Context / why:** The scanned manual's IRR/YR-and-NPV at-a-glance pages (pp. 17–18) are
  definitive: with `P/YR = 12`, `10 [I/YR]` produces NPV **622.85** (i.e. 10/12 % per month),
  IRR/YR **15.96** with `÷ 12 =` giving **1.33** per month. The previous implementation used
  an effective-annual convention (15.96 → 17.18, 622.85 → 668.45), which reproduced neither.
- **Alternatives rejected:** Effective-annual discounting — rejected because no worked
  manual example matches it; it also contradicts the manual's own `÷ 12 =` monthly-IRR step.
- **Also confirmed here:** D14's ŷ/x̂ convention is validated by the p. 92 forecasting
  example (`0 [⇧ŷm]` → b, `SWAP` → m, `⇧x̂r` `SWAP` → r = 0.90) — D14 now fully Accepted.

## D16 — Split statistics acceptance coverage into A13–A15
- **Date:** 2026-11-02
- **Status:** Accepted
- **Decision:** Replace the placeholder A13 with three manual-derived checks: A13 two-variable
  means/σ (p. 90), A14 one-variable mean/Sx (pp. 89–90), A15 regression b/m/r (p. 92).
- **Context / why:** The spec's single A13 row mixed x̄, Sx, and r, but no single manual
  worked example covers all three; each chosen example is transcribed exactly, keeping
  "expected values come from the manual" (D8) intact.

## D17 — Amortization rounds each period's interest to cents
- **Date:** 2026-11-02
- **Status:** Accepted
- **Decision:** In `amortize()`, each period's interest is rounded to the current
  display decimals (2 by default) before principal and balance are derived.
- **Context / why:** Exact binary arithmetic on the p. 13 loan gives bAL = 13,865.82
  after payment 20, but the manual prints 13,865.83. Simulating cent-rounded
  interest reproduces every printed figure in the p. 15 examples (A23 and A24),
  matching how a 2-digit BCD register machine accumulates the amortization schedule.
- **Verified by:** A23 (`PEr 20- 20` → Int −115.61, Prin −7.25, bAL 13,865.83) and
  A24 (`PEr 1- 12` → Int −1,396.50, Prin −77.82, bAL 13,922.18) headlessly.

## D18 — K constants follow manual pp. 35–37 semantics
- **Date:** 2026-11-02
- **Status:** Accepted
- **Decision:** `K` stores the pending operator + current operand (or a just-computed
  `%` result as a "±n%" constant); `=` chains the constant, entering a new number then
  `=` applies it, and a new binary operator cancels it. The top-right keypad key is
  `K` (primary) with `SWAP` as its shift, per specs.md §5.1 — the previous build had
  these inverted and `K` unimplemented (logged as I12).
- **Verified by:** A19 (`5 [+] 2 [K]` → +2), A20 (`10 [+] 10 [%] [K]` → +10%),
  A21 (`2 [⇧y^x] 3 [K]` → y^x 3) headlessly.

## D19 — Manual register storage side effects
- **Date:** 2026-11-02
- **Status:** Accepted
- **Decision:** `NPV` stores its result in PV and `IRR/YR` stores its result in I/YR
  (manual p. 84); `R0`–`R14` alias the cash-flow list while flows exist (manual p. 80:
  `⇧STO 0` replaces CF0; `RCL 0` views it); `⇧STO` followed by a business-register name
  stores X into that register.
- **Verified by:** A27 (STO 0 replaces CF0, `⇧IRR` 12.49 auto-stored, `RCL IYR` 12.49)
  and A31 (`RCL 0` → −11,000.00) headlessly.
