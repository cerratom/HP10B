# ISSUES — HP-10B Web Calculator

Log of bugs, defects, and surprising behaviors, plus **how each was fixed**.

Format (add new entries at the top of "Open" or "Resolved"):

```
## I<id> — <short title>
- **Date found:** YYYY-MM-DD
- **Status:** Open | In Progress | Resolved
- **Severity:** low | medium | high | blocking
- **Symptom:** what the user/developer sees.
- **Repro:** steps to reproduce (key sequence, e.g. `12 [N] 5 [I/YR] …`).
- **Root cause:** why it happened.
- **Fix:** what changed (file/section), and how it was verified.
```

---

## Open

### I1 — Large `replace_file` payloads cause JSON parse errors
- **Date found:** 2026-11-01
- **Status:** In Progress
- **Severity:** high
- **Symptom:** `"Unterminated string in JSON at position 19336 (line 1 column 19337)"` — the Bionic tool-call layer fails to serialize/deserialize the tool call when `new_content` is very large (~200+ lines).
- **Repro:** Call `replace_file` with a `new_content` string exceeding ~19 KB. The JSON payload is truncated or corrupted, producing the parse error in the Bionic UI/console.
- **Root cause:** The tool-call JSON envelope has a practical size limit or the string contains characters (e.g. unescaped quotes, newlines in certain contexts) that break the JSON encoding at the transport layer.
- **Fix (workaround):** Write files in **smaller chunks** — use `replace_file` for the first ~100 lines, then append via `edit_file_tool` (which uses smaller, targeted replacements). Alternatively, write via `shell_command` with `cat << 'EOF' > file` heredocs to bypass the JSON tool-call layer entirely.
- **Verification:** No JSON errors in Bionic console when writing files ≤ ~100 lines per call.

## Resolved

### I9 — NPV/IRR used an effective-annual discounting convention
- **Date found:** 2026-11-02
- **Status:** Resolved
- **Severity:** high
- **Symptom:** Manual A11 example gave IRR/YR 17.18 (expected 15.96) and NPV 668.45 (expected 622.85).
- **Repro:** `CLEAR ALL`, `12 [P/YR]`, `40000 [+/−] [CFj]`, `4700 [CFj]`, `7000 [CFj]`, `2 [Nj]`, `23000 [CFj]`, `[⇧IRR/YR]`.
- **Root cause:** `npvResult` derived the per-period rate as `(1+I/YR)^(1/P/YR)−1` (effective annual) and `irrResult` annualized the solved root as an effective annual rate. The HP-10B uses the nominal convention (manual pp. 17–18).
- **Fix:** `npvResult` now uses `r = (I/YR/100)/(P/YR)`; `irrResult` reports `100 × r × P/YR`. Verified: headless acceptance run now shows A11 expected values; user confirmed A11 PASS in browser. Fixed in commit 94ce412.
- Related: D15, T1.7 (`Verified`), T4.1.

### I10 — Shifted statistics functions ignored the value being entered
- **Date found:** 2026-11-02
- **Status:** Resolved
- **Severity:** medium
- **Symptom:** In the p. 92 forecasting example, `0 [⇧ŷ,m]` used the previous Σ+ y-value (2200) as x and displayed 937,301.25 instead of the y-intercept 376.25.
- **Repro:** `CL Σ`, enter the p. 92 pairs, then `0 [⇧ŷ,m]`.
- **Root cause:** `statFunction` read `state.displayVal` directly without `commitEntry()`, leaving an in-progress entry buffer unconsumed.
- **Fix:** `statFunction` now calls `commitEntry()` first. Verified: user confirmed A15 PASS in browser. Fixed in commit 94ce412.
- Related: T1.8 (`Verified`), T4.1.

### I11 — Acceptance runner could not press shifted digit keys
- **Date found:** 2026-11-02
- **Status:** Resolved
- **Severity:** medium
- **Symptom:** New stats checks reported plain digit entry instead of statistics functions; `SHIFT+7/8/9/4` (x̄, Sx, σx, ŷ) never fired.
- **Repro:** `index.html?test=1` → A13–A15 show `Error - Stat` / raw digits.
- **Root cause:** The runner's `key(name, shifted)` helper short-circuited digits to `pressDigit` before checking `shifted`, and `split('').forEach(key)` passed the array index as a truthy second argument.
- **Fix:** Digit/decimal short-circuit now only applies when `shifted !== true` (strict), and shifted digits route through `pressButton` with the shift annunciator armed. Also added an `enter(value)` helper for readability.
- Related: T4.1, T4.2.

### I8 — LCD height changed between OFF and ON
- **Date found:** 2026-11-01
- **Status:** Resolved
- **Severity:** low
- **Symptom:** The LCD area became taller when powered on and showing digits.
- **Repro:** Toggle OFF and press C to turn ON.
- **Root cause:** The LCD had only a minimum height, so the digit line box could increase its height when populated.
- **Fix:** Set fixed LCD heights and a unit line-height, with a smaller fixed height at the narrowest breakpoint.
- **Verification:** CSS review and `git diff --check`; browser confirmation remains part of visual QA.

### I7 — LCD number started at the right edge
- **Date found:** 2026-11-01
- **Status:** Resolved
- **Severity:** medium
- **Symptom:** Newly entered numbers appeared at the right side of the LCD instead of beginning at the left like the physical HP-10B.
- **Repro:** Enter any multi-digit value.
- **Root cause:** The empty status-label span used `margin-right: auto`, consuming the available LCD width before the number.
- **Fix:** Replaced the automatic margin with a fixed label gap so the number starts from the LCD's left edge.
- **Verification:** CSS review and `git diff --check`; user reported the intended alignment from the reference image.

