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

---

## Conventions

- Every `Resolved` issue should name the commit or CHANGELOG entry that fixed it.
- If a fix changes behavior, also add a note in `DECISIONS.md` if it was a choice.
- When a feature's worked-example fails, open an issue **and** keep the task at
  `Done` (not `Verified`) until it's `Resolved`.