### I6 — y^x ignored the first value saved with INPUT
- **Date found:** 2026-11-01
- **Status:** Resolved
- **Severity:** medium
- **Symptom:** `base [INPUT] exponent [y^x]` used only the exponent as a new pending operand.
- **Repro:** Enter 2, INPUT, enter 3, then shifted × (y^x).
- **Root cause:** The y^x dispatch always started a pending operator and did not consume `state.other`.
- **Fix:** The y^x handler now uses the held INPUT value as its base and current value as exponent.
- **Verification:** Code path review and `git diff --check`; browser confirmation remains outstanding.

### I5 — Long display values widened the calculator
- **Date found:** 2026-11-01
- **Status:** Resolved
- **Severity:** medium
- **Symptom:** A long display value could expand the calculator and LCD beyond their intended width.
- **Repro:** Enter or calculate a long value in the display.
- **Root cause:** The LCD flex item and device minimum width allowed intrinsic content sizing to affect the layout.
- **Fix:** Preserved the original device width rules and allowed the LCD value to shrink and clip inside its fixed display area.
- **Verification:** CSS review and `git diff --check`; browser resize confirmation remains part of T3.5.

### I4 — C after OFF called a missing powerOn function
- **Date found:** 2026-11-01
- **Status:** Resolved
- **Severity:** medium
- **Symptom:** Pressing C while powered off threw a reference error instead of powering on.
- **Repro:** Shift+C, then C.
- **Root cause:** `pressC` referenced `powerOn` before a handler had been implemented.
- **Fix:** Added `powerOn`, which restores default powered state and persists it.
- **Verification:** Code path inspection and `git diff --check`; browser confirmation remains in visual/acceptance QA.

### I3 — BEGIN equation in spec had an inconsistent factor
- **Date found:** 2026-11-01
- **Status:** Resolved
- **Severity:** medium
- **Symptom:** The TVM prose specified `(1+i)` for BEGIN payments, while the displayed equation used a factor of two.
- **Repro:** Compare the sentence and equation in `specs.md` §9.1.
- **Root cause:** Transcription error in the displayed equation and zero-interest edge case.
- **Fix:** Updated the equation and implemented the corresponding payment timing in the TVM solver.
- **Verification:** Algebraic review; real-browser manual example remains T1.6 verification work.

### I2 — Decimal rounding lost fractional digits on carry
- **Date found:** 2026-11-01
- **Status:** Resolved
- **Symptom:** Values such as 36.915 formatted incorrectly at two decimal places.
- **Repro:** Display 36.915 with `DISP 2`.
- **Root cause:** The prior digit carry routine concatenated the integer and fractional portions without restoring the decimal position.
- **Fix:** `roundDigits` now rounds the combined decimal digits and splits them at the requested precision.
- **Verification:** Code inspection and `git diff --check`; browser example verification remains part of T1.1.

### I12 — Keypad top-right shifts diverged from specs.md §5.1
- **Date found:** 2026-11-02
- **Status:** Resolved
- **Symptom:** The keypad rendered `ŷ,m` on `⇧4`, `x̂,r` on `⇧SWAP`, and had a bare `SWAP` key with no `K`; `K` constants were unreachable and dispatch names (`XHAT_R`/`YHAT_M`/`XBARW`) were never produced by any key.
- **Repro:** `?test=1` A13/A15 could not reach x̂,r / ŷ,m / x̄w with the spec's key names.
- **Root cause:** `index.html` shipped an early draft key map; specs.md §5.1 defines shifts `4`→x̂,r, `5`→ŷ,m, `6`→x̄w, `K`→SWAP.
- **Fix:** Realigned `index.html` (`K` primary, `SWAP` shift, `4/5/6` shifts, `×`→y^x), added `K: pressK` dispatch and `k` keyboard shortcut, and switched the Node harness to parse `SHIFT_MAP` from `index.html` so the two can't drift apart.
- **Verification:** Headless harness 31/31 including A13/A15 (shifted stats pairs via `⇧K`) and A19–A21 (K constants); browser re-run pending as part of T4.2.

### I13 — Status message not cleared by `RCL`/`STO` + register name
- **Date found:** 2026-11-02
- **Status:** Resolved
- **Symptom:** After `ALL CLr` (⇧INPUT), pressing `RCL` then a register name kept printing `ALL CLr` instead of the recalled value.
- **Repro:** `360 [N] [⇧INPUT] [RCL] [N]` showed `ALL CLr` (caught by acceptance check A34).
- **Root cause:** The register-name branch in `pressButton` recalled/stored without going through the normal handlers that clear a status message.
- **Fix:** The branch now calls `clearMessage()` for status messages before recalling or storing.
- **Verification:** A34 passes (`ALL CLr` → `0.00` → x̄ `10.00` after CL Σ); 34/34 headless.

---

## Conventions

- Every `Resolved` issue should name the commit or CHANGELOG entry that fixed it.
- If a fix changes behavior, also add a note in `DECISIONS.md` if it was a choice.
- When a feature's worked-example fails, open an issue **and** keep the task at
  `Done` (not `Verified`) until it's `Resolved`.
